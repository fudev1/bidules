# Du fichier Aseprite à l'app, en une commande : réexporte les animations enregistrées depuis le dernier export, rassemble la feuille de la limace
# et la copie dans dist/. Ensuite, relancer l'app (mise run bidule).
#   python3 tools/publier.py          seulement les animations dont le .aseprite est plus récent que la feuille exportée
#   python3 tools/publier.py --tout   toutes
import glob, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ROOT, export

ANIMS = [("crawl", "crawl"), ("turn", "turn"), ("jump", "saut"), ("repos", "repos"), ("baille", "baille"), ("eat", "mange"), ("rot", "rot"), ("dort", "dort"), ("remue", "remue"), ("regard", "regard"), ("reforme", "reforme"), ("attrape-boule", "attrape-boule"), ("chute", "chute"), ("caresse", "caresse"), ("rire", "rire"), ("remis", "remis"), ("choc-bord", "choc-bord"), ("coule", "coule"), ("coule-fin", "coule-fin"), ("decolle-pendule", "decolle-pendule"), ("visages-face", "visages-face")]
A = f"{ROOT}/animations"
for folder, name in ANIMS:
    src, sheet = f"{A}/{folder}/{name}.aseprite", f"{A}/{folder}/{name}_sheet.png"
    if "--tout" in sys.argv or not os.path.exists(sheet) or os.path.getmtime(src) > os.path.getmtime(sheet):
        export(folder, name); print("exportée :", name)
# les animations de chaque humeur (animations/humeurs/<humeur>/<nom>.aseprite, écrites par gen.py --fichiers puis retouchées à la main)
for src in sorted(glob.glob(f"{A}/humeurs/*/*.aseprite")):
    folder, name = os.path.relpath(os.path.dirname(src), A), os.path.basename(src)[:-9]
    sheet = f"{A}/{folder}/{name}_sheet.png"
    if "--tout" in sys.argv or not os.path.exists(sheet) or os.path.getmtime(src) > os.path.getmtime(sheet):
        export(folder, name); print("exportée :", f"{folder}/{name}")
subprocess.run([sys.executable, f"{A}/limace-complete/gen.py"], check=True)
for f in ("sheet.png", "sheet.json"):
    subprocess.run(["cp", f"{A}/limace-complete/limace_{f}", f"{ROOT}/dist/persos/limace/{f}"], check=True)
subprocess.run([sys.executable, f"{ROOT}/tools/cheveux.py"], check=True)          # la version avec cheveux suit la feuille (évolution)
print("copiée dans dist/persos/limace : relance l'app")
