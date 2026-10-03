# coule-fin : la fin de la descente le long du mur. Arrivé au sol, le Bidule se détache du mur, tombe en goutte, s'étale puis se reforme en boule et se pose
# dans la pose de repos. Part des 9 images dessinées à la main (animations/coule-fin/base-sprite-0007.aseprite), dessinées contre le mur (colonne 63) :
#   - mises à l'échelle de coule (×1,35 autour du coin bas du mur), bas du contour sur la ligne 60 ;
#   - précédées d'images qui font passer la forme de coule (bosse + traîne contre le mur) à la goutte ;
#   - des images intermédiaires entre les tiennes (formes mélangées par distance au contour, visage de l'image la plus proche) ;
#   - l'ombre et le reflet de la limace (reflet à gauche et en haut, ombre en bas et à droite) recalculés sur chaque forme ;
#   - à la fin, la boule grossit et se pose dans la pose de repos : la dernière image EST la première de repos. Pendant ces dernières images, l'app
#     rapproche la fenêtre de l'écran (elle dépassait de 22 px pour que le corps touche le bord) : le Bidule glisse du mur vers le centre sans saut.
# animations/coule-fin/coule-fin.aseprite est ensuite à toi : create() refuse de l'écraser (supprime-le pour refaire).
#   python3 tools/coule_fin.py
import math, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "animations", "limace-complete"))
from aseprite_io import ROOT, ase, create, replace_frames
from png import frames
import json

INK, BASE, SHADE, LIGHT, WHITE, CLEAR = (0, 0, 0, 255), (99, 155, 255, 255), (69, 119, 224, 255), (164, 198, 255, 255), (255, 255, 255, 255), (0, 0, 0, 0)
S = 1.35                                   # échelle des images dessinées, autour du coin bas du mur
AX, AY = 64.0, 63.0                        # ce coin (bord droit de l'image, ligne 62 + 1 : le bas du contour est ensuite posé sur 60)
sheet = frames(f"{ROOT}/animations/limace-complete/limace_sheet.png")
tags = {t["name"]: t for t in json.load(open(f"{ROOT}/animations/limace-complete/limace_sheet.json"))["meta"]["frameTags"]}
REPOS = sheet[tags["repos"]["from"]]
COULE0 = sheet[tags["coule"]["from"]]

N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
mask_of = lambda f: {(x, y) for y in range(64) for x in range(64) if f[y][x][3]}
def outline(m): return {(x, y) for (x, y) in m if any((x + a, y + b) not in m for a, b in N4)}
def face_of(f, m):
    """le visage : les pixels intérieurs (hors contour) d'encre ou de blanc"""
    edge = outline(m)
    return {(x, y): f[y][x] for (x, y) in m if (x, y) not in edge and f[y][x] in (INK, WHITE)}
def sdf(m):
    """distance signée au contour : négative dedans, positive dehors"""
    ins = list(m); out = [(x, y) for y in range(64) for x in range(64) if (x, y) not in m]
    d = {}
    for (x, y) in out: d[(x, y)] = min(math.hypot(x - a, y - b) for a, b in ins) - .5
    for (x, y) in ins: d[(x, y)] = -(min(math.hypot(x - a, y - b) for a, b in out) - .5)
    return d
def biggest(m):
    todo, best = set(m), set()
    while todo:
        c = {todo.pop()}; st = list(c)
        while st:
            x, y = st.pop()
            for a, b in N4:
                if (x + a, y + b) in todo: todo.remove((x + a, y + b)); c.add((x + a, y + b)); st.append((x + a, y + b))
        if len(c) > len(best): best = c
    return best
centroid = lambda pts: (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)) if pts else None

def render(m, face):
    """le contour, le corps avec son reflet et son ombre, puis le visage"""
    edge = outline(m)
    inn = lambda x, y: ((x >= 63) or (x, y) in m) and (x, y) not in edge
    xs, ys = [p[0] for p in m], [p[1] for p in m]; c0, t0, b0 = (min(xs) + max(xs)) / 2, min(ys), max(ys)
    f = [[CLEAR] * 64 for _ in range(64)]
    for (x, y) in m:
        c = BASE
        if (x, y) in edge and not (x == 63 and (x + 1, y) not in m): c = INK                  # contre le mur, pas de contour de ce côté
        elif not inn(x, y + 2) or not inn(x + 1, y) and x < 63: c = SHADE
        elif (not inn(x - 3, y) and y < b0 - 5) or (not inn(x, y - 2) and x < c0 + 3): c = LIGHT
        f[y][x] = c
    for (x, y), c in face.items():
        if (x, y) in m and (x, y) not in edge: f[y][x] = c
    return f

class Key:
    def __init__(self, m, face):
        self.m = m; self.face = face; self.sdf = sdf(m); self.fc = centroid(list(face)) or centroid(list(m))
def between(A, B, t):
    """une image entre A et B : formes mélangées, visage de la plus proche, déplacé du même chemin"""
    m = biggest({p for p in A.sdf if (1 - t) * A.sdf[p] + t * B.sdf[p] <= 0})
    src = A if t < .5 else B
    fc = (A.fc[0] + (B.fc[0] - A.fc[0]) * t, A.fc[1] + (B.fc[1] - A.fc[1]) * t)
    dx, dy = round(fc[0] - src.fc[0]), round(fc[1] - src.fc[1])
    return render(m, {(x + dx, y + dy): c for (x, y), c in src.face.items()})

def key_from_drawn(f):
    """une image dessinée : agrandie autour du coin du mur (le contour est refait, le visage garde la taille de ses pixels mais suit la forme)"""
    m0 = mask_of(f); face0 = face_of(f, m0)
    m = set()
    for y in range(64):
        for x in range(64):
            sx, sy = int(math.floor(AX - (AX - (x + .5)) / S)), int(math.floor(AY - (AY - (y + .5)) / S))
            if (sx, sy) in m0: m.add((x, y))
    face = {(int(math.floor(AX - (AX - (x + .5)) * S)), int(math.floor(AY - (AY - (y + .5)) * S))): c for (x, y), c in face0.items()}
    ymax = max(p[1] for p in m); dy = 60 - ymax                              # le bas du contour sur la ligne 60
    return Key({(x, y + dy) for (x, y) in m}, {(x, y + dy): c for (x, y), c in face.items()})

def load_drawn():
    with tempfile.TemporaryDirectory() as t:
        ase(f"{ROOT}/animations/coule-fin/base-sprite-0007.aseprite", "--sheet", f"{t}/s.png", "--sheet-type", "horizontal")
        return frames(f"{t}/s.png")
def key_from_frame(f):
    m = mask_of(f); return Key(m, face_of(f, m))

def build():
    D = [key_from_drawn(f) for f in load_drawn()]
    C = key_from_frame(COULE0); R = key_from_frame(REPOS)
    seq = [(COULE0, 100)]
    for t in (.25, .5, .75): seq.append((between(C, D[0], t), 55))            # de la bosse contre le mur à la goutte
    seq.append((render(D[0].m, D[0].face), 70))
    for i in range(5):                                                         # la chute et l'étalement : une intermédiaire entre chaque paire
        seq.append((between(D[i], D[i + 1], .5), 55)); seq.append((render(D[i + 1].m, D[i + 1].face), 70))
    for t in (1 / 3, 2 / 3): seq.append((between(D[5], D[6], t), 60))         # de la flaque à la boule : le plus grand changement
    for i, d in ((6, 90), (7, 110), (8, 130)): seq.append((render(D[i].m, D[i].face), d))
    for t in (.2, .4, .6, .8): seq.append((between(D[8], R, t), 70))          # la boule grossit et se pose dans la pose de repos
    seq.append((REPOS, 90))                                                    # = repos 0 : l'enchaînement est sans saut
    return seq

if __name__ == "__main__":
    seq = build()
    create("dort/dort", "coule-fin", "coule-fin", [d for _, d in seq])
    replace_frames("coule-fin", "coule-fin", [f for f, _ in seq])
    print("coule-fin :", len(seq), "images,", sum(d for _, d in seq), "ms")
