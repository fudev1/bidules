# Les accessoires de la limace, que l'app pose en direct dans toutes les animations : sur les yeux, les lunettes ; au sommet
# de la tête, l'hélice (à la place des cheveux, tools/cheveux.py).
#   python3 tools/accessoires.py   (relancé par mise run publier)
# - animations/accessoires/<nom>.aseprite : relevés une fois sur les images 10 (hélice) et 12 (lunettes) de crawl, où Thibault
#   les a dessinés (<nom>-modele.png) ; à retoucher à la main.
# - lunettes : 32 × 16, dessinées autour de deux yeux de profil : l'œil de gauche en x 12, celui de droite en x 18, leur bas sur la
#   ligne 8. Lunettes : contour noir, verres blancs ; la colonne 15 (le pont) s'allonge quand les yeux sont plus écartés (de face). Les verres
#   cachent les yeux.
#   Les yeux de chaque image de la feuille : gen.py (« yeux » dans sheet.json). Pour l'app : dist/js/accessoires.js.
# - auréole : 32 × 20, comme les cheveux (relevée sur l'image 11 de crawl, au-dessus de la tête) ; posée sans bouger.
# - hélice : 32 × 20, comme les cheveux : la tige au milieu du bas (x 17, ligne 19, juste au-dessus du sommet de la tête). Quatre images, un quart
#   de tour des pales chacune (créées en tournant celle du modèle) ; l'app les fait défiler d'autant plus vite que la tête bouge (dist/js/cheveux.js).
# - dist/persos/limace/<nom>.png : l'image pour l'app ; l'hélice : ses quatre images côte à côte.
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ROOT, ASE

for nom in ("lunettes", "aureole"):
    subprocess.run([ASE, "-b", f"{ROOT}/animations/accessoires/{nom}.aseprite", "--save-as", f"{ROOT}/dist/persos/limace/{nom}.png"], check=True, capture_output=True)
    print("exporté :", f"dist/persos/limace/{nom}.png")
subprocess.run([ASE, "-b", f"{ROOT}/animations/accessoires/helice.aseprite", "--sheet", f"{ROOT}/dist/persos/limace/helice.png", "--sheet-type", "horizontal"],
               check=True, capture_output=True)
print("exporté : dist/persos/limace/helice.png")
