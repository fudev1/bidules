// Le jeu (issue #76) : les stats de la saison, gardées dans etat.json (demarrage.js : garder) et remises à zéro à chaque nouvelle saison.
// Tous les chiffres du jeu sont dans REGLAGES, ajustés en jouant. De Claude Code, seulement les heures des prompts et les quantités de tokens, jamais le texte.
const REGLAGES = {
  saison: {debut:"2026-10-19", jours:14},      // en attendant le fichier « maître » des sprints : une saison tous les 14 jours depuis ce lundi
  tard: {apres:20, avant:7},                    // une soirée tardive : au moins un prompt entre 20 h et 7 h (une par soirée)
  travail: {ecart:1200, reprise:300},           // temps de travail (s) : les écarts de moins de 20 min entre deux prompts, plus 5 min par reprise (comme le panneau)
  pause: {min:1200, max:7200},                  // bonne habitude : une pause de 20 min à 2 h entre deux prompts
  releve: {prompts:60000, tokens:300000},       // ms entre deux relevés des journaux
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
// les tokens de la saison, entrée + sortie sans le cache (main.rs : depenses, par heure) ; jamais en baisse si Claude Code efface de vieux journaux
async function releverTokens() {
  const a = saisonCourante().getTime() / 1000;
  const n = ((await T.core.invoke("depenses")) || []).filter(x => x.heure >= a).reduce((s, x) => s + x.tokens[0] + x.tokens[1], 0);
  if (n > stats.tokens) { stats.tokens = n; garder(); sendState(false); }
}
