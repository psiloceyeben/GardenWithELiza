"""Village-era additions to the sprite generator: ordered tile strip with biome palette swaps,
plaza props, farmer colour variants, NPC. Imported by gen.py main()."""
import math, random
from gen import Canvas, PAL, tile as base_tile, eye, farmer as base_farmer, gnome, pack

# Tile order is the tilemap index. MUST match shared/world.ts TILE list.
TILE_ORDER = ['grass', 'grass2', 'soil', 'plot', 'path', 'hedge', 'water', 'stone',
              'flowers', 'cobble', 'fence_h', 'fence_v', 'gate_open', 'gate_closed', 'grass3', 'water2']

# biome id -> remap of the green family (+ optional flower colours). Names are cosmetic copy (I-9: abstract only).
BIOMES = [
    ('verdant',        {}),
    ('molten_meadow',  {'g': 'O', 'G': 'o', 'L': 'y', 'l': 'Y'}),
    ('static_bog',     {'g': 'T', 'G': 't', 'L': 's', 'l': 'W'}),
    ('sugar_hollow',   {'g': 'P', 'G': 'm', 'L': 'p', 'l': 'W'}),
    ('dusk_flats',     {'g': 'v', 'G': 'P', 'L': 'm', 'l': 'p'}),
    ('frost_ridge',    {'g': 'C', 'G': 'c', 'L': 'W', 'l': 'w'}),
    ('ash_yard',       {'g': 'S', 'G': 's', 'L': 'W', 'l': 'w', '4': '3', '5': '4'}),
    ('neon_marsh',     {'g': 'n', 'G': 'C', 'L': 'm', 'l': 'c'}),
]


def tile(kind, seed=1):
    if kind in ('grass', 'grass2', 'soil', 'plot', 'path', 'hedge', 'water', 'stone'):
        return base_tile(kind, seed)
    cv = Canvas(32, 32); rnd = random.Random(seed)
    if kind == 'grass3':
        cv = base_tile('grass', seed + 40)
        for _ in range(4): x, y = rnd.randrange(28), rnd.randrange(28); cv.rect(x, y, 3, 1, 'g'); cv.rect(x + 1, y - 1, 1, 1, 'g')
    elif kind == 'flowers':
        cv = base_tile('grass', seed + 50)
        for _ in range(6):
            x, y = rnd.randrange(2, 29), rnd.randrange(2, 29); c = rnd.choice('pYwr')
            cv.set(x, y, c); cv.set(x + 1, y, c); cv.set(x, y + 1, c); cv.set(x + 1, y + 1, c); cv.set(x, y + 2, 'g')
    elif kind == 'cobble':
        cv.rect(0, 0, 32, 32, 'S')
        for y in range(0, 32, 8):
            for x in range(0, 32, 8):
                cv.rect(x + 1 + (y // 8 % 2) * 2, y + 1, 5, 5, 's'); cv.set(x + 2 + (y // 8 % 2) * 2, y + 2, 'W')
    elif kind == 'water2':
        cv = base_tile('water', seed)
        for y in range(7, 32, 8):
            for x in range(4, 32, 9): cv.rect((x + y) % 32, y, 3, 1, 'c')
    elif kind in ('fence_h', 'gate_open', 'gate_closed'):
        cv = base_tile('grass', seed + 60)
        if kind == 'fence_h':
            cv.rect(2, 10, 4, 18, 'B'); cv.rect(26, 10, 4, 18, 'B'); cv.rect(0, 14, 32, 3, 'b'); cv.rect(0, 22, 32, 3, 'b')
            cv.rect(2, 10, 4, 1, 'b'); cv.rect(26, 10, 4, 1, 'b')
        elif kind == 'gate_closed':
            cv.rect(2, 8, 4, 20, 'B'); cv.rect(26, 8, 4, 20, 'B'); cv.rect(6, 12, 20, 3, 'D'); cv.rect(6, 20, 20, 3, 'D'); cv.rect(14, 8, 4, 20, 'D')
            cv.set(7, 13, 's'); cv.set(7, 21, 's'); cv.set(24, 13, 's'); cv.set(24, 21, 's')
        else:
            cv.rect(2, 8, 4, 20, 'B'); cv.rect(26, 8, 4, 20, 'B'); cv.rect(2, 8, 4, 1, 'b'); cv.rect(26, 8, 4, 1, 'b')
            for y in range(14, 26, 3): cv.set(15, y, 'E'); cv.set(16, y, 'E')  # trodden gap
    elif kind == 'fence_v':
        cv = base_tile('grass', seed + 61)
        cv.rect(14, 0, 4, 32, 'b'); cv.rect(13, 2, 6, 4, 'B'); cv.rect(13, 26, 6, 4, 'B'); cv.rect(12, 14, 8, 3, 'B')
    return cv


def remapped(cv, mapping):
    n = Canvas(cv.w, cv.h)
    for y in range(cv.h):
        for x in range(cv.w):
            ch = cv.px[y][x]; n.px[y][x] = mapping.get(ch, ch)
    return n


def plaza(kind):
    if kind.startswith('fountain'):
        cv = Canvas(64, 64); fr = int(kind[-1])
        cv.ellipse(32, 46, 28, 12, 's'); cv.ellipse(32, 46, 24, 9, 'S'); cv.ellipse(32, 45, 21, 7, 'C')
        for i in range(10):
            a = i / 10 * 6.283 + fr * 0.3; cv.set(32 + round(17 * math.cos(a)), 45 + round(5 * math.sin(a)), 'c')
        cv.rect(29, 20, 6, 26, 's'); cv.ellipse(32, 20, 9, 4, 's'); cv.ellipse(32, 19, 6, 2, 'C')
        cv.rect(31, 6, 2, 14, 'c');
        for dx, dy in ((-6, 8), (6, 8), (-9, 14), (9, 14), (-3, 4 + fr * 2), (3, 4 + fr * 2)): cv.rect(32 + dx, dy, 2, 2, 'c')
        cv.outline(); return cv
    if kind.startswith('lamp'):
        cv = Canvas(32, 48); lit = kind.endswith('1')
        cv.rect(14, 12, 4, 32, 'S'); cv.rect(11, 42, 10, 4, 'S'); cv.rect(10, 4, 12, 10, 'D'); cv.rect(12, 6, 8, 6, 'Y' if lit else 'S'); cv.rect(13, 2, 6, 2, 'D')
        if lit: cv.set(11, 7, 'y'); cv.set(20, 7, 'y'); cv.set(15, 15, 'y')
        cv.outline(); return cv
    cv = Canvas(64, 48)
    if kind == 'bench':
        cv.rect(8, 22, 48, 5, 'b'); cv.rect(8, 14, 48, 4, 'b'); cv.rect(8, 18, 48, 1, 'B'); cv.rect(10, 27, 4, 8, 'B'); cv.rect(50, 27, 4, 8, 'B'); cv.rect(10, 8, 4, 14, 'B'); cv.rect(50, 8, 4, 14, 'B')
    elif kind == 'board':
        cv.rect(10, 6, 44, 28, 'B'); cv.rect(12, 8, 40, 24, 'W'); cv.rect(14, 34, 4, 12, 'D'); cv.rect(46, 34, 4, 12, 'D')
        for y in range(11, 30, 4): cv.rect(15, y, 22 + (y % 8), 1, 'S')
        cv.rect(40, 10, 8, 6, 'r'); cv.rect(41, 11, 6, 4, 'p')
    elif kind == 'stall':
        cv.rect(6, 4, 52, 8, 'r');
        for x in range(6, 58, 8): cv.rect(x, 4, 4, 8, 'W')
        cv.rect(8, 12, 48, 3, 'D'); cv.rect(10, 15, 3, 24, 'B'); cv.rect(51, 15, 3, 24, 'B'); cv.rect(8, 30, 48, 12, 'b'); cv.rect(8, 30, 48, 2, 'B')
        for i, c in enumerate('GoYpr'): cv.ellipse(18 + i * 8, 26, 3, 2.5, c)
    elif kind == 'sign':
        cv = Canvas(32, 32); cv.rect(4, 6, 24, 12, 'b'); cv.rect(5, 7, 22, 10, 'B'); cv.rect(14, 18, 4, 12, 'D'); cv.rect(7, 9, 18, 1, 'W'); cv.rect(7, 12, 12, 1, 'W')
    elif kind == 'track':
        cv = Canvas(64, 32); cv.rect(0, 0, 64, 32, 'E'); cv.rect(0, 4, 64, 2, 'W'); cv.rect(0, 26, 64, 2, 'W')
        for x in range(0, 64, 12): cv.rect(x, 15, 6, 2, 'W')
        return cv
    elif kind == 'pot':
        cv = Canvas(32, 32); cv.rect(10, 18, 12, 10, 'O'); cv.rect(9, 16, 14, 3, 'o'); cv.ellipse(16, 12, 6, 5, 'G'); cv.rect(13, 8, 2, 2, 'r'); cv.rect(18, 10, 2, 2, 'Y')
    cv.outline(); return cv


def farmer(direction, frame, carry=False, shirt='C'):
    cv = base_farmer(direction, frame, carry)
    return remapped(cv, {'C': shirt}) if shirt != 'C' else cv


def npc(frame):
    cv = Canvas(32, 32); bob = -1 if frame else 0
    cv.rect(11, 14 + bob, 10, 8, 'r'); cv.rect(12, 22 + bob, 8, 5, 'D'); cv.rect(12, 27, 3, 3, 'K'); cv.rect(17, 27, 3, 3, 'K')
    cv.rect(9, 14 + bob, 2, 6, 'r'); cv.rect(21, 14 + bob, 2, 6, 'r'); cv.rect(9, 20 + bob, 2, 2, 'e'); cv.rect(21, 20 + bob, 2, 2, 'e')
    cv.rect(12, 8 + bob, 8, 6, 'e'); eye(cv, 13, 10 + bob); eye(cv, 17, 10 + bob); cv.rect(14, 13 + bob, 4, 1, 'K')
    cv.rect(11, 5 + bob, 10, 3, 'W'); cv.rect(13, 3 + bob, 6, 2, 'W'); cv.rect(12, 8 + bob, 8, 1, 'D')
    cv.outline(); return cv


SHIRTS = ['C', 'r', 'G', 'P', 'o', 't']


def build(out):
    base = [(k, tile(k, i + 1)) for i, k in enumerate(TILE_ORDER)]
    for bi, (name, mp) in enumerate(BIOMES):
        pack([(k, remapped(cv, mp)) for k, cv in base], 32, 32, 16, f'tiles_b{bi}', out)
    chars = []
    for v, shirt in enumerate(SHIRTS):
        for d in ('down', 'up', 'side'):
            for fr in range(2): chars.append((f"farmer{v}_{d}{fr}", farmer(d, fr, shirt=shirt)))
        for fr in range(2): chars.append((f"farmer{v}_carry{fr}", farmer('down', fr, carry=True, shirt=shirt)))
    for fr in range(3): chars.append((f"gnome{fr}", gnome(fr)))
    for fr in range(2): chars.append((f"npc{fr}", npc(fr)))
    pack(chars, 32, 32, 8, 'chars', out)
    pk = [(k, plaza(k)) for k in ('fountain0', 'fountain1', 'lamp0', 'lamp1', 'bench', 'board', 'stall', 'sign', 'track', 'pot')] + [(f'decor{i}', decor(i)) for i in range(3)]
    pack(pk, 64, 64, 5, 'plaza', out)
    return len(base), len(BIOMES), len(chars), len(pk)


def decor(i):
    """Exotic background flora for stock decor (I-3): pure scenery, original designs."""
    cv = Canvas(32, 48)
    if i == 0:  # crystal fern
        for dx, h in ((-6, 14), (-2, 20), (3, 18), (7, 12)):
            cv.line(16, 44, 16 + dx, 44 - h, 'c'); cv.line(16 + dx, 44 - h, 16 + dx + (1 if dx > 0 else -1), 44 - h - 3, 'w')
        cv.ellipse(16, 44, 5, 2, 'T')
    elif i == 1:  # glow cap
        cv.rect(14, 30, 4, 14, 'W'); cv.ellipse(16, 29, 9, 5, 'm', top_only=True); cv.rect(7, 29, 19, 2, 'm')
        for dx, dy in ((-5, -2), (0, -4), (5, -1)): cv.rect(16 + dx, 29 + dy, 2, 2, 'Y')
    else:  # spiral reed
        for y in range(44, 14, -1):
            cv.set(16 + round(4 * math.sin((44 - y) / 3.0)), y, 't'); cv.set(17 + round(4 * math.sin((44 - y) / 3.0)), y, 'T')
        cv.ellipse(16, 14, 3, 2, 'p'); cv.ellipse(16, 44, 5, 2, 'g')
    cv.outline(); return cv
