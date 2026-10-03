# Du fichier Aseprite à l'app, en une commande : réexporte les animations enregistrées depuis le dernier export, rassemble la feuille de la limace
# et la copie dans dist/. Ensuite, relancer l'app (mise run bidule).
#   python3 tools/publier.py          seulement les animations dont le .aseprite est plus récent que la feuille exportée
#   python3 tools/publier.py --tout   toutes
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ROOT, export

ANIMS = [("crawl", "crawl"), ("turn", "turn"), ("jump", "saut"), ("repos", "repos"), ("baille", "baille"), ("eat", "mange"), ("rot", "rot"), ("dort", "dort"), ("remue", "remue"), ("regard", "regard"), ("reforme", "reforme"), ("attrape", "attrape"), ("chute", "chute"), ("caresse", "caresse")]
A = f"{ROOT}/animations"
for folder, name in ANIMS:
    src, sheet = f"{A}/{folder}/{name}.aseprite", f"{A}/{folder}/{name}_sheet.png"
    if "--tout" in sys.argv or not os.path.exists(sheet) or os.path.getmtime(src) > os.path.getmtime(sheet):
        export(folder, name); print("exportée :", name)
subprocess.run([sys.executable, f"{A}/limace-complete/gen.py"], check=True)
for f in ("sheet.png", "sheet.json"):
    subprocess.run(["cp", f"{A}/limace-complete/limace_{f}", f"{ROOT}/dist/persos/limace/{f}"], check=True)
print("copiée dans dist/persos/limace : relance l'app")
