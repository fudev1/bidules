# Le style des Bidules

La référence pour dessiner, générer ou retoucher un Bidule, à lire avant chaque création. Elle grandit à chaque animation terminée : ce que la retouche corrige devient une leçon (en bas), puis une règle. Les règles d'alignement (ligne 60, axe 31,5, demi-tour) sont dans le README, section « Ajouter une animation à la limace », et `tools/verifier.py` les contrôle.

## En une phrase

Une petite créature ronde et molle en pixel art 64 × 64, un contour d'une seule couleur sombre, trois tons pour le corps (lumière, base, ombre), un visage minuscule et très lisible, aucun dégradé ni demi-transparence.

## Règles communes

- **Pixels pleins** : chaque pixel est opaque ou transparent. Ni anticrénelage, ni dégradé, ni tramage sur le corps.
- **Contour** : un pixel d'épaisseur, à l'encre du personnage, tout autour du corps. Les effets autour du corps (étincelles, gouttes, bulles, traits de vitesse) n'ont pas toujours de contour.
- **Volume en trois tons** : la lumière en haut à gauche (une traînée ou une tache, pas un dégradé), la base partout, l'ombre en bas et à droite, sur 1 ou 2 pixels.
- **Visage petit** : des yeux de 1 × 2 à 2 × 2 pixels, une bouche d'un trait. L'émotion passe par la forme des yeux (traits, arcs, croix, spirales) plus que par la taille.
- **Palette fermée** : on n'utilise que les couleurs déjà dans la feuille du personnage. Une nouvelle couleur est une décision, prise avec Thibault, et ajoutée à la fiche ci-dessous.
- **Mou, pas raide** : le corps s'écrase, s'étire et rebondit. Le volume reste à peu près le même : écrasé, il s'élargit.

## Les personnages

Une image de référence se désigne par `perso:balise:n` : la n-ième image de la balise, dans `dist/persos/<perso>/sheet.png`. C'est ce qu'attendent `tools/pixellab.py` et `tools/importer.py`.

### Limace (`limace`)

Une goutte bleue sans bras, qui rampe de profil et se tourne de face pour regarder. De profil, son dos descend en pente douce vers une petite queue à gauche, et la tête est un bloc arrondi à droite. De face, c'est une goutte ronde avec la queue à gauche.

| Rôle | Couleur |
| --- | --- |
| encre (contour, yeux, bouche) | `#000000` |
| lumière | `#a4c6ff` |
| base | `#639bff` |
| ombre | `#4577e0` |
| intérieur de la bouche | `#3f3f74` |
| blanc des yeux, dents | `#ffffff` |
| nausée (lumière, base, ombre) | `#c6f0b0`, `#7fd46a`, `#4fae45` |
| bulle du sommeil | `#dbeeff`, `#9fc9f5`, `#7fb6f0`, `#3357b8` |
| miettes, rot | `#fffbee`, `#c9c2b0` |
| étoiles d'étourdi | `#ffd23f`, `#fff3b0` |
| vapeur de colère | `#d8dde6` |

Références : `limace:repos` (de face), `limace:crawl:0` (de profil), `limace:attrape:0` (tenue par la souris), `limace:dort:0` (endormie), `limace:chute:0` (en l'air).

### Candy (`candy`)

Une boule rose avec deux oreilles pointues et un bonbon à la menthe sur la tête, deux petits pieds. Elle bondit au lieu de ramper.

| Rôle | Couleur |
| --- | --- |
| encre | `#1a0c14` |
| lumière | `#ffe2ec` |
| base | `#ffaccb` |
| ombre, ombre profonde | `#ef86ad`, `#e0628f` |
| bonbon (lumière, base, ombre) | `#c8f4e6`, `#8ee5cf`, `#5cc8c0` |
| joues | `#ff6f9c` |
| intérieur de la bouche | `#c43454` |
| colère | `#ff4f8e`, `#ff2d55` |
| larmes | `#8fd6ff` |
| nausée | `#e2ecc4`, `#cddca0`, `#acc07a`, `#96ac64`, `#d6ecd0`, `#a0d6aa`, `#becc78` |

Références : `candy:repos` (de face), `candy:crawl:0` (de profil), `candy:attrape:0`, `candy:dort:0`, `candy:rire:0`.

## Générer avec PixelLab

- **Toujours partir d'une image du personnage.**
  - `animer` reçoit la pose de départ. Il vaut mieux lui donner aussi l'arrivée (`--fin`) : les boucles et les retours au repos restent alors cohérents.
  - `interpoler` part de deux poses dessinées à la main.
  - `style` reçoit 2 à 4 références du même personnage, ou de plusieurs Bidules pour un nouveau.
- **L'action en anglais, courte et physique** : ce que fait le corps, pas l'émotion seule (« squashes down then bounces up », plutôt que « happy »).
- **Peu d'images** : PixelLab en donne 4 à 16, et on en ajoute ensuite à la main ou par interpolation. Une animation existante tourne autour de 6 à 12 images, à 60 à 110 ms l'image.
- **La sortie est une ébauche.** `tools/importer.py` la nettoie, Thibault la retouche, et `tools/bilan.py` mesure ce que la retouche a changé.

## Leçons

Une leçon par animation terminée, la plus récente en haut, écrite après le bilan : ce qui a été corrigé à la main, et la règle ou la façon de demander qui l'aurait évité. Quand une leçon revient deux fois, elle monte dans les règles ci-dessus, et on la raye ici.

Format : `- AAAA-MM-JJ, <perso>:<balise> (<commande>, graine <n>, <x> % retouché) : <ce qui a été corrigé> -> <la règle ou la requête à reprendre>`

(aucune leçon pour l'instant)
