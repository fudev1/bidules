# Crée animations/reforme/reforme.aseprite : le Bidule se reforme après l'écrasement.
# Première image : la dernière de chute (la flaque presque plate). Dernière image : la pose de repos, exactement. Entre les deux, le corps de repos
# (silhouette, visage, queue) est écrasé puis étiré autour du centre du corps (31,5) et du sol (ligne 60), avec un rebond avant de se poser.
# Le fichier est ensuite à toi : l'outil refuse d'écraser un reforme.aseprite existant.
#   python3 tools/reforme.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ROOT, create, frames, replace_frames
from deform import squash
from rebase import NEW

# (largeur, hauteur, durée en ms) : la flaque (image dessinée dans chute), puis la remontée, un rebond, et la pose de repos
STEPS = [None, (1.4, .18, 90), (1.3, .38, 80), (1.15, .68, 80), (.92, 1.18, 90), (1.06, .93, 80), (.98, 1.03, 80), (1, 1, 100)]

if __name__ == "__main__":
    puddle = frames(f"{ROOT}/animations/chute/chute_sheet.png")[22]
    create("repos/repos", "reforme", "reforme", [90 if s is None else s[2] for s in STEPS])
    replace_frames("reforme", "reforme", [puddle if s is None else NEW if s[:2] == (1, 1) else squash(*s[:2])[0] for s in STEPS])
    print("reforme créée :", len(STEPS), "images")
