# Planche d'un essai PixelLab, pour choisir avant d'importer : les images brutes agrandies ×4 sur un damier, numérotées de gauche à droite
# puis de haut en bas, l'image source de la requête en premier (encadrée).
#
#   python3 tools/planche.py animations/<nom>/pixellab/<date>-<commande> [--grille N] [--net]
#
#   --grille N   chaque image brute est une grille de N × N propositions (comme pour importer.py)
#   --net        montrer les images nettoyées par importer.py (net_*.png) au lieu des brutes
# Écrit planche.png dans le dossier de l'essai.
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bidules import image, lire_png
from importer import grille, reduire
import png

Z, MARGE, PAR_LIGNE = 4, 8, 8

def planche(images, source, chemin):
    cases = ([source] if source else []) + images
    n = len(cases); cols = min(n, PAR_LIGNE); rows = (n + cols - 1) // cols; T = 64 * Z
    W, H = cols * (T + MARGE) + MARGE, rows * (T + MARGE) + MARGE
    out = [[(255, 255, 255, 255)] * W for _ in range(H)]
    for k, f in enumerate(cases):
        X0, Y0 = MARGE + (k % cols) * (T + MARGE), MARGE + (k // cols) * (T + MARGE)
        for y in range(T):
            for x in range(T):
                p = f[y // Z][x // Z]
                out[Y0 + y][X0 + x] = p if p[3] >= 128 else ((228, 228, 228, 255) if (x // 16 + y // 16) % 2 else (244, 244, 244, 255))
        if source and k == 0:
            for i in range(-3, T + 3):
                for e in range(3): out[Y0 - 3 + e][X0 + i] = out[Y0 + T + e][X0 + i] = out[Y0 + i][X0 - 3 + e] = out[Y0 + i][X0 + T + e] = (230, 80, 60, 255)
    png.write(chemin, out)

if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    if len(a) < 1: sys.exit(open(__file__).read().split("\nimport")[0])
    run = os.path.abspath(a[0]); motif = "net_*.png" if "--net" in sys.argv else "brut_*.png"
    ims = [lire_png(p) for p in sorted(glob.glob(f"{run}/{motif}"))]
    if "--grille" in sys.argv: ims = [g for b in ims for g in grille(b, int(sys.argv[sys.argv.index("--grille") + 1]))]
    ims = [reduire(f) for f in ims]
    req = json.load(open(f"{run}/requete.json")) if os.path.exists(f"{run}/requete.json") else {}
    src = (req.get("sources") or {}).get("debut")
    planche(ims, image(src) if src else None, f"{run}/planche.png")
    print(f"{run}/planche.png : {len(ims)} images, numérotées à partir de 0" + (" (l'image encadrée est la source)" if src else ""))
