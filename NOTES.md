# Notes du projet

Mise à jour : 1er octobre 2026. Ce fichier suit l'état du projet : ce qui est décidé, ce qui reste à trancher, ce qui est fait et ce qui reste à faire. La vision, l'installation et la stack sont dans le [README](README.md).

## Décisions

- Joueurs : les utilisateurs de Claude Code, sur Mac et Windows.
- Les tokens se comptent comme dans PokéBurn : entrée + sortie, sans le cache.
- Une saison = un sprint (3 ou 4 semaines), avec les dates dans un fichier de configuration "maître". À la fin du sprint, le Bidule est figé dans la collection et un nouvel œuf arrive. La chambre et les accessoires restent.
- Pendant le sprint, le Bidule évolue. Le système d'évolution reste à définir.
- Chambre à 5 emplacements fixes. Accessoires sur 3 emplacements : tête, visage, cou.
- Direction artistique : le moodboard de Matteo, en pixel art 64 × 64, jamais de vectoriel.
- L'humeur est devinée d'après le rythme de travail (heure, durée de session, cadence, pauses), jamais en lisant le texte des messages. On peut la corriger dans le panneau.
- Limace :
  - on la tire du sol pour l'étirer, elle décolle à 2,4 fois sa hauteur ;
  - petite chute : goutte calme, puis atterrissage ;
  - grande chute (au moins les deux tiers de l'écran) : elle a peur, s'écrase, reste en flaque 1,5 à 3 s, puis se reforme ;
  - la vitesse de marche vient du dessin (plus lente qu'avant), gardée telle quelle pour l'instant.

## À trancher

- **Récompense** : la règle de départ récompense le volume de tokens (100 tokens = 1 pièce), ce qui pousse à prompter pour rien. Proposition : le Bidule montre l'usage et récompense la bonne utilisation.
- **Besoins** (faim, soif, saleté) : ils montent avec les tokens, ou avec le temps ? Avec les tokens, ils poussent aussi à consommer.
- **Évolution** : ce qui la déclenche pendant le sprint.
- **Personnages** : animer à la main les 6 monstres du moodboard, ou garder seulement la limace pour la v1.

## Fait

- App de bureau Mac : fenêtre transparente au premier plan, le Bidule vit en bas de l'écran, panneau dans la barre de menus (Piste, Évolution, Humeur).
- Interactions :
  - attraper au premier clic, lancer avec rebonds sur les bords, suivre la souris des yeux ;
  - caresses, chatouilles (rire, puis fâché), secouer (nausée) ;
  - fichier glissé dessus : il le "mange", sans y toucher ;
  - sommeil après 40 s de calme, porté endormi, réveil.
  - porté endormi, il joue `attrape`, qui remplace `porte-endormi`, et ne bouge que selon la souris : un pendule amorti autour de la tête, dont l'angle suit la vitesse horizontale (20° au plus ; immobile, il ne bouge pas, secoué, il oscille) ; tant qu'on le porte il ne repasse jamais par `remue` ni par une pose de sommeil ; lâché, il est réveillé et retombe : il ne se rendort pas (il ne s'endort à nouveau qu'après 40 s de calme, 15 s s'il est « vaseux »). Réveillé pendant qu'on le porte (trop vite, ou secoué), il reste dans `attrape` ; secoué, il joue `attrape` passé au vert de la nausée ; retombé nauséeux, il rampe en vert avec des spirales à la place des yeux (la reptation classique, plus lente, qui tournent d'un quart de tour toutes les 3 images) : il est tenu par le haut de la tête, ce qui explique sa tête allongée. La fenêtre est recalée pour que la souris tombe sur le sommet de la tête de l'image `attrape`, et il se balance autour de ce point.
- Personnages : 6 monstres du moodboard et 4 blobs générés par le code, 12 parties sur 6 emplacements (ajoutées à la main depuis le panneau).
- Limace :
  - étirement collé au sol, deux chutes, écrasement ;
  - demi-tours, passage profil / face, marche sans glissade ;
  - animations à 60 images par seconde.
- Animations de Thibault branchées : reptation (12 images, dos plus droit), demi-tour aligné dessus, saut, baille, dort, mange, rot, chute, repos (de face, double clignement, queue côté d'où il vient), remue (de profil sur la pose de dort : la bulle éclate, l'œil de devant s'entrouvre), regard (6 images de face, le regard suit la souris : devant et de côté, en haut, au milieu et en bas), reforme (8 images : de la flaque de chute jusqu'à la pose de repos, avec un rebond), attrape (4 images : tenu par la souris, étiré et pincé en haut ; les bras alternent entre le haut et le bas, dessinés à la main ; le bas du corps des images 2 à 4 est aligné sur l'image 1 par `tools/attrape_bas.py`).
- Base de face unique : turn, saut et baille ont été alignés sur la pose de repos (plus de jupe au bas du corps, côté droit droit, queue à gauche) par `tools/rebase_animations.py`, outil à lancer une seule fois. Au retournement, la queue change de côté d'une image à l'autre (images 6 et 7 de turn).
- Bâillement : le Bidule étire ses deux petits bras, qui sortent des côtés du corps et montent à 45° (images 3 à 8 de baille), ajoutés par `tools/baille_bras.py`.
- Lien avec Claude : l'humeur est lue dans les heures des prompts de `~/.claude` et `~/.claude-masana`, jamais dans le texte.
- Outils : `animations/limace-complete/gen.py` assemble la feuille de la limace, `tools/sim.py` fait tourner le Bidule dans un navigateur sans l'app.
- Documents :
  - la spec des animations (`moodboard/animations-des-bidules.html`) ;
  - les animations à dessiner (`moodboard/planches-limace.html`) ;
  - le prototype de la chambre (`prototype/chambre.html`).

## À faire

### Le lien avec Claude (le cœur)

- Lire les vrais tokens (entrée + sortie, sans cache) dans les journaux de Claude Code, par session, par jour, par sprint.
- Jauge de la fenêtre de 5 h et de la limite de la semaine, avec le temps avant la remise à zéro. Le Bidule fatigue à l'approche de la limite, ce qui permettra aussi de deviner l'humeur Ronchon. À vérifier : ce que les journaux locaux permettent d'en savoir.
- Alerte "contexte presque plein", avant que Claude Code compacte la conversation.
- Hooks de Claude Code : le Bidule prévient quand Claude a fini, ou attend une réponse ou une permission.
- Voir les sessions en parallèle : combien tournent, lesquelles attendent.
- Onglet "Usage" dans le panneau : aujourd'hui, 7 jours, sprint, par projet, et le coût équivalent au prix de l'API.
- Récap de fin de journée et de fin de sprint, sans classement.
- Réglage des dossiers Claude suivis (plusieurs profils).
- Rythme de travail : proposer une pause après une longue session, et des heures calmes (réunions, soirée).

### Garde-fous contre les dérives

- Ne plus récompenser le volume brut de tokens (voir "À trancher").
- Plafond par jour : au-delà d'une journée de travail normale, plus rien ne se gagne.
- Ne compter que le vrai travail, lu dans les métadonnées : outils utilisés, fichiers modifiés, sessions qui aboutissent. Toujours sans lire le texte.
- Récompenser la bonne utilisation : rester sous la limite, bon usage du cache, pauses, pas de soirées tardives.
- Pas de classement des tokens entre collègues.
- Fonctions d'équipe en option seulement, avec des totaux, jamais de contenu.
- Une page "comment le Bidule compte", pour que la règle soit claire.

### Le jeu

- Sauvegarder l'état (Bidule, parties, pièces, collection). Aujourd'hui, tout est perdu à chaque redémarrage.
- Fichier "maître" des sprints, lu au démarrage.
- Œuf et éclosion en début de sprint, Bidule figé dans la collection en fin de sprint.
- Système d'évolution pendant le sprint.
- Parties sur la limace : points d'accroche sur chaque image (voir la spec).
- Besoins, pièces, boutique, chambre, accessoires.

### Animations (Thibault)

- Les 8 animations restantes (porte-endormi est remplacée par attrape ; secoue est attrape en vert ; nausee est la reptation en vert, avec des spirales) de `moodboard/planches-limace.html`, en commençant par « Caressé » (`caresse`, n° 6). Les animations générées (regard, reforme et attrape exceptées) reprennent la silhouette de repos : à redessiner à la main avec sa queue à gauche.

### Technique et diffusion

- Version Windows : fenêtre transparente, barre des tâches, dossiers Claude sous Windows.
- Version de production (plus légère que la version de développement), signature Mac, installeur.
- Mise à jour automatique, comme le fichier latest.json de PokéBurn.
- Lancement à l'ouverture de session.
- Tests par-dessus une app en plein écran, avec plusieurs écrans et plusieurs bureaux.
- Réglages : couper les bulles, taille du Bidule, heures calmes.
- Tests automatiques à partir de `tools/sim.py`.

### À améliorer dans l'existant

- Le fil qui se courbe quand on tire de côté, et des gouttelettes quand le fil casse.
- Le blanc très court quand la fenêtre change de taille au moment où on l'attrape. Option : une fenêtre fixe qui laisse passer les clics.
