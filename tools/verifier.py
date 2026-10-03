# Vérifie qu'une animation suit les règles des Bidules (README, « Ajouter une animation », et moodboard/style-bidules.md).
#
#   python3 tools/verifier.py <perso> <fichier .aseprite | feuille _sheet.png> [--en-l-air]
#
# Erreurs (code de sortie 1) : image qui n'est pas en 64 × 64, pixels semi-transparents, couleurs hors de la palette du personnage.
# Avertissements : première ou dernière image pas posée sur la ligne 60, corps qui sort de x 2 à 61 (il ne tiendrait plus une fois retourné),
# plus d'un quart du contour du corps (la plus grande tache, sans les effets autour) qui n'est pas à l'encre, plus de 8 pixels isolés (poussière d'IA).
import os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bidules import ASE, SOL, boite, corps, lire_png, palette

def verifier(images, perso, en_l_air=False):
    """[(n° d'image ou None, 'erreur' | 'avertissement', message)]"""
    pal = set(palette(perso)); encre = min(pal, key=sum); out = []
    for k, f in enumerate(images):
        if len(f) != 64 or len(f[0]) != 64: out.append((k, "erreur", f"{len(f[0])} × {len(f)} au lieu de 64 × 64")); continue
        px = [(x, y, p) for y, row in enumerate(f) for x, p in enumerate(row) if p[3]]
        semi = sum(1 for _, _, p in px if p[3] < 255)
        if semi: out.append((k, "erreur", f"{semi} pixels semi-transparents"))
        hors = {}
        for _, _, p in px:
            if p[:3] not in pal: hors[p[:3]] = hors.get(p[:3], 0) + 1
        if hors: out.append((k, "erreur", f"{sum(hors.values())} pixels hors palette : " + ", ".join("#%02x%02x%02x" % c for c in sorted(hors, key=hors.get, reverse=True)[:5])))
        b = boite(f)
        if not b: out.append((k, "avertissement", "image vide")); continue
        if (k in (0, len(images) - 1)) and not en_l_air and b[3] != SOL: out.append((k, "avertissement", f"bas du contour sur la ligne {b[3]} au lieu de {SOL}"))
        if b[0] < 2 or b[2] > 61: out.append((k, "avertissement", f"x de {b[0]} à {b[2]} : sort de 2 à 61, ne tiendra pas une fois retournée"))
        vide = lambda x, y: not (0 <= x < 64 and 0 <= y < 64) or not f[y][x][3]
        C = corps(f); bord = [f[y][x] for x, y in C if any((x + i, y + j) not in C for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        pas_encre = sum(1 for p in bord if p[:3] != encre)
        if bord and pas_encre / len(bord) > .25: out.append((k, "avertissement", f"contour : {pas_encre} pixels de bord sur {len(bord)} ne sont pas à l'encre"))
        seuls = sum(1 for x, y, _ in px if all(vide(x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1) if i or j))
        if seuls > 8: out.append((k, "avertissement", f"{seuls} pixels isolés"))
    return out

def rapport(res):
    if not res: return "vérification : tout est conforme"
    return "vérification :\n" + "\n".join(f"  {'image ' + str(k) if k is not None else 'animation'} — {n} : {m}" for k, n, m in res)

def images_de(chemin):
    if chemin.endswith(".aseprite"):
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run([ASE, "-b", chemin, "--sheet", f"{tmp}/s.png", "--sheet-type", "horizontal"], check=True, stdout=subprocess.DEVNULL)
            px = lire_png(f"{tmp}/s.png")
    else: px = lire_png(chemin)
    return [[row[k * 64:(k + 1) * 64] for row in px] for k in range(len(px[0]) // 64)] if len(px) == 64 else [px]

if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    if len(a) != 2: sys.exit(open(__file__).read().split("\nimport")[0])
    res = verifier(images_de(a[1]), a[0], en_l_air="--en-l-air" in sys.argv)
    print(rapport(res)); sys.exit(1 if any(n == "erreur" for _, n, _ in res) else 0)
