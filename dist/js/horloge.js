// Une seule boucle pour tout ce qui revient régulièrement. Chaque tâche a sa cadence (en ms, ou une fonction qui la donne)
// et peut dire quand elle n'a pas à tourner. Une tâche asynchrone n'est pas relancée tant que la précédente n'a pas fini.
const Horloge = (() => {
  const taches = new Map();
  let boucle = null, erreur = () => {};
  function pas() {
    const now = performance.now();
    for (const [nom, t] of taches) {
      if (t.occupee || now < t.next || !t.quand()) continue;
      t.next = now + (typeof t.ms === "function" ? t.ms() : t.ms);
      try {
        const r = t.fn(now);
        if (r && r.then) { t.occupee = true; r.catch(e => erreur(nom, e)).finally(() => { t.occupee = false; }); }
      } catch (e) { erreur(nom, e); }
    }
  }
  return {
    tache(nom, ms, fn, quand = () => true) { taches.set(nom, {ms, fn, quand, next:0, occupee:false}); },
    retirer(nom) { taches.delete(nom); },
    demarrer(base, surErreur) { if (boucle) return; erreur = surErreur; boucle = setInterval(pas, base); },
    arreter() { clearInterval(boucle); boucle = null; },
    pas,
  };
})();
