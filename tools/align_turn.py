# Aligne le demi-tour (turn) sur la reptation redessinée (crawl). Outil à usage unique : il reconstruit les 13 images du demi-tour
# à partir de l'ancien demi-tour (commit d3880f2, animations/turn/turn_sheet.png, images 8 à 20) et de animations/crawl/crawl_sheet.png.
#   python3 tools/align_turn.py /tmp/turn_aligned         écrit turn_000.png ... turn_012.png dans ce dossier
#
# Ce que fait l'app : elle retourne l'image entière autour d'un axe (calculé depuis crawl[0] et la dernière image de turn) dès que la
# limace va à gauche. Pour que reptation droite -> demi-tour -> reptation gauche soit sans saut, il faut donc :
#   turn[0]  = crawl[0] (au pixel près)
#   turn[12] = le miroir de crawl[0] autour de l'axe (lumière comprise : le reflet passe de l'autre côté)
#   le reste du demi-tour passe de l'un à l'autre en gardant le corps centré sur l'axe.
# La nouvelle reptation fait 60 pixels de large (x de 2 à 61) : une fois retournée autour de l'ancien axe (36,5) elle sortirait de l'image,
# l'axe doit être entre 30,5 et 32,5. On prend 32,5 ; les images de face (centre 36,5 avant) sont décalées de 4 pixels vers la gauche.
import json, os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "animations", "limace-complete"))
from png import frames, write

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
AXIS2 = 65            # 2 * 32,5 : x -> 65 - x
SHIFT = -4            # centre de face 36,5 -> 32,5
INK = (0, 0, 0, 255)
CLEAR = (0, 0, 0, 0)
N8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
N4 = [(0, -1), (-1, 0), (1, 0), (0, 1)]

def blank(): return [[CLEAR] * 64 for _ in range(64)]
def opaque(f, x, y): return 0 <= x < 64 and 0 <= y < 64 and f[y][x][3] > 0
def shift(f, dx):
    o = blank()
    for y in range(64):
        for x in range(64):
            if f[y][x][3]:
                assert 0 <= x + dx < 64, "image rognée"
                o[y][x + dx] = f[y][x]
    return o
def mirror(f):
    o = blank()
    for y in range(64):
        for x in range(64):
            if f[y][x][3]:
                assert 0 <= AXIS2 - x < 64, "image rognée par le miroir"
                o[y][AXIS2 - x] = f[y][x]
    return o
def extent(f):
    xs = [x for y in range(64) for x in range(64) if f[y][x][3]]; ys = [y for y in range(64) for x in range(64) if f[y][x][3]]
    return min(xs), max(xs), min(ys), max(ys)

# --- fabrication des deux images intermédiaires : on déforme chaque ligne (extrémités interpolées), puis on redessine le contour ---
def parts(f):
    """sépare une image en : visage (encre entièrement entourée de pixels pleins) et remplissage (sans encre, contour comblé par l'intérieur)"""
    face = {(x, y) for y in range(64) for x in range(64) if f[y][x] == INK and all(opaque(f, x + a, y + b) for a, b in N8)}
    fill = [row[:] for row in f]
    def vote(x, y, bad):
        votes = {}
        for a, b in N8:
            p = (x + a, y + b)
            if opaque(f, *p) and f[p[1]][p[0]] != INK and p not in bad: votes[f[p[1]][p[0]]] = votes.get(f[p[1]][p[0]], 0) + 1
        return max(votes, key=votes.get) if votes else None
    todo = [(x, y) for y in range(64) for x in range(64) if f[y][x] == INK]
    for _ in range(3):
        left = []
        for x, y in todo:
            c = vote(x, y, set(todo)) or vote(x, y, set())
            if c: fill[y][x] = c
            else: left.append((x, y))
        todo = left
    return face, fill

def morph(A, B, t):
    ea, eb = extent(A), extent(B)
    fa, ma = parts(A); fb, mb = parts(B)
    bot = round(ea[3] + (eb[3] - ea[3]) * t)
    ha, hb = ea[3] - ea[2] + 1, eb[3] - eb[2] + 1
    height = round(ha + (hb - ha) * t)
    def row(f, top, bottom, r):                      # étendue de la ligne située r pixels au-dessus du bas ; en haut on garde la dernière ligne
        y = max(top, bottom - r)
        xs = [x for x in range(64) if f[y][x][3]]
        return y, min(xs), max(xs)
    mask, out = {}, blank()
    for r in range(height):
        ya, la, ra = row(A, ea[2], ea[3], r); yb, lb, rb = row(B, eb[2], eb[3], r)
        l = round(la + (lb - la) * t); rr = round(ra + (rb - ra) * t)
        src = (ma, ya, la, ra) if t < .5 else (mb, yb, lb, rb)
        for x in range(l, rr + 1):
            u = (x - l + .5) / (rr - l + 1)
            out[bot - r][x] = src[0][src[1]][min(src[3], src[2] + int(u * (src[3] - src[2] + 1)))]
            mask[(x, bot - r)] = 1
    for (x, y) in mask:                              # contour : tout pixel dont un voisin direct est vide
        if any((x + a, y + b) not in mask for a, b in N4): out[y][x] = INK
    # visage : celui de l'image de départ puis celui de l'image d'arrivée, déplacé de la même fraction du chemin
    fsrc, ref = (fa, ea) if t < .5 else (fb, eb)
    ca = (sum(p[0] for p in fa) / len(fa), sum(p[1] - ea[3] for p in fa) / len(fa)); cb = (sum(p[0] for p in fb) / len(fb), sum(p[1] - eb[3] for p in fb) / len(fb))
    cs = ca if t < .5 else cb
    dx = round(ca[0] + (cb[0] - ca[0]) * t - cs[0]); dy = round(ca[1] + (cb[1] - ca[1]) * t - cs[1]) + (bot - ref[3])
    for x, y in fsrc:
        p = (x + dx, y + dy)
        if p in mask and all((p[0] + a, p[1] + b) in mask for a, b in N8): out[p[1]][p[0]] = INK
    return out

def main(dest):
    crawl0 = frames(os.path.join(ROOT, "animations/crawl/crawl_sheet.png"))[0]
    old = subprocess.run(["git", "show", "d3880f2:animations/turn/turn_sheet.png"], cwd=ROOT, capture_output=True, check=True).stdout
    tmp = os.path.join(dest, "_old_turn.png"); os.makedirs(dest, exist_ok=True); open(tmp, "wb").write(old)
    turn = frames(tmp)[8:21]; os.remove(tmp)
    T = [None] * 13
    T[0] = crawl0
    for k in range(3, 7): T[k] = shift(turn[k], SHIFT)
    T[1], T[2] = morph(crawl0, T[3], 1 / 3), morph(crawl0, T[3], 2 / 3)
    for k in range(7, 12): T[k] = mirror(T[12 - k])
    T[12] = mirror(crawl0)
    for k, f in enumerate(T): write(os.path.join(dest, f"turn_{k:03d}.png"), f)
    print("bbox :", [extent(f)[:2] for f in T])

if __name__ == "__main__": main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/turn_aligned")
