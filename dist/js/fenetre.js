// Tous les déplacements et changements de taille de la fenêtre du Bidule passent par ici.
// aller() ne garde que la dernière position voulue : une seule demande à la fois, et rien si la fenêtre y est déjà.
const Fenetre = (() => {
  const T = window.__TAURI__, win = T.window.getCurrentWindow(), {LogicalPosition, LogicalSize} = T.dpi;
  let voulue = null, enCours = null, ici = null, gen = 0, erreur = () => {};
  async function vider() {
    while (voulue) {
      const [x, y, apres] = voulue, k = x + "," + y, g = gen; voulue = null;
      if (k !== ici) {
        try { await win.setPosition(new LogicalPosition(x, y)); if (g === gen) ici = k; } catch (e) { erreur("position", e); }
      }
      if (apres) apres();
    }
  }
  function lancer() { enCours = vider().finally(() => { enCours = null; if (voulue) lancer(); }); return enCours; }
  // cadre, taille et position changent la fenêtre sans passer par la file : la dernière position connue ne vaut plus
  const autre = () => { voulue = null; ici = null; gen++; };
  return {
    surErreur(f) { erreur = f; },
    aller(x, y, apres) { voulue = [Math.round(x), Math.round(y), apres]; return enCours || lancer(); },
    oublier() { voulue = null; },
    cadre(x, y, w, h) { autre(); return T.core.invoke("cadre", {x:Math.round(x), y:Math.round(y), w, h}); },          // main.rs : déplace et redimensionne en un seul appel
    taille(w, h) { autre(); return win.setSize(new LogicalSize(w, h)); },
    position(x, y) { autre(); return win.setPosition(new LogicalPosition(Math.round(x), Math.round(y))); },
  };
})();
