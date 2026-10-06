# remis : les gouttes de nausée qu'il chasse en se secouant la tête. Ce script (re)dessine le calque « gouttes » de animations/remis/remis.aseprite
# à partir du calque du corps (le premier) : à chaque bout du balancement (GOUTTES), des gouttes vertes partent du haut de la tête dans le sens de
# l'élan, montent en arc puis retombent ; elles disparaissent en touchant le corps ou en sortant du cadre. Grosses aux premiers coups de tête,
# de plus en plus petites ensuite. Le calque est à toi : relancer le script l'écrase.
#   python3 tools/remis_gouttes.py          (après avoir changé les images du corps ou GOUTTES)
import os, random, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ROOT, ASE, ase, export, frames, write

INK, CLEAR = (0, 0, 0, 255), (0, 0, 0, 0)
VERT = {"A": (0x7f, 0xd4, 0x6a, 255), "C": (0x4f, 0xae, 0x45, 255), "D": (0xc6, 0xf0, 0xb0, 255)}      # le vert de la nausée (gen.py, VERT)
GROSSE = [".###.", "#DAA#", "#AAA#", "#AAC#", ".###."]
MOYENNE = [".##.", "#DA#", "#AC#", ".##."]
PETITE = [".#.", "#A#", ".#."]
# image (à partir de 0) -> les gouttes qui y partent : (côté : 1 = vers l'avant, -1 = vers l'arrière, taille)
GOUTTES = {1: [(1, GROSSE), (1, MOYENNE), (1, PETITE)], 2: [(1, MOYENNE)], 3: [(-1, GROSSE), (-1, GROSSE), (-1, MOYENNE), (-1, PETITE)],
           4: [(-1, PETITE)], 6: [(1, GROSSE), (1, MOYENNE), (1, PETITE)], 8: [(-1, GROSSE), (-1, MOYENNE), (-1, MOYENNE), (-1, PETITE)],
           10: [(1, MOYENNE), (1, PETITE)], 11: [(-1, MOYENNE), (-1, PETITE)], 12: [(1, PETITE)]}
GRAVITE = 1.4
SRC = f"{ROOT}/animations/remis/remis.aseprite"

def corps():
    with tempfile.TemporaryDirectory() as tmp:
        ase("--layer", "Layer 2", SRC, "--sheet", f"{tmp}/c.png", "--sheet-type", "horizontal")
        return frames(f"{tmp}/c.png")

def depart(f, cote, k, rnd):
    """la goutte k part juste au-dessus du crâne, réparties le long du haut de la tête du côté de l'élan, et sa vitesse (pixels par image) :
    vers l'avant elle part surtout vers le haut (la tête est près du bord du cadre), vers l'arrière elle a la place de filer"""
    top = min(y for y in range(64) if any(p[3] for p in f[y]))
    xs = [x for y in range(top, top + 6) for x in range(64) if f[y][x][3]]
    x = max(xs) - 2 - 4 * k if cote > 0 else min(xs) + 2 + 4 * k
    x += rnd.randint(-1, 1)
    y = next(y for y in range(64) if f[y][x][3]) - 2
    v = (rnd.choice((1, 1, 2)), -rnd.choice((4, 4, 5))) if cote > 0 else (-rnd.choice((2, 3, 3, 4)), -rnd.choice((2, 3, 4)))
    return (x, y), v

def calque(F):
    rnd = random.Random(7); n = len(F); out = [[[CLEAR] * 64 for _ in range(64)] for _ in range(n)]
    for i0, gs in GOUTTES.items():
        for k, (cote, spr) in enumerate(gs):
            (x0, y0), (vx, vy) = depart(F[i0], cote, k, rnd)
            for t in range(n - i0):
                x, y = round(x0 + vx * t), round(y0 + vy * t + GRAVITE * t * t / 2)
                if not (1 <= x < 63 and 1 <= y < 63) or (t > 0 and F[i0 + t][y][x][3]): break       # sortie du cadre, ou retombée sur le corps
                h, w = len(spr), len(spr[0])
                for r in range(h):
                    for c in range(w):
                        X, Y = x - w // 2 + c, y - h // 2 + r
                        if spr[r][c] != "." and 0 <= X < 64 and 0 <= Y < 64 and not F[i0 + t][Y][X][3] and not out[i0 + t][Y][X][3]:
                            out[i0 + t][Y][X] = INK if spr[r][c] == "#" else VERT[spr[r][c]]
    return out

LUA = '''local spr = app.open(app.params.file)
for _, l in ipairs(spr.layers) do if l.name == "gouttes" then spr:deleteLayer(l) break end end
local L = spr:newLayer(); L.name = "gouttes"
for i = 1, #spr.frames do spr:newCel(L, i, Image{fromFile = app.params.dir .. "/" .. (i - 1) .. ".png"}, Point(0, 0)) end
spr:saveAs(app.params.file)
'''
if __name__ == "__main__":
    G = calque(corps())
    with tempfile.TemporaryDirectory() as tmp:
        for i, g in enumerate(G): write(f"{tmp}/{i}.png", g)
        open(f"{tmp}/l.lua", "w").write(LUA)
        ase("--script-param", f"file={SRC}", "--script-param", f"dir={tmp}", "--script", f"{tmp}/l.lua")
    export("remis", "remis")
    print("calque gouttes redessiné :", len(G), "images")
