---
name: animer-bidule
description: Créer une nouvelle animation d'un Bidule existant (limace, Candy) avec PixelLab, puis l'importer, la faire retoucher et en tirer une leçon. À utiliser quand on demande d'animer un Bidule, de lui faire faire un geste ou d'ajouter une animation (par exemple « Caressé », n° 6 de moodboard/planches-limace.html).
---

# Animer un Bidule avec PixelLab

La sortie de PixelLab est une **ébauche** : Thibault la retouche dans Aseprite, puis le **bilan** mesure ce qu'il a corrigé, et la **leçon** en tirée rend la prochaine animation plus juste. Une animation est terminée seulement quand sa leçon est écrite.

Les outils sont dans `tools/` ; leur mode d'emploi est en tête de chaque fichier (`pixellab.py`, `planche.py`, `importer.py`, `verifier.py`, `bilan.py`).

## 1. Préparer

- Lire `moodboard/style-bidules.md` en entier : la fiche du personnage (palette, références) et **toutes les leçons**. Chaque leçon qui concerne ce personnage ou ce genre de mouvement change la requête de l'étape 2 ; dire lesquelles on applique.
- Lire la description de l'animation, si elle existe, dans `moodboard/planches-limace.html` (limace) ou `moodboard/animations-des-bidules.html` (la spec).
- Fixer avec Thibault : le nom de la balise (en français, comme les autres : `caresse`), la pose de départ et la pose d'arrivée (`perso:balise:n`, souvent `repos` ou `crawl:0`, pour que l'animation s'enchaîne), et s'il a dessiné des poses clés.
- Vérifier le jeton et le solde : `python3 tools/pixellab.py solde`. Sans jeton, renvoyer Thibault à `mise.local.toml.exemple` : c'est lui qui colle sa clé, jamais moi.

Terminé quand la balise, les deux poses et la méthode (étape 2) sont fixées et que le solde est affiché.

## 2. Générer

Chaque appel consomme des crédits PixelLab : annoncer la commande avant de la lancer, et attendre l'accord de Thibault pour le premier appel de la séance.

- Thibault a dessiné les poses clés : `python3 tools/pixellab.py interpoler <balise> <pose A> <pose B> "<action>"`. On interpole chaque intervalle séparément.
- Sinon : `python3 tools/pixellab.py animer <balise> <départ> "<action>" --fin <arrivée> --images <4 à 16>`.

L'action s'écrit en anglais, courte et physique (voir « Générer avec PixelLab » dans la bible). Ensuite `python3 tools/planche.py <dossier de l'essai>` et montrer `planche.png` à Thibault.

Trois essais au plus par animation : à chaque nouvel essai, changer **une seule chose** (l'action, le nombre d'images ou la graine) et noter ce qui a changé dans le résultat. Si aucun essai ne convient, s'arrêter et en parler avec Thibault : une leçon s'écrit aussi pour un échec.

Terminé quand Thibault a choisi un essai (et éventuellement les images à garder).

## 3. Importer et vérifier

`python3 tools/importer.py <dossier de l'essai> [--choix …]` : il crée `animations/<balise>/<balise>.aseprite`, l'exporte et lance la vérification. Corriger chaque **erreur** (palette, transparence, taille) avant de passer à la suite. Les **avertissements** sont des questions pour Thibault : on les lui présente, il tranche.

## 4. Retoucher

Ouvrir le fichier pour Thibault : `open -a Aseprite animations/<balise>/<balise>.aseprite`. Il retouche, seul ou avec moi (le MCP `aseprite-live` dessine dans son Aseprite ouvert). Il **enregistre** dans Aseprite. Relancer `python3 tools/verifier.py <perso> animations/<balise>/<balise>.aseprite` après la retouche.

Terminé quand Thibault dit que l'animation lui convient et que la vérification n'a plus d'erreur.

## 5. Brancher dans l'app

- **Limace** : déclarer l'animation dans `HAND` (`animations/limace-complete/gen.py`) et dans `ANIMS` (`tools/publier.py`), comme les autres, puis `mise run publier`. Une nouvelle balise doit aussi être jouée quelque part dans `dist/index.html` : voir avec Thibault à quel moment.
- **Candy** : ses images sont générées par `animations/candy/gen.py`, pas lues dans un `.aseprite`. Décider avec Thibault comment y faire entrer l'animation avant de toucher à ce script.
- Vérifier l'enchaînement dans `tools/sim.py` (mode d'emploi en tête du fichier).

## 6. Bilan et leçon

- `python3 tools/bilan.py <balise>` : il écrit `animations/<balise>/pixellab/bilan-<balise>.md`.
- Regarder avec Thibault ce que montre le bilan : quelles zones il a retouchées (contour, yeux, volume…) et pourquoi.
- Écrire la leçon dans `moodboard/style-bidules.md`, section « Leçons », au format indiqué, la plus récente en haut. Une leçon dit ce qu'il faudra demander ou faire autrement la prochaine fois. Si la même leçon apparaît déjà, la faire monter dans les règles et la rayer des leçons.
- Ajouter une ligne d'état dans `NOTES.md` (« Fait »), et compléter les ressources dans les fiches de personnage (nouvelle référence, nouvelle couleur décidée).

Terminé quand la leçon est écrite, et que le dossier `pixellab/` (essais bruts, `requete.json`, `import-<balise>.json`, `bilan-<balise>.md`) est commité avec l'animation (skill `commit`, sur une branche partie de `test`).
