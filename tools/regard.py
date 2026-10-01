# Crée animations/regard/regard.aseprite à partir de la pose de repos : 6 images fixes, seul le regard change.
# L'app en choisit une selon la position de la souris : devant (en haut, au milieu, en bas), puis de côté (en haut, au milieu, en bas).
# Regard dessiné vers la droite, l'app retourne pour la gauche. Le fichier est ensuite à toi : l'outil refuse d'écraser un regard.aseprite existant.
#   python3 tools/regard.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ROOT, create, replace_frames
from rebase import NEW

N8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
# (décalage des yeux, décalage de la bouche) : de côté, les yeux bougent plus que la bouche, comme un visage qui se tourne
LOOKS = [((0, -2), (0, 0)), ((0, 0), (0, 0)), ((0, 2), (0, 0)),
         ((3, -2), (2, 0)), ((3, 0), (2, 0)), ((3, 2), (2, 0))]

def face_of(f):
    """les pixels du visage de la pose de repos : de l'encre entièrement entourée de pixels pleins ; les yeux au-dessus de la ligne 48, la bouche en dessous"""
    ink = {(x, y) for y in range(64) for x in range(64) if f[y][x] == (0, 0, 0, 255) and all(0 <= x + a < 64 and 0 <= y + b < 64 and f[y + b][x + a][3] for a, b in N8)}
    return {p for p in ink if p[1] < 48}, {p for p in ink if p[1] >= 48}
def look(f, eyes, mouth, move_eyes, move_mouth):
    body = f[44][31]                                  # le bleu du corps, entre les deux yeux
    out = [row[:] for row in f]
    for x, y in eyes | mouth: out[y][x] = body
    for part, (dx, dy) in ((eyes, move_eyes), (mouth, move_mouth)):
        for x, y in part: out[y + dy][x + dx] = (0, 0, 0, 255)
    return out

if __name__ == "__main__":
    create("repos/repos", "regard", "regard", [400] * len(LOOKS))
    eyes, mouth = face_of(NEW)
    replace_frames("regard", "regard", [look(NEW, eyes, mouth, e, m) for e, m in LOOKS])
    print("regard créée :", len(LOOKS), "images")
