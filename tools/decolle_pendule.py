# Deux animations de la limace, calculées comme la goutte que dist/index.html dessine quand on la décolle (pullDraw, tools/boule.py) :
#  - decolle : de face au sol, elle prend son élan (s'écrase), s'étire vers le haut (la tête reste ronde, le bas s'amincit en fil, le pied reste
#    en flaque), puis le fil casse et elle part vers le haut. Dessinée au sol (bas sur la ligne 60).
#  - pendule (boucle) : au plafond, elle pend en goutte au bout de son fil et se balance, les yeux vers où elle va.
#    Dessinée telle qu'on la voit à l'écran (le fil part du haut de l'image, le visage à l'endroit) : l'app ne doit pas la retourner.
#   python3 tools/decolle_pendule.py -> animations/decolle/frames.json et animations/pendule/frames.json, à dessiner avec aseprite_animation
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bidules import ROOT, image

INK, BASE, SHADE, LIGHT, CLEAR = (0, 0, 0, 255), (99, 155, 255, 255), (69, 119, 224, 255), (164, 198, 255, 255), (0, 0, 0, 0)
R = 29 * .44                                    # rayon de la boule (tools/boule.py)

def colorer(mask):
    """les couleurs de styleRender (tools/boule.py) : contour, ombre en bas à droite, lumière en haut à gauche"""
    inn = lambda x, y: (x, y) in mask
    inner = lambda x, y: inn(x, y) and inn(x + 1, y) and inn(x - 1, y) and inn(x, y + 1) and inn(x, y - 1)
    t0, b0 = min(p[1] for p in mask), max(p[1] for p in mask); c0 = (min(p[0] for p in mask) + max(p[0] for p in mask)) / 2
    f = [[CLEAR] * 64 for _ in range(64)]
    for x, y in mask:
        c = BASE
        if not inner(x, y): c = INK
        elif not inner(x, y + 3) or not inner(x + 2, y): c = SHADE
        elif (not inner(x - 3, y - 1) and x < c0 and y < b0 - 7) or (not inner(x - 1, y - 3) and x < c0 + 3 and y < t0 + 6): c = LIGHT
        f[y][x] = c
    return f

def nettoyer(mask):
    """sans les pixels qui ne tiennent qu'à un voisin (le contour reste propre)"""
    for _ in range(2):
        mask = {(x, y) for x, y in mask if sum((x + a, y + b) in mask for a, b in ((0, -1), (-1, 0), (1, 0), (0, 1))) >= 2}
    return mask

def visage(f, cx, cy, regard=0, bouche="sourire", envers=False):
    """deux yeux de 1 × 3 (comme repos, un peu plus courts) et une bouche, centrés sur (cx, cy) ; envers : retourné de haut en bas, comme au plafond"""
    ex = round(cx + regard); sg = -1 if envers else 1
    for dx in (-4, 3):
        for dy in (-2, -1, 0): f[round(cy) + sg * dy][ex + dx] = INK
    y = round(cy) + sg * 4
    if bouche == "sourire": pts = [(-2, 0), (-1, 1), (0, 1), (1, 1), (2, 0)]
    elif bouche == "o": pts = [(-1, 0), (0, 0), (-1, 1), (0, 1)]
    else: pts = [(-1, 0), (0, 0), (1, 0)]
    for dx, dy in pts: f[y + sg * dy][ex + dx] = INK

# --- decolle ---------------------------------------------------------------------------------------------------------------
REPOS = image("limace:repos")
RT, RB = 32, 60                                 # haut et bas de repos
RROWS = {y: (min(x for x in range(64) if REPOS[y][x][3]), max(x for x in range(64) if REPOS[y][x][3])) for y in range(RT, RB + 1)}
FACE = [(x, y) for y in range(42, 53) for x in range(25, 40) if REPOS[y][x][:3] == (0, 0, 0) and REPOS[y][x][3]]

def repos_row(f):
    """(centre, demi-largeur) de repos à la hauteur relative f (0 = sol, 1 = sommet)"""
    y = RB - f * (RB - RT); i = max(RT, min(RB, math.floor(y))); j = min(RB, i + 1); a = y - i
    (l1, r1), (l2, r2) = RROWS[i], RROWS[j]; l, r = l1 + (l2 - l1) * a, r1 + (r2 - r1) * a
    return (l + r + 1) / 2, (r + 1 - l) / 2

def goutte_rows(h, flaque, fil=True):
    """la goutte posée : une boule en haut, un fil qui s'élargit vers elle, une flaque au sol. {y: (centre, demi-largeur)}"""
    by = 60.5 - h + R; rows = {}
    for y in range(64):
        Y = y + .5
        if Y > 60.5 or Y < 60.5 - h: continue
        hw = math.sqrt(max(0, R * R - (Y - by) ** 2)) if Y <= by + R else 0
        t = max(0, min(1, (60.5 - Y) / max(1, 60.5 - by)))          # 0 au sol, 1 au centre de la boule
        if Y >= by and fil: hw = max(hw, (1.4 + (R * 1.9 - 1.4) * t ** 2.2) / 2)          # le fil s'arrête au centre de la boule
        if 60.5 - Y < 3: hw = max(hw, flaque)
        rows[y] = (31.5, hw)
    return rows

def decolle_image(h, w, m, flaque=8, levee=0, fil=True, brut=False):
    """h : hauteur, w : largeur relative, m : 0 = forme de repos, 1 = goutte ; levee : de combien elle est montée (le fil cassé)"""
    G = goutte_rows(h, flaque, fil); gt, gb = min(G), max(G); mask = set()
    for y in range(64):
        Y = y + .5; f = (60.5 - Y) / h
        if not 0 <= f <= 1: continue
        c1, hw1 = repos_row(f); hw1 *= w
        gy = min(gb, max(gt, round(gb - f * (gb - gt)))); c2, hw2 = G[gy]
        c, hw = c1 + (c2 - c1) * m, hw1 + (hw2 - hw1) * m
        if not fil: hw = hw2 if hw2 > 1 else -1                          # fil cassé : il ne reste que la boule
        for x in range(64):
            if abs(x + .5 - c) <= hw: mask.add((x, y - levee))
    mask = nettoyer({p for p in mask if 0 <= p[1] < 64})
    top = min(y for _, y in mask); s = (1 - m) * min(1, h / 29) + m * (2 * R / 29)
    if brut: return mask, top + (47 - RT) * s                            # le masque et la hauteur du milieu du visage
    f = colorer(mask)
    for x, y in FACE:                                                    # le visage de repos, à sa place relative sous le sommet
        ny = round(top + (y - RT) * s)
        if 0 <= ny < 64 and (x, ny) in mask: f[ny][x] = INK
    return f

DECOLLE = [  # (h, w, m, flaque, levée, fil, durée ms)
    (29, 1.00, 0, 8, 0, True, 160), (27, 1.08, 0, 8, 0, True, 90), (24, 1.16, 0, 8, 0, True, 140),     # elle prend son élan
    (31, 0.96, .15, 9, 0, True, 70), (37, 0.92, .4, 9, 0, True, 70), (43, 0.9, .65, 8, 0, True, 70),   # elle s'étire vers le haut
    (49, 0.9, .85, 7, 0, True, 80), (53, 0.9, 1, 6, 0, True, 120), (55, 0.9, 1, 4, 0, True, 90),        # le fil s'amincit, la flaque rétrécit
    (55, 0.9, 1, 0, 4, False, 60), (55, 0.9, 1, 0, 14, False, 60), (55, 0.9, 1, 0, 30, False, 60)]   # le fil casse : elle part vers le haut

# --- pendule ---------------------------------------------------------------------------------------------------------------
GX, GY, L, AMPL, N = 31.5, 0.5, 27.0, 26, 16       # point d'attache (haut de l'image), longueur du fil jusqu'au centre, amplitude (degrés), images

def pendule_image(k, gy=GY, l=L, ampl=AMPL, envers=False):
    ph = 2 * math.pi * k / N; th = math.radians(ampl) * math.sin(ph); v = math.cos(ph) * ampl / AMPL   # angle, vitesse (signe : sens du mouvement)
    GY, L = gy, l
    ux, uy = math.sin(th), math.cos(th)                                                             # le long du fil, vers la boule
    e = .1 * abs(v)                                                                                 # plus vite = plus allongée le long du fil
    B = (GX + L * ux, GY + L * uy)
    lag = -3.5 * v                                                                                  # le fil traîne derrière la boule (courbé)
    C = (GX + L * .5 * ux + lag * uy, GY + L * .5 * uy - lag * ux)
    a, b = R * (1 + e), R / (1 + e)
    mask = set()
    pts = [((1 - t) ** 2 * GX + 2 * (1 - t) * t * C[0] + t * t * B[0], (1 - t) ** 2 * GY + 2 * (1 - t) * t * C[1] + t * t * B[1], t) for t in [i / 60 for i in range(61)]]
    for y in range(64):
        for x in range(64):
            X, Y = x + .5, y + .5; dx, dy = X - B[0], Y - B[1]
            if (dx * ux + dy * uy) ** 2 / a ** 2 + (dx * uy - dy * ux) ** 2 / b ** 2 <= 1: mask.add((x, y)); continue
            if any(math.hypot(X - px, Y - py) <= (1.4 + (R * 1.7 - 1.4) * t ** 2) / 2 for px, py, t in pts): mask.add((x, y))
    f = colorer(nettoyer(mask))
    visage(f, B[0] + (-1.5 if envers else 1.5) * ux, B[1] + (-1.5 if envers else 1.5) * uy, regard=round(2 * v), bouche="sourire" if abs(v) > .4 else "o", envers=envers)
    return f

# --- decolle-pendule : au plafond, il se décolle vers le bas puis se balance -----------------------------------------------
# Le décollage retourné de haut en bas (sans que le fil casse), le visage à l'envers comme crawl au plafond ; puis un pendule accroché au même point, de même longueur :
# d'abord des balancements qui grandissent, puis la boucle (balise pendule-plafond).
# Dans l'app, l'image au plafond déborde de sa fenêtre au-delà de la ligne 51 de l'image : tout doit tenir au-dessus (goutte de 47 pixels au plus).
H_FIN = 47                                       # hauteur à la dernière image du décollage : le fil fait alors H_FIN - R jusqu'au centre de la boule
PLAFOND = [(29, 1.00, 0, 8, 160), (27, 1.08, 0, 8, 90), (24, 1.16, 0, 8, 140), (31, .96, .15, 9, 70), (36, .92, .4, 9, 70),
           (41, .9, .65, 8, 70), (45, .9, .85, 7, 80), (H_FIN, .9, 1, 5, 120)]   # (h, w, m, flaque, durée ms)
GY2, L2, AMPL2 = 63.5 - 60.5, H_FIN - R, 20

def retourne(mask, cy):
    m2 = nettoyer({(x, 63 - y) for x, y in mask}); f = colorer(m2); cy2 = 63 - cy
    for x, y in FACE:
        ny = round(cy2 - (y - 47))                                       # visage à l'envers, comme crawl au plafond
        if (x, ny) in m2: f[ny][x] = INK
    return f

def plafond():
    imgs = [(retourne(*decolle_image(h, w, m, fl, brut=True)) if i else retourne({(x, y) for y in range(64) for x in range(64) if REPOS[y][x][3]}, 47), d)
            for i, (h, w, m, fl, d) in enumerate(PLAFOND)]
    imgs.append((pendule_image(0, GY2, L2, 0, True), 160))                     # pendu, immobile, un instant
    for k in range(N):                                                    # il prend de l'élan : un balancement qui grandit
        imgs.append((pendule_image(k, GY2, L2, AMPL2 * (k + 1) / N, True), 70))
    debut = len(imgs)
    imgs += [(pendule_image(k, GY2, L2, AMPL2, True), 70) for k in range(N)]
    return imgs, debut

def ecrire(nom, imgs):
    pal, frames = {"_": "#00000000"}, []
    for f, ms in imgs:
        rows = []
        for row in f:
            s = ""
            for p in row:
                if not p[3]: s += "_"; continue
                c = "#%02x%02x%02x" % p[:3]
                if c not in pal.values(): pal["abcdefghij"[len(pal) - 1]] = c
                s += next(k for k, v in pal.items() if v == c)
            rows.append(s)
        frames.append({"rows": rows, "duration": ms / 1000})
    os.makedirs(f"{ROOT}/animations/{nom}", exist_ok=True)
    json.dump({"palette": pal, "frames": frames}, open(f"{ROOT}/animations/{nom}/frames.json", "w"))
    json.dump({"palette": pal, "frames": frames}, open(f"/tmp/{nom}.json", "w"))
    print(nom, len(frames), "images")

ecrire("decolle", [(REPOS, d) if i == 0 else (decolle_image(h, w, m, fl, lv, fil), d) for i, (h, w, m, fl, lv, fil, d) in enumerate(DECOLLE)])
ecrire("pendule", [(pendule_image(k), 70) for k in range(N)])
imgs, debut = plafond(); ecrire("decolle-pendule", imgs)
print("balises : decolle-pendule 1 à", debut, ", pendule-plafond", debut + 1, "à", len(imgs))
