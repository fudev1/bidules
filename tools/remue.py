# Crée animations/remue/remue.aseprite à partir de la pose de dort : la bulle a éclaté, l'œil de devant s'entrouvre, l'œil de derrière reste fermé.
# Le fichier est ensuite à toi : l'outil refuse d'écraser un remue.aseprite existant.
#   python3 tools/remue.py
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ROOT, create, frames, replace_frames

INK, BODY = (0, 0, 0, 255), (99, 155, 255, 255)
CLEAR = (0, 0, 0, 0)
# (image, durée en ms) : yeux fermés, œil de devant à moitié ouvert, ouvert, à moitié ouvert
STEPS = [("closed", 400), ("half", 120), ("open", 700), ("half", 120)]
FRONT_EYE_X = 44                      # centre de l'œil de devant (le « v » fait 3 pixels de large, sur les lignes 42 et 43)

def pose(dort0, eye):
    f = [row[:] for row in dort0]
    for y in range(44, 49):           # la bulle sur le nez a éclaté (le contour du museau, jusqu'à x = 54, reste)
        for x in range(55, 64): f[y][x] = CLEAR
    if eye != "closed":
        for x in (FRONT_EYE_X - 1, FRONT_EYE_X, FRONT_EYE_X + 1):
            for y in (42, 43): f[y][x] = BODY
        for y in ((42, 43) if eye == "half" else (41, 42, 43)): f[y][FRONT_EYE_X] = INK
    return f

if __name__ == "__main__":
    create("dort/dort", "remue", "remue", [ms for _, ms in STEPS])
    dort0 = frames(f"{ROOT}/animations/dort/dort_sheet.png")[0]
    replace_frames("remue", "remue", [pose(dort0, eye) for eye, _ in STEPS])
    print("remue créée :", len(STEPS), "images")
