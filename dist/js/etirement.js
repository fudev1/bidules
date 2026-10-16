// L'étirement collant : on tire le Bidule du sol ou d'un bord, il s'étire puis se décolle.
// --- Étirement collant : la base reste collée au sol, le haut suit la souris ; on la décolle en tirant fort ---
const BIG_W = 352, BIG_H = 420, CW2 = 176, CH2 = 210, ORX = 56, ORY = 146, HANG_G = [88, 40];
const pull = {on:false, phase:null, src:null, g:[0, 0], d:[0, 0], vd:[0, 0], b:[0, 0], vb:[0, 0], pw:[0, 0], pv:[0, 0], aw:[0, 0], skip:0};
const pullCanvas = document.getElementById("el"), pullCtx = pullCanvas.getContext("2d");
function captureFrame(src) {          // src : l'image déjà remise dans le repère du sol (décollé d'un bord, edgeCapture)
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 64; const g = cv.getContext("2d");
  if (src) g.drawImage(src, 0, 0);
  else { if (img.style.scale === "-1 1") { g.translate(2 * (SHEET_DATA[style].axis + .5), 0); g.scale(-1, 1); } g.drawImage(img, 0, 0, 64, 64); }
  const px = g.getImageData(0, 0, 64, 64).data, mask = new Uint8Array(4096);
  let top = 64, bot = 0, x0 = 64, x1 = 0;
  for (let i = 0; i < 4096; i++) if (px[i * 4 + 3]) { mask[i] = 1; const X = i % 64, Y = (i - X) / 64; top = Math.min(top, Y); bot = Math.max(bot, Y); x0 = Math.min(x0, X); x1 = Math.max(x1, X); }
  // le contour d'origine est redessiné autour de la forme étirée ; à sa place, on met la couleur voisine de l'intérieur
  const col = new Uint8ClampedArray(px), edge = i => mask[i] && [1, -1, 64, -64].some(o => !mask[i + o]);
  for (let i = 0; i < 4096; i++) if (edge(i)) {
    const n = [1, -1, 64, -64, 65, 63, -63, -65].map(o => i + o).find(j => j >= 0 && j < 4096 && mask[j] && !edge(j));
    if (n !== undefined) for (let k = 0; k < 4; k++) col[i * 4 + k] = px[n * 4 + k];
  }
  // palette du perso (encre, couleur de base, ombre, reflet) et visage découpé en tampons de pixels
  const count = new Map();
  for (let i = 0; i < 4096; i++) if (mask[i]) { const k = px[i * 4] + "," + px[i * 4 + 1] + "," + px[i * 4 + 2]; count.set(k, (count.get(k) || 0) + 1); }
  const cols = [...count.keys()].map(k => k.split(",").map(Number)), lum = c => c[0] * .3 + c[1] * .59 + c[2] * .11;
  // le reflet : la couleur la plus claire, sans le blanc (blanc de l'œil fatigué, dents) qui la remplacerait sinon
  const tons = cols.filter(c => lum(c) < 250), ink = cols.reduce((a, b) => lum(b) < lum(a) ? b : a), light = (tons.length ? tons : cols).reduce((a, b) => lum(b) > lum(a) ? b : a);
  const byFreq = [...count.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0].split(",").map(Number));
  const base = byFreq.find(c => c.join() !== ink.join()) || ink;
  const shade = byFreq.find(c => ![ink, light, base].some(k => k.join() === c.join())) || base;
  const isInk = i => mask[i] && px[i * 4] === ink[0] && px[i * 4 + 1] === ink[1] && px[i * 4 + 2] === ink[2];
  const face = [];
  // le visage : l'encre à l'intérieur, sans les marches du contour (encre collée à un pixel de bord)
  const nearEdge = i => [1, -1, 64, -64, 65, 63, -63, -65].some(o => i + o >= 0 && i + o < 4096 && (!mask[i + o] || edge(i + o) && isInk(i + o)));
  for (let i = 0; i < 4096; i++) if (isInk(i) && !edge(i) && !nearEdge(i)) face.push([i % 64, Math.floor(i / 64)]);
  const stamps = [];
  for (const p2 of face) {
    const hits = stamps.filter(st => st.some(q => Math.abs(q[0] - p2[0]) <= 1 && Math.abs(q[1] - p2[1]) <= 1));
    if (!hits.length) { stamps.push([p2]); continue; }
    hits[0].push(p2);
    for (const hh of hits.slice(1)) { hits[0].push(...hh); stamps.splice(stamps.indexOf(hh), 1); }
  }
  const faceStamps = stamps.map(st => { const cx2 = st.reduce((a, p2) => a + p2[0], 0) / st.length, cy2 = st.reduce((a, p2) => a + p2[1], 0) / st.length;
    return {u:cx2 + .5, v:cy2 + .5, px:st.map(([a, b]) => [a - Math.round(cx2), b - Math.round(cy2)])}; });
  const fcx = faceStamps.length ? faceStamps.reduce((a, st) => a + st.u, 0) / faceStamps.length : (x0 + x1) / 2 + .5;
  const fcy = faceStamps.length ? faceStamps.reduce((a, st) => a + st.v, 0) / faceStamps.length : (top + bot) / 2;
  const rowL = new Float32Array(64).fill(NaN), rowR = new Float32Array(64).fill(NaN);
  for (let Y = 0; Y < 64; Y++) for (let X = 0; X < 64; X++) if (mask[Y * 64 + X]) { if (isNaN(rowL[Y])) rowL[Y] = X; rowR[Y] = X + 1; }
  const faceBot = face.length ? Math.max(...face.map(p2 => p2[1])) + 1 : (top + bot) / 2;
  return {col, mask, top, bot, cx:(x0 + x1) / 2, w:x1 - x0 + 1, ink, base, shade, light, faceStamps, fcx, fcy, rowL, rowR, faceBot};
}
// La taille et la position de la fenêtre changent en deux temps : on vide d'abord l'affichage,
// pour que l'image ne se montre jamais au mauvais endroit entre les deux (au pire un blanc très court).
let winChain = Promise.resolve();
const nextPaint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
function setBigWindow(on) { return winChain = winChain.then(() => pull.side && pull.side !== "floor" ? edgeResize(on) : resizeWin(on)).catch(e => say("fenetre: " + e)); }
// Décollé du plafond ou d'un mur : le même calcul qu'au sol, dans un repère où le bord est le sol. EDGE_ROT : du repère à l'écran,
// [a, b, c, d] pour X = a u + b v, Y = c u + d v (le retour : u = a X + c Y, v = b X + d Y) ; EDGE_CSS : la même chose pour le grand canevas.
const EDGE_ROT = {floor:[1, 0, 0, 1], ceiling:[1, 0, 0, -1], right:[0, 1, -1, 0], left:[0, -1, 1, 0]};
const EDGE_CSS = {floor:"", ceiling:"scale(1, -1)", right:"rotate(-90deg)", left:"rotate(90deg)"};
const edgeTo = (R, u, v) => [R[0] * u + R[1] * v, R[2] * u + R[3] * v], edgeFrom = (R, X, Y) => [R[0] * X + R[2] * Y, R[1] * X + R[3] * Y];
// l'image affichée (retournée, tournée), relue pixel par pixel dans le repère du sol : chaque pixel du repère va chercher celui de l'écran qui lui correspond
function edgeCapture(R, r, O) {
  const D = SHEET_DATA[style], f = (D.bySrc || (D.bySrc = new Map(D.frames.map(f => [f.src, f])))).get(img.src); if (!f) return null;
  const sp = f.cv.getContext("2d").getImageData(0, 0, 64, 64).data, cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d"), out = g.createImageData(64, 64);
  const sc = (img.style.scale || "1").trim().split(/\s+/).map(Number), sx = sc[0] < 0, sy = (sc.length > 1 ? sc[1] : sc[0]) < 0;
  for (let v = 0; v < 64; v++) for (let u = 0; u < 64; u++) {
    const [X, Y] = edgeTo(R, (u + .5 - 32) * 2, (v + .5 - 32) * 2), bx = Math.floor((O[0] + X - r.left) / 2), by = Math.floor((O[1] + Y - r.top) / 2);
    if (bx < 0 || by < 0 || bx > 63 || by > 63) continue;
    const i = ((sy ? 63 - by : by) * 64 + (sx ? 63 - bx : bx)) * 4, o = (v * 64 + u) * 4;
    for (let k = 0; k < 4; k++) out.data[o + k] = sp[i + k];
  }
  g.putImageData(out, 0, 0); return cv;
}
// La grande fenêtre d'un bord : couchée pour un mur ; le canevas tourne autour du centre de la fenêtre. pull.win : sa position, calculée par pullStart.
async function edgeResize(on) {
  const wall = pull.side === "left" || pull.side === "right", W = wall ? BIG_H : BIG_W, H = wall ? BIG_W : BIG_H;
  const size = n => { for (const el of [document.documentElement, document.body]) { el.style.width = n ? W + "px" : ""; el.style.height = n ? H + "px" : ""; } };
  Fenetre.oublier();
  if (on) {
    img.style.opacity = "0"; size(true);
    Object.assign(pullCanvas.style, {left:(W - BIG_W) / 2 + "px", top:(H - BIG_H) / 2 + "px", transform:EDGE_CSS[pull.side]}); pullCanvas.hidden = false;
    await nextPaint();
    // macOS garde la fenêtre sous la barre de menus : au-delà, c'est le dessin qui monte dans la fenêtre (comme flush)
    const [nx, ny] = pull.win, up = Math.max(0, Math.round(minY - ny));
    document.body.style.translate = up ? `0 ${-up}px` : "";
    await Fenetre.cadre(nx, ny + up, W, H);
  } else {
    await Fenetre.taille(WW, WH);
    pullCanvas.hidden = true; Object.assign(pullCanvas.style, {left:"", top:"", transform:""});
    size(false); await push();
  }
}
async function resizeWin(on) {
  const size = n => { for (const el of [document.documentElement, document.body]) { el.style.width = n ? BIG_W + "px" : ""; el.style.height = n ? BIG_H + "px" : ""; } };
  Fenetre.oublier();
  if (on) {
    img.style.opacity = "0"; pullCanvas.hidden = false; size(true);
    await nextPaint();
    x -= (BIG_W - WW) / 2; y -= BIG_H - WH;
    await Fenetre.cadre(x, y, BIG_W, BIG_H);
  } else {
    // d'abord réduire sur place : l'image reste au bon endroit, juste recadrée ; puis déplacer et remettre l'image normale
    const hung = pull.wasHang;
    if (hung) { await Fenetre.taille(WW, WH); pullCanvas.hidden = true; await nextPaint(); await Fenetre.position(x, y); }
    else { await Fenetre.cadre(x, y, WW, WH); pullCanvas.hidden = true; }
    size(false);
  }
}
// Retour haptique du trackpad Force Touch du Mac (main.rs : haptique) : "clic", "cran" ou "palier". Coupé dans le panneau (onglet Piste).
// Au plus un de chaque sorte toutes les 60 ms : le trackpad ne bourdonne pas quand les occasions s'enchaînent.
let hapticOn = true;
const hapticAt = {};
try { hapticOn = localStorage.getItem("bidule.haptique") !== "non"; } catch (e) {}
function haptic(motif) {
  const now = performance.now(); if (!hapticOn || now - (hapticAt[motif] || 0) < 60) return;
  hapticAt[motif] = now; T.core.invoke("haptique", {motif}).catch(() => {});
}
function pullStart(side = "floor") {
  let S0, G;
  if (side === "floor") { S0 = captureFrame(); G = [(drag.gx - 24) / 2, (drag.gy - 48) / 2]; }
  else {
    // l'image affichée et le point saisi, ramenés dans le repère où le bord est le sol ; la grande fenêtre est placée pour que rien ne saute
    if (mode === "wall") wallShape(false);
    const R = EDGE_ROT[side], r = img.getBoundingClientRect(), O = [(r.left + r.right) / 2, (r.top + r.bottom) / 2], src = edgeCapture(R, r, O);
    if (!src) return false;
    S0 = captureFrame(src); const [gu0, gv0] = edgeFrom(R, (drag.gx - O[0]) / 2, (drag.gy - O[1]) / 2); G = [32 + gu0, 32 + gv0];
    const wall = side === "left" || side === "right", Wc = wall ? [BIG_H / 2, BIG_W / 2] : [BIG_W / 2, BIG_H / 2], [mx, my] = edgeTo(R, 0, 2 * (ORY - 73));
    const up = Math.max(0, Math.round(minY - y));
    pull.win = [x + O[0] - Wc[0] - mx, y + up + O[1] - Wc[1] - my];
    pull.prev = {x, y, mode};
  }
  const gu = Math.max(S0.cx - 12, Math.min(S0.cx + 12, G[0])), gv = Math.max(S0.top, Math.min(S0.bot - 3, G[1]));
  Object.assign(pull, {on:true, ready:false, phase:"ground", side, src:S0, srcImg:img.src, g:[gu, gv], d:[0, 0], dm:null, vd:[0, 0], cran:0});
  // la bulle de pensée disparaît tout de suite, sans fondu : la fenêtre va s'agrandir vers le haut et la gauche, elle se retrouverait dans le coin
  pense.style.transition = "none"; pense.classList.add("off"); pense.offsetWidth; pense.style.transition = "";
  pullDraw(); setBigWindow(true).then(() => { pull.ready = true; pull.readyAt = performance.now(); });
  return true;
}
// Position de la base (B) et du point tenu (G) dans le grand canevas, selon la phase.
function pullGeom() {
  const S0 = pull.src, B0 = [ORX + S0.cx + .5, ORY + S0.bot + 1], G0 = [ORX + pull.g[0], ORY + pull.g[1]];
  if (pull.phase === "hang") return {B:[HANG_G[0] + pull.b[0], HANG_G[1] + pull.b[1]], G:[...HANG_G], G0, B0};
  return {B:B0, G:[G0[0] + pull.d[0], G0[1] + pull.d[1]], G0, B0};
}
// Trois formes, sur le modèle du saut dessiné par le collègue :
// un peu tirée, elle s'étire ; plus tirée, une boule monte avec la souris, reliée par un fil qui s'amincit à une flaque collée au sol ;
// décollée, elle pend en goutte sous la souris.
function pullDraw() {
  const S0 = pull.src, geo = pullGeom(), H = S0.bot + 1 - S0.top, out = new Uint8Array(CW2 * CH2);
  if (pull.phase === "hang") return styleRender(out, maskDrop(out, geo, H));
  // ce qui compte, c'est de combien elle est allongée : écrasée vers le bas, elle ne forme jamais de boule
  const dist = Math.max(0, Math.hypot(geo.G[0] - geo.B[0], geo.G[1] - geo.B[1]) - Math.hypot(geo.G0[0] - geo.B[0], geo.G0[1] - geo.B[1]));
  // on fond progressivement l'étirement dans la forme boule + fil + flaque, ligne par ligne
  const a0 = H * .15, a1 = H * .9, dD = H * 2.4;
  const m0 = Math.max(0, Math.min(1, (dist - a0) / (a1 - a0))), m = m0 * m0 * (3 - 2 * m0);
  const k = Math.max(0, Math.min(1, (dist - a1) / (dD - a1)));
  const W = rowsWarp(geo), S = rowsStrand(geo, H, k);
  // chaque forme est lue à la même hauteur relative (0 = sol, 1 = sommet), puis les deux sont mélangées
  const topOf = R => { for (let Y = 0; Y < CH2; Y++) if (R.hw[Y] > .2) return Y; return CH2 - 1; };
  const botOf = R => { for (let Y = CH2 - 1; Y >= 0; Y--) if (R.hw[Y] > .2) return Y + 1; return 0; };
  const tW = topOf(W), bW = botOf(W), tS = topOf(S), bS = botOf(S), top = tW + (tS - tW) * m, bot = bW + (bS - bW) * m;
  const at = (R, t0, b0, f) => { const yf = b0 - f * (b0 - t0) - .5, i = Math.max(t0, Math.min(b0 - 1, Math.floor(yf))), j = Math.min(b0 - 1, i + 1), a = Math.max(0, Math.min(1, yf - i));
    const hw = R.hw[i] + (R.hw[j] - R.hw[i]) * a, c = isNaN(R.c[j]) ? R.c[i] : R.c[i] + (R.c[j] - R.c[i]) * a; return [c, hw]; };
  for (let Y = Math.floor(top); Y < Math.ceil(bot); Y++) {
    const f = (bot - (Y + .5)) / Math.max(1, bot - top); if (f < 0 || f > 1) continue;
    const [c1, hw1] = at(W, tW, bW, f), [c2, hw2] = at(S, tS, bS, f), hw = hw1 + (hw2 - hw1) * m, c = c1 + (c2 - c1) * m;
    if (hw <= .2) continue;
    for (let X = Math.max(0, Math.floor(c - hw)); X <= Math.min(CW2 - 1, Math.ceil(c + hw)); X++) if (Math.abs(X + .5 - c) <= hw) out[Y * CW2 + X] = 1;
  }
  styleRender(out, (u, v) => { const [x1, y1] = W.face(u, v), [x2, y2] = S.face(u, v); return [x1 + (x2 - x1) * m, y1 + (y2 - y1) * m]; });
}
// Forme étirée, comme dans le saut du collègue : la tête (avec le visage) garde sa forme ronde,
// seul le bas du corps s'allonge et s'amincit en cou.
function rowsWarp({B, G}) {
  const S0 = pull.src, H = S0.bot + 1 - S0.top, hs = Math.max(2, S0.bot + 1 - pull.g[1]), c = new Float32Array(CH2).fill(NaN), hw = new Float32Array(CH2);
  const hA = Math.max(2, B[1] - G[1]), s = hA / hs, restOff = pull.g[0] - S0.cx - .5, lean = (G[0] - B[0]) - restOff;
  const wt = (1 / Math.sqrt(Math.max(s, .3))) * (1 - .3 * Math.min(1, Math.max(0, s - 1))), wb = s >= 1 ? 1 + .35 * (s - 1) : wt;
  const hb = Math.max(2, Math.min(H * .55, S0.bot - S0.faceBot)), Ht = Math.max(H * .4, hA + (H - hs));
  const capF = s >= 1 ? Math.max(.72, Math.min(1, wt)) : 1, capW = s >= 1 ? capF : wt;
  let bodyOut = Ht - (H - hb) * capF, capH = capF;
  if (bodyOut < hb * .5) { bodyOut = Math.min(hb * .5, Ht * .3); capH = (Ht - bodyOut) / (H - hb); }
  // le pied (les dernières lignes) reste à plat au sol, comme une flaque
  const foot = Math.min(3, hb * .4); bodyOut = Math.max(foot + 1, bodyOut);
  const at = h => { if (h <= foot) return [h, 0, wb];
    if (h <= bodyOut) { const t = (h - foot) / (bodyOut - foot); return [foot + t * (hb - foot), lean * Math.pow(t, 1.6), wb + (wt - wb) * Math.pow(t, .8)]; }
    return [hb + (h - bodyOut) / capH, lean, capW]; };
  for (let Y = 0; Y < CH2; Y++) {
    const h = B[1] - (Y + .5); if (h < -.5) continue;
    // ligne source lue entre deux lignes voisines, pour que le contour reste lisse quand on la resserre
    const [hs0, ln, w] = at(h), vf = S0.bot + .5 - hs0, i = Math.floor(vf), a = vf - i;
    const ok = j => j >= 0 && j < 64 && !isNaN(S0.rowL[j]);
    if (!ok(i) && !ok(i + 1)) continue;
    if (!ok(i) && a < .5 || !ok(i + 1) && a >= .5) continue;
    const i0 = ok(i) ? i : i + 1, i1 = ok(i + 1) ? i + 1 : i;
    const rl = S0.rowL[i0] + (S0.rowL[i1] - S0.rowL[i0]) * a, rr = S0.rowR[i0] + (S0.rowR[i1] - S0.rowR[i0]) * a;
    const xl = B[0] + ln + (rl - (S0.cx + .5)) * w, xr = B[0] + ln + (rr - (S0.cx + .5)) * w;
    c[Y] = (xl + xr) / 2; hw[Y] = (xr - xl) / 2;
  }
  const face = (u, v) => {
    const hsrc = S0.bot + 1 - v, h2 = hsrc <= foot ? hsrc : hsrc <= hb ? foot + (hsrc - foot) / (hb - foot) * (bodyOut - foot) : bodyOut + (hsrc - hb) * capH, [, ln, w] = at(h2);
    return [B[0] + ln + (u - (S0.cx + .5)) * w, B[1] - h2];
  };
  return {c, hw, face};
}
// Forme boule + fil + flaque : pour chaque ligne, l'union des trois morceaux.
function rowsStrand({B, G}, H, k) {
  const S0 = pull.src, r = H * (.46 - .06 * k), C = [G[0], G[1] + r * .35], c = new Float32Array(CH2).fill(NaN), hw = new Float32Array(CH2);
  const pry = 2.5 + 3.5 * (1 - k), prx = S0.w * .5 * (1 + .35 * k), P = [B[0], B[1] - 1 - pry * .6], Pn = P[1] - pry * .3;
  const wa = r * (1.5 - 1.25 * k) + 1, wbn = S0.w * .3 * (1 - k) + 1.6, fl = S0.w * .35;
  for (let Y = 0; Y < CH2; Y++) {
    const y = Y + .5; let l = Infinity, rr = -Infinity;
    const add = (cx2, h2) => { if (h2 > 0) { l = Math.min(l, cx2 - h2); rr = Math.max(rr, cx2 + h2); } };
    if (Math.abs(y - C[1]) <= r) add(C[0], Math.sqrt(r * r - (y - C[1]) ** 2));
    if (y >= C[1] && y <= Pn) { const t = (y - C[1]) / Math.max(1, Pn - C[1]); add(C[0] + (P[0] - C[0]) * t, (wa + (wbn - wa) * t + fl * Math.pow(t, 6)) / 2); }
    if (Math.abs(y - P[1]) <= pry) add(P[0], prx * Math.sqrt(1 - ((y - P[1]) / pry) ** 2));
    if (l < rr) { c[Y] = (l + rr) / 2; hw[Y] = (rr - l) / 2; }
  }
  return {c, hw, face:(u, v) => [C[0] + (u - S0.fcx), C[1] + (v - S0.fcy)]};
}
function fillShape(out, test, y0, y1) {
  for (let Y = Math.max(0, Math.floor(y0)); Y <= Math.min(CH2 - 1, Math.ceil(y1)); Y++) for (let X = 0; X < CW2; X++) if (test(X + .5, Y + .5)) out[Y * CW2 + X] = 1;
}
function taper(ax, ay, bx, by, wa, wb2, flare = 0) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  return (X, Y) => { const t = Math.max(0, Math.min(1, ((X - ax) * dx + (Y - ay) * dy) / L2)); const hw = (wa + (wb2 - wa) * t + flare * Math.pow(t, 6)) / 2;
    return Math.hypot(X - ax - t * dx, Y - ay - t * dy) <= hw; };
}
function maskDrop(out, {B, G}, H) {
  const S0 = pull.src, r = H * .44;
  fillShape(out, (X, Y) => Math.hypot(X - B[0], Y - B[1]) <= r, B[1] - r - 1, B[1] + r + 1);
  fillShape(out, taper(G[0], G[1], B[0], B[1], 1.4, r * 1.9), Math.min(G[1], B[1]) - 2, Math.max(G[1], B[1]) + 2);
  return (u, v) => [B[0] + (u - S0.fcx), B[1] + (v - S0.fcy) + 1];
}
function styleRender(out, faceAt) {
  const S0 = pull.src, imd = pullCtx.createImageData(CW2, CH2), d = imd.data;
  const inn = (X, Y) => X >= 0 && Y >= 0 && X < CW2 && Y < CH2 && out[Y * CW2 + X];
  const inner = (X, Y) => inn(X, Y) && inn(X + 1, Y) && inn(X - 1, Y) && inn(X, Y + 1) && inn(X, Y - 1);
  let t0 = CH2, b0 = 0, xa = CW2, xb = 0;
  for (let i = 0; i < CW2 * CH2; i++) if (out[i]) { const X = i % CW2, Y = (i - X) / CW2; t0 = Math.min(t0, Y); b0 = Math.max(b0, Y); xa = Math.min(xa, X); xb = Math.max(xb, X); }
  const c0 = (xa + xb) / 2, put = (X, Y, c) => { if (X < 0 || Y < 0 || X >= CW2 || Y >= CH2) return; const i = (Y * CW2 + X) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
  for (let Y = t0; Y <= b0; Y++) for (let X = xa; X <= xb; X++) {
    if (!out[Y * CW2 + X]) continue;
    let c = S0.base;
    if (!inner(X, Y)) c = S0.ink;
    else if (!inner(X, Y + 3) || !inner(X + 2, Y)) c = S0.shade;
    else if ((!inner(X - 3, Y - 1) && X < c0 && Y < b0 - 7) || (!inner(X - 1, Y - 3) && X < c0 + 3 && Y < t0 + 6)) c = S0.light;
    put(X, Y, c);
  }
  for (const st of S0.faceStamps) { const [fx2, fy2] = faceAt(st.u, st.v); for (const [a2, b2] of st.px) put(Math.floor(fx2) + a2, Math.floor(fy2) + b2, S0.ink); }
  // les cheveux, au sommet de la goutte étirée (le milieu de sa ligne du haut), dans la pose du ressort ; jamais sur le corps
  if (cheveux && hair.px && style === "limace") {
    let l = CW2, r = -1; for (let X = 0; X < CW2; X++) if (out[t0 * CW2 + X]) { l = Math.min(l, X); r = X; }
    const ox = Math.floor((l + r + 1) / 2) - HAIR_RX, oy = t0 - HAIR_H;
    for (let v = 0; v < HAIR_H; v++) for (let u = 0; u < HAIR_W; u++) {
      const i = (v * hair.pw + hair.pose * HAIR_W + u) * 4, X = ox + u, Y = oy + v;
      if (hair.px[i + 3] && X >= 0 && Y >= 0 && X < CW2 && Y < CH2 && !out[Y * CW2 + X]) put(X, Y, [hair.px[i], hair.px[i + 1], hair.px[i + 2]]);
    }
  }
  pullCtx.putImageData(imd, 0, 0);
}
const PULL_CRANS = [.3, .5, .65, .77, .86, .93];
function pullStep(dt) {
  dt = Math.min(.05, Math.max(.008, dt));
  const S0 = pull.src, hs = Math.max(2, S0.bot + 1 - pull.g[1]);
  if (pull.phase === "ground") {
    // il décolle quand on a tiré assez loin ; en chemin, des crans de plus en plus serrés à mesure que le fil s'étire
    if (pull.dm) pull.d = [...pull.dm];
    const f = Math.hypot(pull.d[0], pull.d[1]) / ((S0.bot + 1 - S0.top) * 2.4), cran = PULL_CRANS.filter(c => f >= c).length;
    if (cran > pull.cran) haptic("cran");
    pull.cran = cran;
    // tiré vite pendant que la fenêtre s'agrandissait : on montre d'abord l'étirement un moment, au lieu de décoller dès la première image
    if (f > 1 && performance.now() - pull.readyAt < 150) { pull.d = pull.d.map(v => v / f * .99); pull.cran = PULL_CRANS.length; }
    else if (f > 1) {
      // décollé : la fenêtre reprend sa taille et il est tenu comme dans tous les autres cas (la goutte qui se balance)
      say("il se decolle du sol"); bubble("Plop !", 900); haptic("palier");
      const edge = pull.side !== "floor";
      if (edge) { ({x, y} = pull.prev); face(); faceSeq = null; ceilSw = null; corner = null; }          // d'un bord : il se remet à l'endroit, la souris le reprend par la tête
      else { x += (BIG_W - WW) / 2; y += BIG_H - WH; }
      pull.phase = "closing"; pull.ready = false; pull.wasHang = false;
      setBigWindow(false).then(() => {
        pull.on = false; pull.phase = null; pull.side = null; img.style.opacity = "";
        if (drag) { setMode("held"); struggle(true); holdByHead(drag.lastX, drag.lastY); }
        else { vx = vy = 0; setMode("fly"); bounces = 0; angle = 0; spin = 0; if (isSheet()) sheetAnim(Date.now()); }
      });
      return;
    }
  } else if (pull.phase === "hang") {
    if (pull.skip) { pull.skip--; pull.pw = [x, y]; pull.pv = [0, 0]; }
    else {
      const vw = [(x - pull.pw[0]) / dt / 2, (y - pull.pw[1]) / dt / 2];
      pull.aw = pull.aw.map((a, k) => a * .5 + (vw[k] - pull.pv[k]) / dt * .5); pull.pw = [x, y]; pull.pv = vw;
    }
    const L = (S0.bot + 1 - S0.top) * .44 + 3, len = Math.hypot(pull.b[0], pull.b[1]) || 1, f = 110 * (L - len) / len;
    const ax = f * pull.b[0] - 6 * pull.vb[0] - Math.max(-4000, Math.min(4000, pull.aw[0]));
    const ay = 900 + f * pull.b[1] - 6 * pull.vb[1] - Math.max(-4000, Math.min(4000, pull.aw[1]));
    pull.vb[0] += ax * dt; pull.vb[1] += ay * dt; pull.b[0] += pull.vb[0] * dt; pull.b[1] += pull.vb[1] * dt;
    const l2 = Math.hypot(pull.b[0], pull.b[1]), lmax = Math.min(CH2 - HANG_G[1] - 20, L * 3.2);
    if (pull.b[1] < 3) { pull.b[1] = 3; pull.vb[1] = Math.max(0, pull.vb[1]); }
    if (l2 > lmax) { pull.b = pull.b.map(v => v * lmax / l2); pull.vb = pull.vb.map(v => v * .5); }
  } else if (pull.phase === "back") {
    // relâché sans être décollé : le haut revient en place en oscillant
    const a = pull.d.map((v, k) => -320 * v - 10 * pull.vd[k]);
    pull.vd = pull.vd.map((v, k) => v + a[k] * dt); pull.d = pull.d.map((v, k) => v + pull.vd[k] * dt);
    if (Math.hypot(...pull.d) < .3 && Math.hypot(...pull.vd) < 3) { pullFinish(); return; }
  }
  pullDraw();
}
function pullFinish() {
  if (pull.phase === "hang") {
    const {B} = pullGeom(), S0 = pull.src;
    const nx = x + B[0] * 2 - (24 + (S0.cx + .5) * 2) - 0, ny = y + B[1] * 2 - (48 + (S0.bot + 1) * 2);
    x = nx + (BIG_W - WW) / 2 - (BIG_W - WW) / 2; y = ny;
  } else if (pull.side !== "floor") ({x, y} = pull.prev);          // d'un bord : il retrouve sa place
  else { x += (BIG_W - WW) / 2; y += BIG_H - WH; }
  // pull.on reste vrai tant que la fenêtre n'est pas revenue à sa taille : rien d'autre ne la déplace entre-temps
  const hung = pull.wasHang = pull.phase === "hang"; pull.phase = "closing"; pull.ready = false;
  // relâché sur place : on réaffiche l'image qu'il avait quand on l'a pris (pas celle de la prise en main)
  const prev = pull.side !== "floor" && pull.prev;
  return setBigWindow(false).then(() => { pull.on = false; pull.phase = null; pull.side = null; if (prev) { img.src = pull.srcImg; setMode(prev.mode); pose(""); img.style.opacity = ""; return; }
  if (!hung) {
    img.src = pull.srcImg; setMode("walk"); pose("walk"); img.style.opacity = "";
    // la souris est encore sur lui : il continue de la regarder au lieu de reprendre sa marche une image avant
    watching = true; idleUntil = Date.now() + 700; lookKey = "";
  } });
}
