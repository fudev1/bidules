// Bidule en 64 x 64 : chaque partie est une forme ombrée et détourée automatiquement.
const L3 = (() => { const v = [-0.55, -0.75, 0.62], n = Math.hypot(...v); return v.map(a => a / n); })();
const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const ramp = (...c) => ({ol:hx(c[0]), od:hx(c[1]), s2:hx(c[2]), s1:hx(c[3]), base:hx(c[4]), light:hx(c[5]), hi:hx(c[6])});

const PAL64 = {
  menthe:{body:ramp("#3f8a79", "#1f4a44", "#4f9a8a", "#6dbba6", "#94d4c0", "#bdeadb", "#e6fbf3"),
          belly:ramp("#3f8a79", "#1f4a44", "#b4dccc", "#cdebdf", "#e2f5ed", "#f1fbf6", "#ffffff"),
          tuft:ramp("#3f8a79", "#1f4a44", "#7cc4b1", "#a6ddcc", "#c9eee2", "#e3f8f0", "#ffffff"),
          stalk:ramp("#1f4a44", "#1f4a44", "#2f6b61", "#3f8a79", "#4f9a8a", "#6dbba6", "#94d4c0")},
  peche:{body:ramp("#b86a3a", "#6e3418", "#d88a5a", "#eea57a", "#ffc29e", "#ffdcc4", "#fff3ea"),
         belly:ramp("#b86a3a", "#6e3418", "#f2cdb4", "#f8dcc8", "#fde9dc", "#fff4ec", "#ffffff"),
         tuft:ramp("#b86a3a", "#6e3418", "#e59a6c", "#f4b690", "#ffd0b4", "#ffe6d8", "#ffffff"),
         stalk:ramp("#6e3418", "#6e3418", "#9a4f28", "#b86a3a", "#d88a5a", "#eea57a", "#ffc29e")},
  lilas:{body:ramp("#7a62b8", "#3d2c70", "#9b85d6", "#b3a0e6", "#c9b8f5", "#e0d6fb", "#f6f2ff"),
         belly:ramp("#7a62b8", "#3d2c70", "#d9cff2", "#e4dcf7", "#efeafb", "#f7f4fe", "#ffffff"),
         tuft:ramp("#7a62b8", "#3d2c70", "#ab97e0", "#c4b4ee", "#dbd0f8", "#ece6fc", "#ffffff"),
         stalk:ramp("#3d2c70", "#3d2c70", "#5a449a", "#7a62b8", "#9b85d6", "#b3a0e6", "#c9b8f5")},
  malade:{body:ramp("#6f8a3a", "#3d4f18", "#98b35a", "#b2c876", "#c9d98f", "#dde8b4", "#f1f7dc"),
          belly:ramp("#6f8a3a", "#3d4f18", "#d6e2ae", "#e2ebc4", "#edf3d8", "#f5f9e8", "#ffffff"),
          tuft:ramp("#6f8a3a", "#3d4f18", "#a9c26e", "#c2d48f", "#d8e4b0", "#e9f0d0", "#ffffff"),
          stalk:ramp("#3d4f18", "#3d4f18", "#56702a", "#6f8a3a", "#98b35a", "#b2c876", "#c9d98f")}
};
const GOLD = ramp("#b8860b", "#6e4a00", "#d4921a", "#eeb52c", "#ffd23f", "#ffe680", "#fff7c4");
const IVORY = ramp("#a08a60", "#5e4a2a", "#c9b48a", "#dfcca3", "#efe2c0", "#f8f0da", "#ffffff");
const CLAW = ramp("#b8452f", "#6e2418", "#c9503a", "#e2664b", "#f28a6a", "#ffb49a", "#ffe0d4");
const WEB = ramp("#b8701a", "#6e3f00", "#d0851f", "#eba032", "#f7b84f", "#ffd88a", "#fff1cf");
const WING = ramp("#5a86b8", "#2d4d78", "#8fb6e0", "#b4d2f0", "#d4e7fa", "#eaf4ff", "#ffffff");
const RED = ramp("#a8322a", "#5e1612", "#c23b30", "#dc4b3c", "#f06a55", "#ff9a86", "#ffd2c8");
const WOOL = ramp("#9aa4b0", "#5a6470", "#c9d0d8", "#dde2e8", "#eef1f4", "#f8fafc", "#ffffff");
const SWEAT = ramp("#2f7fb8", "#1d4f78", "#6fb4e6", "#8fc8f0", "#b4dcf8", "#dcf0ff", "#ffffff");

// Humeurs : une teinte mélangée à la palette, et une saturation.
const MOOD_TINT = {guilleret:["#ffffff", .08, 1.45], ronchon:["#7d8aa3", .38, .7], vaseux:["#a898b8", .32, .75], stresse:["#d9ec5a", .25, 1.1], lune:["#a9c8ff", .32, .95]};
function tint(col, target, amt, sat) {
  const t = hx(target), mixed = [0, 1, 2].map(i => col[i] * (1 - amt) + t[i] * amt), m = (mixed[0] + mixed[1] + mixed[2]) / 3;
  return mixed.map(v => Math.max(0, Math.min(255, Math.round(m + (v - m) * sat)))).concat(col[3]);
}
function moodPalette(P, mood) {
  if (!mood || !MOOD_TINT[mood]) return P;
  const [t, a, sat] = MOOD_TINT[mood], out = {};
  for (const k in P) { out[k] = {}; for (const j in P[k]) out[k][j] = tint(P[k][j], t, a, sat); }
  return out;
}

function mkSprite() {
  const c = new Array(64 * 64).fill(null);
  const get = (x, y) => c[y * 64 + x];
  const put = (x, y, col) => { if (x >= 0 && y >= 0 && x < 64 && y < 64) c[y * 64 + x] = typeof col === "string" ? hx(col) : col; };
  const d3 = n => n[0] * L3[0] + n[1] * L3[1] + n[2] * L3[2];
  const nrm = (nx, ny) => [nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))];
  const shade = (r, n) => { const i = d3(n); return i > .8 ? r.hi : i > .52 ? r.light : i > .18 ? r.base : i > -.15 ? r.s1 : r.s2; };
  function draw(mask, normal, r, outline = true, onlyOn = false) {
    const pts = new Set();
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (mask(x + .5, y + .5) && (!onlyOn || get(x, y))) pts.add(y * 64 + x);
    for (const k of pts) {
      const x = k % 64, y = (k - x) / 64, n = normal(x + .5, y + .5);
      const edge = x === 0 || x === 63 || !pts.has(k + 1) || !pts.has(k - 1) || !pts.has(k + 64) || !pts.has(k - 64);
      put(x, y, edge && outline ? (d3(n) > .25 ? r.ol : r.od) : shade(r, n));
    }
  }
  const ellipse = (cx, cy, rx, ry, r, o = {}) => draw((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && (!o.clip || o.clip(x, y)),
    (x, y) => nrm((x - cx) / rx, (y - cy) / ry), r, o.outline !== false, o.onlyOn);
  function rellipse(cx, cy, rx, ry, ang, r) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const loc = (x, y) => { const dx = x - cx, dy = y - cy; return [(dx * ca + dy * sa) / rx, (-dx * sa + dy * ca) / ry]; };
    draw((x, y) => { const [u, v] = loc(x, y); return u * u + v * v <= 1; },
      (x, y) => { const [u, v] = loc(x, y); return nrm((u * ca - v * sa) * .92, (u * sa + v * ca) * .92); }, r);
  }
  function capsule(ax, ay, bx, by, rad, r) {
    const cl = (x, y) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))); return [ax + t * dx, ay + t * dy]; };
    draw((x, y) => { const [px, py] = cl(x, y); return Math.hypot(x - px, y - py) <= rad; },
      (x, y) => { const [px, py] = cl(x, y); return nrm((x - px) / rad * .95, (y - py) / rad * .95); }, r);
  }
  const px = (x, y, col, onlyOn = false) => { if (x >= 0 && y >= 0 && x < 64 && y < 64 && (!onlyOn || get(x, y))) put(x, y, col); };
  function blob(cx, cy, rx, ry, col, onlyOn = false) {
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1) px(x, y, col, onlyOn);
  }
  function line(x0, y0, x1, y1, col, th = 1.4) {
    const h = th / 2;
    for (let s = 0; s <= 1.0001; s += 0.04) {
      const X = x0 + (x1 - x0) * s, Y = y0 + (y1 - y0) * s;
      for (let y = Math.floor(Y - h); y <= Math.floor(Y + h); y++) for (let x = Math.floor(X - h); x <= Math.floor(X + h); x++)
        if (Math.hypot(x + .5 - X, y + .5 - Y) <= h + .35) px(x, y, col);
    }
  }
  return {c, get, put, draw, ellipse, rellipse, capsule, px, blob, line, nrm};
}

function bidule64(b, state = "forme", acc = {}) {
  const sick = state.startsWith("nausee");
  const P = moodPalette(PAL64[sick ? "malade" : b.pal], sick ? null : b.mood), B = P.body, parts = b.parts || {}, S = mkSprite();
  const legs = parts.pattes, cy = legs === "longues" ? 39 : 43, mir = v => 64 - v, id = v => v;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (((x + .5 - 32) / 15) ** 2 + ((y + .5 - 62) / 1.8) ** 2 <= 1) S.put(x, y, [29, 43, 34, 55]);
  if (parts.dos === "ailes") for (const [f, sd] of [[id, 1], [mir, -1]]) {
    S.rellipse(f(11), cy - 10, 10, 5.2, sd * -32 * Math.PI / 180, WING);
    S.rellipse(f(9.5), cy - 3.5, 7.5, 3.6, sd * -12 * Math.PI / 180, WING);
  }
  if (parts.dos === "fourrure") for (let deg = -176; deg <= -4; deg += 17) {
    const a = deg * Math.PI / 180; S.ellipse(32 + 14.2 * Math.cos(a), cy + 12.4 * Math.sin(a), 3.4, 3.2, B);
  }
  if (parts.queue === "touffue") { S.capsule(44, cy + 11, 51, cy + 5, 2.3, B); S.ellipse(54.5, cy + .5, 5.2, 5.0, P.tuft); }
  else if (parts.queue === "lezard") { S.capsule(44, cy + 10, 51, cy + 9, 2.8, B); S.capsule(51, cy + 9, 56, cy + 5, 2.0, B); S.capsule(56, cy + 5, 58.5, cy + .5, 1.2, B); }
  if (legs === "longues") {
    for (const lx of [26.5, 37.5]) S.capsule(lx, cy + 10, lx, cy + 19, 3.1, B);
    for (const fx of [25.5, 38.5]) S.ellipse(fx, 60, 4.6, 2.3, B);
  } else if (legs === "palmees") {
    for (const lx of [26.5, 37.5]) S.capsule(lx, cy + 11, lx, cy + 15, 2.8, B);
    for (const fx of [24.5, 39.5]) { S.ellipse(fx, 60, 6.2, 2.5, WEB); S.px(Math.floor(fx - 2), 60, WEB.s2); S.px(Math.floor(fx + 2), 60, WEB.s2); }
  } else for (const fx of [25.5, 38.5]) S.ellipse(fx, 58.5, 4.4, 3.0, B);
  S.ellipse(32, cy, 15.5, 13.5, B);
  S.draw((x, y) => ((x - 32) / 9.5) ** 2 + ((y - (cy + 6)) / 6.8) ** 2 <= 1, (x, y) => S.nrm((x - 32) / 15.5, (y - cy) / 13.5), P.belly, false, true);
  if (parts.dos === "fourrure") for (const [fx, fy] of [[24, cy - 8], [31, cy - 10], [38, cy - 8], [20, cy - 3], [44, cy - 3]]) { S.px(fx, fy, B.s1); S.px(fx + 1, fy + 1, B.s1); S.px(fx + 2, fy, B.s1); }
  if (parts.bras === "pinces") for (const f of [id, mir]) {
    S.capsule(f(17), cy + 4, f(13), cy + 3.5, 2.1, CLAW); S.capsule(f(9), cy + .5, f(5), cy - 2, 1.9, CLAW);
    S.capsule(f(9), cy + 6, f(5.5), cy + 6.5, 1.6, CLAW); S.ellipse(f(10.5), cy + 3.2, 4.4, 3.9, CLAW);
  } else if (parts.bras === "bras") { S.ellipse(16.5, cy + 4, 3.6, 4.6, B); S.ellipse(47.5, cy + 4, 3.6, 4.6, B); }
  if (parts.tete === "antennes") for (const f of [id, mir]) {
    S.capsule(f(27.5), cy - 11.5, f(25), cy - 18, 1.05, P.stalk); S.capsule(f(25), cy - 18, f(22.5), cy - 21.5, 1.05, P.stalk); S.ellipse(f(21.5), cy - 23.5, 3.4, 3.3, GOLD);
  } else if (parts.tete === "cornes") for (const f of [id, mir]) {
    S.capsule(f(23.5), cy - 9.5, f(20.5), cy - 15, 2.5, IVORY); S.capsule(f(20.5), cy - 15, f(19.5), cy - 19.5, 1.7, IVORY); S.capsule(f(19.5), cy - 19.5, f(20.5), cy - 22.5, 1.0, IVORY);
  }
  // visage
  const EYE = "#1b2230", ey = cy - 1.5, my = cy + 5, mc = B.od, [lx, ly] = b.look || [0, 0], EXS = [26.5, 37.5];
  const eyeOpen = (ex, big) => {
    const X = ex + lx * 1.3, Y = ey + ly * 1.3; S.blob(X, Y, big ? 3.1 : 2.7, big ? 4.3 : 3.7, EYE);
    const h0 = Math.floor(X - 1.5), v0 = Math.floor(Y - 2.5);
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([dx, dy]) => S.px(h0 + dx, v0 + dy, "#ffffff")); S.px(h0 + 2, v0 + 4, "#9fb3c8");
  };
  const arc = (ex, up) => { for (let t = -1; t <= 1.0001; t += .08) { const x = Math.floor(ex + t * 2.9), y = Math.floor(up ? ey + 1 - (1 - t * t) * 2.2 : ey - 1 + (1 - t * t) * 1.9); S.px(x, y, EYE); S.px(x, y + 1, EYE); } };
  const xeye = ex => { S.line(ex - 2.4, ey - 2.4, ex + 2.4, ey + 2.4, EYE); S.line(ex - 2.4, ey + 2.4, ex + 2.4, ey - 2.4, EYE); };
  const drop = (x, y) => { S.ellipse(x, y, 2.4, 3.2, SWEAT); S.px(Math.floor(x - 1), Math.floor(y - 1.5), "#ffffff"); S.px(Math.floor(x - 1), Math.floor(y - .5), "#ffffff"); };
  const star = (x, y) => { S.px(x, y, GOLD.hi); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) S.px(x + dx, y + dy, GOLD.base); for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0], [0, 3], [0, -3]]) S.px(x + dx, y + dy, GOLD.s1); };
  let mouth = "parts";
  const coverEye = (e, amount, brow) => {
    const X = e + lx * 1.3, Y = ey + ly * 1.3, edge = Y - 3.7 + amount * 7.4;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (((x + .5 - X) / 2.9) ** 2 + ((y + .5 - Y) / 3.9) ** 2 <= 1 && y + .5 < edge) S.px(x, y, y + .5 > edge - 1.1 ? B.od : B.base);
    if (brow) { const s = e < 32 ? 1 : -1; S.line(X - s * 3.2, Y - 4.4, X + s * 2, Y - 3.4, B.od, 1.5); }
  };
  if (state === "forme" && b.mood) {
    const m = b.mood;
    if (m === "guilleret") { EXS.forEach(e => eyeOpen(e, true)); EXS.forEach(e => S.px(Math.floor(e + lx * 1.3 + 1), Math.floor(ey + ly * 1.3 + 1.6), "#ffffff")); mouth = "open"; }
    else if (m === "ronchon") { EXS.forEach(e => { eyeOpen(e); coverEye(e, .42, true); }); mouth = "frown"; }
    else if (m === "vaseux") { EXS.forEach(e => { eyeOpen(e); coverEye(e, .58, false); for (let t = -1; t <= 1.0001; t += .1) S.px(Math.floor(e + t * 2.4), Math.floor(ey + 4.6 + (1 - t * t) * .8), B.s2); }); mouth = "small"; }
    else if (m === "stresse") { EXS.forEach(e => { S.blob(e, ey, 3.3, 3.7, B.od); S.blob(e, ey, 2.4, 2.8, "#ffffff"); S.blob(e + lx * .8, ey + ly * .8, 1, 1, EYE); }); mouth = "wavy"; }
    else if (m === "lune") { EXS.forEach(e => { S.blob(e, ey - .3, 2.7, 3.7, EYE); S.px(Math.floor(e - 1.2), Math.floor(ey - 3.2), "#ffffff"); S.px(Math.floor(e - .2), Math.floor(ey - 3.2), "#ffffff"); S.px(Math.floor(e + .8), Math.floor(ey - 1.8), GOLD.light); }); mouth = "o"; }
  } else if (state === "forme" || state === "ooh") { EXS.forEach(e => eyeOpen(e, state === "ooh")); if (state === "ooh") mouth = "open"; }
  else if (state === "panique") { S.line(24.5, ey - 2.8, 28.1, ey, EYE, 1.6); S.line(28.1, ey, 24.5, ey + 2.8, EYE, 1.6); S.line(39.5, ey - 2.8, 35.9, ey, EYE, 1.6); S.line(35.9, ey, 39.5, ey + 2.8, EYE, 1.6); mouth = "open"; }
  else if (state === "panique2") { EXS.forEach(e => S.line(e - 2.6, ey, e + 2.6, ey, EYE, 2)); mouth = "open"; }
  else if (state.startsWith("etourdi") || sick) { EXS.forEach(xeye); mouth = "wavy"; }
  else if (state === "content" || state === "rire") { EXS.forEach(e => arc(e, true)); if (state === "rire") mouth = "open"; }
  else if (state === "dort" || state === "baille") { EXS.forEach(e => arc(e, false)); mouth = state === "baille" ? "yawn" : "small"; }
  else if (state === "remue") { eyeOpen(EXS[0]); arc(EXS[1], false); mouth = "small"; }
  else if (state === "fache") { EXS.forEach(e => eyeOpen(e)); mouth = "frown"; }
  const blush = state === "content" || state === "rire" ? 3.4 : 2.9;
  for (const cx of [21.5, 42.5]) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const d = ((x + .5 - cx) / blush) ** 2 + ((y + .5 - (cy + 4.5)) / 1.6) ** 2;
    if (d <= 1) S.px(x, y, d > .45 ? "#ff9fb8" : "#ffb9ca", true);
  }
  if (mouth === "open" || mouth === "yawn") { S.blob(32, my + 1.5, 3.2, mouth === "yawn" ? 3.4 : 2.4, mc); S.blob(32, my + (mouth === "yawn" ? 3.4 : 2.6), 2.2, 1.3, "#ff7fa0"); }
  else if (mouth === "wavy") for (let x = 28; x <= 36; x++) S.px(x, my + (x % 2), mc);
  else if (mouth === "small") { S.px(31, my + 1, mc); S.px(32, my + 1, mc); }
  else if (mouth === "o") S.blob(32, my + 1.5, 1.8, 2, mc);
  else if (mouth === "frown") for (const [x, y] of [[29, my + 2], [30, my + 1], [31, my + 1], [32, my + 1], [33, my + 1], [34, my + 2]]) S.px(x, y, mc);
  else if (parts.bouche === "crocs") {
    for (let x = 27; x < 38; x++) S.px(x, my + (x >= 29 && x <= 34 ? 1 : 0), mc);
    for (const f0 of [29, 34]) { S.px(f0, my + 2, "#ffffff"); S.px(f0 + (f0 === 29 ? 1 : -1), my + 2, "#ffffff"); S.px(f0, my + 3, "#ffffff"); S.px(f0, my + 4, mc); }
  } else if (parts.bouche === "langue") { S.blob(32, my + 1.5, 3.4, 2.4, mc); S.blob(32, my + 2.6, 2.3, 1.4, "#ff7fa0"); S.px(31, my + 2, "#ffb3c6"); }
  else { for (const [x, y] of [[29, my], [30, my + 1], [31, my + 1], [32, my + 1], [33, my + 1], [34, my]]) S.px(x, y, mc); S.px(31, my + 2, "#ff7fa0"); S.px(32, my + 2, "#ff7fa0"); }
  if (acc.tete === "bonnet") {
    S.ellipse(32, cy - 8.5, 12.5, 8.5, RED, {clip:(x, y) => y <= cy - 7.5});
    S.capsule(20.5, cy - 7.5, 43.5, cy - 7.5, 2.3, WOOL); S.ellipse(32, cy - 17.5, 3.2, 3.1, WOOL);
  }
  if (state === "fache") {
    S.line(23, ey - 4.8, 28.6, ey - 3.2, EYE, 1.7); S.line(41, ey - 4.8, 35.4, ey - 3.2, EYE, 1.7);
    for (const f of [id, mir]) { S.ellipse(f(11), cy - 12, 3.4, 2.9, WOOL); S.ellipse(f(7.5), cy - 16.5, 2.6, 2.3, WOOL); S.ellipse(f(10), cy - 20, 1.8, 1.6, WOOL); }
  }
  if (state === "forme" && b.mood === "stresse") drop(49, cy - 9);
  if (state === "forme" && b.mood === "vaseux") S.blob(35.5, my + 3, 1, 1.5, "#cfeaff");
  if (state === "forme" && b.mood === "lune") { star(48, cy - 15); star(15, cy - 18); }
  if (state === "panique") { drop(50, cy - 10); drop(13.5, cy - 12); }
  if (state === "panique2") { drop(52, cy - 6); drop(12, cy - 8); }
  if (state === "nausee") { drop(50, cy - 9); drop(14, cy - 5); }
  if (state === "nausee2") { drop(52, cy - 4); drop(12, cy - 10); }
  if (state === "etourdi") [[17, cy - 19], [46, cy - 21], [32, cy - 26]].forEach(([x, y]) => star(x, y));
  if (state === "etourdi2") [[22, cy - 24], [45, cy - 15], [13, cy - 14]].forEach(([x, y]) => star(x, y));
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 64;
  const g = cv.getContext("2d"), im = g.createImageData(64, 64);
  S.c.forEach((col, i) => { if (col) im.data.set(col, i * 4); });
  g.putImageData(im, 0, 0);
  return cv.toDataURL();
}

// --- Pistes "blob" : corps gélatineux sans parties, regards un peu bêtes ---
const BLOB_BALLS = [[32, 46, 15.5, 14, 1], [32, 57, 19, 4.5, .8]];
const BLOB_STYLES = {
  louche:{balls:BLOB_BALLS, gloss:[21.5, 37], eyes:[[25.5, 43.5, 4.8, 27.6, 44.5, 1.8], [38.5, 43.5, 4.8, 36.4, 44.5, 1.8]], cheeks:[50, [20.5, 43.5]], mouth:"dent", my:53},
  depareille:{balls:BLOB_BALLS, gloss:[21.5, 37], eyes:[[24.5, 42.5, 5.4, 23, 40.8, 1.9], [39, 45, 3.6, 40.2, 46.3, 1.4]], cheeks:[50.5, [19, 45]], mouth:"langue", my:52},
  paupieres:{balls:BLOB_BALLS, gloss:[21.5, 37], eyes:[[26, 44, 4.4, 26.3, 46, 1.6, .45], [38, 44, 4.4, 38.3, 46, 1.6, .45]], cheeks:[50.5, [21.5, 42.5]], mouth:"bave", my:53.5},
  dessus:{balls:[[32, 47, 15.5, 13, 1], [32, 57, 19, 4.5, .8], [25, 34, 4.6, 4.6, .55], [39, 34, 4.6, 4.6, .55]], gloss:[20.5, 41],
          eyes:[[25, 33.5, 4.2, 24.2, 32.3, 1.6], [39, 33.5, 4.2, 40.4, 34.2, 1.6]], cheeks:[47.5, [20.5, 43.5]], mouth:"sourire", my:47}
};
function blobFace64(style, state = "forme", look = [0, 0], pal = "menthe", partsArg = {}, mood = null) {
  const st = BLOB_STYLES[style], sick = state.startsWith("nausee"), P = moodPalette(PAL64[sick ? "malade" : pal], sick ? null : mood), B = P.body, S = mkSprite(), U = mkSprite();
  const parts = partsArg || {}, EYE = "#1b2230", od = B.od, [lx, ly] = look || [0, 0], id = v => v, mir = v => 64 - v;
  const top = style === "dessus" ? 30 : 33;
  // derrière le corps
  if (parts.dos === "ailes") for (const [f, sd] of [[id, 1], [mir, -1]]) {
    S.rellipse(f(11), 38, 10, 5.2, sd * -32 * Math.PI / 180, WING); S.rellipse(f(9.5), 44.5, 7.5, 3.6, sd * -12 * Math.PI / 180, WING);
  }
  if (parts.dos === "fourrure") for (let deg = -176; deg <= -4; deg += 17) { const a = deg * Math.PI / 180; S.ellipse(32 + 14.2 * Math.cos(a), 46 + 12.8 * Math.sin(a), 3.4, 3.2, B); }
  if (parts.queue === "touffue") { S.capsule(45, 55, 51, 49, 2.2, B); S.ellipse(54, 45, 4.8, 4.6, P.tuft); }
  else if (parts.queue === "lezard") { S.capsule(45, 54, 51, 53, 2.8, B); S.capsule(51, 53, 56, 49, 2.0, B); S.capsule(56, 49, 58.5, 44.5, 1.2, B); }
  if (parts.pattes === "palmees") for (const fx of [24.5, 39.5]) { S.ellipse(fx, 60, 6.2, 2.5, WEB); S.px(Math.floor(fx - 2), 60, WEB.s2); S.px(Math.floor(fx + 2), 60, WEB.s2); }
  // corps gélatineux
  const balls = st.balls.concat(parts.bras === "bras" ? [[15.5, 50, 3.4, 4.2, .6], [48.5, 50, 3.4, 4.2, .6]] : []);
  const F = (x, y) => balls.reduce((a, [cx, cy, rx, ry, w]) => a + w / (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + 1e-6), 0);
  S.draw((x, y) => F(x, y) >= 1 && y < 60, (x, y) => {
    const e = .5, gx = (F(x + e, y) - F(x - e, y)) / (2 * e), gy = (F(x, y + e) - F(x, y - e)) / (2 * e), g = Math.hypot(gx, gy) || 1;
    const t = Math.max(0, Math.min(1, 1 - (F(x, y) - 1) / 1.4));
    return S.nrm(-gx / g * t * .95, -gy / g * t * .95);
  }, B);
  S.blob(st.gloss[0], st.gloss[1], 3, 1.8, "#ffffff", true); S.blob(st.gloss[0] - 3.3, st.gloss[1] + 3.2, 1, 1, "#ffffff", true);
  // devant le corps
  if (parts.bras === "pinces") for (const f of [id, mir]) {
    S.capsule(f(17), 50, f(13), 49.5, 2.1, CLAW); S.capsule(f(9), 46.5, f(5), 44, 1.9, CLAW); S.capsule(f(9), 52, f(5.5), 52.5, 1.6, CLAW); S.ellipse(f(10.5), 49.2, 4.4, 3.9, CLAW);
  }
  if (parts.tete === "antennes") for (const f of [id, mir]) {
    S.capsule(f(27.5), top, f(25), top - 6.5, 1.05, P.stalk); S.capsule(f(25), top - 6.5, f(22.5), top - 10, 1.05, P.stalk); S.ellipse(f(21.5), top - 12, 3.4, 3.3, GOLD);
  } else if (parts.tete === "cornes") for (const f of [id, mir]) {
    S.capsule(f(24.5), top + 2, f(21.5), top - 3.5, 2.5, IVORY); S.capsule(f(21.5), top - 3.5, f(20.5), top - 8, 1.7, IVORY); S.capsule(f(20.5), top - 8, f(21.5), top - 11, 1.0, IVORY);
  }
  const disc = (cx, cy, r, fn) => { for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (Math.hypot(x + .5 - cx, y + .5 - cy) <= r) fn(x, y); };
  const sclera = (cx, cy, r) => { S.blob(cx, cy, r, r, od); disc(cx, cy, r - 1, (x, y) => S.px(x, y, y + .5 > cy + r * .4 ? "#dbe4ec" : "#ffffff")); };
  const pupil = (x, y, r) => { S.blob(x, y, r, r, EYE); S.px(Math.floor(x - r * .5), Math.floor(y - r * .5), "#ffffff"); };
  const lid = (cx, cy, r, amount) => {
    const edge = cy - r + amount * 2 * r;
    disc(cx, cy, r - .5, (x, y) => { if (y + .5 < edge) S.px(x, y, y + .5 > edge - 1.2 ? od : (y + .5 < cy - r * .5 ? B.light : B.base)); });
  };
  const shut = (cx, cy, r, happy) => {
    S.blob(cx, cy, r, r, od); disc(cx, cy, r - 1, (x, y) => S.px(x, y, y + .5 < cy - r * .4 ? B.light : B.base));
    for (let t = -1; t <= 1.0001; t += .06) { const x = Math.floor(cx + t * (r - 1.2)), y = Math.floor(happy ? cy + .8 - (1 - t * t) * r * .5 : cy - .6 + (1 - t * t) * r * .4); S.px(x, y, od); S.px(x, y + 1, od); }
  };
  const E = st.eyes, open = (mul = 1, pupilFn = null) => E.forEach(([cx, cy, r, px, py, pr, lidA], i) => {
    sclera(cx, cy, r * mul);
    const [qx, qy, qr] = pupilFn ? pupilFn(cx, cy, r, px, py, pr, i) : [px + lx * 1.4, py + ly * 1.4, pr];
    pupil(qx, qy, qr); if (lidA && !pupilFn) lid(cx, cy, r, lidA);
  });
  let mouth = st.mouth;
  if (state === "forme" && mood) {
    if (mood === "guilleret") { open(1.08, (cx, cy, r, px, py, pr) => [px + lx * 1.4, py + ly * 1.4 - .5, pr * 1.25]); mouth = "sourire"; }
    else if (mood === "ronchon") { open(); E.forEach(([cx, cy, r], i) => { lid(cx, cy, r, .42); const s2 = i ? -1 : 1; S.line(cx - s2 * (r + .3), cy - r * .75, cx + s2 * r * .6, cy - r * .35, od, 1.6); }); mouth = "boude"; }
    else if (mood === "vaseux") { open(1, (cx, cy, r, px, py, pr) => [px + lx, py + r * .35, pr]); E.forEach(([cx, cy, r]) => { lid(cx, cy, r, .6); for (let t = -1; t <= 1.0001; t += .1) S.px(Math.floor(cx + t * r * .8), Math.floor(cy + r + .6), B.s2); }); mouth = "bave"; }
    else if (mood === "stresse") { open(1.15, (cx, cy) => [cx + lx * .8, cy + ly * .8, .8]); mouth = "vague"; }
    else if (mood === "lune") { open(1, (cx, cy, r, px, py, pr) => [cx + lx * .8, cy - r * .45, pr]); mouth = "o"; }
  } else if (state === "forme") open();
  else if (state === "ooh") { open(1.12, (cx, cy, r, px, py, pr) => [cx, cy, pr * .8]); mouth = "o"; }
  else if (state === "panique") { open(1.1, (cx, cy) => [cx, cy, .9]); mouth = "ouvert"; }
  else if (state === "panique2") { open(1.1, (cx, cy, r, px, py, pr, i) => [cx + (i ? 1 : -1), cy - 1, .9]); mouth = "ouvert"; }
  else if (state.startsWith("etourdi") || sick) {
    const flip = state.endsWith("2") ? -1 : 1;
    open(1, (cx, cy, r, px, py, pr, i) => [cx + (i ? 1 : -1) * flip * r * .45, cy + (i ? 1 : -1) * flip * r * .35, pr]); mouth = "vague";
  }
  else if (state === "content" || state === "rire") { E.forEach(([cx, cy, r]) => shut(cx, cy, r, true)); if (state === "rire") mouth = "ouvert"; }
  else if (state === "dort" || state === "baille") { E.forEach(([cx, cy, r]) => shut(cx, cy, r, false)); mouth = state === "baille" ? "baille" : "petit"; }
  else if (state === "remue") { const [a, b] = E; sclera(a[0], a[1], a[2]); pupil(a[3], a[4], a[5]); lid(a[0], a[1], a[2], .5); shut(b[0], b[1], b[2], false); mouth = "petit"; }
  else if (state === "fache") {
    open();
    E.forEach(([cx, cy, r], i) => {
      const s = i ? -1 : 1, x0 = cx - s * (r + .5), x1 = cx + s * r * .7;
      disc(cx, cy, r - .5, (x, y) => { const t = (x + .5 - x0) / (x1 - x0), yl = (cy - r * 1.05) + t * r * .9; if (t >= 0 && t <= 1.2 && y + .5 < yl) S.px(x, y, B.base); });
      S.line(x0, cy - r * 1.05, x1, cy - r * .15, od, 1.8);
    });
    mouth = "boude";
  }
  if (mouth === st.mouth && parts.bouche) mouth = parts.bouche === "crocs" ? "crocs" : "gourmand";
  const [chy, chx] = st.cheeks;
  for (const cx of chx) disc(cx, chy, 3.2, (x, y) => { const d = ((x + .5 - cx) / 3) ** 2 + ((y + .5 - chy) / 1.6) ** 2; if (d <= 1) S.px(x, y, d > .45 ? "#ff9fb8" : "#ffb9ca", true); });
  const my = st.my;
  if (mouth === "dent") { S.blob(32, my, 2.8, 2.2, od); for (const [x, y] of [[31, my - 2], [32, my - 2], [31, my - 1], [32, my - 1]]) S.px(x, y, "#ffffff"); }
  else if (mouth === "langue") { for (let x = 27; x <= 37; x++) S.px(x, my - 1 + (x > 28 && x < 36 ? 1 : 0), od); S.blob(34.5, my + 2, 2, 2.4, "#ff7fa0"); S.px(34, my + 1, "#ffb3c6"); }
  else if (mouth === "bave") { S.blob(32, my, 3.4, 3, od); S.blob(32, my + 1.5, 2.3, 1.4, "#ff7fa0"); S.blob(36.3, my + 3.5, 1.1, 1.6, "#cfeaff"); }
  else if (mouth === "sourire") { for (let t = -1; t <= 1.0001; t += .05) S.px(Math.floor(32 + t * 7.5), Math.floor(my + (1 - t * t) * 3.5), od); for (let x = 27; x <= 37; x++) S.px(x, my + 1, x % 3 ? "#ffffff" : "#dbe4ec"); }
  else if (mouth === "crocs") {
    const m = Math.floor(my); for (let x = 27; x < 38; x++) S.px(x, m - 1 + (x >= 29 && x <= 34 ? 1 : 0), od);
    for (const f0 of [29, 34]) { S.px(f0, m + 1, "#ffffff"); S.px(f0 + (f0 === 29 ? 1 : -1), m + 1, "#ffffff"); S.px(f0, m + 2, "#ffffff"); S.px(f0, m + 3, od); }
  }
  else if (mouth === "gourmand") { S.blob(32, my, 3.4, 2.4, od); S.blob(32, my + 1.4, 2.3, 1.4, "#ff7fa0"); S.blob(33.5, my + 3, 1.6, 1.8, "#ff7fa0"); }
  else if (mouth === "o") S.blob(32, my, 2.4, 2.6, od);
  else if (mouth === "ouvert" || mouth === "baille") { S.blob(32, my, 3.3, mouth === "baille" ? 3.6 : 2.6, od); S.blob(32, my + (mouth === "baille" ? 2 : 1.2), 2.2, 1.3, "#ff7fa0"); }
  else if (mouth === "vague") for (let x = 28; x <= 36; x++) S.px(x, Math.floor(my) + (x % 2), od);
  else if (mouth === "petit") { S.px(31, Math.floor(my), od); S.px(32, Math.floor(my), od); }
  else if (mouth === "boude") for (const [x, y] of [[29, 1], [30, 0], [31, 0], [32, 0], [33, 0], [34, 1]]) S.px(x, Math.floor(my) + y, od);
  const drop = (x, y) => { S.ellipse(x, y, 2.4, 3.2, SWEAT); S.px(Math.floor(x - 1), Math.floor(y - 1.5), "#ffffff"); };
  const star = (x, y) => { S.px(x, y, GOLD.hi); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) S.px(x + dx, y + dy, GOLD.base); for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0], [0, 3], [0, -3]]) S.px(x + dx, y + dy, GOLD.s1); };
  if (state === "forme" && mood === "stresse") drop(50, 35);
  if (state === "forme" && mood === "lune") { star(48, 27); star(16, 24); }
  if (state === "panique" || state === "nausee") { drop(50, 35); drop(13.5, 38); }
  if (state === "panique2" || state === "nausee2") { drop(52, 40); drop(12, 34); }
  if (state === "etourdi") [[17, 24], [46, 22], [32, 18]].forEach(([x, y]) => star(x, y));
  if (state === "etourdi2") [[22, 19], [45, 27], [13, 28]].forEach(([x, y]) => star(x, y));
  if (state === "fache") for (const f of [id, mir]) { S.ellipse(f(12), 30, 3.4, 2.9, WOOL); S.ellipse(f(8.5), 26, 2.6, 2.3, WOOL); S.ellipse(f(11), 22.5, 1.8, 1.6, WOOL); }
  // longues pattes : le blob est soulevé, les pattes passent dessous
  if (parts.pattes === "longues") {
    const shifted = new Array(64 * 64).fill(null);
    for (let i = 7 * 64; i < 64 * 64; i++) shifted[i - 7 * 64] = S.c[i];
    S.c.splice(0, S.c.length, ...shifted);
    for (const lx2 of [26.5, 37.5]) U.capsule(lx2, 48, lx2, 58, 3.1, B);
    for (const fx of [25.5, 38.5]) U.ellipse(fx, 60, 4.6, 2.3, B);
  }
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (!U.get(x, y) && ((x + .5 - 32) / 18) ** 2 + ((y + .5 - 61.5) / 1.8) ** 2 <= 1) U.put(x, y, [29, 43, 34, 55]);
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 64;
  const g = cv.getContext("2d"), im = g.createImageData(64, 64);
  S.c.forEach((col, i) => { const c = col || U.c[i]; if (c) im.data.set(c, i * 4); });
  U.c.forEach((col, i) => { if (col && !S.c[i]) im.data.set(col, i * 4); });
  g.putImageData(im, 0, 0);
  return cv.toDataURL();
}
