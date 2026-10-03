# Fait d'une sortie brute de PixelLab une animation de Bidule, prête à retoucher dans Aseprite :
# réduite en 64 × 64, pixels opaques ou transparents, couleurs ramenées sur la palette du personnage, poussières enlevées, puis recalée.
# Le recalage est le même pour toutes les images, pour garder le mouvement : la première image est superposée à l'image source
# de la requête (`animer`, `interpoler`) ; sans source (`style`), elle est posée sur la ligne 60 et centrée sur 31,5.
#
#   python3 tools/importer.py animations/<nom>/pixellab/<date>-<commande> [--perso limace] [--balise <nom>] [--duree 80]
#        [--choix 0,3,7] [--grille 4] [--en-l-air] [--pas-aligner]
#
#   --choix       ne garder que ces images, dans cet ordre (par exemple les propositions retenues de `style`)
#   --grille N    chaque image brute est une grille de N × N propositions : la découper d'abord
#   --perso       la palette à utiliser ; par défaut le personnage de l'image source (« limace:repos » -> limace)
#   --libre       nouveau Bidule, pas encore de palette : garder les couleurs fréquentes de la sortie, sans les quasi-doublons
#   --en-l-air    sans source : ne pas poser sur la ligne 60 (animation qui ne touche pas le sol), seulement centrer
#
# Crée animations/<nom>/<balise>.aseprite (jamais par-dessus un fichier existant), l'exporte comme publier.py,
# range les images nettoyées (net_00.png…) à côté des brutes et note l'import dans animations/<nom>/pixellab/import-<balise>.json pour tools/bilan.py.
import glob, json, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bidules import ROOT, ASE, SOL, boite, caler, image, lire_png, palette, palette_libre, plus_proche
from aseprite_io import export
from verifier import verifier, rapport
import png

CLEAR = (0, 0, 0, 0)

def reduire(px):
    """ramène une image de n × 64 pixels à 64 × 64 : chaque bloc n × n devient sa couleur opaque la plus fréquente, ou transparent"""
    h, w = len(px), len(px[0])
    if (w, h) == (64, 64): return px
    if w != h or w % 64: sys.exit(f"image {w} × {h} : attendu 64 × 64 ou un multiple carré (passer par Pixel-Import dans Aseprite sinon)")
    n = w // 64; out = []
    for Y in range(64):
        row = []
        for X in range(64):
            bloc = [px[Y * n + j][X * n + i] for j in range(n) for i in range(n)]
            op = [p for p in bloc if p[3] >= 128]
            row.append(max(set(op), key=op.count) if len(op) * 2 >= len(bloc) else CLEAR)
        out.append(row)
    return out

def grille(px, n):
    t = len(px) // n
    return [[row[i * t:(i + 1) * t] for row in px[j * t:(j + 1) * t]] for j in range(n) for i in range(n)]

def nettoyer(f, couleur):
    """opaque ou transparent, couleurs de la palette, sans pixel isolé ; renvoie (image, nombre de poussières enlevées)"""
    g = [[(*couleur(p), 255) if p[3] >= 128 else CLEAR for p in row] for row in f]
    seul = [(x, y) for y in range(64) for x in range(64) if g[y][x][3] and not any(
        0 <= x + i < 64 and 0 <= y + j < 64 and g[y + j][x + i][3] for i in (-1, 0, 1) for j in (-1, 0, 1) if i or j)]
    for x, y in seul: g[y][x] = CLEAR
    return g, len(seul)

def decaler(f, dx, dy):
    return [[f[y - dy][x - dx] if 0 <= x - dx < 64 and 0 <= y - dy < 64 else CLEAR for x in range(64)] for y in range(64)]

LUA = '''local d = app.params.dir
local n = tonumber(app.params.n)
local s = Sprite(64, 64, ColorMode.RGB)
s.layers[1].name = "dessin"
for i = 1, n do
  if i > 1 then s:newEmptyFrame(i) end
  s:newCel(s.layers[1], i, Image{fromFile = d .. "/" .. (i - 1) .. ".png"}, Point(0, 0))
  s.frames[i].duration = tonumber(app.params.duree) / 1000
end
local t = s:newTag(1, n); t.name = app.params.balise
s:saveAs(app.params.dst)
'''

def creer_aseprite(dst, images, balise, duree):
    with tempfile.TemporaryDirectory() as tmp:
        for k, f in enumerate(images): png.write(f"{tmp}/{k}.png", f)
        open(f"{tmp}/creer.lua", "w").write(LUA)
        subprocess.run([ASE, "-b", *sum((["--script-param", f"{k}={v}"] for k, v in
                        dict(dir=tmp, n=len(images), duree=duree, balise=balise, dst=dst).items()), []), "--script", f"{tmp}/creer.lua"],
                       check=True, stdout=subprocess.DEVNULL)

def options(args, **defauts):
    o, reste, i = dict(defauts), [], 0
    while i < len(args):
        if args[i] in ("--en-l-air", "--pas-aligner", "--libre"): o[args[i][2:]] = True; i += 1
        elif args[i].startswith("--"): o[args[i][2:]] = args[i + 1]; i += 2
        else: reste.append(args[i]); i += 1
    return o, reste

if __name__ == "__main__":
    o, a = options(sys.argv[1:], duree="80")
    if len(a) != 1: sys.exit(open(__file__).read().split("\nimport")[0])
    run = os.path.abspath(a[0]); dossier = os.path.basename(os.path.dirname(os.path.dirname(run)))
    if os.path.basename(os.path.dirname(run)) != "pixellab": sys.exit("attendu un dossier animations/<nom>/pixellab/<date>-<commande>")
    source = json.load(open(f"{run}/requete.json"))["sources"].get("debut") if os.path.exists(f"{run}/requete.json") else None
    if "perso" not in o and not o.get("libre"):
        if not source or os.path.exists(source): sys.exit("--perso <personnage> : je ne peux pas deviner la palette")
        o["perso"] = source.split(":")[0]
    balise = o.get("balise", dossier); dst = f"{ROOT}/animations/{dossier}/{balise}.aseprite"
    if os.path.exists(dst): sys.exit(f"{os.path.relpath(dst, ROOT)} existe déjà : il est à toi, je n'y touche pas (--balise <autre nom> pour un autre essai)")

    bruts = [lire_png(p) for p in sorted(glob.glob(f"{run}/brut_*.png"))]
    if o.get("grille"): bruts = [g for b in bruts for g in grille(b, int(o["grille"]))]
    if o.get("choix"): bruts = [bruts[int(k)] for k in o["choix"].split(",")]
    reduits = [reduire(b) for b in bruts]
    if o.get("libre"): couleur = plus_proche(palette_libre(reduits)); o.setdefault("perso", dossier)
    else: couleur = plus_proche(palette(o["perso"]), {p[:3] for row in image(source) for p in row if p[3]} if source else ())
    nets, poussieres = zip(*(nettoyer(r, couleur) for r in reduits))
    dx = dy = 0
    if not o.get("pas-aligner"):
        b0 = boite(nets[0]) or sys.exit("la première image est vide")
        if source: dx, dy = caler(nets[0], image(source))
        else: dx = round((63 - b0[0] - b0[2]) / 2); dy = 0 if o.get("en-l-air") else SOL - b0[3]
        nets = [decaler(f, dx, dy) for f in nets]
    for k, f in enumerate(nets): png.write(f"{run}/net_{k:02}.png", f)

    os.makedirs(os.path.dirname(dst), exist_ok=True)
    creer_aseprite(dst, nets, balise, int(o["duree"]))
    export(dossier, balise)
    json.dump({"essai": os.path.relpath(run, ROOT), "balise": balise, "perso": o["perso"], "images": len(nets), "decalage": [dx, dy],
               "poussieres": sum(poussieres), "options": {k: v for k, v in o.items() if k != "perso"}},
              open(f"{ROOT}/animations/{dossier}/pixellab/import-{balise}.json", "w"), ensure_ascii=False, indent=1)
    print(f"créé : {os.path.relpath(dst, ROOT)} ({len(nets)} images, décalage {dx}, {dy}, {sum(poussieres)} poussières enlevées)")
    print(rapport(verifier(nets, o["perso"], en_l_air=bool(o.get("en-l-air")))) if not o.get("libre") else
          f"palette libre : {len(palette_libre(reduits))} couleurs ; elle devient celle de {dossier} une fois validée (moodboard/style-bidules.md)")
