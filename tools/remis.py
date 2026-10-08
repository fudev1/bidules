# remis : la nausée passée, il se secoue la tête de droite à gauche avant de reprendre sa marche. De profil, tiré de la reptation
# (crawl.aseprite, image 12, celle où sont dessinés les visages des humeurs) : la tête entière, menton compris (jusqu'à la ligne 47), se décale
# d'un bloc, sans toucher au visage ; le cou s'incline pour la raccorder au corps, qui reste posé (ligne 56 et dessous). Le contour est refait.
# Les décalages vont de droite à gauche, de moins en moins forts et de plus en plus lents, et finissent sur la pose de la reptation.
#   python3 tools/remis.py          (crée animations/remis/remis.aseprite ; refuse de l'écraser : supprime-le pour le refaire)
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ROOT, create, replace_frames, frames

INK, CLEAR = (0, 0, 0, 255), (0, 0, 0, 0)
HEAD, BODY = 47, 56                 # lignes : jusqu'à HEAD, la tête bouge entière ; à partir de BODY, rien ne bouge ; entre les deux, le cou
SHAKE = [(4, 60), (-4, 60), (3, 70), (-3, 70), (2, 80), (-1, 90), (0, 120)]     # (décalage du haut de la tête en pixels, durée en ms)

def opaque(f, x, y): return 0 <= x < 64 and 0 <= y < 64 and f[y][x][3] > 0
def shake(f, a):
    s = lambda y: a if y <= HEAD else round(a * (BODY - y) / (BODY - HEAD)) if y < BODY else 0
    edge = {(x, y) for y in range(64) for x in range(64) if f[y][x] == INK and any(not opaque(f, x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1))}
    g, moved = [[CLEAR] * 64 for _ in range(64)], set()
    for y in range(64):
        for x in range(64):
            if f[y][x][3] and 0 <= x + s(y) < 64:
                g[y][x + s(y)] = f[y][x]
                if (x, y) in edge: moved.add((x + s(y), y))
    h = [r[:] for r in g]
    for x, y in moved:              # un pixel de contour qui n'est plus au bord prend la couleur du corps autour
        if all(opaque(g, x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1)):
            nb = [g[y + j][x + i] for i, j in ((0, 1), (0, -1), (-1, 0), (1, 0)) if g[y + j][x + i] != INK]
            if nb: h[y][x] = max(set(nb), key=nb.count)
    for y in range(64):             # le corps mis à nu au bord : le contour s'y referme
        for x in range(64):
            if h[y][x][3] and h[y][x] != INK and any(not opaque(h, x + i, y + j) for i, j in ((0, 1), (0, -1), (-1, 0), (1, 0))): h[y][x] = INK
    return h

if __name__ == "__main__":
    base = frames(f"{ROOT}/animations/crawl/crawl_sheet.png")[11]
    create("crawl/crawl", "remis", "remis", [d for a, d in SHAKE])
    replace_frames("remis", "remis", [shake(base, a) for a, d in SHAKE])
    print("écrit : animations/remis/remis.aseprite")
