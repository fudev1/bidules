# Les cheveux de la limace (premier essai d'évolution) : six poses, que l'app pose en direct sur le sommet de la tête, avec un ressort (inertie).
#   python3 tools/cheveux.py   (relancé par mise run publier)
# - animations/cheveux/cheveux-poses.aseprite : les six poses, 32 × 20, la racine au milieu du bas (x 16, ligne 20 = le sommet de la tête).
#   Images 1 à 5 : penchés à gauche fort, à gauche, droits, à droite, à droite fort ; image 6 : ébouriffés (un choc).
#   Créé à partir des mèches du modèle (MECHES) seulement s'il n'existe pas :
#   ensuite il est à retoucher à la main, le script ne l'écrase jamais.
# - dist/persos/limace/cheveux-poses.png : ces six poses côte à côte, pour l'app (dist/index.html, hairStep).
import math, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bidules import ROOT, ASE, lire_png
import png

W, H, RX, RY = 32, 20, 16, 20                     # taille d'une pose ; la racine : x 16, juste sous la dernière ligne
V4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
CLEAR = (0, 0, 0, 0)
DST = f"{ROOT}/animations/cheveux"; ASEF = f"{DST}/cheveux-poses.aseprite"

# les trois mèches du modèle (animations/cheveux/cheveux-modele.png), relevées à la main : des points relatifs à la racine (0, 0 = le pixel juste
# au-dessus du sommet de la tête), dy négatif vers le haut. Au milieu la longue, qui s'enroule à gauche au bout ; à gauche un crochet ; à droite une boucle.
MECHES = [[(0, 0), (0, -6), (-1, -7), (-1, -8), (-2, -9), (-3, -9)],
          [(0, -2), (-1, -2), (-2, -3), (-3, -4), (-4, -3), (-4, -2)],
          [(1, -2), (1, -3), (2, -4), (3, -5), (4, -6), (5, -6), (6, -5)]]
INK = (0, 0, 0, 255)

def trait(g, a, b):
    """une ligne d'un pixel d'épaisseur, sans trou (Bresenham)"""
    (x0, y0), (x1, y1) = a, b; dx, dy = abs(x1 - x0), -abs(y1 - y0); sx, sy = (1 if x1 > x0 else -1), (1 if y1 > y0 else -1); e = dx + dy
    while True:
        if 0 <= x0 < W and 0 <= y0 < H: g[y0][x0] = INK
        if (x0, y0) == (x1, y1): return
        e2 = 2 * e
        if e2 >= dy: e += dy; x0 += sx
        if e2 <= dx: e += dx; y0 += sy

def pose(angle, ecart=0, haut=1.0):
    """angle : les mèches plient de côté (degrés, négatif : à gauche), d'autant plus qu'on monte ; ecart : les mèches de côté s'écartent (ébouriffés)"""
    g = [[CLEAR] * W for _ in range(H)]
    for k, m in enumerate(MECHES):
        a0 = angle + (-ecart if k == 1 else ecart if k == 2 else 0)
        pts = []
        for dx, dy in m:
            h = min(1, -dy / 9); t = math.radians(a0) * h ** 1.3; dy *= haut
            pts.append((RX + round(dx * math.cos(t) - dy * math.sin(t)), RY - 1 + round(dx * math.sin(t) + dy * math.cos(t))))
        for a, b in zip(pts, pts[1:]): trait(g, a, b)
    return g

if not os.path.exists(ASEF):
    poses = [pose(a) for a in (-38, -18, 0, 18, 38)] + [pose(0, 50, 1.2)]
    with tempfile.TemporaryDirectory() as t:
        for k, g in enumerate(poses): png.write(f"{t}/{k}.png", g)
        lua = f'''local spr = Sprite({W}, {H}, ColorMode.RGB)
for i = 1, {len(poses)} do
  if i > 1 then spr:newEmptyFrame() end
  spr:newCel(spr.layers[1], i, Image{{fromFile = "{t}/" .. (i - 1) .. ".png"}}, Point(0, 0))
end
spr:saveAs("{ASEF}")
'''
        open(f"{t}/c.lua", "w").write(lua); subprocess.run([ASE, "-b", "--script", f"{t}/c.lua"], check=True, capture_output=True)
    print("créé :", ASEF)
subprocess.run([ASE, "-b", ASEF, "--sheet", f"{ROOT}/dist/persos/limace/cheveux-poses.png", "--sheet-type", "horizontal"], check=True, capture_output=True)
print("exporté : dist/persos/limace/cheveux-poses.png")
