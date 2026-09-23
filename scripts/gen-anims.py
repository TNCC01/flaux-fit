#!/usr/bin/env python3
"""Generate the animated exercise demo SVGs for FIT.

Each exercise declares key poses as joint coordinates: two for most
(start and end), more where the move has stages, like a burpee. See
pose() for the play order and timing. The renderer rigs the figure (limbs rotate at their joints, planted feet
and hands stay on the floor), cropped to the full range of motion, and
bakes pose0 -> pose1 -> pose0 into CSS transform keyframes in a single
self-animating file at img/exercises/<base>.svg (no JS, no SMIL), which
the app drops straight into an <img>. See the render section for how.

Figures are android-styled in the app palette with a 2.5D finish: shaded
teal-edged limbs, a lit helmet, far-side limbs darker and behind the
torso, amber equipment, the working muscle group lit in rose (see
ACTIVE), and a contact shadow on a floor plane.

Every key pose of an exercise MUST use the same number of arm chains, leg
chains and decorations, or the parts won't pair up, the build fails
loudly with the offending exercise name if they don't.

Preview a few without touching img/:
  python3 scripts/gen-anims.py --preview <dir> pushup kbSwing ...

Re-run after editing poses:  python3 scripts/gen-anims.py
"""
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'exercises')
W, H = 480, 320
GY = 292                       # ground line y
TEAL, TEAL_DIM = '#2dd4bf', '#0d9488'
AMBER = '#fbbf24'
BORDER = '#1f3333'
SW = 9                         # limb stroke width
HEAD_R = 15

# --------------------------------------------------------------- palette
DARK = '#0c2020'        # android body-panel fill
VISOR = '#a7f3ee'       # helmet visor slit
ROSE = '#f43f5e'        # active muscle-group glow
ROSE_DIM = '#8f2a3e'
TEAL_FAR = '#0b6f66'    # far-side limbs: clearly behind the near ones
ROSE_FAR = '#7a2436'
GLOW_W = 8              # extra width of the glow edge around a limb

# ------------------------------------------------------- part primitives
# Parts are dicts so poses can be interpolated numerically before styling.
def line(pts, color=TEAL, w=SW, opacity=1.0):
    return {'t': 'path', 'pts': [tuple(map(float, p)) for p in pts],
            'color': color, 'w': w, 'op': opacity}

def circle(c, r, color=TEAL, fill=True, w=SW * 0.7, opacity=1.0):
    return {'t': 'circle', 'c': (float(c[0]), float(c[1])), 'r': float(r),
            'color': color, 'fill': fill, 'w': w, 'op': opacity}

def qarc(p0, ctrl, p1, color=AMBER, w=4, n=12):
    """Quadratic arc sampled to a polyline so it can interpolate."""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1-t)**2*p0[0] + 2*(1-t)*t*ctrl[0] + t*t*p1[0]
        y = (1-t)**2*p0[1] + 2*(1-t)*t*ctrl[1] + t*t*p1[1]
        pts.append((x, y))
    return line(pts, color, w)

def ground(x0=40, x1=440):
    return line([(x0, GY), (x1, GY)], BORDER, 6)

def box(x, y, w, h):
    return [{'t': 'rect', 'x': float(x), 'y': float(y), 'w': float(w),
             'h': float(h), 'color': BORDER, 'sw': 6}]

# Android figure: each limb chain becomes a glow edge + dark core capsule;
# the head is a visor helmet. `roles` let ACTIVE highlight muscle groups.
_CTX = {'active': set(), 'variant': 'a'}

def _limb(pts, role, far=False):
    """A jointed chain. The renderer rigs it, so each joint rotates."""
    active = role in _CTX['active']
    glow = (ROSE_FAR if far else ROSE) if active else (TEAL_FAR if far else TEAL)
    w = 13 if _CTX['variant'] == 'a' else 11
    if role == 'torso':
        w += 4
    if far:
        w -= 2
    return {'t': 'chain', 'pts': [tuple(map(float, p)) for p in pts],
            'glow': glow, 'w': w, 'far': far, 'role': role}

def figure(head, neck, hip, arms, legs, head_r=HEAD_R):
    """arms/legs: list of point-chains starting at the shoulder / hip.
    The first chain is the far-side limb (darker, drawn behind the torso),
    the last is the near side (bright, drawn in front)."""
    far, near = [], []
    arms = [[_lerp_pt(neck, a[0], 0.5), a[0]] if len(a) == 1 else a for a in arms]
    for chains, root, role in ((legs, hip, 'legs'), (arms, neck, 'arms')):
        n = len(chains)
        for i, c in enumerate(chains):
            is_far = n > 1 and i == 0
            (far if is_far else near).append(_limb([root] + list(c), role, is_far))
    active = 'torso' in _CTX['active']
    head_part = {'t': 'head', 'pts': [tuple(map(float, neck)), tuple(map(float, head))],
                 'r': float(head_r), 'glow': ROSE if active else TEAL,
                 'pony': _CTX['variant'] == 'b'}
    return far + [_limb([hip, neck], 'torso'), head_part] + near

def kb(hand, r=11):
    """Kettlebell hanging just below the hand point."""
    cx, cy = hand
    return [line([(cx - 6, cy + 2), (cx + 6, cy + 2)], AMBER, 5),
            circle((cx, cy + r + 4), r, AMBER)]

def dumbbell(hand, dx=14, dy=0):
    cx, cy = hand
    return [line([(cx - dx, cy - dy), (cx + dx, cy + dy)], AMBER, 6),
            circle((cx - dx, cy - dy), 6, AMBER), circle((cx + dx, cy + dy), 6, AMBER)]

def barbell_side(hand, plate=13):
    return [circle(hand, plate, AMBER, fill=False, w=6),
            line([(hand[0] - 4, hand[1]), (hand[0] + 4, hand[1])], AMBER, 5)]

def barbell_front(y, x0, x1):
    return [line([(x0 - 26, y), (x1 + 26, y)], AMBER, 6),
            line([(x0 - 22, y - 14), (x0 - 22, y + 14)], AMBER, 9),
            line([(x1 + 22, y - 14), (x1 + 22, y + 14)], AMBER, 9)]

def rings(hands):
    out = []
    for hx, hy in hands:
        out.append(line([(hx, 0), (hx, hy - 10)], AMBER, 4))
        out.append(circle((hx, hy), 10, AMBER, fill=False, w=5))
    return out

# --------------------------------------------------------------- render
# An exercise is a few key poses played in a loop (two for most: start,
# end, back again). The renderer rigs every limb chain so each segment
# rotates about its joint, and bakes the loop into CSS transform keyframes:
# the browser tweens every frame, limbs keep their length and swing in
# arcs, and CSS animation plays inside an <img> on every browser. Held
# equipment rides with the hand. Anything that bends in a way transforms
# can't express (a skipping rope) falls back to a small flipbook on the
# same clock.
#
# The 2.5D look: limbs are shaded tubes with joint caps and gloved hands,
# the head is a lit sphere, far limbs sit darker and behind the torso, and
# a contact shadow on a floor plane shrinks when the figure leaves the
# ground.
import math

EASE = 'cubic-bezier(.45,0,.55,1)'
PAD = 16                         # frame padding around the full motion
HOLD = 0.2                       # share of each beat spent holding the pose
FLIP_FRAMES = 12                 # per move, for props that bend
SAMPLES = 8                      # keyframes per move for ik / lerp chains

def flatten(parts):
    out = []
    for chunk in parts:
        out.extend(chunk if isinstance(chunk, list) else [chunk])
    return out

def resample(pts, n=12):
    if len(pts) == 1:
        return pts * n
    segs = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    total = sum(segs) or 1.0
    out = []
    for k in range(n):
        d = total * k / (n - 1)
        acc = 0.0
        for i, s in enumerate(segs):
            if acc + s >= d or i == len(segs) - 1:
                t = 0.0 if s == 0 else (d - acc) / s
                p0, p1 = pts[i], pts[i + 1]
                out.append((p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t))
                break
            acc += s
    return out

def _lerp(a, b, t):
    return a + (b - a) * t

def _lerp_pt(p, q, t):
    return (_lerp(p[0], q[0], t), _lerp(p[1], q[1], t))

def _bezier_ease(u, x1=.45, y1=0.0, x2=.55, y2=1.0):
    """CSS cubic-bezier timing, so sampled keyframes stay on the CSS clock."""
    def bez(s, a, b):
        return 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if bez(mid, x1, x2) < u:
            lo = mid
        else:
            hi = mid
    return bez((lo + hi) / 2, y1, y2)

# ------------------------------------------------------------ rigging
# Within each move a chain moves one of three ways:
#   rot   each segment rotates about its joint (arcs, lengths kept)
#   ik    a foot or hand on the floor at both ends of the move, and not
#         moving far, stays on it while the joint between bends (two-bone
#         IK), so nothing swings through the floor
#   lerp  joints move straight; for limbs swinging towards or away from
#         the camera, where a flat rotation would flip the limb out
#         sideways. The segment shortens and the joint caps keep it solid,
#         so it reads as foreshortening.
# rot needs a keyframe at each end of the move; ik and lerp are sampled.
def _split_longest(pts):
    i = max(range(len(pts) - 1), key=lambda k: math.dist(pts[k], pts[k + 1]))
    return pts[:i + 1] + [_lerp_pt(pts[i], pts[i + 1], 0.5)] + pts[i + 1:]

def _angle(p, q):
    return math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))

def _wrap(a):
    return (a + 180) % 360 - 180

def _bend(p):
    """Which way a two-segment chain bends: +1 / -1, 0 if near straight."""
    (ax, ay), (bx, by), (cx, cy) = p
    z = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    scale = math.dist(p[0], p[1]) * math.dist(p[1], p[2]) or 1.0
    return 0 if abs(z) / scale < 0.2 else (1 if z > 0 else -1)   # ~11 degrees

def rig(p0, p1, allow_ik=True):
    """One move of a chain (equal point counts) -> rig for joints()."""
    segs = [(math.dist(p0[i], p0[i + 1]), math.dist(p1[i], p1[i + 1]),
             _angle(p0[i], p0[i + 1]), _angle(p1[i], p1[i + 1])) for i in range(len(p0) - 1)]
    # local angles, each taking the shortest way round
    loc, prev0, prev1 = [], 0.0, 0.0
    for L0, L1, w0, w1 in segs:
        a0 = _wrap(w0 - prev0)
        a1 = a0 + _wrap(_wrap(w1 - prev1) - a0)
        loc.append((L0, L1, a0, a1))
        prev0, prev1 = w0, w1
    r = {'root': (p0[0], p1[0]), 'segs': loc, 'p': (p0, p1), 'mode': 'rot', 'parent': None}
    on_floor = lambda p: abs(p[-1][1] - GY) < 12
    b0, b1 = (_bend(p0), _bend(p1)) if len(p0) == 3 else (0, 0)
    reach = sum(L0 for L0, *_ in segs)
    planted = math.dist(p0[-1], p1[-1]) < 0.4 * reach    # a slide, not a kick
    if (allow_ik and len(p0) == 3 and on_floor(p0) and on_floor(p1) and p0 != p1
            and planted and (b0 or b1) and not (b0 and b1 and b0 != b1)):
        r['mode'], r['bend'] = 'ik', b0 or b1
    elif any(abs(a1 - a0) > 150 for _, _, a0, a1 in loc):
        r['mode'] = 'lerp'
    elif allow_ik and _sink(r) > 6:
        # a limb rotating through the floor: straight lines sink less
        r['mode'] = 'lerp'
        if _sink(r) >= _sink(dict(r, mode='rot')):
            r['mode'] = 'rot'
    return r

def _sink(r):
    """How far a chain dips below the floor during the move."""
    return max(max(y for _, y in joints(r, k / 10)) for k in range(11)) - max(
        max(y for _, y in r['p'][0]), max(y for _, y in r['p'][1]), GY)

def joints(r, t):
    """World joint positions of a rigged chain at blend t of its move."""
    if r['parent']:
        pr, m = r['parent']
        x, y = joints(pr, t)[m]
    else:
        x, y = _lerp_pt(r['root'][0], r['root'][1], t)
    p0, p1 = r['p']
    if r['mode'] == 'lerp':
        (ox0, oy0), (ox1, oy1) = p0[0], p1[0]
        return [(x + _lerp(a[0] - ox0, b[0] - ox1, t), y + _lerp(a[1] - oy0, b[1] - oy1, t))
                for a, b in zip(p0, p1)]
    if r['mode'] == 'ik':
        (L10, L11, *_), (L20, L21, *_) = r['segs']
        L1, L2 = _lerp(L10, L11, t), _lerp(L20, L21, t)
        tx, ty = _lerp_pt(p0[2], p1[2], t)
        d = min(max(math.dist((x, y), (tx, ty)), abs(L1 - L2) + 1e-3), L1 + L2 - 1e-3)
        base = math.atan2(ty - y, tx - x)
        a = math.acos(max(-1.0, min(1.0, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))))
        a1 = base - r['bend'] * a
        kx, ky = x + L1 * math.cos(a1), y + L1 * math.sin(a1)
        a2 = math.atan2(ty - ky, tx - kx)
        return [(x, y), (kx, ky), (kx + L2 * math.cos(a2), ky + L2 * math.sin(a2))]
    pts, ang = [(x, y)], 0.0
    for L0, L1, a0, a1 in r['segs']:
        ang += _lerp(a0, a1, t)
        L = _lerp(L0, L1, t)
        x += L * math.cos(math.radians(ang))
        y += L * math.sin(math.radians(ang))
        pts.append((x, y))
    return pts

# ----------------------------------------------------- rigid equipment
def _shape_pts(p):
    if p['t'] == 'path':
        return list(p['pts'])
    if p['t'] == 'circle':
        return [p['c']]
    return [(p['x'], p['y']), (p['x'] + p['w'], p['y'] + p['h'])]

def _centroid(pts):
    return (sum(x for x, _ in pts) / len(pts), sum(y for _, y in pts) / len(pts))

def rigid_fit(a, b):
    """(c0, c1, dtheta, scale) mapping part a onto b, or None if it bends."""
    if a['t'] == 'circle':
        return (a['c'], b['c'], 0.0, b['r'] / a['r'] if a['r'] else 1.0)
    if a['t'] == 'rect':
        if (a['w'], a['h']) != (b['w'], b['h']):
            return None
        return (_centroid(_shape_pts(a)), _centroid(_shape_pts(b)), 0.0, 1.0)
    n = max(len(a['pts']), len(b['pts']))
    pa = a['pts'] if len(a['pts']) == n else resample(a['pts'], n)
    pb = b['pts'] if len(b['pts']) == n else resample(b['pts'], n)
    ca, cb = _centroid(pa), _centroid(pb)
    qa = [(x - ca[0], y - ca[1]) for x, y in pa]
    qb = [(x - cb[0], y - cb[1]) for x, y in pb]
    th = math.atan2(sum(x0 * y1 - y0 * x1 for (x0, y0), (x1, y1) in zip(qa, qb)),
                    sum(x0 * x1 + y0 * y1 for (x0, y0), (x1, y1) in zip(qa, qb)))
    c, s = math.cos(th), math.sin(th)
    err = max(math.dist((x * c - y * s, x * s + y * c), q) for (x, y), q in zip(qa, qb))
    if err > 2.5:
        return None
    return (ca, cb, math.degrees(th), 1.0)

# ------------------------------------------------------------ emitting
def _num(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s

# transforms are tuples: ('t', x, y) translate, ('r', deg), ('s', sx, sy)
def _svg_tf(f):
    out = []
    for op in f:
        if op[0] == 't':
            out.append(f'translate({_num(op[1])},{_num(op[2])})')
        elif op[0] == 'r':
            out.append(f'rotate({_num(op[1])})')
        else:
            out.append(f'scale({_num(op[1])},{_num(op[2])})')
    return ' '.join(out)

def _css_tf(f):
    out = []
    for op in f:
        if op[0] == 't':
            out.append(f'translate({_num(op[1])}px,{_num(op[2])}px)')
        elif op[0] == 'r':
            out.append(f'rotate({_num(op[1])}deg)')
        else:
            out.append(f'scale({_num(op[1])},{_num(op[2])})')
    return ' '.join(out) or 'none'

def _unwrap(keys):
    """Keep every rotation in a track within 180 degrees of the last."""
    out, prev = [], None
    for u, f, extra, timing in keys:
        if prev is not None:
            f = tuple(('r', q[1] + _wrap(op[1] - q[1])) if op[0] == 'r' else op
                      for op, q in zip(f, prev))
        out.append((u, f, extra, timing))
        prev = f
    return out

class _Anim:
    """Collects keyframes; identical tracks share one CSS rule."""
    def __init__(self, dur):
        self.dur, self.rules, self.seen = dur, [], {}

    def track(self, keys):
        """keys: [(u 0..1, transform, extra css, timing to the next key)]."""
        first = keys[0]
        if len({(_css_tf(f), e) for _, f, e, _ in keys}) == 1:
            f, e = first[1], first[2]
            return ((f' transform="{_svg_tf(f)}"' if f else '')
                    + (f' style="{e}"' if e else ''))
        key = tuple((round(u, 5), f, e, tm) for u, f, e, tm in keys)
        if key not in self.seen:
            k = f'm{len(self.seen)}'
            self.seen[key] = k
            # the easing only matters where the value changes before the
            # next key, and ease is the default, so most keys carry none
            decl = {}                  # identical keyframes share a rule
            for n, (u, f, e, tm) in enumerate(keys):
                moving = n + 1 < len(keys) and keys[n + 1][1:3] != (f, e)
                tf = f';animation-timing-function:{tm}' if moving and tm != EASE else ''
                decl.setdefault(f'transform:{_css_tf(f)};{e}'.rstrip(';') + tf, []).append(_num(100 * u) + '%')
            body = ''.join(f'{",".join(at)}{{{d}}}' for d, at in decl.items())
            self.rules.append(f'@keyframes {k}{{{body}}}'
                              f'.{k}{{animation:{k} {_num(self.dur)}s {EASE} infinite}}')
        return f' class="{self.seen[key]}"'

def _stroke(d, color, w, op=1.0, cap='round'):
    o = '' if op == 1.0 else f' opacity="{op}"'
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{_num(w)}" '
            f'stroke-linecap="{cap}" stroke-linejoin="round"{o}/>')

def _emit_local(p, c):
    """A part drawn relative to point c."""
    if p['t'] == 'path':
        d = 'M' + ' L'.join(f'{_num(x - c[0])},{_num(y - c[1])}' for x, y in p['pts'])
        return _stroke(d, p['color'], p['w'], p['op'])
    if p['t'] == 'circle':
        f = p['color'] if p['fill'] else 'none'
        s = 'none' if p['fill'] else p['color']
        o = '' if p['op'] == 1.0 else f' opacity="{p["op"]}"'
        return (f'<circle cx="{_num(p["c"][0] - c[0])}" cy="{_num(p["c"][1] - c[1])}" '
                f'r="{_num(p["r"])}" fill="{f}" stroke="{s}" stroke-width="{_num(p["w"])}"{o}/>')
    return (f'<rect x="{_num(p["x"] - c[0])}" y="{_num(p["y"] - c[1])}" width="{_num(p["w"])}" '
            f'height="{_num(p["h"])}" rx="6" fill="none" stroke="{p["color"]}" '
            f'stroke-width="{p["sw"]}"/>')

def _is_ground(p):
    return (p['t'] == 'path' and p['color'] == BORDER
            and all(y == GY for _, y in p['pts']))

# --------------------------------------------------------------- scene
JOINT_N, JOINT_F = '#0b1f1f', '#071313'
HAND_N, HAND_F = '#2f6e6a', '#173a38'

def _defs():
    tube = lambda i, edge, mid: (
        f'<linearGradient id="{i}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{edge}"/><stop offset=".45" stop-color="{mid}"/>'
        f'<stop offset="1" stop-color="{edge}"/></linearGradient>')
    return ('<defs>'
            + tube('tn', '#061414', '#1f4a47') + tube('tf', '#040c0c', '#102828')
            + '<radialGradient id="hd" cx=".35" cy=".3" r=".75">'
              '<stop offset="0" stop-color="#2a5a57"/><stop offset=".55" stop-color="#0c2020"/>'
              '<stop offset="1" stop-color="#050e0e"/></radialGradient>'
            + '<radialGradient id="sh"><stop offset="0" stop-color="#000" stop-opacity=".9"/>'
              '<stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'
            + '<linearGradient id="fl" x1="0" y1="0" x2="0" y2="1">'
              '<stop offset="0" stop-color="#16302f"/><stop offset="1" stop-color="#16302f" stop-opacity="0"/>'
              '</linearGradient>'
            + '</defs>')

def render_svg(keyposes, seq=(0, 1), beat=1.2, holds=None):
    """Key poses {k: parts} played in `seq` order, looping back to the
    start, as one self-animating SVG. Each move takes `beat` seconds, of
    which HOLD (or holds[k] on arriving at pose k) is spent still."""
    holds = holds or {}
    seq = list(seq)
    P = [keyposes[k] for k in seq]
    n_parts = len(P[0])
    for q in P[1:]:
        if len(q) != n_parts:
            raise ValueError(f'part count mismatch {n_parts} vs {len(q)}')
        for a, b in zip(P[0], q):
            if a['t'] != b['t']:
                raise ValueError(f'part type mismatch {a["t"]} vs {b["t"]}')
    M = len(seq)
    dur = M * beat

    # ---- timeline: move j runs pose j -> pose j+1 over [us, ue], then holds
    moves = []
    for j in range(M):
        h = holds.get(seq[(j + 1) % M], HOLD)
        us = j / M
        moves.append((j, (j + 1) % M, us, us + (1 - h) / M, (j + 1) / M))

    def at(u):
        """Cycle position -> (move index, eased blend)."""
        for j, _, us, ue, uh in moves:
            if u <= uh + 1e-9:
                return j, (1.0 if u >= ue else _bezier_ease((u - us) / (ue - us)))
        return M - 1, 1.0

    # ---- chains: equal joint counts across poses, then a rig per move
    chain_ix = [i for i, p in enumerate(P[0]) if p['t'] in ('chain', 'head')]
    pts = {}
    for i in chain_ix:
        ps = [list(q[i]['pts']) for q in P]
        n = max(len(x) for x in ps)
        for x in ps:
            while len(x) < n:
                x[:] = _split_longest(x)
        pts[i] = ps
    rigs = []
    for j, jn, *_ in moves:
        rj = {}
        for i in chain_ix:
            p = P[0][i]
            allow = p['t'] == 'chain' and p['role'] != 'torso'
            r = rig(pts[i][j], pts[i][jn], allow)
            if not allow:
                r['mode'] = 'rot'
            rj[i] = r
        # one body: limbs and head hang off the torso's hip or neck joint
        for ti in [i for i in chain_ix if P[0][i].get('role') == 'torso']:
            j0, j1 = joints(rj[ti], 0.0), joints(rj[ti], 1.0)
            for i in chain_ix:
                r = rj[i]
                if i == ti or r['parent']:
                    continue
                for m in (0, 1):
                    if math.dist(r['root'][0], j0[m]) < 1 and math.dist(r['root'][1], j1[m]) < 1:
                        r['parent'] = (rj[ti], m)
                        break
        rigs.append(rj)
    torso = [i for i in chain_ix if P[0][i].get('role') == 'torso']
    parent_of = {}
    for i in chain_ix:
        ms = {rigs[j][i]['parent'][1] if rigs[j][i]['parent'] else None for j in range(M)}
        if len(ms) == 1 and None not in ms and torso:
            parent_of[i] = (torso[0], ms.pop())
        else:
            for rj in rigs:
                rj[i]['parent'] = None

    def world(i, u):
        j, t = at(u)
        return joints(rigs[j][i], t)

    # ---- equipment: rigid props ride on the hand holding them in every
    # pose; else move rigidly on their own; else flipbook
    ends = [i for i in chain_ix if P[0][i]['t'] == 'chain']
    attached, free, flip, static = {}, {}, [], []
    for i, a in enumerate(P[0]):
        if i in pts or _is_ground(a):
            continue
        if all(q[i] == a for q in P):
            static.append(i)
            continue
        fits = [rigid_fit(a, q[i]) for q in P]
        if any(f is None for f in fits):
            flip.append(i)
            continue
        holder = set()
        for k, q in enumerate(P):
            best = None
            for j in ends:
                e = pts[j][k][-1]
                d = min(math.dist(e, s) for s in _shape_pts(q[i]))
                if q[i]['t'] == 'circle':
                    d = max(0.0, d - q[i]['r'])
                if best is None or d < best[0]:
                    best = (d, j)
            holder.add(best[1] if best and best[0] < 40 else None)
        if len(holder) == 1 and None not in holder:
            attached.setdefault(holder.pop(), []).append((i, fits))
        else:
            free[i] = fits

    def prop_keys(fits, hand=None):
        """Per-pose (offset, angle, scale) of a rigid prop."""
        out = []
        for k, (ca, ck, th, sc) in enumerate(fits):
            if hand is not None:
                h = pts[hand][k][-1]
                out.append((ck[0] - h[0], ck[1] - h[1], th, sc))
            else:
                out.append((ck[0], ck[1], th, sc))
        return out

    def pose_keys(values, extra=None):
        """A track that eases between per-pose values at each move."""
        keys = []
        for j, jn, us, ue, uh in moves:
            keys.append((us, values[j], extra[j] if extra else '', EASE))
            keys.append((ue, values[jn], extra[jn] if extra else '', 'linear'))
        keys.append((1.0, values[0], extra[0] if extra else '', 'linear'))
        return _unwrap(keys)

    # ---- framing: sample the whole loop, not just the key poses
    xs, ys = [], []
    def grow(q, rad):
        for x, y in q:
            xs.extend((x - rad, x + rad)); ys.extend((y - rad, y + rad))
    samples = sorted({us + (ue - us) * k / 8 for _, _, us, ue, _ in moves for k in range(9)})
    for u in samples:
        j, t = at(u)
        for i in chain_ix:
            q, p = joints(rigs[j][i], t), P[0][i]
            if p['t'] == 'head':
                grow(q[-1:], p['r'] + (8 if p['pony'] else 4))
            else:
                grow(q, (p['w'] + GLOW_W) / 2 + 2)
            if i in attached:
                for pi, fits in attached[i]:
                    ks = prop_keys(fits, i)
                    jn = moves[j][1]
                    off = _lerp_pt(ks[j][:2], ks[jn][:2], t)
                    c0 = fits[0][0]
                    grow([(q[-1][0] + off[0] + x - c0[0], q[-1][1] + off[1] + y - c0[1])
                          for x, y in _shape_pts(P[0][pi])],
                         P[0][pi].get('r', 0) + P[0][pi].get('w', 0) / 2 + 4)
    for i in list(free) + static + flip:
        for q in P:
            p = q[i]
            grow(_shape_pts(p), p.get('r', 0) + (p.get('w', 0) if p['t'] != 'rect' else 0) / 2)
    x0, x1, y0 = min(xs) - PAD, max(xs) + PAD, min(ys) - PAD
    y1 = max(min(max(ys), GY + 12), GY) + PAD      # a limb dipping low mustn't grow the floor
    w, h = x1 - x0, y1 - y0
    if w / h < W / H:
        cx, w = (x0 + x1) / 2, h * W / H
        x0 = cx - w / 2
    else:
        h = w * H / W
        y0 = y1 - h
    bx, by, bw, bh = x0, y0, w, h

    A = _Anim(dur)
    body = []

    # ---- floor plane and a contact shadow that follows the hips
    body.append(f'<rect x="{_num(bx)}" y="{GY}" width="{_num(bw)}" height="{_num(by + bh - GY)}" fill="url(#fl)"/>')
    body.append(_stroke(f'M{_num(bx)},{GY} H{_num(bx + bw)}', '#26403f', 3))
    if torso:
        limbs = [i for i in chain_ix if P[0][i]['t'] == 'chain']
        def shadow(k):
            hip = pts[torso[0]][k][0]
            q = [s for i in limbs for s in pts[i][k]]
            spread = max(x for x, _ in q) - min(x for x, _ in q)
            lift = max(0.0, GY - max(y for _, y in q) - 8)
            f = max(0.45, 1 - lift / 140)
            return hip[0], max(40.0, spread / 2 + 18) * f, f
        sh = [shadow(k) for k in range(M)]
        rx0 = sh[0][1]
        cls = A.track(pose_keys([(('t', x, GY), ('s', rx / rx0, 1)) for x, rx, _ in sh],
                                [f'opacity:{_num(0.9 * f)};' for _, _, f in sh]))
        body.append(f'<g{cls}><ellipse rx="{_num(rx0)}" ry="8" fill="url(#sh)"/></g>')

    for i in static:
        body.append(_emit_local(P[0][i], (0, 0)))

    # ---- chain tracks: one keyframe list per joint group
    track_cache = {}
    def chain_tracks(i):
        """Tracks for chain i: joint groups, segment scales, end frame.
        Keys land on every move boundary; ik / lerp moves add samples."""
        if i in track_cache:
            return track_cache[i]
        local = i in parent_of
        rows = []                      # (u, root, locals, lengths, timing)
        def row(u, j, t, timing):
            q = joints(rigs[j][i], t)
            angs = [_angle(q[k], q[k + 1]) for k in range(len(q) - 1)]
            locs = [angs[0]] + [angs[k] - angs[k - 1] for k in range(1, len(angs))]
            Ls = [math.dist(q[k], q[k + 1]) for k in range(len(q) - 1)]
            rows.append((u, (0.0, 0.0) if local else q[0], locs, Ls, timing))
        for j, jn, us, ue, uh in moves:
            if rigs[j][i]['mode'] == 'rot':
                row(us, j, 0.0, EASE)
            else:
                for k in range(SAMPLES):
                    row(us + (ue - us) * k / SAMPLES, j, _bezier_ease(k / SAMPLES), 'linear')
            row(ue, j, 1.0, 'linear')
        row(1.0, M - 1, 1.0, 'linear')
        # unwrap each local angle along the loop, then derive the end frame
        n = len(rows[0][2])
        prev = None
        fixed = []
        for u, root, locs, Ls, tm in rows:
            if prev is not None:
                locs = [p_ + _wrap(a - p_) for a, p_ in zip(locs, prev)]
            prev = locs
            fixed.append((u, root, locs, Ls, tm))
        groups = []
        for k in range(n):
            groups.append([(u, ((('r', locs[0]),) if local else (('t', *root), ('r', locs[0])))
                               if k == 0 else
                               (('t', Ls[k - 1], 0), ('r', locs[k])), '', tm)
                           for u, root, locs, Ls, tm in fixed])
        endf = [(u, (('t', Ls[-1], 0), ('r', -sum(locs))), '', tm) for u, root, locs, Ls, tm in fixed]
        Lb = [max(r_[3][k] for r_ in fixed) or 1.0 for k in range(n)]
        scales = [[(u, (('s', Ls[k] / Lb[k], 1),), '', tm) for u, root, locs, Ls, tm in fixed]
                  for k in range(n)]
        track_cache[i] = (groups, scales, Lb, endf, fixed)
        return track_cache[i]

    def prefix(i):
        """Replay the torso's transforms up to the shared joint, then undo
        its rotation so this chain's angles stay world angles."""
        if i not in parent_of:
            return []
        ti, m = parent_of[i]
        groups, _, _, _, fixed = chain_tracks(ti)
        if m == 0:
            return [[(u, (('t', *root),), '', tm) for u, root, locs, Ls, tm in fixed]]
        out = groups[:m]
        out.append([(u, (('t', Ls[m - 1], 0), ('r', -sum(locs[:m]))), '', tm)
                    for u, root, locs, Ls, tm in fixed])
        return out

    def chain_svg(i, layer):
        """Nested joint groups; 'glow' draws the outline, 'core' the tube."""
        p = P[0][i]
        groups, scales, Lb, endf, _ = chain_tracks(i)
        out, depth = [], 0
        for tr in prefix(i):
            out.append(f'<g{A.track(tr)}>'); depth += 1
        is_chain = p['t'] == 'chain'
        w = p.get('w', 0)
        gw = w + GLOW_W
        def cap(r_extra=0.0, hand=False):
            if not is_chain:
                return ''
            if layer == 'glow':
                return f'<circle r="{_num(gw / 2 + r_extra)}" fill="{p["glow"]}"/>'
            fill = ((HAND_F if p['far'] else HAND_N) if hand else
                    (JOINT_F if p['far'] else JOINT_N))
            return f'<circle r="{_num(w / 2 + r_extra)}" fill="{fill}"/>'
        for k, tr in enumerate(groups):
            out.append(f'<g{A.track(tr)}>'); depth += 1
            if not is_chain:
                continue
            if layer == 'glow':
                seg = _stroke(f'M0,0 H{_num(Lb[k])}', p['glow'], gw, cap='butt')
            else:
                seg = (f'<rect y="{_num(-w / 2)}" width="{_num(Lb[k])}" height="{_num(w)}" '
                       f'fill="url(#{"tf" if p["far"] else "tn"})"/>')
            out.append(cap())
            out.append(f'<g{A.track(scales[k])}>{seg}</g>')
        # upright frame at the chain end: hand or end cap, head, equipment
        end = cap(2.0, hand=True) if p.get('role') == 'arms' else cap()
        if layer == 'core' and p['t'] == 'head':
            hr = p['r']
            pony = (_stroke(f'M-2,{_num(-hr - 2)} L{_num(-hr - 6)},2 L{_num(-hr - 2)},{_num(hr + 6)}',
                            TEAL, 5) if p['pony'] else '')
            end += (pony + f'<circle r="{_num(hr + 4)}" fill="{p["glow"]}" opacity="0.95"/>'
                    f'<circle r="{_num(hr)}" fill="url(#hd)"/>'
                    + _stroke(f'M{_num(-hr * 0.62)},-3 H{_num(hr * 0.62)}', VISOR, 5))
        if layer == 'core' and i in attached:
            for pi, fits in attached[i]:
                ks = prop_keys(fits, i)
                c0 = fits[0][0]
                cls = A.track(pose_keys([(('t', ox, oy), ('r', th), ('s', sc, sc))
                                         for ox, oy, th, sc in ks]))
                end += f'<g{cls}>{_emit_local(P[0][pi], c0)}</g>'
        if end:
            out.append(f'<g{A.track(endf)}>{end}</g>')
        out.append('</g>' * depth)
        return ''.join(out)

    for i, p in enumerate(P[0]):
        if i in pts:
            if p['t'] == 'chain':
                body.append(chain_svg(i, 'glow'))
            body.append(chain_svg(i, 'core'))
        elif i in free:
            fits = free[i]
            c0 = fits[0][0]
            cls = A.track(pose_keys([(('t', ox, oy), ('r', th), ('s', sc, sc))
                                     for ox, oy, th, sc in prop_keys(fits)]))
            body.append(f'<g{cls}>{_emit_local(p, c0)}</g>')
        elif i in flip:
            # frames of the straight blend, each held for its slice of the loop
            frames = []
            for j, jn, us, ue, uh in moves:
                for k in range(FLIP_FRAMES):
                    lo = us + (ue - us) * k / FLIP_FRAMES
                    hi = us + (ue - us) * (k + 1) / FLIP_FRAMES if k < FLIP_FRAMES - 1 else uh
                    frames.append((lo, hi, j, jn, _bezier_ease((k + 0.5) / FLIP_FRAMES)))
            for n_, (lo, hi, j, jn, t) in enumerate(frames):
                a, b = P[j][i], P[jn][i]
                if a['t'] == 'path':
                    pa, pb = resample(a['pts']), resample(b['pts'])
                    q = dict(a, pts=[_lerp_pt(s, v, t) for s, v in zip(pa, pb)])
                elif a['t'] == 'circle':
                    q = dict(a, c=_lerp_pt(a['c'], b['c'], t), r=_lerp(a['r'], b['r'], t))
                else:
                    q = dict(a, **{c: _lerp(a[c], b[c], t) for c in 'xywh'})
                kf = f'f{i}_{n_}'
                first, last = n_ == 0, hi >= 1 - 1e-9
                A.rules.append(f'@keyframes {kf}{{0%{{opacity:{1 if first else 0}}}'
                               + ('' if first else f'{_num(100 * lo)}%{{opacity:1}}')
                               + ('' if last else f'{_num(100 * hi)}%{{opacity:0}}')
                               + f'100%{{opacity:{1 if last else 0}}}}}'
                               f'.{kf}{{opacity:0;animation:{kf} {_num(dur)}s step-end infinite}}')
                body.append(f'<g class="{kf}">{_emit_local(q, (0, 0))}</g>')

    css = ('g{transform-box:view-box;transform-origin:0 0}'
           + ''.join(A.rules)
           + '@media (prefers-reduced-motion:reduce){*{animation-play-state:paused!important}}')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_num(bw)} {_num(bh)}">'
            f'<style>{css}</style>{_defs()}'
            f'<g transform="translate({_num(-bx)},{_num(-by)})">{"".join(body)}</g></svg>\n')

# ---------------------------------------------------------------- poses
POSES, META = {}, {}
def pose(base, seq=(0, 1), beat=1.2, holds=None):
    """Register an exercise. fn(k) returns key pose k; seq is the order the
    key poses play in (looping back to the first), beat the seconds per
    move, holds {k: share of the beat} to override the pause on reaching k
    (0 for a jump's peak, which shouldn't hang in the air)."""
    def deco(fn):
        POSES[base] = fn
        META[base] = dict(seq=tuple(seq), beat=beat, holds=holds or {})
        return fn
    return deco

def render_exercise(base):
    m = META[base]
    fn = POSES[base]
    keys = {k: flatten(fn(k)) for k in set(m['seq'])}
    return render_svg(keys, m['seq'], m['beat'], m['holds'])

def _left_first(chains):
    """Front-view limbs in a fixed left-to-right order, so a mirrored pose
    moves each leg to its own new spot instead of swapping legs."""
    return sorted(chains, key=lambda c: c[-1][0])

def _lift(f, dy, dx=0):
    """Shift a whole figure dict (airborne poses)."""
    mv = lambda p: (p[0] + dx, p[1] - dy)
    return dict(head=mv(f['head']), neck=mv(f['neck']), hip=mv(f['hip']),
                arms=[[mv(p) for p in c] for c in f['arms']],
                legs=[[mv(p) for p in c] for c in f['legs']])

# ---- squat family ----------------------------------------------------
def _stand(x=240, arm='down', kb_hand=False, head_dx=2):
    neck, hip = (x, 118), (x, 192)
    head = (x + head_dx, 90)
    legs = [[(x - 6, 240), (x - 8, GY)], [(x + 8, 240), (x + 6, GY)]]
    if arm == 'down':
        arms = [[(x + 4, 155), (x + 2, 185)]]
    elif arm == 'front':
        arms = [[(x + 38, 128), (x + 74, 126)]]
    elif arm == 'up':
        arms = [[(x + 10, 82), (x + 14, 46)]]
    elif arm == 'chest':
        arms = [[(x + 26, 145), (x + 20, 128)]]
    return dict(head=head, neck=neck, hip=hip, arms=arms, legs=legs)

def _squat(x=240, arm='front'):
    hip = (x - 32, 238)
    neck = (x - 10, 158)
    head = (x - 4, 130)
    legs = [[(x + 26, 244), (x + 14, GY)], [(x + 30, 246), (x + 20, GY)]]
    if arm == 'front':
        arms = [[(x + 26, 168), (x + 62, 166)]]
    elif arm == 'down':
        arms = [[(x + 12, 195), (x + 10, 225)]]
    elif arm == 'chest':
        arms = [[(x + 16, 186), (x + 12, 168)]]
    return dict(head=head, neck=neck, hip=hip, arms=arms, legs=legs)

@pose('bwSquat')
def _(i):
    f = _stand(arm='front') if i == 0 else _squat(arm='front')
    return [ground(), figure(**f)]

@pose('squatReach')
def _(i):
    f = _squat(arm='down') if i == 0 else _stand(arm='up')
    return [ground(), figure(**f)]

@pose('jumpSquat')
def _(i):
    if i == 0:
        return [ground(), figure(**_squat(arm='down'))]
    x = 240
    f = dict(head=(x + 2, 40), neck=(x, 68),
             hip=(x, 142), arms=[[(x + 16, 32), (x + 20, 4)]],
             legs=[[(x - 4, 195), (x - 8, 245)], [(x + 8, 195), (x + 6, 245)]])
    return [ground(), figure(**f)]

@pose('gobletSquat')
def _(i):
    f = _stand(arm='chest') if i == 0 else _squat(arm='chest')
    hand = f['arms'][0][-1]
    return [ground(), figure(**f), kb((hand[0], hand[1] - 4), 10)]

@pose('cossackSquat', seq=(0, 1, 2, 1), beat=1.0)
def _(i):
    # front view: deep squat over one leg with the other straight, pass
    # through a tall wide stance, then the other side; feet stay planted
    x = 240
    if i == 1:
        return [ground(), figure(head=(x, 108), neck=(x, 136), hip=(x, 214),
                                 arms=[[(x - 2, 166), (x + 2, 178)]],
                                 legs=[[(x - 46, 254), (x - 94, GY)], [(x + 46, 254), (x + 94, GY)]])]
    s = 1 if i == 0 else -1
    hip = (x - 55 * s, 232)
    neck = (x - 48 * s, 152)
    head = (x - 48 * s, 124)
    legs = [[(x - 82 * s, 250), (x - 94 * s, GY)],          # bent support leg
            [(x + 30 * s, 275), (x + 94 * s, GY - 2)]]      # straight leg
    arms = [[(x - 10 * s, 165), (x + 20 * s, 172)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms,
                             legs=_left_first(legs))]

@pose('wallSit')
def _(i):
    x, wob = 300, 2 if i else 0
    wall_x = x + 42
    hip = (x + 38, 210)
    neck = (x + 40, 128 + wob)
    head = (x + 38, 100 + wob)
    legs = [[(x - 28, 212), (x - 26, GY)], [(x - 18, 212), (x - 16, GY)]]
    arms = [[(x + 40, 165), (x + 38, 195)]]
    return [ground(), line([(wall_x + 14, 40), (wall_x + 14, GY)], BORDER, 6),
            figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('calfRaise')
def _(i):
    x = 240
    lift = 0 if i == 0 else 14
    neck, hip = (x, 118 - lift), (x, 192 - lift)
    head = (x + 2, 90 - lift)
    heel_y = GY if i == 0 else GY - 14
    legs = [[(x - 6, 240 - lift), (x - 6, heel_y)], [(x + 8, 240 - lift), (x + 8, heel_y)]]
    toes = [line([(x - 6, heel_y), (x + 2, GY)], TEAL), line([(x + 8, heel_y), (x + 16, GY)], TEAL)]
    arms = [[(x + 4, 155 - lift), (x + 2, 185 - lift)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs), toes]

# ---- hinge family ----------------------------------------------------
def _hinge(x=240, arm_end=None, deep=True):
    """Bent-over hip hinge; arm_end = where the hands hang to."""
    hip = (x, 205)
    neck = (x - 78, 158) if deep else (x - 52, 138)
    head = (x - 100, 150) if deep else (x - 76, 124)
    legs = [[(x + 4, 248), (x - 2, GY)], [(x + 14, 248), (x + 10, GY)]]
    arms = [[arm_end or (x - 62, 230)]]
    return dict(head=head, neck=neck, hip=hip, arms=arms, legs=legs)

@pose('goodMorning')
def _(i):
    if i == 0:
        f = _stand(arm='up')
        f['arms'] = [[(240 - 16, 96), (240 - 2, 92)]]   # hands behind head
    else:
        f = _hinge(arm_end=(240 - 66, 148))
        f['arms'] = [[(240 - 84, 168)]]                 # hands by head
    return [ground(), figure(**f)]

@pose('kbSwing')
def _(i):
    x = 240
    if i == 0:
        f = _hinge(x, arm_end=(x - 30, 238))
        return [ground(), figure(**f), kb((x - 30, 238))]
    f = _stand(x)
    f['arms'] = [[(x - 40, 140), (x - 78, 150)]]
    return [ground(), figure(**f), kb((x - 78, 150))]

@pose('kbDeadlift')
def _(i):
    x = 240
    if i == 0:
        f = _hinge(x, arm_end=(x - 20, 262))
        return [ground(), figure(**f), kb((x - 20, 262))]
    f = _stand(x)
    f['arms'] = [[(x - 6, 160), (x - 8, 196)]]
    return [ground(), figure(**f), kb((x - 8, 196))]

@pose('barbellRow')
def _(i):
    x = 240
    hand = (x - 48, 252) if i == 0 else (x - 44, 198)
    f = _hinge(x, deep=False, arm_end=hand)
    f['neck'] = (x - 60, 150); f['head'] = (x - 84, 138)
    return [ground(), figure(**f), barbell_side(hand)]

@pose('dbRow')
def _(i):
    x = 240
    hand = (x - 48, 250) if i == 0 else (x - 44, 196)
    far = (x - 52, 250) if i == 0 else (x - 56, 250)
    f = _hinge(x, deep=False, arm_end=hand)
    f['neck'] = (x - 60, 150); f['head'] = (x - 84, 138)
    f['arms'] = [[far], [hand]]
    return [ground(), figure(**f), dumbbell(hand, 10, -3), dumbbell(far, 10, -3)]

# ---- plank / floor family --------------------------------------------
def _plank(x=225, hands_y=GY, hip_y=214, forearm=False, hand_dx=0):
    """Horizontal body, head to the right."""
    neck = (x + 88, 196)
    head = (x + 116, 188)
    hip = (x - 10, hip_y)
    hand = (x + 78 + hand_dx, hands_y)
    arms = [[hand]] if not forearm else [[(x + 66, hands_y), (x + 96, hands_y)]]
    legs = [[(x - 66, 244), (x - 122, GY - 6)]]
    return dict(head=head, neck=neck, hip=hip, arms=arms, legs=legs)

@pose('plank')
def _(i):
    f = _plank(forearm=True, hip_y=214 + (3 if i else 0))
    return [ground(), figure(**f)]

@pose('pushup')
def _(i):
    if i == 0:
        f = _plank()
        return [ground(), figure(**f)]
    x = 225
    f = dict(head=(x + 118, 246), neck=(x + 90, 250),
             hip=(x - 10, 252),
             arms=[[(x + 108, 268), (x + 84, GY)]],
             legs=[[(x - 66, 268), (x - 122, GY - 6)]])
    return [ground(), figure(**f)]

@pose('plankShoulderTaps')
def _(i):
    f = _plank()
    if i == 0:
        f['arms'] = [[(225 + 70, GY)], [(225 + 84, GY)]]
    else:
        f['arms'] = [[(225 + 70, GY)], [(225 + 96, 210)]]
    return [ground(), figure(**f)]

@pose('mountainClimber')
def _(i):
    f = _plank()
    if i == 0:
        f['legs'] = [[(225 - 66, 244), (225 - 122, GY - 6)],   # extended
                     [(225 - 20, 250), (225 + 20, 236)]]        # knee tucked
    else:
        f['legs'] = [[(225 - 20, 250), (225 + 20, 236)],
                     [(225 - 66, 244), (225 - 122, GY - 6)]]
    return [ground(), figure(**f)]

@pose('renegadeRow')
def _(i):
    f = _plank(hands_y=GY - 14)
    hand = (225 + 78, GY - 14)
    if i == 1:
        f['arms'] = [[hand], [(225 + 70, 206)]]
        return [ground(), figure(**f), dumbbell(hand, 12), dumbbell((225 + 70, 206), 12)]
    f['arms'] = [[(225 + 66, GY - 14)], [hand]]
    return [ground(), figure(**f), dumbbell((225 + 66, GY - 14), 12), dumbbell(hand, 12)]

@pose('ringPushup')
def _(i):
    hand = (225 + 78, GY - 24)
    if i == 0:
        f = _plank(hands_y=GY - 24)
        return [ground(), rings([hand]), figure(**f)]
    x = 225
    f = dict(head=(x + 118, 238), neck=(x + 90, 242),
             hip=(x - 10, 246),
             arms=[[(x + 104, 258), (x + 78, GY - 24)]],
             legs=[[(x - 66, 262), (x - 122, GY - 6)]])
    return [ground(), rings([hand]), figure(**f)]

@pose('bearCrawl')
def _(i):
    x = 230
    neck = (x + 60, 200)
    head = (x + 86, 192)
    hip = (x - 40, 202)
    s = 1 if i == 0 else -1
    arms = [[(x + 78 - 12 * s, GY)], [(x + 78 + 12 * s, GY)]]
    legs = [[(x - 60 - 10 * s, 246), (x - 58 - 14 * s, GY)],
            [(x - 60 + 10 * s, 246), (x - 58 + 14 * s, GY)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('birdDog')
def _(i):
    x = 230
    neck = (x + 60, 196)
    head = (x + 88, 188)
    hip = (x - 40, 198)
    if i == 0:
        arms = [[(x + 66, GY)], [(x + 78, GY)]]
        legs = [[(x - 52, 244), (x - 56, GY)], [(x - 40, 244), (x - 44, GY)]]
    else:
        arms = [[(x + 66, GY)], [(x + 108, 170), (x + 150, 162)]]
        legs = [[(x - 52, 244), (x - 56, GY)], [(x - 92, 186), (x - 148, 176)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('inchworm', seq=(0, 1, 2, 3, 2, 1), beat=0.9, holds={3: 0.25})
def _(i):
    # stand, fold with the hands down by the feet, walk the hands out
    # to a plank and back; the feet stay put the whole time
    x = 200
    if i == 0:
        return [ground(), figure(**_stand(x, arm='down'))]
    if i == 1:
        hip, neck = (x - 2, 182), (x + 37, 244)
        return [ground(), figure(head=(x + 48, 266), neck=neck, hip=hip,
                                 arms=[[(x + 52, 268), (x + 58, GY)]],
                                 legs=[[(x - 4, 237), (x - 8, GY)], [(x + 6, 237), (x + 6, GY)]])]
    if i == 2:
        hip, neck = (x + 4, 196), (x + 70, 228)
        return [ground(), figure(head=(x + 94, 240), neck=neck, hip=hip,
                                 arms=[[(x + 84, 260), (x + 98, GY)]],
                                 legs=[[(x - 2, 244), (x - 8, GY)], [(x + 8, 244), (x + 6, GY)]])]
    px = x + 120
    f = _pushup_d(px, 0.0)
    f['legs'] = [[(px - 64, 246), (px - 128, GY - 4)], [(px - 60, 244), (px - 114, GY - 4)]]
    return [ground(), figure(**f)]

@pose('pikePushup')
def _(i):
    x = 240
    hip = (x + 30, 150)
    if i == 0:
        neck = (x - 52, 216)
        head = (x - 62, 242)
        arms = [[(x - 78, GY)]]
    else:
        neck = (x - 62, 252)
        head = (x - 70, 276)
        arms = [[(x - 90, 262), (x - 78, GY)]]
    legs = [[(x + 32, 220), (x + 36, GY)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

# ---- lying / core family ----------------------------------------------
@pose('gluteBridge')
def _(i):
    x = 240
    if i == 0:
        hip = (x, 268)
        neck, head = (x + 88, 262), (x + 114, 256)
    else:
        hip = (x, 226)
        neck, head = (x + 84, 258), (x + 112, 254)
    legs = [[(x - 52, 236), (x - 62, GY)]]
    arms = [[(x + 60, GY - 6)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('singleLegBridge')
def _(i):
    x = 240
    if i == 0:
        hip = (x, 268)
        neck, head = (x + 88, 262), (x + 114, 256)
    else:
        hip = (x, 226)
        neck, head = (x + 84, 258), (x + 112, 254)
    legs = [[(x - 52, 236), (x - 62, GY)],
            [(x - 60, 208), (x - 112, 176)]]     # extended leg up
    arms = [[(x + 60, GY - 6)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('hollow')
def _(i):
    x = 240
    r = 8 if i else 0        # rock shift
    hip = (x - r, 258)
    neck = (x + 74 - r, 230)
    head = (x + 96 - r, 214)
    arms = [[(x + 108 - r, 196), (x + 140 - r, 182)]]
    legs = [[(x - 78 - r, 232), (x - 138 - r, 214)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('vSit')
def _(i):
    x = 240
    if i == 0:
        hip = (x, 262)
        neck, head = (x + 80, 240), (x + 104, 228)
        arms = [[(x + 96, 216), (x + 128, 202)]]
        legs = [[(x - 70, 240), (x - 128, 226)]]
    else:
        hip = (x, 262)
        neck, head = (x + 52, 192), (x + 66, 168)
        arms = [[(x + 10, 170), (x - 22, 148)]]
        legs = [[(x - 48, 196), (x - 92, 152)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('legRaise')
def _(i):
    x = 240
    hip = (x - 20, 268)
    neck, head = (x + 70, 262), (x + 96, 256)
    arms = [[(x + 40, GY - 4)]]
    if i == 0:
        legs = [[(x - 90, 258), (x - 150, 252)]]
    else:
        legs = [[(x - 30, 196), (x - 34, 138)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('flutterKicks')
def _(i):
    x = 240
    hip = (x - 20, 266)
    neck, head = (x + 70, 258), (x + 96, 250)
    arms = [[(x + 40, GY - 4)]]
    a, b = (232, 216), (250, 238)
    if i:
        a, b = b, a
    legs = [[(x - 86, a[1]), (x - 142, a[1] - 6)],
            [(x - 86, b[1]), (x - 142, b[1] - 6)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('deadBug')
def _(i):
    x = 240
    hip = (x - 16, 266)
    neck, head = (x + 74, 260), (x + 100, 254)
    s = i == 0
    up_arm = [(x + 88, 214), (x + 96, 172)]
    dn_arm = [(x + 116, 244)]
    up_leg = [(x - 66, 220), (x - 108, 186)]
    dn_leg = [(x - 88, 252), (x - 140, 248)]
    arms = [dn_arm, up_arm] if s else [up_arm, dn_arm]
    legs = [dn_leg, up_leg] if not s else [up_leg, dn_leg]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('bicycleCrunch')
def _(i):
    x = 240
    hip = (x - 10, 262)
    neck, head = (x + 64, 232), (x + 84, 214)
    s = 1 if i == 0 else -1
    # one knee tucked toward chest, other leg extended
    if i == 0:
        legs = [[(x - 80, 240), (x - 134, 228)], [(x - 30, 216), (x + 14, 224)]]
    else:
        legs = [[(x - 30, 216), (x + 14, 224)], [(x - 80, 240), (x - 134, 228)]]
    arms = [[(x + 66, 204), (x + 40, 196)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('sideBridge')
def _(i):
    x = 235
    dip = 0 if i == 0 else 22
    hip = (x - 6, 226 + dip)
    neck = (x + 80, 208)
    head = (x + 106, 200)
    arms = [[(x + 62, 250), (x + 92, GY)]]
    legs = [[(x - 68, 250 + dip // 2), (x - 126, GY - 4)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('superman')
def _(i):
    x = 240
    lift = 6 if i == 0 else 22
    hip = (x, 262)
    neck = (x + 84, 258 - lift // 2)
    head = (x + 110, 250 - lift)
    arms = [[(x + 128, 244 - lift), (x + 162, 236 - lift)]]
    legs = [[(x - 66, 254 - lift // 2), (x - 126, 244 - lift)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('russianTwist')
def _(i):
    x = 240
    hip = (x, 258)
    neck, head = (x + 44, 186), (x + 52, 160)
    legs = [[(x - 58, 220), (x - 104, 232)]]
    s = 1 if i == 0 else -1
    hand = (x - 10 - 30 * s, 208)
    arms = [[(x + 6, 206), hand]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs),
            kb(hand, 9)]

# ---- standing cardio family --------------------------------------------
@pose('jumpingJacks')
def _(i):
    # front view
    x = 240
    neck, hip = (x, 112), (x, 190)
    head = (x, 84)
    if i == 0:
        arms = [[(x - 34, 152), (x - 40, 186)], [(x + 34, 152), (x + 40, 186)]]
        legs = [[(x - 10, 240), (x - 12, GY)], [(x + 10, 240), (x + 12, GY)]]
    else:
        arms = [[(x - 44, 82), (x - 58, 46)], [(x + 44, 82), (x + 58, 46)]]
        legs = [[(x - 38, 238), (x - 58, GY)], [(x + 38, 238), (x + 58, GY)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('highKnees')
def _(i):
    x = 240
    neck, hip = (x, 116), (x, 190)
    head = (x + 2, 88)
    s = i == 0
    up = [(x + 42, 198), (x + 46, 236)]      # knee high, foot dangling
    dn = [(x - 4, 240), (x - 6, GY)]
    legs = [dn, up] if s else [up, dn]
    arms = [[(x + 30, 140), (x + 52, 122)]] if s else [[(x - 22, 148), (x - 44, 132)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('skaterHops', seq=(0, 1, 2, 1), beat=0.7, holds={1: 0})
def _(i):
    # front view leaping side to side, airborne through the middle
    x = 240
    if i == 1:
        return [ground(), figure(head=(x, 80), neck=(x, 108), hip=(x, 180),
                                 arms=[[(x - 4, 140), (x + 2, 170)]],
                                 legs=[[(x - 14, 226), (x - 22, 262)], [(x + 14, 226), (x + 22, 262)]])]
    s = 1 if i == 0 else -1
    neck = (x + 30 * s, 128)
    head = (x + 34 * s, 100)
    hip = (x + 44 * s, 198)
    legs = [[(x + 4 * s, 244), (x - 34 * s, 224)],          # trailing leg swept out
            [(x + 62 * s, 244), (x + 66 * s, GY)]]
    arms = [[(x - 8 * s, 150), (x - 40 * s, 138)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms,
                             legs=_left_first(legs))]

@pose('sprint')
def _(i):
    x = 240
    lean = 26
    neck = (x + lean, 122)
    head = (x + lean + 12, 96)
    hip = (x, 196)
    if i == 0:
        legs = [[(x + 44, 232), (x + 40, 280)], [(x - 40, 236), (x - 66, GY)]]
        arms = [[(x + lean - 30, 150), (x + lean - 44, 180)],
                [(x + lean + 30, 148), (x + lean + 52, 122)]]
    else:
        legs = [[(x - 40, 236), (x - 66, GY)], [(x + 44, 232), (x + 40, 280)]]
        arms = [[(x + lean + 30, 148), (x + lean + 52, 122)],
                [(x + lean - 30, 150), (x + lean - 44, 180)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('burpee', seq=(0, 1, 2, 3, 2, 1, 4), beat=0.6, holds={4: 0, 3: 0.1})
def _(i):
    # stand, squat with hands down, jump back to plank, chest to the floor,
    # plank, feet back in, jump with the arms up
    legs_plank = lambda x: [[(x - 62, 246), (x - 118, GY - 8)], [(x - 66, 244), (x - 122, GY - 6)]]
    if i == 0:
        return [ground(), figure(**_stand(arm='down'))]
    if i == 1:
        f = _squat_d(222, 1.0, arm='down')
        f['arms'] = [[(240, 212), (258, GY)]]
        return [ground(), figure(**f)]
    if i in (2, 3):
        f = _pushup_d(180, 0.0 if i == 2 else 1.0)
        f['legs'] = legs_plank(180)
        return [ground(), figure(**f)]
    x = 240
    f = dict(head=(x + 2, 40), neck=(x, 68), hip=(x, 142),
             arms=[[(x + 10, 34), (x + 14, 0)]],
             legs=[[(x - 4, 195), (x - 8, 245)], [(x + 8, 195), (x + 6, 245)]])
    return [ground(), figure(**f)]

@pose('ropeJumping')
def _(i):
    x = 240
    if i == 0:
        f = _stand(x)
        f['arms'] = [[(x - 30, 160), (x - 52, 178)], [(x + 30, 160), (x + 52, 178)]]
        rope = qarc((x - 52, 178), (x, GY + 18), (x + 52, 178))
        return [ground(), figure(**f), rope]
    lift = 22
    neck, hip = (x, 118 - lift), (x, 192 - lift)
    head = (x + 2, 90 - lift)
    legs = [[(x - 6, 236 - lift), (x - 10, 272 - lift)], [(x + 8, 236 - lift), (x + 4, 272 - lift)]]
    arms = [[(x - 30, 160 - lift), (x - 52, 148 - lift)], [(x + 30, 160 - lift), (x + 52, 148 - lift)]]
    rope = qarc((x - 52, 148 - lift), (x, 20), (x + 52, 148 - lift))
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs), rope]

@pose('reverseLunge')
def _(i):
    x = 240
    if i == 0:
        return [ground(), figure(**_stand(x))]
    neck, hip = (x - 4, 148), (x - 8, 222)
    head = (x - 2, 120)
    legs = [[(x + 34, 250), (x + 30, GY)],                    # front leg bent
            [(x - 54, 258), (x - 96, GY - 2)]]                # back leg back, knee low
    arms = [[(x, 185), (x - 2, 214)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('stepUp')
def _(i):
    x = 250
    bx = box(x + 10, GY - 52, 96, 52)
    if i == 0:
        neck, hip = (x - 30, 128), (x - 30, 202)
        head = (x - 28, 100)
        legs = [[(x - 36, 246), (x - 38, GY)],
                [(x + 18, 218), (x + 40, GY - 52)]]           # foot on box
        arms = [[(x - 26, 165), (x - 28, 195)]]
    else:
        lift = 56
        neck, hip = (x + 36, 128 - lift), (x + 36, 202 - lift)
        head = (x + 38, 100 - lift)
        legs = [[(x + 30, 250 - lift), (x + 32, GY - 52)],
                [(x + 44, 250 - lift), (x + 46, GY - 52)]]
        arms = [[(x + 40, 165 - lift), (x + 38, 195 - lift)]]
    return [ground(), bx, figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

# ---- press / arms family ------------------------------------------------
@pose('barbellPress')
def _(i):
    # front view
    x = 240
    neck, hip = (x, 122), (x, 196)
    head = (x, 92)
    legs = [[(x - 12, 242), (x - 14, GY)], [(x + 12, 242), (x + 14, GY)]]
    if i == 0:
        hands_y = 130
        arms = [[(x - 34, 148), (x - 30, hands_y)], [(x + 34, 148), (x + 30, hands_y)]]
        bar = barbell_front(hands_y, x - 30, x + 30)
    else:
        hands_y = 44
        arms = [[(x - 34, 86), (x - 30, hands_y)], [(x + 34, 86), (x + 30, hands_y)]]
        bar = barbell_front(hands_y, x - 30, x + 30)
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs), bar]

@pose('dbPress')
def _(i):
    x = 240
    neck, hip = (x, 122), (x, 196)
    head = (x, 92)
    legs = [[(x - 12, 242), (x - 14, GY)], [(x + 12, 242), (x + 14, GY)]]
    if i == 0:
        arms = [[(x - 36, 150), (x - 40, 122)], [(x + 36, 150), (x + 40, 122)]]
        hands = [(x - 40, 122), (x + 40, 122)]
    else:
        arms = [[(x - 36, 86), (x - 38, 48)], [(x + 36, 86), (x + 38, 48)]]
        hands = [(x - 38, 48), (x + 38, 48)]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs),
            [d for h in hands for d in dumbbell(h, 12)]]

@pose('kbCleanPress')
def _(i):
    x = 240
    f = _stand(x)
    if i == 0:
        f['arms'] = [[(x + 24, 148), (x + 16, 130)]]
        hand = (x + 16, 130)
    else:
        f['arms'] = [[(x + 18, 80), (x + 20, 44)]]
        hand = (x + 20, 44)
    return [ground(), figure(**f), kb(hand, 9)]

@pose('kbRackHold')
def _(i):
    x = 240
    f = _stand(x, head_dx=2 if i == 0 else 4)
    f['arms'] = [[(x + 24, 148), (x + 14, 128)]]
    return [ground(), figure(**f), kb((x + 14, 128), 9)]

@pose('dbCurl')
def _(i):
    x = 240
    f = _stand(x)
    if i == 0:
        f['arms'] = [[(x + 6, 158), (x + 10, 192)]]
        hand = (x + 10, 192)
    else:
        f['arms'] = [[(x + 6, 158), (x + 30, 132)]]
        hand = (x + 30, 132)
    return [ground(), figure(**f), dumbbell(hand, 11)]

@pose('lateralRaise')
def _(i):
    x = 240
    neck, hip = (x, 122), (x, 196)
    head = (x, 92)
    legs = [[(x - 12, 242), (x - 14, GY)], [(x + 12, 242), (x + 14, GY)]]
    if i == 0:
        arms = [[(x - 22, 158), (x - 26, 188)], [(x + 22, 158), (x + 26, 188)]]
        hands = [(x - 26, 188), (x + 26, 188)]
    else:
        arms = [[(x - 52, 138), (x - 88, 130)], [(x + 52, 138), (x + 88, 130)]]
        hands = [(x - 88, 130), (x + 88, 130)]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs),
            [d for h in hands for d in dumbbell(h, 11)]]

@pose('benchDips')
def _(i):
    x = 240
    bench = box(x + 26, GY - 58, 110, 58)
    if i == 0:
        neck = (x + 10, 158)
        head = (x + 12, 130)
        hip = (x + 16, 226)
        arms = [[(x + 34, 200), (x + 42, GY - 58)]]
    else:
        neck = (x + 10, 190)
        head = (x + 12, 162)
        hip = (x + 12, 252)
        arms = [[(x + 52, 216), (x + 42, GY - 58)]]
    legs = [[(x - 58, 252), (x - 110, GY - 4)]]
    return [ground(), bench, figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('farmersWalk')
def _(i):
    x = 240
    s = 1 if i == 0 else -1
    neck, hip = (x, 120), (x, 194)
    head = (x + 4, 92)
    legs = [[(x - 20 * s, 240), (x - 34 * s, GY)], [(x + 22 * s, 240), (x + 34 * s, GY)]]
    hand = (x + 52, 202)
    arms = [[(x + 34, 158), hand]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs),
            dumbbell((hand[0], hand[1] + 10), 13)]

# ---- rings ----------------------------------------------------------------
@pose('ringRow')
def _(i):
    x = 240
    hand = (x + 40, 150)
    if i == 0:
        neck = (x - 4, 190)
        hip = (x - 52, 236)
        head = (x - 10, 164)
        arms = [[(x + 20, 170), hand]]
        legs = [[(x - 96, 262), (x - 148, GY - 4)]]
    else:
        neck = (x + 16, 158)
        hip = (x - 40, 216)
        head = (x + 12, 132)
        arms = [[(x + 34, 162), hand]]
        legs = [[(x - 90, 252), (x - 148, GY - 4)]]
    return [ground(), rings([hand]), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('ringDip')
def _(i):
    x = 240
    hands = [(x - 34, 172), (x + 34, 172)]
    if i == 0:
        neck, head = (x, 128), (x, 100)
        hip = (x, 206)
        arms = [[(x - 30, 150), hands[0]], [(x + 30, 150), hands[1]]]
    else:
        neck, head = (x, 156), (x, 128)
        hip = (x, 228)
        arms = [[(x - 38, 168), hands[0]], [(x + 38, 168), hands[1]]]
    legs = [[(x - 8, 248), (x - 16, 276)], [(x + 8, 248), (x + 2, 276)]]
    return [rings(hands), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('ringTuckHold')
def _(i):
    x = 240
    hands = [(x - 34, 96), (x + 34, 96)]
    tuck = 0 if i == 0 else 10
    neck, head = (x, 128), (x, 156)   # hanging: head below hands? no, head above neck
    neck, head = (x, 140), (x, 114)
    hip = (x, 214)
    arms = [[hands[0]], [hands[1]]]
    legs = [[(x + 34, 226 - tuck), (x + 40, 252 - tuck)],
            [(x + 38, 230 - tuck), (x + 46, 256 - tuck)]]
    return [rings(hands), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

# ======================================================================
# EXPANDED LIBRARY
# One bespoke animation per new exercise. Grouped by family; the shared
# depth/stance helpers below take a continuous parameter so each exercise
# gets its own distinct start and end pose rather than reusing another's.
# ======================================================================

def _squat_d(x=240, d=0.0, arm='front'):
    """Side-on squat at depth d (0 = standing, 1 = bottom position)."""
    hip = (x - 32 * d, 192 + 46 * d)
    neck = (x - 10 * d, 118 + 40 * d)
    head = (x + 2 - 6 * d, 90 + 40 * d)
    legs = [[(x - 6 + 32 * d, 240 + 4 * d), (x - 8 + 22 * d, GY)],
            [(x + 8 + 22 * d, 240 + 6 * d), (x + 6 + 14 * d, GY)]]
    if arm == 'front':
        arms = [[(x + 38 - 12 * d, 128 + 40 * d), (x + 74 - 12 * d, 126 + 40 * d)]]
    elif arm == 'chest':
        arms = [[(x + 26 - 10 * d, 145 + 41 * d), (x + 20 - 8 * d, 128 + 40 * d)]]
    elif arm == 'rack':
        arms = [[(x + 24 - 8 * d, 148 + 41 * d), (x + 14 - 6 * d, 126 + 40 * d)]]
    elif arm == 'up':
        arms = [[(x + 10, 82 + 40 * d), (x + 14, 46 + 40 * d)]]
    else:                                              # 'down'
        arms = [[(x + 4 + 8 * d, 155 + 40 * d), (x + 2 + 8 * d, 185 + 40 * d)]]
    return dict(head=head, neck=neck, hip=hip, arms=arms, legs=legs)

def _split_d(x=240, d=0.0, s=1, arms=None):
    """Side-on split stance at depth d (0 = tall, 1 = back knee low)."""
    hip = (x, 196 + 26 * d)
    neck = (x - 2 * s, 122 + 26 * d)
    head = (x, 94 + 26 * d)
    legs = [[(x + 34 * s, 244 + 6 * d), (x + 30 * s, GY)],
            [(x - 46 * s, 240 + 20 * d), (x - 88 * s, GY - 2)]]
    if arms is None:
        arms = [[(x + 2 * s, 160 + 26 * d), (x, 190 + 26 * d)]]
    return dict(head=head, neck=neck, hip=hip, arms=arms, legs=legs)

def _front_stand(x=240, d=0.0, arms=None, wide=0):
    """Front-on standing figure; d bends the knees, wide spreads the feet."""
    neck, hip = (x, 112 + 30 * d), (x, 190 + 22 * d)
    head = (x, 84 + 30 * d)
    legs = [[(x - 10 - wide, 234 + 24 * d), (x - 12 - wide * 1.4, GY)],
            [(x + 10 + wide, 234 + 24 * d), (x + 12 + wide * 1.4, GY)]]
    if arms is None:
        arms = [[(x - 20, 150 + 28 * d), (x - 16, 186 + 22 * d)],
                [(x + 20, 150 + 28 * d), (x + 16, 186 + 22 * d)]]
    return dict(head=head, neck=neck, hip=hip, arms=arms, legs=legs)

def _supine(x=240, head_dx=88):
    """Lying on the back, head to the right. Caller supplies arms/legs."""
    return dict(hip=(x - 14, 266), neck=(x + head_dx - 18, 260),
                head=(x + head_dx + 8, 254))

def _quadruped(x=230):
    """On hands and knees, head to the right. Caller supplies arms/legs."""
    return dict(neck=(x + 60, 196), head=(x + 88, 188), hip=(x - 40, 198))

# ---- new squat family --------------------------------------------------
@pose('squatPulse')
def _(i):
    return [ground(), figure(**_squat_d(d=0.72 if i == 0 else 1.0, arm='front'))]

@pose('sumoSquat')
def _(i):
    x = 240
    d = 0.1 if i == 0 else 1.0
    arms = [[(x - 16, 154 + 30 * d), (x - 6, 196 + 26 * d)],
            [(x + 16, 154 + 30 * d), (x + 6, 196 + 26 * d)]]
    return [ground(), figure(**_front_stand(x, d, arms, wide=46))]

@pose('dbSquat')
def _(i):
    x = 240
    d = 0.05 if i == 0 else 1.0
    hands = [(x - 30, 196 + 24 * d), (x + 30, 196 + 24 * d)]
    arms = [[(x - 22, 152 + 28 * d), hands[0]], [(x + 22, 152 + 28 * d), hands[1]]]
    return [ground(), figure(**_front_stand(x, d, arms)),
            [p for h in hands for p in dumbbell(h, 12)]]

@pose('kbFrontSquat')
def _(i):
    f = _squat_d(d=0.05 if i == 0 else 1.0, arm='rack')
    hand = f['arms'][0][-1]
    return [ground(), figure(**f), kb((hand[0], hand[1] - 2), 10)]

@pose('kbThruster')
def _(i):
    x = 240
    if i == 0:
        f = _squat_d(x, 1.0, arm='rack')
        hand = f['arms'][0][-1]
        return [ground(), figure(**f), kb((hand[0], hand[1] - 2), 9)]
    f = _squat_d(x, 0.0, arm='up')
    hand = (x + 14, 46)
    return [ground(), figure(**f), kb(hand, 9)]

@pose('barbellThruster')
def _(i):
    x = 240
    d = 1.0 if i == 0 else 0.0
    hands_y = (134 + 40) if i == 0 else 44
    arms = [[(x - 34, hands_y + 18), (x - 30, hands_y)],
            [(x + 34, hands_y + 18), (x + 30, hands_y)]]
    return [ground(), figure(**_front_stand(x, d, arms)),
            barbell_front(hands_y, x - 30, x + 30)]

@pose('boxJump')
def _(i):
    x = 218
    bx = box(x + 76, GY - 56, 92, 56)
    if i == 0:
        f = _squat_d(x, 0.85, arm='down')
        return [ground(), bx, figure(**f)]
    lift = 60
    hip = (x + 108, 200 - lift)
    neck, head = (x + 110, 126 - lift), (x + 112, 98 - lift)
    legs = [[(x + 98, 244 - lift), (x + 100, GY - 56)],
            [(x + 118, 244 - lift), (x + 120, GY - 56)]]
    arms = [[(x + 118, 160 - lift), (x + 128, 192 - lift)]]
    return [ground(), bx, figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

# ---- new lunge family -------------------------------------------------
@pose('splitSquat')
def _(i):
    return [ground(), figure(**_split_d(d=0.15 if i == 0 else 1.0))]

@pose('bulgarianSplitSquat')
def _(i):
    x = 252
    bx = box(x - 152, GY - 44, 84, 44)
    d = 0.15 if i == 0 else 1.0
    hip = (x, 190 + 30 * d)
    neck, head = (x - 2, 116 + 30 * d), (x, 88 + 30 * d)
    legs = [[(x + 30, 244 + 6 * d), (x + 26, GY)],
            [(x - 58, 230 + 26 * d), (x - 106, GY - 44)]]
    arms = [[(x + 2, 152 + 30 * d), (x, 182 + 30 * d)]]
    return [ground(), bx, figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('dbSplitSquat')
def _(i):
    d = 0.15 if i == 0 else 1.0
    x = 240
    hand = (x + 6, 196 + 26 * d)
    f = _split_d(x, d, arms=[[(x + 2, 158 + 26 * d), hand]])
    return [ground(), figure(**f), dumbbell(hand, 12)]

@pose('overheadLunge')
def _(i):
    d = 0.15 if i == 0 else 1.0
    x = 240
    hand = (x + 10, 46)
    f = _split_d(x, d, arms=[[(x + 6, 84), hand]])
    return [ground(), figure(**f), dumbbell(hand, 12)]

@pose('pistolSquat')
def _(i):
    x = 232
    hand = (x + 74, 118)
    d = 0.0 if i == 0 else 1.0
    hip = (x - 8 * d, 196 + 52 * d)
    neck, head = (x, 122 + 40 * d), (x + 2, 94 + 40 * d)
    legs = [[(x - 2 + 18 * d, 244 + 4 * d), (x - 4 + 12 * d, GY)],
            [(x + 22 + 28 * d, 240 - 6 * d), (x + 66 + 44 * d, 236 + 18 * d)]]
    arms = [[(x + 40, 146 + 18 * d), hand]]
    return [ground(), rings([hand]),
            figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('walkingLunge')
def _(i):
    x = 208 if i == 0 else 270
    d = 1.0 if i == 0 else 0.25
    hip = (x, 196 + 26 * d)
    neck, head = (x - 4, 122 + 26 * d), (x - 2, 94 + 26 * d)
    legs = [[(x + 36, 244 + 6 * d), (x + 32, GY)],
            [(x - 44, 240 + 20 * d), (x - 86, GY - 2)]]
    arms = [[(x - 24, 152 + 26 * d), (x - 48, 176 + 26 * d)],
            [(x + 24, 152 + 26 * d), (x + 50, 130 + 26 * d)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('lateralLunge')
def _(i):
    x = 240
    if i == 0:
        return [ground(), figure(**_front_stand(x))]
    neck, hip = (x - 34, 146), (x - 42, 218)
    head = (x - 32, 118)
    legs = [[(x - 78, 250), (x - 88, GY)],
            [(x + 36, 262), (x + 98, GY - 2)]]
    arms = [[(x - 26, 176), (x - 8, 198)], [(x - 14, 172), (x + 14, 192)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('curtsyLunge')
def _(i):
    x = 240
    if i == 0:
        return [ground(), figure(**_front_stand(x))]
    neck, hip = (x - 6, 138), (x - 10, 214)
    head = (x - 4, 110)
    legs = [[(x - 34, 250), (x - 38, GY)],
            [(x + 24, 244), (x - 56, 282)]]
    arms = [[(x - 28, 168), (x - 36, 198)], [(x + 14, 166), (x + 24, 196)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('jumpLunge')
def _(i):
    x = 240
    if i == 0:
        arms = [[(x - 22, 186), (x - 44, 208)], [(x + 22, 186), (x + 46, 164)]]
        return [ground(), figure(**_split_d(x, 1.0, arms=arms))]
    lift = 34
    hip = (x, 176 - lift)
    neck, head = (x - 2, 102 - lift), (x, 74 - lift)
    legs = [[(x - 28, 214 - lift), (x - 46, 250 - lift)],
            [(x + 30, 216 - lift), (x + 50, 252 - lift)]]
    arms = [[(x - 26, 132 - lift), (x - 50, 108 - lift)],
            [(x + 26, 132 - lift), (x + 50, 108 - lift)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('stepUpJump')
def _(i):
    x = 250
    bx = box(x + 10, GY - 52, 96, 52)
    if i == 0:
        neck, hip = (x - 30, 128), (x - 30, 202)
        head = (x - 28, 100)
        legs = [[(x - 36, 246), (x - 38, GY)], [(x + 18, 218), (x + 40, GY - 52)]]
        arms = [[(x - 26, 165), (x - 28, 195)]]
    else:
        lift = 96
        neck, hip = (x + 40, 128 - lift), (x + 40, 202 - lift)
        head = (x + 42, 100 - lift)
        legs = [[(x + 26, 240 - lift), (x + 24, 270 - lift)],
                [(x + 50, 240 - lift), (x + 54, 270 - lift)]]
        arms = [[(x + 48, 158 - lift), (x + 62, 128 - lift)]]
    return [ground(), bx, figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('stepDown')
def _(i):
    x = 250
    bx = box(x - 44, GY - 52, 96, 52)
    if i == 0:
        neck, hip = (x + 6, 76), (x + 6, 150)
        head = (x + 8, 48)
        legs = [[(x, 196), (x + 2, GY - 52)], [(x + 20, 190), (x + 38, 214)]]
        arms = [[(x + 12, 112), (x + 10, 142)]]
    else:
        neck, hip = (x + 2, 108), (x - 4, 182)
        head = (x + 4, 80)
        legs = [[(x + 4, 226), (x + 6, GY - 52)], [(x - 48, 228), (x - 68, GY)]]
        arms = [[(x + 6, 144), (x + 4, 174)]]
    return [ground(), bx, figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('singleLegCalfRaise')
def _(i):
    x = 236
    lift = 0 if i == 0 else 16
    wall = line([(x + 78, 40), (x + 78, GY)], BORDER, 6)
    neck, hip = (x, 118 - lift), (x, 192 - lift)
    head = (x + 2, 90 - lift)
    heel = GY if i == 0 else GY - 16
    legs = [[(x - 2, 240 - lift), (x - 2, heel)],
            [(x + 18, 234 - lift), (x + 38, 256 - lift)]]
    arms = [[(x + 32, 148 - lift), (x + 60, 140 - lift)]]
    toes = line([(x - 2, heel), (x + 8, GY)], TEAL, SW)
    return [ground(), wall,
            figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs), toes]

# ---- new hinge / glute family -----------------------------------------
@pose('singleLegRdl')
def _(i):
    x = 240
    if i == 0:
        legs = [[(x - 2, 240), (x - 4, GY)], [(x + 16, 236), (x + 34, 258)]]
        arms = [[(x + 6, 156), (x + 4, 188)]]
        return [ground(), figure(head=(x + 2, 90), neck=(x, 118), hip=(x, 192),
                                 arms=arms, legs=legs)]
    hip = (x + 8, 202)
    neck, head = (x - 62, 178), (x - 88, 176)
    legs = [[(x + 12, 246), (x + 8, GY)], [(x + 56, 184), (x + 112, 172)]]
    arms = [[(x - 56, 224), (x - 52, 256)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('dbRdl')
def _(i):
    x = 240
    if i == 0:
        hands = [(x - 26, 196), (x + 26, 196)]
        f = _front_stand(x, 0.0, arms=[[(x - 20, 152), hands[0]], [(x + 20, 152), hands[1]]])
        return [ground(), figure(**f), [p for h in hands for p in dumbbell(h, 12)]]
    hip = (x + 6, 200)
    neck, head = (x - 62, 156), (x - 86, 150)
    legs = [[(x + 6, 246), (x, GY)], [(x + 16, 246), (x + 10, GY)]]
    hands = [(x - 48, 236), (x - 40, 240)]
    arms = [[(x - 54, 190), hands[0]], [(x - 46, 192), hands[1]]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs),
            [p for h in hands for p in dumbbell(h, 12)]]

@pose('barbellRdl')
def _(i):
    x = 240
    if i == 0:
        hand = (x - 8, 198)
        f = _squat_d(x, 0.0, arm='down')
        f['arms'] = [[(x - 4, 160), hand]]
        return [ground(), figure(**f), barbell_side(hand)]
    hand = (x - 44, 240)
    f = _hinge(x, deep=False, arm_end=hand)
    f['neck'] = (x - 58, 148); f['head'] = (x - 82, 140)
    return [ground(), figure(**f), barbell_side(hand)]

@pose('barbellGoodMorning')
def _(i):
    x = 240
    if i == 0:
        f = _squat_d(x, 0.0, arm='down')
        f['arms'] = [[(x - 22, 108), (x + 20, 106)]]
        return [ground(), figure(**f), barbell_front(104, x - 22, x + 20)]
    f = _hinge(x, deep=False)
    f['neck'] = (x - 54, 140); f['head'] = (x - 78, 128)
    f['arms'] = [[(x - 74, 120), (x - 34, 132)]]
    return [ground(), figure(**f), barbell_front(126, x - 74, x - 34)]

@pose('kbSumoDeadlift')
def _(i):
    x = 240
    d = 0.0 if i else 1.0
    hand = (x, 214 + 46 * d)
    f = _front_stand(x, d, wide=40,
                     arms=[[(x - 12, 152 + 30 * d), hand], [(x + 12, 152 + 30 * d), hand]])
    return [ground(), figure(**f), kb(hand, 11)]

@pose('kbSingleLegRdl')
def _(i):
    x = 240
    if i == 0:
        hand = (x + 4, 190)
        legs = [[(x - 2, 240), (x - 4, GY)], [(x + 16, 236), (x + 34, 258)]]
        f = dict(head=(x + 2, 90), neck=(x, 118), hip=(x, 192),
                 arms=[[(x + 6, 156), hand]], legs=legs)
        return [ground(), figure(**f), kb(hand, 10)]
    hip = (x + 8, 202)
    hand = (x - 54, 248)
    neck, head = (x - 62, 178), (x - 88, 176)
    legs = [[(x + 12, 246), (x + 8, GY)], [(x + 56, 184), (x + 112, 172)]]
    arms = [[(x - 58, 216), hand]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs),
            kb(hand, 10)]

@pose('kbSwingSingle')
def _(i):
    x = 240
    if i == 0:
        hand = (x - 28, 240)
        f = _hinge(x, arm_end=hand)
        f['arms'] = [[(x - 46, 210), hand]]
        return [ground(), figure(**f), kb(hand, 11)]
    hand = (x - 76, 148)
    f = _squat_d(x, 0.0, arm='down')
    f['arms'] = [[(x - 40, 138), hand]]
    return [ground(), figure(**f), kb(hand, 11)]

@pose('kbHighPull')
def _(i):
    x = 240
    if i == 0:
        hand = (x - 26, 244)
        f = _hinge(x, arm_end=hand)
        f['arms'] = [[(x - 44, 214), hand]]
        return [ground(), figure(**f), kb(hand, 11)]
    hand = (x - 44, 128)
    f = _squat_d(x, 0.0, arm='down')
    f['arms'] = [[(x - 20, 116), hand]]
    return [ground(), figure(**f), kb(hand, 11)]

@pose('kbSnatch')
def _(i):
    x = 240
    if i == 0:
        hand = (x - 28, 246)
        f = _hinge(x, arm_end=hand)
        f['arms'] = [[(x - 46, 216), hand]]
        return [ground(), figure(**f), kb(hand, 10)]
    hand = (x + 12, 40)
    f = _squat_d(x, 0.0, arm='down')
    f['arms'] = [[(x + 8, 78), hand]]
    return [ground(), figure(**f), kb(hand, 10)]

@pose('hipThrust')
def _(i):
    # shoulders on the bench edge, arms resting back along its top, chin
    # tucked so the head sits clear of the arms
    x = 236
    bench = box(x + 62, GY - 62, 104, 62)
    if i == 0:
        hip = (x - 16, 262)
        neck, head = (x + 58, 236), (x + 66, 208)
    else:
        hip = (x - 16, 214)
        neck, head = (x + 58, 232), (x + 72, 208)
    legs = [[(x - 60, 240), (x - 66, GY)], [(x - 48, 244), (x - 54, GY)]]
    arms = [[(x + 88, 222), (x + 118, 222)]]
    return [ground(), bench,
            figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('frogPump')
def _(i):
    x = 240
    f = _supine(x)
    lift = 0 if i == 0 else 34
    f['hip'] = (x - 14, 266 - lift)
    legs = [[(x - 74, 250 - lift // 2), (x - 44, 276)],
            [(x - 66, 262 - lift // 2), (x - 36, 284)]]
    arms = [[(x + 46, GY - 6)]]
    return [ground(), figure(**f, arms=arms, legs=legs)]

@pose('gluteKickback')
def _(i):
    x = 230
    f = _quadruped(x)
    arms = [[(x + 66, GY)], [(x + 78, GY)]]
    if i == 0:
        legs = [[(x - 52, 244), (x - 56, GY)], [(x - 48, 230), (x - 20, 250)]]
    else:
        legs = [[(x - 52, 244), (x - 56, GY)], [(x - 84, 178), (x - 138, 168)]]
    return [ground(), figure(**f, arms=arms, legs=legs)]

@pose('fireHydrant')
def _(i):
    x = 230
    f = _quadruped(x)
    arms = [[(x + 66, GY)], [(x + 78, GY)]]
    if i == 0:
        legs = [[(x - 52, 244), (x - 56, GY)], [(x - 44, 238), (x - 40, GY - 8)]]
    else:
        legs = [[(x - 52, 244), (x - 56, GY)], [(x - 58, 196), (x - 100, 168)]]
    return [ground(), figure(**f, arms=arms, legs=legs)]

# ---- new push family ---------------------------------------------------
def _pushup_d(x=225, d=0.0, hands_y=GY, hand_dx=0, feet_y=None, tilt=0.0):
    """Horizontal push-up at depth d (0 = arms locked, 1 = chest down).
    tilt raises (+) or drops (-) the head end for incline / decline."""
    drop = 44 * d
    neck = (x + 90, 196 + drop - tilt)
    head = (x + 117, 188 + drop - tilt)
    hip = (x - 10, 214 + drop - tilt * 0.35)
    hand = (x + 78 + hand_dx, hands_y)
    elbow = (x + 100 + hand_dx, 202 + drop - tilt)
    arms = [[elbow, hand]]
    legs = [[(x - 66, 244 + drop * 0.5), (x - 122, GY - 6 if feet_y is None else feet_y)]]
    return dict(head=head, neck=neck, hip=hip, arms=arms, legs=legs)

@pose('widePushup')
def _(i):
    x, d = 225, 0.0 if i == 0 else 1.0
    f = _pushup_d(x, d)
    f['arms'] = [[(x + 84 + 20 * d, 204 + 44 * d), (x + 54, GY)],
                 [(x + 96 + 22 * d, 200 + 44 * d), (x + 104, GY)]]
    return [ground(), figure(**f)]

@pose('diamondPushup')
def _(i):
    x, d = 225, 0.0 if i == 0 else 1.0
    f = _pushup_d(x, d, hand_dx=-8)
    f['arms'] = [[(x + 92 + 8 * d, 204 + 44 * d), (x + 70, GY)],
                 [(x + 96 + 8 * d, 202 + 44 * d), (x + 74, GY)]]
    return [ground(), figure(**f)]

@pose('tempoPushup')
def _(i):
    return [ground(), figure(**_pushup_d(d=0.32 if i == 0 else 1.0))]

@pose('inclinePushup')
def _(i):
    x = 210
    bench = box(x + 106, GY - 58, 96, 58)
    f = _pushup_d(x, 0.0 if i == 0 else 1.0, hands_y=GY - 58, tilt=44)
    return [ground(), bench, figure(**f)]

@pose('declinePushup')
def _(i):
    x = 240
    bench = box(x - 178, GY - 52, 92, 52)
    f = _pushup_d(x, 0.0 if i == 0 else 1.0, tilt=-34, feet_y=GY - 52)
    return [ground(), bench, figure(**f)]

@pose('clapPushup')
def _(i):
    x = 225
    if i == 0:
        return [ground(), figure(**_pushup_d(x, 1.0))]
    f = _pushup_d(x, 0.0)
    f['neck'] = (x + 90, 176); f['head'] = (x + 117, 168)
    f['hip'] = (x - 10, 196)
    f['arms'] = [[(x + 104, 190), (x + 86, GY - 26)]]
    f['legs'] = [[(x - 66, 228), (x - 122, GY - 14)]]
    return [ground(), figure(**f)]

@pose('elevatedPikePushup')
def _(i):
    x = 250
    bench = box(x - 20, GY - 56, 96, 56)
    hip = (x + 8, 128)
    if i == 0:
        neck, head = (x - 68, 200), (x - 78, 226)
        arms = [[(x - 96, GY)]]
    else:
        neck, head = (x - 78, 240), (x - 86, 264)
        arms = [[(x - 108, 248), (x - 96, GY)]]
    legs = [[(x + 6, 190), (x + 34, GY - 56)]]
    return [ground(), bench,
            figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('wallHandstand')
def _(i):
    x = 250
    wall = line([(x + 56, 24), (x + 56, GY)], BORDER, 6)
    sway = 0 if i == 0 else 5
    hip = (x + 30 - sway, 122)
    neck, head = (x + 16 - sway, 210), (x + 12 - sway, 240)
    arms = [[(x + 6, 250), (x, GY)], [(x + 22, 250), (x + 18, GY)]]
    legs = [[(x + 36, 74), (x + 40, 34)], [(x + 44, 74), (x + 48, 34)]]
    return [ground(), wall,
            figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('wallWalk')
def _(i):
    x = 258
    wall = line([(x + 58, 24), (x + 58, GY)], BORDER, 6)
    if i == 0:
        hip = (x - 12, 190)
        neck, head = (x - 62, 236), (x - 76, 258)
        arms = [[(x - 92, 250), (x - 100, GY)]]
        legs = [[(x + 22, 174), (x + 44, 122)]]
    else:
        hip = (x + 24, 128)
        neck, head = (x + 2, 208), (x - 4, 236)
        arms = [[(x - 16, 250), (x - 24, GY)]]
        legs = [[(x + 34, 82), (x + 44, 40)]]
    return [ground(), wall,
            figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

# ---- new pull family ---------------------------------------------------
@pose('supermanYtw')
def _(i):
    x = 240
    lift = 16
    hip = (x, 262)
    neck = (x + 84, 254)
    head = (x + 110, 246)
    if i == 0:                                    # Y, arms forward and wide
        arms = [[(x + 126, 232), (x + 158, 214)], [(x + 132, 250), (x + 166, 244)]]
    else:                                         # T, arms straight out
        arms = [[(x + 112, 216), (x + 118, 178)], [(x + 122, 252), (x + 156, 262)]]
    legs = [[(x - 66, 254), (x - 126, 244 - lift)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('ringChinup')
def _(i):
    x = 240
    hands = [(x - 26, 82), (x + 26, 82)]
    if i == 0:
        neck, head = (x, 146), (x, 118)
        hip = (x, 220)
        arms = [[(x - 14, 112), hands[0]], [(x + 14, 112), hands[1]]]
        legs = [[(x - 6, 254), (x - 14, 282)], [(x + 8, 254), (x + 2, 282)]]
    else:
        neck, head = (x, 106), (x, 78)
        hip = (x, 180)
        arms = [[(x - 34, 118), hands[0]], [(x + 34, 118), hands[1]]]
        legs = [[(x - 10, 216), (x - 20, 246)], [(x + 6, 216), (x, 246)]]
    return [rings(hands), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('ringHang')
def _(i):
    x = 240
    hands = [(x - 26, 74), (x + 26, 74)]
    pack = 0 if i == 0 else 8
    neck, head = (x, 150 - pack), (x, 122 - pack)
    hip = (x, 226 - pack)
    arms = [[hands[0]], [hands[1]]]
    legs = [[(x - 6, 262 - pack), (x - 14, 288 - pack)],
            [(x + 8, 262 - pack), (x + 2, 288 - pack)]]
    return [rings(hands), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

# ---- new core family ---------------------------------------------------
@pose('plankReach')
def _(i):
    f = _plank()
    x = 225
    if i == 0:
        f['arms'] = [[(x + 70, GY)], [(x + 86, GY)]]
    else:
        f['arms'] = [[(x + 70, GY)], [(x + 134, 186), (x + 176, 180)]]
    return [ground(), figure(**f)]

@pose('plankUpDown')
def _(i):
    x = 225
    if i == 0:
        f = _plank(forearm=True)
        f['arms'] = [[(x + 62, GY), (x + 96, GY)]]
    else:
        f = _plank()
        f['arms'] = [[(x + 96, 218), (x + 80, GY)]]
        f['hip'] = (x - 10, 208)
        f['neck'] = (x + 88, 190); f['head'] = (x + 116, 182)
    return [ground(), figure(**f)]

@pose('plankJack')
def _(i):
    f = _plank()
    x = 225
    f['arms'] = [[(x + 70, GY)], [(x + 86, GY)]]
    if i == 0:
        f['legs'] = [[(x - 64, 246), (x - 120, GY - 8)], [(x - 68, 242), (x - 124, GY - 4)]]
    else:
        f['legs'] = [[(x - 62, 232), (x - 116, GY - 34)], [(x - 70, 256), (x - 128, GY + 14)]]
    return [ground(), figure(**f)]

@pose('bearHold')
def _(i):
    x = 230
    f = _quadruped(x)
    hov = 12 if i == 0 else 16
    arms = [[(x + 66, GY)], [(x + 78, GY)]]
    legs = [[(x - 52, 240), (x - 56, GY - hov)], [(x - 40, 242), (x - 44, GY - hov)]]
    return [ground(), figure(**f, arms=arms, legs=legs)]

@pose('vUp')
def _(i):
    x = 240
    if i == 0:
        f = _supine(x, head_dx=78)
        arms = [[(x + 104, 250), (x + 140, 254)]]
        legs = [[(x - 78, 262), (x - 138, 266)]]
        return [ground(), figure(**f, arms=arms, legs=legs)]
    hip = (x - 6, 264)
    neck, head = (x + 44, 194), (x + 56, 168)
    arms = [[(x + 14, 168), (x - 20, 148)]]
    legs = [[(x - 48, 198), (x - 88, 152)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('tuckUp')
def _(i):
    x = 240
    if i == 0:
        f = _supine(x, head_dx=78)
        arms = [[(x + 104, 252), (x + 138, 258)]]
        legs = [[(x - 74, 264), (x - 134, 268)]]
        return [ground(), figure(**f, arms=arms, legs=legs)]
    hip = (x - 4, 262)
    neck, head = (x + 46, 202), (x + 58, 176)
    arms = [[(x + 22, 224), (x - 8, 236)]]
    legs = [[(x - 30, 214), (x + 6, 238)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('crunch')
def _(i):
    x = 240
    curl = 0 if i == 0 else 24
    hip = (x - 14, 268)
    neck = (x + 62, 258 - curl)
    head = (x + 86, 250 - curl * 1.3)
    arms = [[(x + 70, 234 - curl), (x + 56, 250 - curl)]]
    legs = [[(x - 62, 234), (x - 40, 274)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('reverseCrunch')
def _(i):
    x = 240
    f = _supine(x, head_dx=80)
    arms = [[(x + 44, GY - 4)]]
    if i == 0:
        legs = [[(x - 56, 236), (x - 30, 272)]]
    else:
        legs = [[(x - 22, 214), (x + 14, 226)]]
    return [ground(), figure(**f, arms=arms, legs=legs)]

@pose('sidePlankHold')
def _(i):
    x = 235
    rise = 0 if i == 0 else 6
    hip = (x - 6, 226 - rise)
    neck, head = (x + 80, 208), (x + 106, 200)
    arms = [[(x + 62, 250), (x + 92, GY)], [(x + 74, 176), (x + 80, 138)]]
    legs = [[(x - 68, 248 - rise), (x - 126, GY - 4)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('sidePlankThread')
def _(i):
    x = 235
    hip = (x - 6, 226)
    neck, head = (x + 80, 208), (x + 106, 200)
    if i == 0:
        arms = [[(x + 62, 250), (x + 92, GY)], [(x + 74, 174), (x + 80, 136)]]
    else:
        arms = [[(x + 62, 250), (x + 92, GY)], [(x + 42, 224), (x - 4, 240)]]
    legs = [[(x - 68, 248), (x - 126, GY - 4)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('crabWalk')
def _(i):
    x = 236 if i == 0 else 258
    s = 1 if i == 0 else -1
    hip = (x - 30, 224)
    neck, head = (x + 44, 214), (x + 66, 200)
    arms = [[(x + 56, 248), (x + 64, GY)]]
    legs = [[(x - 62, 240 - 6 * s), (x - 70, GY)], [(x - 50, 244 + 6 * s), (x - 58, GY)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('crabReach')
def _(i):
    x = 240
    hip = (x - 30, 228)
    if i == 0:
        neck, head = (x + 44, 216), (x + 66, 202)
        arms = [[(x + 58, 250), (x + 66, GY)], [(x + 50, 248), (x + 56, GY)]]
        legs = [[(x - 64, 244), (x - 72, GY)], [(x - 52, 246), (x - 60, GY)]]
    else:
        neck, head = (x + 40, 210), (x + 62, 196)
        arms = [[(x + 56, 250), (x + 64, GY)], [(x - 6, 176), (x - 54, 168)]]
        legs = [[(x - 66, 246), (x - 74, GY)], [(x - 62, 190), (x - 96, 160)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('mountainClimberCross')
def _(i):
    f = _plank()
    x = 225
    f['arms'] = [[(x + 70, GY)], [(x + 86, GY)]]
    ext = [(x - 66, 244), (x - 122, GY - 6)]
    if i == 0:
        f['legs'] = [ext, [(x - 14, 236), (x + 30, 214)]]
    else:
        f['legs'] = [[(x - 14, 258), (x + 30, 250)], ext]
    return [ground(), figure(**f)]

@pose('bearCrawlLateral')
def _(i):
    x = 230
    neck, head = (x + 58, 200), (x + 84, 192)
    hip = (x - 42, 202)
    sp = 10 if i == 0 else 30
    arms = [[(x + 72 - sp, GY)], [(x + 72 + sp, GY)]]
    legs = [[(x - 60 - sp * 0.7, 246), (x - 58 - sp, GY)],
            [(x - 60 + sp * 0.7, 246), (x - 58 + sp, GY)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('inchwormPushup')
def _(i):
    x = 225
    if i == 0:
        f = _plank()
        f['arms'] = [[(x + 100, 202), (x + 80, GY)]]
        return [ground(), figure(**f)]
    f = _pushup_d(x, 1.0)
    return [ground(), figure(**f)]

# ---- new standing cardio family ---------------------------------------
@pose('squatThrust')
def _(i):
    if i == 0:
        x = 240
        f = _squat_d(x, 1.0, arm='down')
        f['arms'] = [[(x + 20, 210), (x + 30, 262)]]
        return [ground(), figure(**f)]
    x = 225
    f = _plank()
    f['arms'] = [[(x + 96, 214), (x + 80, GY)]]
    f['legs'] = [[(x - 62, 246), (x - 118, GY - 8)], [(x - 68, 242), (x - 124, GY - 4)]]
    return [ground(), figure(**f)]

@pose('burpeeBroadJump', seq=(0, 1, 2, 1, 3), beat=0.65, holds={3: 0})
def _(i):
    # land, squat with the hands down, jump back to plank, feet in, then
    # a long jump forward with the arms driving
    legs_plank = lambda x: [[(x - 62, 246), (x - 118, GY - 8)], [(x - 68, 242), (x - 124, GY - 4)]]
    if i == 0:
        f = _squat_d(240, 0.5, arm='down')
        return [ground(), figure(**f)]
    if i == 1:
        f = _squat_d(222, 1.0, arm='down')
        f['arms'] = [[(240, 212), (258, GY)]]
        return [ground(), figure(**f)]
    if i == 2:
        f = _pushup_d(180, 0.0)
        f['legs'] = legs_plank(180)
        return [ground(), figure(**f)]
    x, lift = 262, 46
    hip = (x, 186 - lift)
    neck, head = (x + 12, 114 - lift), (x + 20, 88 - lift)
    legs = [[(x - 14, 226 - lift), (x - 44, 250 - lift)],
            [(x - 4, 230 - lift), (x - 34, 256 - lift)]]
    arms = [[(x + 34, 128 - lift), (x + 66, 108 - lift)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('sealJack')
def _(i):
    x = 240
    if i == 0:
        arms = [[(x - 30, 148), (x - 4, 142)], [(x + 30, 148), (x + 4, 142)]]
        f = _front_stand(x, 0.0, arms=arms)
        f['legs'] = [[(x - 10, 240), (x - 12, GY)], [(x + 10, 240), (x + 12, GY)]]
    else:
        arms = [[(x - 40, 144), (x - 82, 138)], [(x + 40, 144), (x + 82, 138)]]
        f = _front_stand(x, 0.0, arms=arms)
        f['legs'] = [[(x - 38, 238), (x - 58, GY)], [(x + 38, 238), (x + 58, GY)]]
    return [ground(), figure(**f)]

@pose('jackSquat', seq=(0, 1, 2, 1), beat=0.7, holds={1: 0})
def _(i):
    # feet together, jump the feet out wide, land in a squat, jump back in
    x = 240
    if i == 0:
        return [ground(), figure(**_front_stand(x, 0.0))]
    if i == 1:
        arms = [[(x - 26, 88), (x - 40, 54)], [(x + 26, 88), (x + 40, 54)]]
        return [ground(), figure(**_lift(_front_stand(x, 0.0, arms=arms, wide=18), 34))]
    arms = [[(x - 24, 178), (x - 6, 200)], [(x + 24, 178), (x + 6, 200)]]
    return [ground(), figure(**_front_stand(x, 1.0, arms=arms, wide=30))]

@pose('buttKicks')
def _(i):
    x = 240
    neck, hip = (x, 116), (x, 190)
    head = (x + 2, 88)
    kick = [(x - 6, 240), (x + 34, 232)]
    down = [(x + 4, 240), (x + 2, GY)]
    legs = [down, kick] if i == 0 else [kick, down]
    arms = [[(x + 28, 142), (x + 50, 124)]] if i == 0 else [[(x - 20, 148), (x - 42, 132)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('skiJump', seq=(0, 1, 2, 1), beat=0.6, holds={1: 0})
def _(i):
    # front view, feet together, hopping side to side over a line
    x = 240
    if i == 1:
        return [ground(), figure(head=(x, 70), neck=(x, 98), hip=(x, 170),
                                 arms=_left_first([[(x - 20, 128), (x - 30, 152)], [(x + 20, 128), (x + 30, 152)]]),
                                 legs=[[(x - 6, 216), (x - 8, 256)], [(x + 6, 216), (x + 8, 256)]])]
    s = 1 if i == 0 else -1
    hip = (x + 26 * s, 196)
    neck, head = (x + 18 * s, 122), (x + 20 * s, 94)
    legs = [[(x + 34 * s, 240), (x + 44 * s, GY - 10)],
            [(x + 42 * s, 242), (x + 54 * s, GY - 8)]]
    arms = [[(x - 6 * s, 152), (x - 32 * s, 168)], [(x + 4 * s, 150), (x - 22 * s, 172)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=_left_first(arms),
                             legs=_left_first(legs))]

@pose('tuckJump')
def _(i):
    x = 240
    if i == 0:
        arms = [[(x - 22, 178), (x - 8, 204)], [(x + 22, 178), (x + 8, 204)]]
        return [ground(), figure(**_front_stand(x, 0.85, arms=arms))]
    lift = 52
    hip = (x, 190 - lift)
    neck, head = (x, 112 - lift), (x, 84 - lift)
    legs = [[(x - 30, 190 - lift), (x - 22, 224 - lift)],
            [(x + 30, 190 - lift), (x + 22, 224 - lift)]]
    arms = [[(x - 26, 150 - lift), (x - 44, 176 - lift)],
            [(x + 26, 150 - lift), (x + 44, 176 - lift)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('broadJump')
def _(i):
    if i == 0:
        x = 190
        f = _squat_d(x, 0.9, arm='down')
        f['arms'] = [[(x + 16, 214), (x + 4, 254)]]
        return [ground(), figure(**f)]
    x = 292
    lift = 40
    hip = (x, 190 - lift)
    neck, head = (x + 10, 116 - lift), (x + 18, 90 - lift)
    legs = [[(x - 16, 224 - lift), (x - 46, 246 - lift)],
            [(x - 6, 228 - lift), (x - 36, 252 - lift)]]
    arms = [[(x + 34, 122 - lift), (x + 68, 104 - lift)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('lateralShuffle', seq=(0, 1, 2, 1), beat=0.6, holds={1: 0})
def _(i):
    # front view, low athletic stance; the feet snap together mid-shuffle
    x = 240
    if i == 1:
        return [ground(), figure(head=(x, 122), neck=(x, 150), hip=(x, 220),
                                 arms=_left_first([[(x - 30, 184), (x - 50, 204)], [(x + 30, 184), (x + 50, 204)]]),
                                 legs=[[(x - 16, 256), (x - 18, GY - 6)], [(x + 16, 256), (x + 18, GY - 6)]])]
    s = 1 if i == 0 else -1
    hip = (x + 18 * s, 224)
    neck, head = (x + 10 * s, 154), (x + 12 * s, 126)
    legs = [[(x - 34 * s, 258), (x - 74 * s, GY)],
            [(x + 62 * s, 256), (x + 96 * s, GY)]]
    arms = [[(x - 20 * s, 184), (x - 52 * s, 196)],
            [(x + 34 * s, 182), (x + 62 * s, 168)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=_left_first(arms),
                             legs=_left_first(legs))]

@pose('shuttleRun')
def _(i):
    # running out, then planting low to turn, both poses stay upright-ish
    # so the interpolated frames read as a stride rather than a tangle
    x = 240
    if i == 0:
        neck, head = (x + 22, 128), (x + 36, 102)
        hip = (x, 200)
        legs = [[(x + 42, 238), (x + 38, 282)], [(x - 38, 240), (x - 64, GY)]]
        arms = [[(x - 6, 158), (x - 24, 190)], [(x + 48, 154), (x + 74, 130)]]
    else:
        neck, head = (x - 14, 168), (x - 34, 148)
        hip = (x + 16, 226)
        legs = [[(x - 10, 258), (x - 44, GY)], [(x + 50, 252), (x + 84, GY)]]
        arms = [[(x - 40, 206), (x - 62, 248)], [(x + 10, 200), (x + 40, 188)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

@pose('doubleUnder')
def _(i):
    x = 240
    lift = 8 if i == 0 else 34
    neck, hip = (x, 118 - lift), (x, 192 - lift)
    head = (x + 2, 90 - lift)
    legs = [[(x - 6, 236 - lift), (x - 10, 268 - lift)],
            [(x + 8, 236 - lift), (x + 4, 268 - lift)]]
    arms = [[(x - 30, 158 - lift), (x - 54, 168 - lift)],
            [(x + 30, 158 - lift), (x + 54, 168 - lift)]]
    # two rope passes: one under the feet, one arcing overhead
    lo = qarc((x - 54, 168 - lift), (x, GY + 20), (x + 54, 168 - lift))
    hi = qarc((x - 54, 168 - lift), (x, 26 + lift), (x + 54, 168 - lift))
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs), lo, hi]

# ---- new kettlebell family ---------------------------------------------
@pose('kbPressSingle')
def _(i):
    x = 240
    hand = (x + 22, 128) if i == 0 else (x + 16, 44)
    elbow = (x + 30, 152) if i == 0 else (x + 26, 84)
    arms = [[(x - 20, 152), (x - 16, 186)], [elbow, hand]]
    return [ground(), figure(**_front_stand(x, 0.0, arms=arms)), kb(hand, 10)]

@pose('kbRow')
def _(i):
    x = 240
    hand = (x - 46, 250) if i == 0 else (x - 42, 194)
    f = _hinge(x, deep=False, arm_end=hand)
    f['neck'] = (x - 60, 150); f['head'] = (x - 84, 138)
    f['arms'] = [[(x - 54, 250)], [(x - 52, 214), hand]]
    return [ground(), figure(**f), kb(hand, 11)]

@pose('kbHalo')
def _(i):
    x = 240
    s = 1 if i == 0 else -1
    bell = (x + 44 * s, 74)
    arms = [[(x - 26 * s, 132), (x + 26 * s, 96)], [(x - 14 * s, 126), (x + 34 * s, 88)]]
    return [ground(), figure(**_front_stand(x, 0.0, arms=arms)), kb(bell, 10)]

@pose('kbWindmill')
def _(i):
    x = 240
    hand = (x + 34, 46)
    if i == 0:
        neck, hip = (x, 118), (x, 194)
        head = (x, 90)
        legs = [[(x - 26, 240), (x - 42, GY)], [(x + 26, 240), (x + 42, GY)]]
        arms = [[(x + 22, 82), hand], [(x - 22, 152), (x - 26, 188)]]
    else:
        neck, hip = (x + 6, 148), (x + 18, 214)
        head = (x + 8, 120)
        legs = [[(x - 22, 250), (x - 46, GY)], [(x + 40, 250), (x + 60, GY)]]
        arms = [[(x + 26, 104), hand], [(x - 22, 216), (x - 44, 272)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs),
            kb(hand, 10)]

@pose('kbSuitcaseHold')
def _(i):
    x = 240
    lean = 0 if i == 0 else 4
    hand = (x + 38, 196)
    arms = [[(x - 22, 152 + lean), (x - 20, 188 + lean)], [(x + 30, 152), hand]]
    f = _front_stand(x, 0.0, arms=arms)
    f['neck'] = (x - lean, 112); f['head'] = (x - lean * 1.5, 84)
    return [ground(), figure(**f), kb(hand, 11)]

@pose('kbFarmersWalk')
def _(i):
    x = 240
    s = 1 if i == 0 else -1
    neck, hip = (x, 120), (x, 194)
    head = (x + 4, 92)
    legs = [[(x - 20 * s, 240), (x - 34 * s, GY)], [(x + 22 * s, 240), (x + 34 * s, GY)]]
    hand = (x + 46, 200)
    arms = [[(x + 32, 158), hand], [(x - 24, 158), (x - 22, 192)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs),
            kb(hand, 12)]

@pose('halfGetup')
def _(i):
    x = 232
    hand = (x + 46, 168)
    if i == 0:                                  # flat on the back, bell pressed up
        hip = (x - 18, 266)
        neck, head = (x + 62, 260), (x + 88, 254)
        arms = [[(x + 54, 214), hand], [(x + 78, 268)]]
        legs = [[(x - 62, 238), (x - 38, 276)], [(x - 74, 262), (x - 132, 272)]]
    else:                                       # propped up on the elbow
        hip = (x - 22, 258)
        neck, head = (x + 40, 206), (x + 56, 182)
        arms = [[(x + 44, 178), hand], [(x + 16, 244), (x - 12, 272)]]
        legs = [[(x - 58, 232), (x - 34, 272)], [(x - 80, 254), (x - 138, 266)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs),
            kb(hand, 10)]

# ---- new barbell family -------------------------------------------------
@pose('barbellCurl')
def _(i):
    x = 240
    hands_y = 200 if i == 0 else 136
    arms = [[(x - 26, 158), (x - 24, hands_y)], [(x + 26, 158), (x + 24, hands_y)]]
    return [ground(), figure(**_front_stand(x, 0.0, arms=arms)),
            barbell_front(hands_y, x - 24, x + 24)]

@pose('barbellFloorPress')
def _(i):
    x = 236
    f = _supine(x, head_dx=84)
    hands_y = 248 if i == 0 else 188
    arms = [[(x + 58, 268), (x + 50, hands_y)], [(x + 66, 270), (x + 58, hands_y)]]
    legs = [[(x - 58, 238), (x - 34, 276)], [(x - 46, 242), (x - 22, 278)]]
    return [ground(), figure(**f, arms=arms, legs=legs),
            barbell_front(hands_y, x + 50, x + 58)]

# ---- new dumbbell family ------------------------------------------------
@pose('dbArnoldPress')
def _(i):
    x = 240
    if i == 0:                                  # palms in, elbows tucked front
        hands = [(x - 16, 132), (x + 16, 132)]
        arms = [[(x - 30, 154), hands[0]], [(x + 30, 154), hands[1]]]
        dbs = [p for h in hands for p in dumbbell(h, 0, 12)]
    else:                                       # rotated out, locked overhead
        hands = [(x - 38, 46), (x + 38, 46)]
        arms = [[(x - 36, 86), hands[0]], [(x + 36, 86), hands[1]]]
        dbs = [p for h in hands for p in dumbbell(h, 12, 0)]
    return [ground(), figure(**_front_stand(x, 0.0, arms=arms)), dbs]

@pose('dbPushPress')
def _(i):
    x = 240
    if i == 0:                                  # dip
        hands = [(x - 34, 130), (x + 34, 130)]
        arms = [[(x - 34, 158), hands[0]], [(x + 34, 158), hands[1]]]
        f = _front_stand(x, 0.4, arms=arms)
    else:                                       # drive overhead
        hands = [(x - 38, 44), (x + 38, 44)]
        arms = [[(x - 36, 84), hands[0]], [(x + 36, 84), hands[1]]]
        f = _front_stand(x, 0.0, arms=arms)
    return [ground(), figure(**f), [p for h in hands for p in dumbbell(h, 12)]]

@pose('dbFrontRaise')
def _(i):
    x = 240
    hand = (x + 8, 196) if i == 0 else (x + 74, 118)
    elbow = (x + 6, 158) if i == 0 else (x + 42, 130)
    f = _squat_d(x, 0.0, arm='down')
    f['arms'] = [[elbow, hand]]
    return [ground(), figure(**f), dumbbell(hand, 12)]

@pose('dbUprightRow')
def _(i):
    x = 240
    hands_y = 198 if i == 0 else 132
    elbow_dx = 24 if i == 0 else 54
    arms = [[(x - elbow_dx, 156), (x - 18, hands_y)], [(x + elbow_dx, 156), (x + 18, hands_y)]]
    f = _front_stand(x, 0.0, arms=arms)
    hands = [(x - 18, hands_y), (x + 18, hands_y)]
    return [ground(), figure(**f), [p for h in hands for p in dumbbell(h, 11)]]

@pose('dbShrug')
def _(i):
    x = 240
    up = 0 if i == 0 else 14
    hands = [(x - 34, 200), (x + 34, 200)]
    arms = [[(x - 32, 152 - up), hands[0]], [(x + 32, 152 - up), hands[1]]]
    f = _front_stand(x, 0.0, arms=arms)
    f['neck'] = (x, 112 + up * 0.2)
    return [ground(), figure(**f), [p for h in hands for p in dumbbell(h, 12)]]

@pose('dbHammerCurl')
def _(i):
    x = 240
    hand = (x + 10, 192) if i == 0 else (x + 30, 130)
    f = _squat_d(x, 0.0, arm='down')
    f['arms'] = [[(x + 6, 158), hand]]
    return [ground(), figure(**f), dumbbell(hand, 0, 13)]

@pose('dbRowSingle')
def _(i):
    x = 250
    bench = box(x + 14, GY - 60, 104, 60)
    hand = (x - 40, 252) if i == 0 else (x - 34, 198)
    f = _hinge(x, deep=False, arm_end=hand)
    f['neck'] = (x - 56, 148); f['head'] = (x - 80, 138)
    f['arms'] = [[(x + 22, 180), (x + 52, GY - 60)], [(x - 46, 212), hand]]
    f['legs'] = [[(x + 4, 248), (x - 2, GY)], [(x + 16, 248), (x + 12, GY)]]
    return [ground(), bench, figure(**f), dumbbell(hand, 11, -3)]

@pose('dbRearDeltFly')
def _(i):
    x = 240
    f = _hinge(x, deep=False)
    f['neck'] = (x - 58, 148); f['head'] = (x - 82, 140)
    if i == 0:
        hands = [(x - 48, 246), (x - 40, 250)]
        f['arms'] = [[(x - 52, 208), hands[0]], [(x - 44, 210), hands[1]]]
    else:
        hands = [(x - 96, 196), (x - 4, 214)]
        f['arms'] = [[(x - 70, 200), hands[0]], [(x - 30, 206), hands[1]]]
    return [ground(), figure(**f), [p for h in hands for p in dumbbell(h, 11)]]

@pose('dbFloorPress')
def _(i):
    x = 236
    f = _supine(x, head_dx=84)
    hy = 246 if i == 0 else 188
    hands = [(x + 48, hy), (x + 60, hy + 6)]
    arms = [[(x + 60, 266), hands[0]], [(x + 70, 268), hands[1]]]
    legs = [[(x - 58, 238), (x - 34, 276)], [(x - 46, 242), (x - 22, 278)]]
    return [ground(), figure(**f, arms=arms, legs=legs),
            [p for h in hands for p in dumbbell(h, 11)]]

@pose('dbSkullcrusher')
def _(i):
    x = 236
    f = _supine(x, head_dx=84)
    if i == 0:
        hands = [(x + 86, 224), (x + 96, 230)]
        arms = [[(x + 58, 212), hands[0]], [(x + 66, 216), hands[1]]]
    else:
        hands = [(x + 50, 182), (x + 60, 188)]
        arms = [[(x + 56, 216), hands[0]], [(x + 64, 220), hands[1]]]
    legs = [[(x - 58, 238), (x - 34, 276)], [(x - 46, 242), (x - 22, 278)]]
    return [ground(), figure(**f, arms=arms, legs=legs),
            [p for h in hands for p in dumbbell(h, 11)]]

@pose('dbOverheadTricep')
def _(i):
    x = 240
    hand = (x + 4, 104) if i == 0 else (x + 12, 40)
    arms = [[(x - 8, 74), hand], [(x + 14, 76), hand]]
    f = _front_stand(x, 0.0, arms=arms)
    return [ground(), figure(**f), dumbbell(hand, 0, 14)]

@pose('dbWoodchop')
def _(i):
    x = 240
    if i == 0:
        hand = (x - 46, 226)
        arms = [[(x - 26, 168), hand], [(x - 18, 172), hand]]
        f = _front_stand(x, 0.5, arms=arms)
    else:
        hand = (x + 62, 62)
        arms = [[(x + 28, 108), hand], [(x + 20, 114), hand]]
        f = _front_stand(x, 0.0, arms=arms)
    return [ground(), figure(**f), dumbbell(hand, 11)]

@pose('dbFarmersWalk')
def _(i):
    x = 240
    s = 1 if i == 0 else -1
    neck, hip = (x, 120), (x, 194)
    head = (x + 4, 92)
    legs = [[(x - 20 * s, 240), (x - 34 * s, GY)], [(x + 22 * s, 240), (x + 34 * s, GY)]]
    hands = [(x - 36, 202), (x + 36, 202)]
    arms = [[(x - 30, 158), hands[0]], [(x + 30, 158), hands[1]]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs),
            [p for h in hands for p in dumbbell(h, 13)]]

@pose('dbOverheadCarry')
def _(i):
    x = 240
    s = 1 if i == 0 else -1
    neck, hip = (x, 118), (x, 192)
    head = (x, 90)
    legs = [[(x - 20 * s, 238), (x - 34 * s, GY)], [(x + 22 * s, 238), (x + 34 * s, GY)]]
    hands = [(x - 36, 44), (x + 36, 44)]
    arms = [[(x - 34, 82), hands[0]], [(x + 34, 82), hands[1]]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs),
            [p for h in hands for p in dumbbell(h, 12)]]

# -------------------------------------------------- muscle-group highlight
# Primary region lit in rose per exercise: arms / legs / torso (core+back).
ACTIVE = {
    'arms': ['pushup', 'pikePushup', 'benchDips', 'dbCurl', 'dbPress',
             'barbellPress', 'lateralRaise', 'kbCleanPress', 'ringDip',
             'ringPushup', 'ringRow', 'barbellRow', 'dbRow', 'renegadeRow',
             'farmersWalk', 'kbRackHold', 'bearCrawl',
             # expanded library
             'widePushup', 'diamondPushup', 'declinePushup', 'inclinePushup',
             'tempoPushup', 'clapPushup', 'elevatedPikePushup', 'wallHandstand',
             'wallWalk', 'supermanYtw', 'ringChinup', 'ringHang', 'plankUpDown',
             'kbPressSingle', 'kbRow', 'kbHalo', 'kbHighPull', 'barbellCurl',
             'barbellFloorPress', 'dbArnoldPress', 'dbPushPress', 'dbFrontRaise',
             'dbUprightRow', 'dbShrug', 'dbHammerCurl', 'dbRowSingle',
             'dbRearDeltFly', 'dbFloorPress', 'dbSkullcrusher',
             'dbOverheadTricep', 'dbOverheadCarry', 'dbFarmersWalk',
             'kbFarmersWalk'],
    'legs': ['bwSquat', 'squatReach', 'jumpSquat', 'gobletSquat',
             'cossackSquat', 'wallSit', 'calfRaise', 'reverseLunge', 'stepUp',
             'highKnees', 'skaterHops', 'sprint', 'ropeJumping', 'kbDeadlift',
             'gluteBridge', 'singleLegBridge', 'kbSwing', 'jumpingJacks',
             'burpee', 'goodMorning',
             # expanded library
             'squatPulse', 'sumoSquat', 'dbSquat', 'kbFrontSquat', 'kbThruster',
             'barbellThruster', 'boxJump', 'splitSquat', 'bulgarianSplitSquat',
             'dbSplitSquat', 'overheadLunge', 'pistolSquat', 'walkingLunge',
             'lateralLunge', 'curtsyLunge', 'jumpLunge', 'stepUpJump',
             'stepDown', 'singleLegCalfRaise', 'singleLegRdl', 'dbRdl',
             'barbellRdl', 'barbellGoodMorning', 'kbSumoDeadlift',
             'kbSingleLegRdl', 'kbSwingSingle', 'kbSnatch', 'hipThrust',
             'frogPump', 'gluteKickback', 'fireHydrant', 'sealJack',
             'jackSquat', 'buttKicks', 'skiJump', 'tuckJump', 'broadJump',
             'lateralShuffle', 'shuttleRun', 'doubleUnder', 'burpeeBroadJump'],
    'torso': ['plank', 'plankShoulderTaps', 'mountainClimber', 'hollow',
              'vSit', 'deadBug', 'birdDog', 'legRaise', 'flutterKicks',
              'bicycleCrunch', 'russianTwist', 'sideBridge', 'superman',
              'inchworm', 'ringTuckHold',
              # expanded library
              'plankReach', 'plankJack', 'bearHold', 'vUp', 'tuckUp', 'crunch',
              'reverseCrunch', 'sidePlankHold', 'sidePlankThread', 'crabWalk',
              'crabReach', 'mountainClimberCross', 'bearCrawlLateral',
              'inchwormPushup', 'squatThrust', 'kbSuitcaseHold', 'kbWindmill',
              'halfGetup', 'dbWoodchop'],
}
ROLE_OF = {b: role for role, bases in ACTIVE.items() for b in bases}
_UNTAGGED = sorted(set(POSES) - set(ROLE_OF))

# ---------------------------------------------------------------- main
def preview(out_dir, bases):
    """Write v2-style SVGs for a few exercises without touching img/."""
    os.makedirs(out_dir, exist_ok=True)
    order = sorted(POSES)
    for base in bases:
        _CTX['active'] = {ROLE_OF.get(base)}
        _CTX['variant'] = 'a' if order.index(base) % 2 == 0 else 'b'
        with open(os.path.join(out_dir, f'{base}.svg'), 'w') as f:
            f.write(render_exercise(base))
    print(f'wrote {len(bases)} preview SVGs to {out_dir}')

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 2 and sys.argv[1] == '--preview':
        # python3 scripts/gen-anims.py --preview <dir> pushup kbSwing ...
        preview(sys.argv[2], sys.argv[3:])
        raise SystemExit
    os.makedirs(OUT, exist_ok=True)
    for stale in os.listdir(OUT):
        os.remove(os.path.join(OUT, stale))
    total = 0
    for idx, (base, fn) in enumerate(sorted(POSES.items())):
        _CTX['active'] = {ROLE_OF.get(base)}
        _CTX['variant'] = 'a' if idx % 2 == 0 else 'b'   # mix of body types
        try:
            out = render_exercise(base)
        except ValueError as e:
            raise SystemExit(f'{base}: {e}, every key pose must use the same '
                             f'number of arm/leg chains and decorations')
        path = os.path.join(OUT, f'{base}.svg')
        with open(path, 'w') as f:
            f.write(out)
        total += os.path.getsize(path)
    print(f'wrote {len(POSES)} animated SVGs, {total / 1024:.0f} KB total')
    if _UNTAGGED:
        print(f'warning: no ACTIVE muscle group for {", ".join(_UNTAGGED)} '
              f', so they render without the rose highlight')
