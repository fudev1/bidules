// Les règles du duel (dist/js/duel-jeu.js), sans navigateur : mise run tests
const {test} = require("node:test");
const assert = require("node:assert/strict");
const DuelJeu = require("../dist/js/duel-jeu.js");

// fait avancer le duel par petits pas, en gardant les événements
function avancer(etat, secondes) {
  const vus = [];
  for (let t = 0; t < secondes; t += 1 / 120) vus.push(...DuelJeu.pas(etat, 1 / 120));
  return vus;
}

// pose la balle en plein échange, sans la pause du service
function enJeu(etat, balle) { Object.assign(etat.balle, balle); etat.attente = 0; }

test("la balle rebondit sur le haut du terrain", () => {
  const etat = DuelJeu.nouveau();
  enJeu(etat, {x: 80, y: 10, vx: 0, vy: -40});
  const vus = avancer(etat, 0.5);
  assert.ok(vus.includes("rebond"));
  assert.ok(etat.balle.vy > 0, "elle redescend");
  assert.ok(etat.balle.y > 0);
});

test("la raquette de l'hôte renvoie la balle qui arrive sur elle", () => {
  const etat = DuelJeu.nouveau();
  DuelJeu.bouger(etat, 0, 45);
  enJeu(etat, {x: 30, y: 45, vx: -60, vy: 0});
  const vus = avancer(etat, 0.6);
  assert.ok(vus.includes("renvoi"));
  assert.ok(etat.balle.vx > 0, "elle repart vers la droite");
  assert.deepEqual(etat.score, [0, 0]);
});

test("une balle qui passe à côté de la raquette donne le point à l'autre", () => {
  const etat = DuelJeu.nouveau();
  DuelJeu.bouger(etat, 0, 80);
  enJeu(etat, {x: 30, y: 20, vx: -60, vy: 0});
  const vus = avancer(etat, 1);
  assert.ok(vus.includes("point"));
  assert.deepEqual(etat.score, [0, 1]);
});

test("après un point, la balle attend un instant au centre puis part vers celui qui l'a perdu", () => {
  const etat = DuelJeu.nouveau();
  DuelJeu.bouger(etat, 0, 80);
  enJeu(etat, {x: 10, y: 20, vx: -60, vy: 0});
  avancer(etat, 0.3);
  assert.deepEqual(etat.score, [0, 1]);
  assert.equal(etat.balle.vx, 0, "pas tout de suite");
  avancer(etat, 1.5);
  assert.ok(etat.balle.vx < 0, "vers l'hôte, qui a perdu le point");
});

test("au début, la balle part toute seule", () => {
  const etat = DuelJeu.nouveau();
  avancer(etat, 1.5);
  assert.notEqual(etat.balle.vx, 0);
});

test("le premier à 5 points gagne, et la balle s'arrête", () => {
  const etat = DuelJeu.nouveau();
  etat.score = [4, 2];
  DuelJeu.bouger(etat, 1, 10);
  enJeu(etat, {x: 150, y: 80, vx: 60, vy: 0});
  const vus = avancer(etat, 0.5);
  assert.ok(vus.includes("fin"));
  assert.equal(etat.gagnant, 0);
  avancer(etat, 3);
  assert.equal(etat.balle.vx, 0);
  assert.deepEqual(etat.score, [5, 2]);
});

test("chaque joueur se voit à gauche : le terrain est retourné chez l'invité", () => {
  const etat = DuelJeu.nouveau();
  DuelJeu.bouger(etat, 0, 20); DuelJeu.bouger(etat, 1, 70);
  enJeu(etat, {x: 40, y: 30, vx: 60, vy: 0});
  etat.score = [3, 1];
  assert.deepEqual(DuelJeu.vue(etat, 0), {balle: {x: 40, y: 30}, moi: 20, lui: 70, score: [3, 1], gagne: null});
  assert.deepEqual(DuelJeu.vue(etat, 1), {balle: {x: 120, y: 30}, moi: 70, lui: 20, score: [1, 3], gagne: null});
  etat.gagnant = 1;
  assert.equal(DuelJeu.vue(etat, 1).gagne, true);
  assert.equal(DuelJeu.vue(etat, 0).gagne, false);
});
