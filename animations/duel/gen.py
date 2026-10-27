# Les images du duel, en essai (issue #94) : la limace en raquette, reprise du choc contre un bord de la feuille,
# et la limace roulée en boule pour la balle, dessinée ici. Écrit dist/persos/limace/duel-raquette.png (2 cases de
# 18 x 64, face vers la gauche, collée au bord droit) et duel-balle.png (4 cases de 16 x 16, un quart de tour chacune).
from pathlib import Path
from PIL import Image

ICI = Path(__file__).parent
DIST = ICI.parent.parent / "dist" / "persos" / "limace"
feuille = Image.open(DIST / "sheet.png").convert("RGBA")

def image(n):
    x, y = n * 64 % feuille.width, n * 64 // feuille.width * 64
    return feuille.crop((x, y, x + 64, y + 64))

# le corps seul : le plus grand morceau de pixels opaques, sans les éclats autour
def corps(img):
    px, vus, meilleur = img.load(), set(), set()
    for y in range(64):
        for x in range(64):
            if px[x, y][3] and (x, y) not in vus:
                morceau, pile = set(), [(x, y)]
                while pile:
                    p = pile.pop()
                    if p in vus or not (0 <= p[0] < 64 and 0 <= p[1] < 64) or not px[p][3]: continue
                    vus.add(p); morceau.add(p)
                    pile += [(p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)]
                if len(morceau) > len(meilleur): meilleur = morceau
    out = Image.new("RGBA", (64, 64))
    for p in meilleur: out.putpixel(p, px[p])
    return out

# au repos (le choc contre le bord), puis étirée et amincie juste après un renvoi
RAQUETTE = [226, 227]
raq = Image.new("RGBA", (18 * len(RAQUETTE), 64))
for i, n in enumerate(RAQUETTE):
    c = corps(image(n)); bb = c.getbbox(); c = c.crop(bb)
    raq.paste(c, (18 * i + 18 - c.width, (64 - c.height) // 2))
raq.save(DIST / "duel-raquette.png")

COULEURS = {"k": "#000000", "L": "#a4c6ff", "B": "#639bff", "S": "#4577e0"}
# la boule, toujours éclairée en haut à gauche ; seuls le visage et la queue enroulée tournent
BOULE = """
.....kkkkkk.....
...kkLLLLBBkk...
..kLLLBBBBBBBk..
.kLLBBBBBBBBBSk.
.kLBBBBBBBBBBSk.
kLBBBBBBBBBBBBSk
kLBBBBBBBBBBBBSk
kBBBBBBBBBBBBBSk
kBBBBBBBBBBBBBSk
kBBBBBBBBBBBBBSk
kBBBBBBBBBBBBSSk
.kBBBBBBBBBBBSk.
.kSBBBBBBBBBSSk.
..kSSBBBBBBSSk..
...kkSSSSSSkk...
.....kkkkkk.....
""".split()
TRAITS = """
................
................
................
................
....k......k....
.....k....k.....
....k......k....
................
.......kk.......
................
...kk...........
....kkk.........
.......kkk......
................
................
................
""".split()
def grille(g, rot=0):
    img = Image.new("RGBA", (16, 16))
    for y, ligne in enumerate(g):
        for x, c in enumerate(ligne):
            if c in COULEURS: img.putpixel((x, y), tuple(int(COULEURS[c][i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    return img.rotate(-90 * rot)
balle = Image.new("RGBA", (64, 16))
for i in range(4):
    b = grille(BOULE); t = grille(TRAITS, i); b.paste(t, (0, 0), t); balle.paste(b, (16 * i, 0))
balle.save(DIST / "duel-balle.png")
