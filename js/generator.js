/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  WORKOUT GENERATOR
  =================
  Builds a workout to order from: equipment on hand, minutes available,
  one or two people, interval style, target body regions, and a list of
  movements to keep out.

  Why generated rather than a table of preset workouts: the input space is
  6 equipment items x ~8 durations x 2 people x 2 intervals x 31 region
  combinations x arbitrary exclusions. Presets can only ever cover a
  corner of that, which is exactly why the short sessions kept handing
  back a trimmed-down copy of the long ones. This composes from the whole
  156-movement library every time, and remembers what it used last time so
  consecutive sessions don't rhyme.
*/

// Deterministic RNG so a given seed always rebuilds the same workout , 
// that's what lets "regenerate" be a real choice rather than a lottery,
// and lets a saved favourite come back identical.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Movement groups the generator schedules against. Each block is filled
// from exactly one group, which is how a session ends up covering
// distinct patterns instead of six variations on a squat.
const GROUPS = {
  legsBig: { label: 'Squats & hinges',    patterns: ['squat', 'hinge'],  regions: ['legs'] },
  push:    { label: 'Presses & push-ups', patterns: ['pushH', 'pushV'],  regions: ['push'] },
  pull:    { label: 'Rows & pulls',       patterns: ['pullH', 'pullV'],  regions: ['pull'] },
  legsUni: { label: 'Lunges & step-ups',  patterns: ['lunge'],           regions: ['legs'] },
  core:    { label: 'Core',               patterns: ['coreAnti', 'coreFlex', 'coreRot', 'coreLat', 'crawl'], regions: ['core'] },
  cardio:  { label: 'Conditioning',       patterns: ['cardio'],          regions: ['cardio'] },
  carry:   { label: 'Carries & holds',    patterns: ['carry'],           regions: ['core', 'pull'] }
};

// Scheduling order: open with a big compound, alternate push against
// pull, put core and conditioning later, finish on a carry or a burner.
const GROUP_ORDER = ['legsBig', 'push', 'pull', 'legsUni', 'core', 'cardio', 'carry'];

// Same movement at two loads, the generator sometimes builds a block
// around one of these so a pair can share the gear and swap at halfway.
const WEIGHT_PAIRS = [
  ['gobletSquat15', 'gobletSquat10'],
  ['kbSwing15', 'kbSwing10'],
  ['kbCleanPress15', 'kbCleanPress10'],
  ['dbPressHeavy', 'dbPressLight']
];

// Warm-up and cool-down scale with the session rather than eating ten
// minutes out of every twenty.
function bookends(minutes) {
  if (minutes <= 15) return { warmupSec: 120, cooldownSec: 120 };
  if (minutes <= 25) return { warmupSec: 180, cooldownSec: 180 };
  if (minutes <= 40) return { warmupSec: 240, cooldownSec: 180 };
  return { warmupSec: 300, cooldownSec: 300 };
}

const restForBlocks = (n) => n <= 3 ? 30 : (n <= 6 ? 45 : 60);

// How many blocks fit in the time, and what the result actually runs to.
function planBlocks(minutes, iv) {
  const { warmupSec, cooldownSec } = bookends(minutes);
  const target = minutes * 60;
  const per = blockSeconds(iv);
  let best = null;
  for (let n = 1; n <= 14; n++) {
    const blockRestSec = restForBlocks(n);
    const total = warmupSec + cooldownSec + n * per + (n - 1) * blockRestSec;
    const miss = Math.abs(total - target);
    if (!best || miss < best.miss) best = { blocks: n, blockRestSec, total, miss, warmupSec, cooldownSec };
  }
  return best;
}

// Region -> focus, for the card colour and the filter chips.
function focusFor(regions) {
  const set = new Set(regions);
  if (set.size === 1) {
    if (set.has('core')) return 'core';
    if (set.has('legs')) return 'lower-body';
    if (set.has('push') || set.has('pull')) return 'upper-body';
  }
  if (set.size === 2 && set.has('push') && set.has('pull')) return 'upper-body';
  return 'whole-body';
}

function titleFor(regions) {
  const all = REGIONS.length;
  if (regions.length >= all - 1) return 'Full Body';
  const names = { push: 'Chest & Shoulders', pull: 'Back & Arms', core: 'Core', legs: 'Legs', cardio: 'Cardio' };
  const picked = REGIONS.map(r => r.id).filter(id => regions.includes(id)).map(id => names[id]);
  if (picked.length === 1) return picked[0];
  if (picked.length === 2) return `${picked[0]} & ${picked[1]}`;
  return `${picked.slice(0, -1).join(', ')} & ${picked[picked.length - 1]}`;
}

/*
  generateWorkout(opts)

  opts = {
    minutes,                 total session length
    people,                  1 or 2
    intervalId,              'short' | 'long'
    regions,                 array of region ids to target
    equipment,               { kb15: true, ... }
    excluded,                array of exercise ids to never use
    blockedTags,             array of EXCLUSION_TAGS ids
    seed,                    integer; same seed => same workout
    recent                   array of exercise ids used in recent sessions
  }

  Returns a workout in the same shape the timer consumes, plus `notes`
  explaining anything it had to bend. Returns { error } when the filters
  leave nothing to work with, so the UI can say why rather than showing
  an empty screen.
*/
function generateWorkout(opts) {
  const iv = INTERVALS[opts.intervalId] || INTERVALS[DEFAULT_INTERVAL];
  const rand = mulberry32(opts.seed || 1);
  const notes = [];
  const excluded = new Set(opts.excluded || []);
  const blocked = new Set(opts.blockedTags || []);
  const recent = new Set(opts.recent || []);
  const equip = opts.equipment || {};

  const hasEquip = (id) => equip[id] !== false;
  const usable = (id) => {
    const ex = EXERCISES[id];
    if (!ex) return false;
    if (excluded.has(id)) return false;
    if (ex.tags.some(t => blocked.has(t))) return false;
    // The generator already knows the kit, so it picks movements that fit
    // rather than picking blind and adapting afterwards.
    return ex.equipment.every(hasEquip);
  };

  let regions = (opts.regions && opts.regions.length)
    ? opts.regions.slice() : REGIONS.map(r => r.id);

  // Which groups can actually be filled under these constraints.
  const poolFor = (groupKey) => {
    const g = GROUPS[groupKey];
    return Object.keys(EXERCISES).filter(id =>
      usable(id) &&
      g.patterns.includes(EXERCISES[id].pattern) &&
      EXERCISES[id].regions.some(r => regions.includes(r)));
  };
  // Everything on target, whatever the movement pattern, the top-up pool
  // when a single group can't fill a block on its own.
  const regionPool = () => Object.keys(EXERCISES)
    .filter(id => usable(id) && EXERCISES[id].regions.some(r => regions.includes(r)))
    .sort((a, b) => score(a) - score(b));

  // A group needs at least two movements to make a block worth doing , 
  // a whole 4-minute block of one exercise is what "limited range" felt
  // like in the first place. Only fall back to thin groups if that would
  // otherwise leave nothing at all.
  let eligible = GROUP_ORDER.filter(k => poolFor(k).length >= 2);
  if (!eligible.length) eligible = GROUP_ORDER.filter(k => poolFor(k).length > 0);

  // Nothing left: work out which constraint did it so the message is useful.
  if (!eligible.length) {
    const anyRegion = GROUP_ORDER.some(k => {
      const g = GROUPS[k];
      return Object.keys(EXERCISES).some(id => usable(id) && g.patterns.includes(EXERCISES[id].pattern));
    });
    return {
      error: anyRegion
        ? 'No movements match those target areas with your current equipment and exclusions.'
        : 'Everything is excluded. Turn some movements or equipment back on.'
    };
  }

  // Drop target regions that contribute nothing, and say so.
  const covered = new Set(eligible.flatMap(k => poolFor(k)).flatMap(id => EXERCISES[id].regions));
  const dead = regions.filter(r => !covered.has(r));
  if (dead.length && dead.length < regions.length) {
    const labels = dead.map(r => (REGIONS.find(x => x.id === r) || {}).label || r);
    notes.push(`Nothing available for ${labels.join(' or ')}, so it was skipped.`);
    regions = regions.filter(r => covered.has(r));
    eligible = GROUP_ORDER.filter(k => poolFor(k).length >= 2);
    if (!eligible.length) eligible = GROUP_ORDER.filter(k => poolFor(k).length > 0);
  }

  const plan = planBlocks(opts.minutes, iv);
  const ctx = { rounds: iv.rounds, workSec: iv.workSec, restSec: iv.restSec, hasEquip };

  // Score: unseen beats recently-used, with seeded jitter so two runs at
  // the same settings still differ.
  const used = new Set();
  const score = (id) => (used.has(id) ? 100 : 0) + (recent.has(id) ? 10 : 0) + rand() * 5;
  const shareSingle = (a, b) => EXERCISES[a].equipment.some(e =>
    SINGLE_INSTANCE.includes(e) && EXERCISES[b].equipment.includes(e));

  // Pick up to `want` movements for one block. Two people always work on
  // neighbouring entries of a cycle, so no neighbour pair, including the
  // wrap from last back to first, may need the same single-instance item.
  // This holds even for a solo build, because the same workout can be
  // reopened later with two people selected.
  function fillFrom(out, pool, want) {
    for (const id of pool) {
      if (out.length >= want) break;
      if (out.includes(id)) continue;
      // Two entries sharing an animation are the same movement at a
      // different load; inside one block that just reads as filler.
      if (out.some(p => EXERCISES[p].img === EXERCISES[id].img)) continue;
      if (out.length && shareSingle(out[out.length - 1], id)) continue;
      out.push(id);
    }
    return out;
  }
  function pickForBlock(pool, want) {
    const out = fillFrom([], pool, want);
    // A group can be a dead end for a pair: all three ring pulls need the
    // rings, so no two of them can run at once. Rather than drop the block,
    // top up from anything else that serves the chosen areas, the target
    // area matters more to the request than the movement pattern does.
    if (out.length < 2) fillFrom(out, regionPool(), want);
    while (out.length > 2 && shareSingle(out[out.length - 1], out[0])) out.pop();
    return out;
  }

  // Pacing: open on a big compound while you're fresh, finish on a
  // conditioning burner. In between, take whichever group has the most
  // movements still unused, that keeps coverage even and stops a small
  // group (there are only six carries) from being over-represented or
  // being asked for a block it can't fill.
  const opener = eligible.includes('legsBig') ? 'legsBig'
               : (eligible.includes('push') ? 'push' : null);
  const finisher = (plan.blocks > 2 && eligible.includes('cardio')) ? 'cardio' : null;
  const jitter = new Map(eligible.map(k => [k, rand()]));
  const timesUsed = new Map(eligible.map(k => [k, 0]));
  const freshCount = (k) => poolFor(k).filter(id => !used.has(id)).length;

  // Round-robin on how often a group has been scheduled, so a big pool
  // (core has 53 movements) can't crowd out a small one. Fresh-movement
  // count only breaks ties, which is what keeps a drained group from
  // being handed a block it can't fill.
  function nextGroup(prev, i, total) {
    if (i === 0 && opener) return opener;
    if (i === total - 1 && finisher) return finisher;
    const options = eligible.filter(k => k !== prev);
    const from = options.length ? options : eligible;
    return from.slice().sort((a, b) =>
      (timesUsed.get(a) - timesUsed.get(b)) ||
      (freshCount(b) - freshCount(a)) ||
      (jitter.get(a) - jitter.get(b)))[0];
  }

  const blocks = [];
  let prevGroup = null;
  for (let i = 0; i < plan.blocks; i++) {
    const groupKey = nextGroup(prevGroup, i, plan.blocks);
    prevGroup = groupKey;
    timesUsed.set(groupKey, (timesUsed.get(groupKey) || 0) + 1);
    const group = GROUPS[groupKey];
    const pool = poolFor(groupKey).sort((a, b) => score(a) - score(b));

    // Sometimes build the block around a two-weight pair.
    const pair = WEIGHT_PAIRS.find(([h, l]) =>
      pool.includes(h) && pool.includes(l) && !used.has(h) && !used.has(l));
    if (pair && rand() < 0.3) {
      blocks.push(blockSwap(EXERCISES[pair[0]].name, pair[0], pair[1]));
      pair.forEach(id => used.add(id));
      continue;
    }

    const picked = pickForBlock(pool, 4);

    if (picked.length >= 4) {
      blocks.push(blockCycle(`${group.label} mix`, picked.slice(0, 4)));
    } else if (picked.length >= 2) {
      blocks.push(blockAlt(`${EXERCISES[picked[0]].name} & ${EXERCISES[picked[1]].name}`,
                           picked[0], picked[1]));
    } else if (picked.length === 1) {
      const only = picked[0];
      // blockSame puts both people on the same movement, so it must not
      // need anything there's only one of.
      if (EXERCISES[only].equipment.some(e => SINGLE_INSTANCE.includes(e))) {
        const partner = pool.find(id => id !== only && !shareSingle(only, id));
        if (partner) blocks.push(blockAlt(`${EXERCISES[only].name} & ${EXERCISES[partner].name}`, only, partner));
        else continue;                        // no safe block available here
      } else {
        blocks.push(blockSame(EXERCISES[only].name, only));
      }
    } else {
      continue;
    }
    blocks[blocks.length - 1].ids.forEach(id => used.add(id));
  }

  if (!blocks.length) {
    return { error: 'Not enough movements left to build a workout. Loosen the filters a little.' };
  }
  if (blocks.length < plan.blocks) {
    notes.push(`Only ${blocks.length} of ${plan.blocks} blocks could be filled from what's left.`);
  }

  // Report the length this actually runs to, not the length that was
  // asked for, blocks come in fixed 4-minute lumps, so the two rarely
  // match exactly and the label must never lie about the timer.
  const realSec = plan.warmupSec + plan.cooldownSec
                + blocks.length * blockSeconds(iv)
                + Math.max(0, blocks.length - 1) * plan.blockRestSec;
  const realMin = Math.round(realSec / 60);

  const title = titleFor(regions);
  return {
    id: `gen-${opts.seed}`,
    generated: true,
    name: `${title} · ${realMin} min`,
    tagline: iv.label.toLowerCase() === 'long efforts' ? 'Long efforts, fewer stops' : 'Sharp bursts',
    focus: focusFor(regions),
    blurb: `${blocks.length} block${blocks.length === 1 ? '' : 's'} built for ${title.toLowerCase()}, ${iv.sub}.`,
    format: 'tabata',
    intervalId: iv.id,
    warmupSec: plan.warmupSec,
    cooldownSec: plan.cooldownSec,
    blockRestSec: plan.blockRestSec,
    blocks,
    notes,
    seed: opts.seed,
    request: {
      minutes: opts.minutes, people: opts.people, intervalId: iv.id,
      regions: regions.slice(), blockedTags: (opts.blockedTags || []).slice()
    },
    // Everything this session will ask you to do, used for the preview
    // and for the recency list next time.
    exerciseIds: [...new Set(blocks.flatMap(b => b.ids))]
  };
}
