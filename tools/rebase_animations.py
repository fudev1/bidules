# Aligne les animations dessinées sur l'ancienne pose de face (turn, saut, baille) sur la pose de repos : plus de "jupe" au bas du corps,
# côté droit droit, petite queue à gauche. Réécrit les fichiers .aseprite et leurs exports (feuille, JSON, gifs, frames/).
#   python3 tools/rebase_animations.py          puis : python3 animations/limace-complete/gen.py  (voir README)
# À lancer UNE fois : baille est décalée de (-5, +1) au passage, ce qui n'est plus à faire dans gen.py.
import os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import align_turn as AT
from rebase import NEW, ROOT, frames, rebase, write
ASE = "/Applications/Aseprite.app/Contents/MacOS/aseprite"
A = os.path.join(ROOT, "animations")

def shift(f, dx, dy): return [[f[y - dy][x - dx] if 0 <= x - dx < 64 and 0 <= y - dy < 64 else (0, 0, 0, 0) for x in range(64)] for y in range(64)]
def force(f):
    import rebase as R
    keep = R.needs; R.needs = lambda g: True
    try: return R.rebase(f)
    finally: R.needs = keep

# --- turn : les images 4 et 5 glissent vers la pose de repos (image 6), puis les images 7 à 11 en sont le miroir ---
turn = frames(f"{A}/turn/turn_sheet.png")
T = list(turn)
T[4], T[5], T[6] = AT.morph(turn[3], NEW, 1 / 3), AT.morph(turn[3], NEW, 2 / 3), NEW
for k in range(7, 12): T[k] = AT.mirror(T[12 - k])

# --- saut : début et fin = le demi-tour ; l'écrasement et le retour sur le sol perdent leur jupe ---
saut = frames(f"{A}/jump/saut_sheet.png")
S = list(saut)
for k in range(1, 7): S[k] = T[k]; S[34 - k] = T[k]
for k in (7, 8, 10, 25, 26, 27): S[k] = force(saut[k])

# --- baille : recalée sur la pose de face comme le faisait gen.py (dx -5, dy +1), puis sans jupe ; début et fin = la pose de repos ---
baille = [force(shift(f, -5, 1)) for f in frames(f"{A}/baille/baille_sheet.png")]
baille[0] = baille[-1] = NEW

JOBS = [("turn", "turn", T), ("jump", "saut", S), ("baille", "baille", baille)]
LUA = '''local spr = app.open(app.params.file)
for i = 1, #spr.frames do
  local p = app.params.dir .. "/" .. (i - 1) .. ".png"
  local f = io.open(p, "r")
  if f then
    f:close()
    local cel = spr.layers[1]:cel(i)
    if cel then spr:deleteCel(cel) end
    spr:newCel(spr.layers[1], i, Image{fromFile = p}, Point(0, 0))
  end
end
spr:saveAs(app.params.file)
'''
def ase(*args): subprocess.run([ASE, "-b", *args], check=True, stdout=subprocess.DEVNULL)

with tempfile.TemporaryDirectory() as tmp:
    open(f"{tmp}/replace.lua", "w").write(LUA)
    for folder, name, fl in JOBS:
        d = f"{A}/{folder}"; src = f"{d}/{name}.aseprite"; png_dir = f"{tmp}/{name}"; os.makedirs(png_dir)
        for k, f in enumerate(fl): write(f"{png_dir}/{k}.png", f)
        ase("--script-param", f"file={src}", "--script-param", f"dir={png_dir}", "--script", f"{tmp}/replace.lua")
        ase(src, "--sheet", f"{d}/{name}_sheet.png", "--data", f"{d}/{name}_sheet.json", "--format", "json-array", "--list-tags", "--sheet-type", "horizontal")
        ase(src, "--save-as", f"{d}/{name}.gif")
        ase(src, "--scale", "6", "--save-as", f"{d}/{name}_x6.gif")
        if os.path.isdir(f"{d}/frames"): ase(src, "--save-as", f"{d}/frames/{name}_{{frame1}}.png")
        print(name, "ok,", len(fl), "images")
