---
name: creer-bidule
description: Concevoir un nouveau Bidule (un nouveau personnage) avec PixelLab, dans le style de ceux qui existent : ses poses de base, sa palette et sa fiche dans la bible du style. À utiliser quand on demande un nouveau Bidule, un nouveau personnage, ou d'animer à la main un des monstres du moodboard.
---

# Créer un nouveau Bidule avec PixelLab

Un nouveau Bidule doit avoir l'air de la même famille que la limace et Candy. La cohérence vient des **références** qu'on envoie à PixelLab et des **règles** de `moodboard/style-bidules.md`, pas de l'outil. Le Bidule est créé quand ses deux poses de base sont validées et que sa fiche est écrite ; ses animations se font ensuite avec le skill `animer-bidule`.

Les outils sont dans `tools/` ; leur mode d'emploi est en tête de chaque fichier.

## 1. L'idée

- Lire `moodboard/style-bidules.md` en entier, leçons comprises.
- Fixer avec Thibault : le nom du Bidule (un mot, en minuscules, qui sera aussi son dossier `animations/<nom>/`), sa silhouette, son caractère, sa façon de bouger (rampe, bondit, roule…), ses couleurs de départ. Pour un des monstres du moodboard, partir de son image dans `moodboard/`.
- Vérifier le jeton et le solde : `python3 tools/pixellab.py solde`.

Terminé quand le nom, la silhouette et le mouvement sont écrits en trois lignes que Thibault a validées.

## 2. La pose de face

Chaque appel consomme des crédits : annoncer la commande et attendre l'accord de Thibault pour le premier appel de la séance.

`python3 tools/pixellab.py style <nom> "<description en anglais, de face, au repos>" limace:repos candy:repos [une ou deux autres références]`

- Les références donnent le style : la taille dans l'image, le contour, les trois tons. Mettre au moins une pose de face d'un Bidule existant.
- La description dit la forme et les couleurs du nouveau, au repos, de face, fond transparent.
- `python3 tools/planche.py <dossier de l'essai>` (avec `--grille 4` si la sortie est une seule image de 4 × 4 propositions), et montrer `planche.png` à Thibault.

Trois essais au plus. À chaque nouvel essai, changer une seule chose (la description, une référence ou la graine).

Terminé quand Thibault a choisi une proposition.

## 3. Importer, retoucher, fixer la palette

- `python3 tools/importer.py <dossier de l'essai> --libre --balise repos --choix <n> [--grille 4]` : il crée `animations/<nom>/repos.aseprite` avec les couleurs fréquentes de la proposition.
- Thibault retouche dans Aseprite (`open -a Aseprite animations/<nom>/repos.aseprite`) et enregistre. Viser les règles communes de la bible : contour d'une couleur, trois tons, visage petit, posé sur la ligne 60.
- Réexporter : `python3 tools/aseprite_io.py <nom> repos`. La palette de cette pose devient celle du Bidule : tous les outils la liront dans `animations/<nom>/`.

Terminé quand `python3 tools/verifier.py <nom> animations/<nom>/repos.aseprite` ne signale plus d'erreur et que Thibault valide la pose.

## 4. La pose de profil

`python3 tools/pixellab.py style <nom> "<le même Bidule, de profil, tourné vers la droite>" <nom>:repos limace:crawl:0 candy:crawl:0`, puis la planche, l'import (`--perso <nom> --balise crawl --choix <n>`, la palette est maintenant fixée) et la retouche, comme à l'étape 3.

Terminé quand la pose de profil est validée, réexportée (`python3 tools/aseprite_io.py <nom> crawl`) et vérifiée.

## 5. La fiche et la leçon

- Écrire la fiche du Bidule dans `moodboard/style-bidules.md`, sur le modèle de celles de la limace et de Candy : silhouette, tableau des rôles de couleur, références.
- `python3 tools/bilan.py <nom> repos` et `python3 tools/bilan.py <nom> crawl`, puis écrire la leçon (ce que la retouche a corrigé, ce qu'il faudra demander autrement) dans la section « Leçons ».
- Le faire entrer dans l'app (`dist/persos/<nom>/`, `SHEETS` dans `dist/js/feuilles.js`, le panneau) est un chantier à part : le noter dans `NOTES.md` (« À faire ») et en parler avec Thibault.

Terminé quand la fiche et la leçon sont écrites et que `animations/<nom>/` est commité (skill `commit`, sur une branche partie de `test`).
