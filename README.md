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
- Candy laisse de petits bonbons en marchant quand elle est de bonne humeur ; un clic sur l'un d'eux et elle vient le manger.
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

5. Activer le garde-fou git, qui refuse un push direct sur `main` depuis ton poste (une fois par clone) :

   ```bash
   git config core.hooksPath .githooks
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

### Règles pour les pull requests

- **Taille** : une grosse pull request n'est pas un problème. Inutile de découper un gros chantier.
- **Nom de branche** : en anglais.
- **Avant de pousser** : lancer `mise run publier`, pour que la feuille de la limace dans `dist/persos/limace/` corresponde aux fichiers Aseprite enregistrés. La feuille est commitée avec les animations, et l'app lit la feuille, pas le fichier Aseprite.
- **Titre et description** : en français. Le titre au format Conventional Commits (`feat(limace): ...`), comme les commits ; la description avec des mots ordinaires, en trois parties : ce que ça apporte, les gros changements, le résultat (y compris ce qui a été vérifié et ce qui ne l'a pas été). Le skill `pull-request` et le modèle de PR donnent le format. Aucune ligne d'attribution du type « Generated with Claude Code ».
- **Une PR déjà relue ou approuvée n'est pas alourdie** de nouveaux commits : le nouveau travail part sur une nouvelle branche, avec sa propre PR vers `test`. Elle contient les commits de la précédente tant que celle-ci n'est pas fusionnée, puis son diff se réduit tout seul.

### Avec `gh`

[gh](https://cli.github.com) est l'outil en ligne de commande de GitHub. Il évite de passer par le site pour les pull requests. Installation : `brew install gh`, puis `gh auth login` une fois.

| Commande | Ce qu'elle fait |
| --- | --- |
| `gh repo clone fudev1/bidules` | Clone le repo avec ton compte GitHub connecté à `gh`. |
| `gh pr list` | Liste les pull requests ouvertes, avec leur numéro. |
| `gh pr status` | Montre tes pull requests et celles qui attendent ta relecture. |
| `gh pr checkout 12` | Récupère la branche de la pull request n°12 et bascule dessus. Pratique pour essayer le travail d'un collègue : ensuite `mise run bidule`. |
| `gh pr diff 12` | Affiche les changements de la pull request n°12 dans le terminal. |
| `gh pr view 12 --web` | Ouvre la pull request n°12 dans le navigateur. |
| `gh pr create` | Ouvre une pull request depuis ta branche, vers `test` (la branche par défaut). Titre et description : voir « Règles pour les pull requests ». |
| `gh pr review 12 --approve` | Approuve la pull request n°12. `--comment -b "..."` laisse un commentaire à la place. |
| `gh pr merge 12` | Merge la pull request n°12 sur `test`. La commande demande la méthode (merge, squash ou rebase). |

Après `gh pr checkout`, `git switch test` ramène sur `test`.

## Stack

- **App de bureau** : [Tauri 2](https://tauri.app) en Rust. Fenêtre transparente toujours au premier plan, icône dans la barre de menus, lecture des journaux de Claude Code (`serde`, `serde_json`).
- **Interface** : HTML, CSS et JavaScript sans framework ni étape de build (`dist/`). Les monstres sont dessinés par le code, en pixel art 64 × 64, et l'étirement de la limace est dessiné sur un canvas.
- **Animations** : dessinées dans [Aseprite](https://www.aseprite.org), exportées en feuille PNG + JSON, puis assemblées par des scripts Python 3 sans dépendance.
- **Outils** : mise pour Rust et la commande de lancement. [PixelLab](https://www.pixellab.ai) (API, payante) pour les ébauches d'animations et de nouveaux Bidules.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `dist/` | L'interface : `index.html` (le Bidule), `panel.html` (le panneau), `monstre64.js` et `bidule64.js` (monstres générés), `persos/limace/` (feuille d'images de la limace) |
| `src-tauri/` | L'app de bureau en Rust |
| `animations/` | Les animations dessinées, un dossier par animation ; `limace-complete/gen.py` assemble la feuille de la limace |
| `animations/candy/` | Candy, dessinée image par image (123 images, 24 balises) : `gen.py` génère les images, la planche et le JSON, et les copie dans `dist/persos/candy/` ; `apercu_x4.gif` pour la voir bouger |
| `moodboard/` | Direction artistique ; `style-bidules.md` (le style des Bidules : règles, palettes, références, leçons), `planches-limace.html` (animations de la limace à dessiner) et `animations-des-bidules.html` (spec des animations d'un Bidule), à ouvrir dans un navigateur |
| `sprites/`, `prototype/` | Fichiers Aseprite des blobs, prototype de la chambre |
| `tools/` | `publier.py` : du fichier Aseprite à l'app ; `sim.py` : page de test du Bidule dans un navigateur, sans l'app ; `boule.py` : la forme de la goutte du Bidule tenu par la tête ; `pixellab.py`, `planche.py`, `importer.py`, `verifier.py`, `bilan.py` : générer avec PixelLab (voir plus bas) ; les autres scripts créent ou alignent des animations (voir leur en-tête) |
| `.mcp.json` | Serveurs MCP pour faire éditer Aseprite par Claude Code (voir « Faire éditer Aseprite par Claude Code ») |
| `.claude/`, `CLAUDE.md` | Consignes pour Claude Code : skills de commit, `pull-request`, `animer-bidule`, `creer-bidule` et `aseprite-mcp`, skills de Matt Pocock (`mattpocock/skills`, licence MIT), règles git, garde-fou contre les push sur `main`, pas de mention de Claude dans les commits et les PR |
| `.githooks/`, `.github/` | Garde-fou git pour les humains, modèle de pull request |

## Ajouter une animation à la limace

1. Dessiner ou modifier l'animation dans son fichier Aseprite de `animations/<dossier>/` (une balise par animation) et l'enregistrer.
2. La déclarer, si elle est nouvelle, dans `animations/limace-complete/gen.py` (liste `HAND`) et dans `tools/publier.py` (liste `ANIMS`).
3. Lancer `mise run bidule` : il exécute d'abord `mise run publier`, qui réexporte les animations enregistrées depuis le dernier export, assemble la feuille de la limace (`gen.py`) et la copie dans `dist/persos/limace/`, puis compile et lance l'app.

`mise run publier` se lance seul (depuis n'importe quel dossier du projet) quand on veut seulement mettre à jour la feuille. L'app lit la feuille exportée, pas le fichier Aseprite : enregistrer ne suffit pas.

Une animation qui remplace une existante (même nom de balise, par exemple `dort`) est prise en compte sans toucher au code. Une nouvelle balise doit aussi être utilisée dans `dist/index.html`.

Format attendu : 64 × 64 pixels, fond transparent, tourné vers la droite (l'app le retourne pour la gauche). De profil, le bas du contour est sur la ligne 60, comme la reptation. De face, le corps est placé comme la pose de repos (`repos`, aussi l'image de face du demi-tour) : centré sur 31,5, petite queue à gauche, sans jupe au bas du corps.

Le retournement gauche/droite se fait autour d'un axe que l'app calcule depuis `crawl[0]` et la dernière image de `turn` : ici 31,5, le milieu de l'image, donc un simple miroir de l'image. Pour que reptation droite, demi-tour et reptation gauche s'enchaînent sans saut : `turn[0]` est identique à `crawl[0]`, `turn[12]` en est le miroir exact (reflet compris), et la reptation retournée doit tenir dans l'image (x de 2 à 61). Toutes les animations sont centrées sur 31,5 et posées sur la ligne 60. Si la reptation change, `tools/align_turn.py` reconstruit le demi-tour (voir son en-tête) ; le saut commence et finit par les images de ce demi-tour, `gen.py` les reprend tout seul.

## Générer avec PixelLab

PixelLab produit des ébauches en pixel art à partir des images des Bidules : il anime une pose, interpole entre deux poses dessinées, ou propose de nouveaux Bidules dans le style de ceux qui existent. L'ébauche est nettoyée, retouchée à la main, puis comparée à la retouche : ce qui a été corrigé devient une leçon dans `moodboard/style-bidules.md`. Avec Claude Code, les skills `animer-bidule` et `creer-bidule` déroulent tout ça.

Mise en place, une fois par poste :

1. Un compte sur [pixellab.ai](https://www.pixellab.ai) et son jeton d'API (page du compte).
2. `cp mise.local.toml.exemple mise.local.toml`, puis coller le jeton dedans. Le fichier est ignoré par git.
3. Pour Claude Code : le serveur MCP `pixellab` est déclaré dans `.mcp.json` (animer, interpoler entre deux poses). Il lit le jeton dans `PIXELLAB_SECRET` : lancer Claude Code depuis un terminal ouvert dans le projet, où mise l'a chargé.

La chaîne, du brut à l'app (le mode d'emploi complet est en tête de chaque script) :

```bash
python3 tools/pixellab.py animer caresse limace:repos "gets petted, squashes down happily" --fin limace:repos
python3 tools/planche.py animations/caresse/pixellab/<essai>      # planche.png : choisir
python3 tools/importer.py animations/caresse/pixellab/<essai>     # caresse.aseprite, nettoyé, recalé et vérifié
# retoucher et enregistrer dans Aseprite, déclarer l'animation (voir plus haut), mise run publier
python3 tools/bilan.py caresse                                     # ce que la retouche a changé
```

`tools/verifier.py` contrôle n'importe quelle animation contre les règles des Bidules (palette, transparence, ligne 60, contour). Une image se désigne par `perso:balise:n` (la n-ième image de la balise dans `dist/persos/<perso>/sheet.png`) ou par un chemin de PNG.

Extensions Aseprite utiles (gratuites, MIT) : [Pixel-Import](https://github.com/LucienTo/Pixel-Import) (importer une image en la ramenant sur la palette du sprite), [EaseSprite](https://github.com/JRiggles/EaseSprite) (accélérations sur la durée des images), [OKShift](https://github.com/WangleLine/OKShift) (décaler une teinte sans changer sa luminosité), et les scripts [Tween et Skeleton2Animation](https://github.com/alca259/aseprite-2.5d-animation-pipeline) (entre-deux et squelette).

## Faire éditer Aseprite par Claude Code

Le projet déclare trois serveurs MCP dans `.mcp.json` (le troisième, `pixellab`, calcule les animations entre deux poses : voir « Générer avec PixelLab »), déjà approuvés dans `.claude/settings.json` : Claude Code les charge en ouvrant le projet.

- `aseprite` ([diivi/aseprite-mcp](https://github.com/diivi/aseprite-mcp)) : travaille sur les fichiers `.aseprite` sans ouvrir l'app (dessin, calques, images, palettes, exports, scripts Lua).
- `aseprite-live` ([sloplink/aseprite-mcp](https://github.com/sloplink/aseprite-mcp)) : dessine en direct dans l'Aseprite ouvert, et on voit les changements à l'écran.

Mise en place, une fois par poste (Aseprite installé dans `/Applications`, [uv](https://docs.astral.sh/uv/) et Node 20 ou plus) :

```bash
mkdir -p ~/mcp && cd ~/mcp
git clone https://github.com/diivi/aseprite-mcp
git clone https://github.com/sloplink/aseprite-mcp aseprite-mcp-live
cd aseprite-mcp-live && npm install && node server.mjs token     # affiche le jeton d'appairage
```

Puis, pour `aseprite-live`, installer l'extension `aseprite-mcp-bridge.aseprite-extension` (page des versions du dépôt) dans Aseprite : **Edit › Preferences › Extensions › Add Extension**, redémarrer Aseprite, et coller le jeton dans **File › MCP Bridge…**. Le jeton reste sur le poste (`~/.config/aseprite-mcp/token`), il n'est pas dans le projet.

Les chemins de `.mcp.json` partent de `~/mcp/` : cloner ailleurs demande d'y adapter les chemins. `/mcp` dans Claude Code montre si les deux serveurs sont connectés.

Le serveur `aseprite-live` est lancé par Claude Code et ne vit que pendant une session ouverte dans le projet : à chaque nouvelle session, recliquer sur **Connect** dans File › MCP Bridge d'Aseprite. En cas de doute, `python3 tools/aseprite_mcp.py` diagnostique l'installation, les processus et la connexion ; avec Claude Code, le skill `aseprite-mcp` déroule la mise en place et les réparations.

## Travailler avec les skills de Matt Pocock

Les skills de [mattpocock/skills](https://github.com/mattpocock/skills) sont dans `.claude/skills/`. Certains se lancent seulement à la main, en tapant `/nom` dans Claude Code. Les autres, Claude les prend aussi tout seul quand la demande s'y prête (marqués « auto » plus bas). En cas de doute, `/ask-matt` dit lequel prendre.

**Réglages du projet** : déjà faits avec `/setup-matt-pocock-skills`, dans `docs/agents/` et la partie « Agent skills » de `CLAUDE.md`. Les tickets et les specs sont des issues GitHub, avec les étiquettes de tri `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` et `wontfix`. Le glossaire (`GLOSSARY.md`) et les décisions (`docs/adr/`) sont à la racine, créés au fur et à mesure. Ces skills utilisent `gh`, connecté au compte GitHub (`gh auth login`). Pour changer un réglage : modifier `docs/agents/` ; relancer le skill seulement pour changer d'endroit où ranger les tickets.

**Le flux principal, de l'idée à la pull request :**

1. `/grill-with-docs` : Claude pose des questions jusqu'à ce que l'idée soit claire, et note le vocabulaire dans `GLOSSARY.md` et les décisions dans des ADR.
2. Une question qui ne se tranche pas à l'oral (un comportement à voir, un enchaînement d'états) : `/prototype` (auto), un essai jetable sur sa propre branche. `/handoff` sert à passer le relais si le prototype se fait dans une autre session.
3. Petit travail : `/implement` dans la même session. Gros travail (plusieurs sessions) : `/to-spec` (la spec), puis `/to-tickets` (des tickets avec leurs dépendances), puis `/implement` ticket par ticket en vidant la session (`/clear`) entre deux, ou `/implement-spec` pour tout enchaîner d'un coup.
4. Le code se construit par `/tdd` (auto) : un test qui échoue, le code qui le fait passer, puis on recommence. Il se termine par `/code-review` (auto) : respect des règles du projet d'un côté, respect de la spec de l'autre.
5. Commit avec le skill `commit`, pull request vers `test` avec le skill `pull-request` (pas `pr`).
6. `/retro` : après coup, ce qu'il faudrait changer dans les consignes ou les outils pour que la prochaine fois se passe mieux.

Garder les étapes 1 à 3 dans la même session jusqu'à `/to-tickets` : la spec et les tickets s'appuient sur les réponses données pendant les questions.

**Autres points d'entrée :**

- Un bug qui résiste : `/diagnosing-bugs` (auto). Il commence par trouver une commande qui reproduit le bug, puis corrige et ajoute un test.
- Des demandes et des bugs qui s'accumulent dans les issues : `/triage`.
- Un très gros chantier encore flou : `/wayfinder`, puis retour au flux principal par `/to-spec`.
- Entretien du code : `/improve-codebase-architecture` propose des endroits à simplifier ; `/codebase-design` (auto) donne le vocabulaire pour en parler.

**À part :**

- `/grill-me` : les mêmes questions sans rien écrire dans le projet. `/grilling` (auto) : les questions seules.
- `/research` (auto) : une recherche dans des sources sûres, rangée dans un fichier du projet.
- `/to-questionnaire` : un questionnaire pour la personne qui détient la réponse.
- `/wizard` (auto) : un script qui guide pas à pas une étape que seul un humain peut faire (comptes, clés, réglages en ligne).
- `/wait-what` : Claude reformule son dernier message, plus simplement.
- `/teach` : apprendre un sujet sur plusieurs séances. `/domain-modeling` (auto) : le glossaire et les ADR. `/writing-for-agents` (auto) : écrire des consignes ou des skills.

Ce qu'ils produisent est écrit en français, et quand ils parlent de `main` on lit `test` (voir `CLAUDE.md` et `.claude/rules/git-flux.md`). Mise à jour : recopier leurs dossiers depuis le dépôt de Matt Pocock, sans les modifier.

## Tester sans l'app

```bash
python3 tools/sim.py /tmp/bidule-sim
python3 -m http.server 4390 --directory /tmp/bidule-sim
```

Puis ouvrir http://localhost:4390/test.html. Le vrai code du Bidule tourne avec une fausse API Tauri. Le mode d'emploi pour avancer le temps image par image est en tête de `tools/sim.py`.
