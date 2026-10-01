# Remplace des images d'une animation dans son fichier .aseprite, puis réexporte feuille, JSON, gifs et frames/ (comme le fait Aseprite à la main).
import os, subprocess, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "animations", "limace-complete"))
from png import frames, write

ASE = "/Applications/Aseprite.app/Contents/MacOS/aseprite"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
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

def replace_frames(folder, name, fl):
    """fl : une image par image de l'animation (None = ne pas toucher) ; les durées et les balises restent celles du fichier"""
    d = f"{ROOT}/animations/{folder}"; src = f"{d}/{name}.aseprite"
    with tempfile.TemporaryDirectory() as tmp:
        open(f"{tmp}/replace.lua", "w").write(LUA)
        for k, f in enumerate(fl):
            if f is not None: write(f"{tmp}/{k}.png", f)
        ase("--script-param", f"file={src}", "--script-param", f"dir={tmp}", "--script", f"{tmp}/replace.lua")
    export(folder, name)

def export(folder, name):
    """réexporte feuille PNG, JSON, gifs et frames/ d'une animation depuis son .aseprite"""
    d = f"{ROOT}/animations/{folder}"; src = f"{d}/{name}.aseprite"
    ase(src, "--sheet", f"{d}/{name}_sheet.png", "--data", f"{d}/{name}_sheet.json", "--format", "json-array", "--list-tags", "--sheet-type", "horizontal")
    ase(src, "--save-as", f"{d}/{name}.gif")
    ase(src, "--scale", "6", "--save-as", f"{d}/{name}_x6.gif")
    if os.path.isdir(f"{d}/frames"): ase(src, "--save-as", f"{d}/frames/{name}_{{frame1}}.png")

def create(template, folder, name, durations):
    """crée animations/<folder>/<name>.aseprite à partir de <template> ('dossier/nom') : ses premières images, une balise <name>, ces durées (ms).
    Refuse d'écraser un fichier existant : une fois créé, il est à toi."""
    dst = f"{ROOT}/animations/{folder}/{name}.aseprite"
    if os.path.exists(dst): sys.exit(f"{name}.aseprite existe déjà : il est à toi, je n'y touche pas (supprime-le pour le refaire)")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    lua = f'''local s = app.open("{ROOT}/animations/{template}.aseprite")
while #s.frames < {len(durations)} do s:newFrame(#s.frames) end
for i = #s.frames, {len(durations) + 1}, -1 do s:deleteFrame(i) end
for _, t in ipairs(s.tags) do s:deleteTag(t) end
local d = {{{",".join(str(ms / 1000) for ms in durations)}}}
for i, v in ipairs(d) do s.frames[i].duration = v end
local t = s:newTag(1, {len(durations)}); t.name = "{name}"
s:saveAs("{dst}")
'''
    with tempfile.NamedTemporaryFile("w", suffix=".lua") as fh:
        fh.write(lua); fh.flush(); ase("--script", fh.name)
