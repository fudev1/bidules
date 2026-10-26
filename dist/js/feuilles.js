// Le socle : l'API de l'app, le journal, et les feuilles d'images des persos dessinés (chargées à la demande).
const COL = {k:"#2a2238", p:"#ff7fa0"};
const T = window.__TAURI__;
const img = document.getElementById("b"), fx = document.getElementById("fx");
const say = m => { try { T.core.invoke("log", {msg: String(m)}); } catch (e) {} };
window.onerror = m => say("erreur: " + m);
const bid = {pal:"menthe", parts:{tete:"antennes", pattes:"longues", bras:"bras", queue:"touffue"}}, ACCS = {tete:"bonnet"};
const FRAME_STATES = {normal:"forme", p1:"panique", p2:"panique2", d1:"etourdi", d2:"etourdi2", content:"content", rire:"rire",
  fache:"fache", ooh:"ooh", n1:"nausee", n2:"nausee2", dort:"dort", remue:"remue", baille:"baille"};
const EYE_Y = {classique:123};
for (const id in MONSTRES) EYE_Y[id] = 48 + MONSTRES[id].eyeY * 2;
EYE_Y.limace = 138;
EYE_Y.candy = 134;
let style = "goutte", FR = {}, LOOK = {}, FRONT = new Set(), HALF = null, faceSeq = null;
// prochaine image : à partir de l'heure prévue de la précédente, sauf gros retard (l'écart ne s'accumule pas)
const nextAt = (prev, dur, now) => (now - prev > 60 ? now : prev) + dur;
// Persos dessinés à la main dans Aseprite : on lit la feuille et ses balises (crawl, turn).
const SHEETS = {limace:{png:"persos/limace/sheet.png", json:"persos/limace/sheet.json"}, candy:{png:"persos/candy/sheet.png", json:"persos/candy/sheet.json"}}, SHEET_DATA = {};
// Évolution, premier essai : la limace avec trois cheveux, choisie dans le panneau et gardée sur ce Mac (hairStep, plus bas).
let cheveux = false;
try { cheveux = localStorage.getItem("bidule.cheveux") === "oui"; } catch (e) {}
async function loadSheet(id) {
  const meta = await (await fetch(SHEETS[id].json)).json();
  const im = new Image(); im.src = SHEETS[id].png; await im.decode();
  const list = Object.entries(meta.frames).sort((a, b) => parseInt(a[0].match(/(\d+)\.aseprite$/)?.[1] || 0) - parseInt(b[0].match(/(\d+)\.aseprite$/)?.[1] || 0));
  // une seule lecture des pixels de toute la feuille, et une pause toutes les 40 images : le Bidule ne fige pas au lancement
  const all = document.createElement("canvas"); all.width = im.width; all.height = im.height;
  const ga = all.getContext("2d", {willReadFrequently:true}); ga.drawImage(im, 0, 0);
  const sheetPx = ga.getImageData(0, 0, im.width, im.height).data, frames = [];
  for (const [k, [, f]] of list.entries()) {
    if (k % 40 === 39) await new Promise(r => setTimeout(r));
    const cv = document.createElement("canvas"); cv.width = f.frame.w; cv.height = f.frame.h;
    const g = cv.getContext("2d"); g.drawImage(im, f.frame.x, f.frame.y, f.frame.w, f.frame.h, 0, 0, f.frame.w, f.frame.h);
    const px = new Uint8ClampedArray(f.frame.w * f.frame.h * 4);
    for (let y = 0; y < f.frame.h; y++) { const o = ((f.frame.y + y) * im.width + f.frame.x) * 4; px.set(sheetPx.subarray(o, o + f.frame.w * 4), y * f.frame.w * 4); }
    let bot = 0, l = f.frame.w, r = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i]) { const X = (i >> 2) % f.frame.w; if (px[i - 3] + px[i - 2] + px[i - 1] < 60) bot = Math.floor((i >> 2) / f.frame.w); l = Math.min(l, X); r = Math.max(r, X); }
    // appui au sol : les deux bouts de la ligne juste au-dessus du bas
    let tail = f.frame.w, head = 0;
    for (let X = 0; X < f.frame.w; X++) if (bot > 0 && px[((bot - 1) * f.frame.w + X) * 4 + 3]) { tail = Math.min(tail, X); head = Math.max(head, X); }
    // sommet de la tête : la première ligne non vide et le milieu de ses pixels (c'est là que la souris tient le Bidule quand il pend)
    let top = f.frame.h, tl = 0, tn = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i]) { const Y = Math.floor((i >> 2) / f.frame.w), X = (i >> 2) % f.frame.w; if (Y < top) { top = Y; tl = 0; tn = 0; } if (Y === top) { tl += X; tn++; } }
    frames.push({src:cv.toDataURL(), cv, dur:f.duration || 100, bot, cx:(l + r) / 2, tail, head, top, tipx:tn ? tl / tn : f.frame.w / 2, step:f.step});
  }
  const tags = {};
  for (const t of meta.meta.frameTags || []) tags[t.name] = frames.slice(t.from, Math.min(t.to, frames.length - 1) + 1);
  const turn = tags.turn || frames, front = turn.reduce((a, b) => b.dur > a.dur ? b : a, turn[0]);
  // axe du retournement gauche/droite : celui qui fait coïncider la reptation retournée avec la fin du demi-tour
  // (pour la limace, c'est aussi le centre des images de face : elle ne se décale plus quand elle regarde à gauche puis à droite)
  const axis = tags.crawl && tags.turn ? (tags.crawl[0].cx + tags.turn[tags.turn.length - 1].cx) / 2 : 31.5;
  // pas de la reptation : d'une image à l'autre, un bout reste collé au sol, l'autre avance ; la fenêtre avance juste de quoi garder ce bout immobile
  if (tags.crawl) { const c = tags.crawl, n = c.length; c.forEach((b, i) => { const a = c[(i - 1 + n) % n]; b.step = Math.max(0, -Math.min(b.tail - a.tail, b.head - a.head)); }); }
  // nausee et les reptations des humeurs (crawl@guilleret…) : les mêmes images avec un autre visage, donc le même pas
  for (const n in tags) if ((n === "nausee" || n.startsWith("crawl@")) && tags.crawl && tags[n].length === tags.crawl.length) tags[n].forEach((b, i) => { b.step = tags.crawl[i].step; });
  SHEET_DATA[id] = {frames, all:tags, tags, front, axis};
  moodTags(id);
  if (id === "limace") await Apparence.preparer();          // l'apparence choisie, appliquée une fois au chargement
  say(`perso ${id} : ${frames.length} images, ${Object.keys(tags).length} animations`);
}
const SHEET_LOADING = {};          // un seul chargement par perso, même si on le choisit deux fois pendant qu'il charge
const isSheet = () => !!(SHEETS[style] && SHEET_DATA[style]);
