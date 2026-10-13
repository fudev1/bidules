# Bidules : consignes pour Claude

Compagnon de bureau pour les utilisateurs de Claude Code. La vision et l'installation sont dans `README.md`, l'état du projet et les décisions dans `NOTES.md`.

## Où est quoi

- `dist/index.html` : tout le comportement du Bidule (JavaScript sans framework, sans étape de build).
- `dist/panel.html` : le panneau de la barre de menus. `dist/monstre64.js` et `dist/bidule64.js` : les monstres générés par le code.
- `dist/persos/limace/` : la feuille d'images de la limace, recopiée depuis `animations/limace-complete/`.
- `src-tauri/src/main.rs` : l'app de bureau en Rust (fenêtre, icône, lecture des journaux de Claude Code).
- `animations/` : les animations dessinées, un dossier par animation. `animations/limace-complete/gen.py` assemble la feuille de la limace.
- `tools/sim.py` : page de test du Bidule dans un navigateur, sans l'app.
- `moodboard/` : direction artistique, spec des animations (`animations-des-bidules.html`), animations à dessiner (`planches-limace.html`), et `style-bidules.md` : le style des Bidules, à lire avant de dessiner, générer ou retoucher une image.
- `.mcp.json` : les serveurs MCP `aseprite` (fichiers `.aseprite`, sans ouvrir l'app), `aseprite-live` (dessin en direct dans l'Aseprite ouvert) et `pixellab` (anime une pose, calcule les images entre deux poses ; jeton dans `PIXELLAB_SECRET`). Installation : README, « Faire éditer Aseprite par Claude Code ». Après une retouche d'un `.aseprite`, `mise run publier` pour que l'app la voie. Pour travailler dans Aseprite avec Claude (connexion, réparation, règles) : skill `aseprite-mcp`.

## Lancer et vérifier

- `mise run bidule` compile et lance l'app. `dist/` est embarqué à la compilation : relancer après chaque modification.
- Pour vérifier un enchaînement d'animations sans l'app : `tools/sim.py` (mode d'emploi en tête du fichier). On peut y avancer le temps image par image.
- Après une modification de `gen.py` ou d'une animation : relancer `gen.py`, recopier la feuille dans `dist/persos/limace/`, vérifier dans la page de test.

## Règles du projet

- **Vie privée** : ne jamais lire le texte des messages de Claude Code. Seulement les métadonnées : heures, quantités de tokens, outils utilisés.
- **Ne pas pousser à consommer** : rien ne doit récompenser le volume brut de tokens (voir "À trancher" dans `NOTES.md`).
- **Pixel art 64 × 64**, jamais de vectoriel. Le format des animations est dans la spec (`moodboard/animations-des-bidules.html`).
- **NOTES.md** : quand une décision ou l'état du projet change, le mettre à jour dans la même pull request.
- **Git** : suivre `.claude/rules/git-flux.md` (branche, puis `test`, puis `main`) et `.claude/rules/pas-de-mention-claude.md`. Pour les commits : le skill `commit`. Pour les pull requests : le skill `pull-request` (pas `pr`, qui vient des skills de Matt Pocock).
- **Langue** : écrire en français (commentaires, messages, documents), comme l'existant.
