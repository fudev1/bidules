// Les règles du duel, calculées chez l'hôte seulement : la balle, les raquettes, le score. Terrain fixe de 160 × 90 (16:9),
// le joueur 0 (l'hôte) à gauche, le joueur 1 à droite ; chacun le voit de son côté par vue(). Sans fenêtre ni réseau.
const DuelJeu = (() => {
  const W = 160, H = 90, BALLE = 2.4;
  const BORD = 6, EPAISSEUR = 2, DEMI = 8;              // les raquettes : à 6 du bord, 2 d'épaisseur, 16 de haut
  const VITESSE = 60, PAUSE = 1;                        // par seconde ; la pause au centre avant chaque service

  // hasard : pour le côté du premier service et l'angle de chaque service (remplaçable dans les tests)
  function nouveau({aAtteindre = 5, hasard = Math.random} = {}) {
    return {balle: {x: W / 2, y: H / 2, vx: 0, vy: 0}, raquettes: [H / 2, H / 2], score: [0, 0], aAtteindre, hasard,
      attente: PAUSE, service: hasard() < .5 ? 0 : 1, gagnant: null};
  }

  // la balle part du centre vers le joueur `service`, un peu en biais (au plus 25°)
  function servir(etat) {
    const a = (etat.hasard() * 2 - 1) * 25 * Math.PI / 180, vers = etat.service === 0 ? -1 : 1;
    Object.assign(etat.balle, {x: W / 2, y: H / 2, vx: vers * VITESSE * Math.cos(a), vy: VITESSE * Math.sin(a)});
  }

  function pas(etat, dt) {
    const b = etat.balle, vus = [];
    if (etat.gagnant !== null) return vus;
    if (etat.attente > 0) { etat.attente -= dt; if (etat.attente <= 0) servir(etat); return vus; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < BALLE / 2) { b.y = BALLE - b.y; b.vy = Math.abs(b.vy); vus.push("rebond"); }
    if (b.y > H - BALLE / 2) { b.y = 2 * (H - BALLE / 2) - b.y; b.vy = -Math.abs(b.vy); vus.push("rebond"); }
    // la face de chaque raquette, côté terrain : la balle qui la traverse en venant vers elle, à sa hauteur, repart dans l'autre sens
    for (const j of [0, 1]) {
      const face = j === 0 ? BORD + EPAISSEUR / 2 + BALLE / 2 : W - BORD - EPAISSEUR / 2 - BALLE / 2, vers = j === 0 ? -1 : 1;
      const avant = b.x - b.vx * dt;
      if (Math.sign(b.vx) === vers && (avant - face) * vers <= 0 && (b.x - face) * vers > 0 && Math.abs(b.y - etat.raquettes[j]) <= DEMI + BALLE / 2) {
        b.x = 2 * face - b.x; b.vx = -b.vx; vus.push("renvoi");
      }
    }
    // sortie par un côté : le point à l'autre joueur, puis le service vers celui qui l'a perdu, ou la fin du duel
    if (b.x < -BALLE || b.x > W + BALLE) {
      const perdant = b.x < 0 ? 0 : 1, marqueur = 1 - perdant;
      etat.score[marqueur]++; vus.push("point");
      Object.assign(b, {x: W / 2, y: H / 2, vx: 0, vy: 0});
      if (etat.score[marqueur] >= etat.aAtteindre) { etat.gagnant = marqueur; vus.push("fin"); }
      else { etat.service = perdant; etat.attente = PAUSE; }
    }
    return vus;
  }

  // la hauteur du centre d'une raquette, gardée dans le terrain
  function bouger(etat, joueur, y) { etat.raquettes[joueur] = Math.max(DEMI, Math.min(H - DEMI, y)); }

  // ce que voit un joueur : lui-même à gauche (le terrain retourné pour le joueur 1), son score en premier ; gagne : null pendant le duel.
  // C'est aussi ce que l'hôte envoie à l'invité, déjà retourné.
  function vue(etat, joueur) {
    const b = etat.balle, autre = 1 - joueur;
    return {balle: {x: joueur === 0 ? b.x : W - b.x, y: b.y}, moi: etat.raquettes[joueur], lui: etat.raquettes[autre],
      score: [etat.score[joueur], etat.score[autre]], gagne: etat.gagnant === null ? null : etat.gagnant === joueur};
  }

  return {W, H, BALLE, BORD, EPAISSEUR, DEMI, nouveau, pas, bouger, vue};
})();
if (typeof module !== "undefined") module.exports = DuelJeu;
