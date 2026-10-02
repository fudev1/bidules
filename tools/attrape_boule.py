# Crée animations/attrape-boule/attrape-boule.aseprite : la goutte « tenue par la souris » (une boule parfaite, avec une pointe qui se termine par le
# curseur), comme l'app la dessine quand on décolle un Bidule éveillé, mélangée avec le visage et les bras d'attrape.
# Ce fichier montre la goutte À L'ÉQUILIBRE. En jeu, le code dessine la boule et sa queue en direct (ressort, effet yoyo, balancement) ; de ce fichier,
# il ne prend que ce que l'image ajoute à la goutte nue (visage, sourcils, bras, sueur : voir boule.parts_of) et le pose sur la boule.
#   la forme   : celle de maskDrop() dans dist/index.html (voir tools/boule.py) : une boule de rayon 0,44 x la hauteur du Bidule, et un cône qui
#                s'amincit jusqu'à la pointe ; les couleurs et les ombres sont celles de styleRender()
#   le visage  : celui de chaque image d'attrape (yeux, sourcils, bouche), recentré sur la boule
#   les bras   : ceux de chaque image d'attrape (en haut, en bas, en alternance), recollés sur les côtés de la boule
#   la sueur   : celle d'attrape, à la même place
# La pointe est à la ligne 11, comme attrape : la prise par la tête reste au même endroit. Le fichier est ensuite à toi : l'outil refuse d'écraser un
# attrape-boule.aseprite existant.
#   python3 tools/attrape_boule.py
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ROOT, ase, create, frames, replace_frames
from boule import BASE, LIGHT, BX, BY, ball

FACE_BOX = (28, 40, 25, 39)                     # x0, x1, y0, y1 : le visage dans les images d'attrape (yeux, sourcils, bouche)
FACE_CENTER = (34.0, 32.0)                      # son centre, qui va au centre de la boule (un pixel plus bas)
ARM_ROWS = (24, 38)                             # lignes où les bras d'attrape sortent du corps
ARM_ROOT = 28                                   # ligne d'attache des bras dans attrape
SWEAT = (50, 64, 8, 24)                         # x0, x1, y0, y1 : la goutte de sueur d'attrape
SWEAT_DY = -4                                   # remontée de la goutte, pour qu'elle ne touche pas la main droite levée

def edge(f, y, side):
    xs = [x for x in range(64) if f[y][x][3]]
    return min(xs) if side < 0 else max(xs)
def arms(f):
    """les deux bras d'une image d'attrape : les pixels à l'extérieur du corps, dont le bord est tiré des lignes où il n'y a pas de bras"""
    out = {-1: ({}, 0), 1: ({}, 0)}
    for side in (-1, 1):
        pixels = {}
        e0, e1 = edge(f, ARM_ROWS[0] - 1, side), edge(f, ARM_ROWS[1] + 1, side)
        for y in range(ARM_ROWS[0], ARM_ROWS[1] + 1):
            body = e0 + (e1 - e0) * (y - ARM_ROWS[0] + 1) / (ARM_ROWS[1] - ARM_ROWS[0] + 2)
            for x in range(64):
                # à droite, le contour du corps déborde d'un pixel de la droite tirée entre les deux lignes sans bras : on ne le prend pas pour un bras
                if f[y][x][3] and (x < round(body) if side < 0 else x > round(body) + 1): pixels[(x, y)] = f[y][x]
        # les pixels du bras, et la colonne juste à côté de laquelle il commence (le contour du corps à l'attache, un pixel de plus à droite)
        out[side] = (pixels, round(e0 + (e1 - e0) * (ARM_ROOT - ARM_ROWS[0] + 1) / (ARM_ROWS[1] - ARM_ROWS[0] + 2)) + (1 if side > 0 else 0))
    return out

def compose(src, body, bmask):
    f = [row[:] for row in body]
    # les bras : recollés sur les côtés de la boule, à hauteur du haut du visage ; le contour de la boule s'ouvre à l'attache, comme dans attrape
    root_y = int(round(BY - 3.5)); dy = root_y - ARM_ROOT; shapes = arms(src)
    for side in (-1, 1):
        ex = (min if side < 0 else max)(x for (x, y) in bmask if y == root_y)
        pixels, root_x = shapes[side]; dx = ex - root_x
        for (x, y), c in pixels.items():
            if 0 <= x + dx < 64 and 0 <= y + dy < 64: f[y + dy][x + dx] = c
        if f[root_y][ex + side][3] and f[root_y][ex][:3] == (0, 0, 0): f[root_y][ex] = BASE
    # le visage : tout ce qui n'est pas le bleu de base ni le reflet, dans la boîte du visage, recentré sur le centre de la boule
    fx0, fx1, fy0, fy1 = FACE_BOX; mx, my = int(round(BX - FACE_CENTER[0])), int(round(BY + 1 - FACE_CENTER[1]))
    for y in range(fy0, fy1 + 1):
        for x in range(fx0, fx1 + 1):
            c = src[y][x]
            if c[3] and c != BASE and c != LIGHT: f[y + my][x + mx] = c
    # la goutte de sueur d'attrape, si cette image en a une
    sx0, sx1, sy0, sy1 = SWEAT
    for y in range(sy0, sy1 + 1):
        for x in range(sx0, sx1):
            if src[y][x][3]: f[y + SWEAT_DY][x] = src[y][x]
    return f

if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:                    # les images d'attrape telles qu'elles sont enregistrées
        ase(f"{ROOT}/animations/attrape/attrape.aseprite", "--sheet", f"{tmp}/s.png", "--sheet-type", "horizontal")
        src = frames(f"{tmp}/s.png")
    body, bmask = ball()
    create("repos/repos", "attrape-boule", "attrape-boule", [110] * len(src))
    replace_frames("attrape-boule", "attrape-boule", [compose(s, body, bmask) for s in src])
    print("attrape-boule créée :", len(src), "images")
