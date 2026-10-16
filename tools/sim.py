# Page de test du Bidule dans un navigateur, sans l'app : l'API Tauri est remplacée par une fausse, le vrai code de dist/index.html et dist/js tourne.
# Usage :
#   python3 tools/sim.py /tmp/bidule-sim
#   python3 -m http.server 4390 --directory /tmp/bidule-sim      puis ouvrir http://localhost:4390/test.html
# Pour avancer le temps image par image (dans la console de la page) :
#   Horloge.arreter(); V = Date.now(); Date.now = () => V; performance.now = () => V; lastT = V;
#   for (let t = 0; t < 3000; t += 16) { V += 16; Horloge.pas(); }      // 3 s de vie du Bidule, toutes les tâches comprises
# Ou seulement l'animation : realTick = tick; tick = () => {}; puis realTick() à chaque pas.
# Pour simuler des commandes lentes (la lecture des journaux) : window.DELAI = {sessions: 2000}, en ms, avant le chargement de la page (addInitScript).
# Les appels aux commandes Rust (hors "log") et les déplacements de la fenêtre (setPosition, setSize) sont gardés dans CALLS ; LISTEN[nom] liste les fonctions qui écoutent un événement, pour en simuler un :
#   LISTEN["bonbon-clic"].forEach(f => f({payload: 1}))
# La souris : T.window.cursorPosition = async () => ({x: ..., y: ...}), l'horloge la relit toute seule.
import os, sys
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist")
out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/bidule-sim"
os.makedirs(out, exist_ok=True)
for name in ("bidule64.js", "monstre64.js", "pense.js", "persos"):
    link = os.path.join(out, name)
    if not os.path.lexists(link): os.symlink(os.path.join(DIST, name), link)
STUB = """<script>
window.LOG = []; window.CALLS = []; window.LISTEN = {}; window.DELAI = window.DELAI || {};
const noop = async () => {};
window.__TAURI__ = {
  core: {invoke: async (c, a) => { if (c === "log") LOG.push([Date.now(), a.msg]); else CALLS.push([Date.now(), c, a]); if (DELAI[c]) await new Promise(r => setTimeout(r, DELAI[c])); return c === "prompt_times" ? [] : c === "lire_choix" ? "limace" : null; }},
  event: {emit: noop, listen: async (n, f) => { (LISTEN[n] = LISTEN[n] || []).push(f); return () => {}; }},
  dpi: {LogicalPosition: function (x, y) { this.x = x; this.y = y; }, LogicalSize: function (w, h) { this.w = w; this.h = h; }},
  window: {cursorPosition: async () => ({x: -5000, y: -5000}),
    currentMonitor: async () => ({scaleFactor: 1, position: {x: 0, y: 0}, size: {width: 1400, height: 900}, workArea: {position: {x: 0, y: 0}, size: {width: 1400, height: 900}}}),
    getCurrentWindow: () => ({setPosition: async p => { CALLS.push([Date.now(), "setPosition", p]); }, setSize: async t => { CALLS.push([Date.now(), "setSize", t]); }, close: noop, scaleFactor: async () => 1, outerPosition: async () => ({x: 600, y: 700})})},
  webview: {getCurrentWebview: () => ({onDragDropEvent: () => {}})}
};
</script>
"""
s = open(os.path.join(DIST, "index.html")).read()
s = s.replace('<script src="bidule64.js"></script>', STUB + '<script src="bidule64.js"></script>', 1)
open(os.path.join(out, "test.html"), "w").write(s)
# le code du Bidule (dist/js), recopié : un onglet caché ne décode jamais les images, on attend leur chargement à la place
os.makedirs(os.path.join(out, "js"), exist_ok=True)
for name in os.listdir(os.path.join(DIST, "js")):
    js = open(os.path.join(DIST, "js", name)).read()
    js = js.replace("await im.decode();", "await new Promise(r => { if (im.complete && im.naturalWidth) r(); else im.onload = r; });")
    open(os.path.join(out, "js", name), "w").write(js)
print("page de test :", os.path.join(out, "test.html"))
