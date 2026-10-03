# rire : il rit en se soulevant et en se tassant, sans quitter le sol. Les images 1 (tassé, sourire fin) et 2 (soulevé, bouche grande ouverte)
# sont dessinées à la main dans rire.aseprite ; ce script crée les images de transition entre les deux et range l'animation en boucle :
#   1, 1→2 (un tiers), 1→2 (deux tiers), 2, 2→1 (deux tiers), 2→1 (un tiers)
# Le corps passe de l'un à l'autre (lignes comparées à la même hauteur relative, posé sur la ligne 60), les yeux suivent la tête, la bouche s'ouvre du sourire fin au rectangle.
#   python3 tools/rire.py          (relancer après avoir retouché l'image tassée (1) ou soulevée (4) : il refait les transitions)
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ROOT, ase, frames, replace_frames

INK, WHITE, BASE, MOUTH_IN = (0, 0, 0, 255), (255, 255, 255, 255), (99, 155, 255, 255), (63, 63, 116, 255)
N8 = [(a, b) for a in (-1, 0, 1) for b in (-1, 0, 1) if a or b]

def inner_ink(f):
    """l'encre entièrement entourée de corps : les yeux et la bouche"""
    return {(x, y) for y in range(1, 63) for x in range(1, 63) if f[y][x] == INK and all(f[y + b][x + a][3] for a, b in N8)}
def face_parts(f):
    """(yeux, bouche) : la bouche est le plus gros groupe d'encre intérieure, de dents et de fond de bouche, les yeux le reste"""
    pts = inner_ink(f) | {(x, y) for y in range(64) for x in range(64) if f[y][x] in (WHITE, MOUTH_IN)}
    groups = []
    while pts:
        g = {pts.pop()}; st = list(g)
        while st:
            x, y = st.pop()
            for a, b in N8:
                if (x + a, y + b) in pts: pts.remove((x + a, y + b)); g.add((x + a, y + b)); st.append((x + a, y + b))
        groups.append(g)
    mouth = max(groups, key=len)
    eyes = set().union(*[g for g in groups if g is not mouth]) if len(groups) > 1 else set()
    return eyes, mouth
def bare(f, eyes, mouth):
    """l'image sans visage : yeux et bouche remplacés par la couleur du corps"""
    g = [row[:] for row in f]
    xs = [p[0] for p in mouth]; ys = [p[1] for p in mouth]
    for y in range(min(ys) - 1, max(ys) + 2):
        for x in range(min(xs) - 1, max(xs) + 2):
            if f[y][x][3] and (x, y) not in {(x, y) for x in range(0)}: g[y][x] = BASE if all(f[y + b][x + a][3] for a, b in N8) else g[y][x]
    for x, y in eyes: g[y][x] = BASE
    return g
def box(m): xs = [p[0] for p in m]; ys = [p[1] for p in m]; return min(xs), max(xs), min(ys), max(ys)
def lerp(a, b, t): return a + (b - a) * t

def shape_morph(A, B, t):
    """le corps entre A et B : chaque ligne est lue à la même hauteur relative dans les deux (le sommet avec le sommet), ses bords interpolés,
    ses couleurs prises dans l'image la plus proche ; le contour est refait. Posé sur la ligne 60."""
    from align_turn import extent, parts
    ea, eb = extent(A), extent(B); _, fa_ = parts(A); _, fb_ = parts(B)
    ha, hb = ea[3] - ea[2] + 1, eb[3] - eb[2] + 1
    h = round(lerp(ha, hb, t)); bot = ea[3]
    span = lambda f, y: (min(x for x in range(64) if f[y][x][3]), max(x for x in range(64) if f[y][x][3]))
    mask, out = {}, [[(0, 0, 0, 0)] * 64 for _ in range(64)]
    for r in range(h):
        fr = (r + .5) / h
        ya, yb = bot - min(ha - 1, int(fr * ha)), eb[3] - min(hb - 1, int(fr * hb))
        (la, ra), (lb, rb) = span(A, ya), span(B, yb)
        l, rr = round(lerp(la, lb, t)), round(lerp(ra, rb, t))
        src, ys, ls, rs = (fa_, ya, la, ra) if t < .5 else (fb_, yb, lb, rb)
        for x in range(l, rr + 1):
            u = ls + int((x - l + .5) / (rr - l + 1) * (rs - ls + 1)); out[bot - r][x] = src[ys][min(rs, u)]; mask[(x, bot - r)] = 1
    for (x, y) in mask:
        if any((x + a, y + b) not in mask for a, b in ((0, -1), (-1, 0), (1, 0), (0, 1))): out[y][x] = INK
    return out

def between(A, B, t, fa, fb):
    (ea, ma), (eb, mb) = fa, fb
    f = shape_morph(bare(A, ea, ma), bare(B, eb, mb), t)
    def put(x, y, c):
        if 0 <= x < 64 and 0 <= y < 64 and f[y][x][3]: f[y][x] = c
    # les yeux : ceux de l'image la plus proche, déplacés vers la position intermédiaire
    src_e, ref = (ea, eb) if t < .5 else (eb, ea)
    ca = (sum(p[0] for p in ea) / len(ea), sum(p[1] for p in ea) / len(ea)); cb = (sum(p[0] for p in eb) / len(eb), sum(p[1] for p in eb) / len(eb))
    cs = ca if t < .5 else cb; dx, dy = round(lerp(ca[0], cb[0], t) - cs[0]), round(lerp(ca[1], cb[1], t) - cs[1])
    for x, y in src_e: put(x + dx, y + dy, INK)
    # la bouche : un rectangle aux coins du bas arrondis, entre la bouche fine de A et la grande de B ; intérieur blanc, contour d'encre
    xa0, xa1, ya0, ya1 = box(ma); xb0, xb1, yb0, yb1 = box(mb)
    l, r = round(lerp(xa0, xb0, t)), round(lerp(xa1, xb1, t)); top, bot = round(lerp(ya0, yb0, t)), round(lerp(ya1, yb1, t))
    for y in range(top, bot + 1):
        for x in range(l, r + 1):
            corner = y == bot and x in (l, l + 1, r - 1, r) or y == bot - 1 and x in (l, r) and bot - top > 2
            if corner: continue
            edge = y in (top, bot) or x in (l, r) or (y == bot - 1 and x in (l + 1, r - 1) and bot - top > 2)
            put(x, y, INK if edge else WHITE if y == top + 1 else MOUTH_IN)      # dents en haut, fond de bouche violet foncé (comme baille et chute)
    put(l - 1, top - 1, INK); put(r + 1, top - 1, INK)          # les coins relevés du sourire
    return f

if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        ase(f"{ROOT}/animations/rire/rire.aseprite", "--sheet", f"{tmp}/s.png", "--sheet-type", "horizontal")
        fl = frames(f"{tmp}/s.png")
    A = fl[0]; B = fl[3] if len(fl) == 6 and fl[1] == fl[5] and fl[2] == fl[4] else fl[1]      # déjà rangé (1, t, t, 2, t, t) ou pas
    fa, fb = face_parts(A), face_parts(B)
    m1, m2 = between(A, B, 1 / 3, fa, fb), between(A, B, 2 / 3, fa, fb)
    replace_frames("rire", "rire", [A, m1, m2, B, m2, m1])
    print("rire : 6 images, 1 → 2 → 1 avec deux transitions de chaque côté")
