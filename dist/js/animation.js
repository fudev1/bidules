// Les animations des persos dessinés, les humeurs et leurs clignements, les bonbons de Candy, les parties des monstres.
// Un perso dessiné joue l'animation qui correspond à ce qu'il fait ; sheetOnce joue une animation une fois (saut, atterrissage, choc).
// tenu par la souris : la boule avec une pointe (attrape-boule) si elle existe, sinon attrape
const heldTag = T2 => T2["attrape-boule"] ? "attrape-boule" : "attrape";
const SHEET_MODE_TAG = {held:"attrape", ceiling:"crawl", fly:"vol", dizzy:"etourdi", nausea:"nausee", recover:"remis", pet:"caresse", laugh:"rire", angry:"fache",
  sulk:"boude", wall:"coule", ooh:"intrigue", sleep:"dort", carried:"attrape", waking:"baille", evolving:"fier"};
// Candy rebondit comme une balle quand on la lance ; crashed : la première chute était grosse, l'écrasement viendra à la fin des rebonds ; sing : elle chante pendant cette pause
const BOUNCY = new Set(["candy"]);
// pas d'étirement collant quand on la soulève : elle réagit avec ses images (balise attrape)
const NO_PULL = new Set(["candy"]);
let sheetOnce = null, sheetLoop = {tag:null, i:0, next:0}, fall = null, burpAt = 0, peakY = null, crashed = false, sing = false;
const bigFall = () => peakY !== null && floorY - peakY >= (floorY + WH - minY) * 2 / 3;
const tagDur = t => (isSheet() && SHEET_DATA[style].tags[t] || []).reduce((a, f) => a + f.dur, 0);
// une animation jouée sur place (sans avancer), puis il reprend sa marche
// de face quand il te regarde ou fait une pause, de profil quand il avance ; le passage de l'un à l'autre joue le demi-tour
function faceStep(now) {
  if (faceSeq) {
    if (now >= faceSeq.next) {
      // revenu de profil : la reptation repart de sa première image, celle qui ressemble au début du demi-tour
      if (faceSeq.i >= faceSeq.frames.length) { if (faceSeq.frames[faceSeq.frames.length - 1] === HALF[0]) { crawlIdx = 0; crawlNext = now; } faceSeq = null; return false; }
      const f = faceSeq.frames[faceSeq.i++]; img.src = f.src; faceSeq.next = nextAt(faceSeq.next, f.dur, now);
    }
    return true;
  }
  const want = watching ? (mood === "ronchon" ? "side" : "front") : now < idleUntil ? "front" : "side";
  if (want === (FRONT.has(img.src) ? "front" : "side")) return false;
  if (airborne()) return false;
  faceSeq = {frames:want === "front" ? HALF : HALF.slice().reverse(), i:0, next:0};
  return faceStep(now);
}
function playInPlace(tag) { setMode("still"); pose(""); watching = false; lookKey = ""; playOnce(tag); }
function playOnce(tag) {
  const fr = isSheet() && SHEET_DATA[style].tags[tag]; if (!fr) return;
  if (mode !== "fly") img.style.translate = "";
  img.src = fr[0].src; sheetOnce = {tag, i:1, next:Date.now() + fr[0].dur, mode};
}
function sheetAnim(now) {
  const T2 = SHEET_DATA[style].tags;
  if (swing.on && (mode === "held" || mode === "carried")) return;       // la goutte est dessinée en direct (swingDraw)
  if (mode === "ceilswing") return;                                      // ses images sont jouées par ceilSwingStep
  // si son état a changé entre-temps (on l'énerve, on l'attrape...), l'animation en cours s'arrête : une seule animation à la fois
  if (sheetOnce && sheetOnce.mode !== mode) sheetOnce = null;
  if ((mode !== "fly" || sheetOnce) && img.style.translate) img.style.translate = "";
  if (sheetOnce) {
    const fr = T2[sheetOnce.tag];
    if (now >= sheetOnce.next) {
      if (sheetOnce.i >= fr.length) sheetOnce = null;
      else { img.src = fr[sheetOnce.i].src; sheetOnce.next = nextAt(sheetOnce.next, fr[sheetOnce.i].dur, now); sheetOnce.i++; }
    }
    if (sheetOnce) return;
  }
  // secoué puis lâché (nausea), il reste vert pendant la chute et l'atterrissage : les mêmes animations en vert, jusqu'à ce qu'il se remette
  const tg = n => (nausea && T2[n + "-vert"]) || T2[n];
  if (mode === "fly" && T2.vol && T2.chute) {
    let f;
    // petite chute : la goutte du saut du collègue ; grande chute (au moins les deux tiers de l'écran) : l'animation de Thibault, il a peur
    const L2 = tg("chute-legere");
    if (vy < 3) { f = tg("vol")[0]; fall = null; }
    // Candy panique (bras qui battent, larmes) pendant la première chute ; après le premier rebond, la chute légère
    else if (!bigFall() && L2 && !(style === "candy" && bounces === 0)) { f = vy < 9 ? L2[0] : L2[L2.length - 1]; fall = null; }
    else {
      const C = tg("chute");
      if (!fall) fall = {i:0, next:now + C[0].dur};
      else if (now >= fall.next) { fall.i = fall.i + 1 >= C.length ? Math.min(2, C.length - 1) : fall.i + 1; fall.next = nextAt(fall.next, C[fall.i].dur, now); }
      f = C[fall.i];
    }
    // calé sur le sol ; pendant la boucle de chute, un calage fixe pour garder le mouvement dessiné par Thibault
    const C2 = tg("chute").slice(2), lb = fall && fall.i >= 2 && C2.length ? Math.max(...C2.map(c => c.bot)) : f.bot;
    const lift = (SHEET_DATA[style].front.bot - lb) * 2 + "px";
    if (img.src !== f.src) img.src = f.src;
    if (img.style.translate !== "0px " + lift) img.style.translate = "0px " + lift;
    return;
  }
  // collé en haut, à la fin de l'atterrissage (de face) : le demi-tour vers le profil, avant de ramper
  if (mode === "ceiling" && !faceSeq && HALF && FRONT.has(img.src)) faceSeq = {frames:HALF.slice().reverse(), i:0, next:0};
  if (mode === "turning" || mode === "ceiling" && faceSeq) return;
  let tag = SHEET_MODE_TAG[mode];
  if (tag === "attrape") tag = heldTag(T2);
  if (mode === "held" && drag && drag.shaken) tag = "secoue";
  if (mode === "fly" && vy > 0 && T2.chute) tag = nausea && T2["chute-vert"] ? "chute-vert" : "chute";
  if (mode === "wall" && nausea && T2["coule-vert"]) tag = "coule-vert";          // secoué, il reste vert en coulant le long du mur
  if (mode === "sleep" && wake > 35) tag = "remue";
  if (mode === "walk") { if (watching) sing = false; if (watching || now >= idleUntil || faceSeq || !FRONT.has(img.src)) return; tag = sing && T2.chante ? "chante" : "repos"; }
  if (!tag || !T2[tag]) { if (tag === "boude" && T2.crawl) tag = "crawl"; else return; }
  if (mode === "ceiling" && drag) return;          // tenu au plafond : il s'arrête sur l'image où on l'a pris
  if (sheetLoop.tag !== tag) sheetLoop = {tag, i:0, next:0};
  if (now >= sheetLoop.next) { const fr = T2[tag], k2 = sheetLoop.i % fr.length; img.src = fr[k2].src; sheetLoop.next = nextAt(sheetLoop.next, fr[k2].dur * (mode === "nausea" ? 1.6 : 1), now); sheetLoop.i++;
    // nausée au sol : la reptation en vert, plus lente ; il avance d'un pas à chaque image, comme à la marche (pas de glissade)
    if (mode === "nausea" || mode === "ceiling") x += dir * 2 * (fr[k2].step || 0);          // collé en haut, il avance aussi pas à pas
  }
}
// Candy sautille en marchant, sauf ronchon ou vaseuse (elle garde la reptation) ; la marche ne change qu'en fin de cycle
let walkTag = "crawl";
const walkFrames = () => { const T = SHEET_DATA[style].tags; return T[walkTag] || T.crawl || SHEET_DATA[style].frames; };
// Humeur : les animations sont dessinées avec le visage neutre ; gen.py en tire une version par humeur (balise « repos@guilleret ») avec le visage de
// l'humeur, et sa version alternée (« repos@guilleret:cligne ») : yeux fermés pour le joyeux, ouverts pour le fatigué. tags = les animations de l'humeur
// du moment (la neutre quand l'humeur n'en a pas), all = toutes les balises de la feuille. BLINK : chaque image habituelle -> la même, alternée.
let BLINK = new Map(), UNBLINK = new Map(), blinkAt = 0, blinkEnd = 0;
function moodTags(id) {
  const D = SHEET_DATA[id]; if (!D) return;
  D.tags = {};
  for (const n in D.all) if (!n.includes("@")) D.tags[n] = D.all[n + "@" + mood] || D.all[n];
}
function moodBlinks(id) {
  const D = SHEET_DATA[id]; BLINK = new Map(); UNBLINK = new Map();
  if (!D) return;
  for (const n in D.all) {
    const c = D.all[n + ":cligne"];
    if (n.endsWith("@" + mood) && c) D.all[n].forEach((f, i) => { if (c[i] && c[i].src !== f.src) { BLINK.set(f.src, c[i].src); UNBLINK.set(c[i].src, f.src); } });
  }
}
// De temps en temps, quelle que soit l'animation, l'image affichée est remplacée par la même, alternée (si elle en a une : pas pendant une expression,
// ni dans l'humeur neutre, dont les animations ont leurs clignements dessinés). Joyeux : il cligne (140 ms, toutes les 2 à 6 s, parfois deux fois de
// suite) ; fatigué : il garde les yeux fermés et les ouvre 0,6 à 1,5 s, toutes les 3 à 9 s.
const BLINK_TIME = {vaseux:{dur:[600, 1500], gap:[3000, 9000], twice:0}, autre:{dur:[140, 140], gap:[2000, 6000], twice:.25}};
const rnd = ([a, b]) => a + Math.random() * (b - a);
function blinkStep(now) {
  if (now >= blinkAt) { const B = BLINK_TIME[mood] || BLINK_TIME.autre, d = rnd(B.dur); blinkEnd = now + d; blinkAt = now + d + (Math.random() < B.twice ? 180 : rnd(B.gap)); }
  const s = img.src, to = now < blinkEnd ? BLINK.get(s) : UNBLINK.get(s);
  if (to) img.src = to;
}
const hopping = () => isSheet() && walkTag === "sautille" && !!SHEET_DATA[style].tags.sautille;
const airborne = () => hopping() && crawlIdx % 4 !== 0;
let crawlIdx = 0, crawlNext = 0, turnSeq = null, turnIdx = 0, turnNext = 0, pendingDir = 1, turnWanted = null, turnWantedUntil = 0;
// --- Bonbons : Candy en laisse en marchant quand elle est contente (humeur guilleret), jamais plus de 3 par terre. Ils restent jusqu'à ce qu'on clique
// sur l'un d'eux : elle vient alors le manger. Chaque bonbon est une petite fenêtre à part (main.rs), car la sienne la suit partout.
const SWEET_COLORS = ["menthe", "rose", "jaune"], EAT_TAG = {menthe:"mange", rose:"mange-rose", jaune:"mange-jaune"};
const SWEET_WIN = {w:32, up:148}, SWEET_AHEAD = 30;   // la fenêtre du bonbon : largeur, et hauteur de son haut sous le haut de la fenêtre de Candy ; distance où elle s'arrête devant lui
let sweets = [], sweetId = 0, sweetTimer = 8000, wanted = [], feeding = null;
function sweetDrop() {
  const s = {id:++sweetId, color:SWEET_COLORS[Math.floor(Math.random() * SWEET_COLORS.length)], cx:x + 88 - dir * 28};
  sweets.push(s);
  T.core.invoke("bonbon_poser", {id:s.id, x:Math.round(s.cx - SWEET_WIN.w / 2), y:Math.round(y + SWEET_WIN.up), couleur:s.color})
    .catch(e => { sweets = sweets.filter(c => c !== s); say("bonbon : " + e); });
  say(`elle laisse un bonbon ${s.color}`);
}
function sweetRemove(s) {
  sweets = sweets.filter(c => c !== s); wanted = wanted.filter(c => c !== s); if (feeding && feeding.s === s) feeding = null;
  T.core.invoke("bonbon_retirer", {id:s.id}).catch(() => {});
}
// elle marche vers le bonbon ; au contact avec le sol, à 30 pixels de lui, elle s'arrête et se met de face
function feedArrive() {
  const s = feeding.s, side = Math.sign(s.cx - (x + 88)) || dir, aim = s.cx - side * SWEET_AHEAD - 88;
  // hors de sa portée (autre écran, écran redimensionné) ou trop long : elle renonce, le bonbon reste là
  if (aim < minX - 6 || aim > maxX + 6 || Date.now() > feeding.until) { say("bonbon hors de portée : elle renonce"); feeding = null; wanted = wanted.filter(c => c !== s); return; }
  if (side !== dir) { if (turnWanted === null) turnTo(side); return; }
  if ((aim - x) * dir > (hopping() ? 8 : 4)) return;
  feeding.stage = "face"; feeding.aim = aim; idleUntil = Date.now() + 30000;
}
function startEat() {
  const s = feeding.s, tag = EAT_TAG[s.color];
  sweetRemove(s);   // sa fenêtre se ferme : le bonbon est maintenant dessiné dans ses mains
  idleUntil = 0; disturb();
  react("eat", (tagDur(tag) || 1800) + 400, FR.rire, ""); playOnce(tag); bubble("Miam !", 1000);
  say(`elle mange un bonbon ${s.color}`);
}
let moodMode = "auto", mood = null, moodReason = "";
const MOOD_LABEL = {guilleret:"Guilleret", ronchon:"Ronchon", vaseux:"Vaseux", stresse:"Stressé", lune:"Dans la lune"};
const MOOD_MOVE = {normal:{speed:1.6, idle:.008, flip:.004}, guilleret:{speed:2.4, idle:.004, flip:.006}, ronchon:{speed:.9, idle:.016, flip:.003},
  vaseux:{speed:.7, idle:.012, flip:.003, sleepAfter:15000}, stresse:{speed:3.2, idle:.002, flip:.03}, lune:{speed:1, idle:.01, flip:.004}};
const MV = () => MOOD_MOVE[mood] || MOOD_MOVE.normal;
const partsBy = {classique:{tete:"antennes", pattes:"longues", bras:"bras", queue:"touffue"}};
for (const id in MONSTRES) partsBy[id] = {};
partsBy.limace = {}; partsBy.candy = {};
const PART_NAME = {"tete:antennes":"antennes", "tete:cornes":"cornes", "bouche:crocs":"crocs", "bouche:langue":"langue gourmande", "bras:bras":"petits bras",
  "bras:pinces":"pinces", "pattes:longues":"longues pattes", "pattes:palmees":"pattes palmées", "dos:ailes":"ailes", "dos:fourrure":"fourrure",
  "queue:touffue":"queue touffue", "queue:lezard":"queue de lézard"};
function buildFrames(s) {
  document.body.classList.toggle("sheet", !!SHEETS[s]);
  img.style.transformOrigin = SHEETS[s] ? (SHEET_DATA[s].axis + .5) / 64 * 100 + "% 60%" : "";
  moodBlinks(s);
  if (SHEETS[s]) {
    const D = SHEET_DATA[s], T2 = D.tags, front = D.front.src, nf = {}, nl = {};
    const pick = (tag, i = 0) => T2[tag] ? T2[tag][Math.min(i, T2[tag].length - 1)].src : front;
    for (const k of Object.keys(FRAME_STATES)) nf[k] = front;
    Object.assign(nf, {normal:pick("repos"), p1:pick(heldTag(T2)), p2:pick(heldTag(T2), 1), d1:pick("etourdi"), d2:pick("etourdi", 1), content:pick("caresse"),
      rire:pick("rire"), fache:pick("fache"), ooh:pick("intrigue"), n1:pick("nausee"), n2:pick("nausee", 1), dort:pick("dort"), remue:pick("remue"), baille:pick("baille", 1)});
    const LOOK_ORDER = ["0,-1", "0,0", "0,1", "1,-1", "1,0", "1,1"];
    for (const lx of [0, 1]) for (const ly of [-1, 0, 1]) { const key = lx + "," + ly; nl[key] = T2.regard ? T2.regard[LOOK_ORDER.indexOf(key)].src : front; }
    // images de face ; HALF = début du demi-tour, du profil jusqu'à l'image de face
    const mid = T2.turn ? T2.turn.reduce((b, f, i) => f.dur > T2.turn[b].dur ? i : b, 0) : -1;
    FRONT = new Set(["repos", "regard", "baille", "reforme", "atterrissage", "atterrissage-vert", "intrigue", "caresse", "caresse-fin", "rire", "fache", "chante", "fier"].flatMap(t => (T2[t] || []).map(f => f.src)));
    if (mid > 0) FRONT.add(T2.turn[mid].src);
    for (const [o, c] of BLINK) if (FRONT.has(o)) FRONT.add(c);         // l'image alternée d'une image de face reste une image de face
    HALF = mid > 0 ? T2.turn.slice(0, mid + 1) : null; faceSeq = null;
    const AR = T2["attrape-boule-arms"]; swing.armPx = null;
    swing.hand = null;
    if (AR) { const im = new Image(); im.onload = () => { try { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d", {willReadFrequently:true}); g.drawImage(im, 0, 0); swing.armPx = g.getImageData(0, 0, 64, 64).data;
      let n = 0; for (let i = 3; i < swing.armPx.length; i += 4) if (swing.armPx[i]) n++; say(`goutte : bras charges (${n} pixels)`); } catch (e) { say("goutte : bras illisibles : " + e); } };
      im.onerror = () => say("goutte : image des bras introuvable"); im.src = AR[0].src; }
    else say("goutte : pas de bras dans la feuille (attrape-boule-arms)");
    const P = T2["attrape-boule-parts"]; swing.parts = P ? P.map(f => { const im = new Image(); im.src = f.src; return im; }) : null; swing.durs = P ? P.map(f => f.dur) : [];
    FR = nf; LOOK = nl; style = s; return;
  }
  const G = MONSTRES[s] ? (st, look) => monstreURL(s, st, look, partsBy[s], mood)
    : (st, look) => bidule64({...bid, parts:partsBy.classique, look, mood}, st, ACCS);
  const nf = {}, nl = {};
  for (const [k, st] of Object.entries(FRAME_STATES)) nf[k] = G(st);
  for (const lx of [0, 1]) for (const ly of [-1, 0, 1]) nl[lx + "," + ly] = G("forme", [lx, ly]);
  FR = nf; LOOK = nl; style = s;
}
buildFrames("goutte");
