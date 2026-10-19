// La page de test (tools/sim.py) servie localement et ouverte dans Chromium, pour les tests.
// CHROMIUM=/chemin/vers/chrome pour un Chromium déjà installé, sinon celui de Playwright.
const {chromium} = require("playwright");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs"), http = require("node:http"), os = require("node:os"), path = require("node:path");

const TYPES = {".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".json": "application/json"};

async function demarrer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bidule-sim-"));
  execFileSync("python3", [path.join(__dirname, "..", "tools", "sim.py"), dir], {stdio: "ignore"});
  const serveur = http.createServer((req, res) => {
    const f = path.join(dir, decodeURIComponent(req.url.split("?")[0]));
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {"Content-Type": TYPES[path.extname(f)] || "application/octet-stream"}); res.end(data);
    });
  });
  await new Promise(r => serveur.listen(0, "127.0.0.1", r));
  const navigateur = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
  const url = `http://127.0.0.1:${serveur.address().port}/test.html`;
  return {
    // delai : {commande: ms} pour des commandes Rust lentes
    async ouvrir({delai = {}, attendre = true, taille = {width: 900, height: 900}} = {}) {
      const page = await navigateur.newPage({viewport: taille});
      page.erreurs = []; page.on("pageerror", e => page.erreurs.push(e.message));
      await page.addInitScript(d => { window.DELAI = d; }, delai);
      await page.goto(url, {waitUntil: "domcontentloaded"});
      if (attendre) await page.waitForFunction(() => chosen, null, {timeout: 10000});
      return page;
    },
    async fermer() { await navigateur.close(); serveur.close(); fs.rmSync(dir, {recursive: true, force: true}); },
  };
}
module.exports = {demarrer};
