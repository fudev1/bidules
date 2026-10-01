# attrape : aligne le bas du corps des images 2 à 4 sur celui de l'image 1 (tu l'as redessiné ; l'ancienne queue dépassait encore).
# Ne touche qu'au bas du corps : les bras, le visage et la bouche des images 2 à 4 restent ceux que tu as dessinés, l'image 1 n'est pas modifiée.
#   sous la ligne 39 : tout le bas du corps vient de l'image 1
#   lignes 36 à 38   : seulement à gauche du corps (x <= 24), pour effacer le reste de l'ancienne queue sans toucher à la bouche
#   python3 tools/attrape_bas.py
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite_io import ROOT, ase, frames, replace_frames

def align(f, base):
    f = [row[:] for row in f]
    for y in range(36, 64):
        for x in range(64):
            if y >= 39 or x <= 24: f[y][x] = base[y][x]
    return f

if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:                    # les images telles qu'elles sont enregistrées dans le .aseprite
        ase(f"{ROOT}/animations/attrape/attrape.aseprite", "--sheet", f"{tmp}/s.png", "--sheet-type", "horizontal")
        fl = frames(f"{tmp}/s.png")
    replace_frames("attrape", "attrape", [None] + [align(f, fl[0]) for f in fl[1:]])
    print("attrape : bas du corps des images 2 à 4 aligné sur l'image 1")
