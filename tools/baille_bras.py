# Pendant le bâillement, le Bidule étire ses deux petits bras : ils sortent des côtés du corps et s'allongent à 45° vers le haut, avec une petite main au bout.
# Les bras sont dessinés par-dessus l'image : relancer l'outil donne le même résultat.
#   python3 tools/baille_bras.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ROOT, frames, replace_frames
from arms import arm

# longueur de chaque bras (en pixels, le long de la diagonale) pour chacune des 10 images : repos, bouche qui s'ouvre, pic du bâillement, retour
LENGTH = [0, 0, 2, 4, 6, 8, 8, 4, 0, 0]
ROOT_ABOVE_GROUND = 13                  # le bras part du côté du corps, 13 lignes au-dessus du sol (au-dessus de la queue)

if __name__ == "__main__":
    fl = frames(f"{ROOT}/animations/baille/baille_sheet.png")
    out = []
    for f, n in zip(fl, LENGTH):
        if not n: out.append(None); continue
        g = [row[:] for row in f]
        out.append(arm(arm(g, -1, n, ROOT_ABOVE_GROUND), 1, n, ROOT_ABOVE_GROUND))
    replace_frames("baille", "baille", out)
    print("baille : bras sur", sum(1 for n in LENGTH if n), "images")
