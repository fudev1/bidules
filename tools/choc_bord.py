# choc-bord et coule : le Bidule percute le bord de l'écran, s'écrase contre lui (comme atterrissage au sol, mais sur un plan vertical), puis coule lentement
# le long du mur comme un slime : le poids en bas, et une traîne qui s'amincit vers le haut (comme la queue de la reptation, à la verticale).
#   choc-bord : les images d'écrasement d'atterrissage, tournées d'un quart de tour (le mur est à droite, à la colonne 63 ; l'app retourne pour le bord gauche)
#   coule     : la boucle de la descente, dessinée par ce script (forme, contour, ombre, reflet, visage, goutte qui s'allonge)
# Les fichiers animations/choc-bord/ et animations/coule/ sont ensuite à toi : create() refuse de les écraser (supprime le dossier pour refaire).
#   python3 tools/choc_bord.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "animations", "limace-complete"))
from aseprite_io import ROOT, create, replace_frames
from png import frames

INK, BASE, SHADE, LIGHT, CLEAR = (0, 0, 0, 255), (99, 155, 255, 255), (69, 119, 224, 255), (164, 198, 255, 255), (0, 0, 0, 0)
sheet = frames(f"{ROOT}/animations/limace-complete/limace_sheet.png")
ATT = [sheet[46 + k] for k in range(6)]                 # atterrissage : écrasé, à plat, se relève...

def quarter_turn(f):
    """un quart de tour vers la gauche : le sol devient le mur de droite ; décalé pour que le mur soit la colonne 63"""
    out = [[CLEAR] * 64 for _ in range(64)]
    for y in range(64):
        for x in range(64):
            if f[y][x][3]: out[63 - x][y] = f[y][x]
    right = max(x for r in out for x, c in enumerate(r) if c[3])
    d = 63 - right
    return [[out[y][x - d] if 0 <= x - d < 64 else CLEAR for x in range(64)] for y in range(64)]

def face(f, x, y, mood):
    """le visage de face, posé sur la bosse : yeux et bouche, selon l'humeur"""
    eyes = {"choc": ((-5, -1), (-4, -1), (-5, 0), (-4, 0), (4, -1), (5, -1), (4, 0), (5, 0)),       # yeux écarquillés (petits carrés)
            "las": ((-5, 0), (-4, 0), (-3, 0), (3, 0), (4, 0), (5, 0))}[mood]                      # yeux mi-clos, résigné
    for dx, dy in eyes: f[y + dy][x + dx] = INK
    mouth = {"choc": ((-1, 5), (0, 5), (1, 5), (-1, 6), (0, 6), (1, 6)), "las": ((-2, 5), (-1, 4), (0, 4), (1, 4), (2, 5))}[mood]
    for dx, dy in mouth: f[y + dy][x + dx] = INK

def draw(cy, rv, rh, tr=1.0, tw=1.0, drip=0, drop=None, ph=0.0, mood="las", t_top=3):
    """une image de la descente : la bosse (demi-ellipse collée au mur) de centre cy et de rayons rh, rv ; la traîne mince vers le haut (tr = sa montée,
    tw = son épaisseur) ; la goutte qui pend sous la bosse (drip, en pixels) ou qui s'est détachée et tombe (drop = sa hauteur)"""
    mask = set()
    top = cy - (cy - t_top) * tr
    for y in range(64):
        for x in range(64):
            X, Y = x + .5, y + .5
            if ((X - 64) / rh) ** 2 + ((Y - cy) / rv) ** 2 <= 1: mask.add((x, y)); continue
            if top <= Y < cy:
                t = (Y - top) / max(1, cy - top); w = (1.5 + 17 * t ** 1.7 + .8 * math.sin(Y * .45 - ph * 2) * t) * tw
                if X >= 64 - w: mask.add((x, y))
    bx = 46
    bottom = max((y for (x, y) in mask if x == bx), default=int(cy))
    for i in range(1, int(drip) + 1):
        for dx in range(4 if drip < 9 else 3): mask.add((bx + dx + (0 if drip < 9 else 0), bottom + i))
    if drip >= 4:
        for dx in range(-1, 5): mask.add((bx + dx, bottom + int(drip)))
    if drop is not None:                                    # la goutte détachée : une larme de 6 de large, sous la bosse
        for dy, hw in ((0, 1), (1, 2), (2, 3), (3, 3), (4, 3), (5, 2)):
            for dx in range(-hw, hw): 
                if 0 <= drop + dy < 64: mask.add((bx + 2 + dx, drop + dy))
    inn = lambda x, y: x >= 63 or (x, y) in mask         # le mur compte comme du corps : pas de contour de ce côté
    inner = lambda x, y: inn(x, y) and inn(x + 1, y) and inn(x - 1, y) and inn(x, y + 1) and inn(x, y - 1)
    f = [[CLEAR] * 64 for _ in range(64)]
    for (x, y) in mask:
        c = BASE
        if not inner(x, y): c = INK
        elif not inner(x, y + 3) or not inner(x - 2, y + 1) and y > cy: c = SHADE
        elif not inner(x - 3, y - 1) or not inner(x - 1, y - 3): c = LIGHT
        f[y][x] = c
    if mood: face(f, 53, int(round(cy)) - 2, mood)
    return f

def slime(k, n=8):
    """la boucle de la descente : la bosse gonfle et se tasse, la traîne ondule, la goutte s'allonge puis se rétracte"""
    ph = 2 * math.pi * k / n; bob = math.sin(ph)
    return draw(42 + 1.2 * math.sin(ph + 1.2), 12.5 + 1.8 * bob, 22 + 1.5 * math.cos(ph), ph=ph, drip=[0, 2, 4, 6, 7, 5, 2, 0][k % 8])

def settle(t):
    """entre la dernière image de l'écrasement (la galette contre le mur) et la boucle : la bosse se forme, la traîne monte, le visage apparaît"""
    return draw(32 + 10 * t, 20 - 7.5 * t, 6 + 16 * t, tr=t, tw=t, mood=None if t < .5 else ("choc" if t < .7 else "las"))

IMPACT = [quarter_turn(ATT[k]) for k in range(3)] + [settle(t) for t in (.2, .4, .6, .8)] + [slime(0)]     # écrasé, puis il se plaque et la bosse se forme
COULE = [slime(k) for k in range(8)]

if __name__ == "__main__":
    for name, fl, du in (("choc-bord", IMPACT, [60, 70, 90, 80, 80, 80, 90, 110]), ("coule", COULE, [140] * 8)):
        if os.path.exists(f"{ROOT}/animations/{name}/{name}.aseprite"): print(name, ": existe déjà, laissé tel quel"); continue
        create("dort/dort", name, name, du); replace_frames(name, name, fl); print(name, ":", len(fl), "images")
