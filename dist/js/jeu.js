// Le jeu (issue #76) : les stats de la saison, gardées dans etat.json (demarrage.js : garder) et remises à zéro à chaque nouvelle saison.
// Tous les chiffres du jeu sont dans REGLAGES, ajustés en jouant. De Claude Code, seulement les heures des prompts et les quantités de tokens, jamais le texte.
const REGLAGES = {
  saison: {debut:"2026-10-19", jours:14},      // en attendant le fichier « maître » des sprints : une saison tous les 14 jours depuis ce lundi
  tard: {apres:20, avant:7},                    // une soirée tardive : au moins un prompt entre 20 h et 7 h (une par soirée)
  travail: {ecart:1200, reprise:300},           // temps de travail (s) : les écarts de moins de 20 min entre deux prompts, plus 5 min par reprise (comme le panneau)
  pause: {min:1200, max:7200},                  // bonne habitude : une pause de 20 min à 2 h entre deux prompts
  releve: {prompts:60000, tokens:300000},       // ms entre deux relevés des journaux
  // trois jauges de 100 (plein, il va bien) à 0. La faim descend avec le temps de l'app (faim par heure) et les tokens (par million) ; un repas la remplit.
  // La soif descend quand tu travailles (soif par heure) et remonte pendant tes pauses (boit par heure, après pause secondes sans prompt).
  // Sous bas il a faim ou soif ; une jauge à 0 le rend malade, il guérit quand les deux repassent au-dessus de guerit.
  // Malade, la vie se vide en squelette secondes, puis il devient un squelette ; sinon elle remonte (soin par heure).
  besoins: {pas:10000, faim:10, parMillionTokens:10, repas:35, soif:20, boit:60, pause:600, bas:40, guerit:50, squelette:3600 * 6, soin:10},
  // la valeur d'une barre pleine dans le tableau du panneau, pour une saison ; servira aussi à trouver la stat dominante
  plein: {repas:40, secousses:20, malade:3600 * 24, jeux:20, habitudes:30, tard:6, travail:3600 * 60, tokens:20e6},
};
const STATS_VIDES = {repas:0, secousses:0, malade:0, jeux:0, habitudes:0, tard:0, travail:0, tokens:0};
let stats = {saison:"", ...STATS_VIDES, vu:0, soiree:""};      // vu : l'heure du dernier prompt compté ; soiree : la dernière soirée tardive comptée

function cleJour(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function saisonDebut(now = Date.now()) {
  const d = new Date(REGLAGES.saison.debut + "T00:00"), k = Math.floor((now - d) / (86400000 * REGLAGES.saison.jours));
  d.setDate(d.getDate() + k * REGLAGES.saison.jours); return d;
}
// la saison en cours ; si elle a changé depuis le dernier compte, tout repart à zéro
function saisonCourante() {
  const d = saisonDebut(), cle = cleJour(d);
  if (stats.saison !== cle) { stats = {saison:cle, ...STATS_VIDES, vu:d.getTime() / 1000, soiree:""}; say("nouvelle saison : " + cle); garder(); }
  return d;
}
function saisonFin() { const d = saisonDebut(); d.setDate(d.getDate() + REGLAGES.saison.jours); return d; }
function compter(nom, n = 1) { saisonCourante(); stats[nom] += n; garder(); sendState(false); }
// Les besoins (gardés dans etat.json) : les trois jauges et malade ; essai : posé par l'onglet Tests, rien ne compte dans les stats.
// collection : les squelettes, {style, apparence, quand} (essai : vrai pour ceux de l'onglet Tests).
const BESOINS_PLEINS = {faim:100, soif:100, vie:100, malade:false};
let besoins = {...BESOINS_PLEINS}, collection = [], besoinsVu = 0, tokensLus = false;
function etapeBesoins() { const B = REGLAGES.besoins; return besoins.malade ? "malade" : besoins.faim < B.bas ? "faim" : besoins.soif < B.bas ? "soif" : ""; }
// la tâche « besoins » : l'écart avec son dernier passage, plafonné, pour que l'app fermée ou en veille ne compte pas
function pasBesoins() {
  const now = Date.now(), s = besoinsVu ? Math.min(now - besoinsVu, 2 * REGLAGES.besoins.pas) / 1000 : 0;
  besoinsVu = now; avancerBesoins(s); sendState(false);
}
// s secondes de vie, app ouverte
function avancerBesoins(s) {
  const B = REGLAGES.besoins, avant = etapeBesoins(), travaille = Date.now() / 1000 - stats.vu < B.pause;
  besoins.faim = Math.max(0, besoins.faim - s * B.faim / 3600);
  besoins.soif = Math.max(0, Math.min(100, besoins.soif + s * (travaille ? -B.soif : B.boit) / 3600));
  if (besoins.malade) { besoins.vie -= s * 100 / B.squelette; if (!besoins.essai) compter("malade", s); }
  else besoins.vie = Math.min(100, besoins.vie + s * B.soin / 3600);
  guerir();
  if (besoins.vie <= 0) return squelette();
  changerEtape(avant);
}
function guerir() {
  const B = REGLAGES.besoins;
  if (!besoins.malade && (besoins.faim <= 0 || besoins.soif <= 0)) besoins.malade = true;
  else if (besoins.malade && besoins.faim >= B.guerit && besoins.soif >= B.guerit) besoins.malade = false;
}
function nourrir(compte = true) {
  const avant = etapeBesoins();
  besoins.faim = Math.min(100, besoins.faim + REGLAGES.besoins.repas);
  guerir();
  if (compte) compter("repas");
  changerEtape(avant);
}
function changerEtape(avant) {
  const e = etapeBesoins();
  if (e !== avant) {
    say("besoins : " + (e || "bien"));
    if (e === "faim" && avant === "") bubble("J'ai faim !", 1400);
    if (e === "soif" && avant !== "malade") bubble("J'ai soif !", 1400);
    if (e === "malade") bubble("Je suis malade...", 1600);
    if (avant === "malade") bubble("Ça va mieux !", 1400);
    Apparence.etat(e === "malade" ? "malade" : "");
    if (e === "") delete besoins.essai;
  }
  garder(); sendState(false);
}
// Malade trop longtemps : il devient un squelette et part dans la collection, puis un nouvel œuf éclot (pas encore dessiné : il se reforme).
function squelette() {
  collection.push({style, apparence:apparences[style] || {}, quand:Date.now(), ...(besoins.essai && {essai:true})});
  besoins = {...BESOINS_PLEINS, vie:0}; say("il devient un squelette");
  Apparence.etat("squelette"); bubble("...", 2000); garder(); sendState(false);
  setTimeout(() => {
    besoins.vie = 100; Apparence.etat(""); if (isSheet()) playInPlace("reforme");
    bubble("Un nouvel œuf a éclos !", 2000);
  }, 6000);
}
// les prompts arrivés depuis le dernier relevé (main.rs : prompt_times, ceux des 5 dernières heures)
async function releverPrompts() {
  saisonCourante();
  const ts = ((await T.core.invoke("prompt_times")) || []).sort((a, b) => a - b), R = REGLAGES;
  let avant = ts.filter(t => t <= stats.vu).pop(), n = 0;
  for (const t of ts) {
    if (t <= stats.vu) continue;
    const ecart = avant === undefined ? Infinity : t - avant, d = new Date(t * 1000), h = d.getHours();
    stats.travail += ecart <= R.travail.ecart ? ecart : R.travail.reprise;
    if (ecart >= R.pause.min && ecart <= R.pause.max) stats.habitudes++;
    if (h >= R.tard.apres || h < R.tard.avant) {
      if (h < R.tard.avant) d.setDate(d.getDate() - 1);          // après minuit : la soirée de la veille
      if (cleJour(d) !== stats.soiree) { stats.soiree = cleJour(d); stats.tard++; }
    }
    avant = stats.vu = t; n++;
  }
  if (n) { garder(); sendState(false); }
}
// Onglet Tests du panneau : sauter à une étape sans attendre ; « zero » remet tout à zéro et retire les squelettes des essais
T.event.listen("besoins", e => {
  const B = REGLAGES.besoins, avant = etapeBesoins();
  if (e.payload === "nourrir") return nourrir(false);
  if (e.payload === "zero") { besoins = {...BESOINS_PLEINS}; collection = collection.filter(c => !c.essai); return changerEtape(avant); }
  besoins = {...BESOINS_PLEINS, ...{faim:{faim:B.bas / 2}, soif:{soif:B.bas / 2}, malade:{faim:0, malade:true}, squelette:{faim:0, malade:true, vie:0}}[e.payload], essai:true};
  if (e.payload === "squelette") squelette(); else changerEtape(avant);
});
// les tokens de la saison, entrée + sortie sans le cache (main.rs : depenses, par heure) ; jamais en baisse si Claude Code efface de vieux journaux
async function releverTokens() {
  const a = saisonCourante().getTime() / 1000;
  const n = ((await T.core.invoke("depenses")) || []).filter(x => x.heure >= a).reduce((s, x) => s + x.tokens[0] + x.tokens[1], 0);
  // la faim prend les tokens arrivés pendant que l'app tourne : pas ceux du premier relevé, faits app fermée
  if (n > stats.tokens) { if (tokensLus) besoins.faim = Math.max(0, besoins.faim - (n - stats.tokens) / 1e6 * REGLAGES.besoins.parMillionTokens); stats.tokens = n; garder(); sendState(false); }
  tokensLus = true;
}
