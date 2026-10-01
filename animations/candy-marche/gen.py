#!/usr/bin/env python3
# Candy (marche dessinée) : génère les images une par une, la planche PNG et le JSON, dans le même format que la limace.
# Python 3 sans dépendance. Usage : python3 animations/candy-marche/gen.py [dossier de test pour les aperçus]
# Sorties : frames/<balise>_<n>.png, candy_sheet.png, candy_sheet.json, et dist/persos/candy-marche/{sheet.png,sheet.json,thumb.png}
import json
import math
import os
import shutil
import struct
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "..", "..", "dist", "persos", "candy-marche")
N = 64
GROUND = 60   # ligne du bas du contour, comme la limace de profil
R0 = 13.4     # rayon du corps au repos
BY0 = 43.4    # centre du corps au repos : le bas du corps finit ligne 57, les lignes 58 et 59 sont celles des pieds
BOTTOM = BY0 + R0

PAL = {
    "O": (26, 12, 20),      # contour : l'app ne le reconnaît que si R+G+B < 60
    "P": (255, 172, 203),   # rose du corps
    "L": (255, 226, 236),   # reflet : la couleur la plus claire de l'image, l'app s'en sert pour le reflet à l'étirement
    "S": (239, 134, 173),   # ombre
    "E": (224, 98, 143),    # dedans des oreilles
    "B": (255, 111, 156),   # joues
    "W": (255, 226, 236),   # blanc des yeux : même teinte que le reflet, rien de plus clair
    "T": (92, 200, 192),    # bas de l'oeil
    "M": (142, 229, 207),   # bonbon menthe
    "N": (200, 244, 230),   # bonbon clair
    "A": (143, 214, 255),   # larmes
    "H": (255, 79, 142),    # coeurs, joues gonflées
    "R": (196, 52, 84),     # dedans de la bouche
    "F": (255, 150, 170),   # langue
    "V": (255, 45, 85),     # veine de colère
    "Y": (255, 214, 102),   # bonbon jaune
    "Z": (255, 150, 190),   # bonbon rose
}
SICK = {"P": (205, 220, 160), "L": (226, 236, 196), "S": (172, 192, 122), "E": (150, 172, 100), "B": (190, 204, 120),
        "H": (190, 204, 120), "N": (214, 236, 208), "M": (160, 214, 170)}


def ell(cx, cy, rx, ry):
    return lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def tri(a, b, c):
    def side(p, q, r):
        return (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])

    def inside(x, y):
        p = (x, y)
        d1, d2, d3 = side(p, a, b), side(p, b, c), side(p, c, a)
        return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))

    return inside


def rot(x, y, ox, oy, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c


class Img:
    def __init__(self):
        self.g = [[None] * N for _ in range(N)]

    def mask(self, *shapes):
        return {(x, y) for y in range(N) for x in range(N) if any(s(x + .5, y + .5) for s in shapes)}

    def layer(self, m, fill, outline="O"):
        if outline:
            for x, y in m:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if (nx, ny) not in m and 0 <= nx < N and 0 <= ny < N:
                        self.g[ny][nx] = outline
        for x, y in m:
            self.g[y][x] = fill(x + .5, y + .5)

    def paint(self, m, ch):
        for x, y in m:
            if 0 <= x < N and 0 <= y < N:
                self.g[y][x] = ch

    def stamp(self, cx, cy, rows, cmap, flip=False):
        h, w = len(rows), len(rows[0])
        x0, y0 = round(cx - w / 2), round(cy - h / 2)
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != ".":
                    x, y = x0 + (w - 1 - i if flip else i), y0 + j
                    if 0 <= x < N and 0 <= y < N:
                        self.g[y][x] = cmap.get(ch, ch)

    def line(self, pts, ch="O"):
        out = set()
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            n = max(2, int(math.hypot(bx - ax, by - ay) * 3))
            for k in range(n + 1):
                t = k / n
                out.add((math.floor(ax + (bx - ax) * t), math.floor(ay + (by - ay) * t)))
        self.paint(out, ch)


def mirror_img(im):
    out = Img()
    out.g = [row[::-1] for row in im.g]
    return out


# ---------------------------------------------------------------- le corps de Candy

DEFAULT = dict(v=0, bx=32.0, by=BY0, rx=R0, ry=R0, tilt=0.0, feet=None, ear=(0, 0), bow=(0, 0), wing=(0, 0),
               arm=(0, 0), arms_up=0.0, look=(0, 0), eye="open", mouth="smile", blush=1.0, fx=None, pal=None,
               hide_feet=False)


def stand_feet(v, spread=5.8, z=(0.0, 0.0), lift=(0.0, 0.0), bx=32.0):
    """pieds posés sur le corps : (x, hauteur, profondeur), le plus loin d'abord"""
    r = math.radians(v)
    out = []
    for i, xb in enumerate((-spread, spread)):
        out.append((bx + xb * math.cos(r) + z[i] * math.sin(r), lift[i], z[i] * math.cos(r) - xb * math.sin(r)))
    return sorted(out, key=lambda f: f[2])


def sph(P, lon, lat, dv=0.0):
    """point de la surface du corps (écran, profondeur) pour une longitude (0 = devant elle) et une latitude"""
    v = math.radians(P["v"] + dv)
    lo, la = math.radians(lon), math.radians(lat)
    x, y = P["bx"] + P["rx"] * math.cos(la) * math.sin(lo + v), P["by"] - P["ry"] * math.sin(la)
    x, y = rot(x, y, P["bx"], P["by"], P["tilt"])
    return x, y, math.cos(la) * math.cos(lo + v)


def body_fill(P):
    bx, by, rx, ry = P["bx"], P["by"], P["rx"], P["ry"]
    spot = ell(bx - .51 * rx, by - .56 * ry, .185 * rx, .15 * ry)

    def f(x, y):
        u, w = (x - bx) / rx, (y - by) / ry
        if spot(x, y):
            return "L"
        if w > .8 or ((u + .15) ** 2 + (w + .15) ** 2 > 1 and u + w > 0):
            return "S"
        return "P"

    return f


def ear_shape(P, s, extra_flip=0):
    """oreille de côté s (-1 gauche, +1 droite) : triangle (base A, base B, pointe) et son intérieur"""
    lon = s * 54
    cx, cy, d = sph(P, lon, 46)
    v = math.radians(P["v"])
    sc = math.sqrt(P["rx"] * P["ry"]) / R0
    ax, ay = s * .64, -.77
    az = .2
    axs = ax * math.cos(v) + az * math.sin(v)
    droop = P["ear"][0 if s < 0 else 1]
    L = 11.7 * sc
    tx, ty = rot(cx + axs * L, cy + ay * L, cx, cy, s * droop)
    nrm = math.hypot(tx - cx, ty - cy) or 1
    ux, uy = -(ty - cy) / nrm, (tx - cx) / nrm
    e = 4.2 * sc * (.62 + .38 * abs(math.cos(v)))
    a = (cx - ux * e, cy - uy * e)
    b = (cx + ux * e, cy + uy * e)
    inner = (tri((cx + (a[0] - cx) * .5 + (tx - cx) * .18, cy + (a[1] - cy) * .5 + (ty - cy) * .18),
                 (cx + (b[0] - cx) * .5 + (tx - cx) * .18, cy + (b[1] - cy) * .5 + (ty - cy) * .18),
                 (cx + (tx - cx) * .62, cy + (ty - cy) * .62)))
    return tri(a, b, (tx, ty)), inner, d


def draw_candy(img, P):
    v = P["v"]
    bx, by, rx, ry = P["bx"], P["by"], P["rx"], P["ry"]
    # pieds : derrière le corps, sauf le plus proche quand elle est de côté (on voit alors chaque pas)
    feet = [] if P["hide_feet"] else (P["feet"] or stand_feet(v, bx=bx))
    sc = max(.9, rx / R0)
    near = [f for f in feet if abs(v) >= 40 and f[2] > .3]
    for f in feet:
        if f not in near:
            img.layer(img.mask(ell(f[0], 58.2 - f[1], 3.4 * sc, 2.2)), lambda x, y: "S")
    ears = [(s, ) + ear_shape(P, s) for s in (-1, 1)]
    front_ears = abs(v) >= 55
    arm_specs = []
    for s in (-1, 1):
        ax, ay, d = sph(P, s * (90 - P["arm"][0]), -15 + P["arms_up"] * 70)
        arm_specs.append((s, ax + s * P["arms_up"] * 2.5, ay + P["arm"][1], d))
    # derrière : les oreilles (sauf de profil pour l'oreille proche) et le bras lointain
    for s, tr, inner, d in ears:
        if not (front_ears and d > 0):
            fill = (lambda inner: lambda x, y: "E" if inner(x, y) else "P")(inner)
            img.layer(img.mask(tr), fill)
    for s, ax, ay, d in arm_specs:
        if d <= .35:
            img.layer(img.mask(ell(ax, ay, 1.75, 1.6)), lambda x, y: "P" if y < ay + .6 else "S")
    # le corps
    img.layer(img.mask(ell(bx, by, rx, ry)), body_fill(P))
    for f in near:
        img.layer(img.mask(ell(f[0], 58.2 - f[1], 3.4 * sc, 2.2)), lambda x, y: "S")
    for s, ax, ay, d in arm_specs:
        if d > .35:
            img.layer(img.mask(ell(ax, ay, 2.0, 1.9)), lambda x, y: "L" if (x < ax - .3 and y < ay - .3) else ("S" if x + y > ax + ay + 1 else "P"), outline="E")
    if front_ears:
        for s, tr, inner, d in ears:
            if d > 0:
                img.layer(img.mask(tr), (lambda inner: lambda x, y: "E" if inner(x, y) else "P")(inner))
    draw_bow(img, P)
    draw_face(img, P)


def draw_bow(img, P):
    bx, by, ry = P["bx"], P["by"], P["ry"]
    cx, cy = bx + P["bow"][0], by - ry - 2.8 + P["bow"][1]
    cx, cy = rot(cx, cy, bx, by, P["tilt"])
    v = math.radians(P["v"])
    wf = max(abs(math.cos(v)), .34)
    sc = P["rx"] / R0
    wl = 3.1 * wf
    wy = P["wing"][1]
    left = tri((cx - 3.0 * sc, cy), (cx - 3.0 * sc - wl, cy - 2.5 + wy), (cx - 3.0 * sc - wl, cy + 2.5 + wy))
    right = tri((cx + 3.0 * sc, cy), (cx + 3.0 * sc + wl, cy - 2.5 - wy), (cx + 3.0 * sc + wl, cy + 2.5 - wy))
    center = ell(cx, cy, 3.0 * sc, 2.5)
    ox, oy = round(cx), round(cy)

    def fill(x, y):
        if not center(x, y):
            return "N"
        return "W" if (math.floor(x) - ox - (math.floor(y) - oy)) % 3 == 0 else "M"

    img.layer(img.mask(center, left, right), fill)


def draw_face(img, P):
    v = P["v"] + P["look"][0] * 9
    tilt = P["tilt"]
    la0 = -P["look"][1] * 5
    sc = P["rx"] / R0
    Pf = dict(P, v=v)
    eye = P["eye"]
    for s in (-1, 1):
        ex, ey, d = sph(Pf, s * 26.6, 2.6 + la0)
        if d <= .1:
            continue
        stamp = EYES.get(eye)
        if stamp and abs(v) < 20:
            img.stamp(ex, ey, stamp, EYE_CMAP, flip=(s == 1))
            continue
        w = 1.0 + 2.0 * d
        if eye == "open":
            shape = ell(ex, ey, w, 3.5)
            m = img.mask(shape)
            img.paint(m, "O")
            gx = ex - .5 * w + .1
            img.paint(img.mask(ell(gx, ey - 1.5, max(.8, 1.05 * d), 1.1)), "W")
            img.paint({p for p in img.mask(ell(ex, ey, w - .7, 2.9)) if p[1] + .5 > ey + 1.4}, "T")
            img.paint(img.mask(ell(ex + .6 * w, ey + 1.4, .5, .5)), "W")
        elif eye == "closed":
            pts = [(ex - w + .3, ey + .6), (ex, ey + 1.6), (ex + w - .3, ey + .6)]
            img.line([(px, py - 0.6) for px, py in pts])
        elif eye == "sleep":
            pts = [(ex - w + .3, ey), (ex - w * .4, ey + 1.2), (ex + w * .4, ey + 1.2), (ex + w - .3, ey)]
            img.line(pts)
            if d > .4:
                ox = ex + s * (w + .2)
                img.paint({(math.floor(ox), math.floor(ey - .5)), (math.floor(ox + s), math.floor(ey - 1.5))}, "O")
    if P["blush"] > 0:
        for s in (-1, 1):
            bx_, by_, d = sph(Pf, s * 45, -15 + la0)
            if d > .2:
                w = max(.5, 1.5 * d)
                col = "H" if P["blush"] > 1 else "B"
                img.paint(img.mask(ell(bx_, by_, w + (.6 if P["blush"] > 1 else 0), .5 + (.4 if P["blush"] > 1 else 0))), col)
    draw_mouth(img, Pf, P)


def draw_mouth(img, Pf, P):
    mx, my, d = sph(Pf, 0, -21.4 - P["look"][1] * 5)
    if d <= -.1:
        return
    w = max(.5, d)
    kind = P["mouth"]
    if kind == "smile":
        pts = [(mx - 1.5 * w, my - .5), (mx - .5 * w, my + .5), (mx + .5 * w, my + .5), (mx + 1.5 * w, my - .5)]
        img.line(pts)
        img.paint({(math.floor(mx - 1.5 * w), math.floor(my - .5)), (math.floor(mx - .5 * w), math.floor(my + .5)),
                   (math.floor(mx + .5 * w), math.floor(my + .5)), (math.floor(mx + 1.5 * w), math.floor(my - .5))}, "O")
    elif kind in MOUTHS and d > .3:
        img.stamp(mx, my, MOUTHS[kind], MOUTH_CMAP)


EYE_CMAP = {"K": "O", "W": "W", "B": "A", "P": "H"}
MOUTH_CMAP = {"K": "O", "R": "R", "P": "F"}
EYES = {}
MOUTHS = {}


# ---------------------------------------------------------------- sortie

def write_png(path, grid, scale=1, bg=None, pal=PAL):
    h = len(grid) * scale
    w = len(grid[0]) * scale
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            c = grid[y // scale][x // scale]
            if c is None:
                raw.extend(bg if bg else (0, 0, 0, 0))
            else:
                raw.extend((*pal[c], 255))

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def contact(path, imgs, cols=8, scale=3):
    rows = (len(imgs) + cols - 1) // cols
    W, H = cols * (N + 2), rows * (N + 2)
    grid = [[None] * W for _ in range(H)]
    for k, im in enumerate(imgs):
        ox, oy = (k % cols) * (N + 2), (k // cols) * (N + 2)
        for y in range(N):
            for x in range(N):
                grid[oy + y][ox + x] = im.g[y][x]
        for x in range(N):
            if grid[oy + GROUND + 1][ox + x] is None:
                grid[oy + GROUND + 1][ox + x] = "G"
    pal = dict(PAL, G=(235, 225, 240))
    write_png(path, grid, scale, bg=(250, 246, 252, 255), pal=pal)



EYES.update({
    "arc": ["..K..", ".K.K.", "K...K"],
    "sleep": ["K.....", "KK...K", "..KKK."],
    "squint": ["K...", ".KK.", "...K", ".KK.", "K..."],
    "spiral": [".KKKKK.", ".WWWWWK", "KKKKKWK", "KWWWKWK", "KWKKKWK", "KWWWWWK", ".KKKKK."],
    "teary": ["..KK..", ".KKKK.", "KWWKKK", "KWWKKK", "KKKKWK", ".BBBB.", "..KK.."],
    "teary2": ["..KK..", ".KKKK.", "KKWWKK", "KKWWKK", "KKKKWK", ".BBBB.", "..KK.."],
    "star": [".KKKK.", "KKWKKK", "KWWWKK", "KKWKKK", "KKKKWK", "KTTTTK", ".KKKK."],
    "flat": ["KKKKKK", "KWKKKK", "KKKKKK", "KTTTTK", ".KKKK."],
    "ko": ["K.K", ".K.", "K.K"],
})
EYES["spiral2"] = [r[::-1] for r in EYES["spiral"]][::-1]
MOUTHS.update({
    "cat": ["K.K.K", ".K.K."],
    "openSmall": ["KKKKKK", "KRRRRK", ".KFFK.", "..KK.."],
    "oSmall": [".KK.", "KRRK", "KRRK", ".KK."],
    "dot": [".KK.", "KRRK", ".KK."],
    "yawnSmall": [".KK.", "KRRK", "KRRK", "KFFK", ".KK."],
    "yawnBig": [".KKKK.", "KRRRRK", "KRRRRK", "KRFFRK", ".KKKK."],
    "pout": [".KK.", "K..K"],
    "wave": [".K.K.", "K.K.K"],
    "wave2": ["K.K.K", ".K.K."],
    "flatline": ["KKK"],
})
VEIN = [".V.V.", "VV.VV", ".....", "VV.VV", ".V.V."]


def Pz(**kw):
    return dict(DEFAULT, **kw)


def bod(rx, ry, lift=0.0, bottom=BOTTOM):
    """un corps écrasé ou étiré, posé sur le sol (lift = hauteur en l'air)"""
    return dict(rx=rx, ry=ry, by=bottom - ry - lift)


def render(P):
    im = Img()
    draw_candy(im, P)
    if P.get("fx") == "vein":
        im.stamp(P["bx"] + 5.5, P["by"] - 8.8 - (P["ry"] - R0) * .3, VEIN, {"V": "V"})
    return im


FRONT = Pz()


# ---------------------------------------------------------------- marche : 8 images, sur place, pieds posés au pixel
PLANT = [4, 2, 0, -2, -4]   # pied posé : de devant vers derrière, 2 pixels par image
SWING = [-2, 0, 2]          # pied en l'air, de derrière vers devant
SLIFT = [3, 4, 3]


def crawl_pose(t):
    feet = []
    for ph, depth in ((0, 1), (4, -1)):
        u = (t - ph) % 8
        feet.append((32 + PLANT[u], 0, depth) if u <= 4 else (32 + SWING[u - 5], SLIFT[u - 5], depth))
    feet.sort(key=lambda f: f[2])
    bob = [0, -.6, -1.1, -.6][t % 4]
    tilt = [5, 3, 1, 3, 7, 4, 1, 3][t]
    flop = 11 * math.sin(2 * math.pi * (t - 1) / 4)
    return Pz(v=90, by=BY0 + bob, tilt=tilt, feet=feet, ear=(flop, flop), bow=(0, .9 * math.sin(2 * math.pi * (t - 1.5) / 4)),
              wing=(0, 1.2 * math.sin(2 * math.pi * (t - 2) / 4)), arm=(26 * math.sin(2 * math.pi * t / 8), 0))


def anim_crawl():
    return [(crawl_pose(t), 110) for t in range(8)]


def anim_turn():
    out = []
    dur = [60, 60, 60, 80, 80, 100, 160, 100, 80, 80, 60, 60, 60]
    for i in range(13):
        if i == 0:
            P = crawl_pose(0)
        elif i == 6:
            P = FRONT
        else:
            v = 90 - 15 * i
            lead = 8 * abs(math.sin(math.pi * i / 6))
            fade = max(0, 1 - i / 4) if i < 6 else 0
            P = Pz(v=v, tilt=5 * math.cos(math.pi * i / 12), look=(-lead / 9, 0),
                   feet=stand_feet(v, z=(3 - .5 * i, -3 + .5 * i)),
                   ear=(-11 * fade * math.cos(math.pi * i / 12),) * 2)
        out.append((P, dur[i]))
    return out


def anim_repos():
    return [(FRONT, 520), (Pz(tilt=2, bow=(1, .7), wing=(0, 1), **bod(13.7, 13.0), feet=stand_feet(0, 5.8)), 520)]


def anim_regard():
    out = []
    for lx, ly in ((0, -1), (0, 0), (0, 1), (1, -1), (1, 0), (1, 1)):
        out.append((Pz(look=(lx, ly), tilt=2 * lx), 100))
    return out


def anim_attrape():
    out = []
    for k in range(4):
        sw = [-1, 1, 1, -1][k]
        eye, mouth = ("teary", "wave") if k % 2 == 0 else ("teary2", "wave2")
        P = Pz(by=41.6, rx=12.8, ry=14.4, tilt=3 * sw, eye=eye, mouth=mouth, arms_up=1, ear=(-14 * sw, 14 * sw), blush=1,
               bow=(sw * 1.2, -1.2), wing=(0, -2),
               feet=stand_feet(0, 4.8, lift=(2.2 + sw, 2.2 - sw)))
        out.append((P, 110))
    return out


def jump_body(rx, ry, H, bottom=BOTTOM, **kw):
    P = Pz(**bod(rx, ry, H, bottom), **kw)
    if "feet" not in P or P["feet"] is None:
        P["feet"] = stand_feet(0, 5.2, lift=(max(0, H - 1.0),) * 2)
    return P


def anim_saut_face():
    seq = [
        (jump_body(14.6, 12.2, 0, 57.6, tilt=0, ear=(8, 8), eye="arc", mouth="dot", bow=(0, 1.2), wing=(0, 1.5)), 90),
        (jump_body(15.6, 11.0, 0, 58.4, ear=(14, 14), eye="arc", mouth="dot", bow=(0, 1.8), wing=(0, 2)), 110),
        (jump_body(12.4, 15.0, 2, ear=(-12, -12), eye="open", mouth="oSmall", arms_up=1, bow=(0, -1), wing=(0, -1.5)), 60),
        (jump_body(12.4, 14.6, 7, ear=(-16, -16), eye="star", mouth="oSmall", arms_up=1, bow=(0, -1.4), wing=(0, -2)), 70),
        (jump_body(12.6, 14.4, 10, ear=(-10, -10), eye="star", mouth="oSmall", arms_up=1, bow=(0, -.6), wing=(0, -1)), 70),
        (jump_body(12.8, 14.0, 11, ear=(6, 6), eye="star", mouth="oSmall", arms_up=1, bow=(0, .6), wing=(0, 1)), 70),
        (jump_body(12.6, 14.4, 8, ear=(-18, -18), eye="star", mouth="oSmall", arms_up=.6, bow=(0, -1.6), wing=(0, -2), tilt=3), 80),
        (jump_body(12.4, 14.8, 4, ear=(-22, -22), eye="star", mouth="oSmall", arms_up=.6, bow=(0, -2), wing=(0, -2.4), tilt=-3), 80),
        (jump_body(16.8, 9.8, 0, 58.6, ear=(26, 26), eye="squint", mouth="dot", blush=2, bow=(0, 2.2), wing=(0, 2.4), arm=(0, 0)), 60),
        (jump_body(15.0, 11.6, 0, 58.0, ear=(16, 16), eye="squint", mouth="dot", blush=2, bow=(0, 1.2), wing=(0, 1.6)), 70),
        (jump_body(12.6, 14.6, 0, ear=(-12, -12), eye="open", mouth="smile", bow=(0, -1.4), wing=(0, -2)), 80),
        (jump_body(14.2, 12.4, 0, 57.4, ear=(8, 8), eye="open", mouth="smile", bow=(0, 1), wing=(0, 1.2)), 80),
        (jump_body(13.0, 13.8, 0, ear=(-4, -4), eye="open", mouth="smile", bow=(0, -.4), wing=(0, -.6)), 90),
        (FRONT, 120),
    ]
    return seq


def anim_chute():
    out = []
    for k in range(5):
        sw = [0, 0, 1, -1, 1][k]
        eye, mouth = ("teary", "wave") if k % 2 == 0 else ("teary2", "wave2")
        P = jump_body(12.4, 15.0, 9, eye=eye, mouth=mouth, arms_up=1, ear=(-20 + 6 * sw, -20 - 6 * sw), tilt=4 * sw,
                      bow=(sw, -2), wing=(0, -2.4), feet=stand_feet(0, 4.6, lift=(9 + sw, 9 - sw)))
        out.append((P, 70 if k < 2 else 80))
    return out


def anim_ecrase():
    seq = [
        (bod(17.0, 8.8, bottom=58.4), dict(eye="squint", mouth="dot", ear=(30, 30), blush=2, bow=(0, 2.4), wing=(0, 2.6)), 50),
        (bod(18.6, 7.0, bottom=59.0), dict(eye="squint", mouth="dot", ear=(40, 40), blush=2, bow=(0, 3), wing=(0, 3)), 50),
        (bod(19.6, 5.8, bottom=59.6), dict(eye="ko", mouth="flatline", ear=(48, 48), blush=0, bow=(0, 3.4), wing=(0, 3.4)), 60),
        (bod(19.8, 5.4, bottom=59.8), dict(eye="ko", mouth="flatline", ear=(52, 52), blush=0, bow=(0, 3.4), wing=(0, 3.6)), 80),
        (bod(19.4, 5.8, bottom=59.7), dict(eye="ko", mouth="wave", ear=(50, 50), blush=0, bow=(0, 3.4), wing=(0, 3.6)), 120),
        (bod(19.6, 5.6, bottom=59.8), dict(eye="ko", mouth="wave2", ear=(52, 52), blush=0, bow=(0, 3.4), wing=(0, 3.6)), 600),
    ]
    return [(Pz(**b, **kw, feet=stand_feet(0, 7.4), hide_feet=i > 1), d) for i, (b, kw, d) in enumerate(seq)]


def anim_baille():
    spec = [
        (dict(), 100),
        (dict(eye="arc", mouth="dot", **bod(13.1, 13.8)), 100),
        (dict(eye="sleep", mouth="yawnSmall", **bod(12.9, 14.2), ear=(-6, -6)), 120),
        (dict(eye="sleep", mouth="yawnBig", **bod(12.6, 14.8), arms_up=.7, ear=(-14, -14), bow=(0, -1), wing=(0, -1.6)), 160),
        (dict(eye="sleep", mouth="yawnBig", **bod(12.5, 15.0), arms_up=1, ear=(-18, -18), bow=(0, -1.6), wing=(0, -2)), 500),
        (dict(eye="sleep", mouth="yawnBig", **bod(12.6, 14.8), arms_up=1, ear=(-14, -14), bow=(0, -1.2), wing=(0, -1.6)), 300),
        (dict(eye="sleep", mouth="yawnSmall", **bod(13.0, 14.0), arms_up=.4, ear=(2, 2)), 140),
        (dict(eye="sleep", mouth="dot", **bod(13.8, 12.9), ear=(10, 10), bow=(0, 1), wing=(0, 1.4)), 120),
        (dict(eye="arc", mouth="smile", **bod(13.6, 13.2), ear=(6, 6), tilt=-2), 160),
        (dict(), 200),
    ]
    return [(Pz(feet=stand_feet(0, 5.6 * kw.get("rx", R0) / R0), **kw), d) for kw, d in spec]


def anim_dort():
    out = []
    for t in range(8):
        br = math.sin(2 * math.pi * t / 8)
        ry = 12.0 + .55 * br
        P = Pz(v=62, rx=14.4 - .3 * br, ry=ry, by=59.8 - ry, tilt=9, eye="sleep", ear=(28, 28), bow=(.6, 1.4 + .3 * br), wing=(0, 2.2),
               mouth="dot", blush=1, feet=[(36, 0, 1), (32, 0, -1)], arm=(6, 1.2))
        out.append((P, 200))
    return out


def anim_remue():
    return [(Pz(v=62, rx=14.4, ry=12.0, by=59.8 - 12.0, tilt=7, eye="half", ear=(24, 24), bow=(.6, 1.4), wing=(0, 2), mouth="dot",
               feet=[(36, 0, 1), (32, 0, -1)], arm=(6, 1.2)), 400)]


def anim_caresse():
    return [(Pz(eye="arc", mouth="cat", blush=2, tilt=-3, **bod(13.9, 12.9), ear=(6, 6), feet=stand_feet(0, 5.8), bow=(-.8, 1), wing=(0, 1.2)), 300),
            (Pz(eye="arc", mouth="cat", blush=2, tilt=3, **bod(13.9, 12.9), ear=(6, 6), feet=stand_feet(0, 5.8), bow=(.8, 1), wing=(0, 1.2)), 300)]


def anim_rire():
    return [(Pz(eye="squint", mouth="openSmall", blush=2, tilt=-3, **bod(13.6, 13.2, 1), ear=(-6, -6), feet=stand_feet(0, 5.6, lift=(1, 1)), bow=(0, -1), wing=(0, -1.6)), 120),
            (Pz(eye="squint", mouth="openSmall", blush=2, tilt=3, **bod(14.0, 12.8), ear=(4, 4), feet=stand_feet(0, 5.8), bow=(0, 1), wing=(0, 1.4)), 120)]


def anim_fache():
    return [(Pz(eye="flat", mouth="pout", blush=2, fx="vein", tilt=-2, **bod(14.2, 12.8), ear=(14, 14), feet=stand_feet(0, 5.9), bow=(-.6, 1), wing=(0, 1.8)), 100),
            (Pz(eye="flat", mouth="pout", blush=2, fx="vein", tilt=2, **bod(14.2, 12.8), ear=(14, 14), feet=stand_feet(0, 5.9), bow=(.6, 1), wing=(0, 1.8)), 100)]


def anim_intrigue():
    return [(Pz(v=62, tilt=-2, **bod(12.9, 14.2), ear=(-12, -12), eye="star", mouth="oSmall", bow=(0, -1), wing=(0, -1.6),
               feet=stand_feet(62, z=(1, -1))), 100)]


def anim_secoue():
    return [(Pz(by=41.6, rx=12.9, ry=14.2, tilt=-6, eye="spiral", mouth="wave", arms_up=1, ear=(-12, 12), bow=(-1, -1), wing=(0, -2),
               feet=stand_feet(0, 4.8, lift=(2.6, 1.6))), 80),
            (Pz(by=41.6, rx=12.9, ry=14.2, tilt=6, eye="spiral2", mouth="wave2", arms_up=1, ear=(12, -12), bow=(1, -1), wing=(0, -2),
               feet=stand_feet(0, 4.8, lift=(1.6, 2.6))), 80)]


def anim_nausee():
    return [(Pz(v=62, tilt=-8, pal="sick", eye="sleep", mouth="wave", ear=(26, 26), bow=(-.6, 1.4), wing=(0, 2.2),
               feet=stand_feet(62, z=(1.5, -1.5))), 220),
            (Pz(v=62, tilt=8, pal="sick", eye="sleep", mouth="wave2", ear=(30, 30), bow=(.6, 1.4), wing=(0, 2.2),
               feet=stand_feet(62, z=(-1.5, 1.5))), 220)]


def build():
    """toutes les images dans l'ordre de la planche, avec leurs balises"""
    frames, tags = [], []

    def add(name, anim, tag=True):
        a = len(frames)
        for P, d in anim:
            frames.append((render(P), d, P))
        if tag:
            tags.append((name, a, len(frames) - 1))
        return a

    add("crawl", anim_crawl())
    t0 = add("turn", anim_turn())
    # le demi-tour finit en miroir de la première image de marche : même contour des deux côtés de l'axe
    mi = mirror_img(frames[0][0])
    frames[t0 + 12] = (mi, frames[t0 + 12][1], frames[t0 + 12][2])
    s0 = len(frames)
    for k in range(7):
        frames.append(frames[t0 + k])
    f0 = add("saut-face", anim_saut_face())
    tags.append(("saut", s0, len(frames) - 1))
    tags.append(("vol", f0 + 3, f0 + 5))
    tags.append(("chute-legere", f0 + 6, f0 + 7))
    tags.append(("atterrissage", f0 + 8, f0 + 13))
    tags.append(("reforme", f0 + 9, f0 + 13))
    for name, anim in (("repos", anim_repos()), ("regard", anim_regard()), ("attrape", anim_attrape()), ("chute", anim_chute()),
                       ("ecrase", anim_ecrase()), ("baille", anim_baille()), ("dort", anim_dort()), ("remue", anim_remue()),
                       ("caresse", anim_caresse()), ("rire", anim_rire()), ("fache", anim_fache()), ("intrigue", anim_intrigue()),
                       ("secoue", anim_secoue()), ("nausee", anim_nausee())):
        add(name, anim)
    return frames, tags


def palette_for(P):
    return dict(PAL, **SICK) if P.get("pal") == "sick" else PAL


# ---------------------------------------------------------------- les mêmes mesures que l'app (index.html, loadSheet)
def measure(im):
    bot, l, r = 0, N, 0
    for y in range(N):
        for x in range(N):
            c = im.g[y][x]
            if c is None:
                continue
            l, r = min(l, x), max(r, x)
            if sum(PAL[c]) < 60:
                bot = y
    tail, head = N, 0
    for x in range(N):
        if bot > 0 and im.g[bot - 1][x] is not None:
            tail, head = min(tail, x), max(head, x)
    return dict(bot=bot, cx=(l + r) / 2, tail=tail, head=head, l=l, r=r)


def report(frames, tags):
    M = [measure(f[0]) for f in frames]
    T = {n: (a, b) for n, a, b in tags}
    a, b = T["crawl"]
    steps = []
    for i in range(a, b + 1):
        prev, cur = M[a + (i - a - 1) % (b - a + 1)], M[i]
        steps.append(max(0, -min(cur["tail"] - prev["tail"], cur["head"] - prev["head"])))
    ta, tb = T["turn"]
    mid = max(range(ta, tb + 1), key=lambda i: (frames[i][1], -i))
    axis = (M[a]["cx"] + M[tb]["cx"]) / 2
    lines = [f"images : {len(frames)}  balises : {len(tags)}",
             f"marche : pas par image {steps}  (somme {sum(steps)} px par cycle de {sum(frames[i][1] for i in range(a, b + 1))} ms)",
             f"demi-tour : image de face = {mid - ta} (la plus longue), axe = {axis}",
             f"sol (bot) par balise : " + ", ".join(f"{n}={sorted({M[i]['bot'] for i in range(x, y + 1)})}" for n, x, y in tags
                                                    if n in ("crawl", "turn", "repos", "regard", "dort", "baille", "caresse", "rire", "fache"))]
    bad = [i for i in range(a, b + 1) if M[i]["bot"] != GROUND]
    if bad:
        lines.append(f"ATTENTION marche : bas du contour hors ligne {GROUND} aux images {bad}")
    if steps and (min(steps) < 1):
        lines.append("ATTENTION marche : une image n'avance pas")
    return "\n".join(lines), M


def write_outputs(frames, tags, out, png_name="sheet.png", json_name="sheet.json"):
    n = len(frames)
    sheet = [[None] * (N * n) for _ in range(N)]
    pals = []
    for k, (im, _, P) in enumerate(frames):
        for y in range(N):
            for x in range(N):
                sheet[y][k * N + x] = im.g[y][x]
        pals.append(palette_for(P))
    # la planche : une seule palette par image, donc on écrit en RGBA direct
    raw = bytearray()
    for y in range(N):
        raw.append(0)
        for k in range(n):
            pal = pals[k]
            for x in range(N):
                c = sheet[y][k * N + x]
                raw.extend((0, 0, 0, 0) if c is None else (*pal[c], 255))

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", N * n, N, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    meta = {"frames": {f"candy {k}.aseprite": {"frame": {"x": k * N, "y": 0, "w": N, "h": N}, "duration": d}
                       for k, (_, d, _) in enumerate(frames)},
            "meta": {"app": "bidule", "image": "candy_sheet.png", "format": "RGBA8888", "size": {"w": N * n, "h": N}, "scale": "1",
                     "frameTags": [{"name": nm, "from": a, "to": b, "direction": "forward"} for nm, a, b in tags]}}
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, png_name), "wb") as f:
        f.write(png)
    with open(os.path.join(out, json_name), "w") as f:
        json.dump(meta, f, indent=1)
    return meta


SUB = ("saut", "vol", "chute-legere", "atterrissage", "reforme")   # morceaux d'autres balises : pas de fichier à part


if __name__ == "__main__":
    prev = sys.argv[1] if len(sys.argv) > 1 else None
    frames, tags = build()
    text, M = report(frames, tags)
    print(text)
    # pour Aseprite : une image par fichier, comme les autres animations
    fdir = os.path.join(HERE, "frames")
    shutil.rmtree(fdir, ignore_errors=True)
    os.makedirs(fdir)
    for nm, a, b in tags:
        if nm not in SUB:
            for k, (im, _, P) in enumerate(frames[a:b + 1], 1):
                write_png(os.path.join(fdir, f"{nm}_{k}.png"), im.g, 1, pal=palette_for(P))
    write_outputs(frames, tags, HERE, "candy_sheet.png", "candy_sheet.json")
    os.makedirs(DIST, exist_ok=True)
    write_outputs(frames, tags, DIST)
    T = {n: (a, b) for n, a, b in tags}
    write_png(os.path.join(DIST, "thumb.png"), frames[T["repos"][0]][0].g)
    from gif import write_gif
    seq = [("crawl", 3)] + [(nm, 1) for nm in ("turn", "repos")] + [("caresse", 3), ("rire", 3), ("fache", 3), ("saut-face", 1), ("dort", 2)]
    order = []
    for nm, rep_ in seq:
        order += list(range(T[nm][0], T[nm][1] + 1)) * rep_
    rgb = [[[None if c is None else palette_for(frames[i][2])[c] for c in row] for row in frames[i][0].g] for i in order]
    write_gif(os.path.join(HERE, "apercu_x4.gif"), rgb, [round(frames[i][1] / 10) for i in order], scale=4)
    if prev:
        os.makedirs(prev, exist_ok=True)
        groups = [("crawl", ["crawl"]), ("turn", ["turn"]), ("saut", ["saut-face", "chute"]),
                  ("autres", ["repos", "regard", "attrape", "ecrase", "baille"]),
                  ("reste", ["dort", "remue", "caresse", "rire", "fache", "intrigue", "secoue", "nausee"])]
        for gname, names in groups:
            sel = [f for nm in names for f in frames[T[nm][0]:T[nm][1] + 1]]
            contact(os.path.join(prev, f"c_{gname}.png"), [f[0] for f in sel], cols=8 if gname == "crawl" else 7, scale=3)
