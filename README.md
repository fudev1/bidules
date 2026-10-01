# Bidules

Un compagnon de bureau pour les utilisateurs de Claude Code : une petite créature en pixel art qui vit en bas de l'écran et réagit à ta façon de travailler avec Claude.

Statut : prototype, testé sur Mac. Windows est prévu. Où en est le projet (décisions, à trancher, à faire) : [NOTES.md](NOTES.md).

## Vision

- **Rendre l'usage de Claude visible d'un coup d'œil.** Le Bidule montre ce que tu consommes (fenêtre de 5 h, semaine, sprint) et te prévient avant d'atteindre une limite, sans ouvrir de tableau de bord.
- **Être utile pendant le travail.** Il te prévient quand Claude a fini ou attend ta réponse, et remarque les longues sessions ou le travail tard le soir.
- **Ne pas pousser à consommer.** Le jeu récompense la bonne utilisation, pas le volume de tokens : prompter pour rien ne rapporte rien, et il n'y a pas de classement des tokens entre collègues.
- **Respecter la vie privée.** Le Bidule lit seulement les métadonnées des journaux de Claude Code (heures, quantités), jamais le texte des messages. Les fonctions d'équipe éventuelles seront en option, avec des totaux seulement.
- **Rester discret et attachant.** Il se fait oublier quand on travaille, on peut le prendre, le lancer, le caresser. Pendant le sprint, il évolue (le système d'évolution reste à définir). À la fin du sprint, il rejoint une collection.

Inspiration : l'app "Claude Usage" (PokéBurn), sans le thème Pokémon.

## Ce qu'il fait aujourd'hui

- Il marche en bas de l'écran, suit la souris des yeux, fait des pauses, bâille puis s'endort quand on le laisse tranquille.
- On peut l'attraper, le lancer, le secouer, le caresser, le chatouiller, lui glisser un fichier à "manger" (le fichier n'est pas touché).
- La limace s'étire quand on la tire du sol, décolle, et s'écrase si elle tombe de haut.
- Son humeur est devinée d'après le rythme de tes prompts (heure, durée de session, cadence), et tu peux la corriger dans le panneau.
- Le panneau de la barre de menus permet de choisir le personnage, d'ajouter des parties et de forcer une humeur.

## Installation

Prérequis : macOS, et les outils en ligne de commande d'Apple.

```bash
xcode-select --install
```

1. Installer [mise](https://mise.jdx.dev), qui installe Rust pour le projet :

   ```bash
   brew install mise
   ```

2. Cloner le repo et entrer dans le dossier :

   ```bash
   git clone https://github.com/fudev1/bidules.git
   cd bidules
   ```

3. Autoriser la configuration mise du projet, puis installer Rust :

   ```bash
   mise trust
   mise install
   ```

4. Compiler et lancer le Bidule (la première compilation prend quelques minutes) :

   ```bash
   mise run bidule
   ```

Pour le fermer : clic droit sur son icône dans la barre de menus, puis "Quitter".

L'interface est embarquée dans l'app à la compilation : après une modification dans `dist/`, relancer `mise run bidule`.

## Branches et pull requests

- `test` est la branche par défaut : chaque pull request vise `test`, pas `main`.
- Une branche par sujet, partie de `test` :

  ```bash
  git switch test
  git pull
  git switch -c ma-branche
  ```

- Une pull request relue est mergée sur `test`. Chacun peut ainsi continuer à partir de `test` sans devoir reprendre son travail à chaque changement de `main`.
- `main` est mise à jour depuis `test`, une fois ce qui est sur `test` validé.

### Avec `gh`

[gh](https://cli.github.com) est l'outil en ligne de commande de GitHub. Il évite de passer par le site pour les pull requests. Installation : `brew install gh`, puis `gh auth login` une fois.

| Commande | Ce qu'elle fait |
| --- | --- |
| `gh repo clone fudev1/bidules` | Clone le repo avec ton compte GitHub, sans configurer de clé à part. |
| `gh pr list` | Liste les pull requests ouvertes, avec leur numéro. |
| `gh pr status` | Montre tes pull requests et celles qui attendent ta relecture. |
| `gh pr checkout 12` | Récupère la branche de la pull request n°12 et bascule dessus. Pratique pour essayer le travail d'un collègue : ensuite `mise run bidule`. |
| `gh pr diff 12` | Affiche les changements de la pull request n°12 dans le terminal. |
| `gh pr view 12 --web` | Ouvre la pull request n°12 dans le navigateur. |
| `gh pr create --fill` | Ouvre une pull request depuis ta branche, vers `test` (la branche par défaut). `--fill` reprend le titre et le texte de tes commits. |
| `gh pr review 12 --approve` | Approuve la pull request n°12. `--comment -b "..."` laisse un commentaire à la place. |
| `gh pr merge 12` | Merge la pull request n°12 sur `test`. La commande demande la méthode (merge, squash ou rebase). |

Après `gh pr checkout`, `git switch test` ramène sur `test`.

## Stack

- **App de bureau** : [Tauri 2](https://tauri.app) en Rust. Fenêtre transparente toujours au premier plan, icône dans la barre de menus, lecture des journaux de Claude Code (`serde`, `serde_json`).
- **Interface** : HTML, CSS et JavaScript sans framework ni étape de build (`dist/`). Les monstres sont dessinés par le code, en pixel art 64 × 64, et l'étirement de la limace est dessiné sur un canvas.
- **Animations** : dessinées dans [Aseprite](https://www.aseprite.org), exportées en feuille PNG + JSON, puis assemblées par des scripts Python 3 sans dépendance.
- **Outils** : mise pour Rust et la commande de lancement.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `dist/` | L'interface : `index.html` (le Bidule), `panel.html` (le panneau), `monstre64.js` et `bidule64.js` (monstres générés), `persos/limace/` (feuille d'images de la limace) |
| `src-tauri/` | L'app de bureau en Rust |
| `animations/` | Les animations dessinées, un dossier par animation ; `limace-complete/gen.py` assemble la feuille de la limace |
| `moodboard/` | Direction artistique ; `planches-limace.html` (animations de la limace à dessiner) et `animations-des-bidules.html` (spec des animations d'un Bidule), à ouvrir dans un navigateur |
| `sprites/`, `prototype/` | Fichiers Aseprite des blobs, prototype de la chambre |
| `tools/` | `sim.py` : page de test du Bidule dans un navigateur, sans l'app |

## Ajouter une animation à la limace

1. Exporter l'animation depuis Aseprite (feuille PNG + JSON) dans un dossier de `animations/`.
2. La déclarer dans `animations/limace-complete/gen.py` (liste `HAND`), puis assembler la feuille :

   ```bash
   python3 animations/limace-complete/gen.py
   cp animations/limace-complete/limace_sheet.png dist/persos/limace/sheet.png
   cp animations/limace-complete/limace_sheet.json dist/persos/limace/sheet.json
   ```

3. Relancer `mise run bidule`.

Une animation qui remplace une existante (même nom de balise, par exemple `dort`) est prise en compte sans toucher au code. Une nouvelle balise doit aussi être utilisée dans `dist/index.html`.

Format attendu : 64 × 64 pixels, fond transparent, tourné vers la droite (l'app le retourne pour la gauche). De profil, le bas du contour est sur la ligne 60, comme la reptation. De face, le corps est placé comme l'image de face du demi-tour.

## Tester sans l'app

```bash
python3 tools/sim.py /tmp/bidule-sim
python3 -m http.server 4390 --directory /tmp/bidule-sim
```

Puis ouvrir http://localhost:4390/test.html. Le vrai code du Bidule tourne avec une fausse API Tauri. Le mode d'emploi pour avancer le temps image par image est en tête de `tools/sim.py`.
