# Outil historique : la numérotation de visages-face.aseprite a changé depuis (voir NOTES.md, Humeurs) ; ne pas le relancer, le fichier est retouché à la main.
# Ébauche des visages d'humeur de face, d'après ceux que Thibault a dessinés de profil (crawl.aseprite, images 13 à 16) : mêmes yeux, mêmes sourcils,
# même sourire, mêmes cernes, remis en symétrie sur la pose de repos. Écrit animations/visages-face/visages-face.aseprite :
#   1 = la pose de repos (visage neutre), 2 = joyeux, 3 = joyeux yeux fermés, 4 = fatigué, 5 = fatigué yeux fermés.
# À lancer une seule fois : ensuite, on retouche le fichier dans Aseprite, gen.py le relit.
#   python3 tools/visages_face.py
import os, sys, subprocess, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ASE, ROOT, export, frames, write

B, A, D, W = (0, 0, 0, 255), (0x63, 0x9b, 0xff, 255), (0x45, 0x77, 0xe0, 255), (255, 255, 255, 255)
base = frames(f"{ROOT}/animations/repos/repos_sheet.png")[0]
EYES, TOP, MOUTH = (28, 35), 43, 51          # yeux neutres : colonnes 28 et 35, lignes 43 à 46 ; bouche : ligne 51
KEY = {"a": B, "e": W, "d": D, "b": A}

def blank():
    g = [row[:] for row in base]
    for c in EYES:
        for y in range(TOP, TOP + 4): g[y][c] = A
    for x in range(30, 35): g[MOUTH][x] = A
    g[MOUTH - 1][35] = A
    return g
def stamp(g, rows, x0, y0, mirror=False):
    for j, r in enumerate(rows):
        if mirror: r = r[::-1]
        for i, ch in enumerate(r):
            if ch in KEY: g[y0 + j][x0 + i] = KEY[ch]
def put(g, pts, c=B):
    for x, y in pts: g[y][x] = c

def joyeux(ferme):
    g = blank(); t = TOP - 2
    for c in EYES:
        if ferme: put(g, [(x, t + 5) for x in range(c - 2, c + 3)])
        else: stamp(g, [".aaa.", "aeeea", "aaeea", "aeaea", "aaaea", "aaaea", ".aaa."], c - 2, t)
    l, r = EYES
    put(g, [(l - 2, t - 2), (l - 1, t - 3), (l, t - 4), (l + 1, t - 4), (r - 1, t - 4), (r, t - 4), (r + 1, t - 3), (r + 2, t - 2)])   # sourcils levés
    put(g, [(28, 49), (29, 50)] + [(x, 51) for x in range(30, 34)] + [(34, 50), (35, 49)])                  # grand sourire
    return g
def fatigue(ferme):
    g = blank(); t = TOP + 2                                                   # la paupière couvre le haut de l'œil
    for c, m in zip(EYES, (False, True)):
        stamp(g, ["....." if ferme else "aaaaa", "aaaaa" if ferme else "aaeea", "ddda."], c - 2, t, m)
    l, r = EYES
    put(g, [(x, TOP + 1) for x in range(l - 4, l)] + [(l, TOP), (l + 1, TOP - 1), (l + 2, TOP - 1), (l + 2, TOP - 2)])          # sourcils en accent circonflexe
    put(g, [(x, TOP + 1) for x in range(r + 1, r + 5)] + [(r, TOP), (r - 1, TOP - 1), (r - 2, TOP - 1), (r - 2, TOP - 2)])
    put(g, [(29, 52)] + [(x, 51) for x in range(30, 34)] + [(34, 52)])                                                          # bouche qui tombe
    return g

LUA = '''local spr
local i = 1
while true do
  local p = app.params.dir .. "/" .. i .. ".png"
  local f = io.open(p, "r"); if not f then break end; f:close()
  local img = Image{fromFile = p}
  if not spr then spr = Sprite(img.width, img.height, ColorMode.RGB); spr.cels[1].image = img else spr:newCel(spr.layers[1], spr:newEmptyFrame(), img, Point(0, 0)) end
  spr.frames[i].duration = 0.5
  i = i + 1
end
spr:saveAs(app.params.out)
'''
if __name__ == "__main__":
    d = f"{ROOT}/animations/visages-face"; os.makedirs(d, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for k, f in enumerate([base, joyeux(False), joyeux(True), fatigue(False), fatigue(True)]): write(f"{tmp}/{k + 1}.png", f)
        open(f"{tmp}/s.lua", "w").write(LUA)
        subprocess.run([ASE, "-b", "--script-param", f"dir={tmp}", "--script-param", f"out={d}/visages-face.aseprite", "--script", f"{tmp}/s.lua"], check=True, stdout=subprocess.DEVNULL)
    export("visages-face", "visages-face")
    print("écrit :", f"{d}/visages-face.aseprite")
