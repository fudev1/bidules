# Remplace la "jupe" symétrique du bas de l'ancienne pose de face par la base de repos (côté droit droit, petite queue à gauche).
# Utilisé par tools/rebase_animations.py ; une image est une liste de 64 lignes de 64 pixels RGBA (comme animations/limace-complete/png.py).
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "animations", "limace-complete"))
from png import frames, write

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
INK = (0, 0, 0, 255)
CLEAR = (0, 0, 0, 0)
K = 9                                             # ligne de référence : K lignes au-dessus du sol, juste avant le début de la queue
N4 = [(0, -1), (-1, 0), (1, 0), (0, 1)]

def row_span(f, y):
    xs = [x for x in range(64) if f[y][x][3]]
    return (min(xs), max(xs)) if xs else None
def bounds(f):
    ys = [y for y in range(64) if row_span(f, y)]
    return min(ys), max(ys)

# profil de la base : de combien, en partant du bas, chaque côté dépasse (ou rentre) par rapport à la ligne g-7 ; mesuré sur l'ancienne pose de face (turn) et sur repos
OLD = frames(os.path.join(ROOT, "animations/turn/turn_sheet.png"))[6]
NEW = frames(os.path.join(ROOT, "animations/repos/repos_sheet.png"))[0]
def profile(f):
    top, g = bounds(f); l0, r0 = row_span(f, g - K)
    return [(l0 - row_span(f, g - d)[0], row_span(f, g - d)[1] - r0) for d in range(K)]       # d = 0 : la ligne du sol
PROFILE = profile(NEW)

def needs(f):
    top, g = bounds(f)
    if g - top < 14 or g < 58: return False       # flaques, étirements courts, images en l'air : pas de jupe
    if any(row_span(f, y) is None for y in range(g - K, g + 1)): return False
    l0, r0 = row_span(f, g - K)
    wide = max(row_span(f, y)[1] - row_span(f, y)[0] for y in range(g - K + 1, g + 1))
    return wide - (r0 - l0) >= 4                  # une jupe : une des K dernières lignes est nettement plus large que la ligne g-7

def rebase(f):
    """f : image de face avec jupe -> la même avec la base de repos ; les lignes au-dessus de g-7 ne changent pas"""
    if not needs(f): return f
    top, g = bounds(f); y0 = g - K
    l0, r0 = row_span(f, y0)
    out = [row[:] for row in f]
    for y in range(y0 + 1, g + 1): out[y] = [CLEAR] * 64
    # couleur du remplissage : celle de l'image d'origine sur la même ligne (le plus proche pixel non noir)
    def fill(y, x):
        l, r = row_span(f, y) or row_span(f, y0)
        xs = [k for k in range(l, r + 1) if f[y][k][3] and f[y][k] != INK] or [k for k in range(l0, r0 + 1) if f[y0][k][3] and f[y0][k] != INK]
        return f[y][min(xs, key=lambda k: abs(k - x))]
    mask = {}
    for y in range(y0 + 1, g + 1):
        ol, orr = PROFILE[g - y]
        for x in range(l0 - ol, r0 + orr + 1): mask[(x, y)] = fill(y, x)
    for y in range(y0 + 1):                       # la ligne y0 fait partie du corps : on s'en sert pour fermer le contour
        for x in range(64):
            if f[y][x][3]: mask.setdefault((x, y), f[y][x])
    inside = lambda x, y: 0 <= x < 64 and 0 <= y < 64 and f[y][x][3] > 0
    for (x, y), c in mask.items():
        if y > y0:
            if any((x + a, y + b) not in mask for a, b in N4): out[y][x] = INK
            elif inside(x, y) and all(inside(x + a, y + b) for a, b in N4): out[y][x] = f[y][x]      # intérieur d'origine (visage, ombres) : on le garde
            else: out[y][x] = c
    return out

if __name__ == "__main__":
    # contrôle : l'ancienne pose de face, une fois rebasée, doit redonner le bas de repos
    r = rebase(OLD)
    diff = [(x, y) for y in range(54, 61) for x in range(64) if r[y][x] != NEW[y][x]]
    print("pixels différents du bas de repos :", len(diff), diff[:20])
    for y in range(50, 61): print("%2d " % y + "".join(("#" if r[y][x][:3] == (0, 0, 0) else "o") if r[y][x][3] else "." for x in range(0, 64)))
