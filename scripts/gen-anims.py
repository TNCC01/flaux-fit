#!/usr/bin/env python3
"""Generate the stick-figure exercise demo SVGs for FIT.

Each exercise gets two poses (start / end position) written to
img/exercises/<base>-0.svg and <base>-1.svg; the app cross-fades them.
Figures are drawn in the app palette: teal figure, amber equipment,
transparent background. Re-run after editing poses:  python3 scripts/gen-anims.py
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

# ---------------------------------------------------------------- svg bits
def line(pts, color=TEAL, w=SW, opacity=1.0):
    d = 'M' + ' L'.join(f'{x:.0f},{y:.0f}' for x, y in pts)
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" '
            f'stroke-linecap="round" stroke-linejoin="round" opacity="{opacity}"/>')

def circle(c, r, color=TEAL, fill=True, w=SW * 0.7, opacity=1.0):
    f = color if fill else 'none'
    s = 'none' if fill else color
    return (f'<circle cx="{c[0]:.0f}" cy="{c[1]:.0f}" r="{r}" fill="{f}" '
            f'stroke="{s}" stroke-width="{w}" opacity="{opacity}"/>')

def ground(x0=40, x1=440):
    return line([(x0, GY), (x1, GY)], BORDER, 6)

def figure(head, neck, hip, arms, legs, head_r=HEAD_R):
    """arms/legs: list of point-chains starting at the shoulder / hip.
    The first chain is the far-side limb (dimmed), last is near side."""
    out = []
    n = len(arms)
    for i, a in enumerate(arms):
        out.append(line([neck] + list(a), TEAL_DIM if (n > 1 and i == 0) else TEAL))
    n = len(legs)
    for i, l in enumerate(legs):
        out.append(line([hip] + list(l), TEAL_DIM if (n > 1 and i == 0) else TEAL))
    out.append(line([neck, hip]))                 # torso on top of limb joins
    out.append(circle(head, head_r))
    return out

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

def box(x, y, w, h):
    return [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" '
            f'fill="none" stroke="{BORDER}" stroke-width="6"/>']

def rings(hands):
    out = []
    for hx, hy in hands:
        out.append(line([(hx, 0), (hx, hy - 10)], AMBER, 4))
        out.append(circle((hx, hy), 10, AMBER, fill=False, w=5))
    return out

def svg(parts):
    body = '\n'.join(p for chunk in parts for p in (chunk if isinstance(chunk, list) else [chunk]))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">\n{body}\n</svg>\n')

# ---------------------------------------------------------------- poses
POSES = {}
def pose(base):
    def deco(fn):
        POSES[base] = fn
        return fn
    return deco

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

@pose('cossackSquat')
def _(i):
    # front view: deep squat over one leg, other leg straight out
    x = 240
    s = 1 if i == 0 else -1
    hip = (x - 55 * s, 232)
    neck = (x - 48 * s, 152)
    head = (x - 48 * s, 124)
    legs = [[(x - 82 * s, 250), (x - 88 * s, GY)],          # bent support leg
            [(x + 30 * s, 275), (x + 105 * s, GY - 2)]]     # straight leg
    arms = [[(x - 10 * s, 165), (x + 20 * s, 172)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

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
    if i == 1:
        f['arms'] = [[(225 + 78, GY)], [(225 + 96, 210)]]
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

@pose('inchworm')
def _(i):
    x = 240
    if i == 0:
        neck = (x - 20, 210)
        head = (x - 26, 236)
        hip = (x + 26, 168)
        arms = [[(x - 52, GY)]]
        legs = [[(x + 28, 232), (x + 30, GY)]]
        return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]
    return [ground(), figure(**_plank())]

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

@pose('skaterHops')
def _(i):
    # front view leaping side to side
    x = 240
    s = 1 if i == 0 else -1
    neck = (x + 30 * s, 128)
    head = (x + 34 * s, 100)
    hip = (x + 44 * s, 198)
    legs = [[(x + 4 * s, 244), (x - 34 * s, 224)],          # trailing leg crossed behind
            [(x + 62 * s, 244), (x + 66 * s, GY)]]
    arms = [[(x - 8 * s, 150), (x - 40 * s, 138)]]
    return [ground(), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

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

@pose('burpee')
def _(i):
    if i == 0:
        f = _stand(arm='up')
        return [ground(), figure(**f)]
    return [ground(), figure(**_plank())]

@pose('ropeJumping')
def _(i):
    x = 240
    if i == 0:
        f = _stand(x)
        f['arms'] = [[(x - 30, 160), (x - 52, 178)], [(x + 30, 160), (x + 52, 178)]]
        rope = f'<path d="M{x-52},178 Q{x},{GY+18} {x+52},178" fill="none" stroke="{AMBER}" stroke-width="4"/>'
        return [ground(), figure(**f), rope]
    lift = 22
    neck, hip = (x, 118 - lift), (x, 192 - lift)
    head = (x + 2, 90 - lift)
    legs = [[(x - 6, 236 - lift), (x - 10, 272 - lift)], [(x + 8, 236 - lift), (x + 4, 272 - lift)]]
    arms = [[(x - 30, 160 - lift), (x - 52, 148 - lift)], [(x + 30, 160 - lift), (x + 52, 148 - lift)]]
    rope = f'<path d="M{x-52},{148-lift} Q{x},{20} {x+52},{148-lift}" fill="none" stroke="{AMBER}" stroke-width="4"/>'
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
    neck, head = (x, 128), (x, 156)   # hanging: head below hands? no—head above neck
    neck, head = (x, 140), (x, 114)
    hip = (x, 214)
    arms = [[hands[0]], [hands[1]]]
    legs = [[(x + 34, 226 - tuck), (x + 40, 252 - tuck)],
            [(x + 38, 230 - tuck), (x + 46, 256 - tuck)]]
    return [rings(hands), figure(head=head, neck=neck, hip=hip, arms=arms, legs=legs)]

# ---------------------------------------------------------------- main
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for base, fn in sorted(POSES.items()):
        for i in (0, 1):
            with open(os.path.join(OUT, f'{base}-{i}.svg'), 'w') as f:
                f.write(svg(fn(i)))
    print(f'wrote {len(POSES)} exercises × 2 poses to {OUT}')
