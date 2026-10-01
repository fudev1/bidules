// Monstres en pixel art 64 x 64, style du moodboard, finition "sprite de jeu" :
// contour d'un pixel (bleu nuit dans l'ombre, teinte foncée côté lumière), volume en 4 teintes + reflet,
// vue de trois quarts, détails posés par formes.
const MINK = "#1e1b3a";
const mhx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const mRamp = (...c) => ({ol:mhx(c[0]), s2:mhx(c[1]), s1:mhx(c[2]), base:mhx(c[3]), light:mhx(c[4]), hi:mhx(c[5])});
const MR = {
  jaune:mRamp("#9a5a14", "#d8892a", "#eba93a", "#f6c94a", "#fde07a", "#fff6c8"),
  miel:mRamp("#8a4a10", "#b8661a", "#cf8226", "#e39f36", "#f0bd52", "#f9d98a"),
  bleu:mRamp("#23407e", "#2f5aa8", "#3f73c8", "#4d8fe0", "#7cb0f0", "#cfe4ff"),
  rose:mRamp("#9c4a6a", "#c9789a", "#dc92b0", "#f4b8cc", "#fbd3e0", "#fff0f5"),
  orange:mRamp("#8a3f08", "#c9650f", "#e27f1c", "#f79a2c", "#ffbd5c", "#ffe6b8"),
  violet:mRamp("#3f2378", "#5d38a0", "#7a4cbc", "#9a66d8", "#bb90ec", "#e8d8ff"),
  ciel:mRamp("#2c4c9a", "#4a68c0", "#5c7fcf", "#7a9ee8", "#a4c0f6", "#e2ecff"),
  ivoire:mRamp("#6e5a36", "#b8a178", "#d2bf98", "#e8dcc0", "#f6efdc", "#ffffff"),
  blanc:mRamp("#5a5470", "#b9b0cc", "#d6cfe4", "#f4f1fa", "#ffffff", "#ffffff"),
  gorge:mRamp("#3a0a18", "#5e1228", "#7a1832", "#94203c", "#b0304e", "#d05068"),
  langue:mRamp("#8a1f3a", "#c23a5a", "#e0506e", "#f06a84", "#ff94a8", "#ffd0da"),
  menthe:mRamp("#1f6a44", "#3a9a66", "#4fb07a", "#5fbf8a", "#86d8a8", "#cff5de"),
  anneau:mRamp("#8a5a0e", "#c98e1c", "#e0a82a", "#f6c94a", "#ffe07a", "#fff6c8")
};
const ML = (() => { const v = [-0.55, -0.75, 0.62], n = Math.hypot(...v); return v.map(a => a / n); })();

const mEll = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const mCap = (ax, ay, bx, by, r) => (x, y) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy) <= r;
};
const mBox = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const mAny = (...f) => (x, y) => f.some(g => g(x, y));
const mNot = (a, b) => (x, y) => a(x, y) && !b(x, y);
const mAnd = (a, b) => (x, y) => a(x, y) && b(x, y);

function mSprite() {
  const c = new Array(64 * 64).fill(null);
  const put = (x, y, col) => { if (x >= 0 && y >= 0 && x < 64 && y < 64) c[y * 64 + x] = typeof col === "string" ? mhx(col) : col; };
  const get = (x, y) => (x >= 0 && y >= 0 && x < 64 && y < 64) ? c[y * 64 + x] : null;
  // Volume : on mesure la distance au bord, on en fait un dôme, puis on éclaire depuis le haut à gauche.
  function hd(mask, r, o = {}) {
    const inn = (x, y) => x >= 0 && y >= 0 && x < 64 && y < 64 && mask(x + .5, y + .5);
    const D = new Float32Array(64 * 64), INF = 1e9;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) D[y * 64 + x] = inn(x, y) ? INF : 0;
    const at = (x, y) => (x < 0 || y < 0 || x > 63 || y > 63) ? 0 : D[y * 64 + x];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const i = y * 64 + x; if (D[i]) D[i] = Math.min(D[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414); }
    for (let y = 63; y >= 0; y--) for (let x = 63; x >= 0; x--) { const i = y * 64 + x; if (D[i]) D[i] = Math.min(D[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414); }
    const R = o.round ?? 7, H = (x, y) => { const t = Math.min(at(x, y), R) / R; return R * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2)); };
    // hauteur lissée (deux flous 3 x 3), pour éviter le grain entre les teintes
    let Hm = new Float32Array(64 * 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) Hm[y * 64 + x] = inn(x, y) ? H(x, y) : 0;
    for (let pass = 0; pass < 2; pass++) {
      const nx2 = new Float32Array(64 * 64);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        if (!inn(x, y)) continue;
        let s2 = 0, n2 = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < 64 && Y < 64) { s2 += Hm[Y * 64 + X]; n2++; } }
        nx2[y * 64 + x] = s2 / n2;
      }
      Hm = nx2;
    }
    const hAt = (x, y) => (x < 0 || y < 0 || x > 63 || y > 63) ? 0 : Hm[y * 64 + x];
    const light = [], tone = new Int8Array(64 * 64).fill(-1), ramp5 = [r.s2, r.s1, r.base, r.light, r.hi];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (!inn(x, y)) continue;
      const nx = -(hAt(x + 1, y) - hAt(x - 1, y)) / 2, ny = -(hAt(x, y + 1) - hAt(x, y - 1)) / 2, n = Math.hypot(nx, ny, 1);
      const i = (nx * ML[0] + ny * ML[1] + ML[2]) / n + (o.bias || 0);
      light[y * 64 + x] = i;
      tone[y * 64 + x] = i > .93 && o.shine !== false ? 4 : i > .7 ? 3 : i > .4 ? 2 : i > .12 ? 1 : 0;
    }
    // un pixel isolé prend la teinte de ses voisins
    for (let pass = 0; pass < 2; pass++) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const t0 = tone[y * 64 + x]; if (t0 < 0) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (x + dx < 0 || y + dy < 0 || x + dx > 63 || y + dy > 63) ? -1 : tone[(y + dy) * 64 + x + dx]).filter(t => t >= 0);
      if (nb.length >= 3 && !nb.includes(t0)) { const cnt = {}; nb.forEach(t => cnt[t] = (cnt[t] || 0) + 1); tone[y * 64 + x] = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; }
    }
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const t0 = tone[y * 64 + x]; if (t0 >= 0) put(x, y, ramp5[t0]); }
    if (o.outline !== false) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (inn(x, y)) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => inn(x + dx, y + dy));
      if (!nb.length) continue;
      const best = Math.max(...nb.map(([dx, dy]) => light[(y + dy) * 64 + x + dx]));
      put(x, y, best > .55 && !o.inkOnly ? r.ol : MINK);
    }
  }
  const fill = (mask, col) => { for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (mask(x + .5, y + .5)) put(x, y, col); };
  const line = (pts, col, th = 1) => { for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; fill(mCap(ax, ay, bx, by, th / 2 + .1), col); } };
  return {c, put, get, hd, fill, line};
}

// --- teintes supplémentaires, humeurs, maladie ---
MR.pince = mRamp("#7a1a14", "#b8302a", "#d84436", "#f06a55", "#ff9a86", "#ffd2c8");
MR.aile = mRamp("#2d4d78", "#6a93c8", "#8fb6e0", "#b4d2f0", "#d4e7fa", "#ffffff");
MR.eau = mRamp("#1d4f78", "#3f8fcf", "#6fb4e6", "#8fc8f0", "#b4dcf8", "#ffffff");
const mREll = (cx, cy, rx, ry, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return (x, y) => { const dx = x - cx, dy = y - cy, u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry; return u * u + v * v <= 1; }; };
function mTintRamp(r, target, amt, sat) {
  const t = mhx(target), f = col => { const m = [0, 1, 2].map(i => col[i] * (1 - amt) + t[i] * amt), g = (m[0] + m[1] + m[2]) / 3; return m.map(v => Math.max(0, Math.min(255, Math.round(g + (v - g) * sat)))).concat(col[3]); };
  const o = {}; for (const k in r) o[k] = f(r[k]); return o;
}
const M_MOOD = {guilleret:["#ffffff", .08, 1.45], ronchon:["#7d8aa3", .38, .7], vaseux:["#a898b8", .32, .75], stresse:["#d9ec5a", .25, 1.1], lune:["#a9c8ff", .32, .95]};
const mMoodRamp = (r, mood, sick) => sick ? mTintRamp(r, "#9ccf5a", .5, .85) : (M_MOOD[mood] ? mTintRamp(r, ...M_MOOD[mood]) : r);

// --- expressions : ce que font les yeux, la bouche et les effets pour chaque état ---
const M_STATE = {
  forme:{eye:"normal", mouth:"default"}, ooh:{eye:"center", mouth:"o"},
  panique:{eye:"pin", mouth:"open", fx:"drops1"}, panique2:{eye:"pin", jitter:true, mouth:"open", fx:"drops2"},
  etourdi:{eye:"roll", mouth:"wavy", fx:"stars1"}, etourdi2:{eye:"roll2", mouth:"wavy", fx:"stars2"},
  nausee:{eye:"roll", mouth:"wavy", fx:"drops1", sick:true}, nausee2:{eye:"roll2", mouth:"wavy", fx:"drops2", sick:true},
  content:{eye:"closedHappy", mouth:"smile"}, rire:{eye:"closedHappy", mouth:"open"},
  fache:{eye:"normal", brow:"angry", mouth:"frown", fx:"steam"},
  dort:{eye:"closedSleep", mouth:"small"}, baille:{eye:"closedSleep", mouth:"yawn"}, remue:{eye:"remue", mouth:"small"}
};
const M_MOODFACE = {
  guilleret:{eye:"normal", big:true, mouth:"grand"}, ronchon:{eye:"normal", lid:.42, brow:"grumpy", mouth:"frown"},
  vaseux:{eye:"down", lid:.6, bags:true, mouth:"small", fx:"drool"}, stresse:{eye:"pin", mouth:"wavy", fx:"sweat"},
  lune:{eye:"up", mouth:"o", fx:"dream"}
};

function mMouthShape(S, mask, tongueMask, tongue = MR.langue) {
  S.hd(mask, MR.gorge, {round:3, inkOnly:true, shine:false});
  if (tongueMask) S.hd(mAnd(tongueMask, mask), tongue, {round:2, outline:false});
}
function mTooth(S, x, y, w = 2, h = 3) { S.fill(mBox(x, y, x + w - .01, y + h - .01), "#ffffff"); S.put(Math.floor(x + w - 1), Math.floor(y + h - 1), "#d6cfe4"); }

function mGEye(S, e, R, cfg, lx, ly, i, ring) {
  const [cx, cy, rx, ry, px, py, pr, lid0] = e;
  const mode = cfg.eye === "remue" ? (i === 0 ? "half" : "closedSleep") : cfg.eye;
  if (mode === "closedHappy" || mode === "closedSleep") {
    S.hd(mEll(cx, cy, rx, ry), R.main, {round:Math.min(3, rx * .7)});
    const pts = [];
    for (let t = -1; t <= 1.001; t += .25) pts.push([cx + t * (rx - .8), mode === "closedHappy" ? cy + .8 - (1 - t * t) * ry * .45 : cy - .5 + (1 - t * t) * ry * .35]);
    S.line(pts, MINK, 1.3);
    return;
  }
  const grow = mode === "center" || mode === "pin" ? 1.08 : 1;
  S.hd(mEll(cx, cy, rx * grow, ry * grow), ring ? MR.anneau : MR.blanc, {round:Math.min(3, rx * .7), inkOnly:true});
  let qx = px + lx * Math.min(1.8, rx * .3), qy = py + ly * Math.min(1.8, ry * .3), qr = pr * (ring ? 1 : 1);
  if (mode === "center") { qx = cx; qy = cy; qr = pr * .75; }
  else if (mode === "pin") { qx = cx + (cfg.jitter ? (i ? 1 : -1) : 0); qy = cy - (cfg.jitter ? 1 : 0); qr = Math.max(.9, pr * .42); }
  else if (mode === "roll") { qx = cx + (i ? 1 : -1) * rx * .42; qy = cy + (i ? 1 : -1) * ry * .34; }
  else if (mode === "roll2") { qx = cx - (i ? 1 : -1) * rx * .42; qy = cy - (i ? 1 : -1) * ry * .34; }
  else if (mode === "up") { qx = cx + lx * .8; qy = cy - ry * .45; }
  else if (mode === "down") { qy = cy + ry * .3; }
  if (cfg.big && mode === "normal") qr *= 1.25;
  S.fill(mEll(qx, qy, qr, qr * 1.12), MINK);
  const gx = Math.floor(qx - qr * .5), gy = Math.floor(qy - qr * .55);
  S.put(gx, gy, "#ffffff"); if (qr > 1.5) { S.put(gx + 1, gy, "#ffffff"); S.put(gx, gy + 1, "#ffffff"); }
  if (qr > 3.5) S.fill(mEll(qx - qr * .3, qy - qr * .38, qr * .3, qr * .32), "#ffffff");
  const lidA = cfg.lid || (mode === "half" ? .5 : 0) || lid0 || 0;
  if (lidA) {
    const edge = cy - ry + lidA * 2 * ry;
    S.fill(mAnd(mEll(cx, cy, rx - .5, ry - .5), (x, y) => y < edge), R.main.base);
    S.line([[cx - rx + .9, edge], [cx + rx - .9, edge]], MINK, 1);
  }
  if (cfg.bags) S.line([[cx - rx * .8, cy + ry + 1], [cx, cy + ry + 1.8], [cx + rx * .8, cy + ry + 1]], R.main.s2, 1);
  if (cfg.brow) {
    const s = cx < 32 ? 1 : -1, angry = cfg.brow === "angry";
    S.line([[cx - s * (rx + .6), cy - ry - (angry ? 2.2 : 1.4)], [cx + s * rx * .55, cy - ry + (angry ? .3 : -.7)]], MINK, 1.5);
  }
}
function mSEye(S, sl, R, cfg, lx, ly, i) {
  let [x, y0, y1] = sl; x += lx * .9; y0 += ly * .9; y1 += ly * .9;
  const mode = cfg.eye === "remue" ? (i === 0 ? "half" : "closedSleep") : cfg.eye, mid = (y0 + y1) / 2;
  const layered = pts => { S.line(pts, MINK, 4.6); S.line(pts, "#ffffff", 3); S.line(pts, MINK, 1.3); };
  if (mode === "closedHappy") return layered([[x - 3, mid + 1.5], [x, mid - 1.5], [x + 3, mid + 1.5]]);
  if (mode === "closedSleep") return layered([[x - 3, mid + .5], [x + 3, mid + .5]]);
  if (mode === "roll" || mode === "roll2") { const d = mode === "roll" ? 2.6 : 2.2; layered([[x - d, mid - d], [x + d, mid + d]]); layered([[x - d, mid + d], [x + d, mid - d]]); return; }
  if (mode === "pin") { y0 = mid - 2.6 - (cfg.jitter ? 1 : 0); y1 = mid + 2.6; }
  if (mode === "center") { y0 -= 1; y1 += 1; }
  if (mode === "up") { y0 -= 2; y1 -= 2; }
  if (mode === "down") { y0 += 1.5; y1 += 1.5; }
  const h = y1 - y0, wave = mode === "center" || mode === "pin" ? .3 : 1.1, tilt = cfg.brow === "angry" ? (x < 31 ? 1.4 : -1.4) : 0;
  const pts = [[x + tilt, y0], [x + wave, y0 + h * .33], [x - wave, y0 + h * .66], [x - tilt * .3, y1]];
  S.line(pts, MINK, 6.4); S.line(pts, "#ffffff", 4.6); S.line(pts, MINK, cfg.big ? 3.4 : mode === "pin" ? 2 : 2.8);
  const lidA = cfg.lid || (mode === "half" ? .5 : 0);
  if (lidA) {
    const edge = y0 - 2 + (h + 4) * lidA;
    S.fill(mAnd(mBox(x - 4, y0 - 3.5, x + 4, edge), (xx, yy) => S.get(Math.floor(xx), Math.floor(yy)) !== null), R.main.base);
    S.line([[x - 3.6, edge], [x + 3.6, edge]], MINK, 1);
  }
  if (cfg.bags) S.line([[x - 2.5, y1 + 2.5], [x, y1 + 3.2], [x + 2.5, y1 + 2.5]], R.main.s2, 1);
  if (cfg.brow) { const s = x < 31 ? 1 : -1; S.line([[x - s * 3.5, y0 - 3.4], [x + s * 2, y0 - (cfg.brow === "angry" ? 1.4 : 2.4)]], MINK, 1.5); }
}
function mDrawEyes(S, M, R, cfg, look) {
  const [lx, ly] = look || [0, 0];
  if (M.eyeType === "slit") M.eyes.forEach((sl, i) => mSEye(S, sl, R, cfg, lx, ly, i));
  else M.eyes.forEach((e, i) => mGEye(S, e, R, cfg, lx, ly, i, M.eyeType === "ring"));
  if (M.brows && !cfg.brow && ["normal", "center", "pin"].includes(cfg.eye)) M.brows.forEach(p => S.line(p, MINK, 1));
  if (M.bags && ["normal", "center", "pin", "down", "up"].includes(cfg.eye) && !cfg.bags) M.eyes.forEach(([cx, cy, rx, ry]) => S.line([[cx - rx * .8, cy + ry + 1.2], [cx, cy + ry + 2], [cx + rx * .8, cy + ry + 1.2]], R.main.s2, 1));
}
function mDrawMouth(S, M, R, cfg, parts) {
  const {cx, cy} = M.mouth, kind = cfg.mouth;
  if (kind === "default") {
    if (M.mouth.draw) M.mouth.draw(S, R);
    else if (parts.bouche) S.line([[cx - 3, cy], [cx + 3, cy]], MINK, 1);
    if (parts.bouche === "crocs") for (const fx of [cx - 3.2, cx + 2.2]) { S.fill(mBox(fx, cy + .6, fx + .99, cy + 2.6), "#ffffff"); S.put(Math.floor(fx), Math.floor(cy + 2.6), MINK); }
    if (parts.bouche === "langue") S.hd(mEll(cx + 1.5, cy + 3.2, 2.2, 2.6), MR.langue, {round:2});
    return;
  }
  if (kind === "o") S.hd(mEll(cx, cy, 1.9, 2.3), MR.gorge, {round:1.5, inkOnly:true, shine:false});
  else if (kind === "open") { mMouthShape(S, mEll(cx, cy, 4.2, 3.2), mEll(cx, cy + 1.9, 2.6, 1.4)); mTooth(S, cx - 2.5, cy - 2.4, 1.6, 1.6); mTooth(S, cx + .9, cy - 2.4, 1.6, 1.6); }
  else if (kind === "yawn") mMouthShape(S, mEll(cx, cy + .5, 3.8, 4.4), mEll(cx, cy + 3, 2.4, 1.4));
  else if (kind === "grand") { mMouthShape(S, mAnd(mEll(cx, cy - 1.5, 6.2, 5.2), (x, y) => y > cy - 1.5), mEll(cx, cy + 2.6, 3.6, 1.8)); for (const t of [-4.2, -1.6, 1]) mTooth(S, cx + t, cy - 1.2, 2, 1.8); }
  else if (kind === "wavy") { const p = []; for (let k = -4; k <= 4; k++) p.push([cx + k, cy + (k % 2 ? .8 : -.2)]); S.line(p, MINK, 1); }
  else if (kind === "frown") S.line([[cx - 4, cy + 1.3], [cx - 2, cy], [cx + 2, cy], [cx + 4, cy + 1.3]], MINK, 1.1);
  else if (kind === "small") S.line([[cx - 1, cy], [cx + 1, cy]], MINK, 1);
  else if (kind === "smile") S.line([[cx - 4, cy - .6], [cx - 2, cy + .8], [cx + 2, cy + .8], [cx + 4, cy - .6]], MINK, 1.1);
}
function mDrawFx(S, M, cfg) {
  const [tx, ty] = M.anchors.top, hw = M.anchors.halfW;
  const drop = (x, y) => { S.hd(mEll(x, y, 2.2, 3), MR.eau, {round:2}); S.put(Math.floor(x - 1), Math.floor(y - 1), "#ffffff"); };
  const star = (x, y) => { x = Math.floor(x); y = Math.floor(y); S.put(x, y, "#fff7c4"); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => S.put(x + a, y + b, "#ffd23f")); [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(([a, b]) => S.put(x + a, y + b, "#e0a82a")); };
  const puff = (x, y, r) => S.hd(mEll(x, y, r, r * .85), MR.blanc, {round:2});
  const fx = cfg.fx;
  if (fx === "drops1") { drop(tx + hw + 4, ty + 6); drop(tx - hw - 4, ty + 9); }
  if (fx === "drops2") { drop(tx + hw + 6, ty + 10); drop(tx - hw - 5, ty + 5); }
  if (fx === "stars1") { star(tx - hw, ty - 2); star(tx + hw, ty - 4); star(tx, ty - 7); }
  if (fx === "stars2") { star(tx - hw + 4, ty - 6); star(tx + hw - 1, ty + 1); star(tx - hw - 3, ty + 2); }
  if (fx === "steam") for (const s of [-1, 1]) { puff(tx + s * (hw + 3), ty + 2, 2.8); puff(tx + s * (hw + 6), ty - 2, 2); puff(tx + s * (hw + 4), ty - 5.5, 1.4); }
  if (fx === "sweat") drop(tx + hw + 3, ty + 7);
  if (fx === "drool") { const {cx, cy} = M.mouth; S.hd(mEll(cx + 3.5, cy + 3, 1.1, 1.8), MR.eau, {round:1}); }
  if (fx === "dream") { star(tx + hw + 2, ty - 3); star(tx - hw - 1, ty - 6); }
}

// --- parties à la Spore, placées d'après les points d'accroche de chaque monstre ---
function mPartsBack(S, M, R, parts) {
  const {top:[tx, ty], halfW:hw, bottom, tail:[qx, qy]} = M.anchors;
  if (parts.dos === "ailes") for (const s of [-1, 1]) {
    S.hd(mREll(tx + s * (hw + 5), ty + 9, 8.5, 4.3, s * 32 * Math.PI / 180), MR.aile, {round:3});
    S.hd(mREll(tx + s * (hw + 4), ty + 15, 6.5, 3.2, s * 12 * Math.PI / 180), MR.aile, {round:2.5});
  }
  if (parts.dos === "fourrure") for (let deg = -170; deg <= -10; deg += 20) { const a = deg * Math.PI / 180; S.hd(mEll(tx + (hw + 2) * Math.cos(a), ty + hw + (hw + 2) * Math.sin(a), 3.2, 3.2), R.main, {round:2.5}); }
  if (parts.queue === "touffue") { S.hd(mCap(qx, qy, qx + 6, qy - 6, 2.2), R.main, {round:2}); S.hd(mEll(qx + 8.5, qy - 9.5, 4.6, 4.4), R.main, {round:4, bias:.12}); }
  if (parts.queue === "lezard") { S.hd(mCap(qx, qy, qx + 6, qy - 1, 2.6), R.main, {round:2.5}); S.hd(mCap(qx + 6, qy - 1, qx + 11, qy - 5, 1.9), R.main, {round:1.9}); S.hd(mCap(qx + 11, qy - 5, qx + 13, qy - 10, 1.1), R.main, {round:1.1}); }
  if (parts.pattes === "palmees") {
    if (bottom < 54) for (const lx of [26.5, 37.5]) S.hd(mCap(lx, bottom - 2, lx, 58, 2.6), R.main, {round:2.6});
    for (const fx of [24.5, 39.5]) { S.hd(mEll(fx, 60, 6.2, 2.4), MR.orange, {round:2}); S.put(Math.floor(fx - 2), 60, MR.orange.s2); S.put(Math.floor(fx + 2), 60, MR.orange.s2); }
  }
}
function mPartsFront(S, M, R, parts) {
  const {top:[tx, ty], halfW:hw, sides} = M.anchors;
  for (const [sx, sy] of sides) {
    const s = sx < 32 ? -1 : 1;
    if (parts.bras === "bras") S.hd(mEll(sx + s, sy, 3.3, 4.6), R.main, {round:3});
    if (parts.bras === "pinces") {
      S.hd(mCap(sx, sy, sx + s * 4, sy - .5, 2), MR.pince, {round:2});
      S.hd(mCap(sx + s * 8, sy - 2.5, sx + s * 12, sy - 5, 1.8), MR.pince, {round:1.8});
      S.hd(mCap(sx + s * 8, sy + 2, sx + s * 11.5, sy + 2.8, 1.5), MR.pince, {round:1.5});
      S.hd(mEll(sx + s * 6, sy - .5, 4.2, 3.8), MR.pince, {round:3});
    }
  }
  for (const s of [-1, 1]) {
    if (parts.tete === "antennes") { S.hd(mCap(tx + s * 4, ty + 2, tx + s * 7, ty - 6, 1.1), R.main, {round:1.1}); S.hd(mEll(tx + s * 8, ty - 8.5, 2.9, 2.9), MR.anneau, {round:2.5}); }
    if (parts.tete === "cornes") {
      const bx = tx + s * hw * .7;
      S.hd(mCap(bx, ty + 3, bx + s * 2.5, ty - 2.5, 2.4), MR.ivoire, {round:2.4});
      S.hd(mCap(bx + s * 2.5, ty - 2.5, bx + s * 3.5, ty - 7, 1.6), MR.ivoire, {round:1.6});
      S.hd(mCap(bx + s * 3.5, ty - 7, bx + s * 2.5, ty - 10, .9), MR.ivoire, {round:.9});
    }
  }
}

// --- les six monstres ---
const MONSTRES = {
  goutte:{name:"Goutte", ramps:{main:"jaune", second:"miel"}, eyeType:"slit", eyes:[[25.5, 29, 42], [35.5, 29, 42]], eyeY:35.5,
    anchors:{top:[31, 15], halfW:11, sides:[[14, 39], [48.5, 38]], bottom:56, tail:[46, 48]},
    mouth:{cx:28.5, cy:47.6, draw(S) {
      S.line([[24, 47.2], [28, 48], [33, 47.2]], MINK, 1);
      S.fill(mAny(mBox(31, 48, 32.99, 48.99), mBox(31, 49, 31.99, 50.99)), "#ffffff"); S.put(32, 49, "#d6cfe4");
    }},
    body(S, R, f) {
      if (!f.noArms) { S.hd(mEll(14, 39, 3.4, 4.6), R.main, {round:3}); S.hd(mEll(48.5, 38, 3.4, 4.6), R.main, {round:3}); }
      const body = mAny(mEll(31, 29, 14.5, 14.5), mBox(16.5, 29, 46.5, 51), mEll(19, 53, 4.4, 5), mEll(27, 54.8, 4.8, 4.2), mEll(36, 54.2, 5.2, 4.6), mEll(44.5, 55.2, 5.2, 3.8), mEll(50.5, 56.5, 3.8, 2.4));
      S.hd(body, R.main, {round:9});
      S.hd(mAnd(body, (x, y) => y > 46 + Math.sin(x * .55) * 1.6), R.second, {round:4, outline:false, bias:-.05});
      S.line([[18, 47.5], [22, 46.2], [26, 47.4], [30, 46.4], [34, 47.3], [38, 46.2], [42, 47.2], [46, 46.3]], R.second.s2, 1);
    }},
  poire:{name:"Poire", ramps:{main:"bleu", accent:"anneau"}, eyeType:"ring", eyeY:27,
    eyes:[[30.5, 23.5, 3.8, 3.8, 30.9, 23.8, 2.1], [25, 30.5, 3.8, 3.8, 25.4, 30.8, 2.1], [36, 30.5, 3.8, 3.8, 36.4, 30.8, 2.1]],
    anchors:{top:[31, 10.5], halfW:8, sides:[[14, 44], [49.5, 43]], bottom:58, tail:[46, 50]},
    mouth:{cx:30.5, cy:44, draw(S) {
      mMouthShape(S, mAnd(mEll(30.5, 40.5, 9, 7.8), (x, y) => y > 40.5), mEll(30.5, 47.8, 5.8, 2.6));
      for (const x of [24.5, 28, 31.5, 35]) mTooth(S, x, 41, 2, 2.6);
    }},
    body(S, R, f) {
      if (!f.noArms) {
        S.hd(mEll(14, 44, 3.2, 6.8), R.main, {round:3}); S.hd(mEll(49.5, 43, 3.2, 6.8), R.main, {round:3});
        for (const [x, y] of [[12, 50], [15, 51], [48, 49], [51, 50]]) S.hd(mEll(x, y, 1.3, 1.6), R.accent, {round:1, inkOnly:true});
      }
      if (!f.noLegs) S.hd(mAny(mEll(24.5, 58.5, 5.4, 3), mEll(39.5, 58.5, 5.4, 3)), R.main, {round:3});
      S.hd(mAny(mEll(31, 22, 9.5, 12), mEll(32, 42, 15.5, 14.5)), R.main, {round:10});
    }},
  tremblote:{name:"Tremblote", ramps:{main:"rose", accent:"jaune"}, eyeType:"googly", eyeY:37,
    eyes:[[25, 37, 4.8, 5.8, 23.8, 39.5, 2.2], [37.5, 37, 4.8, 5.8, 36.3, 39.5, 2.2]],
    brows:[[[20, 30], [24, 29], [28, 30.4]], [[33, 30.4], [37, 29], [41, 30]]],
    anchors:{top:[32, 24.5], halfW:14, sides:[[15.5, 47], [48.5, 47]], bottom:58, tail:[48, 53]},
    mouth:{cx:31, cy:49.5, draw(S) {
      mMouthShape(S, (x, y) => x > 23 && x < 39 && y > 46.5 + Math.sin(x * 1.1) * 1.3 && y < 52 + Math.sin(x * 1.3) * .6, null);
      for (const x of [25, 29, 33]) mTooth(S, x, 49.5, 2, 1.6);
    }},
    body(S, R) {
      const bumps = [];
      for (let deg = -170; deg <= -10; deg += 22) { const a = deg * Math.PI / 180; bumps.push(mEll(32 + 15.5 * Math.cos(a), 40 + 15 * Math.sin(a), 3.4, 3.4)); }
      S.hd(mAny(mEll(32, 40, 16.5, 15.5), mBox(15.5, 40, 48.5, 56), mEll(20, 57, 4.4, 2.6), mEll(30, 57.5, 5, 2.4), mEll(41, 57, 5, 2.6), ...bumps), R.main, {round:10});
      for (let deg = -150; deg <= -30; deg += 44) { const a = deg * Math.PI / 180; S.hd(mEll(32 + 15.5 * Math.cos(a), 40 + 15 * Math.sin(a), 1.8, 1.8), R.accent, {round:1.5, inkOnly:true}); }
    }},
  cyclope:{name:"Cyclope", ramps:{main:"orange"}, eyeType:"googly", eyeY:30, eyes:[[31, 30, 9.6, 9.6, 32.5, 30.5, 5.8]],
    anchors:{top:[32, 17], halfW:10, sides:[[18, 33], [46, 33]], bottom:45.5, tail:[45, 38]},
    mouth:{cx:31, cy:41.5},
    body(S, R, f) {
      if (!f.noLegs) {
        for (const [ax, ay, bx, by] of [[25, 42, 21, 57], [30, 44, 28.5, 58], [34, 44, 35.5, 58], [39, 42, 43, 57]]) S.hd(mCap(ax, ay, bx, by, 1.6), R.main, {round:1.6});
        for (const [fx, fy] of [[20.5, 58.5], [28, 59.5], [36, 59.5], [43.5, 58.5]]) S.hd(mEll(fx, fy, 2.8, 1.8), R.main, {round:1.8});
      }
      if (!f.noArms) S.hd(mAny(mCap(19, 32, 9, 26, 1.6), mCap(9, 26, 6, 21.5, 1.3), mCap(9, 26, 4.5, 27, 1.3), mCap(45, 32, 55, 26, 1.6), mCap(55, 26, 58, 21.5, 1.3), mCap(55, 26, 59.5, 27, 1.3)), R.main, {round:1.6});
      if (!f.noAntennae) { S.hd(mAny(mCap(27, 19, 23, 9, 1.4), mCap(37, 19, 41, 9, 1.4)), R.main, {round:1.4}); S.hd(mAny(mEll(22.5, 7.5, 2.9, 2.9), mEll(41.5, 7.5, 2.9, 2.9)), R.main, {round:2.5}); }
      S.hd(mEll(32, 31, 14.5, 14.5), R.main, {round:10});
      for (const [x, y, r] of [[22.5, 38, 1.9], [40, 40.5, 2.3], [31, 42.5, 1.7], [25.5, 43, 1.3]]) S.hd(mEll(x, y, r, r), R.main, {round:1.5, outline:false, bias:-.35});
    }},
  poilu:{name:"Poilu", ramps:{main:"violet"}, eyeType:"googly", eyeY:30.5, bags:true,
    eyes:[[25.5, 30.5, 4.3, 4.9, 26.3, 31.2, 2.2], [36.5, 30.5, 4.3, 4.9, 35.7, 31.2, 2.2]],
    anchors:{top:[32, 14], halfW:12, sides:[[18, 40], [46, 40]], bottom:57, tail:[47, 50]},
    mouth:{cx:31, cy:45.5, draw(S) {
      mMouthShape(S, mNot(mEll(31, 45, 7.2, 5.6), mEll(31, 38.3, 9, 3)), mEll(31, 49.5, 4.2, 1.8));
      mTooth(S, 27.5, 41.4, 2.4, 2.8); mTooth(S, 32, 41.4, 2.4, 2.8);
    }},
    body(S, R, f) {
      const tufts = [];
      for (let y = 29; y <= 52; y += 4) { tufts.push(mCap(18, y, 13, y + 3, 2)); tufts.push(mCap(46, y, 51, y + 3, 2)); }
      for (let x = 22; x <= 42; x += 5) tufts.push(mCap(x, 15.5, x + 1.5, 12, 1.6));
      const feet = f.noLegs ? [] : [mEll(23, 56.5, 5.4, 3), mEll(41, 56.5, 5.4, 3)];
      S.hd(mAny(mEll(32, 28, 14, 14), mBox(18, 28, 46, 55), ...feet, ...tufts), R.main, {round:9});
      for (let y = 31; y <= 51; y += 4) { S.line([[17, y + .5], [15, y + 2.5]], R.main.s1, 1); S.line([[47, y + .5], [49, y + 2.5]], R.main.s2, 1); }
      for (const [x, y, r] of [[21, 47, 1.9], [42, 44, 2.3], [44, 51, 1.6], [24, 52, 1.4], [37, 50, 1.2]]) S.hd(mEll(x, y, r, r), R.main, {round:1.5, outline:false, bias:-.35});
    }},
  tiges:{name:"Tiges", ramps:{main:"ciel"}, eyeType:"googly", eyeY:12.5,
    eyes:[[18.5, 12.5, 5.2, 5.2, 19.3, 13.3, 2.6], [45.5, 12.5, 5.2, 5.2, 44.7, 13.3, 2.6]],
    anchors:{top:[32, 29], halfW:12, sides:[[19, 42], [45, 42]], bottom:55.5, tail:[45, 50]},
    mouth:{cx:31, cy:44, draw(S) {
      mMouthShape(S, mEll(31, 44, 5.6, 8), mEll(31.5, 48.5, 3, 3.4), MR.menthe);
      mTooth(S, 28, 37.2, 2, 2.4); mTooth(S, 32, 37.2, 2, 2.4); mTooth(S, 29.5, 50.5, 2, 2);
    }},
    body(S, R, f) {
      S.hd(mAny(mCap(26, 30, 19, 15, 2.1), mCap(38, 30, 45, 15, 2.1)), R.main, {round:2});
      const limbs = [];
      if (!f.noArms) limbs.push(mCap(19, 42, 10, 38, 2.7), mCap(10, 38, 8, 33, 2.1), mCap(45, 42, 54, 38, 2.7), mCap(54, 38, 56, 33, 2.1), mCap(22, 30, 17, 26, 2.3), mCap(42, 30, 47, 26, 2.3));
      if (!f.noLegs) limbs.push(mCap(24, 52, 20, 58, 2.7), mCap(40, 52, 44, 58, 2.7));
      S.hd(mAny(mEll(32, 42, 14, 13.5), ...limbs), R.main, {round:8});
    }}
};

// Une image complète : état (expression), regard, parties et humeur.
function monstreFrame(id, state = "forme", look = [0, 0], parts = {}, mood = null) {
  const M = MONSTRES[id], base = M_STATE[state] || M_STATE.forme;
  const cfg = state === "forme" && M_MOODFACE[mood] ? {...base, ...M_MOODFACE[mood]} : base;
  const R = {}; for (const k in M.ramps) R[k] = mMoodRamp(MR[M.ramps[k]], mood, !!cfg.sick);
  const S = mSprite(), U = mSprite(); parts = parts || {};
  mPartsBack(S, M, R, parts);
  M.body(S, R, {noArms:!!parts.bras, noLegs:!!parts.pattes, noAntennae:!!parts.tete});
  mPartsFront(S, M, R, parts);
  mDrawEyes(S, M, R, cfg, look);
  mDrawMouth(S, M, R, cfg, parts);
  mDrawFx(S, M, cfg);
  if (parts.pattes === "longues") {
    const sh = new Array(64 * 64).fill(null);
    for (let i = 7 * 64; i < 64 * 64; i++) sh[i - 7 * 64] = S.c[i];
    S.c.splice(0, 64 * 64, ...sh);
    const b = M.anchors.bottom - 7;
    for (const lx of [26.5, 37.5]) U.hd(mCap(lx, b - 2, lx, 58, 3), R.main, {round:3});
    for (const fx of [25.5, 38.5]) U.hd(mEll(fx, 60, 4.4, 2.2), R.main, {round:2});
  }
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (!U.c[y * 64 + x] && ((x + .5 - 32) / 17) ** 2 + ((y + .5 - 61.8) / 1.7) ** 2 <= 1) U.put(x, y, [30, 27, 58, 60]);
  return S.c.map((col, i) => col || U.c[i]);
}
function monstre64(id) { return monstreFrame(id); }
function monstreURL(id, state, look, parts, mood) {
  const c = monstreFrame(id, state, look, parts, mood), cv = document.createElement("canvas"); cv.width = 64; cv.height = 64;
  const g = cv.getContext("2d"), im = g.createImageData(64, 64);
  c.forEach((col, i) => { if (col) im.data.set(col, i * 4); });
  g.putImageData(im, 0, 0);
  return cv.toDataURL();
}
