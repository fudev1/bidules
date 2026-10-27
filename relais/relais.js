// Le relais du duel (voir docs/adr/0003-duel-par-un-relais-sur-internet.md) : il apparie deux Bidules par un code de 4 lettres
// et fait passer leurs messages sans les lire. Rien n'est gardé une fois le duel fini.
//   /creer : un nouveau défi, le code revient en {"t":"code"} ; /rejoindre/KZPQ : le défi de ce code.
//   Chaque Bidule envoie d'abord {"t":"nom"} ; les deux arrivés, chacun reçoit {"t":"go","nom":<l'autre>}, puis tout passe tel quel.
//   Fins avant le duel : {"t":"inconnu"} (pas de défi à ce code, ou duel déjà commencé), {"t":"expire"} (personne n'est venu).

const LETTRES = "ABCDEFGHJKLMNPQRSTUVWXYZ";  // sans I ni O, qu'on confond avec 1 et 0
const ATTENTE = 15 * 60 * 1000;              // le temps qu'un défi attend l'autre joueur

export default {
  async fetch(req, env) {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("Le relais du duel des Bidules.\n", {status: 426});
    const chemin = new URL(req.url).pathname;
    const defi = code => env.DEFIS.get(env.DEFIS.idFromName(code));
    if (chemin === "/creer") {
      // un code déjà pris répond 409 : on en tire un autre
      for (let i = 0; i < 5; i++) {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(4)), n => LETTRES[n % LETTRES.length]).join("");
        const r = await defi(code).fetch(new Request(`https://defi/creer/${code}`, req));
        if (r.status !== 409) return r;
      }
      return new Response("Pas de code libre.\n", {status: 503});
    }
    const m = chemin.match(/^\/rejoindre\/([A-Z]{4})$/);
    if (!m) return new Response("Inconnu.\n", {status: 404});
    return defi(m[1]).fetch(new Request(`https://defi/rejoindre/${m[1]}`, req));
  },
};

// Un défi : les deux joueurs d'un code, chacun {ws, nom}.
export class Defi {
  constructor() { this.joueurs = []; }

  async fetch(req) {
    const [, action, code] = new URL(req.url).pathname.split("/");
    if (action === "creer" && this.joueurs.length) return new Response(null, {status: 409});
    const [client, ws] = Object.values(new WebSocketPair());
    ws.accept();
    const reponse = new Response(null, {status: 101, webSocket: client});
    if (action === "rejoindre" && this.joueurs.length !== 1) { ws.send('{"t":"inconnu"}'); ws.close(1000, "inconnu"); return reponse; }

    const moi = {ws, nom: null};
    this.joueurs.push(moi);
    if (action === "creer") {
      ws.send(JSON.stringify({t: "code", code}));
      this.minuteur = setTimeout(() => { if (this.joueurs.length === 1) { ws.send('{"t":"expire"}'); this.fin(); } }, ATTENTE);
    }
    ws.addEventListener("message", e => {
      if (moi.nom === null) {
        try { moi.nom = String(JSON.parse(e.data).nom || "?").slice(0, 40); } catch { moi.nom = "?"; }
        return this.lancer();
      }
      const autre = this.joueurs.find(j => j !== moi);
      if (autre?.nom != null) autre.ws.send(e.data);
    });
    ws.addEventListener("close", () => this.fin());
    ws.addEventListener("error", () => this.fin());
    return reponse;
  }

  lancer() {
    const [a, b] = this.joueurs;
    if (!b || a.nom === null || b.nom === null) return;
    clearTimeout(this.minuteur);
    // celui qui attendait a pu perdre sa connexion sans qu'on le sache : on arrête tout, l'autre le voit
    try {
      a.ws.send(JSON.stringify({t: "go", nom: b.nom}));
      b.ws.send(JSON.stringify({t: "go", nom: a.nom}));
    } catch { this.fin(); }
  }

  // un joueur parti : on ferme l'autre, et le code redevient libre
  fin() {
    clearTimeout(this.minuteur);
    for (const j of this.joueurs) { try { j.ws.close(1000, "fin"); } catch {} }
    this.joueurs = [];
  }
}
