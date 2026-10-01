import math, json, os, struct, zlib, sys
sys.path.insert(0, os.path.dirname(__file__))
from png import frames, write
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
  ("repos", [(F(1.02, .98), "line", "line", BLEU, None, 520), (F(), "line", "line", BLEU, None, 520)]),
  ("attrape", [(F(.86, 1.34, neck=.45, wob=2.2, top=11), "dot", "open", BLEU, "sweat", 110), (F(.84, 1.4, neck=.5, wob=-2.2, top=11), "dot", "open", BLEU, None, 110),
               (F(.86, 1.34, neck=.45, wob=1.5, top=11), "dot", "wavy", BLEU, "sweat", 110), (F(.83, 1.44, neck=.52, wob=-1.5, top=11), "dot", "open", BLEU, None, 110)]),
  ("choc-bord", [(F(.72, 1.22), "closed", "small", BLEU, None, 140)]),
  ("etourdi", [(F(1.04, .97, wob=2.2), "x", "wavy", BLEU, ("stars", 0), 140), (F(1.04, .97), "x", "wavy", BLEU, ("stars", 1), 140),
               (F(1.04, .97, wob=-2.2), "x", "wavy", BLEU, ("stars", 0), 140), (F(1.04, .97), "x", "wavy", BLEU, ("stars", 1), 140)]),
  ("remis", [(F(1, 1, shear=3), "closed", "line", BLEU, None, 70), (F(1, 1, shear=-3), "closed", "line", BLEU, None, 70), (F(1, 1, shear=2), "line", "smile", BLEU, None, 70), (F(), "line", "smile", BLEU, None, 90)]),
  ("caresse", [(F(1.1, .92), "happy", "smile", BLEU, None, 300), (F(1.04, .97), "happy", "smile", BLEU, None, 300)]),
  ("rire", [(F(1.08, .93), "happy", "open", BLEU, None, 120), (F(.95, 1.06, dy=-2), "happy", "open", BLEU, None, 120)]),
  ("fache", [(F(1.08, 1.02, shear=1), "angry", "frown", BLEU, "steam", 100), (F(1.08, 1.02, shear=-1), "angry", "frown", BLEU, "steam", 100)]),
  ("intrigue", [(F(.95, 1.06), "big", "o", BLEU, None, 400)]),
  ("mange", [(F(1.1, .9), "happy", "open", BLEU, None, 170), (F(.96, 1.05), "happy", "line", BLEU, None, 170)]),
  ("rot", [(F(.9, 1.16), "closed", "open", BLEU, None, 400)]),
  ("baille", [(F(.95, 1.08), "closed", "small", BLEU, None, 220), (F(.88, 1.2), "closed", "yawn", BLEU, None, 450), (F(1.05, .95), "closed", "small", BLEU, None, 220)]),
  ("dort", [(F(1.12, .88), "closed", "small", BLEU, None, 1300), (F(1.16, .85), "closed", "small", BLEU, None, 1300)]),
  ("remue", [(F(1.12, .88), ("line", "closed"), "small", BLEU, None, 600)]),
  ("reveil", [(F(.9, 1.18), "closed", "o", BLEU, None, 160), (F(.92, 1.14), "line", "small", BLEU, None, 160), (F(1.04, .97), "line", "line", BLEU, None, 160)]),
  ("fier", [(F(.92, 1.12), "happy", "smile", BLEU, None, 1500)]),
]

out_frames, tags = [], []
def add(name, seq):
    start = len(out_frames); out_frames.extend(seq); tags.append((name, start, len(out_frames) - 1)); return start
add("crawl", hand("crawl", "crawl"))
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
# secoue et nausee : l'animation attrape passée au vert de la nausée (le bleu de base, son ombre et son reflet deviennent leurs verts)
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
def dizzy(seq):
    out = []
    for n, (f, d) in enumerate(seq):
        g = [row[:] for row in f]; eyes = eyes_of(f)
        for e in eyes:
            for x, y in e: g[y][x] = VERT["A"]
        for i, e in enumerate(eyes):
            cx = round(sum(p[0] for p in e) / len(e)) + (-1 if i == 0 else 1); cy = round(sum(p[1] for p in e) / len(e))   # les deux spirales s'écartent d'un pixel
            for r, row in enumerate(turn_spiral(SPIRAL, n // 3)):
                for c, ch in enumerate(row):
                    if ch == "#": g[cy - 2 + r][cx - 2 + c] = B
        out.append((g, d))
    return out
HAND = [("baille", hand("baille", "baille")), ("repos", hand("repos", "repos")), ("dort", hand("dort", "dort")), ("remue", hand("remue", "remue")), ("regard", hand("regard", "regard")), ("reforme", hand("reforme", "reforme")), ("attrape", hand("attrape", "attrape")), ("secoue", vert(hand("attrape", "attrape"))), ("nausee", dizzy(vert(hand("crawl", "crawl")))), ("mange", hand("eat", "mange")), ("rot", hand("rot", "rot")),
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

N = len(out_frames)
sheet = [[out_frames[k][0][y][x] for k in range(N) for x in range(64)] for y in range(64)]
write(D0 + "/limace_sheet.png", sheet)
js = {"frames":{f"limace {k}.aseprite":{"frame":{"x":k * 64, "y":0, "w":64, "h":64}, "duration":out_frames[k][1]} for k in range(N)},
      "meta":{"app":"bidule", "image":"limace_sheet.png", "format":"RGBA8888", "size":{"w":64 * N, "h":64}, "scale":"1",
              "frameTags":[{"name":n, "from":a, "to":b, "direction":"forward"} for n, a, b in tags]}}
json.dump(js, open(D0 + "/limace_sheet.json", "w"), indent=1)

# fichier Aseprite : un calque, une image par animation, balises nommées
u8 = lambda v: bytes([v & 255]); u16 = lambda v: struct.pack("<H", v); i16 = lambda v: struct.pack("<h", v); u32 = lambda v: struct.pack("<I", v)
st = lambda t: u16(len(t.encode())) + t.encode()
chunk = lambda ty, d: u32(len(d) + 6) + u16(ty) + d
fr_bytes = []
for k, (px, dur) in enumerate(out_frames):
    ch = []
    if k == 0:
        ch.append(chunk(0x2004, u16(3) + u16(0) + u16(0) + u16(0) + u16(0) + u16(0) + u8(255) + bytes(3) + st("Limace")))
        tg = u16(len(tags)) + bytes(8)
        for n, a, b in tags: tg += u16(a) + u16(b) + u8(0) + u16(0) + bytes(6) + bytes(3) + u8(0) + st(n)
        ch.append(chunk(0x2018, tg))
    img = b"".join(bytes(px[y][x]) for y in range(64) for x in range(64))
    ch.append(chunk(0x2005, u16(0) + i16(0) + i16(0) + u8(255) + u16(2) + i16(0) + bytes(5) + u16(64) + u16(64) + zlib.compress(img)))
    body = b"".join(ch)
    fr_bytes.append(u32(16 + len(body)) + u16(0xF1FA) + u16(len(ch)) + u16(dur) + bytes(2) + u32(len(ch)) + body)
allf = b"".join(fr_bytes)
hdr = u32(128 + len(allf)) + u16(0xA5E0) + u16(N) + u16(64) + u16(64) + u16(32) + u32(1) + u16(100) + u32(0) + u32(0) + u8(0) + bytes(3) + u16(0) + u8(1) + u8(1) + i16(0) + i16(0) + u16(16) + u16(16) + bytes(84)
open(D0 + "/limace.aseprite", "wb").write(hdr + allf)
print(N, "images,", len(tags), "animations :", ", ".join(n for n, a, b in tags))
