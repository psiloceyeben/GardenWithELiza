#!/usr/bin/env python3
"""Pons Garden pixel-art generator.

Every sprite is drawn on a small character grid indexed into one 32-colour master
palette (PAL), then packed into PNG atlases + Phaser JSON-hash atlas files.
Plants are parametric bodies (kind + colours) with hand-authored face/gag stamps.

Usage: python3 gen.py <out_dir>        (writes plants/tiles/chars/props/ui .png+.json, preview.png)
"""
import json, os, sys, random
from PIL import Image

# ---------------------------------------------------------------- palette
PAL = {
    '_': None,
    'K': (24, 18, 30),    'S': (68, 64, 80),    's': (140, 136, 150), 'w': (255, 255, 255), 'W': (240, 232, 210),
    'D': (72, 44, 28),    'B': (120, 78, 44),   'b': (188, 140, 90),  'e': (232, 200, 160), 'E': (200, 160, 120),
    '3': (58, 38, 30),    '4': (96, 64, 44),    '5': (132, 92, 60),
    'g': (36, 92, 48),    'G': (70, 150, 64),   'L': (140, 210, 90),  'l': (196, 236, 140),
    'y': (222, 190, 60),  'Y': (250, 230, 110), '1': (240, 196, 52),  '2': (176, 130, 24),
    'o': (232, 130, 40),  'O': (180, 84, 24),   'r': (208, 52, 52),   'R': (140, 28, 40),
    'p': (240, 150, 180), 'P': (150, 70, 180),  'v': (90, 40, 130),   'm': (220, 120, 230),
    'c': (120, 200, 240), 'C': (60, 120, 220),  'n': (30, 50, 110),   't': (60, 170, 160), 'T': (30, 110, 110),
}
assert len(PAL) >= 33  # '_' + at least 32 colours


def lum(ch):
    r, g, b = PAL[ch]
    return 0.3 * r + 0.59 * g + 0.11 * b


# ---------------------------------------------------------------- canvas
class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [['_'] * w for _ in range(h)]

    def get(self, x, y):
        return self.px[y][x] if 0 <= x < self.w and 0 <= y < self.h else '_'

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h and c != '_':
            self.px[y][x] = c

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)

    def ellipse(self, cx, cy, rx, ry, c, top_only=False, bottom_only=False):
        rx = max(rx, 0.5); ry = max(ry, 0.5)
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            if top_only and y > cy: continue
            if bottom_only and y < cy: continue
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                    self.set(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.set(x0, y0, c)
            if x0 == x1 and y0 == y1: break
            e2 = 2 * err
            if e2 >= dy: err += dy; x0 += sx
            if e2 <= dx: err += dx; y0 += sy

    def vline_within(self, x, y0, y1, c):
        """Paint only over existing (non-transparent) pixels: stripes/ridges."""
        for y in range(y0, y1 + 1):
            if self.get(x, y) != '_': self.set(x, y, c)

    def tri_up(self, cx, base_y, hw, h, c):
        for i in range(h + 1):
            y = base_y - h + i
            w = round(hw * i / max(h, 1))
            self.rect(cx - w, y, 2 * w + 1, 1, c)

    def tri_down(self, cx, top_y, hw, h, c):
        for i in range(h + 1):
            y = top_y + i
            w = round(hw * (h - i) / max(h, 1))
            self.rect(cx - w, y, 2 * w + 1, 1, c)

    def stamp(self, rows, x, y):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '_': self.set(x + i, y + j, ch)

    def outline(self, c='K'):
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x] == '_':
                    if any(self.get(x + dx, y + dy) not in ('_',) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        add.append((x, y))
        for x, y in add: self.px[y][x] = c

    def remap(self, fn):
        for y in range(self.h):
            for x in range(self.w):
                ch = self.px[y][x]
                if ch != '_': self.px[y][x] = fn(ch)

    def shifted(self, dx, dy):
        n = Canvas(self.w, self.h)
        for y in range(self.h):
            for x in range(self.w):
                n.set(x + dx, y + dy, self.px[y][x])
        return n

    def blit(self, other, x, y):
        for yy in range(other.h):
            for xx in range(other.w):
                self.set(x + xx, y + yy, other.px[yy][xx])

    def to_image(self):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        p = im.load()
        for y in range(self.h):
            for x in range(self.w):
                col = PAL[self.px[y][x]]
                if col: p[x, y] = col + (255,)
        return im


# ---------------------------------------------------------------- face + gags
def eye(cv, x, y, blink=False):
    if blink:
        cv.set(x, y + 1, 'K'); cv.set(x + 1, y + 1, 'K'); return
    cv.set(x, y, 'w'); cv.set(x + 1, y, 'K'); cv.set(x, y + 1, 'K'); cv.set(x + 1, y + 1, 'K')


def face(cv, cx, cy, frame, gap=3, mouth='flat', blink=True, narrow=False):
    b = blink and frame == 4
    lx, rx = cx - gap - 1, cx + gap - 1
    if narrow:
        cv.set(lx, cy, 'K'); cv.set(lx + 1, cy, 'K'); cv.set(rx, cy, 'K'); cv.set(rx + 1, cy, 'K')
        cv.set(lx, cy + 1, 'w'); cv.set(rx + 1, cy + 1, 'w')
    else:
        eye(cv, lx, cy, b); eye(cv, rx, cy, b)
    my = cy + 3
    if mouth == 'flat': cv.rect(cx - 1, my, 3, 1, 'K')
    elif mouth == 'smile': cv.set(cx - 2, my - 1, 'K'); cv.rect(cx - 1, my, 3, 1, 'K'); cv.set(cx + 2, my - 1, 'K')
    elif mouth == 'frown': cv.set(cx - 2, my + 1, 'K'); cv.rect(cx - 1, my, 3, 1, 'K'); cv.set(cx + 2, my + 1, 'K')
    elif mouth == 'o': cv.rect(cx - 1, my - 1, 2, 2, 'K')
    elif mouth == 'none': pass


BOB = [0, 0, -1, -1, 0, 0]


def gag(cv, name, cx, cy, frame, V):
    """Idle gag overlay. (cx,cy) = face centre."""
    if name == 'eyebrow':
        up = 2 if frame in (2, 3) else 0
        cv.rect(cx, cy - 3 - up, 6, 2, 'K')
        cv.set(cx + 6, cy - 2 - up, 'K')
    elif name == 'tear':
        cv.set(cx - 4, cy + 2 + (frame % 4), 'c')
        if frame >= 3: cv.rect(cx - 5, cy + 6, 2, 1, 'c')
        cv.rect(11, 43, 10, 1, 'c') if frame >= 2 else None
    elif name == 'watch':
        ax = cx + 6
        raised = frame in (2, 3)
        ay = cy + (1 if raised else 5)
        cv.line(ax, cy + 6, ax + (0 if raised else 2), ay, 'K')
        cv.rect(ax - 1 + (0 if raised else 2), ay - 2, 3, 3, 'K'); cv.set(ax + (0 if raised else 2), ay - 1, 'w')
    elif name == 'briefcase':
        cv.rect(cx + 6, 34, 6, 5, 'D'); cv.rect(cx + 8, 33, 2, 1, 'D'); cv.set(cx + 8, 36, '1')
        if frame in (4, 5): cv.set(cx + 9, 35, 'K')  # tug
    elif name == 'sword':
        sx = cx + 7; tilt = 1 if frame in (2, 3) else 0
        cv.line(sx, cy + 8, sx + tilt, cy - 2, 'w'); cv.rect(sx - 1, cy + 6, 3, 1, '1'); cv.set(sx, cy + 8, 'B')
    elif name == 'sweat':
        if frame in (2, 3, 4): cv.set(cx + 6, cy - 2 + (frame - 2), 'c'); cv.set(cx + 6, cy - 1 + (frame - 2), 'c')
    elif name == 'snore':
        if frame in (3, 4, 5): cv.stamp(["KKK", "_K_", "KKK"], cx + 6, cy - 8 - (frame - 3))
    elif name == 'crown':
        cv.rect(cx - 3, cy - 8, 7, 2, '1'); cv.set(cx - 3, cy - 9, '1'); cv.set(cx, cy - 9, '1'); cv.set(cx + 3, cy - 9, '1'); cv.set(cx, cy - 8, 'r')
    elif name == 'monocle':
        cv.rect(cx + 2, cy - 1, 4, 4, 'K'); cv.rect(cx + 3, cy, 2, 2, 'c'); cv.line(cx + 5, cy + 3, cx + 6, cy + 6 - (1 if frame in (2, 3) else 0), 'K')
    elif name == 'clipboard':
        cv.rect(cx + 6, cy, 5, 7, 'b'); cv.rect(cx + 7, cy + 1, 3, 5, 'W'); cv.rect(cx + 7, cy - 1, 3, 1, 'S')
        if frame in (2, 3, 4): cv.set(cx + 8, cy + 2 + (frame - 2), 'K')
    elif name == 'wave':
        hx = cx + 7; hy = cy + (0 if frame in (2, 3) else 2)
        cv.line(hx, cy + 6, hx + 1, hy, V.get('body', 'w')); cv.rect(hx, hy - 2, 2, 2, V.get('body', 'w'))
    elif name == 'fold':
        cv.rect(cx - 6, cy + 5, 12, 2, 'G')
        if frame in (3, 4): cv.set(cx - 7, cy + 6, 'K'); cv.set(cx + 6, cy + 6, 'K')


# ---------------------------------------------------------------- plant bodies
# each returns (face_cx, face_cy, gap)
def b_sprout(cv, f, V, fr):
    H = int(20 * f); top = 44 - H
    cv.rect(15, top, 2, H, V['body2'])
    ly = 44 - int(H * 0.45)
    cv.ellipse(11.5, ly, 3.5, 2, V['body']); cv.ellipse(19.5, ly, 3.5, 2, V['body'])
    rx = int(7 * f) + 2; ry = int(5 * f) + 2
    cv.ellipse(16, top - ry + 3, rx, ry, V["body"])
    return 16, top - ry + 3, 3


def b_melon(cv, f, V, fr):
    rx = int(9 * f) + 3; ry = int(8 * f) + 3; cy = 44 - ry
    cv.ellipse(16, cy, rx, ry, V['body'])
    for dx in (-rx // 2, 0, rx // 2): cv.vline_within(16 + dx, cy - ry, cy + ry, V['body2'])
    cv.rect(15, cy - ry - 1, 2, 3, 'B')
    return 16, cy - 1, 3


def b_carrot(cv, f, V, fr):
    W = int(6 * f) + 3; H = int(20 * f) + 4; top = 44 - H
    for y in range(top, 45):
        hw = round(W * (44 - y) / H)
        cv.rect(16 - hw, y, 2 * hw + 1, 1, V['body'])
    for y in range(top + 2, 44, 4): cv.vline_within(16 - round(W * (44 - y) / H) + 1, y, y, V['body2'])
    for dx, h in ((-3, 5), (0, 7), (3, 5)): cv.line(16 + dx // 2, top, 16 + dx, top - h, 'G')
    if f >= 1.0:  # suit: lapels + tie
        cv.rect(12, top + 8, 9, 6, 'S'); cv.rect(15, top + 8, 3, 6, V['body']); cv.rect(16, top + 9, 1, 4, 'r')
    return 16, top + 4, 2


def b_mushroom(cv, f, V, fr):
    sw = int(3 * f) + 2; sh = int(10 * f) + 4
    cv.rect(16 - sw, 44 - sh, 2 * sw + 1, sh, V['body'])
    rx = int(9 * f) + 4; ry = int(5 * f) + 3; cy = 44 - sh - 1
    cv.ellipse(16, cy, rx, ry, V['cap'], top_only=True)
    cv.rect(16 - rx, cy, 2 * rx + 1, 2, V['cap'])
    for dx, dy in ((-5, -3), (2, -4), (6, -1), (-2, 0)): cv.rect(16 + dx, cy + dy, 2, 2, V['capdot'])
    for x in (16 - sw + 1, 16 + sw - 1): cv.set(x, 43, 'c')  # damp
    return 16, 44 - sh + 4, 2


def b_orchid(cv, f, V, fr):
    fh = int(14 * f) + 6; top = 44 - int(22 * f) - 6; base = top + fh
    for cx in (10, 22):
        cv.tri_up(cx, base, 6, fh, V["body"]); cv.line(cx, base, cx, base - fh + 2, V['body2'])
    slip = 2 if fr in (3, 4) else 0
    cw = int(9 * f) + 4; cy = base + 1 + slip
    cv.rect(16 - cw, cy, 2 * cw + 1, 44 - cy, V['coat'])
    cv.line(16 - cw, cy, 16, cy + 5, 'D'); cv.line(16 + cw, cy, 16, cy + 5, 'D')
    for y in range(cy + 6, 43, 3): cv.set(16, y, 'K')
    return 16, base - 8, 6


def b_potato(cv, f, V, fr):
    rx = int(9 * f) + 3; ry = int(7 * f) + 3; cy = 44 - ry
    cv.ellipse(16, cy, rx, ry, V['body'])
    rnd = random.Random(7)
    for _ in range(5): cv.rect(16 + rnd.randint(-rx + 2, rx - 3), cy + rnd.randint(-ry + 2, ry - 2), 2, 1, V['body2'])
    return 16, cy - 3, 3


def b_cactus(cv, f, V, fr):
    w = int(3 * f) + 2; H = int(20 * f) + 4; top = 44 - H
    cv.rect(16 - w, top, 2 * w + 1, H, V['body'])
    ay = 44 - int(H * 0.55)
    cv.rect(16 - w - 4, ay, 4, 3, V['body']); cv.rect(16 - w - 4, ay - 6, 3, 7, V['body'])
    cv.rect(16 + w + 1, ay + 2, 4, 3, V['body']); cv.rect(16 + w + 2, ay - 4, 3, 7, V['body'])
    for y in range(top + 2, 44, 3): cv.set(16 - w, y, 'W'); cv.set(16 + w, y + 1, 'W')
    return 16, top + 5, 2


def b_bulb(cv, f, V, fr):
    rx = int(7 * f) + 3; ry = int(6 * f) + 3; cy = 44 - ry
    cv.ellipse(16, cy, rx, ry, V['body']); cv.tri_up(16, cy - ry + 2, rx - 2, int(5 * f) + 3, V['body'])
    cv.line(16, cy - ry - int(5 * f) - 1, 17, cy - ry - int(5 * f) - 4, 'G')
    cv.vline_within(16 - rx // 2, cy - ry, cy + ry, V['body2']); cv.vline_within(16 + rx // 2, cy - ry, cy + ry, V['body2'])
    return 16, cy - 1, 3


def b_peapod(cv, f, V, fr):
    rx = int(5 * f) + 2; ry = int(11 * f) + 4; cy = 44 - ry
    cv.ellipse(16, cy, rx, ry, V['body'])
    for i in range(3): cv.ellipse(16, cy - ry + 5 + i * (ry * 2 - 8) // 2, 2, 2, V['body2'])
    return 16, cy - ry + 5, 2


def b_radish(cv, f, V, fr):
    r = int(7 * f) + 3; cy = 44 - r - 2
    cv.ellipse(16, cy, r, r, V['body']); cv.tri_down(16, cy + r - 1, 2, 3, 'W')
    for dx in (-3, 0, 3): cv.line(16, cy - r + 1, 16 + dx, cy - r - 4, 'G'); cv.ellipse(16 + dx, cy - r - 5, 1.5, 1.5, 'L')
    return 16, cy - 1, 3


def b_tulip(cv, f, V, fr):
    H = int(12 * f) + 4; top = 44 - H - int(8 * f) - 3
    cv.rect(15, 44 - H, 2, H, 'G'); cv.ellipse(11, 40, 3, 1.5, 'G')
    cw = int(5 * f) + 3; ch = int(6 * f) + 3
    cv.rect(16 - cw, top + 3, 2 * cw + 1, ch, V['body'])
    for cx in (16 - cw + 1, 16, 16 + cw - 1): cv.tri_up(cx, top + 3, 1, 3, V['body'])
    cv.vline_within(16 - cw // 2, top, 44, V['body2']); cv.vline_within(16 + cw // 2, top, 44, V['body2'])
    return 16, top + 5, 2


def b_corn(cv, f, V, fr):
    rx = int(5 * f) + 2; ry = int(11 * f) + 4; cy = 44 - ry
    cv.ellipse(16, cy, rx, ry, V['body'])
    for y in range(cy - ry + 1, cy + ry):
        for x in range(16 - rx, 16 + rx + 1):
            if (x + y) % 2 == 0 and cv.get(x, y) == V['body']: cv.set(x, y, V['body2'])
    cv.tri_up(16 - rx - 1, 44, 3, ry + 2, 'G'); cv.tri_up(16 + rx + 1, 44, 3, ry + 2, 'G')
    return 16, cy - 3, 2


def b_pumpkin(cv, f, V, fr):
    rx = int(11 * f) + 3; ry = int(7 * f) + 3; cy = 44 - ry
    cv.ellipse(16, cy, rx, ry, V['body'])
    for dx in (-rx * 2 // 3, -rx // 3, 0, rx // 3, rx * 2 // 3): cv.vline_within(16 + dx, cy - ry, cy + ry, V['body2'])
    cv.rect(15, cy - ry - 2, 3, 3, 'g')
    return 16, cy - 1, 3


def b_bush(cv, f, V, fr):
    rx = int(10 * f) + 3; ry = int(8 * f) + 3; cy = 44 - ry
    cv.ellipse(16, cy, rx, ry, V['body']); cv.ellipse(16 - rx // 2, cy - 1, rx // 2 + 1, ry - 2, V['body2']); cv.ellipse(16 + rx // 2, cy - 1, rx // 2 + 1, ry - 2, V['body2'])
    rnd = random.Random(3)
    for _ in range(6 + int(4 * f)):
        x, y = 16 + rnd.randint(-rx + 2, rx - 2), cy + rnd.randint(-ry + 2, ry - 2)
        if cv.get(x, y) != '_' and (x + y + fr // 3) % 2 == 0: cv.rect(x, y, 2, 2, 'r')
    return 16, cy - 1, 3


def b_sunflower(cv, f, V, fr):
    H = int(14 * f) + 5; r = int(4 * f) + 2; cy = 44 - H - r
    cv.rect(15, 44 - H, 2, H, 'G'); cv.ellipse(12, 44 - H // 2, 3, 1.5, 'G')
    for a in range(8):
        import math
        ax, ay = 16 + round((r + 3) * math.cos(a * math.pi / 4)), cy + round((r + 3) * math.sin(a * math.pi / 4))
        cv.ellipse(ax, ay, 2.5, 2.5, V['body'])
    cv.ellipse(16, cy, r, r, V['body2'])
    return 16, cy - 1, 2


def b_turnip(cv, f, V, fr):
    r = int(7 * f) + 3; cy = 44 - r - 1
    cv.ellipse(16, cy, r, r, V['body']); cv.ellipse(16, cy - r // 2, r - 1, r // 2 + 1, V['body2'], top_only=True)
    cv.tri_down(16, cy + r - 1, 1, 3, V['body'])
    for dx in (-2, 2): cv.line(16, cy - r + 1, 16 + dx, cy - r - 4, 'G')
    return 16, cy, 3


def b_flytrap(cv, f, V, fr):
    H = int(10 * f) + 4; jw = int(7 * f) + 3; jh = int(4 * f) + 2; cy = 44 - H
    cv.rect(15, cy, 2, H, 'g'); cv.ellipse(11, 41, 3, 1.5, 'G'); cv.ellipse(21, 41, 3, 1.5, 'G')
    opened = 3 if fr in (2, 3) else 1
    cv.ellipse(16, cy - jh - opened, jw, jh, V['body'], top_only=True); cv.rect(16 - jw, cy - jh - opened, 2 * jw + 1, 1, V['body'])
    cv.ellipse(16, cy - jh + opened, jw, jh, V['body2'], bottom_only=True); cv.rect(16 - jw, cy - jh + opened - 1, 2 * jw + 1, 1, V['body2'])
    for x in range(16 - jw + 1, 16 + jw, 3): cv.set(x, cy - jh - opened + 1, 'w'); cv.set(x + 1, cy - jh + opened - 2, 'w')
    return 16, cy - jh - opened - 3, 3


def b_pineapple(cv, f, V, fr):
    rx = int(6 * f) + 3; ry = int(9 * f) + 3; cy = 44 - ry
    cv.ellipse(16, cy, rx, ry, V['body'])
    for y in range(cy - ry, cy + ry + 1):
        for x in range(16 - rx, 16 + rx + 1):
            if (x + y) % 4 == 0 or (x - y) % 4 == 0:
                if cv.get(x, y) == V['body']: cv.set(x, y, V['body2'])
    for dx, h in ((-4, 6), (-1, 9), (2, 8), (5, 6)): cv.tri_up(16 + dx, cy - ry + 2, 1, h, 'G')
    return 16, cy - 2, 3


def b_eggplant(cv, f, V, fr):
    rx = int(6 * f) + 2; ry = int(10 * f) + 4; hover = 1 if fr in (1, 2, 3) else 0; cy = 44 - ry - 1 - hover
    cv.ellipse(16, cy, rx, ry, V['body']); cv.ellipse(16 - rx // 2, cy - ry // 2, 1.5, 3, V['body2'])
    cv.tri_down(16, cy - ry - 1, rx - 1, 3, 'G'); cv.rect(15, cy - ry - 4, 2, 3, 'g')
    return 16, cy - 3, 2


def b_bamboo(cv, f, V, fr):
    for i, (dx, h) in enumerate(((-6, 16), (0, 22), (6, 18))):
        H = int(h * f) + 4; top = 44 - H
        cv.rect(16 + dx - 1, top, 3, H, V['body'])
        for y in range(top + 4, 44, 5): cv.rect(16 + dx - 1, y, 3, 1, V['body2'])
        cv.ellipse(16 + dx + 3, top + 3, 2.5, 1, 'L')
    return 16, 44 - int(22 * f) - 4 + 6, 2


KINDS = {
    'sprout': b_sprout, 'melon': b_melon, 'carrot': b_carrot, 'mushroom': b_mushroom, 'orchid': b_orchid,
    'potato': b_potato, 'cactus': b_cactus, 'bulb': b_bulb, 'peapod': b_peapod, 'radish': b_radish,
    'tulip': b_tulip, 'corn': b_corn, 'pumpkin': b_pumpkin, 'bush': b_bush, 'sunflower': b_sunflower,
    'turnip': b_turnip, 'flytrap': b_flytrap, 'pineapple': b_pineapple, 'eggplant': b_eggplant, 'bamboo': b_bamboo,
}

# species visuals: kind, colours, idle gag, mouth. Keyed by roster id.
VIS = {
    'gorbulon_sprig':    dict(kind='sprout',    body='L', body2='G', gag='eyebrow',   mouth='smile'),
    'plain_gerald':      dict(kind='bulb',      body='W', body2='E', gag='blink',     mouth='flat'),
    'bogwort':           dict(kind='peapod',    body='G', body2='L', gag='shiver',    mouth='frown'),
    'concerned_radish':  dict(kind='radish',    body='r', body2='R', gag='sweat',     mouth='frown'),
    'weeping_wumbus':    dict(kind='melon',     body='G', body2='g', gag='tear',      mouth='frown'),
    'clammy_pete':       dict(kind='cactus',    body='G', body2='g', gag='sweat',     mouth='smile'),
    'low_ambition_tulip': dict(kind='tulip',    body='p', body2='m', gag='snore',     mouth='flat'),
    'corn_that_knows':   dict(kind='corn',      body='Y', body2='y', gag='narrow',    mouth='flat'),
    'unlicensed_carrot': dict(kind='carrot',    body='o', body2='O', gag='watch',     mouth='flat', extra='briefcase'),
    'pumpkin_esquire':   dict(kind='pumpkin',   body='o', body2='O', gag='monocle',   mouth='flat'),
    'bartholomew_bean':  dict(kind='bush',      body='g', body2='G', gag='shake',     mouth='smile'),
    'sunflower_who_lied': dict(kind='sunflower', body='Y', body2='B', gag='glance',   mouth='flat'),
    'sir_blombus':       dict(kind='mushroom',  body='b', body2='B', cap='r', capdot='W', gag='sword', mouth='smile'),
    'duchess_turnip':    dict(kind='turnip',    body='W', body2='P', gag='crown',     mouth='smile', extra='wave'),
    'grabby_bertrand':   dict(kind='flytrap',   body='G', body2='g', gag='none',      mouth='none'),
    'pineapple_enforcer': dict(kind='pineapple', body='y', body2='O', gag='fold',     mouth='flat'),
    'fraudulent_orchid': dict(kind='orchid',    body='G', body2='g', coat='B', gag='coat', mouth='none'),
    'lord_eggplant':     dict(kind='eggplant',  body='P', body2='m', gag='none',      mouth='smile'),
    'bamboo_inspector':  dict(kind='bamboo',    body='G', body2='g', gag='clipboard', mouth='flat'),
    'yelling_tuber':     dict(kind='potato',    body='b', body2='B', gag='yell',      mouth='yell'),
    'melonhound':        dict(kind='melon',     body='o', body2='r', gag='sweat',     mouth='smile'),
    'cactusberry_vicar': dict(kind='cactus',    body='P', body2='v', gag='crown',     mouth='flat'),
}


def mound(cv):
    cv.ellipse(16, 45, 9, 3, '4'); cv.ellipse(16, 45, 6, 1.5, '5')


def draw_plant(sid, stage, frame=0, wither=False):
    """stage 0..4 growth; stage 4 + frame = idle; wither draws the desaturated stump."""
    V = VIS[sid]; cv = Canvas(32, 48)
    if stage == 0:
        mound(cv); cv.rect(15, 41, 2, 2, 'D'); return cv
    if stage == 1:
        cv.rect(15, 36, 2, 8, 'G'); cv.ellipse(12.5, 38, 3, 1.5, 'L'); cv.ellipse(19.5, 37, 3, 1.5, 'L')
        cv.outline(); mound(cv); return cv
    f = {2: 0.5, 3: 0.75, 4: 1.0}[stage]
    fr = frame if stage == 4 else 0
    fx, fy, gap = KINDS[V['kind']](cv, f, V, fr)
    if V.get('extra') == 'briefcase' and stage == 4: gag(cv, 'briefcase', fx, fy, fr, V)
    cv.outline()
    if wither:
        cv.remap(lambda ch: 'K' if ch == 'K' else ('3' if lum(ch) < 90 else ('B' if lum(ch) < 170 else 'b')))
        cv = cv.shifted(0, 2)
        cv.stamp(["K_K", "_K_", "K_K"], fx - gap - 2, fy - 1); cv.stamp(["K_K", "_K_", "K_K"], fx + gap - 2, fy - 1)
        mound(cv); return cv
    mouth = V['mouth']
    if stage == 4 and V['gag'] == 'yell': mouth = 'o' if fr < 3 else 'none'
    if stage == 4 and V['gag'] == 'narrow': face(cv, fx, fy, fr, gap, mouth, narrow=True)
    elif stage == 4 and V['gag'] == 'glance':
        face(cv, fx + (2 if fr in (2, 3) else 0), fy, fr, gap, mouth)
    else:
        face(cv, fx, fy, fr, gap if stage == 4 else max(2, gap - 1), mouth)
    if stage == 4:
        g = V['gag']
        if g in ('eyebrow', 'tear', 'watch', 'sword', 'sweat', 'snore', 'crown', 'monocle', 'clipboard', 'fold'):
            gag(cv, g, fx, fy, fr, V)
        if V.get('extra') == 'wave': gag(cv, 'wave', fx, fy, fr, V)
        if g == 'yell' and fr >= 3:
            cv.rect(fx - 4, fy + 2, 9, 5, 'K'); cv.rect(fx - 2, fy + 5, 5, 2, 'r'); cv.rect(fx - 3, fy + 2, 7, 1, 'w')
        if g == 'shiver' or (g == 'shake' and fr in (1, 2, 4)): cv = cv.shifted([0, 1, 0, -1, 0, 1][fr], 0)
        if g == 'yell' and fr >= 3: cv = cv.shifted([0, 0, 0, 1, -1, 1][fr], 0)
        if g not in ('shiver', 'yell') and BOB[fr]: cv = cv.shifted(0, BOB[fr])
    mound(cv)
    return cv


# ---------------------------------------------------------------- tiles
def tile(kind, seed=1):
    cv = Canvas(32, 32); rnd = random.Random(seed)
    if kind.startswith('grass'):
        cv.rect(0, 0, 32, 32, 'G')
        for _ in range(26): x, y = rnd.randrange(32), rnd.randrange(32); cv.set(x, y, 'L'); cv.set(x, y + 1, 'g')
        for _ in range(6): x, y = rnd.randrange(30), rnd.randrange(30); cv.rect(x, y, 2, 1, 'g')
    elif kind == 'soil':
        cv.rect(0, 0, 32, 32, '4')
        for _ in range(30): cv.set(rnd.randrange(32), rnd.randrange(32), '3')
        for _ in range(10): cv.set(rnd.randrange(32), rnd.randrange(32), '5')
    elif kind == 'plot':
        cv.rect(0, 0, 32, 32, '5'); cv.rect(1, 1, 30, 30, '4')
        for y in range(4, 32, 6): cv.rect(2, y, 28, 2, '3')
        for _ in range(14): cv.set(rnd.randrange(2, 30), rnd.randrange(2, 30), '5')
    elif kind == 'path':
        cv.rect(0, 0, 32, 32, 'b')
        for _ in range(12): x, y = rnd.randrange(30), rnd.randrange(30); cv.rect(x, y, 2, 2, 'E'); cv.set(x + 1, y + 1, 'e')
    elif kind == 'hedge':
        cv.rect(0, 0, 32, 32, 'g')
        for _ in range(10): cv.ellipse(rnd.randrange(32), rnd.randrange(32), 4, 3, 'G')
        for _ in range(16): cv.set(rnd.randrange(32), rnd.randrange(32), 'L')
    elif kind == 'water':
        cv.rect(0, 0, 32, 32, 'C')
        for y in range(3, 32, 8):
            for x in range(0, 32, 9): cv.rect((x + y) % 32, y, 4, 1, 'c')
    elif kind == 'stone':
        cv.rect(0, 0, 32, 32, 's')
        for y in range(0, 32, 8): cv.rect(0, y, 32, 1, 'S')
        for y in range(0, 32, 8):
            for x in range((y // 8 % 2) * 8, 32, 16): cv.rect(x, y, 1, 8, 'S')
    return cv


# ---------------------------------------------------------------- characters
def farmer(direction, frame, carry=False):
    cv = Canvas(32, 32); leg = frame % 2; bob = -1 if leg else 0
    def body(narrow):
        bw = 6 if narrow else 10; bx = 16 - bw // 2
        cv.rect(bx, 14 + bob, bw, 7, 'C')
        cv.rect(bx + 1, 21 + bob, bw - 2, 6, 'B')
        cv.rect(bx + 1, 27 + (0 if leg else bob), 3 if narrow else 3, 3, 'D'); cv.rect(bx + bw - 4 if not narrow else bx + 3, 27 + (bob if leg else 0), 3, 3, 'D')
    if direction in ('down', 'up'):
        body(False)
        if carry:
            cv.rect(9, 8 + bob, 2, 8, 'C'); cv.rect(21, 8 + bob, 2, 8, 'C'); cv.rect(9, 6 + bob, 2, 2, 'e'); cv.rect(21, 6 + bob, 2, 2, 'e')
        else:
            cv.rect(9, 14 + bob, 2, 6, 'C'); cv.rect(21, 14 + bob, 2, 6, 'C'); cv.rect(9, 20 + bob, 2, 2, 'e'); cv.rect(21, 20 + bob, 2, 2, 'e')
        cv.rect(12, 8 + bob, 8, 6, 'e' if direction == 'down' else 'D')
        if direction == 'down': eye(cv, 13, 10 + bob); eye(cv, 17, 10 + bob); cv.rect(15, 13 + bob, 2, 1, 'K')
        cv.rect(10, 6 + bob, 12, 2, 'y'); cv.rect(12, 3 + bob, 8, 3, 'y'); cv.rect(12, 5 + bob, 8, 1, '2')
    else:
        body(True)
        ax = 18 if not carry else 16
        cv.rect(ax, (14 if not carry else 7) + bob, 2, 7, 'C'); cv.rect(ax, (21 if not carry else 5) + bob, 2, 2, 'e')
        cv.rect(13, 8 + bob, 7, 6, 'e'); eye(cv, 17, 10 + bob); cv.rect(18, 13 + bob, 2, 1, 'K')
        cv.rect(11, 6 + bob, 11, 2, 'y'); cv.rect(13, 3 + bob, 7, 3, 'y')
    cv.outline(); return cv


def gnome(frame):
    cv = Canvas(32, 32); bob = -1 if frame == 1 else 0; lean = 2 if frame == 2 else 0
    cv.rect(12 + lean, 18 + bob, 8, 8, 'C'); cv.rect(12 + lean, 26, 3, 3, 'D'); cv.rect(17 + lean, 26, 3, 3, 'D')
    cv.rect(12 + lean, 12 + bob, 8, 4, 'e'); eye(cv, 13 + lean, 13 + bob); eye(cv, 17 + lean, 13 + bob)
    cv.ellipse(16 + lean, 19 + bob, 5, 3.5, 'w'); cv.rect(14 + lean, 16 + bob, 4, 1, 'w')
    cv.tri_up(16 + lean * 2, 12 + bob, 6, 11, 'r'); cv.rect(10 + lean * 2, 11 + bob, 13, 2, 'R')
    cv.outline(); return cv


# ---------------------------------------------------------------- props
def prop(kind):
    cv = Canvas(32, 32)
    if kind.startswith('fence'):
        cv.rect(4, 8, 4, 22, 'B'); cv.rect(24, 8, 4, 22, 'B'); cv.rect(4, 8, 4, 1, 'b'); cv.rect(24, 8, 4, 1, 'b')
        if kind == 'fence_full': cv.rect(0, 12, 32, 3, 'b'); cv.rect(0, 20, 32, 3, 'b')
        elif kind == 'fence_dmg': cv.rect(0, 12, 14, 3, 'b'); cv.rect(20, 12, 12, 3, 'b'); cv.rect(0, 20, 32, 3, 'b'); cv.set(15, 13, 'K')
        else: cv.rect(0, 21, 9, 2, 'b'); cv.rect(10, 18, 4, 2, 'b'); cv.set(19, 24, 'b')
    elif kind == 'gate':
        cv.rect(4, 8, 4, 22, 'B'); cv.rect(24, 8, 4, 22, 'B'); cv.rect(0, 12, 32, 3, 'D'); cv.rect(0, 20, 32, 3, 'D'); cv.rect(14, 8, 4, 22, 'D')
        cv.set(6, 13, 's'); cv.set(6, 21, 's'); cv.set(25, 13, 's'); cv.set(25, 21, 's')
    elif kind.startswith('sprinkler'):
        cv.rect(14, 20, 4, 10, 's'); cv.rect(12, 29, 8, 2, 'S'); cv.ellipse(16, 18, 4, 2.5, 'S'); cv.rect(13, 17, 6, 1, 's')
        if kind.endswith('1'):
            for dx, dy in ((-9, -4), (-6, -7), (0, -9), (6, -7), (9, -4), (-12, 0), (12, 0)): cv.rect(16 + dx, 18 + dy, 2, 1, 'c')
    elif kind == 'lock':
        cv.rect(10, 15, 12, 11, '1'); cv.rect(11, 16, 10, 9, 'y'); cv.rect(12, 9, 2, 7, 's'); cv.rect(18, 9, 2, 7, 's'); cv.rect(12, 8, 8, 2, 's')
        cv.rect(15, 18, 2, 2, 'K'); cv.rect(15, 20, 2, 3, 'K')
    elif kind.startswith('conveyor'):
        cv.rect(0, 8, 32, 16, 'S'); off = 0 if kind.endswith('0') else 3
        for x in range(off, 32, 6): cv.rect(x, 10, 2, 12, 'K')
        cv.rect(0, 8, 32, 1, 's'); cv.rect(0, 23, 32, 1, 'K'); cv.rect(2, 24, 4, 4, 's'); cv.rect(26, 24, 4, 4, 's')
    elif kind == 'stump':
        cv.rect(10, 16, 12, 12, 'B'); cv.ellipse(16, 16, 6, 3, 'b'); cv.ellipse(16, 16, 3, 1.5, 'B'); cv.set(16, 16, 'b')
        cv.line(12, 20, 13, 27, 'D'); cv.line(19, 19, 20, 27, 'D'); cv.rect(8, 27, 16, 1, 'D')
        cv.remap(lambda ch: {'B': 's', 'b': 'S', 'D': 'K'}.get(ch, ch))
    elif kind == 'mound':
        cv.ellipse(16, 24, 9, 3, '4'); cv.ellipse(16, 24, 6, 1.5, '5'); cv.rect(15, 20, 2, 2, 'D')
    elif kind == 'shield':
        for a in range(60):
            import math
            x, y = 16 + round(13 * math.cos(a / 60 * 6.283)), 16 + round(13 * math.sin(a / 60 * 6.283))
            if a % 3: cv.set(x, y, 'c')
    if kind not in ('shield', 'mound'): cv.outline()
    return cv


def tree(stage):
    cv = Canvas(48, 64)
    if stage == 0:
        cv.rect(23, 52, 2, 8, 'G'); cv.ellipse(19.5, 54, 3.5, 2, 'L'); cv.ellipse(27.5, 53, 3.5, 2, 'L')
    else:
        th = [0, 14, 22, 24, 24][stage]; tw = [0, 2, 4, 5, 5][stage]
        cv.rect(24 - tw // 2, 60 - th, tw + 1, th, 'B'); cv.vline_within(24 - tw // 2, 60 - th, 60, 'D')
        cr = [0, 7, 12, 15, 16][stage]; cy = 60 - th - cr + 4
        cv.ellipse(24, cy, cr, cr * 0.8, 'g'); cv.ellipse(22, cy - 2, cr * 0.7, cr * 0.55, 'G'); cv.ellipse(27, cy - 3, cr * 0.35, cr * 0.3, 'L')
        rnd = random.Random(stage)
        if stage >= 3:
            for _ in range(7): cv.rect(24 + rnd.randint(-cr + 3, cr - 3), cy + rnd.randint(-cr + 3, cr - 4), 2, 2, 'p')
        if stage >= 4:
            for _ in range(6): cv.rect(24 + rnd.randint(-cr + 3, cr - 3), cy + rnd.randint(-cr + 3, cr - 4), 2, 2, '1')
    cv.outline(); cv.ellipse(24, 61, 12, 3, '4'); return cv


# ---------------------------------------------------------------- ui
def ui(kind):
    if kind == 'panel9':
        cv = Canvas(24, 24); cv.rect(0, 0, 24, 24, 'D'); cv.rect(1, 1, 22, 22, 'b'); cv.rect(2, 2, 20, 20, 'D'); cv.rect(3, 3, 18, 18, '3')
        for x, y in ((1, 1), (22, 1), (1, 22), (22, 22)): cv.set(x, y, 'W')
        return cv
    cv = Canvas(16, 16)
    if kind == 'sap':
        cv.ellipse(8, 10, 5, 4.5, '1'); cv.tri_up(8, 7, 4, 6, '1'); cv.rect(5, 9, 2, 3, 'Y'); cv.outline('2')
    elif kind == 'seed':
        cv.ellipse(8, 9, 5, 3.5, 'B'); cv.rect(5, 7, 2, 2, 'b'); cv.line(8, 5, 10, 2, 'G'); cv.outline()
    elif kind == 'sparkle':
        cv.rect(7, 2, 2, 12, 'Y'); cv.rect(2, 7, 12, 2, 'Y'); cv.rect(6, 6, 4, 4, 'w')
    elif kind == 'lockicon':
        cv.rect(4, 7, 8, 7, '1'); cv.rect(5, 3, 1, 4, 's'); cv.rect(10, 3, 1, 4, 's'); cv.rect(5, 3, 6, 1, 's'); cv.set(8, 10, 'K')
    return cv


# ---------------------------------------------------------------- packing
def pack(frames, cell_w, cell_h, per_row, name, out):
    """frames: list of (name, Canvas). Grid-packed; JSON records real sizes."""
    rows = (len(frames) + per_row - 1) // per_row
    im = Image.new('RGBA', (cell_w * per_row, cell_h * rows), (0, 0, 0, 0))
    atlas = {"frames": {}, "meta": {"image": f"{name}.png", "size": {"w": im.width, "h": im.height}, "scale": "1"}}
    for i, (fname, cv) in enumerate(frames):
        x, y = (i % per_row) * cell_w, (i // per_row) * cell_h
        im.paste(cv.to_image(), (x, y))
        atlas["frames"][fname] = {"frame": {"x": x, "y": y, "w": cv.w, "h": cv.h}, "rotated": False, "trimmed": False,
                                  "spriteSourceSize": {"x": 0, "y": 0, "w": cv.w, "h": cv.h}, "sourceSize": {"w": cv.w, "h": cv.h}}
    im.save(os.path.join(out, f"{name}.png"))
    with open(os.path.join(out, f"{name}.json"), 'w') as fh: json.dump(atlas, fh)
    return im


def main(out):
    os.makedirs(out, exist_ok=True)
    roster = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'content', 'roster.json')))['species']
    plant_frames = []
    for sp in roster:
        sid = sp['id']
        assert sid in VIS, f"no visuals for {sid}"
        for st in range(5): plant_frames.append((f"{sid}_grow{st}", draw_plant(sid, st)))
        for fr in range(6): plant_frames.append((f"{sid}_idle{fr}", draw_plant(sid, 4, fr)))
        for fr in range(2): plant_frames.append((f"{sid}_wither{fr}", draw_plant(sid, 4, fr * 3, wither=True)))
    plants_im = pack(plant_frames, 32, 48, 13, 'plants', out)

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import gen_world
    ntiles, nbiomes, nchars, nplaza = gen_world.build(out)
    tiles = list(range(ntiles)); chars = list(range(nchars))

    props = [(k, prop(k)) for k in ('fence_full', 'fence_dmg', 'fence_broken', 'gate', 'sprinkler0', 'sprinkler1', 'lock', 'conveyor0', 'conveyor1', 'stump', 'mound', 'shield')]
    props += [(f"tree{s}", tree(s)) for s in range(5)]
    pack(props, 48, 64, 9, 'props', out)

    pack([(k, ui(k)) for k in ('panel9', 'sap', 'seed', 'sparkle', 'lockicon')], 24, 24, 5, 'ui', out)

    # preview contact sheet: idle0 + grow2 + wither0 for every species, 3x
    pv = Image.new('RGBA', (32 * 20, 48 * 4), (40, 30, 50, 255))
    for i, sp in enumerate(roster):
        for r, st in enumerate(((4, 0), (4, 3), (2, 0), (None, 0))):
            cv = draw_plant(sp['id'], 4, 0, wither=True) if st[0] is None else draw_plant(sp['id'], st[0], st[1])
            pv.paste(cv.to_image(), (i * 32, r * 48), cv.to_image())
    pv = pv.resize((pv.width * 3, pv.height * 3), Image.NEAREST); pv.save(os.path.join(out, 'preview.png'))
    print(f"plants: {len(plant_frames)} frames {plants_im.size}; tiles {len(tiles)}; chars {len(chars)}; props {len(props)}; -> {out}")


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'out')
