// Les cheveux posés sur la tête, avec leur ressort, ou à leur place l'hélice, et l'accessoire du visage (accessoires.js) posé dans la même image.
// Les cheveux (évolution, premier essai) : six poses dessinées (animations/cheveux/cheveux-poses.aseprite, exportées par tools/cheveux.py),
// 32 × 20, la racine au milieu du bas ; images 0 à 4 : penchés à gauche fort, à gauche, droits, à droite, à droite fort ; 5 : ébouriffés.
// Ils sont posés en direct sur l'image affichée, au sommet de la tête (juste au-dessus des yeux), sans jamais recouvrir le corps : img.src garde
// l'image de la feuille (tout le reste du code la compare), seul l'affichage reçoit l'image coiffée. Un ressort leur donne de l'inertie : quand la
// tête bouge (dans l'image, ou la fenêtre entière : marche, vol, glissade, tenu à la souris), ils restent en arrière puis la rattrapent.
// L'hélice (animations/accessoires/helice.aseprite, exportée par tools/accessoires.py) : quatre images de 32 × 20 comme les cheveux, la tige au
// même endroit que leur racine, un quart de tour des pales chacune ; elle tourne d'autant plus vite que la tête bouge vite (hair.vf), et s'arrête
// à l'arrêt. Sans ressort ni penché : elle reste droite, même le long d'un mur. Les chapeaux (CHAPEAUX : l'auréole) aussi, sans bouger du tout :
// une image de 32 × 20 posée comme les cheveux (animations/accessoires/<nom>.aseprite). Vite, elle se floute comme les bras qui se débattent (tenu.js) :
// les pales sous tous les angles en fantômes (jaune pâle, tramés un pixel sur deux, la trame alterne toutes les 60 ms), deux arcs de vitesse en
// pointillé juste au-delà du bout des pales, qui tournent avec elle, et les pales du moment en plein par-dessus.
const CHAPEAUX = ["aureole"], chapeauPx0 = {}, chapeauPx = {};          // d'origine, et aux couleurs de l'apparence
const HAIR_W = 32, HAIR_H = 20, HAIR_RX = 16, HAIR_N = 6;
const hair = {px:null, a:0, v:0, pose:2, shock:0, last:null, cache:new Map(), hpx:null, tour:0, pale:0, vite:0, trame:0, hcache:new Map()};
// l'hélice dans son image de 32 × 20 : le moyeu (le centre des pales), le rayon des pales, la ligne du bas des pales (dessous : la tige),
// et la vitesse (quarts de tour par seconde) à partir de laquelle elle se floute ; les couleurs du flou suivent sa teinte (Apparence.flouHelice)
const HEL_C = [17.5, 12.5], HEL_R = 6, HEL_BAS = 16, HEL_FLOU = 5;
const IMG_SRC = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
let logicalSrc = "";
Object.defineProperty(img, "src", {get() { return logicalSrc || IMG_SRC.get.call(img); }, set(v) { logicalSrc = v; hairPaint(); }});
// une nouvelle apparence : les cheveux reprennent leurs pixels d'origine (hair.px0) aux nouvelles couleurs (hair.px), et les images coiffées sont refaites
// (l'hélice aussi : hair.hpx0, hair.hpx)
Apparence.quandElleChange(() => {
  if (hair.px0) hair.px = Apparence.teindreCheveux(hair.px0);
  if (hair.hpx0) hair.hpx = Apparence.teindreHelice(hair.hpx0);
  for (const n in chapeauPx0) chapeauPx[n] = Apparence.teindreAccessoire(n, chapeauPx0[n]);
  hair.cache.clear(); hair.hcache.clear(); hairPaint();
});
async function hairLoad() {
  if (hair.px || hair.loading || !cheveux) return; hair.loading = true;
  const im = new Image(); im.src = "persos/limace/cheveux-poses.png"; await im.decode();
  const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const g = cv.getContext("2d"); g.drawImage(im, 0, 0);
  hair.px0 = g.getImageData(0, 0, im.width, im.height).data; hair.px = Apparence.teindreCheveux(hair.px0); hair.pw = im.width;
}
async function heliceLoad() {
  if (hair.hpx || hair.hloading || !helice) return; hair.hloading = true;
  const im = new Image(); im.src = "persos/limace/helice.png"; await im.decode();
  const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const g = cv.getContext("2d"); g.drawImage(im, 0, 0);
  hair.hpx0 = g.getImageData(0, 0, im.width, im.height).data; hair.hpx = Apparence.teindreHelice(hair.hpx0); hair.hpw = im.width;
}
async function chapeauCharger(n) {
  if (chapeauPx0[n]) return;
  const im = new Image(); im.src = `persos/limace/${n}.png`; await im.decode();
  const cv = document.createElement("canvas"); cv.width = HAIR_W; cv.height = HAIR_H; const g = cv.getContext("2d"); g.drawImage(im, 0, 0);
  chapeauPx0[n] = g.getImageData(0, 0, HAIR_W, HAIR_H).data; chapeauPx[n] = Apparence.teindreAccessoire(n, chapeauPx0[n]);
}
// l'image de l'hélice à cet instant (32 × 20, RGBA) : son quart de tour, et vite, le flou
function heliceImage() {
  const flou = hair.vite >= HEL_FLOU, cle = hair.pale + (flou ? "f" + hair.trame + "," + Math.floor(hair.tour * 2) % 8 : "");
  let o = hair.hcache.get(cle); if (o) return {o, cle};
  o = new Uint8ClampedArray(HAIR_W * HAIR_H * 4);
  const P = hair.hpx, at = (u, v, k) => (v * hair.hpw + k * HAIR_W + u) * 4;
  const {fantome, arc} = Apparence.flouHelice;
  const put = (u, v, c) => { const i = (v * HAIR_W + u) * 4; o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2]; o[i + 3] = 255; };
  if (flou) {
    // l'éventail : chaque pixel du disque des pales que l'une d'elles balaie (les pales de la première image, tournées d'un douzième de tour à la fois)
    for (let v = 0; v <= HEL_BAS + 2; v++) for (let u = 0; u < HAIR_W; u++) {
      if ((u + v + hair.trame) % 2) continue;
      const du = u + .5 - HEL_C[0], dv = v + .5 - HEL_C[1];
      if (Math.hypot(du, dv) > HEL_R + 1) continue;
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6, su = Math.floor(HEL_C[0] + du * Math.cos(a) - dv * Math.sin(a)), sv = Math.floor(HEL_C[1] + du * Math.sin(a) + dv * Math.cos(a));
        if (su >= 0 && su < HAIR_W && sv >= 0 && sv <= HEL_BAS && P[at(su, sv, 0) + 3]) { put(u, v, fantome); break; }
      }
    }
    // les arcs de vitesse : deux arcs opposés (un cinquième de tour), en pointillé, juste au-delà du bout des pales ; ils tournent avec elle
    const tour = hair.tour * Math.PI / 2, r = HEL_R + 1.5;
    for (const debut of [0, Math.PI]) for (let a = 0; a < Math.PI * .4; a += .5 / r) {
      const th = debut + tour + a, u = Math.floor(HEL_C[0] + r * Math.cos(th)), v = Math.floor(HEL_C[1] + r * Math.sin(th));
      if (u < 0 || v < 0 || u >= HAIR_W || v > HEL_BAS + 3 || (u + v) % 2) continue;
      put(u, v, arc);
    }
  }
  // les pales du moment (et la tige), en plein, par-dessus
  for (let v = 0; v < HAIR_H; v++) for (let u = 0; u < HAIR_W; u++) { const i = at(u, v, hair.pale); if (P[i + 3]) put(u, v, [P[i], P[i + 1], P[i + 2]]); }
  if (hair.hcache.size > 64) hair.hcache.clear();
  hair.hcache.set(cle, o); return {o, cle};
}
// ce qui est posé au sommet de la tête : les cheveux (dans la pose du ressort), l'hélice (dans son quart de tour, floue si elle tourne vite),
// un chapeau, ou rien
function hairTete(pose) {
  if (cheveux && hair.px) return {px:hair.px, pw:hair.pw, pose, cle:"c" + pose};
  if (helice && hair.hpx) { const {o, cle} = heliceImage(); return {px:o, pw:HAIR_W, pose:0, cle:"h" + cle}; }
  if (chapeau && chapeauPx[chapeau]) return {px:chapeauPx[chapeau], pw:HAIR_W, pose:0, cle:"a" + chapeau};
  return null;
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
// l'image coiffée (gardée par image et par pose), aux couleurs de l'apparence, avec l'accessoire du visage (accessoires.js) ;
// sans cheveux ni accessoire : l'image teinte (la même si elle n'est pas de la feuille)
function hairComposite(src, pose) {
  const tete = hairTete(pose);
  if (!(tete || visagePret()) || style !== "limace" || !SHEET_DATA.limace) return Apparence.affichee(src);
  const D = SHEET_DATA.limace, f = (D.bySrc || (D.bySrc = new Map(D.frames.map(f => [f.src, f])))).get(src); if (!f) return Apparence.affichee(src);
  // le long d'un mur : la tête penche vers l'extérieur, les cheveux aussi (penchés fort, du côté opposé au mur : à gauche dans l'image, qui est
  // dessinée contre le bord droit et retournée pour le mur de gauche), sinon le corps les cache
  if (tete && cheveux && hairMur(f)) tete.pose = pose === 1 ? 1 : 0, tete.cle = "c" + tete.pose;
  const key = src + "|" + (tete ? tete.cle : "") + "|" + (visagePret() ? visage : ""); let out = hair.cache.get(key); if (out) return out;
  const at = tete && hairAnchor(f); if (!at && !(visagePret() && f.yeux)) return Apparence.affichee(src);
  const cv = document.createElement("canvas"); cv.width = cv.height = 64; const g = cv.getContext("2d"); g.drawImage(f.cv, 0, 0);
  const im = g.getImageData(0, 0, 64, 64), d = im.data;
  visagePoser(d, f);
  if (at) for (let v = 0, ox = Math.floor(at[0]) - HAIR_RX, oy = at[1] - HAIR_H; v < HAIR_H; v++) for (let u = 0; u < HAIR_W; u++) {
    const i = (v * tete.pw + tete.pose * HAIR_W + u) * 4; if (!tete.px[i + 3]) continue;
    const X = ox + u, Y = oy + v; if (X < 0 || Y < 0 || X > 63 || Y > 63) continue;
    const o = (Y * 64 + X) * 4; if (d[o + 3]) continue;
    for (let k = 0; k < 4; k++) d[o + k] = tete.px[i + k];
  }
  g.putImageData(im, 0, 0); out = cv.toDataURL();
  if (hair.cache.size > 3000) hair.cache.clear();
  hair.cache.set(key, out); return out;
}
function hairPaint() { const s2 = hairComposite(logicalSrc, hair.pose); if (IMG_SRC.get.call(img) !== s2) IMG_SRC.set.call(img, s2); }
// le ressort : la vitesse de la tête, en pixels de l'image (le retournement de l'image compris), pousse les cheveux de l'autre côté ;
// un choc (la vitesse change d'un coup : atterrissage, lancer, choc contre un bord) les ébouriffe un instant. L'hélice : la même vitesse la fait tourner
function hairStep() {
  if (!(cheveux || helice) || style !== "limace") return;
  if (cheveux && !hair.px) { hairLoad(); return; }
  if (helice && !hair.hpx) { heliceLoad(); return; }
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
  if (pose !== hair.pose) { hair.pose = pose; if (cheveux) hairPaint(); }
  // l'hélice : jusqu'à 14 quarts de tour par seconde ; en dessous de 3 pixels par seconde, elle ralentit et s'arrête
  const vise = Math.abs(hair.vf) < 3 ? 0 : Math.min(14, Math.abs(hair.vf) / 6);
  hair.vite += (vise - hair.vite) * Math.min(1, dt / (vise > hair.vite ? .15 : .6)); if (hair.vite < .3) hair.vite = 0;
  hair.tour += hair.vite * dt;
  const pale = Math.floor(hair.tour) % 4, trame = Math.floor(now / 60) % 2;
  if (helice && (pale !== hair.pale || hair.vite >= HEL_FLOU && trame !== hair.trame)) { hair.pale = pale; hair.trame = trame; hairPaint(); }
}
