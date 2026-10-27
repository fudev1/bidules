// Ce que fait Claude (métadonnées seulement, jamais le texte) : la bulle de pensée, l'état des sessions, l'humeur devinée.
let bidHidden = false;          // caché par un clic droit (main.rs : montrer_bidule)
let calme = false;          // Ne pas déranger : les invitations des amis sont refusées d'elles-mêmes (le panneau s'en charge)
let invite = null;          // le nom de l'ami qui l'invite à jouer, tant que l'invitation attend une réponse dans le panneau
let chosen = false;          // un Bidule a été choisi (au premier lancement, pas encore)
let claudeJ = null;          // la dernière jauge lue (contexte), envoyée au panneau
function sendState(avecClaude = true) { T.event.emit("etat", {style:chosen ? style : null, partsBy, cheveux, thumb:hairComposite(FR.normal, 2), mood, moodMode, moodReason, cache:bidHidden, haptique:hapticOn, calme, apparence:apparences[style] || {}, aUneApparence:Apparence.aUneApparence(style), teintes:Apparence.TEINTES, origine:Apparence.ORIGINE, motifs:Object.fromEntries(Object.entries(Apparence.MOTIFS).map(([m, d]) => [m, {nom:d.nom, teinte:d.teinte}])), jeu:{stats, plein:REGLAGES.plein, fin:saisonFin().getTime(), besoins, etape:etapeBesoins(), reglages:REGLAGES.besoins, collection:collection.length}}); if (avecClaude) T.event.emit("claude", claudeJ); }
function refreshSprite() {
  const cur = {sleep:"dort", carried:"dort", dizzy:"d1", nausea:"n1", pet:"content", laugh:"rire", angry:"fache",
    sulk:"fache", eat:"rire", ooh:"ooh", drowsy:"baille", waking:"baille", fly:"p1", held:"p1"}[mode];
  img.src = FR[cur || "normal"];
}
function moodExtra() {
  if (mood === "guilleret") {
    // perso dessiné : son animation de saut (Aseprite), de profil ou de face, sans le petit bond ajouté par le code
    if (isSheet()) playOnce(watching || Date.now() < idleUntil ? "saut-face" : "saut");
    else { pose("hop"); setTimeout(() => { if (mode === "walk") pose("walk"); }, 450); }
    if (Math.random() < .4) bubble("Youpi !", 900);
  }
  else if (mood === "ronchon") bubble(Math.random() < .5 ? "Pff..." : "Mouais.", 1000);
  else if (mood === "vaseux" && isSheet()) { playInPlace("baille"); bubble("*bâille*", 1100); }
  else if (mood === "vaseux") { img.src = FR.baille; bubble("*bâille*", 1100); setTimeout(() => { if (mode === "walk") img.src = FR.normal; }, 1100); }
  else if (mood === "stresse") { drop(); drop(); drop(); if (Math.random() < .4) bubble("Vite, vite !", 900); }
  else if (mood === "lune") {
    idleUntil = Date.now() + 2500; lookKey = "0,-1"; img.src = LOOK["0,-1"]; if (Math.random() < .5) bubble("Oh... un nuage.", 1300);
    setTimeout(() => { if (mode === "walk" && !watching) img.src = FR.normal; }, 2500);
  }
}
function applyMood(m) {
  mood = m; document.body.dataset.mood = m || ""; for (const id in SHEET_DATA) moodTags(id); buildFrames(style); lookKey = ""; refreshSprite(); sendState();
}
// --- Bulle de pensée : il rumine ce que fait Claude, d'après le nom de l'outil en cours (jamais le texte). Pixel art, 28 × 18, affichée × 2.
// Chaque icône a 2 images de 9 × 7, alternées. Les pastilles du bas montent vers sa tête.
const PENSE_BODY = ["...kkkkkkkkkkkkkkkkkkkkk...", "..kwwwwwwwwwwwwwwwwwwwwwk..", ".kwwwwwwwwwwwwwwwwwwwwwwwk.", "kwwwwwwwwwwwwwwwwwwwwwwwwwk",
  "kwwwwwwwwwwwwwwwwwwwwwwwwwk", "kwwwwwwwwwwwwwwwwwwwwwwwwwk", "kwwwwwwwwwwwwwwwwwwwwwwwwwk", "kwwwwwwwwwwwwwwwwwwwwwwwwwk", "kwwwwwwwwwwwwwwwwwwwwwwwwwk",
  ".kwwwwwwwwwwwwwwwwwwwwwwwk.", "..kwwwwwwwwwwwwwwwwwwwwwk..", "...kkkkkkkkkkkkkkkkkkkkk...", "...........................", "....kkk....................",
  "...kwwwk...................", "....kkk....................", "..kk.......................", "..kk......................."];
const pense = document.createElement("canvas"); pense.width = 28; pense.height = 18; pense.className = "pense off"; fx.appendChild(pense);
let activity = null, penseFrame = 0;
const topCv = document.createElement("canvas"); topCv.width = topCv.height = 64; const topG = topCv.getContext("2d", {willReadFrequently:true});
function spriteTop() {          // première ligne non transparente de l'image affichée (et sa colonne du milieu), en pixels 64 × 64
  topG.clearRect(0, 0, 64, 64); try { topG.drawImage(img, 0, 0, 64, 64); } catch (e) { return {x:40, y:20}; }
  const d = topG.getImageData(0, 0, 64, 64).data;
  for (let y = 0; y < 64; y++) { let a = -1, b = -1; for (let x = 0; x < 64; x++) if (d[(y * 64 + x) * 4 + 3] > 0) { if (a < 0) a = x; b = x; } if (a >= 0) return {x:(a + b) / 2, y}; }
  return {x:40, y:20};
}
function penseStep() {
  // pas pendant qu'on le tire (la fenêtre est agrandie, la bulle serait ailleurs), ni par-dessus une autre bulle (« *bâille* »…)
  const icon = penseIcon(activity), show = !!icon && (mode === "walk" || mode === "pet") && !drag && !pull.on && !fx.querySelector(".bub");
  pense.classList.toggle("off", !show);
  if (!show) return;
  const g = pense.getContext("2d"), frames = PENSE_ICONS[icon], f = frames[penseFrame++ % frames.length];
  g.clearRect(0, 0, 28, 18);
  const paint = (rows, ox, oy) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") { g.fillStyle = PENSE_COL[ch]; g.fillRect(ox + i, oy + j, 1, 1); } }));
  // les pastilles partent de sa tête : à droite de la bulle quand il regarde à droite, à gauche sinon
  const right = dir > 0, body = right ? PENSE_BODY.map((r, j) => j < 12 ? r : [...r].reverse().join("")) : PENSE_BODY;
  // le haut de sa tête dans l'image du moment : la bulle se pose juste au-dessus, les pastilles au-dessus de la tête
  const top = spriteTop(), hx = 24 + (right ? top.x : 63 - top.x) * 2;
  pense.style.top = Math.max(0, 128 - 36 + 48 - (64 - top.y) * 2 - 6) + "px";
  pense.style.left = Math.max(0, Math.min(176 - 56, right ? hx - 50 : hx - 6)) + "px"; pense.style.transformOrigin = right ? "90% 100%" : "10% 100%";
  paint(body, 0, 0); paint(f, 9, 2);
  pense.title = PENSE_LABEL[icon];
}
let noConversation = false, claudeIdle = false, claudeWaits = false;
const NO_CONV_SLEEP = 5000;          // ms de calme avant de se rendormir, le temps de jouer s'il est réveillé à la main
const sleepyNow = () => claudeIdle && Date.now() > finiUntil;          // Claude ne fait rien (pas de conversation, ou réponse finie) : il dort et ne se réveille pas seul, pour te dire d'y retourner
// Claude vient de finir de répondre (hook « Stop » de Claude Code, main.rs) : il te prévient tout de suite, et reste éveillé 20 s avant de s'endormir
let finiUntil = 0;
T.event.listen("claude-fini", () => {
  finiUntil = Date.now() + 20000; calm = 0; say("Claude a fini (hook)");
  if (mode === "sleep" || mode === "drowsy") { wakeUp("fini"); return; }
  bubble("À toi !", 1800);
  if (mode === "walk" && isSheet() && !sheetOnce) { idleUntil = Date.now() + 3000; playOnce(FRONT.has(img.src) ? "saut-face" : "saut"); }
});
// L'état de Claude, toutes sessions confondues (main.rs : sessions, d'après les hooks de Claude Code) : il suffit qu'une session attende
// pour qu'il le montre, même si on regarde une autre session. Sans hooks branchés, on retombe sur la session en cours (contexte).
let waiting = 0, working = 0, lastCall = 0;
async function claudeState() {
  let s = [], j = null;
  try { [s, j] = await Promise.all([T.core.invoke("sessions"), T.core.invoke("contexte")]); } catch (e) { say("etat de Claude: " + e); }
  s = s || [];
  if (s.length) {
    waiting = s.filter(x => x.etat === "attend").length; working = s.filter(x => x.etat === "travaille").length;
    noConversation = false; claudeWaits = waiting > 0; claudeIdle = !waiting && !working;
    activity = working ? (j && j.activite && j.activite !== "pense" ? j.activite : "pense") : null;          // la bulle : l'outil de la session en vue, sinon il pense
  } else {
    noConversation = !j; activity = j ? j.activite : null; claudeIdle = !activity; claudeWaits = !!(j && j.attend);
    waiting = claudeWaits ? 1 : 0; working = activity ? 1 : 0;
  }
  // une session t'attend : il te le dit tout de suite (réveillé s'il dormait), puis te le rappelle toutes les 30 s ; il ne s'endort pas
  const now = Date.now();
  if (waiting) {
    calm = 0;
    if (now - lastCall > 30000) { lastCall = now; if (mode === "sleep" || mode === "drowsy") wakeUp("attend"); else bubble(waitTxt(), 1800); }
  } else lastCall = 0;
  claudeJ = (s.length || j) ? {...(j || {}), attend:claudeWaits, activite:activity, sessions:s} : null;
  T.event.emit("claude", claudeJ);          // le panneau montre les sessions et leur jauge de contexte
}
const waitTxt = () => waiting > 1 ? `${waiting} sessions t'attendent !` : "Une session t'attend !";
// Humeur générale, d'après le rythme de toute la journée (toutes sessions confondues) : l'heure, le temps passé sans vraie pause, le nombre
// de sessions en parallèle et de prompts. L'app ne reçoit que les heures des prompts, jamais leur texte.
let promptsCache = [], promptsAt = 0;          // les heures des prompts : relues au plus une fois par minute
async function guessMood() {
  let times = [];
  if (Date.now() - promptsAt > 60000) { try { promptsCache = await T.core.invoke("prompt_times"); promptsAt = Date.now(); } catch (e) { say("prompt_times: " + e); } }
  times = promptsCache.slice();
  times.sort((a, b) => a - b);
  const now = Date.now() / 1000, h = new Date().getHours(), lastT = times.length ? times[times.length - 1] : null;
  const last10 = times.filter(t => now - t < 600).length, busy = waiting + working;
  let start = lastT;
  for (let i = times.length - 1; i > 0; i--) { if (times[i] - times[i - 1] > 1200) break; start = times[i - 1]; }
  const sessionH = lastT && now - lastT < 1200 ? (lastT - start) / 3600 : 0;
  if (besoins.malade) return ["vaseux", "il est malade"];
  if (etapeBesoins()) return ["ronchon", "il a " + etapeBesoins()];
  if (h >= 20 || h < 7) return ["vaseux", "il est tard"];
  if (sessionH >= 3) return ["vaseux", `tu travailles depuis ${Math.floor(sessionH)} h sans vraie pause`];
  if (busy >= 4) return ["stresse", `${busy} sessions de Claude en même temps`];
  if (last10 > 10) return ["stresse", `${last10} prompts en 10 minutes`];
  if (!lastT || now - lastT > 2700) return ["lune", lastT ? `pas de prompt depuis ${Math.round((now - lastT) / 60)} min` : "pas de prompt récent"];
  return ["guilleret", "rythme régulier"];
}
// l'humeur change lentement : la nouvelle doit tenir une minute avant d'être prise (sauf la toute première)
const MOOD_HOLD = 60000;
let moodNext = null, moodNextSince = 0, moodBusy = false;
// une seule relecture à la fois : si les journaux sont longs à lire, les suivantes ne s'empilent pas derrière
async function autoMood() {
  if (moodBusy) return;
  moodBusy = true;
  try { await autoMoodLire(); } finally { moodBusy = false; }
}
async function autoMoodLire() {
  await claudeState();
  // l'humeur choisie à la main ne change pas, mais la bulle et le sommeil suivent toujours Claude
  if (moodMode === "auto") {
    const [m, why] = await guessMood(), now = Date.now(), avant = moodReason;
    moodReason = noConversation ? why + ", aucune session en cours, il dort" : claudeIdle ? why + ", Claude a fini partout, il dort" : why;
    if (m !== moodNext) { moodNext = m; moodNextSince = now; }
    if (m !== mood && (mood === null || now - moodNextSince >= MOOD_HOLD)) { say(`humeur devinee : ${m} (${why})`); applyMood(m); } else if (moodReason !== avant) sendState(false);          // claudeState vient d'envoyer "claude"
  }
  if (!claudeIdle && mode === "sleep" && Date.now() - sleepSince > 3000) wakeUp(claudeWaits ? "attend" : "seul");   // Claude se remet au travail : il se réveille
}
function chooseMood(m) {
  moodMode = m; garder();
  if (moodMode === "auto") { mood = null; autoMood(); }
  else { moodReason = "choisie à la main"; say("humeur choisie : " + moodMode); applyMood(moodMode); bubble(MOOD_LABEL[moodMode], 1200); }
}
T.event.listen("mood", e => chooseMood(e.payload));
// On change de session dans Claude Desktop : on relit tout de suite son état, sans attendre les 3 s.
let lastSession;
async function sessionStep() {
  const id = await T.core.invoke("session_active");
  if (lastSession !== undefined && id !== lastSession) autoMood();
  lastSession = id;
}
T.event.listen("bidule-visible", e => { bidHidden = !e.payload; Icone.oublier(); garder(); sendState(); });      // caché : l'icône reste au repos (main.rs)
T.event.listen("bonbon-clic", e => {
  say("bonbon-clic reçu : " + e.payload);
  const s = sweets.find(c => c.id === e.payload);
  if (!s || wanted.includes(s) || (feeding && feeding.s === s)) return;
  wanted.push(s); disturb(); say("clic sur un bonbon");
});
T.event.listen("demande-etat", sendState);
