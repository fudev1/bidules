# Déforme la pose de repos (silhouette, queue, visage) : écrasée, étirée, pincée en haut, ondulée. Le contour est refait à chaque fois.
# Le corps est déformé autour de son axe (31,5) et du sol (ligne 60).
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from align_turn import parts
from rebase import NEW

INK, CLEAR = (0, 0, 0, 255), (0, 0, 0, 0)
N4 = [(0, -1), (-1, 0), (1, 0), (0, 1)]
N8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
CX, GROUND, TOP = 31.5, 60.5, 32.0           # axe du corps, bas du contour (bord bas de la ligne 60), haut du contour (bord haut de la ligne 32)
H = GROUND - TOP
FACE, FILL = parts(NEW)
ALPHA = lambda x, y: 0 <= x < 64 and 0 <= y < 64 and NEW[y][x][3] > 0

def lift_for_top(sy, top):
    """décalage vertical qui amène le haut du corps sur la ligne `top` (le corps est alors décollé du sol)"""
    return top - GROUND + H * sy

def _x_of(sx, neck, shear, wob, v):
    t = (GROUND - v) / H; tc = max(0, min(1, t))
    return sx * (1 - neck * tc ** 1.5), shear * t + wob * math.sin(tc * math.pi)

def squash(sx, sy, neck=0, wob=0, shear=0, dy=0, face=True):
    """sx, sy : largeur et hauteur relatives ; neck : pincement en haut (0 à 1) ; wob : ventre qui ondule (pixels) ; shear : décalage du haut (pixels) ;
    dy : décalage vertical (négatif = vers le haut) ; face : garder le visage de repos (sinon le dessiner soi-même avec forward)"""
    def src(x, y):
        v = GROUND - (GROUND - (y + .5) + dy) / sy
        sxe, off = _x_of(sx, neck, shear, wob, v)
        return int(math.floor(CX + (x + .5 - CX - off) / sxe)), int(math.floor(v))
    mask = {(x, y) for y in range(64) for x in range(64) if ALPHA(*src(x, y))}
    out = [[CLEAR] * 64 for _ in range(64)]
    for (x, y) in mask:
        u, v = src(x, y)
        out[y][x] = INK if any((x + a, y + b) not in mask for a, b in N4) else FILL[v][u]
    if face:
        for (x, y) in mask:                   # visage : l'encre intérieure de la pose de repos, bien entourée
            if src(x, y) in FACE and all((x + a, y + b) in mask for a, b in N8): out[y][x] = INK
    def forward(u, v):
        """où va le point (u, v) de la pose de repos (coordonnées de bord, pas de pixel)"""
        sxe, off = _x_of(sx, neck, shear, wob, v)
        return int(math.floor(CX + (u - CX) * sxe + off)), int(math.floor(GROUND - (GROUND - v) * sy + dy))
    return out, forward
