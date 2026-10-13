# Page de test du Bidule dans un navigateur, sans l'app : l'API Tauri est remplacée par une fausse, le vrai code de dist/index.html tourne.
# Usage :
#   python3 tools/sim.py /tmp/bidule-sim
#   python3 -m http.server 4390 --directory /tmp/bidule-sim      puis ouvrir http://localhost:4390/test.html
# Pour avancer le temps image par image (dans la console de la page) :
#   V = Date.now(); Date.now = () => V; performance.now = () => V; realTick = tick; tick = () => {}; lastT = V;
#   for (let t = 0; t < 3000; t += 16) { V += 16; realTick(); }      // 3 s de vie du Bidule
# Les appels aux commandes Rust (hors "log") sont gardés dans CALLS ; LISTEN[nom] liste les fonctions qui écoutent un événement, pour en simuler un :
#   LISTEN["bonbon-clic"].forEach(f => f({payload: 1}))
# La souris : T.window.cursorPosition = async () => ({x: ..., y: ...}), puis appeler watchCursor() de temps en temps.
import os, sys
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist")
out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/bidule-sim"
os.makedirs(out, exist_ok=True)
for name in ("bidule64.js", "monstre64.js", "persos"):
    link = os.path.join(out, name)
    if not os.path.lexists(link): os.symlink(os.path.join(DIST, name), link)
STUB = """<script>
window.LOG = []; window.CALLS = []; window.LISTEN = {};
const noop = async () => {};
window.__TAURI__ = {
  core: {invoke: async (c, a) => { if (c === "log") LOG.push([Date.now(), a.msg]); else CALLS.push([Date.now(), c, a]); return c === "prompt_times" ? [] : c === "lire_choix" ? "limace" : null; }},
  event: {emit: noop, listen: async (n, f) => { (LISTEN[n] = LISTEN[n] || []).push(f); return () => {}; }},
  dpi: {LogicalPosition: function (x, y) { this.x = x; this.y = y; }, LogicalSize: function (w, h) { this.w = w; this.h = h; }},
  window: {cursorPosition: async () => ({x: -5000, y: -5000}),
    currentMonitor: async () => ({scaleFactor: 1, position: {x: 0, y: 0}, size: {width: 1400, height: 900}, workArea: {position: {x: 0, y: 0}, size: {width: 1400, height: 900}}}),
    getCurrentWindow: () => ({setPosition: noop, setSize: noop, close: noop, scaleFactor: async () => 1, outerPosition: async () => ({x: 600, y: 700})})},
  webview: {getCurrentWebview: () => ({onDragDropEvent: () => {}})}
};
</script>
"""
s = open(os.path.join(DIST, "index.html")).read()
s = s.replace('<script src="bidule64.js"></script>', STUB + '<script src="bidule64.js"></script>', 1)
# un onglet caché ne décode jamais les images : on attend leur chargement à la place
s = s.replace("await im.decode();", "await new Promise(r => { if (im.complete && im.naturalWidth) r(); else im.onload = r; });")
open(os.path.join(out, "test.html"), "w").write(s)
print("page de test :", os.path.join(out, "test.html"))
