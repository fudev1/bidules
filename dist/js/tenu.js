// Tenu à la souris : le ballottement, la goutte qui se balance, les bras qui se débattent.
// Réveillé pendant qu'on le porte : la souris le tient par le haut de la tête, pour qu'on comprenne pourquoi sa tête s'allonge.
// La fenêtre est recalée pour que le curseur tombe sur le sommet de la tête de l'image "attrape", et il se balance autour de ce point.
let heldByHead = null;
// Ballottement : tenu par la tête, le corps se laisse entraîner quand la souris va de gauche à droite (pendule amorti autour du point tenu).
// Un angle qui suit la vitesse horizontale de la souris, avec un peu d'élan : léger (SWAY_MAX degrés au plus).
const SWAY_MAX = 20, SWAY_GAIN = .013;
let sway = {a:0, w:0};
function swayStep(dt) {
  dt = Math.min(.05, Math.max(.004, dt));
  let target = 0;
  if (drag && heldByHead !== null && !swing.on && (mode === "held" || mode === "carried")) {
    const now = performance.now(), last = samples[samples.length - 1], old = samples.find(s => now - s.t < 120);
    if (last && old && last !== old && now - last.t < 120) target = Math.max(-SWAY_MAX, Math.min(SWAY_MAX, (last.x - old.x) / Math.max(16, last.t - old.t) * 1000 * SWAY_GAIN));
  }
  if (target === 0 && Math.abs(sway.a) < .05 && Math.abs(sway.w) < .05) { sway.a = sway.w = 0; if (img.style.transform) img.style.transform = ""; return; }
  sway.w += (90 * (target - sway.a) - 6 * sway.w) * dt; sway.a += sway.w * dt;
  img.style.transform = "rotate(" + (sway.a * (dir < 0 ? -1 : 1)).toFixed(2) + "deg)";          // le retournement (scale -1) inverse le sens : on le compense
}
// Tenu par la tête, la goutte se balance au bout d'un ressort.
// Comme celle que pullDraw dessine quand on décolle un Bidule éveillé : une boule et un cône qui s'amincit jusqu'au point tenu, calculés en direct.
// La boule rebondit au bout du ressort (effet yoyo, le même ressort que pullStep) : la queue s'allonge, se raccourcit et penche avec elle.
// Le visage, les sourcils, les bras et la sueur viennent d'attrape (tag attrape-boule-parts, voir tools/boule.py) et suivent la boule.
const SW_R = 29 * .44, SW_L = SW_R + 3, SW_G = [31.5, 11], SW_B0 = [31.5, 11 + SW_L + 900 / 110];      // les mêmes valeurs que tools/boule.py (l'image des parties)
// La goutte tenue est dessinée dans une image plus grande (SW_N px, la main au milieu) et la fenêtre grandit pendant qu'on la tient (SW_WIN px) :
// la boule peut tourner tout autour de la souris et s'étirer loin, comme un élastique qu'on fait ballotter.
const SW_N = 128, SW_WIN = SW_N * 2, SW_H = [SW_N / 2, SW_N / 2];
const swing = {on:false, b:[0, 0], vb:[0, 0], pw:[0, 0], pv:[0, 0], aw:[0, 0], skip:0, cv:null, parts:null, durs:[], armPx:null};
const SW_COL = {ink:[0, 0, 0], base:[99, 155, 255], shade:[69, 119, 224], light:[164, 198, 255]};
const SW_GREEN = {"99,155,255":[127, 212, 106], "69,119,224":[79, 174, 69], "164,198,255":[198, 240, 176]};     // les verts de la nausée (gen.py : TO_VERT)
// Le visage, les bras et la sueur qui suivent la boule (tag attrape-boule-parts) : aux couleurs de l'apparence (swing.parts), et d'origine
// (swing.partsVert) pour la goutte secouée, qui verdit en entier comme la nausée de la feuille (SW_GREEN ne connaît que les bleus d'origine).
function swingParties(P) {
  const images = src => P ? P.map(f => Object.assign(new Image(), {src:src(f)})) : null;
  swing.parts = images(f => Apparence.affichee(f.src)); swing.partsVert = images(f => f.src); swing.durs = P ? P.map(f => f.dur) : [];
}
Apparence.quandElleChange(() => { if (Apparence.aUneApparence(style) && SHEET_DATA[style]) swingParties(SHEET_DATA[style].tags["attrape-boule-parts"]); });
// Les bras se débattent si vite qu'on les voit flous, comme un bras d'anime qui s'agite : à chaque image, tout l'éventail du balayage est dessiné en
// poses fantômes (bleu pâle, tramées), avec des arcs de vitesse au bout des mains, et le bras de l'instant en plein par-dessus. L'éventail ne dépend
// pas de la cadence d'affichage : même si la fenêtre est rafraîchie lentement, le flou se voit. Ce sont les bras dessinés dans attrape-boule
// (tag attrape-boule-arms), qu'on fait tourner autour de leur attache.
const SW_ROOT_Y = Math.round(SW_B0[1] - 3.5);                                     // ligne d'attache des bras (tools/boule.py : ROOT_Y)
const SW_PIV = (() => { const xs = []; for (let X = 0; X < 64; X++) if (Math.hypot(X + .5 - SW_B0[0], SW_ROOT_Y + .5 - SW_B0[1]) <= SW_R) xs.push(X);
  return [[Math.min(...xs) + .5, SW_ROOT_Y + .5], [Math.max(...xs) + .5, SW_ROOT_Y + .5]]; })();        // les deux attaches : les bords gauche et droit de la boule
// période (ms), demi-balayage et centre du balayage (degrés), élévation de la pose dessinée, nombre de poses de l'éventail
const SW_FLAIL = {T:220, ampl:50, mid:3, e0:30, fan:6};
// la main : le point du bras droit le plus loin de son attache (son rayon et son angle), pour les arcs de vitesse
function swingHand(A) {
  const P0 = SW_PIV[1]; let best = null;
  for (let V = 0; V < 64; V++) for (let U = 32; U < 64; U++) if (A[(V * 64 + U) * 4 + 3]) {
    const r = Math.hypot(U + .5 - P0[0], V + .5 - P0[1]); if (!best || r > best.r) best = {r, a:Math.atan2(-(V + .5 - P0[1]), U + .5 - P0[0])};
  }
  return best;
}
// un bras tourné de `delta` (radians) : plein, ou fantôme (une seule couleur, tramé selon la parité `dither` ; -1 = pas de trame) ;
// plein, ses bleus d'origine (SW_COL) prennent les tons du corps : ton(k, X, Y), comme la boule
const SW_TON = {[SW_COL.light]:0, [SW_COL.base]:1, [SW_COL.shade]:2};
function swingArm(d, A, side, sx, sy, delta, ghost, dither, ton) {
  const sg = side ? 1 : -1, P0 = SW_PIV[side], P1 = [P0[0] + sx, P0[1] + sy];
  for (let Y = Math.floor(P1[1] - 18); Y <= Math.ceil(P1[1] + 18); Y++) for (let X = Math.floor(P1[0] - 18); X <= Math.ceil(P1[0] + 18); X++) {
    if (X < 0 || Y < 0 || X >= SW_N || Y >= SW_N || (dither >= 0 && (X + Y) % 2 !== dither)) continue;
    const ox = X + .5 - P1[0], oy = Y + .5 - P1[1], r = Math.hypot(ox, oy);
    const a = Math.atan2(-oy, ox) - sg * delta;                                           // on lit l'image du bras à l'angle d'origine (le bras gauche est le miroir du droit)
    const U = Math.floor(P0[0] + r * Math.cos(a)), V = Math.floor(P0[1] - r * Math.sin(a));
    if (U < 0 || V < 0 || U > 63 || V > 63) continue;
    const i = (V * 64 + U) * 4; if (!A[i + 3]) continue;
    const o = (Y * SW_N + X) * 4;
    if (ghost && d[o + 3]) continue;                                                      // un fantôme ne recouvre pas ce qui est déjà dessiné
    const k = SW_TON[[A[i], A[i + 1], A[i + 2]]], c = ghost || (k !== undefined ? ton(k, X, Y) : [A[i], A[i + 1], A[i + 2]]);
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
}
function swingArms(d, B, ms, ton) {          // ton(k, X, Y) : la couleur du corps (k : 0 lumière, 1 base, 2 ombre) au pixel X, Y
  const A = swing.armPx; if (!A) return;
  const sx = Math.round(B[0] - SW_B0[0]), sy = Math.round(B[1] - SW_B0[1]);      // les bras suivent la boule
  const F = SW_FLAIL, lo = F.mid - F.ampl, hi = F.mid + F.ampl, rad = e => (e - F.e0) * Math.PI / 180;
  const now = F.mid + F.ampl * Math.sin(2 * Math.PI * ms / F.T);                  // élévation du bras à cet instant, en degrés (positif = vers le haut)
  for (let side = 0; side < 2; side++) {
    // l'éventail : les poses du balayage entier, en bleu pâle, tramées une sur deux en alternance (le flou)
    for (let k = 0; k < F.fan; k++) swingArm(d, A, side, sx, sy, rad(lo + (hi - lo) * k / (F.fan - 1)), ton(0), (k + Math.floor(ms / 60)) % 2);
    // les arcs de vitesse, juste au-delà des mains, sur tout le balayage
    const h = swing.hand || (swing.hand = swingHand(A));
    if (h) {
      const P1 = [SW_PIV[side][0] + sx, SW_PIV[side][1] + sy];
      for (const dr of [2.5, 4.5]) for (let e = lo + 6; e <= hi - 6; e += 2) {
        const th = side ? h.a + rad(e) : Math.PI - h.a - rad(e);                       // l'angle de la main tournée de e (le bras gauche est le miroir du droit)
        const X = Math.floor(P1[0] + (h.r + dr) * Math.cos(th)), Y = Math.floor(P1[1] - (h.r + dr) * Math.sin(th));
        if (X < 0 || Y < 0 || X >= SW_N || Y >= SW_N || (X + Y + (dr > 3 ? 1 : 0)) % 2) continue;
        const o = (Y * SW_N + X) * 4; if (d[o + 3]) continue;
        const c = ton(2); d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
  }
  // le bras de l'instant, en plein, par-dessus l'éventail
  for (let side = 0; side < 2; side++) swingArm(d, A, side, sx, sy, rad(now), null, -1, ton);
}
function swingStart() { Object.assign(swing, {on:true, b:[0, SW_L], vb:[0, 160], pw:[x, y], pv:[0, 0], aw:[0, 0], skip:2, t:0}); }
function swingStep(dt) {
  dt = Math.min(.05, Math.max(.008, dt));
  if (swing.skip) { swing.skip--; swing.pw = [x, y]; swing.pv = [0, 0]; }
  else {      // l'accélération de la fenêtre (donc de la souris) secoue la boule
    const vw = [(x - swing.pw[0]) / dt / 2, (y - swing.pw[1]) / dt / 2];
    swing.aw = swing.aw.map((a, k) => a * .5 + (vw[k] - swing.pv[k]) / dt * .5); swing.pw = [x, y]; swing.pv = vw;
  }
  // la peau est élastique et résiste de plus en plus : au-delà de l'étirement de repos (le poids), le ressort se durcit vite ; secouée fort,
  // la boule tire sur la peau, qui la renvoie d'un coup sec au lieu de cogner une butée
  const b = swing.b, vb = swing.vb, len = Math.hypot(b[0], b[1]) || 1, ext = len - SW_L, dur = 1 + (Math.max(0, ext - SW_SAG) / SW_DUR) ** 2 + (Math.max(0, -ext) / 4) ** 2;          // et quand elle remonte jusqu'à la main
  const f = -SW_K * ext * dur / len;
  const ax = f * b[0] - SW_AMORTI * vb[0] - Math.max(-SW_AMAX, Math.min(SW_AMAX, swing.aw[0]));
  const ay = SW_GRAV + f * b[1] - SW_AMORTI * vb[1] - Math.max(-SW_AMAX, Math.min(SW_AMAX, swing.aw[1]));
  vb[0] += ax * dt; vb[1] += ay * dt; b[0] += vb[0] * dt; b[1] += vb[1] * dt;
  const l1 = Math.hypot(b[0], b[1]); if (l1 < 4) { b[0] *= 4 / (l1 || 1); b[1] = l1 ? b[1] * 4 / l1 : 4; }          // jamais sur la main
  // pas de butée : la boule va aussi loin que la peau le permet, et le dessin ramène cet étirement dans l'image (swingVis) ; une limite large, par sécurité
  const l2 = Math.hypot(b[0], b[1]), lmax = SW_LMAX * 4;
  if (l2 > lmax) { swing.b = b.map(v => v * lmax / l2); swing.vb = vb.map(v => v * .5); }
  const t = swingTension(); if (t > .7 && swing.t <= .7) haptic("cran"); swing.t = t;          // peau bien tendue : un cran sous le doigt
}
// tension de la peau : 0 au repos (la boule pend de son poids), 1 tout au bout, négative quand la boule remonte vers la main
// SW_K : raideur de la peau (plus petite, elle s'étire plus) ; SW_GRAV : le poids de la boule
const SW_K = 70, SW_GRAV = 900, SW_AMORTI = 7, SW_AMAX = 12000, SW_DUR = 14, SW_SAG = SW_GRAV / SW_K, SW_LMAX = SW_N / 2 - SW_R - 1;
function swingTension() { const l = Math.hypot(swing.b[0], swing.b[1]), rest = SW_L + SW_SAG; return Math.tanh((l - rest) / (l > rest ? SW_LMAX - rest : rest - 4)); }
// où la boule est dessinée : l'étirement est ramené dans l'image en douceur ; plus on secoue fort, plus la peau se tend, sans jamais cogner le bord
function swingVis() {
  const b = swing.b, l = Math.hypot(b[0], b[1]) || 1, rest = SW_L + SW_SAG, t = swingTension(), v = rest + t * (t > 0 ? SW_LMAX - rest : rest - 4);
  return [b[0] * v / l, b[1] * v / l];
}
function swingDraw() {
  const N = SW_N, H = SW_H, bv = swingVis(), B = [H[0] + bv[0], H[1] + bv[1]], mask = new Uint8Array(N * N), dx = B[0] - H[0], dy = B[1] - H[1], L2 = dx * dx + dy * dy || 1;
  // peau tendue : la boule s'allonge dans l'axe du cou et le cou s'amincit ; quand elle remonte, elle s'écrase un peu (plus large, plus courte)
  const ten = swingTension(), el = 1 + .12 * ten, neck = 1 - .45 * Math.max(0, ten), L = Math.sqrt(L2), ux = dx / L, uy = dy / L;
  for (let Y = 0; Y < N; Y++) for (let X = 0; X < N; X++) {      // la boule, et le cône de la pointe à son centre (maskDrop)
    const px = X + .5, py = Y + .5, pu = (px - B[0]) * ux + (py - B[1]) * uy, pv = (px - B[0]) * uy - (py - B[1]) * ux;
    let inside = (pu / (SW_R * el)) ** 2 + (pv * el / SW_R) ** 2 <= 1;
    if (!inside) { const t = Math.max(0, Math.min(1, ((px - H[0]) * dx + (py - H[1]) * dy) / L2));
      inside = Math.hypot(px - H[0] - t * dx, py - H[1] - t * dy) <= (1.4 + (SW_R * 1.9 - 1.4) * t) / 2 * (neck + (1 - neck) * t * t); }          // le cou s'amincit sur sa longueur, pas contre la boule
    if (inside) mask[Y * N + X] = 1;
  }
  const at = (X, Y) => X >= 0 && Y >= 0 && X < N && Y < N && mask[Y * N + X] === 1;
  const spurs = []; for (let Y = 0; Y < N; Y++) for (let X = 0; X < N; X++) if (at(X, Y) && at(X, Y - 1) + at(X - 1, Y) + at(X + 1, Y) + at(X, Y + 1) < 2) spurs.push(Y * N + X);
  spurs.forEach(i => { mask[i] = 0; });                           // un pixel isolé au bord de la boule
  const inner = (X, Y) => at(X, Y) && at(X + 1, Y) && at(X - 1, Y) && at(X, Y + 1) && at(X, Y - 1);
  let t0 = N, b0 = 0, xa = N, xb = 0;
  for (let i = 0; i < N * N; i++) if (mask[i]) { const X = i % N, Y = (i - X) / N; t0 = Math.min(t0, Y); b0 = Math.max(b0, Y); xa = Math.min(xa, X); xb = Math.max(xb, X); }
  const c0 = (xa + xb) / 2, green = !!(drag && drag.shaken);
  // les tons du corps : ceux de l'apparence et son motif (fixe dans l'image 64 x 64 de la goutte, qui suit la boule), ou les bleus d'origine si elle va verdir
  const ox = Math.round(B[0] - SW_B0[0]), oy = Math.round(B[1] - SW_B0[1]);
  const ton = (k, X, Y) => green ? [SW_COL.light, SW_COL.base, SW_COL.shade][k] : Apparence.tonDuCorps(k, X === undefined ? X : X - ox, Y === undefined ? Y : Y - oy);
  const cv = swing.cv || (swing.cv = document.createElement("canvas")); cv.width = cv.height = N;
  const g = cv.getContext("2d", {willReadFrequently:true}), imd = g.createImageData(N, N), d = imd.data;
  swingArms(d, B, Date.now(), ton);                                    // les bras d'abord : ils passent derrière la boule
  for (let Y = t0; Y <= b0; Y++) for (let X = xa; X <= xb; X++) {      // les couleurs de styleRender : contour, ombre, reflet
    if (!mask[Y * N + X]) continue;
    let c = 1;
    if (!inner(X, Y)) c = -1;
    else if (!inner(X, Y + 3) || !inner(X + 2, Y)) c = 2;
    else if ((!inner(X - 3, Y - 1) && X < c0 && Y < b0 - 7) || (!inner(X - 1, Y - 3) && X < c0 + 3 && Y < t0 + 6)) c = 0;
    c = c < 0 ? SW_COL.ink : ton(c, X, Y);
    const i = (Y * N + X) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  g.putImageData(imd, 0, 0);
  if (swing.parts && swing.parts.length) {      // le visage, les bras et la sueur d'attrape, qui suivent la boule
    const tot = swing.durs.reduce((a, v) => a + v, 0); let ms = Date.now() % tot, k = 0; while (k < swing.durs.length - 1 && ms >= swing.durs[k]) { ms -= swing.durs[k]; k++; }
    g.imageSmoothingEnabled = false; g.drawImage((green ? swing.partsVert : swing.parts)[k], Math.round(B[0] - SW_B0[0]), Math.round(B[1] - SW_B0[1]));
  }
  if (green) {      // secoué : il verdit
    const o = g.getImageData(0, 0, N, N), od = o.data;
    for (let i = 0; i < od.length; i += 4) { const v = SW_GREEN[od[i] + "," + od[i + 1] + "," + od[i + 2]]; if (v) { od[i] = v[0]; od[i + 1] = v[1]; od[i + 2] = v[2]; } }
    g.putImageData(o, 0, 0);
  }
  img.src = cv.toDataURL();
}
// La fenêtre grandit (SW_WIN px) pendant qu'on tient la goutte, et reprend sa taille au lâcher ; la main reste au même endroit de l'écran.
// SWING_OFF : de combien la grande fenêtre est décalée par rapport à la petite, pour une même main.
let swingBig = false;
const SWING_OFF = [SW_WIN / 2 - (24 + SW_G[0] * 2), SW_WIN / 2 - (48 + (SW_G[1] + .5) * 2)];
function swingWindow(on) {
  if (on === swingBig) return; swingBig = on;
  for (const el of [document.documentElement, document.body]) { el.style.width = on ? SW_WIN + "px" : ""; el.style.height = on ? SW_WIN + "px" : ""; }
  Object.assign(img.style, on ? {left:"0px", width:SW_WIN + "px", height:SW_WIN + "px"} : {left:"", width:"", height:""});
  if (!on) { x += SWING_OFF[0]; y += SWING_OFF[1]; push(); face(); }          // lâché : il reprend son orientation
  const n = on ? SW_WIN : WW;
  winChain = winChain.then(() => Fenetre.taille(n, on ? SW_WIN : WH)).catch(e => say("fenetre: " + e));
}
function holdByHead(cx = drag && drag.lastX, cy = drag && drag.lastY) {
  const tg = isSheet() && SHEET_DATA[style].tags, f = tg && tg[heldTag(tg)] && tg[heldTag(tg)][0];
  if (!f || !drag) return;
  const dyn = !!(tg["attrape-boule-parts"] && swing.parts);       // la goutte dessinée en direct : on la tient par sa pointe
  const hx = dyn ? SW_G[0] : f.tipx + .5, hy = dyn ? SW_G[1] + .5 : f.top + 1.5;      // le point tenu, en pixels de l'image (un peu sous la pointe)
  // la goutte : la main au milieu de la grande fenêtre ; dessinée en direct, elle n'est jamais retournée (sinon, s'il regardait à gauche, elle tournerait à l'envers)
  if (dyn) { swingWindow(true); x = cx - SW_WIN / 2; y = cy - SW_WIN / 2; img.style.scale = "1 1"; }
  else { x = cx - (24 + hx * 2); y = cy - (48 + hy * 2); }       // l'image fait 128 px dans la fenêtre : à 24 px du bord gauche, collée en bas (176 - 128 = 48)
  push();
  drag.x0 = x - (cx - drag.sx); drag.y0 = y - (cy - drag.sy);
  if (heldByHead === null) heldByHead = img.style.transformOrigin;
  // la fenêtre vient de grandir : l'image d'avant (64 px) y serait affichée en grand le temps que la première goutte soit prête
  if (dyn && !swing.on) { swingStart(); img.style.visibility = "hidden"; img.addEventListener("load", () => { img.style.visibility = ""; }, {once:true}); swingDraw(); }
  img.style.animation = "none";                                   // plus de balancement automatique : il ne bouge que selon la souris (ballottement)
  img.style.transformOrigin = dyn ? "50% 50%" : hx / 64 * 100 + "% " + hy / 64 * 100 + "%";        // pivot : le point tenu (le retournement se fait aussi autour de lui)
}
function struggle(on) {
  clearInterval(flap); flap = null;
  if (!on) { sway.a = sway.w = 0; swing.on = false; img.style.transform = ""; img.style.animation = ""; img.style.visibility = ""; }
  if (!on && heldByHead !== null) { img.style.transformOrigin = heldByHead; heldByHead = null; }
  if (!on && swingBig) swingWindow(false);
  if (on) { pose(isSheet() ? "" : "struggle"); img.style.rotate = "0deg"; let f = 0; img.src = FR.p1; if (!isSheet()) flap = setInterval(() => { f = 1 - f; img.src = f ? FR.p2 : FR.p1; }, 160); }
}
