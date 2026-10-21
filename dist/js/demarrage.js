// L'état gardé, le choix du Bidule, l'évolution, le menu du clic droit, et le démarrage (la boucle unique, voir horloge.js).
// L'état gardé d'un lancement à l'autre (main.rs : etat.json) : l'humeur choisie, les parties, les cheveux, caché ou non, le toucher, et sa place
// à l'écran (il revient au sol, au même endroit). Écrit une demi-seconde après chaque changement ; sa place, toutes les 5 s si elle a changé.
let gardeT = 0, gardeX = null;
function garder() {
  clearTimeout(gardeT);
  gardeT = setTimeout(() => { if (mode === "walk") gardeX = Math.round(x);
    T.core.invoke("garder_etat", {etat:JSON.stringify({humeur:moodMode, parties:partsBy, cheveux, cache:bidHidden, haptique:hapticOn, x:gardeX})}).catch(e => say("etat : " + e)); }, 500);
}
// Le Bidule choisi : chargé, affiché, et gardé pour le prochain lancement (main.rs : garder_choix).
async function chooseStyle(s) {
  if (SHEETS[s] && !SHEET_DATA[s]) { try { await (SHEET_LOADING[s] ||= loadSheet(s)); } catch (err) { delete SHEET_LOADING[s]; say("perso : " + err); return; } }
  if (mode === "turning") { setMode("walk"); dir = pendingDir; face(); }
  buildFrames(s); lookKey = ""; say("piste : " + s); refreshSprite();
  if (!chosen) { chosen = true; document.body.classList.add("pret"); }
  T.core.invoke("garder_choix", {style:s}).catch(e => say("choix : " + e));
  sendState();
}
T.event.listen("style", e => chooseStyle(e.payload));
// L'apparence de chaque Bidule (GLOSSARY.md), gardée par l'app (main.rs : apparences.json) : {limace:{corps:"rose", ...}}. Absente = l'apparence d'origine.
// Le panneau l'envoie à chaque changement (aperçu en direct) ; {} pour « Remettre d'origine ». Seule la limace a des teintes pour l'instant.
let apparences = {};
T.event.listen("apparence", async e => {
  const a = e.payload || {};
  if (Object.keys(a).length) apparences[style] = a; else delete apparences[style];
  T.core.invoke("garder_apparences", {apparences:JSON.stringify(apparences)}).catch(err => say("apparence : " + err));
  if (style === "limace") await Apparence.appliquer(a);
  sendState();
});
T.event.listen("haptique", e => { hapticOn = !!e.payload; garder(); sendState(); if (hapticOn) haptic("clic"); });
// Demi-tour : avec un perso dessiné, on joue son animation "turn" au lieu de retourner l'image.
function turnTo(nd, ready) {
  if (nd === dir) return;
  if (isSheet() && mode === "walk" && SHEET_DATA[style].tags.turn) {
    // on attend la fin de la boucle de reptation : le demi-tour commence sur son image 0 (voir le pas de reptation plus haut)
    if (!ready && SHEET_DATA[style].tags.crawl) { turnWanted = nd; turnWantedUntil = Date.now() + 4000; return; }
    const t = SHEET_DATA[style].tags.turn;
    turnSeq = dir > 0 ? t : t.slice().reverse(); turnIdx = 0; turnNext = 0; pendingDir = nd;
    setMode("turning"); img.style.scale = "1 1"; pose("");
    img.src = turnSeq[0].src; turnIdx = 1; turnNext = Date.now() + turnSeq[0].dur; return;
  }
  dir = nd; face();
}
function sparkle() {
  for (let i = 0; i < 14; i++) {
    const d = document.createElement("div"); d.className = "drop"; d.style.background = i % 2 ? "#ffd23f" : "#ffffff"; d.style.left = "85px"; d.style.top = "115px"; fx.appendChild(d);
    const a = i / 14 * Math.PI * 2, r = 55 + Math.random() * 25;
    d.animate([{transform:"translate(0,0)", opacity:1}, {transform:`translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px)`, opacity:0}], {duration:800, easing:"ease-out"}).finished.then(() => d.remove());
  }
}
function evolve(msg) {
  const before = FR.normal; buildFrames(style); const after = FR.normal;
  setMode("evolving"); pose(""); img.style.rotate = "0deg"; watching = false; lookKey = "";
  let n = 0;
  const iv = setInterval(() => {
    img.src = n % 2 ? before : after; img.style.filter = n % 2 ? "" : "brightness(1.9)"; n++;
    if (n > 9) { clearInterval(iv); img.style.filter = ""; img.src = after; sparkle(); bubble(msg, 1700); toWalk(); sendState(); }
  }, 130);
}
T.event.listen("evo", async e => {
  if (e.payload === "evo:cheveux" && style === "limace") {          // des cheveux, ou plus de cheveux : l'autre feuille, et le même éclat que pour une partie
    cheveux = !cheveux; garder();
    await hairLoad(); hair.a = hair.v = 0; hairPaint();
    say(cheveux ? "evolution : des cheveux" : "evolution : plus de cheveux"); evolve(cheveux ? "Des cheveux !" : "Adieu les cheveux");
    return;
  }
  if (SHEETS[style]) { bubble("Pas encore de parties", 1300); return; }
  const id = e.payload, P = partsBy[style];
  if (id === "evo:reset") { partsBy[style] = style === "classique" ? {} : {}; garder(); say("retour a la forme de depart"); evolve("Retour au départ"); return; }
  let key = id.startsWith("part:") ? id.slice(5) : null;
  if (id === "evo:random") {
    const free = Object.keys(PART_NAME).filter(k => P[k.split(":")[0]] !== k.split(":")[1]);
    key = free[Math.floor(Math.random() * free.length)];
  }
  if (!key) return;
  const [slot, part] = key.split(":");
  garder();
  if (P[slot] === part) { delete P[slot]; say("partie retiree : " + key); evolve(`Adieu ${PART_NAME[key]}`); }
  else { const replaced = P[slot]; P[slot] = part; say("nouvelle partie : " + key); evolve(replaced ? `${PART_NAME[key]} à la place !` : `Nouvelle partie : ${PART_NAME[key]} !`); }
});
// Clic droit : un petit menu sur le Bidule (le menu du Mac, qui n'est pas coupé par la petite fenêtre). On y ajoutera des actions.
img.addEventListener("contextmenu", async e => {
  e.preventDefault();
  try {
    const {Menu, MenuItem, Submenu, CheckMenuItem, PredefinedMenuItem} = T.menu;
    const moods = await Promise.all([["auto", "Automatique"], ...Object.entries(MOOD_LABEL)].map(([id, text]) =>
      CheckMenuItem.new({text, checked:moodMode === id, action:() => { chooseMood(id); sendState(); }})));
    // plusieurs écrans branchés : on choisit sur lequel il vit
    const ecrans = await T.window.availableMonitors().catch(() => []), ici = await T.window.currentMonitor().catch(() => null);
    const surEcran = ecrans.length > 1 ? [await Submenu.new({text:"Écran", items:await Promise.all(ecrans.map((m, i) => CheckMenuItem.new({text:m.name || `Écran ${i + 1}`,
      checked:!!ici && m.position.x === ici.position.x && m.position.y === ici.position.y, action:() => toScreen(m)})))})] : [];
    const menu = await Menu.new({items:[
      await MenuItem.new({text:"Ouvrir le panneau", action:() => T.core.invoke("ouvrir_panneau")}),
      await Submenu.new({text:"Humeur", items:moods}),
      ...surEcran,
      await PredefinedMenuItem.new({item:"Separator"}),
      await MenuItem.new({text:"Cacher le Bidule", action:() => T.core.invoke("montrer_bidule", {oui:false})}),
      await MenuItem.new({text:"Quitter", action:() => T.core.invoke("quit")}),
    ]});
    await menu.popup();
  } catch (err) { say("menu : " + err); }
});
(async () => {
  try {
    const s = await win.scaleFactor(), p = await win.outerPosition();
    x = p.x / s; y = p.y / s; await bounds(); face();
    say("demarre");
    // le Bidule choisi la dernière fois ; au premier lancement, rien ne s'affiche : le panneau s'ouvre pour en choisir un
    let saved = null, E = {};
    try { saved = await T.core.invoke("lire_choix"); } catch (e) { say("choix : " + e); }
    try { E = JSON.parse(await T.core.invoke("lire_etat") || "{}") || {}; } catch (e) { say("etat : " + e); }
    try { apparences = JSON.parse(await T.core.invoke("lire_apparences") || "{}") || {}; } catch (e) { say("apparence : " + e); }
    if (apparences.limace) await Apparence.appliquer(apparences.limace);          // avant le chargement de la feuille : elle ne sera teinte qu'une fois
    // ce qu'on avait choisi la dernière fois (les anciens réglages du navigateur, s'il n'y a pas encore d'état gardé)
    if (E.parties) for (const k in E.parties) partsBy[k] = E.parties[k];
    if (typeof E.cheveux === "boolean") cheveux = E.cheveux;
    if (typeof E.haptique === "boolean") hapticOn = E.haptique;
    // au sol, là où il était ; la fenêtre y va tout de suite (sinon elle attendrait son premier pas, en l'air à sa place de départ)
    if (saved && typeof E.x === "number") { x = Math.max(minX, Math.min(maxX, E.x)); y = floorY; setMode("walk"); gardeX = Math.round(x); push(); }
    if (saved) await chooseStyle(saved); else T.core.invoke("ouvrir_panneau");
    if (E.humeur && E.humeur !== "auto" && MOOD_LABEL[E.humeur]) { moodMode = E.humeur; moodReason = "choisie à la main"; applyMood(moodMode); }
    if (saved && E.cache) T.core.invoke("montrer_bidule", {oui:false});
  } catch (e) { say("init: " + e); }
  // tout ce qui revient régulièrement, dans une seule boucle ; elle part une fois le Bidule choisi chargé, pour ne rien animer à moitié prêt
  Horloge.tache("vie", 0, () => tick());
  Horloge.tache("curseur", () => cursorFar ? 250 : 60, () => watchCursor(), () => chosen && !bidHidden);
  Horloge.tache("pense", 450, penseStep, () => chosen);
  Horloge.tache("humeur", 1500, autoMood);
  Horloge.tache("session", 700, sessionStep);
  Horloge.tache("icone", 40, () => Icone.pas(SHEET_DATA.limace, claudeWaits ? "intrigue" : claudeIdle ? "dort" : "crawl"), () => SHEET_DATA.limace && !bidHidden);          // la feuille a déjà le visage de l'humeur (moodTags)
  Horloge.tache("garder", 5000, garder, () => chosen && mode === "walk" && Math.abs(Math.round(x) - gardeX) > 20);
  Horloge.demarrer(16, (nom, e) => say(nom + " : " + e));
  Fenetre.surErreur((quoi, e) => say(quoi + " : " + e));
  autoMood();
})();
