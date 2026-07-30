/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  EXERCISE DICTIONARY
  ===================
  Equipment on hand: 15kg KB, 10kg KB, 10kg barbell, dumbbells (set),
  skipping rope, gymnastic rings, gravel driveway (~1 min round trip).

  Each exercise carries:
    name       short headline shown BIG on the workout screen
    load       optional weight tag ('15kg', 'lighter pair'). Appended to the
               headline, because in a swap block both people are doing the
               same movement and the load is the only thing telling them
               which bell is theirs, it must not be buried in the cue
    cue        small coaching line under the name ('' for none)
    sideCue    true when the cue must name a halfway switch, the app
               writes "switch sides at Ns" from the live interval, so the
               text is right in both 20s and 40s modes
    alt        injury / lower-impact alternative
    equipment  ids from EQUIPMENT; [] = bodyweight, always available
    bw         exercise id to fall back to when equipment is deselected
    img        animation base name in img/exercises/<img>.svg
    regions    body regions trained, primary first (see REGIONS)
    pattern    movement pattern, used by the generator to avoid putting
               two of the same pattern back to back
    tags       constraint tags for the "don't give me these" quick filters

  Constraint the generator enforces: never assign a single-instance item
  (either KB, the barbell, the rope, the rings) to both people in the same
  round. Bodyweight fallbacks never add equipment, so adapting is safe.
*/

const EQUIPMENT = {
  kb15:      '15kg kettlebell',
  kb10:      '10kg kettlebell',
  barbell10: '10kg barbell',
  dumbbells: 'Dumbbells',
  rope:      'Skipping rope',
  rings:     'Rings'
};
const DEFAULT_EQUIPMENT = { kb15: true, kb10: true, barbell10: true, dumbbells: true, rope: true, rings: true };

// Single-instance gear: two people can't share one of these in a round.
const SINGLE_INSTANCE = ['kb15', 'kb10', 'barbell10', 'rope', 'rings'];

// Body regions, in plain-English body-part terms rather than anatomy.
const REGIONS = [
  { id: 'push',   label: 'Chest & Shoulders', short: 'Chest & Shoulders' },
  { id: 'pull',   label: 'Back & Arms',       short: 'Back & Arms' },
  { id: 'core',   label: 'Core & Abs',        short: 'Core & Abs' },
  { id: 'legs',   label: 'Legs & Glutes',     short: 'Legs & Glutes' },
  { id: 'cardio', label: 'Cardio',            short: 'Cardio' }
];

// Quick constraint filters, the usual reasons people skip a movement.
const EXCLUSION_TAGS = [
  { id: 'impact',   label: 'No jumping',   blurb: 'Skips jumps, hops and plyometrics' },
  { id: 'floor',    label: 'No floor work', blurb: 'Nothing that needs lying or kneeling down' },
  { id: 'overhead', label: 'No overhead',  blurb: 'Nothing pressed above the head' },
  { id: 'running',  label: 'No running',   blurb: 'Skips driveway sprints and shuttles' }
];

const EXERCISES = {
  // ===================================================================
  // LEGS: squat pattern
  // ===================================================================
  airSquat:        { name: 'Air squats', cue: 'Chest up, knees out', alt: 'Box squat to a chair', equipment: [], img: 'bwSquat', regions: ['legs'], pattern: 'squat', tags: [] },
  tempoSquat:      { name: 'Tempo squats', cue: 'Slow 3-second descent', alt: 'Box squat to a chair', equipment: [], img: 'bwSquat', regions: ['legs'], pattern: 'squat', tags: [] },
  squatPulse:      { name: 'Squat pulses', cue: 'Stay low, pulse the bottom half', alt: 'Shallower pulses, hands on a chair', equipment: [], img: 'squatPulse', regions: ['legs'], pattern: 'squat', tags: [] },
  sumoSquat:       { name: 'Sumo squats', cue: 'Wide stance, toes turned out', alt: 'Narrower stance, less depth', equipment: [], img: 'sumoSquat', regions: ['legs'], pattern: 'squat', tags: [] },
  squatReach:      { name: 'Squat to reach', cue: 'Stand and drive both arms overhead', alt: 'Slow squat, arms forward', equipment: [], img: 'squatReach', regions: ['legs', 'push'], pattern: 'squat', tags: [] },
  squatJump:       { name: 'Squat jumps', cue: 'Land soft, straight back down', alt: 'Explosive squat, no jump', equipment: [], img: 'jumpSquat', regions: ['legs', 'cardio'], pattern: 'squat', tags: ['impact'] },
  splitSquat:      { name: 'Split squats', cue: 'Back knee straight down', sideCue: true, alt: 'Hold a wall for balance', equipment: [], img: 'splitSquat', regions: ['legs'], pattern: 'lunge', tags: [] },
  bulgarianSplit:  { name: 'Bulgarian split squats', cue: 'Rear foot on the bench', sideCue: true, alt: 'Rear foot on the ground instead', equipment: [], img: 'bulgarianSplitSquat', regions: ['legs'], pattern: 'lunge', tags: [] },
  pistolAssisted:  { name: 'Assisted single-leg squats', cue: 'Hold the rings or a doorframe', sideCue: true, alt: 'Sit back to a bench, both feet down', equipment: [], img: 'pistolSquat', regions: ['legs'], pattern: 'squat', tags: [] },
  wallSit:         { name: 'Wall sit', cue: 'Thighs parallel, back flat', alt: 'Higher wall sit, less depth', equipment: [], img: 'wallSit', regions: ['legs'], pattern: 'squat', tags: [] },
  calfRaises:      { name: 'Calf raises', cue: 'Slow up, slower down', alt: 'Seated calf raises', equipment: [], img: 'calfRaise', regions: ['legs'], pattern: 'squat', tags: [] },
  calfRaiseSingle: { name: 'Single-leg calf raises', cue: 'Hold a wall, full range', sideCue: true, alt: 'Both feet down', equipment: [], img: 'singleLegCalfRaise', regions: ['legs'], pattern: 'squat', tags: [] },
  stepDown:        { name: 'Slow step-downs', cue: 'Lower under control, 3 seconds', sideCue: true, alt: 'Lower step, hold a wall', equipment: [], img: 'stepDown', regions: ['legs'], pattern: 'lunge', tags: [] },

  // ===================================================================
  // LEGS: lunge pattern
  // ===================================================================
  reverseLunge:    { name: 'Reverse lunges', cue: 'Alternate legs, long step back', alt: 'Static split squats', equipment: [], img: 'reverseLunge', regions: ['legs'], pattern: 'lunge', tags: [] },
  walkingLunge:    { name: 'Walking lunges', cue: 'Down the driveway and back', alt: 'Reverse lunges in place', equipment: [], img: 'walkingLunge', regions: ['legs'], pattern: 'lunge', tags: [] },
  lateralLunge:    { name: 'Lateral lunges', cue: 'Step wide, sit into that hip', alt: 'Shallow side steps', equipment: [], img: 'lateralLunge', regions: ['legs'], pattern: 'lunge', tags: [] },
  curtsyLunge:     { name: 'Curtsy lunges', cue: 'Step back and across', alt: 'Plain reverse lunges', equipment: [], img: 'curtsyLunge', regions: ['legs'], pattern: 'lunge', tags: [] },
  cossackSquat:    { name: 'Cossack squats', cue: 'Side to side, other leg straight', alt: 'Shallow lateral lunges', equipment: [], img: 'cossackSquat', regions: ['legs'], pattern: 'lunge', tags: [] },
  jumpLunge:       { name: 'Jumping split lunges', cue: 'Swap legs in the air', alt: 'Step-through lunges, no jump', equipment: [], img: 'jumpLunge', regions: ['legs', 'cardio'], pattern: 'lunge', tags: ['impact'] },
  stepUp:          { name: 'Step-ups', cue: 'Drive through the top leg', sideCue: true, alt: 'Toe taps to a low step', equipment: [], img: 'stepUp', regions: ['legs'], pattern: 'lunge', tags: [] },
  stepUpJump:      { name: 'Jumping step-ups', cue: 'Explode off the box, land soft', alt: 'Plain step-ups', equipment: [], img: 'stepUpJump', regions: ['legs', 'cardio'], pattern: 'lunge', tags: ['impact'] },
  boxJump:         { name: 'Box jumps', cue: 'Jump up, step down', alt: 'Step-ups instead', equipment: [], img: 'boxJump', regions: ['legs', 'cardio'], pattern: 'squat', tags: ['impact'] },

  // ===================================================================
  // LEGS / POSTERIOR: hinge pattern
  // ===================================================================
  goodMorning:     { name: 'Good mornings', cue: 'Hands behind head, hinge at the hip', alt: 'Hip hinge with hands on thighs', equipment: [], img: 'goodMorning', regions: ['legs', 'pull'], pattern: 'hinge', tags: [] },
  singleLegRdl:    { name: 'Single-leg deadlifts', cue: 'Reach for the floor, hips level', sideCue: true, alt: 'Hold a wall, both feet down', equipment: [], img: 'singleLegRdl', regions: ['legs'], pattern: 'hinge', tags: [] },
  gluteBridge:     { name: 'Glute bridges', cue: 'Squeeze hard at the top', alt: 'Glute bridge hold', equipment: [], img: 'gluteBridge', regions: ['legs'], pattern: 'hinge', tags: ['floor'] },
  singleLegBridge: { name: 'Single-leg glute bridges', cue: 'One foot down, one leg out', sideCue: true, alt: 'Glute bridges, both legs', equipment: [], img: 'singleLegBridge', regions: ['legs'], pattern: 'hinge', tags: ['floor'] },
  hipThrust:       { name: 'Shoulder-elevated hip thrusts', cue: 'Shoulders on the bench, drive up', alt: 'Glute bridges on the floor', equipment: [], img: 'hipThrust', regions: ['legs'], pattern: 'hinge', tags: [] },
  frogPump:        { name: 'Frog pumps', cue: 'Heels together, knees wide', alt: 'Glute bridges, feet flat', equipment: [], img: 'frogPump', regions: ['legs'], pattern: 'hinge', tags: ['floor'] },
  gluteKickback:   { name: 'Quadruped kickbacks', cue: 'Drive the heel to the ceiling', sideCue: true, alt: 'Standing kickbacks, hold a wall', equipment: [], img: 'gluteKickback', regions: ['legs'], pattern: 'hinge', tags: ['floor'] },
  fireHydrant:     { name: 'Fire hydrants', cue: 'Knee out to the side, hips square', sideCue: true, alt: 'Standing hip abduction at a wall', equipment: [], img: 'fireHydrant', regions: ['legs'], pattern: 'hinge', tags: ['floor'] },

  // ===================================================================
  // PUSH: horizontal
  // ===================================================================
  pushup:          { name: 'Push-ups', cue: 'Elbows back, body in one line', alt: 'Incline push-ups (hands on bench)', equipment: [], img: 'pushup', regions: ['push', 'core'], pattern: 'pushH', tags: ['floor'] },
  widePushup:      { name: 'Wide push-ups', cue: 'Hands out wide, chest leads', alt: 'Wide incline push-ups', equipment: [], img: 'widePushup', regions: ['push'], pattern: 'pushH', tags: ['floor'] },
  diamondPushup:   { name: 'Diamond push-ups', cue: 'Hands together under the chest', alt: 'Close-grip incline push-ups', equipment: [], img: 'diamondPushup', regions: ['push'], pattern: 'pushH', tags: ['floor'] },
  declinePushup:   { name: 'Decline push-ups', cue: 'Feet up on the bench', alt: 'Flat push-ups', equipment: [], img: 'declinePushup', regions: ['push'], pattern: 'pushH', tags: ['floor'] },
  inclinePushup:   { name: 'Incline push-ups', cue: 'Hands on the bench', alt: 'Hands higher still', equipment: [], img: 'inclinePushup', regions: ['push'], pattern: 'pushH', tags: [] },
  tempoPushup:     { name: 'Tempo push-ups', cue: 'Three seconds down, one up', alt: 'Tempo incline push-ups', equipment: [], img: 'tempoPushup', regions: ['push'], pattern: 'pushH', tags: ['floor'] },
  clapPushup:      { name: 'Explosive push-ups', cue: 'Push hard, hands leave the floor', alt: 'Regular push-ups', equipment: [], img: 'clapPushup', regions: ['push', 'cardio'], pattern: 'pushH', tags: ['floor', 'impact'] },

  // ===================================================================
  // PUSH: vertical / triceps
  // ===================================================================
  pikePushup:      { name: 'Pike push-ups', cue: 'Hips high, crown to the floor', alt: 'Incline pike push-ups', equipment: [], img: 'pikePushup', regions: ['push'], pattern: 'pushV', tags: ['floor', 'overhead'] },
  elevatedPike:    { name: 'Elevated pike push-ups', cue: 'Feet on the bench, stack the shoulders', alt: 'Pike push-ups on the floor', equipment: [], img: 'elevatedPikePushup', regions: ['push'], pattern: 'pushV', tags: ['floor', 'overhead'] },
  wallHandstand:   { name: 'Wall handstand hold', cue: 'Walk the feet up, squeeze everything', alt: 'Pike hold with feet on a bench', equipment: [], img: 'wallHandstand', regions: ['push', 'core'], pattern: 'pushV', tags: ['overhead'] },
  wallWalk:        { name: 'Wall walks', cue: 'Walk the hands in, then back out', alt: 'Pike push-ups', equipment: [], img: 'wallWalk', regions: ['push', 'core'], pattern: 'pushV', tags: ['floor', 'overhead'] },
  tricepDips:      { name: 'Tricep dips', cue: 'On a bench, elbows straight back', alt: 'Bench dips with feet closer in', equipment: [], img: 'benchDips', regions: ['push'], pattern: 'pushV', tags: [] },

  // ===================================================================
  // PULL: bodyweight
  // ===================================================================
  supermanPull:    { name: 'Superman pulls', cue: 'Sweep the arms back like a pulldown', alt: 'Superman hold', equipment: [], img: 'superman', regions: ['pull'], pattern: 'pullV', tags: ['floor'] },
  supermanHold:    { name: 'Superman hold', cue: 'Chest and thighs off the floor, pulse', alt: 'Superman hold, no pulses', equipment: [], img: 'superman', regions: ['pull', 'core'], pattern: 'pullV', tags: ['floor'] },
  supermanYtw:     { name: 'Prone Y-T-Ws', cue: 'Arms to a Y, then a T, then a W', alt: 'Smaller range, thumbs up', equipment: [], img: 'supermanYtw', regions: ['pull'], pattern: 'pullH', tags: ['floor'] },

  // ===================================================================
  // CORE: anti-extension / holds
  // ===================================================================
  plankHold:       { name: 'Plank hold', cue: 'Forearm or high, squeeze the ribs down', alt: 'Knees plank', equipment: [], img: 'plank', regions: ['core'], pattern: 'coreAnti', tags: ['floor'] },
  plankForearm:    { name: 'Forearm plank', cue: 'Elbows under the shoulders', alt: 'Knees plank', equipment: [], img: 'plank', regions: ['core'], pattern: 'coreAnti', tags: ['floor'] },
  plankRotation:   { name: 'Plank rotations', cue: 'Forearm, high, side-left, side-right', rotateCue: 4, alt: 'Knees plank, same rotation', equipment: [], img: 'plank', regions: ['core'], pattern: 'coreAnti', tags: ['floor'] },
  plankShoulderTaps: { name: 'Plank shoulder taps', cue: 'Hips still, tap alternate shoulders', alt: 'Knees plank shoulder taps', equipment: [], img: 'plankShoulderTaps', regions: ['core'], pattern: 'coreAnti', tags: ['floor'] },
  plankReach:      { name: 'Plank reach-outs', cue: 'Reach one arm forward, hips level', alt: 'Knees plank reach-outs', equipment: [], img: 'plankReach', regions: ['core'], pattern: 'coreAnti', tags: ['floor'] },
  plankUpDown:     { name: 'Plank up-downs', cue: 'Forearms to hands and back', alt: 'From the knees', equipment: [], img: 'plankUpDown', regions: ['core', 'push'], pattern: 'coreAnti', tags: ['floor'] },
  plankJack:       { name: 'Plank jacks', cue: 'Jump the feet wide and back', alt: 'Step the feet wide instead', equipment: [], img: 'plankJack', regions: ['core', 'cardio'], pattern: 'coreAnti', tags: ['floor', 'impact'] },
  bearHold:        { name: 'Bear hold', cue: 'Knees hovering an inch off the floor', alt: 'Knees down, hold the flat back', equipment: [], img: 'bearHold', regions: ['core'], pattern: 'coreAnti', tags: ['floor'] },
  hollowHold:      { name: 'Hollow body hold', cue: 'Low back pressed flat', alt: 'Tucked hollow hold (knees in)', equipment: [], img: 'hollow', regions: ['core'], pattern: 'coreAnti', tags: ['floor'] },
  hollowRocks:     { name: 'Hollow body rocks', cue: 'Rock from the shoulders, stay rigid', alt: 'Hollow hold, no rocking', equipment: [], img: 'hollow', regions: ['core'], pattern: 'coreAnti', tags: ['floor'] },
  deadBug:         { name: 'Dead bugs', cue: 'Opposite arm and leg, ribs down', alt: 'One limb at a time', equipment: [], img: 'deadBug', regions: ['core'], pattern: 'coreAnti', tags: ['floor'] },
  birdDog:         { name: 'Bird dogs', cue: 'Opposite arm and leg, no wobble', alt: 'One limb at a time', equipment: [], img: 'birdDog', regions: ['core'], pattern: 'coreAnti', tags: ['floor'] },

  // ===================================================================
  // CORE: flexion
  // ===================================================================
  vSit:            { name: 'V-sits', cue: 'Fold, hands towards the toes', alt: 'Tucked V-sit (knees bent)', equipment: [], img: 'vSit', regions: ['core'], pattern: 'coreFlex', tags: ['floor'] },
  vUp:             { name: 'V-ups', cue: 'Arms and legs meet over the hips', alt: 'Alternating single-leg V-ups', equipment: [], img: 'vUp', regions: ['core'], pattern: 'coreFlex', tags: ['floor'] },
  tuckUp:          { name: 'Tuck-ups', cue: 'Knees to chest, sit tall', alt: 'Seated knee tucks', equipment: [], img: 'tuckUp', regions: ['core'], pattern: 'coreFlex', tags: ['floor'] },
  crunch:          { name: 'Crunches', cue: 'Ribs to hips, chin off the chest', alt: 'Smaller range, hands on thighs', equipment: [], img: 'crunch', regions: ['core'], pattern: 'coreFlex', tags: ['floor'] },
  reverseCrunch:   { name: 'Reverse crunches', cue: 'Curl the hips off the floor', alt: 'Knees-to-chest tucks', equipment: [], img: 'reverseCrunch', regions: ['core'], pattern: 'coreFlex', tags: ['floor'] },
  legRaises:       { name: 'Lying leg raises', cue: 'Lower slowly, keep the back flat', alt: 'Bent-knee leg raises', equipment: [], img: 'legRaise', regions: ['core'], pattern: 'coreFlex', tags: ['floor'] },
  flutterKicks:    { name: 'Flutter kicks', cue: 'Small fast kicks, legs low', alt: 'Bent-knee flutter kicks', equipment: [], img: 'flutterKicks', regions: ['core'], pattern: 'coreFlex', tags: ['floor'] },
  bicycleCrunch:   { name: 'Bicycle crunches', cue: 'Elbow towards the opposite knee', alt: 'Slow bicycles, heels tapping down', equipment: [], img: 'bicycleCrunch', regions: ['core'], pattern: 'coreRot', tags: ['floor'] },

  // ===================================================================
  // CORE: rotation & lateral
  // ===================================================================
  russianTwistBw:  { name: 'Russian twists', cue: 'Rotate from the ribs, heels light', alt: 'Seated slow torso twists', equipment: [], img: 'russianTwist', regions: ['core'], pattern: 'coreRot', tags: ['floor'] },
  sidePlankHold:   { name: 'Side plank hold', cue: 'Stack the shoulders, hips high', sideCue: true, alt: 'Side plank from the knees', equipment: [], img: 'sidePlankHold', regions: ['core'], pattern: 'coreLat', tags: ['floor'] },
  sidePlankDips:   { name: 'Side plank hip dips', cue: 'Dip and drive the hip up', sideCue: true, alt: 'Side plank hold from the knees', equipment: [], img: 'sideBridge', regions: ['core'], pattern: 'coreLat', tags: ['floor'] },
  sidePlankThread: { name: 'Side plank thread-throughs', cue: 'Reach the top arm under the ribs', sideCue: true, alt: 'Side plank hold from the knees', equipment: [], img: 'sidePlankThread', regions: ['core'], pattern: 'coreRot', tags: ['floor'] },
  crabWalk:        { name: 'Crab walks', cue: 'Hips high, travel forward and back', alt: 'Crab hold in place', equipment: [], img: 'crabWalk', regions: ['core', 'push'], pattern: 'crawl', tags: ['floor'] },
  crabReach:       { name: 'Crab toe reaches', cue: 'Kick up and touch the opposite toe', alt: 'Crab hip lifts, no reach', equipment: [], img: 'crabReach', regions: ['core'], pattern: 'coreRot', tags: ['floor'] },

  // ===================================================================
  // CRAWLS & CONDITIONING: bodyweight
  // ===================================================================
  burpee:          { name: 'Burpees', cue: 'Chest to floor, jump at the top', alt: 'Step-back burpees (no jump)', equipment: [], img: 'burpee', regions: ['cardio', 'push'], pattern: 'cardio', tags: ['floor', 'impact'] },
  burpeeBroadJump: { name: 'Burpee broad jumps', cue: 'Burpee, then jump forward', alt: 'Step-back burpee, step forward', equipment: [], img: 'burpeeBroadJump', regions: ['cardio', 'legs'], pattern: 'cardio', tags: ['floor', 'impact'] },
  squatThrust:     { name: 'Squat thrusts', cue: 'Hands down, feet back and in, no push-up', alt: 'Step the feet back and in', equipment: [], img: 'squatThrust', regions: ['cardio', 'core'], pattern: 'cardio', tags: ['floor'] },
  jumpingJacks:    { name: 'Jumping jacks', cue: 'Arms all the way overhead', alt: 'Step jacks (no jump)', equipment: [], img: 'jumpingJacks', regions: ['cardio'], pattern: 'cardio', tags: ['impact'] },
  sealJack:        { name: 'Seal jacks', cue: 'Arms clap out front, not overhead', alt: 'Step out, arms front', equipment: [], img: 'sealJack', regions: ['cardio'], pattern: 'cardio', tags: ['impact'] },
  jackSquat:       { name: 'Jack squats', cue: 'Jack out, then a squat', alt: 'Step jack into a squat', equipment: [], img: 'jackSquat', regions: ['cardio', 'legs'], pattern: 'cardio', tags: ['impact'] },
  highKnees:       { name: 'High knees', cue: 'Knees to hip height, fast feet', alt: 'Marching in place', equipment: [], img: 'highKnees', regions: ['cardio'], pattern: 'cardio', tags: ['impact'] },
  buttKicks:       { name: 'Butt kicks', cue: 'Heels to the backside, quick', alt: 'Walking heel flicks', equipment: [], img: 'buttKicks', regions: ['cardio'], pattern: 'cardio', tags: ['impact'] },
  skaterHops:      { name: 'Skater hops', cue: 'Bound side to side, land soft', alt: 'Side steps with a reach', equipment: [], img: 'skaterHops', regions: ['cardio', 'legs'], pattern: 'cardio', tags: ['impact'] },
  skiJump:         { name: 'Ski jumps', cue: 'Feet together, hop side to side', alt: 'Side taps, no hop', equipment: [], img: 'skiJump', regions: ['cardio'], pattern: 'cardio', tags: ['impact'] },
  tuckJump:        { name: 'Tuck jumps', cue: 'Knees to chest, land soft', alt: 'Squat jumps instead', equipment: [], img: 'tuckJump', regions: ['cardio', 'legs'], pattern: 'cardio', tags: ['impact'] },
  broadJump:       { name: 'Broad jumps', cue: 'Jump forward, walk back', alt: 'Long steps, no jump', equipment: [], img: 'broadJump', regions: ['cardio', 'legs'], pattern: 'cardio', tags: ['impact'] },
  lateralShuffle:  { name: 'Lateral shuffles', cue: 'Stay low, quick feet across', alt: 'Slow side steps, stay tall', equipment: [], img: 'lateralShuffle', regions: ['cardio', 'legs'], pattern: 'cardio', tags: ['impact'] },
  mountainClimber:     { name: 'Mountain climbers', cue: 'Hips low, drive the knees in', alt: 'Slow controlled climbers', equipment: [], img: 'mountainClimber', regions: ['core', 'cardio'], pattern: 'cardio', tags: ['floor'] },
  mountainClimberFast: { name: 'Mountain climbers, fast', cue: 'As quick as you can hold form', alt: 'Slow controlled climbers', equipment: [], img: 'mountainClimber', regions: ['core', 'cardio'], pattern: 'cardio', tags: ['floor'] },
  mountainClimberCross: { name: 'Cross-body climbers', cue: 'Knee towards the opposite elbow', alt: 'Slow cross-body climbers', equipment: [], img: 'mountainClimberCross', regions: ['core', 'cardio'], pattern: 'cardio', tags: ['floor'] },
  bearCrawl:       { name: 'Bear crawls', cue: 'Forward and back, hips low', alt: 'Bear hold (knees hovering)', equipment: [], img: 'bearCrawl', regions: ['core', 'push'], pattern: 'crawl', tags: ['floor'] },
  bearCrawlLateral:{ name: 'Lateral bear crawls', cue: 'Sideways, knees off the floor', alt: 'Bear hold with a shoulder tap', equipment: [], img: 'bearCrawlLateral', regions: ['core', 'push'], pattern: 'crawl', tags: ['floor'] },
  inchworm:        { name: 'Inchworm walkouts', cue: 'Walk the hands out to a plank', alt: 'Walkouts, knees down on the return', equipment: [], img: 'inchworm', regions: ['core'], pattern: 'crawl', tags: ['floor'] },
  inchwormPushup:  { name: 'Inchworm push-ups', cue: 'Walk out, one push-up, walk back', alt: 'Walkouts with no push-up', equipment: [], img: 'inchwormPushup', regions: ['push', 'core'], pattern: 'crawl', tags: ['floor'] },
  sprint:          { name: 'Driveway sprint', cue: 'To the mailbox and back', alt: 'Brisk walk to the mailbox & back', equipment: [], img: 'sprint', regions: ['cardio'], pattern: 'cardio', tags: ['impact', 'running'] },
  shuttleRun:      { name: 'Shuttle runs', cue: 'Out, touch, back, then repeat', alt: 'Walking shuttles', equipment: [], img: 'shuttleRun', regions: ['cardio'], pattern: 'cardio', tags: ['impact', 'running'] },

  // ===================================================================
  // KETTLEBELLS
  // ===================================================================
  gobletSquat15:  { name: 'Goblet squats', load: '15kg', cue: 'Bell at the chest', alt: 'Bodyweight squat, slow 3s descent', equipment: ['kb15'], bw: 'tempoSquat', img: 'gobletSquat', regions: ['legs'], pattern: 'squat', tags: [] },
  gobletSquat10:  { name: 'Goblet squats', load: '10kg', cue: 'Bell at the chest', alt: 'Bodyweight squat, slow 3s descent', equipment: ['kb10'], bw: 'tempoSquat', img: 'gobletSquat', regions: ['legs'], pattern: 'squat', tags: [] },
  kbFrontSquat15: { name: 'KB front squat', load: '15kg', cue: 'In the front rack', alt: 'Goblet squat instead', equipment: ['kb15'], bw: 'tempoSquat', img: 'kbFrontSquat', regions: ['legs'], pattern: 'squat', tags: [] },
  kbSwing15:      { name: 'KB swings', load: '15kg', cue: 'Snap the hips, float the bell', alt: 'KB Romanian deadlift (hinge only)', equipment: ['kb15'], bw: 'goodMorning', img: 'kbSwing', regions: ['legs', 'cardio'], pattern: 'hinge', tags: [] },
  kbSwing10:      { name: 'KB swings', load: '10kg', cue: 'Snap the hips, float the bell', alt: 'KB Romanian deadlift (hinge only)', equipment: ['kb10'], bw: 'goodMorning', img: 'kbSwing', regions: ['legs', 'cardio'], pattern: 'hinge', tags: [] },
  kbSwingSingle15:{ name: 'Single-arm KB swings', load: '15kg', cue: 'Resist the twist', sideCue: true, alt: 'Two-handed swings', equipment: ['kb15'], bw: 'goodMorning', img: 'kbSwingSingle', regions: ['legs', 'core'], pattern: 'hinge', tags: [] },
  kbDeadlift15:   { name: 'KB deadlifts', load: '15kg', cue: 'Between the feet, flat back', alt: 'KB Romanian deadlift, lighter', equipment: ['kb15'], bw: 'goodMorning', img: 'kbDeadlift', regions: ['legs', 'pull'], pattern: 'hinge', tags: [] },
  kbSumoDeadlift15: { name: 'KB sumo deadlifts', load: '15kg', cue: 'Wide stance, drive the floor away', alt: 'Bodyweight good mornings', equipment: ['kb15'], bw: 'goodMorning', img: 'kbSumoDeadlift', regions: ['legs'], pattern: 'hinge', tags: [] },
  kbSingleLegRdl10: { name: 'KB single-leg deadlifts', load: '10kg', cue: 'Hips level, slow', sideCue: true, alt: 'Bodyweight single-leg deadlift', equipment: ['kb10'], bw: 'singleLegRdl', img: 'kbSingleLegRdl', regions: ['legs'], pattern: 'hinge', tags: [] },
  kbHighPull15:   { name: 'KB high pulls', load: '15kg', cue: 'Elbow high, bell to the chest', alt: 'KB swings', equipment: ['kb15'], bw: 'goodMorning', img: 'kbHighPull', regions: ['pull', 'legs'], pattern: 'pullV', tags: [] },
  kbSnatch10:     { name: 'KB snatches', load: '10kg', cue: 'One pull to overhead', sideCue: true, alt: 'KB high pulls', equipment: ['kb10'], bw: 'squatReach', img: 'kbSnatch', regions: ['push', 'legs'], pattern: 'hinge', tags: ['overhead'] },
  kbRackHold15:   { name: 'KB front rack hold', load: '15kg', cue: 'Stay tall, breathe', alt: 'Dumbbell suitcase hold', equipment: ['kb15'], bw: 'wallSit', img: 'kbRackHold', regions: ['core'], pattern: 'carry', tags: [] },
  kbSuitcaseHold15: { name: 'KB suitcase hold', load: '15kg', cue: 'One side only, do not lean', sideCue: true, alt: 'Lighter bell, shorter hold', equipment: ['kb15'], bw: 'sidePlankHold', img: 'kbSuitcaseHold', regions: ['core'], pattern: 'carry', tags: [] },
  kbFarmersWalk15:{ name: 'KB farmer carry', load: '15kg', cue: 'One side, down the driveway', sideCue: true, alt: 'Suitcase hold in place', equipment: ['kb15'], bw: 'bearCrawl', img: 'kbFarmersWalk', regions: ['core', 'pull'], pattern: 'carry', tags: [] },
  kbCleanPress15: { name: 'KB clean & press', load: '15kg', cue: 'One motion, floor to overhead', alt: 'Dumbbell clean & press (lighter)', equipment: ['kb15'], bw: 'squatReach', img: 'kbCleanPress', regions: ['push', 'legs'], pattern: 'pushV', tags: ['overhead'] },
  kbCleanPress10: { name: 'KB clean & press', load: '10kg', cue: 'One motion, floor to overhead', alt: 'Dumbbell clean & press (lighter)', equipment: ['kb10'], bw: 'squatReach', img: 'kbCleanPress', regions: ['push', 'legs'], pattern: 'pushV', tags: ['overhead'] },
  kbPress10:      { name: 'Single-arm KB press', load: '10kg', cue: 'Ribs down, press tall', sideCue: true, alt: 'Dumbbell shoulder press', equipment: ['kb10'], bw: 'pikePushup', img: 'kbPressSingle', regions: ['push'], pattern: 'pushV', tags: ['overhead'] },
  kbThruster10:   { name: 'KB thrusters', load: '10kg', cue: 'Squat then drive overhead', alt: 'Goblet squat, no press', equipment: ['kb10'], bw: 'squatReach', img: 'kbThruster', regions: ['legs', 'push'], pattern: 'squat', tags: ['overhead'] },
  kbRow15:        { name: 'KB bent-over rows', load: '15kg', cue: 'Elbow to the hip', sideCue: true, alt: 'Bent-over dumbbell rows', equipment: ['kb15'], bw: 'supermanPull', img: 'kbRow', regions: ['pull'], pattern: 'pullH', tags: [] },
  kbHalo10:       { name: 'KB halos', load: '10kg', cue: 'Circle the head, ribs locked', alt: 'Slow arm circles, no weight', equipment: ['kb10'], bw: 'plankShoulderTaps', img: 'kbHalo', regions: ['push', 'core'], pattern: 'pushV', tags: ['overhead'] },
  kbWindmill10:   { name: 'KB windmills', load: '10kg', cue: 'Locked overhead, hinge sideways', sideCue: true, alt: 'Bodyweight side bends', equipment: ['kb10'], bw: 'sidePlankHold', img: 'kbWindmill', regions: ['core'], pattern: 'coreLat', tags: ['overhead'] },
  halfGetup10:    { name: 'Half Turkish get-ups', load: '10kg', cue: 'Floor to elbow to hand', sideCue: true, alt: 'Dead bugs, no weight', equipment: ['kb10'], bw: 'deadBug', img: 'halfGetup', regions: ['core'], pattern: 'coreAnti', tags: ['floor', 'overhead'] },
  russianTwistKb: { name: 'Russian twists', load: '10kg', cue: 'Bell across the body', alt: 'Russian twists, bodyweight', equipment: ['kb10'], bw: 'russianTwistBw', img: 'russianTwist', regions: ['core'], pattern: 'coreRot', tags: ['floor'] },

  // ===================================================================
  // BARBELL (10kg)
  // ===================================================================
  barbellPress:   { name: 'Strict press', load: '10kg bar', cue: 'Ribs down', alt: 'Dumbbell shoulder press', equipment: ['barbell10'], bw: 'pikePushup', img: 'barbellPress', regions: ['push'], pattern: 'pushV', tags: ['overhead'] },
  barbellRow:     { name: 'Bent-over rows', load: '10kg bar', cue: 'Pull to the belly button', alt: 'Bent-over dumbbell rows', equipment: ['barbell10'], bw: 'supermanPull', img: 'barbellRow', regions: ['pull'], pattern: 'pullH', tags: [] },
  barbellCurl:    { name: 'Barbell curls', load: '10kg bar', cue: 'Elbows pinned', alt: 'Dumbbell curls', equipment: ['barbell10'], bw: 'supermanPull', img: 'barbellCurl', regions: ['pull'], pattern: 'pullH', tags: [] },
  barbellRdl:     { name: 'Romanian deadlifts', load: '10kg bar', cue: 'Hinge to mid-shin', alt: 'Good mornings, bodyweight', equipment: ['barbell10'], bw: 'goodMorning', img: 'barbellRdl', regions: ['legs', 'pull'], pattern: 'hinge', tags: [] },
  barbellGoodMorning: { name: 'Barbell good mornings', load: '10kg bar', cue: 'On the back, soft knees', alt: 'Bodyweight good mornings', equipment: ['barbell10'], bw: 'goodMorning', img: 'barbellGoodMorning', regions: ['legs', 'pull'], pattern: 'hinge', tags: [] },
  barbellThruster:{ name: 'Barbell thrusters', load: '10kg bar', cue: 'Front squat into a press', alt: 'Bodyweight squat to reach', equipment: ['barbell10'], bw: 'squatReach', img: 'barbellThruster', regions: ['legs', 'push'], pattern: 'squat', tags: ['overhead'] },
  barbellFloorPress: { name: 'Barbell floor press', load: '10kg bar', cue: 'Pause when the elbows land', alt: 'Push-ups', equipment: ['barbell10'], bw: 'pushup', img: 'barbellFloorPress', regions: ['push'], pattern: 'pushH', tags: ['floor'] },

  // ===================================================================
  // DUMBBELLS
  // ===================================================================
  dbPressHeavy:   { name: 'Dumbbell shoulder press', load: 'heavier pair', cue: 'Press tall, ribs down', alt: 'Slow tempo, lighter weight', equipment: ['dumbbells'], bw: 'pikePushup', img: 'dbPress', regions: ['push'], pattern: 'pushV', tags: ['overhead'] },
  dbPressLight:   { name: 'Dumbbell shoulder press', load: 'lighter pair', cue: 'Press tall, ribs down', alt: 'Slow tempo, lighter weight', equipment: ['dumbbells'], bw: 'pikePushup', img: 'dbPress', regions: ['push'], pattern: 'pushV', tags: ['overhead'] },
  dbArnoldPress:  { name: 'Arnold press', cue: 'Rotate the palms as you press', alt: 'Plain dumbbell press', equipment: ['dumbbells'], bw: 'pikePushup', img: 'dbArnoldPress', regions: ['push'], pattern: 'pushV', tags: ['overhead'] },
  dbPushPress:    { name: 'Dumbbell push press', cue: 'Dip the knees, drive overhead', alt: 'Strict dumbbell press', equipment: ['dumbbells'], bw: 'squatReach', img: 'dbPushPress', regions: ['push', 'legs'], pattern: 'pushV', tags: ['overhead'] },
  dbFrontRaise:   { name: 'Front raises', cue: 'To eye height, no swinging', alt: 'Lighter pair, slower', equipment: ['dumbbells'], bw: 'plankShoulderTaps', img: 'dbFrontRaise', regions: ['push'], pattern: 'pushV', tags: [] },
  dbLateralRaise: { name: 'Lateral raises', cue: 'Elbows lead, stop at shoulder height', alt: 'Lighter pair, slow tempo', equipment: ['dumbbells'], bw: 'plankShoulderTaps', img: 'lateralRaise', regions: ['push'], pattern: 'pushV', tags: [] },
  dbFloorPress:   { name: 'Dumbbell floor press', cue: 'Pause when the elbows touch down', alt: 'Push-ups', equipment: ['dumbbells'], bw: 'pushup', img: 'dbFloorPress', regions: ['push'], pattern: 'pushH', tags: ['floor'] },
  dbSkullcrusher: { name: 'Skull crushers', cue: 'Elbows still, lower to the forehead', alt: 'Bench dips', equipment: ['dumbbells'], bw: 'tricepDips', img: 'dbSkullcrusher', regions: ['push'], pattern: 'pushV', tags: ['floor'] },
  dbOverheadTricep: { name: 'Overhead tricep extensions', cue: 'One dumbbell, elbows by the ears', alt: 'Bench dips', equipment: ['dumbbells'], bw: 'tricepDips', img: 'dbOverheadTricep', regions: ['push'], pattern: 'pushV', tags: ['overhead'] },
  dbRow:          { name: 'Bent-over rows', cue: 'Both dumbbells, squeeze the blades', alt: 'Rows with lighter dumbbells', equipment: ['dumbbells'], bw: 'supermanPull', img: 'dbRow', regions: ['pull'], pattern: 'pullH', tags: [] },
  dbRowSingle:    { name: 'Single-arm rows', cue: 'Hand on the bench, long pull', sideCue: true, alt: 'Two-arm bent-over rows', equipment: ['dumbbells'], bw: 'supermanPull', img: 'dbRowSingle', regions: ['pull'], pattern: 'pullH', tags: [] },
  dbRearDeltFly:  { name: 'Rear delt flies', cue: 'Bent over, arms out wide', alt: 'Lighter pair, slower', equipment: ['dumbbells'], bw: 'supermanYtw', img: 'dbRearDeltFly', regions: ['pull'], pattern: 'pullH', tags: [] },
  dbUprightRow:   { name: 'Upright rows', cue: 'Elbows lead to shoulder height', alt: 'Dumbbell shrugs', equipment: ['dumbbells'], bw: 'supermanPull', img: 'dbUprightRow', regions: ['pull'], pattern: 'pullV', tags: [] },
  dbShrug:        { name: 'Dumbbell shrugs', cue: 'Straight up, hold a beat', alt: 'Slow neck and shoulder rolls', equipment: ['dumbbells'], bw: 'supermanPull', img: 'dbShrug', regions: ['pull'], pattern: 'pullV', tags: [] },
  dbCurl:         { name: 'Bicep curls', cue: 'Elbows pinned to the ribs', alt: 'Hammer curls, slower tempo', equipment: ['dumbbells'], bw: 'supermanPull', img: 'dbCurl', regions: ['pull'], pattern: 'pullH', tags: [] },
  dbHammerCurl:   { name: 'Hammer curls', cue: 'Palms facing in the whole way', alt: 'Lighter pair, slower', equipment: ['dumbbells'], bw: 'supermanPull', img: 'dbHammerCurl', regions: ['pull'], pattern: 'pullH', tags: [] },
  dbSquat:        { name: 'Dumbbell squats', cue: 'A dumbbell in each hand, chest up', alt: 'Bodyweight squats', equipment: ['dumbbells'], bw: 'airSquat', img: 'dbSquat', regions: ['legs'], pattern: 'squat', tags: [] },
  dbLunge:        { name: 'Reverse lunges', cue: 'A dumbbell in each hand', alt: 'Bodyweight reverse lunges', equipment: ['dumbbells'], bw: 'reverseLunge', img: 'reverseLunge', regions: ['legs'], pattern: 'lunge', tags: [] },
  dbSplitSquat:   { name: 'Loaded split squats', cue: 'Dumbbells at the sides', sideCue: true, alt: 'Bodyweight split squats', equipment: ['dumbbells'], bw: 'splitSquat', img: 'dbSplitSquat', regions: ['legs'], pattern: 'lunge', tags: [] },
  dbOverheadLunge:{ name: 'Overhead lunges', cue: 'One dumbbell locked overhead', sideCue: true, alt: 'Bodyweight reverse lunges', equipment: ['dumbbells'], bw: 'reverseLunge', img: 'overheadLunge', regions: ['legs', 'core'], pattern: 'lunge', tags: ['overhead'] },
  dbRdl:          { name: 'Romanian deadlifts', cue: 'Dumbbells down the shins', alt: 'Bodyweight good mornings', equipment: ['dumbbells'], bw: 'goodMorning', img: 'dbRdl', regions: ['legs', 'pull'], pattern: 'hinge', tags: [] },
  renegadeRow:    { name: 'Renegade rows', cue: 'Plank on the dumbbells, row one side', alt: 'Renegade rows from the knees', equipment: ['dumbbells'], bw: 'plankShoulderTaps', img: 'renegadeRow', regions: ['pull', 'core'], pattern: 'pullH', tags: ['floor'] },
  dbWoodchop:     { name: 'Woodchops', cue: 'One dumbbell, hip to opposite shoulder', sideCue: true, alt: 'Bodyweight torso rotations', equipment: ['dumbbells'], bw: 'russianTwistBw', img: 'dbWoodchop', regions: ['core'], pattern: 'coreRot', tags: [] },
  dbSuitcaseCarry:{ name: 'Suitcase carry', cue: 'One dumbbell, down the driveway', sideCue: true, alt: 'Suitcase hold in place', equipment: ['dumbbells'], bw: 'bearCrawl', img: 'farmersWalk', regions: ['core'], pattern: 'carry', tags: [] },
  dbFarmersWalk:  { name: "Farmer's walk", cue: 'Both dumbbells, tall and steady', alt: 'Shorter walk, lighter pair', equipment: ['dumbbells'], bw: 'bearCrawl', img: 'dbFarmersWalk', regions: ['pull', 'core'], pattern: 'carry', tags: [] },
  dbOverheadCarry:{ name: 'Overhead carry', cue: 'Both locked out, walk tall', alt: 'Front rack carry instead', equipment: ['dumbbells'], bw: 'bearCrawl', img: 'dbOverheadCarry', regions: ['push', 'core'], pattern: 'carry', tags: ['overhead'] },

  // ===================================================================
  // ROPE
  // ===================================================================
  skipping:       { name: 'Skipping', cue: 'Light on the toes, wrists do the work', alt: 'High knees in place', equipment: ['rope'], bw: 'highKnees', img: 'ropeJumping', regions: ['cardio'], pattern: 'cardio', tags: ['impact'] },
  doubleUnder:    { name: 'Double unders', cue: 'Two rope passes per jump', alt: 'Single skips, fast', equipment: ['rope'], bw: 'highKnees', img: 'doubleUnder', regions: ['cardio'], pattern: 'cardio', tags: ['impact'] },

  // ===================================================================
  // RINGS
  // ===================================================================
  ringRow:        { name: 'Ring rows', cue: 'Walk the feet in to make it harder', alt: 'Bent-over dumbbell rows', equipment: ['rings'], bw: 'supermanPull', img: 'ringRow', regions: ['pull'], pattern: 'pullH', tags: [] },
  ringChinup:     { name: 'Ring chin-ups', cue: 'Chest to the rings, control down', alt: 'Ring rows, feet forward', equipment: ['rings'], bw: 'supermanPull', img: 'ringChinup', regions: ['pull'], pattern: 'pullV', tags: [] },
  ringPushup:     { name: 'Ring push-ups', cue: 'Rings turned out at the top', alt: 'Regular push-ups', equipment: ['rings'], bw: 'pushup', img: 'ringPushup', regions: ['push'], pattern: 'pushH', tags: [] },
  ringDip:        { name: 'Ring dips', cue: 'Or bench dips if the rings are high', alt: 'Bench dips with feet on the floor', equipment: ['rings'], bw: 'tricepDips', img: 'ringDip', regions: ['push'], pattern: 'pushV', tags: [] },
  ringTuckHold:   { name: 'Ring tuck holds', cue: 'Knees up, shoulders active', alt: 'Lying leg raises or dead bugs', equipment: ['rings'], bw: 'legRaises', img: 'ringTuckHold', regions: ['core'], pattern: 'coreFlex', tags: [] },
  ringHang:       { name: 'Ring hang', cue: 'Long arms, shoulders packed', alt: 'Ring rows, hold the top', equipment: ['rings'], bw: 'supermanHold', img: 'ringHang', regions: ['pull'], pattern: 'pullV', tags: [] }
};

// ---------------------------------------------------------------------
// STRETCH LIBRARY: used by the mobility flows
// ---------------------------------------------------------------------
const STRETCHES = [
  { id: 'forwardFold',   name: 'Standing forward fold',  alt: 'Seated forward fold',        area: 'back' },
  { id: 'downDog',       name: 'Downward dog',           alt: 'Hands on a bench, hips back', area: 'back' },
  { id: 'lowLungeL',     name: 'Low lunge, left',       alt: 'Half-kneeling, hands on shin', area: 'hips' },
  { id: 'lowLungeR',     name: 'Low lunge, right',      alt: 'Half-kneeling, hands on shin', area: 'hips' },
  { id: 'pigeonL',       name: 'Pigeon, left',          alt: 'Figure-4 on the ground',      area: 'hips' },
  { id: 'pigeonR',       name: 'Pigeon, right',         alt: 'Figure-4 on the ground',      area: 'hips' },
  { id: 'childsPose',    name: "Child's pose",           alt: '',                            area: 'back' },
  { id: 'cobra',         name: 'Cobra / upward dog',     alt: 'Sphinx on the forearms',      area: 'back' },
  { id: 'catCow',        name: 'Cat-cow flow',           alt: '',                            area: 'back' },
  { id: 'neckRolls',     name: 'Neck & shoulder rolls',  alt: '',                            area: 'shoulders' },
  { id: 'chestOpener',   name: 'Standing chest opener',  alt: 'Doorway pec stretch',         area: 'shoulders' },
  { id: 'threadNeedleL', name: 'Thread the needle, left',  alt: '',                         area: 'shoulders' },
  { id: 'threadNeedleR', name: 'Thread the needle, right', alt: '',                         area: 'shoulders' },
  { id: 'seatedFold',    name: 'Seated forward fold',    alt: '',                            area: 'legs' },
  { id: 'spinalTwistL',  name: 'Supine spinal twist, left',  alt: '',                       area: 'back' },
  { id: 'spinalTwistR',  name: 'Supine spinal twist, right', alt: '',                       area: 'back' },
  { id: 'hip9090L',      name: '90/90 hip, left',       alt: '',                            area: 'hips' },
  { id: 'hip9090R',      name: '90/90 hip, right',      alt: '',                            area: 'hips' },
  { id: 'frog',          name: 'Frog stretch',           alt: "Wide-knee child's pose",      area: 'hips' },
  { id: 'bridgeHold',    name: 'Glute bridge hold',      alt: '',                            area: 'hips' },
  { id: 'happyBaby',     name: 'Happy baby',             alt: 'Knees-to-chest rocks',        area: 'hips' },
  { id: 'savasana',      name: 'Savasana / deep breathing', alt: '',                         area: 'back' },
  { id: 'calfWall',      name: 'Calf stretch at the wall', alt: 'Seated calf stretch',       area: 'legs' },
  { id: 'quadKneel',     name: 'Kneeling quad stretch',  alt: 'Standing quad stretch',       area: 'legs' },
  { id: 'hamstringL',    name: 'Hamstring stretch, left',  alt: 'Seated, knee soft',        area: 'legs' },
  { id: 'hamstringR',    name: 'Hamstring stretch, right', alt: 'Seated, knee soft',        area: 'legs' },
  { id: 'tricepReach',   name: 'Overhead tricep reach',  alt: '',                            area: 'shoulders' },
  { id: 'wristCircles',  name: 'Wrist circles & shakes', alt: '',                            area: 'shoulders' }
];

const warmupExercise = {
  name: 'Easy movement',
  cue: 'Skip, arm circles, squats, lunges, shake it out',
  alt: 'Walk plus gentle dynamic stretches',
  img: null
};
const cooldownExercise = {
  name: 'Cool down',
  cue: 'Walk, deep breaths, stretch hammies / hips / shoulders / chest',
  alt: '',
  img: null
};
