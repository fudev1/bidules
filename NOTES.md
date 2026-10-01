# Notes du projet

Mise à jour : 30 septembre 2026. Ce fichier suit l'état du projet : ce qui est décidé, ce qui reste à trancher, ce qui est fait et ce qui reste à faire. La vision, l'installation et la stack sont dans le [README](README.md).

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
- Personnages : 6 monstres du moodboard et 4 blobs générés par le code, 12 parties sur 6 emplacements (ajoutées à la main depuis le panneau).
- Limace :
  - étirement collé au sol, deux chutes, écrasement ;
  - demi-tours, passage profil / face, marche sans glissade ;
  - animations à 60 images par seconde.
- Animations de Thibault branchées : reptation (12 images, dos plus droit), demi-tour aligné dessus, saut, baille, dort, mange, rot, chute. Tout est centré sur 31,5 et posé sur la ligne 60 ; l'animation `grimpe` n'est pas branchée (retirée du fichier Aseprite).
- Candy : le seul style Candy, dessiné image par image (planche, comme la limace), bondissante au lieu de s'étaler. Marche, demi-tour, pause, regard, saut en "boing boing", rebonds réels quand on la lance (réservés à Candy, `BOUNCY` dans `index.html`), grosse chute suivie d'une bouderie, bâillement, sommeil (de face), caresse, rire, bouderie, chant pendant 37 % des pauses (jamais en humeur ronchon, un clic ou la souris le coupe). Pas encore : mange, rot, évolution, parties.
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

- Les 16 animations de `moodboard/planches-limace.html`, en commençant par le regard et la pause.
- La reformation après l'écrasement (aujourd'hui, la fin de l'atterrissage sert de transition).
- L'image "il remue" de profil, sur la pose du sommeil.

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
