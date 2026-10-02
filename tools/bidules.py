# Ce que partagent les outils PixelLab (pixellab.py, importer.py, verifier.py, bilan.py) : lire les feuilles des personnages, leur palette,
# convertir les PNG venus d'ailleurs, ramener une couleur sur la palette.
# Une image se désigne par « perso:balise:n » (n-ième image de la balise, 0 par défaut) ou par le chemin d'un PNG 64 × 64.
import base64, glob, json, math, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "animations", "limace-complete"))
import png
from aseprite_io import ROOT, ASE

PERSOS = os.path.join(ROOT, "dist", "persos")
SOL, AXE = 60, 31.5                 # bas du contour sur la ligne 60, corps centré sur 31,5 (README, « Ajouter une animation »)

def feuille(perso):
    """(images, balises) de la feuille d'un personnage ; balises : {nom: (début, fin)}.
    Celle de l'app (dist/persos/<perso>/) ; pour un nouveau Bidule qui n'y est pas encore, ses animations exportées dans animations/<perso>/."""
    if os.path.exists(f"{PERSOS}/{perso}/sheet.json"): feuilles = [f"{PERSOS}/{perso}/sheet"]
    else: feuilles = [p[:-5] for p in sorted(glob.glob(f"{ROOT}/animations/{perso}/*_sheet.json"))]
    if not feuilles: sys.exit(f"pas de feuille pour {perso} : ni dist/persos/{perso}/sheet.png, ni animations/{perso}/*_sheet.png")
    images, balises = [], {}
    for f in feuilles:
        d = json.load(open(f + ".json")); n = len(images); images += png.frames(f + ".png")
        balises.update({t["name"]: (n + t["from"], n + t["to"]) for t in d["meta"]["frameTags"]})
    return images, balises

def image(ref):
    """une image 64 × 64 (lignes de pixels RGBA) depuis « perso:balise:n » ou un chemin de PNG"""
    if os.path.exists(ref): return lire_png(ref)
    perso, balise, *n = ref.split(":")
    im, tags = feuille(perso)
    if balise not in tags: sys.exit(f"{perso} n'a pas de balise {balise} (balises : {', '.join(tags)})")
    a, b = tags[balise]; k = a + int(n[0]) if n else a
    if k > b: sys.exit(f"{balise} n'a que {b - a + 1} images")
    return im[k]

def palette(perso):
    """les couleurs (RGB) de la feuille validée d'un personnage : la seule palette autorisée pour ses nouvelles images"""
    return sorted({p[:3] for f in feuille(perso)[0] for row in f for p in row if p[3]})

def lire_png(p):
    """n'importe quel PNG en lignes RGBA : le module png ne lit que le RGBA 8 bits, les autres passent d'abord par Aseprite"""
    b = open(p, "rb").read(26)
    if b[24] == 8 and b[25] == 6: return png.read(p)[2]
    with tempfile.TemporaryDirectory() as tmp:
        lua = f"{tmp}/rgba.lua"
        open(lua, "w").write('local s = app.open(app.params.src)\nif s.colorMode ~= ColorMode.RGB then app.command.ChangePixelFormat{format="rgb"} end\ns:saveCopyAs(app.params.dst)\n')
        subprocess.run([ASE, "-b", "--script-param", f"src={p}", "--script-param", f"dst={tmp}/out.png", "--script", lua], check=True, stdout=subprocess.DEVNULL)
        return png.read(f"{tmp}/out.png")[2]

def png_b64(px):
    """une image en PNG encodé base64, comme l'attend l'API PixelLab"""
    with tempfile.NamedTemporaryFile(suffix=".png") as fh:
        png.write(fh.name, px); return base64.b64encode(open(fh.name, "rb").read()).decode()

def _oklab(c):
    l = [((v / 255 + .055) / 1.055) ** 2.4 if v / 255 > .04045 else v / 255 / 12.92 for v in c[:3]]
    L = (.4122214708 * l[0] + .5363325363 * l[1] + .0514459929 * l[2]) ** (1 / 3)
    M = (.2119034982 * l[0] + .6806995451 * l[1] + .1073969566 * l[2]) ** (1 / 3)
    S = (.0883024619 * l[0] + .2817188376 * l[1] + .6299787005 * l[2]) ** (1 / 3)
    return (.2104542553 * L + .7936177850 * M - .0040720468 * S, 1.9779984951 * L - 2.4285922050 * M + .4505937099 * S,
            .0259040371 * L + .7827717662 * M - .8086757660 * S)

def palette_libre(images, seuil=.04, part=.002):
    """pour un nouveau Bidule, sans palette encore : les couleurs fréquentes des images, sans les quasi-doublons ni les couleurs de quelques pixels"""
    n = {}
    for f in images:
        for row in f:
            for p in row:
                if p[3] >= 128: n[p[:3]] = n.get(p[:3], 0) + 1
    total, gardees = sum(n.values()), []
    for c in sorted(n, key=n.get, reverse=True):
        if n[c] >= part * total and all(math.dist(_oklab(c), _oklab(g)) >= seuil for g in gardees): gardees.append(c)
    return gardees

def plus_proche(pal, d_abord=(), seuil=.08):
    """fonction couleur -> couleur de la palette la plus proche à l'œil (distance OKLab), avec un cache.
    Les couleurs de `d_abord` (celles de l'image source) passent avant les autres quand l'une d'elles est assez proche :
    sinon une couleur d'effet presque identique (#9fc9f5 pour la lumière #a4c6ff) prendrait la place de la bonne."""
    lab = [(_oklab(c), c) for c in pal]; prio = [(_oklab(c), c) for c in d_abord]; cache = {}
    def f(c):
        c = tuple(c[:3])
        if c not in cache:
            o = _oklab(c); p = min(prio, key=lambda e: math.dist(e[0], o)) if prio else None
            cache[c] = p[1] if p and math.dist(p[0], o) < seuil else min(lab, key=lambda e: math.dist(e[0], o))[1]
        return cache[c]
    return f

def boite(f):
    """(x0, y0, x1, y1) des pixels opaques, ou None si l'image est vide"""
    pts = [(x, y) for y, row in enumerate(f) for x, p in enumerate(row) if p[3]]
    if not pts: return None
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)

def corps(f):
    """les pixels (x, y) de la plus grande tache opaque d'une image (4-connexité) : le corps, sans les effets autour"""
    reste = {(x, y) for y, row in enumerate(f) for x, p in enumerate(row) if p[3]}; best = set()
    while reste:
        pile = [reste.pop()]; t = set(pile)
        while pile:
            x, y = pile.pop()
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if q in reste: reste.remove(q); t.add(q); pile.append(q)
        if len(t) > len(best): best = t
    return best

def caler(f, ref, rayon=12):
    """(dx, dy) qui superpose le mieux le corps de f à celui de ref (le plus de pixels communs)"""
    A, B = corps(f), corps(ref)
    return max(((dx, dy) for dx in range(-rayon, rayon + 1) for dy in range(-rayon, rayon + 1)),
               key=lambda d: (sum((x + d[0], y + d[1]) in B for x, y in A), -abs(d[0]) - abs(d[1])))
