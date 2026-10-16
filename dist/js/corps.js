// Le corps : position, mode (setMode), réactions, plafond, murs, atterrissage, et la boucle d'animation (tick).
const SLEEP_AFTER = 40000, PET_BOOST = 5, AUTO_WAKE = 180000, GENTLE = 300;
img.src = FR.normal;
const HEART = (() => {
  const rows = [".kk.kk.", "kppkppk", "kpppppk", ".kpppk.", "..kpk..", "...k..."];
  const c = document.createElement("canvas"); c.width = 7; c.height = 6; const g = c.getContext("2d");
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") { g.fillStyle = COL[ch]; g.fillRect(i, j, 1, 1); } }));
  return c.toDataURL();
})();
const win = T.window.getCurrentWindow();
const WW = 176, WH = 176;
const REACT = new Set(["pet", "laugh", "angry", "sulk", "eat", "ooh"]);
let scale = 2, watching = false, lookKey = "", cursor = null;
let x = 600, y = 200, minX = 0, maxX = 1200, minY = 0, floorY = 700;
// Le mode ne change que par setMode : ceux qui doivent réagir à un changement s'y abonnent avec quandMode.
const modeSuivi = [];
function setMode(m) { const avant = mode; mode = m; if (m !== avant) for (const f of modeSuivi) f(m, avant); }
const quandMode = f => modeSuivi.push(f);
let mode = "fly", dir = 1, vx = 0, vy = 0, angle = 0, spin = 0, idleUntil = 0, dizzyUntil = 0, bounces = 0, maxImpact = 0, ticks = 0;
let calm = 0, wake = 0, sleepSince = 0, nextZ = 0, stirred = false;
let reactUntil = 0, nextFx = 0, nausea = false, nextDrop = 0, clicks = [], pet = {dir:0, flips:[], last:null};
let drag = null, samples = [], flap = null;
function face() { img.style.setProperty("--sx", dir < 0 ? -1 : 1); img.style.scale = dir < 0 ? "-1 1" : "1 1"; }
function pose(c) { img.className = c; }
function squash(c = "land") { pose(c); setTimeout(() => { if (img.className === c) pose(mode === "walk" ? "walk" : mode === "nausea" ? "woozy" : ""); }, 300); }
const CANDY_SAYS = {"Grrr !":"Hmpf !", "Hi hi !":"Hihi !", "Beurk...":"Bleh...", "Miam !":"Miam miam !", "Ouaaah !":"Kyaaah !", "Hein ?!":"Hiii ?!",
  "Hé !":"Eh oh !", "Laisse-moi...":"Je boude...", "Youpi !":"Youpiii !", "Burp !":"Hips !"};
function bubble(text, ms = 1200) { if (style === "candy") text = CANDY_SAYS[text] || text; const b = document.createElement("div"); b.className = "bub"; b.textContent = text; fx.appendChild(b); setTimeout(() => b.remove(), ms); }
function heart() {
  const h = document.createElement("img"); h.src = HEART; h.className = "heart"; h.style.left = (62 + Math.random() * 40) + "px"; fx.appendChild(h);
  h.animate([{transform:"translate(0,0)", opacity:1}, {transform:`translate(${(Math.random() - .5) * 40}px,-54px)`, opacity:0}], {duration:1000, easing:"ease-out"}).finished.then(() => h.remove());
}
function drop() {
  const d = document.createElement("div"); d.className = "drop"; d.style.left = (80 + Math.random() * 16) + "px"; d.style.top = (112 + Math.random() * 20) + "px"; fx.appendChild(d);
  const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 40;
  d.animate([{transform:"translate(0,0)", opacity:1}, {transform:`translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px)`, opacity:0}], {duration:600, easing:"ease-out"}).finished.then(() => d.remove());
}
function zz() {
  const z = document.createElement("div"); z.className = "zz"; z.textContent = Math.random() < .5 ? "z" : "Z"; fx.appendChild(z);
  z.animate([{transform:"translate(0,0) scale(.7)", opacity:0}, {opacity:1, offset:.2}, {transform:`translate(${14 + Math.random() * 16}px,-58px) scale(1.2)`, opacity:0}], {duration:1800, easing:"ease-out"}).finished.then(() => z.remove());
}
function disturb() { calm = 0; }
let drowsyEnd = false;
function fallAsleep() { setMode("sleep"); img.src = FR.dort; pose("breathe"); sleepSince = Date.now(); wake = 0; stirred = false; say("il s'endort"); }
function wakeUp(why) {
  setMode("waking"); reactUntil = Date.now() + (isSheet() && tagDur("baille") || 1100); img.src = FR.baille; pose(isSheet() ? "" : "shake"); wake = 0; calm = 0;
  if (isSheet()) playOnce("baille");          // dessiné : il se réveille avec son bâillement, une fois, sans tremblement
  bubble(why === "seul" ? "*s'étire*" : why === "fini" ? "À toi !" : why === "attend" ? waitTxt() : "Hein ?", why === "fini" || why === "attend" ? 1800 : 1000); say(`il se reveille (${why})`);
}
function react(m, ms, frame, cls = "") { setMode(m); reactUntil = Date.now() + ms; img.src = frame; pose(cls); img.style.rotate = "0deg"; watching = false; lookKey = ""; }
function toWalk() { setMode("walk"); img.src = FR.normal; pose("walk"); }
async function bounds(m) {
  m = m || await T.window.currentMonitor(); if (!m) return;
  const s = m.scaleFactor; scale = s; const a = m.workArea || {position:m.position, size:m.size};
  minX = a.position.x / s; maxX = (a.position.x + a.size.width) / s - WW;
  minY = a.position.y / s; floorY = (a.position.y + a.size.height) / s - WH;
}
// Clic droit > Écran : il arrive au milieu de l'écran choisi par une petite chute (pas d'écrasement)
async function toScreen(m) {
  if (drag || pull.on) return;
  if (mode === "wall" && wallStick) wallShape(false);
  corner = null; ceilSw = null; unceil(false);
  await bounds(m);
  x = (minX + maxX) / 2; setMode("fly"); vx = 0; vy = 1; angle = 0; spin = 0; bounces = 0; img.style.rotate = "0deg"; img.style.translate = "";
  y = floorY - 160; peakY = y; fall = null; push(); say("change d'ecran : " + m.name);
  if (isSheet()) sheetAnim(Date.now());
}
// Marge transparente au-dessus du Bidule dans sa fenêtre : l'image (128 px) est en bas de la fenêtre (176 px), et son dessin
// commence à sa première ligne visible. Gardée par image, pour ne pas relire les pixels à chaque instant.
const TOPS = new Map();
function headroom() {
  let t = TOPS.get(img.src);
  if (t === undefined) { t = spriteTop().y; if (img.complete) TOPS.set(img.src, t); }
  return WH - 128 + 2 * t;
}
// Lancé assez fort vers le haut, il se colle au haut de l'écran, à l'envers (l'image retournée de haut en bas autour de 60 % de sa hauteur),
// et y rampe comme au sol, 6 à 14 s, puis se décolle et retombe.
let ceilingUntil = 0, ceilingEdge = 0, ceilSwingAt = 0, ceilSw = null;          // ceilingEdge : le bord atteint, il finit son cycle de reptation avant le demi-tour
const ceilingY = () => minY - (WH - 128 + 2 * (76.8 - 1 - SHEET_DATA[style].tags.crawl[0].bot));          // ses pieds (la ligne du sol) touchent le haut de l'écran
function cling() {
  setMode("ceiling"); vx = vy = 0; angle = 0; img.style.rotate = "0deg"; img.style.translate = ""; pose("");
  if (Math.sign(dir) === 0) dir = 1;
  img.style.scale = `${dir < 0 ? -1 : 1} -1`; ceilingUntil = Date.now() + 6000 + Math.random() * 8000;
  ceilingEdge = 0; y = ceilingY(); say("colle au haut de l'ecran, a l'envers");
  ceilSwingAt = Math.random() < .6 ? Date.now() + 2000 + Math.random() * 3000 : 0;          // une fois sur deux ou presque, il se décroche pour se balancer
  // il arrive comme au sol après une chute : l'atterrissage (de face), à l'envers, puis le demi-tour vers le profil, et il rampe
  faceSeq = null; sheetLoop = {tag:null, i:0, next:0}; playOnce("atterrissage");
}
// Arrivé au bord de l'écran en rampant au plafond : il passe sur le mur et le descend en coulant, comme après un choc contre le bord
// (coule, puis coule-fin au sol), sans l'écrasement du choc.
function ceilingToWall(side) {
  const T2 = SHEET_DATA[style].tags;
  dir = side; face();          // sans unceil : le dessin garde son décalage sous la barre de menus, sinon il saute vers le bas le temps que la fenêtre bouge
  if (!T2.coule) { unceil(true); return; }
  // le coin du haut : coule-fin (du mur au sol) à l'envers et retourné de haut en bas, du plafond vers le mur ; la fenêtre glisse vers le bord au début
  // d'abord le demi-tour (de profil jusqu'à la face), retourné lui aussi, puis le coin
  const half = HALF || [], fin = T2["coule-fin"] ? T2["coule-fin"].slice(7).reverse() : [];
  corner = {seq:[...half, ...fin], half:half.length, i:0, next:sheetLoop.next, t0:0, side};          // la dernière image de la reptation garde sa durée          // sans ses 7 premières images (la goutte en bas du mur) : la glissade prend le relais sur l'image la plus étirée
  setMode("corner"); pose(""); vx = vy = 0; peakY = null; fall = null; watching = false; lookKey = "";
  img.style.scale = `${side < 0 ? -1 : 1} -1`;
  say("arrive au bord en haut : il passe le coin");
}
let corner = null;
function cornerStep(now) {          // une image du coin à chaque fois ; à la fin, il est sur le mur et coule par à-coups, comme une goutte
  const c = corner, T2 = SHEET_DATA[style].tags;
  if (c.i < c.seq.length && now >= c.next) { img.src = c.seq[c.i].src; c.next = (c.next || now) + c.seq[c.i].dur; c.i++; }
  if (!c.t0 && c.i > c.half) c.t0 = now;          // le coin commence après le demi-tour
  const p = c.t0 ? Math.min(1, (now - c.t0) / WALL_SLIDE) : 0;          // comme coule-fin à l'envers : la fenêtre passe de l'écran au bord pendant les premières images du coin
  x = c.side < 0 ? minX - WALL_OVER * p : maxX + WALL_OVER * p; y = ceilingY();
  if (c.i >= c.seq.length && now >= c.next) {
    corner = null; face(); setMode("wall"); wallSide = c.side; vx = vy = 0; wallV = 0; wallStick = now + 300; wallRun = 0;
    img.src = T2.coule[0].src; y = minY - headroom();
    say("passe le coin : il descend le long du mur");
  }
}
// Au plafond, de temps en temps : il se tourne de face, se décroche vers le bas en goutte au bout d'un fil et se balance (decolle-pendule, puis
// quelques boucles de pendule-plafond), puis remonte (le début de decolle-pendule à l'envers) et reprend sa marche. Les images sont rangées
// retournées dans la feuille : avec le retournement du plafond, on les voit comme dessinées.
function ceilSwingStart(now) {
  const T2 = SHEET_DATA[style].tags, loop = T2["pendule-plafond"], n = 2 + Math.floor(Math.random() * 3), seq = [...HALF, ...T2["decolle-pendule"]];
  for (let k = 0; k < n; k++) seq.push(...loop);
  seq.push(...T2["decolle-pendule"].slice(0, 9).reverse(), ...HALF.slice().reverse());
  ceilSw = {seq, i:0, next:now}; ceilSwingAt = 0; setMode("ceilswing"); say("se decroche du plafond et se balance");
}
function ceilSwingStep(now) {
  const c = ceilSw; y = ceilingY();
  if (now < c.next) return;
  if (c.i >= c.seq.length) { ceilSw = null; setMode("ceiling"); sheetLoop = {tag:null, i:0, next:0}; ceilingUntil = Math.max(ceilingUntil, now + 3000); return; }
  const f = c.seq[c.i++]; img.src = f.src; c.next = nextAt(c.next, f.dur, now);
}
function unceil(tombe) {          // il se décolle : l'image se remet à l'endroit, et s'il tombe, il tombe
  face(); faceSeq = null; document.body.style.translate = "";
  if (tombe) { setMode("fly"); vx = 0; vy = 1; y = minY - headroom(); peakY = y; fall = null; bubble("Oups !", 900); say("se decolle du haut de l'ecran"); }
}
// macOS ne laisse pas la fenêtre passer au-dessus de la barre de menus : au-delà, la fenêtre reste dessous et c'est le dessin qui monte
// dans sa fenêtre (la marge transparente au-dessus de lui). Sans ça, lancé vers le haut, il resterait figé là-haut le temps de redescendre.
function push() {
  const up = Math.max(0, Math.round(minY - y));
  return Fenetre.aller(x, y + up, () => { document.body.style.translate = up ? `0 ${-up}px` : ""; });
}
// Lancé contre le bord de l'écran, un perso dessiné s'écrase contre lui (choc-bord) puis coule le long du mur (coule) jusqu'au sol.
// La fenêtre dépasse un peu de l'écran (WALL_OVER) pour que le corps touche le bord : le dessin laisse 24 px de marge de chaque côté.
const WALL_OVER = 22, WALL_SLIDE = 380; let wallV = 0, wallSide = 1, wallEnd = 0, wallStick = 0, wallRun = 0;          // en venant du plafond : collé jusqu'à wallStick, puis il glisse d'un coup sur wallRun px (wallStick à 0 : glissade continue, après un choc)      // WALL_SLIDE : durée (ms) des dernières images de coule-fin, pendant lesquelles la fenêtre rentre
// En venant du plafond, la queue de la goutte (les lignes étroites au-dessus du corps) s'allonge vers le haut pendant la glissade (la traînée)
// et rentre dans le corps à l'arrêt net, ligne par ligne, au pixel près ; le corps et le visage ne bougent pas. wallDef : allongement de la queue
// (1 = deux fois plus longue, négatif = rentrée). L'image déformée a DEF_UP lignes de plus en haut, prises sur la marge de la fenêtre.
let wallDef = 0, wallDefV = 0;
const DEF_UP = 24, DEF_BASE = new Map(), DEF_CACHE = new Map();
function wallShape(on) {
  const base = DEF_BASE.get(img.src) || img.src, D = SHEET_DATA[style];
  const f = (D.bySrc || (D.bySrc = new Map(D.frames.map(f => [f.src, f])))).get(base);
  let n = 0, A = 0, L = 0;
  if (on && f) {
    if (!f.rows) { const px = f.cv.getContext("2d").getImageData(0, 0, 64, 64).data; f.rows = [];
      for (let Y = 0; Y < 64; Y++) { let w = 0; for (let X = 0; X < 64; X++) if (px[(Y * 64 + X) * 4 + 3]) w++; f.rows.push(w); } }
    A = f.rows.findIndex((w, Y) => Y > f.top && w >= 12); if (A < 0) A = f.top; L = A - f.top;
    n = Math.max(2 - L, Math.min(DEF_UP, Math.round(wallDef * L)));
  }
  if (!on) wallDef = wallDefV = 0;
  if (!n) { img.style.height = ""; if (img.src !== base) img.src = base; return; }
  const key = base + n;
  if (!DEF_CACHE.has(key)) {
    const cv = document.createElement("canvas"); cv.width = 64; cv.height = 64 + DEF_UP; const g = cv.getContext("2d");
    g.drawImage(f.cv, 0, A, 64, 64 - A, 0, DEF_UP + A, 64, 64 - A);          // le corps, tel quel
    for (let j = 1; j <= L + n; j++) { const src = A - Math.ceil(j * L / (L + n)); g.drawImage(f.cv, 0, src, 64, 1, 0, DEF_UP + A - j, 64, 1); }          // la queue, ligne par ligne
    const url = cv.toDataURL(); DEF_CACHE.set(key, url); DEF_BASE.set(url, base);
  }
  img.style.height = 2 * (64 + DEF_UP) + "px"; img.src = DEF_CACHE.get(key);
}
function hitWall(side) {
  const T2 = isSheet() && SHEET_DATA[style].tags;
  if (!T2 || !T2.coule || !T2["choc-bord"] || Math.abs(vx) < 4 || y > floorY - 60) return false;
  setMode("wall"); wallSide = side; dir = side; face(); pose(""); vx = vy = 0; angle = 0; spin = 0; img.style.rotate = "0deg"; wallV = .3; wallStick = 0; peakY = y; fall = null;
  x = side < 0 ? minX - WALL_OVER : maxX + WALL_OVER; watching = false; lookKey = "";
  playOnce(nausea && T2["choc-bord-vert"] ? "choc-bord-vert" : "choc-bord"); say("il percute le bord : il coule le long du mur");
  return true;
}
function land() {
  if (vx) { dir = vx < 0 ? -1 : 1; face(); }
  vx = vy = 0; angle = 0; spin = 0; img.style.rotate = "0deg"; bounces = 0;
  if (nausea) {
    setMode("nausea"); reactUntil = Date.now() + 3500; img.src = FR.n1; bubble("Beurk...", 1400); say("secoue : il a la nausee");
  } else if (isSheet() && SHEET_DATA[style].tags.ecrase && (bigFall() || crashed)) {
    if (style === "candy") bubble("Grrr !", 1400);
    setMode("splat"); reactUntil = Date.now() + tagDur("ecrase") + 1500 + Math.random() * 1500; say(`chute de haut (${Math.round(floorY - peakY)} px) : il s'ecrase`);
  } else if (maxImpact > 24 && !isSheet()) {
    setMode("dizzy"); dizzyUntil = Date.now() + 2400; img.src = FR.d1; say(`atterrissage brutal (${Math.round(maxImpact)}) : il est etourdi`);
  } else { setMode("walk"); img.src = FR.normal; say("atterrissage en douceur"); }
  playOnce(mode === "splat" ? "ecrase" : mode === "nausea" ? "atterrissage-vert" : "atterrissage"); fall = null; peakY = null; crashed = false;
  nausea = false; maxImpact = 0; if (!isSheet()) squash();
}
let lastT = performance.now();
// le clignement passe après tout le reste : une image posée pendant ce pas est remplacée tout de suite, sans flash du visage habituel
function tick() {
  // premier lancement, pas encore de Bidule choisi : il attend, immobile, à sa place de départ (en haut), comme au lancement suivant
  if (!chosen) { lastT = performance.now(); return; }
  tickBody(); if (isSheet()) blinkStep(Date.now());
  hairStep();
}
