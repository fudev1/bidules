# La goutte (une boule et un cône qui s'amincit jusqu'à la pointe tenue par la souris) : la forme et les couleurs que dist/index.html dessine en direct
# (maskDrop et styleRender de pullDraw, et swingDraw pour le Bidule tenu par la tête). Partagé par tools/attrape_boule.py et gen.py.
import math

INK, BASE, SHADE, LIGHT, CLEAR = (0, 0, 0, 255), (99, 155, 255, 255), (69, 119, 224, 255), (164, 198, 255, 255), (0, 0, 0, 0)
H = 29                                          # hauteur du Bidule (la pose de repos) : la boule fait 0,44 de cette hauteur
R = H * .44                                     # rayon de la boule
L = R + 3                                       # longueur du ressort au repos (comme pullStep)
GX, GY = 31.5, 11.0                             # le point tenu : la pointe
BX, BY = GX, GY + L + 900 / 110                 # le centre de la boule à l'équilibre : le ressort s'allonge de 900 / 110 sous la pesanteur

def ball():
    """le masque de la goutte à l'équilibre, puis les couleurs comme styleRender ; rend (image, masque)"""
    mask = set()
    for y in range(64):
        for x in range(64):
            X, Y = x + .5, y + .5
            if math.hypot(X - BX, Y - BY) <= R: mask.add((x, y)); continue
            dx, dy = BX - GX, BY - GY; t = max(0, min(1, ((X - GX) * dx + (Y - GY) * dy) / (dx * dx + dy * dy)))
            if math.hypot(X - GX - t * dx, Y - GY - t * dy) <= (1.4 + (R * 1.9 - 1.4) * t) / 2: mask.add((x, y))
    # un pixel isolé sous la boule (le bas du cercle ne touche qu'un pixel) : on l'enlève
    mask = {(x, y) for (x, y) in mask if y <= BY or sum((x + a, y + b) in mask for a, b in ((0, -1), (-1, 0), (1, 0), (0, 1))) >= 2}
    inn = lambda x, y: (x, y) in mask
    inner = lambda x, y: inn(x, y) and inn(x + 1, y) and inn(x - 1, y) and inn(x, y + 1) and inn(x, y - 1)
    t0, b0 = min(p[1] for p in mask), max(p[1] for p in mask); c0 = (min(p[0] for p in mask) + max(p[0] for p in mask)) / 2
    f = [[CLEAR] * 64 for _ in range(64)]
    for (x, y) in mask:
        c = BASE
        if not inner(x, y): c = INK
        elif not inner(x, y + 3) or not inner(x + 2, y): c = SHADE
        elif (not inner(x - 3, y - 1) and x < c0 and y < b0 - 7) or (not inner(x - 1, y - 3) and x < c0 + 3 and y < t0 + 6): c = LIGHT
        f[y][x] = c
    return f, mask

SWEAT_BOX = (50, 0, 63, 22)                     # x0, y0, x1, y1 : la goutte de sueur (en haut à droite) ; les mains levées sont plus bas
ROOT_Y = int(round(BY - 3.5))                   # ligne où les bras s'attachent sur la boule (3 pixels et demi au-dessus de son centre)

def in_sweat(x, y): return SWEAT_BOX[0] <= x <= SWEAT_BOX[2] and SWEAT_BOX[1] <= y <= SWEAT_BOX[3]

def parts_of(frame):
    """ce que l'image ajoute à la goutte nue au milieu de la boule : le visage et les sourcils (et toute retouche à la main), et la sueur ; le reste est
    transparent. Le code les pose sur la goutte qu'il dessine, au même endroit que la boule."""
    base, mask = ball()
    return [[frame[y][x] if frame[y][x][3] and frame[y][x] != base[y][x] and ((x, y) in mask and abs(x + .5 - BX) < R - 2 or in_sweat(x, y)) else CLEAR for x in range(64)] for y in range(64)]

def arms_of(frame):
    """les bras d'une image : tout ce qui dépasse de la boule (hors sueur). Le code les fait tourner autour de leur attache, avec des poses fantômes."""
    base, mask = ball()
    return [[frame[y][x] if frame[y][x][3] and (x, y) not in mask and not in_sweat(x, y) else CLEAR for x in range(64)] for y in range(64)]

def pivots():
    """les points d'attache des deux bras : les pixels du bord de la boule, à la ligne ROOT_Y (centres de pixels)"""
    xs = [x for x in range(64) if math.hypot(x + .5 - BX, ROOT_Y + .5 - BY) <= R]
    return (min(xs) + .5, ROOT_Y + .5), (max(xs) + .5, ROOT_Y + .5)
