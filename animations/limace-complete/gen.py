import math, json, os, struct, zlib, sys
sys.path.insert(0, os.path.dirname(__file__))
from png import frames, write
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools"))
from boule import arms_of, parts_of
# chemins relatifs au script : le projet peut être cloné n'importe où
D0 = os.path.dirname(os.path.abspath(__file__)); A0 = os.path.dirname(D0)
def durations(meta):
    f = meta["frames"]; return [x["duration"] for x in (f.values() if isinstance(f, dict) else f)]
def shift_xy(f, dx, dy): return [[f[y - dy][x - dx] if 0 <= x - dx < 64 and 0 <= y - dy < 64 else (0, 0, 0, 0) for x in range(64)] for y in range(64)]
# animations dessinées par Thibault (dossiers voisins, exportées d'Aseprite) : feuille PNG + JSON, dx et dy pour recaler une image
def hand(folder, sheet, a=0, b=None, dx=0, dy=0):
    fr = [shift_xy(f, dx, dy) for f in frames(f"{A0}/{folder}/{sheet}_sheet.png")]; du = durations(json.load(open(f"{A0}/{folder}/{sheet}_sheet.json")))
    b = len(fr) - 1 if b is None else b
    return [(fr[k], du[k]) for k in range(a, b + 1)]
TURN = hand("turn", "turn")
A, B, C, D = (0x63, 0x9b, 0xff, 255), (0, 0, 0, 255), (0x45, 0x77, 0xe0, 255), (0xa4, 0xc6, 0xff, 255)
BLEU = dict(A=A, C=C, D=D)
VERT = dict(A=(0x7f, 0xd4, 0x6a, 255), C=(0x4f, 0xae, 0x45, 255), D=(0xc6, 0xf0, 0xb0, 255))
GOLD, GOLD2, WHITE, MIST = (0xff, 0xd2, 0x3f, 255), (0xff, 0xf3, 0xb0, 255), (255, 255, 255, 255), (0xd8, 0xdd, 0xe6, 255)
# l'image de face du demi-tour (= la pose de repos : queue à gauche) sert de modèle aux animations générées plus bas ; le corps est centré sur l'axe 31,5,
# la queue dépasse à gauche, bas sur la ligne 60
front = TURN[6][0]
mask0 = {(x, y) for y in range(64) for x in range(64) if front[y][x][3]}
TOP, BOT = min(p[1] for p in mask0), max(p[1] for p in mask0)
H, CX = BOT - TOP + 1, 31.5
EYES, MOUTH = [(28, 45.5), (35, 45.5)], (32, 51)      # yeux et bouche de la pose de repos

def params(sx=1, sy=1, shear=0, neck=0, dy=0, wob=0, top=None):
    if top is not None: dy = top - (BOT + .5 - H * sy)
    return (sx, sy, shear, neck, dy, wob)
def warp(P):
    sx, sy, shear, neck, dy, wob = P
    out = set()
    for y in range(64):
        for x in range(64):
            yy = y + .5 - dy
            t = (BOT + .5 - yy) / (H * sy)
            if t < -.05 or t > 1.1: continue
            tc = max(0, min(1, t)); sxe = sx * (1 - neck * tc ** 1.5)
            sh = shear * t + wob * math.sin(tc * math.pi)
            u = CX + (x + .5 - CX - sh) / sxe; v = BOT + .5 - (BOT + .5 - yy) / sy
            if (math.floor(u), math.floor(v)) in mask0: out.add((x, y))
    return out
def fwd(P, u, v):
    sx, sy, shear, neck, dy, wob = P
    t = (BOT + .5 - v) / H; tc = max(0, min(1, t))
    return CX + (u - CX) * sx * (1 - neck * tc ** 1.5) + shear * t + wob * math.sin(tc * math.pi), BOT + .5 - (BOT + .5 - v) * sy + dy
def render(m, pal):
    px = [[(0, 0, 0, 0)] * 64 for _ in range(64)]
    inner = {p for p in m if all((p[0] + a, p[1] + b) in m for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    xs = [p[0] for p in m]; ys = [p[1] for p in m]; t0, b0, c0 = min(ys), max(ys), (min(xs) + max(xs)) / 2
    I = lambda a, b: (a, b) in inner
    for (x, y) in m:
        if (x, y) not in inner: px[y][x] = B; continue
        if not I(x, y + 3) or not I(x + 2, y): col = pal["C"]
        elif (not I(x - 3, y - 1) and x < c0 and y < b0 - 7) or (not I(x - 1, y - 3) and x < c0 + 3 and y < t0 + 6): col = pal["D"]
        else: col = pal["A"]
        px[y][x] = col
    return px, (t0, b0, min(xs), max(xs))

def draw_face(px, P, eyes="line", mouth="line", look=(0, 0)):
    def put(x, y, c=B):
        if 0 <= x < 64 and 0 <= y < 64: px[y][x] = c
    pos = [fwd(P, ex + .5, ey) for ex, ey in EYES]
    E = [(int(round(x - .5)) + look[0], int(round(y - .5)) + look[1]) for x, y in pos]
    mx, my = fwd(P, MOUTH[0] + .5, MOUTH[1] + .5); mx, my = int(round(mx - .5)), int(round(my - .5))
    for i, (ex, ey) in enumerate(E):
        k = eyes if not isinstance(eyes, tuple) else eyes[i]
        if k == "line": [put(ex, ey + d) for d in (-2, -1, 0, 1)]
        elif k == "big": [put(ex + dx, ey + d) for d in (-2, -1, 0, 1, 2) for dx in (0, 1)]
        elif k == "happy": put(ex - 1, ey + 1); put(ex, ey); put(ex + 1, ey + 1)
        elif k == "closed": [put(ex + d, ey + 1) for d in (-1, 0, 1)]
        elif k == "x": [put(ex + a, ey + b) for a, b in ((-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1))]
        elif k == "dot": put(ex, ey - 1); put(ex, ey)
        elif k == "up": [put(ex - (1 if i == 0 else -1), ey + d - 2) for d in (-1, 0, 1)]
        elif k == "down": [put(ex + (1 if i == 0 else -1), ey + d + 1) for d in (-1, 0, 1)]
        elif k == "angry":
            [put(ex, ey + d) for d in (-1, 0, 1)]
            s = 1 if i == 0 else -1
            put(ex - s, ey - 4); put(ex, ey - 4); put(ex + s, ey - 3)
    m = mouth
    if m == "line": [put(mx + d, my) for d in range(-2, 3)]
    elif m == "small": [put(mx + d, my) for d in (-1, 0, 1)]
    elif m == "o": [put(mx + a, my + b) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a, b) != (0, 0)]
    elif m == "open": [put(mx + a, my + b) for a in range(-2, 3) for b in (-1, 0, 1) if not (abs(a) == 2 and b != 0)]
    elif m == "yawn": [put(mx + a, my + b) for a in (-2, -1, 0, 1, 2) for b in range(-2, 3) if not (abs(a) == 2 and abs(b) == 2) and not (abs(a) == 2 and b == -1 and False)]
    elif m == "frown": put(mx - 2, my + 1); [put(mx + d, my) for d in (-1, 0, 1)]; put(mx + 2, my + 1)
    elif m == "smile": put(mx - 2, my - 1); [put(mx + d, my) for d in (-1, 0, 1)]; put(mx + 2, my - 1)
    elif m == "wavy": [put(mx + d, my + (d % 2)) for d in range(-3, 4)]
    return px
def fx(px, box, kind, k=0):
    t0, b0, x0, x1 = box
    def put(x, y, c):
        if 0 <= x < 64 and 0 <= y < 64: px[y][x] = c
    def star(x, y):
        put(x, y, GOLD2); [put(x + a, y + b, GOLD) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))]; [put(x + a, y + b, B) for a, b in ((2, 0), (-2, 0), (0, 2), (0, -2))]
    def drop(x, y):
        for a, b in ((0, -2), (0, -1), (-1, 0), (0, 0), (1, 0), (0, 1)): put(x + a, y + b, D)
        for a, b in ((0, -3), (-1, -1), (1, -1), (-2, 0), (2, 0), (-1, 1), (1, 1), (0, 2)): put(x + a, y + b, B)
        put(x, y - 1, WHITE)
    def puff(x, y, r):
        for a in range(-r, r + 1):
            for b in range(-r, r + 1):
                d = a * a + b * b
                if d <= r * r: put(x + a, y + b, WHITE if a + b < 0 else MIST)
                elif d <= (r + 1) * (r + 1): put(x + a, y + b, B)
    if kind == "stars":
        pts = [(x0 + 2, t0 - 4), (x1 - 2, t0 - 6), ((x0 + x1) // 2, t0 - 9)] if k == 0 else [(x0 + 6, t0 - 8), (x1 - 5, t0 - 3), (x0 - 1, t0 - 2)]
        for p in pts: star(*p)
    if kind == "sweat": drop(x1 + 2 + k, t0 + 4 + k)
    if kind == "steam":
        for s in (-1, 1):
            bx = x0 - 2 if s < 0 else x1 + 2
            puff(bx, t0 + 1, 2); puff(bx + s * 3, t0 - 3, 1)

# (balise, [(déformation, yeux, bouche, couleur, effet, durée)])
def F(sx=1, sy=1, **kw): return params(sx, sy, **kw)
ANIMS = [
  ("etourdi", [(F(1.04, .97, wob=2.2), "x", "wavy", BLEU, ("stars", 0), 140), (F(1.04, .97), "x", "wavy", BLEU, ("stars", 1), 140),
               (F(1.04, .97, wob=-2.2), "x", "wavy", BLEU, ("stars", 0), 140), (F(1.04, .97), "x", "wavy", BLEU, ("stars", 1), 140)]),
  ("rire", [(F(1.08, .93), "happy", "open", BLEU, None, 120), (F(.95, 1.06, dy=-2), "happy", "open", BLEU, None, 120)]),
  ("remis", [(F(1, 1, shear=3), "closed", "line", BLEU, None, 70), (F(1, 1, shear=-3), "closed", "line", BLEU, None, 70), (F(1, 1, shear=2), "line", "smile", BLEU, None, 70), (F(), "line", "smile", BLEU, None, 90)]),
  ("fache", [(F(1.08, 1.02, shear=1), "angry", "frown", BLEU, "steam", 100), (F(1.08, 1.02, shear=-1), "angry", "frown", BLEU, "steam", 100)]),
  ("intrigue", [(F(.95, 1.06), "big", "o", BLEU, None, 400)]),
  ("fier", [(F(.92, 1.12), "happy", "smile", BLEU, None, 1500)]),
]

out_frames, tags = [], []
def add(name, seq):
    start = len(out_frames); out_frames.extend(seq); tags.append((name, start, len(out_frames) - 1)); return start
# crawl.aseprite : images 1 à 12 = la reptation (humeur neutre) ; ensuite, les visages des humeurs dessinés sur l'image 12 (voir HUMEURS plus bas)
CRAWL = hand("crawl", "crawl", 0, 11)
add("crawl", CRAWL)
add("turn", TURN)
# le saut commence par le demi-tour (images 1 à 6 = turn[1] à turn[6]) et finit par le même à l'envers (images 33 à 28) ; entre les deux,
# la limace s'écrase (images 7 et 8, 26 et 27) : on recentre les deux premières sur l'axe comme le reste
SAUT = hand("jump", "saut")
for k in range(1, 7):
    SAUT[k] = (TURN[k][0], SAUT[k][1]); SAUT[34 - k] = (TURN[k][0], SAUT[34 - k][1])
for k, dx in ((7, -3), (8, -1)): SAUT[k] = (shift_xy(SAUT[k][0], dx, 0), SAUT[k][1])
S0 = add("saut", SAUT)
# sous-parties de son saut, dessinées à la main : vol (la boule en l'air), atterrissage (la flaque qui se reforme), saut depuis la face
tags += [("vol", S0 + 16, S0 + 18), ("chute-legere", S0 + 19, S0 + 20), ("atterrissage", S0 + 21, S0 + 26), ("saut-face", S0 + 6, S0 + 28)]
# autres animations dessinées par Thibault : elles remplacent celles générées plus bas
# baille : recalée sur la pose de repos par tools/rebase_animations.py (plus de jupe au bas du corps, queue à gauche) ; rien à décaler ici
# repos : de face, 8 images (il cligne deux fois) ; sa petite queue est à gauche, côté d'où il vient quand il marche vers la droite : l'app retourne tout autour de l'axe 31,5
# secoue et nausee : attrape-boule (secoue) et la reptation (nausee) passées au vert de la nausée (le bleu de base, son ombre et son reflet deviennent leurs verts)
TO_VERT = {BLEU[k]: VERT[k] for k in "ACD"}
def vert(seq): return [([[TO_VERT.get(p, p) for p in row] for row in f], d) for f, d in seq]
# nausee (au sol) : la reptation classique passée au vert, avec des spirales à la place des yeux ; elles tournent d'un quart de tour toutes les 3 images
SPIRAL = ["#####", "....#", "###.#", "#...#", "#####"]
def turn_spiral(g, k):
    for _ in range(k % 4): g = ["".join(g[len(g) - 1 - c][r] for c in range(len(g))) for r in range(len(g))]
    return g
def eyes_of(f):
    """les yeux d'une image de profil : des traits d'encre verticaux entièrement entourés de corps (la bouche, horizontale, est écartée)"""
    around = [(a, b) for a in (-1, 0, 1) for b in (-1, 0, 1)]
    todo = {(x, y) for y in range(64) for x in range(64) if f[y][x] == B and all(0 <= x + a < 64 and 0 <= y + b < 64 and f[y + b][x + a][3] for a, b in around)}
    comps = []
    while todo:
        c = {todo.pop()}; stack = list(c)
        while stack:
            x, y = stack.pop()
            for a, b in around:
                if (x + a, y + b) in todo: todo.remove((x + a, y + b)); c.add((x + a, y + b)); stack.append((x + a, y + b))
        comps.append(c)
    return sorted((c for c in comps if len({p[0] for p in c}) <= 2 and len({p[1] for p in c}) >= 3), key=lambda c: min(p[0] for p in c))
def white_eyes(f):
    """les grands yeux ouverts : les deux plus hautes taches blanches de 4 pixels ou plus, côte à côte, de gauche à droite"""
    todo = {(x, y) for y in range(1, 63) for x in range(1, 63) if f[y][x] == WHITE}; comps = []
    while todo:
        c = {todo.pop()}; st = list(c)
        while st:
            x, y = st.pop()
            for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + a, y + b) in todo: todo.remove((x + a, y + b)); c.add((x + a, y + b)); st.append((x + a, y + b))
        if len(c) >= 4: comps.append(c)
    comps.sort(key=lambda c: min(p[1] for p in c))                # les deux plus hautes, côte à côte (plus bas, ce sont les dents)
    if len(comps) >= 2 and abs(min(p[1] for p in comps[0]) - min(p[1] for p in comps[1])) <= 3: comps = comps[:2]
    else: return []
    return sorted(comps, key=lambda c: min(p[0] for p in c))
def dizzy(seq):
    """malade : chaque œil devient une spirale qui tourne (d'un quart de tour toutes les 3 images, dans le sens inverse des aiguilles d'une montre).
    Œil : un trait vertical (de profil, de face) ou, les yeux plissés (coule, choc), un trait horizontal ; sans deux yeux reconnus, l'image reste telle quelle"""
    out = []
    for n, (f, d) in enumerate(seq):
        g = [row[:] for row in f]; eyes = white_eyes(f)
        if len(eyes) == 2:                                      # les grands yeux ouverts : le blanc et la pupille passent au corps, le contour reste
            for e in eyes:
                xs, ys = [p[0] for p in e], [p[1] for p in e]
                for y in range(min(ys), max(ys) + 1):
                    for x in range(min(xs), max(xs) + 1):
                        if f[y][x] == B and any(f[y + b][x + a] == WHITE for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))): g[y][x] = VERT["A"]
        else: eyes = eyes_of(f)
        if len(eyes) != 2:
            fl = flat_eyes(f); eyes = [[(x, fl[0]) for x in r] for r in fl[1:]] if fl else []
        for e in eyes:
            for x, y in e: g[y][x] = VERT["A"]
        for i, e in enumerate(eyes):
            cx = round(sum(p[0] for p in e) / len(e)) + (-1 if i == 0 else 1); cy = round(sum(p[1] for p in e) / len(e))   # les deux spirales s'écartent d'un pixel
            for r, row in enumerate(turn_spiral(SPIRAL, -(n // 3))):
                for c, ch in enumerate(row):
                    x, y = cx - 2 + c, cy - 2 + r
                    if ch == "#" and 0 <= x < 64 and 0 <= y < 64 and f[y][x][3]: g[y][x] = B
        out.append((g, d))
    return out
# Humeurs : les animations sont dessinées une fois, avec le visage neutre ; le code remplace ce visage par celui de l'humeur, sur toutes les images où il
# reconnaît le visage neutre : de profil (yeux de 4 et 3 pixels de haut, écartés de 6, comme crawl) ou de face (deux yeux de 4 pixels, écartés de 7,
# comme repos). Les autres images (yeux fermés, expressions : rire, peur, sommeil…) gardent leur visage.
# Un visage = ce qu'une image de référence change sur l'image neutre où il est dessiné. Le haut (yeux, sourcils, cernes) est recalé sur l'œil de gauche ;
# de face, le bas (bouche) est recalé sur la bouche, qui ne suit pas les yeux quand il regarde en haut ou en bas. De profil, tout suit les yeux.
# Rien n'est posé hors du corps ni sur son contour ; l'encre de l'image n'est effacée que là où le visage neutre en avait (yeux, bouche).
def view_of(f):
    e = eyes_of(f)
    if len(e) != 2: return None, e
    hs, gap = tuple(len({p[1] for p in c}) for c in e), min(p[0] for p in e[1]) - min(p[0] for p in e[0])
    if gap == 6 and set(hs) <= {3, 4}: return "profil", e         # de profil, et de trois quarts au début du demi-tour
    if gap == 7 and set(hs) <= {3, 4}: return "face", e           # de face, et tassé (saut)
    return None, e
def mouth_of(f, eyes):
    """la bouche de face : la plus longue ligne d'encre horizontale sous les yeux, entourée de corps dessus et dessous"""
    y0 = max(p[1] for e in eyes for p in e) + 2; best = None
    for y in range(y0, min(63, y0 + 10)):
        run = []
        for x in range(64):
            if f[y][x] == B and f[y - 1][x][3] and f[y + 1][x][3] and f[y - 1][x] != B and f[y + 1][x] != B: run.append(x)
            elif run: break
        if run and (best is None or len(run) > best[2]): best = (run[0], y, len(run))
    return best and best[:2]
def face_of(ref, base):
    v, eyes = view_of(base); ax, ay = min(p[0] for p in eyes[0]), min(p[1] for p in eyes[0])
    m = mouth_of(base, eyes) if v == "face" else None; low = max(p[1] for e in eyes for p in e) + 2
    out = []; neutral = {p for e in eyes for p in e}                  # l'encre des yeux neutres, effacée par put_face : reprise si le visage la garde
    for y in range(64):
        for x in range(64):
            if ref[y][x] == base[y][x] and not ((x, y) in neutral and ref[y][x] == B): continue
            if m and y >= low: out.append(("bouche", x - m[0], y - m[1], ref[y][x], base[y][x] == B))
            else: out.append(("yeux", x - ax, y - ay, ref[y][x], base[y][x] == B))
    return v, out
def put_face(f, face):
    v, eyes = view_of(f)
    if v != face[0]: return f
    g = [row[:] for row in f]
    for e in eyes:
        for x, y in e: g[y][x] = A
    # de trois quarts (yeux de profil, mais pas de 4 et 3 pixels) : la bouche et les joues de profil tomberaient à côté, on ne pose que les yeux,
    # les sourcils et les cernes (au-dessus des yeux, ou à droite de l'œil de gauche jusqu'aux cernes)
    tq = v == "profil" and tuple(len({p[1] for p in c}) for c in eyes) != (4, 3)
    anchor = {"yeux": (min(p[0] for p in eyes[0]), min(p[1] for p in eyes[0])), "bouche": mouth_of(f, eyes) if v == "face" else None}
    edge = lambda x, y: any(not (0 <= x + a < 64 and 0 <= y + b < 64) or not f[y + b][x + a][3] for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    for part, dx, dy, c, was_ink in face[1]:
        if not anchor[part] or tq and not (dy < 0 or dx >= 0 and dy <= 6): continue
        x, y = anchor[part][0] + dx, anchor[part][1] + dy
        if not (0 <= x < 64 and 0 <= y < 64) or not f[y][x][3] or edge(x, y): continue
        if c != B and (f[y][x] == B) != was_ink: continue          # n'efface que l'encre du visage neutre, ne pose du corps que sur du corps
        g[y][x] = c
    return g
# humeur de l'app -> ses visages : (visage habituel, visage que l'app montre de temps en temps), de profil et de face ; « neutre » = les animations
# telles que dessinées. Joyeux : les yeux ouverts, il cligne ; fatigué : les yeux fermés, il les ouvre de temps en temps (durées : index.html, BLINK_TIME).
# crawl.aseprite : images 13, 14 et 16 = joyeux (guilleret), un visage animé (la langue qui remue), 15 = l'image 14 les yeux fermés, 17-18 = fatigué
# (vaseux), dessinées sur l'image 12 ; visages-face.aseprite : 1 = repos, 2-4 = joyeux (la langue, comme de profil), 5-7 = les mêmes yeux fermés,
# 8-9 = fatigué (yeux ouverts, fermés). Une liste de visages =
# un visage animé : l'image k de l'animation prend le visage k modulo sa longueur. Le joyeux qui cligne : chaque image de la langue, avec les yeux
# fermés de l'image 15 (seuls les yeux y changent).
_p, _f = [f for f, d in hand("crawl", "crawl")], [f for f, d in hand("visages-face", "visages-face")]
_ferme = lambda g: [[_p[14][y][x] if _p[14][y][x] != _p[13][y][x] else g[y][x] for x in range(64)] for y in range(64)]
_joie = [_p[k] for k in (12, 13, 15)]
HUMEURS = {"guilleret": ([[face_of(g, _p[11]) for g in _joie], [face_of(_f[k], _f[0]) for k in (1, 2, 3)]],
                         [[face_of(_ferme(g), _p[11]) for g in _joie], [face_of(_f[k], _f[0]) for k in (4, 5, 6)]]),
           "vaseux": ([face_of(_p[17], _p[11]), face_of(_f[8], _f[0])], [face_of(_p[16], _p[11]), face_of(_f[7], _f[0])])}
DOSSIER = {"guilleret": "joyeux", "vaseux": "fatigue"}            # animations/humeurs/<dossier>/ : les fichiers de chaque humeur, à retoucher à la main
# La langue du joyeux, là où le visage posé n'en a pas (de trois quarts, et coule, coule-fin, où il garde son visage d'effort) : celle de face
# (visages-face.aseprite, images 2 à 4, ce qui est sous la bouche), accrochée sous la bouche de l'image, qui remue au même rythme.
LANGUE = [[(x - 31, y - 51, _f[k][y][x]) for y in range(52, 64) for x in range(64) if _f[k][y][x] != _f[0][y][x]] for k in (1, 2, 3)]
LANGUE_PARTOUT = ("coule", "coule-fin", "saut")
ROSE = (215, 123, 186, 255)
def any_mouth(f):
    """la bouche d'une image quelconque : la plus basse des lignes d'encre horizontales (2 pixels ou plus) à l'intérieur du corps ; son milieu"""
    best = None
    for y in range(1, 63):
        run = []
        for x in range(1, 64):
            ok = x < 63 and f[y][x] == B and all(f[y + b][x][3] and f[y + b][x] != B for b in (-1, 1))
            if ok: run.append(x); continue
            if len(run) >= 2: best = ((run[0] + run[-1]) // 2, y)
            run = []
    return best
def put_tongue(f, t):
    m = any_mouth(f)
    if not m: return f
    g = [row[:] for row in f]
    for dx, dy, c in t:
        x, y = m[0] + dx, m[1] + dy
        if 0 < x < 63 and 0 < y < 63 and all(f[y + b][x + a][3] for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))): g[y][x] = c
    return g
# Les yeux du joyeux là où l'image les a fermés en deux traits horizontaux (coule, coule-fin) : ceux de face (visages-face.aseprite, image 2, et
# image 5 pour le clignement), sourcils compris, chaque œil recalé sur le milieu de son trait (le trait du dessous de l'œil joyeux prend sa place).
def _half(k, left): return [(x - (28 if left else 35), y - 47, _f[k][y][x]) for y in range(30, 49) for x in (range(20, 32) if left else range(32, 44)) if _f[k][y][x] != _f[0][y][x]]
YEUX = {"normal": (_half(1, True), _half(1, False)), "cligne": (_half(4, True), _half(4, False))}
def flat_eyes(f):
    """deux traits d'encre horizontaux de 2 à 4 pixels sur la même ligne, à l'intérieur du corps, écartés de 2 à 6 pixels : leurs pixels"""
    for y in range(1, 63):
        runs, run = [], []
        for x in range(1, 64):
            if x < 63 and f[y][x] == B and all(f[y + b][x][3] and f[y + b][x] != B for b in (-1, 1)): run.append(x); continue
            if run: runs.append(run)
            run = []
        for r1, r2 in zip(runs, runs[1:]):
            if 2 <= len(r1) <= 4 and 2 <= len(r2) <= 4 and 2 <= r2[0] - r1[-1] - 1 <= 6: return y, r1, r2
    return None
def put_flat_eyes(f, eyes):
    e = flat_eyes(f)
    if not e: return f
    y0, r1, r2 = e; g = [row[:] for row in f]
    for x in r1 + r2: g[y0][x] = A
    for run, half in zip((r1, r2), eyes):
        cx = (run[0] + run[-1]) // 2
        for dx, dy, c in half:
            x, y = cx + dx, y0 + dy
            if 0 < x < 63 and 0 < y < 63 and all(f[y + b][x + a][3] for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))): g[y][x] = c
    return g
# Le fatigué là où le visage de profil ou de face ne se pose pas tel quel (de trois quarts au demi-tour, et coule, saut écrasé) : chaque œil de l'image
# reçoit l'œil fatigué de face entier (paupière, cerne, sourcil ; visages-face.aseprite, image 9, et 8 pour le clignement), recalé sur lui, et la
# bouche la bouche qui tombe, recalée sur la bouche ; les traits restent entiers, rien n'est mélangé avec le visage de l'image. Œil de l'image : un
# trait vertical (recalé sur son haut, comme l'œil neutre de face, ligne 43) ou un trait horizontal, l'œil fermé (recalé sur la paupière, ligne 46).
def _parts(k):
    keep = lambda x, y: _f[k][y][x] != _f[0][y][x] or _f[k][y][x] == B and x in (28, 35) and 43 <= y <= 46     # l'encre posée sur l'œil neutre aussi
    eye = lambda left: [(x - (28 if left else 35), y - 43, _f[k][y][x]) for y in range(36, 49) for x in (range(20, 32) if left else range(32, 44)) if keep(x, y)]
    return eye(True), eye(False), [(x - 32, y - 51, _f[k][y][x]) for y in range(49, 54) for x in range(24, 40) if _f[k][y][x] != _f[0][y][x] or _f[k][y][x] == B]
FATIGUE = {"normal": _parts(8), "cligne": _parts(7)}
def put_parts(f, parts):
    ev = [e for e in eyes_of(f)]; g = [row[:] for row in f]
    if len(ev) == 2 and 3 <= min(p[0] for p in ev[1]) - max(p[0] for p in ev[0]) <= 10:
        anchors = [(round(sum(p[0] for p in e) / len(e)), min(p[1] for p in e)) for e in ev]; ink = [p for e in ev for p in e]
    elif flat_eyes(f):
        y0, r1, r2 = flat_eyes(f); anchors = [((r[0] + r[-1]) // 2, y0 - 3) for r in (r1, r2)]; ink = [(x, y0) for x in r1 + r2]
    else: return f
    for x, y in ink: g[y][x] = A
    m = any_mouth(g); put = []
    for (ax, ay), half in zip(anchors, parts[:2]): put += [(ax + dx, ay + dy, c) for dx, dy, c in half]
    if m and m[1] > max(a[1] for a in anchors) + 3:
        x = m[0]
        while g[m[1]][x - 1] == B: x -= 1
        while g[m[1]][x] == B: g[m[1]][x] = A; x += 1
        put += [(m[0] + dx, m[1] + dy, c) for dx, dy, c in parts[2]]
    for x, y, c in put:
        if 0 < x < 63 and 0 < y < 63 and all(f[y + b][x + a][3] for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))): g[y][x] = c
    return g
def with_mood(seq, faces, langue=None, partout=False, yeux=None, parts=None):
    """une image sans visage reconnu qui ne diffère d'une image reconnue de la même animation que par les yeux (le clignement de repos) prend celle-ci :
    dans une humeur, c'est l'app qui fait cligner. langue : les langues à poser où le visage n'en a pas mis (partout : même sans visage reconnu)"""
    known = [f for f, d in seq if view_of(f)[0]]; out = []
    for k, (f, d) in enumerate(seq):
        if not view_of(f)[0] and known:
            near = min(known, key=lambda k: sum(k[y][x] != f[y][x] for y in range(64) for x in range(64)))
            diff = [y for y in range(64) for x in range(64) if near[y][x] != f[y][x]]; ey = min(p[1] for p in eyes_of(near)[0])
            if len(diff) <= 24 and all(abs(y - ey) <= 6 for y in diff): f = near
        v, ev = view_of(f); seen = v
        if parts and (v == "profil" and tuple(len({p[1] for p in c}) for c in ev) != (4, 3) or not v and partout): f = put_parts(f, parts)
        else:
            for face in faces: f = put_face(f, face[k % len(face)] if isinstance(face, list) else face)
        if yeux and not seen: f = put_flat_eyes(f, yeux)
        if langue and (seen or partout) and not any(ROSE in row for row in f): f = put_tongue(f, langue[k % len(langue)])
        out.append((f, d))
    return out
# endort : la transition entre le bâillement (fini de face) et le sommeil (de profil) : de face, les paupières tombent (le clignement de repos),
# puis, les yeux fermés, le corps se couche jusqu'à la pose de dort (sans la bulle ni la bave, qui apparaissent avec dort)
from align_turn import morph as _morph
def _sans_bulle(f):
    keep = {(0, 0, 0, 255), (0xa4, 0xc6, 0xff, 255), (0x63, 0x9b, 0xff, 255), (0x45, 0x77, 0xe0, 255)}
    pts = {(x, y) for y in range(64) for x in range(64) if f[y][x] in keep}
    todo, best = set(pts), set()
    while todo:                                                   # le plus grand morceau : le corps (la bulle et son contour sont à part)
        c = {todo.pop()}; st = list(c)
        while st:
            x, y = st.pop()
            for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + a, y + b) in todo: todo.remove((x + a, y + b)); c.add((x + a, y + b)); st.append((x + a, y + b))
        if len(c) > len(best): best = c
    return [[f[y][x] if (x, y) in best else (0, 0, 0, 0) for x in range(64)] for y in range(64)]
def endort():
    rep = hand("repos", "repos"); half, closed = rep[1][0], rep[2][0]      # repos : ouverts, mi-clos, fermés, mi-clos…
    lie = _sans_bulle(hand("dort", "dort")[0][0])
    return [(half, 300), (closed, 300)] + [(_morph(closed, lie, t), 170) for t in (.25, .5, .75)]
HAND = [("endort", endort()), ("baille", hand("baille", "baille")), ("repos", hand("repos", "repos")), ("dort", hand("dort", "dort")), ("remue", hand("remue", "remue")), ("regard", hand("regard", "regard")), ("reforme", hand("reforme", "reforme")), ("attrape-boule", hand("attrape-boule", "attrape-boule")),
        # ce qu'attrape-boule ajoute à la goutte nue : le visage, les sourcils et la sueur (une image par image) ; les bras, eux, sont pris sur la première image
        # (bras levés) : le code les fait tourner autour de leur attache, avec des poses fantômes ; la boule et sa queue, il les dessine en direct
        ("attrape-boule-parts", [(parts_of(f), d) for f, d in hand("attrape-boule", "attrape-boule")]),
        ("attrape-boule-arms", [(arms_of(hand("attrape-boule", "attrape-boule")[0][0]), 100)]), ("secoue", dizzy(vert(hand("attrape-boule", "attrape-boule")))),
        # secoué puis lâché, il reste vert pendant toute la chute et l'atterrissage, jusqu'à ce qu'il se remette : les mêmes animations, passées au vert
        ("vol-vert", dizzy(vert(SAUT[16:19]))), ("chute-legere-vert", dizzy(vert(SAUT[19:21]))), ("atterrissage-vert", dizzy(vert(SAUT[21:27]))), ("chute-vert", dizzy(vert(hand("chute", "chute", 0, 11)))),
        ("nausee", dizzy(vert(CRAWL))), ("mange", hand("eat", "mange")), ("rot", hand("rot", "rot")), ("caresse", hand("caresse", "caresse", 0, 5)), ("caresse-fin", hand("caresse", "caresse", 6, 8)), ("rire", hand("rire", "rire")), ("remis", hand("remis", "remis")), ("choc-bord", hand("choc-bord", "choc-bord")), ("coule", hand("coule", "coule")), ("coule-fin", hand("coule-fin", "coule-fin")), ("choc-bord-vert", dizzy(vert(hand("choc-bord", "choc-bord")))), ("coule-vert", dizzy(vert(hand("coule", "coule")))), ("coule-fin-vert", dizzy(vert(hand("coule-fin", "coule-fin")))),
        # chute : 0-1 = début, 2-11 = boucle ; 12-13 (la goutte qui descend dans l'image) sont sautées, c'est la fenêtre qui descend
        ("chute", hand("chute", "chute", 0, 11)), ("ecrase", hand("chute", "chute", 14, 22))]
for name, seq in HAND:
    start = len(out_frames); out_frames += seq; tags.append((name, start, len(out_frames) - 1))
for name, seq in ANIMS:
    if name in dict(HAND): continue
    start = len(out_frames)
    for P, eyes, mouth, pal, effect, dur in seq:
        px, box = render(warp(P), pal)
        draw_face(px, P, eyes, mouth)
        if effect: fx(px, box, *(effect if isinstance(effect, tuple) else (effect, 0)))
        out_frames.append((px, dur))
    tags.append((name, start, len(out_frames) - 1))

# chaque animation dans chaque humeur (balise « nom@humeur »), et sa version alternée (« nom@humeur:cligne ») que l'app montre de temps en temps ;
# seulement les animations où le visage neutre apparaît ; ni les versions vertes de la nausée, ni les morceaux d'attrape-boule, ni le réveil (remue :
# l'œil qui s'entrouvre garde son air endormi), ni mange (le visage de l'humeur se poserait sur la bouche qui mâche).
# Chaque animation d'humeur a son fichier, animations/humeurs/<dossier>/<nom>.aseprite (balises « normal » et « cligne ») : s'il existe (exporté par
# mise run publier), c'est lui qui compte, retouches comprises ; sinon, le visage est posé par le code. gen.py --fichiers écrit les fichiers qui
# manquent (jamais par-dessus un fichier existant). Les morceaux du saut (vol, chute-legere, atterrissage, saut-face) sont pris dans saut@humeur.
SOUS = {n: (a - tags[2][1], b - tags[2][1]) for n, a, b in tags if n in ("vol", "chute-legere", "atterrissage", "saut-face")}
assert tags[2][0] == "saut"
def mood_file(h, name):
    d = f"humeurs/{DOSSIER[h]}"
    if not os.path.exists(f"{A0}/{d}/{name}_sheet.png"): return None
    fr = hand(d, name); tg = {t["name"]: (t["from"], t["to"]) for t in json.load(open(f"{A0}/{d}/{name}_sheet.json"))["meta"]["frameTags"]}
    return fr[tg["normal"][0]:tg["normal"][1] + 1], fr[tg["cligne"][0]:tg["cligne"][1] + 1] if "cligne" in tg else None   # sans « cligne » : pas de clignement
written = []
for h, (normal, alt) in HUMEURS.items():
    done = {}
    for name, a, b in list(tags):
        if "-vert" in name or name in ("nausee", "secoue", "remue", "mange") or name in SOUS or name.startswith("attrape-boule-") or "@" in name: continue
        seq = out_frames[a:b + 1]; got = mood_file(h, name)
        if got is None:
            lg = LANGUE if h == "guilleret" else None; pt = name in LANGUE_PARTOUT
            ye = h == "guilleret" and name in ("coule", "coule-fin"); fa = h == "vaseux"
            o = with_mood(seq, normal, lg, pt, ye and YEUX["normal"], fa and FATIGUE["normal"])
            if all(x[0] is y[0] for x, y in zip(o, seq)): continue
            got = (o, with_mood(seq, alt, lg, pt, ye and YEUX["cligne"], fa and FATIGUE["cligne"]))
            if "--fichiers" in sys.argv: written.append((f"{A0}/humeurs/{DOSSIER[h]}/{name}.aseprite", got))
        done[name] = got
        add(f"{name}@{h}", got[0])
        if got[1]: add(f"{name}@{h}:cligne", got[1])
    for n, (i, j) in SOUS.items():
        if "saut" in done:
            add(f"{n}@{h}", done["saut"][0][i:j + 1])
            if done["saut"][1]: add(f"{n}@{h}:cligne", done["saut"][1][i:j + 1])

# la feuille : une grille de 32 images de large (une seule ligne dépasserait la taille d'image que le navigateur accepte)
N = len(out_frames); COLS = 32; ROWS = (N + COLS - 1) // COLS
EMPTY = [(0, 0, 0, 0)] * 64
sheet = [[px for c in range(COLS) for px in (out_frames[r * COLS + c][0][y] if r * COLS + c < N else EMPTY)] for r in range(ROWS) for y in range(64)]
write(D0 + "/limace_sheet.png", sheet)
js = {"frames":{f"limace {k}.aseprite":{"frame":{"x":k % COLS * 64, "y":k // COLS * 64, "w":64, "h":64}, "duration":out_frames[k][1]} for k in range(N)},
      "meta":{"app":"bidule", "image":"limace_sheet.png", "format":"RGBA8888", "size":{"w":64 * COLS, "h":64 * ROWS}, "scale":"1",
              "frameTags":[{"name":n, "from":a, "to":b, "direction":"forward"} for n, a, b in tags]}}
json.dump(js, open(D0 + "/limace_sheet.json", "w"), indent=1)

# fichier Aseprite : un calque, une image par image, balises nommées
u8 = lambda v: bytes([v & 255]); u16 = lambda v: struct.pack("<H", v); i16 = lambda v: struct.pack("<h", v); u32 = lambda v: struct.pack("<I", v)
st = lambda t: u16(len(t.encode())) + t.encode()
chunk = lambda ty, d: u32(len(d) + 6) + u16(ty) + d
def write_ase(path, fl, tg):
    fr_bytes = []
    for k, (px, dur) in enumerate(fl):
        ch = []
        if k == 0:
            ch.append(chunk(0x2004, u16(3) + u16(0) + u16(0) + u16(0) + u16(0) + u16(0) + u8(255) + bytes(3) + st("Limace")))
            t = u16(len(tg)) + bytes(8)
            for n, a, b in tg: t += u16(a) + u16(b) + u8(0) + u16(0) + bytes(6) + bytes(3) + u8(0) + st(n)
            ch.append(chunk(0x2018, t))
        img = b"".join(bytes(px[y][x]) for y in range(64) for x in range(64))
        ch.append(chunk(0x2005, u16(0) + i16(0) + i16(0) + u8(255) + u16(2) + i16(0) + bytes(5) + u16(64) + u16(64) + zlib.compress(img)))
        body = b"".join(ch)
        fr_bytes.append(u32(16 + len(body)) + u16(0xF1FA) + u16(len(ch)) + u16(dur) + bytes(2) + u32(len(ch)) + body)
    allf = b"".join(fr_bytes)
    hdr = u32(128 + len(allf)) + u16(0xA5E0) + u16(len(fl)) + u16(64) + u16(64) + u16(32) + u32(1) + u16(100) + u32(0) + u32(0) + u8(0) + bytes(3) + u16(0) + u8(1) + u8(1) + i16(0) + i16(0) + u16(16) + u16(16) + bytes(84)
    open(path, "wb").write(hdr + allf)
write_ase(D0 + "/limace.aseprite", out_frames, tags)
for path, (o, c) in written:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    write_ase(path, o + c, [("normal", 0, len(o) - 1), ("cligne", len(o), len(o) + len(c) - 1)]); print("écrit :", os.path.relpath(path, A0))
print(N, "images,", len(tags), "animations :", ", ".join(n for n, a, b in tags))
