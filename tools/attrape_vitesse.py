# attrape-boule : aligne les 4 images sur l'image 1 (dessinée à la main) et dessine la vitesse des bras qui s'agitent.
#   images 1 et 3 : l'image 1, bras levés, petite bouche, sueur ; images 2 et 4 : l'image 1 avec les bras baissés et la bouche ouverte de l'image 2, sans sueur
#   la vitesse : sur chaque image, l'autre position des bras en fantôme (bleu pâle, tramé) et deux arcs de vitesse au bout des mains (bleu ombre, pointillés)
# Le fond des bouches est violet foncé, comme les autres bouches de la limace. Le jeu ne prend que l'encre et le bleu des bras (tools/boule.py), pas ces effets.
#   python3 tools/attrape_vitesse.py      (relancer après avoir retouché l'image 1 ou les bras baissés de l'image 2)
#   python3 tools/attrape_vitesse.py --live copie.aseprite dossier
#     lit une copie du sprite ouvert (aseprite_save copy) et écrit f1.json à f4.json pour aseprite_pixel_map :
#     Aseprite ne relit pas un fichier modifié sur le disque, l'aseprite-live dessine donc dans le sprite ouvert
import math, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ROOT, ase, frames, replace_frames
from boule import ball, in_sweat, pivots

INK, BASE, SHADE, LIGHT, MOUTH_IN, CLEAR = (0, 0, 0, 255), (99, 155, 255, 255), (69, 119, 224, 255), (164, 198, 255, 255), (63, 63, 116, 255), (0, 0, 0, 0)
FACE = (24, 40, 26, 44)                       # x0, x1, y0, y1 : yeux et bouche, dans la boule
MOUTH = (27, 37, 36, 44)                      # la bouche seule

def arm_pixels(f, mask):
    """les bras : ce qui dépasse de la boule, hors sueur"""
    return {(x, y): f[y][x] for y in range(64) for x in range(64) if f[y][x][3] and (x, y) not in mask and not in_sweat(x, y)}
def mouth_violet(f):
    """le fond du « o » (bleu ombre entouré d'encre sur sa ligne) devient violet foncé"""
    x0, x1, y0, y1 = MOUTH
    for y in range(y0, y1 + 1):
        row = f[y]
        for x in range(x0, x1 + 1):
            if row[x] == SHADE and any(row[i] == INK for i in range(x0, x)) and any(row[i] == INK for i in range(x + 1, x1 + 1)) and f[y - 1][x] in (INK, SHADE, MOUTH_IN) and f[y + 1][x] in (INK, SHADE, MOUTH_IN):
                row[x] = MOUTH_IN
    return f
def compose(base, arms, mouth_src, sweat, ghost, mask):
    f = [row[:] for row in base]
    for (x, y) in arm_pixels(base, mask): f[y][x] = CLEAR                 # on retire les bras de l'image 1
    for y in range(64):                                                    # et sa sueur
        for x in range(64):
            if in_sweat(x, y) and (x, y) not in mask: f[y][x] = CLEAR
    if mouth_src is not base:                                              # la bouche de l'autre image
        x0, x1, y0, y1 = MOUTH
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): f[y][x] = mouth_src[y][x]
    mouth_violet(f)
    # la vitesse : les bras de l'autre position en fantôme tramé, puis deux arcs au bout des mains, sous les bras de l'image
    for (x, y) in ghost:
        if not f[y][x][3] and (x + y) % 2 == 0: f[y][x] = LIGHT
    for side, P in enumerate(pivots()):
        pts = [p for p in list(arms) + list(ghost) if (p[0] > P[0]) == bool(side)]
        if not pts: continue
        r = max(math.hypot(x + .5 - P[0], y + .5 - P[1]) for x, y in pts)
        angs = [math.atan2(-(y + .5 - P[1]), x + .5 - P[0]) for x, y in pts if math.hypot(x + .5 - P[0], y + .5 - P[1]) > r - 3]
        if side == 0: angs = [a % (2 * math.pi) for a in angs]
        a0, a1 = min(angs), max(angs)
        for dr in (2.5, 4.5):
            n = int((a1 - a0) * (r + dr)) + 1
            for i in range(n + 1):
                a = a0 + (a1 - a0) * i / max(1, n)
                x, y = int(math.floor(P[0] + (r + dr) * math.cos(a))), int(math.floor(P[1] - (r + dr) * math.sin(a)))
                if 0 <= x < 64 and 0 <= y < 64 and not f[y][x][3] and (x + y + (dr > 3)) % 2 == 0: f[y][x] = SHADE
    for (x, y), c in arms.items(): f[y][x] = c                             # les bras de cette image, par-dessus
    for (x, y), c in sweat.items(): f[y][x] = c
    return f

if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        live = sys.argv[1:2] == ["--live"]
        ase(sys.argv[2] if live else f"{ROOT}/animations/attrape-boule/attrape-boule.aseprite", "--sheet", f"{tmp}/s.png", "--sheet-type", "horizontal")
        src = frames(f"{tmp}/s.png")
    _, mask = ball()
    clean = lambda f: {p: c for p, c in arm_pixels(f, mask).items() if c in (INK, BASE)}        # les bras sans effets de vitesse
    up, down = clean(src[0]), clean(src[1])
    sweat = {(x, y): src[0][y][x] for y in range(64) for x in range(64) if in_sweat(x, y) and src[0][y][x][3] and (x, y) not in mask}
    f1 = compose(src[0], up, src[0], sweat, down, mask)
    f2 = compose(src[0], down, src[1], {}, up, mask)
    if live:
        import json
        for i, f in enumerate([f1, f2, f1, f2]):
            keys, rows = {CLEAR: "z"}, []
            for row in f:
                rows.append("".join(keys.setdefault(c, "abcdefghijklmnopqrstuvwxy"[len(keys) - 1]) for c in row))
            pal = {k: "#%02x%02x%02x%02x" % c for c, k in keys.items()}
            json.dump({"palette": pal, "rows": rows}, open(f"{sys.argv[3]}/f{i + 1}.json", "w"))
        sys.exit(print("f1.json à f4.json écrits"))
    replace_frames("attrape-boule", "attrape-boule", [f1, f2, f1, f2])
    print("attrape-boule : 4 images alignées sur l'image 1, vitesse des bras dessinée")
