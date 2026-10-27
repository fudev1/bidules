// Les cheveux posés sur la tête, avec leur ressort.
// Les cheveux (évolution, premier essai) : six poses dessinées (animations/cheveux/cheveux-poses.aseprite, exportées par tools/cheveux.py),
// 32 × 20, la racine au milieu du bas ; images 0 à 4 : penchés à gauche fort, à gauche, droits, à droite, à droite fort ; 5 : ébouriffés.
// Ils sont posés en direct sur l'image affichée, au sommet de la tête (juste au-dessus des yeux), sans jamais recouvrir le corps : img.src garde
// l'image de la feuille (tout le reste du code la compare), seul l'affichage reçoit l'image coiffée. Un ressort leur donne de l'inertie : quand la
// tête bouge (dans l'image, ou la fenêtre entière : marche, vol, glissade, tenu à la souris), ils restent en arrière puis la rattrapent.
const HAIR_W = 32, HAIR_H = 20, HAIR_RX = 16, HAIR_N = 6;
const hair = {px:null, a:0, v:0, pose:2, shock:0, last:null, cache:new Map()};
const IMG_SRC = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
let logicalSrc = "";
Object.defineProperty(img, "src", {get() { return logicalSrc || IMG_SRC.get.call(img); }, set(v) { logicalSrc = v; hairPaint(); }});
// une nouvelle apparence : les cheveux reprennent leurs pixels d'origine (hair.px0) aux nouvelles couleurs (hair.px), et les images coiffées sont refaites
Apparence.quandElleChange(() => { if (hair.px0) hair.px = Apparence.teindreCheveux(hair.px0); hair.cache.clear(); hairPaint(); });
async function hairLoad() {
  if (hair.px || hair.loading || !cheveux) return; hair.loading = true;
  const im = new Image(); im.src = "persos/limace/cheveux-poses.png"; await im.decode();
  const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const g = cv.getContext("2d"); g.drawImage(im, 0, 0);
  hair.px0 = g.getImageData(0, 0, im.width, im.height).data; hair.px = Apparence.teindreCheveux(hair.px0); hair.pw = im.width;
}
// une image le long d'un mur (choc contre le bord, glissade, retour au sol), dans toutes les humeurs et leurs clignements : D.all, pas D.tags
// (seulement l'humeur du moment)
function hairMur(f) {
  const D = SHEET_DATA.limace;
  if (f.mur === undefined) { f.mur = false; for (const [n, fr] of Object.entries(D.all)) if (/^(coule|choc-bord)/.test(n) && fr.includes(f)) { f.mur = true; break; } }
  return f.mur;
}
// le sommet de la tête d'une image de la feuille : au-dessus des yeux (l'encre loin du bord du corps), le milieu de la ligne du haut ; null sans corps
function hairAnchor(f) {
  if (f.hairAt !== undefined) return f.hairAt;
  const d = f.px0 || f.cv.getContext("2d").getImageData(0, 0, 64, 64).data, A = i => d[i * 4 + 3] > 0, ink = i => A(i) && d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] < 30;
  const inside = (X, Y) => X >= 0 && Y >= 0 && X < 64 && Y < 64 && A(Y * 64 + X);
  const edge = (X, Y) => inside(X, Y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !inside(X + a, Y + b));
  let ex = 0, ey = 0, n = 0, top = 64;
  for (let Y = 0; Y < 64; Y++) for (let X = 0; X < 64; X++) {
    if (!inside(X, Y)) continue; top = Math.min(top, Y);
    if (!ink(Y * 64 + X)) continue;
    let near = false; for (let b = -1; b <= 1 && !near; b++) for (let a = -1; a <= 1; a++) if (edge(X + a, Y + b)) { near = true; break; }
    if (!near) { ex += X; ey += Y; n++; }
  }
  if (top === 64) return f.hairAt = null;
  let X, Y;
  // contre un mur, au-dessus des yeux il y a la queue collée au bord : la racine va sur le contour extérieur de la tête, en diagonale depuis les yeux
  if (n && hairMur(f)) { X = Math.round(ex / n); Y = Math.round(ey / n); while (inside(X - 1, Y - 1)) { X--; Y--; } return f.hairAt = [X + .5, Y]; }
  if (n) { X = Math.round(ex / n); Y = Math.round(ey / n); if (!inside(X, Y)) { let best = null; for (let x2 = 0; x2 < 64; x2++) if (inside(x2, Y) && (best === null || Math.abs(x2 - X) < Math.abs(best - X))) best = x2; if (best === null) return f.hairAt = null; X = best; } while (inside(X, Y - 1)) Y--; }
  else { Y = top; let s2 = 0, c = 0; for (let x2 = 0; x2 < 64; x2++) if (inside(x2, Y)) { s2 += x2; c++; } X = Math.round(s2 / c); }
  let a = X, b = X; while (inside(a - 1, Y)) a--; while (inside(b + 1, Y)) b++;
  return f.hairAt = [(a + b + 1) / 2, Y];
}
// l'image coiffée (gardée par image et par pose), aux couleurs de l'apparence ; sans cheveux : l'image teinte (la même si elle n'est pas de la feuille)
function hairComposite(src, pose) {
  if (!cheveux || !hair.px || style !== "limace" || !SHEET_DATA.limace) return Apparence.affichee(src);
  const D = SHEET_DATA.limace, f = (D.bySrc || (D.bySrc = new Map(D.frames.map(f => [f.src, f])))).get(src); if (!f) return Apparence.affichee(src);
  // le long d'un mur : la tête penche vers l'extérieur, les cheveux aussi (penchés fort, du côté opposé au mur : à gauche dans l'image, qui est
  // dessinée contre le bord droit et retournée pour le mur de gauche), sinon le corps les cache
  if (hairMur(f)) pose = pose === 1 ? 1 : 0;
  const key = src + "|" + pose; let out = hair.cache.get(key); if (out) return out;
  const at = hairAnchor(f); if (!at) return Apparence.affichee(src);
  const cv = document.createElement("canvas"); cv.width = cv.height = 64; const g = cv.getContext("2d"); g.drawImage(f.cv, 0, 0);
  const im = g.getImageData(0, 0, 64, 64), d = im.data, ox = Math.floor(at[0]) - HAIR_RX, oy = at[1] - HAIR_H;
  for (let v = 0; v < HAIR_H; v++) for (let u = 0; u < HAIR_W; u++) {
    const i = (v * hair.pw + pose * HAIR_W + u) * 4; if (!hair.px[i + 3]) continue;
    const X = ox + u, Y = oy + v; if (X < 0 || Y < 0 || X > 63 || Y > 63) continue;
    const o = (Y * 64 + X) * 4; if (d[o + 3]) continue;
    for (let k = 0; k < 4; k++) d[o + k] = hair.px[i + k];
  }
  g.putImageData(im, 0, 0); out = cv.toDataURL();
  if (hair.cache.size > 3000) hair.cache.clear();
  hair.cache.set(key, out); return out;
}
function hairPaint() { const s2 = hairComposite(logicalSrc, hair.pose); if (IMG_SRC.get.call(img) !== s2) IMG_SRC.set.call(img, s2); }
// le ressort : la vitesse de la tête, en pixels de l'image (le retournement de l'image compris), pousse les cheveux de l'autre côté ;
// un choc (la vitesse change d'un coup : atterrissage, lancer, choc contre un bord) les ébouriffe un instant
function hairStep() {
  if (!cheveux || style !== "limace") return;
  if (!hair.px) { hairLoad(); return; }
  const now = performance.now(), D = SHEET_DATA.limace, f = D && D.bySrc && D.bySrc.get(logicalSrc), at = f && hairAnchor(f);
  const sc = (img.style.scale || "1").trim().split(/\s+/).map(Number), sx = sc[0] < 0 ? -1 : 1;
  // la fenêtre et la tête dans l'image, en pixels de l'image, dans le sens où l'image est dessinée ; tirée : le haut de la goutte
  const wx = pull.on ? pull.d[0] : x / 2 * sx, wy = pull.on ? pull.d[1] : y / 2, ax = pull.on ? 0 : at ? at[0] : 32;
  if (!hair.last || hair.last.pull !== pull.on) { hair.last = {t:now, wx, wy, ax, vx:0, vy:0, pull:pull.on}; return; }
  const L = hair.last, dt = Math.min(.1, Math.max(.004, (now - L.t) / 1000));
  const vx = (wx - L.wx) / dt, vy = (wy - L.wy) / dt;
  if (Math.hypot(vx - L.vx, vy - L.vy) > 450) hair.shock = now + 260;          // un choc : seulement la fenêtre (les sauts d'une image à l'autre n'en sont pas)
  // vitesse lissée (sur 0,1 s) : la tête qui saute de quelques pixels d'une image à l'autre fait une poussée, pas un à-coup
  hair.vf = (hair.vf || 0) + (vx + (ax - L.ax) / dt - (hair.vf || 0)) * Math.min(1, dt / .1);
  hair.last = {t:now, wx, wy, ax, vx, vy, pull:pull.on};
  const target = Math.max(-2.4, Math.min(2.4, -hair.vf / 14));          // la tête va à droite : les cheveux penchent à gauche
  hair.v += (60 * (target - hair.a) - 7 * hair.v) * dt; hair.a += hair.v * dt;
  const pose = now < hair.shock ? 5 : Math.max(0, Math.min(4, Math.round(hair.a) + 2));
  if (pose !== hair.pose) { hair.pose = pose; hairPaint(); }
}
