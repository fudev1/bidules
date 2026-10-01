# Dessine un petit bras sur le côté du corps d'une image de face : 3 pixels d'épaisseur, contour noir, petite main au bout.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rebase import bounds, row_span

INK, BODY = (0, 0, 0, 255), (0x63, 0x9b, 0xff, 255)
N4 = [(0, -1), (-1, 0), (1, 0), (0, 1)]

def arm(f, side, n, root_above=13, rise=1):
    """side : -1 (gauche) ou 1 (droite) ; n : longueur ; root_above : lignes entre le sol et l'attache ; rise : pixels montés par pixel avancé
    (1 = 45° vers le haut, 0 = à l'horizontale, négatif = vers le bas). Dessine par-dessus f (modifiée) et la rend."""
    top, g = bounds(f); y0 = g - root_above
    l, r = row_span(f, y0); x0 = l if side < 0 else r
    rise_at = lambda t: int(round(rise * t))
    limb = {(x0 + side * (t + u), y0 - rise_at(t)) for t in range(n + 1) for u in (0, 1, 2)}
    hand = {(x0 + side * (n + 1 + a), y0 - rise_at(n) + b) for a in (-1, 0, 1) for b in (-1, 0, 1)} if n >= 4 else set()
    shape = limb | hand
    body = {(x, y) for y in range(64) for x in range(64) if f[y][x][3]}
    for (x, y) in {(x + a, y + b) for x, y in shape for a, b in N4} - shape - body:       # contour, sauf là où le bras touche le corps
        if 0 <= x < 64 and 0 <= y < 64: f[y][x] = INK
    for (x, y) in shape:
        if 0 <= x < 64 and 0 <= y < 64: f[y][x] = BODY
    return f
