# Notes du projet

Mise à jour : 6 octobre 2026. Ce fichier suit l'état du projet : ce qui est décidé, ce qui reste à trancher, ce qui est fait et ce qui reste à faire. La vision, l'installation et la stack sont dans le [README](README.md).

## Décisions

- Joueurs : les utilisateurs de Claude Code, sur Mac et Windows.
- Les tokens se comptent comme dans PokéBurn : entrée + sortie, sans le cache.
- Une saison = un sprint (3 ou 4 semaines), avec les dates dans un fichier de configuration "maître". À la fin du sprint, le Bidule est figé dans la collection et un nouvel œuf arrive. La chambre et les accessoires restent.
- Pendant le sprint, le Bidule évolue. Le système d'évolution reste à définir.
- Chambre à 5 emplacements fixes. Accessoires sur 3 emplacements : tête, visage, cou.
- Direction artistique : le moodboard de Matteo, en pixel art 64 × 64, jamais de vectoriel.
- Pour l'instant, seule la limace est jouable : les autres Bidules restent visibles mais grisés dans le panneau (« Bientôt »), le temps de refaire toutes leurs animations pour qu'elles soient fluides. Pour en rendre un jouable : l'ajouter à `READY` dans `dist/panel.html`.
- Le menu Évolution du panneau est désactivé (grisé) : il sera revu.
- Au lancement, le Bidule choisi la dernière fois apparaît directement (gardé dans `bidule.txt`, dossier de données de l'app). Au premier lancement, aucun Bidule n'apparaît : le panneau s'ouvre pour choisir le premier ; le Bidule attend immobile à sa place de départ ; une fois choisi, le panneau se ferme et le Bidule tombe du haut comme aux lancements suivants.
- L'humeur suit la jauge de contexte de la conversation en cours : 0-30 % joyeux (guilleret), 30-60 % normal (sans humeur), 60-100 % fatigué (vaseux). Quand Claude ne fait rien (aucune conversation en cours depuis 30 min, ou la réponse est finie, ou le journal n'a pas bougé depuis 5 min, par exemple s'il attend une permission), il s'endort, pour signaler qu'il faut retourner lancer la suite. Il s'endort au bout de 5 s de calme et ne se réveille pas seul tant que Claude ne se remet pas au travail, même si l'humeur est choisie à la main (réveillé à la main, il se rendort 5 s après) ; son visage suit alors l'humeur devinée d'après le rythme de travail (heure, durée de session, cadence, pauses). Jamais en lisant le texte des messages. On peut la corriger dans le panneau.
- Humeur et visage : les animations sont dessinées une seule fois, avec le visage neutre (toutes celles faites jusqu'au 5 octobre 2026). Le visage de chaque humeur est dessiné une fois de profil et une fois de face, puis le code le pose sur chaque image où il reconnaît le visage neutre, recalé sur les yeux (et sur la bouche, de face). Les expressions (rire, peur, sommeil, attrapé…) gardent leur visage. Dans une humeur, c'est le code qui fait cligner, au hasard. Fatigué : les yeux fermés sont la norme, il les ouvre de temps en temps (0,6 à 1,5 s, toutes les 3 à 9 s).
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

- Skills de Matt Pocock (`github.com/mattpocock/skills`, version 1.3.1) copiés dans `.claude/skills/` : les 27 du plugin officiel (grilling, tdd, diagnosing-bugs, to-spec, etc.). Pour les commits et les pull requests, nos skills `commit` et `pull-request` restent prioritaires sur `pr`. Ce qu'ils produisent est écrit en français, et quand ils parlent de `main` on lit `test`. Mise à jour : à la main, en recopiant depuis le repo. Réglés pour le projet (`docs/agents/`) : tickets et specs en issues GitHub, étiquettes de tri par défaut, glossaire et ADR à la racine.
- App de bureau Mac : fenêtre transparente au premier plan, le Bidule vit en bas de l'écran, panneau dans la barre de menus (Piste, Évolution, Humeur), sans contours, en aplats de couleur avec le Bidule choisi en grand dans l'en-tête.
- Panneau : 6 Bidules par ligne (640 × 600). Le bouton jaune de l'onglet choisi glisse d'un onglet à l'autre, avec un petit rebond. Un onglet Tests (bouton rond en pointillés au bout des onglets) pour comparer des essais d'apparence, gardés sur le Mac seulement : pour l'instant l'effet verre, en cinq variantes (A verre total sur le bureau flouté par macOS, B tuiles en verre, C mélange, D le panneau habituel avec seulement le reflet blanc sur les onglets, E le même reflet sur tous les boutons). L'icône de la barre de menus reste en surbrillance tant que le panneau est ouvert. Essais « État de Claude » dans le même onglet : ce que fait Claude, depuis quand, et la jauge de contexte (A bandeau sous l'en-tête, B tableau de bord avec un réservoir en pixels, C bulle de BD et anneau autour du Bidule), avec une simulation de chaque état. La fenêtre du Bidule envoie la jauge au panneau (événement `claude`) ; les icônes de la bulle de pensée sont dans `dist/pense.js`, partagé par les deux.
- Icône de la barre de menus : la limace, animée selon Claude. Elle rampe sur place quand il travaille (avec le visage de l'humeur), elle est intriguée quand il attend (un outil demandé sans résultat depuis 20 s : une permission, sans doute, ou une longue commande), elle dort quand il a fini. Bidule fermé, elle se fige au repos. Dessinée par la fenêtre du Bidule (`index.html`), envoyée à la commande `icone` (`main.rs`) ; image de repos : `src-tauri/icons/tray-repos.png`.
- Interactions :
  - attraper au premier clic, lancer avec rebonds sur les bords (jusqu'en haut de l'écran : le plafond se règle sur le haut du dessin, pas de sa fenêtre ; macOS ne laisse pas la fenêtre passer au-dessus de la barre de menus, alors au-delà c'est le dessin qui continue de monter dans sa fenêtre, sans s'arrêter), suivre la souris des yeux ;
  - lancé assez fort vers le haut (limace), il se colle au haut de l'écran, à l'envers, et y rampe comme au sol (même animation, même pas, visage de l'humeur) ; arrivé à un bord, il passe le coin (`coule-fin` à l'envers et retourné de haut en bas, sans ses 7 premières images, la fenêtre glissant vers le bord) puis descend le mur en coulant (`coule`, puis `coule-fin` au sol), comme après un choc contre le bord, sans l'écrasement, et trois fois plus vite (une douzaine de secondes depuis tout en haut) ; au bout de 6 à 14 s, ou d'un clic, il se décolle (« Oups ! ») et retombe ; pris à la souris, il se remet à l'endroit. Pas assez d'élan : il rebondit comme avant. Collé en haut, c'est le dessin qui monte dans sa fenêtre si macOS bloque la fenêtre sous la barre de menus ;
  - caresses, chatouilles (rire, puis fâché), secouer (nausée) ;
  - fichier glissé dessus : il le "mange", sans y toucher ;
  - clic droit : un petit menu du Mac sur le Bidule (ouvrir le panneau, humeur, cacher le Bidule, quitter), à compléter avec d'autres actions ; caché, l'icône se fige au repos, et il revient d'un clic sur lui dans l'onglet Piste du panneau (marqué « Caché ») ou avec « Afficher le Bidule » dans le menu de l'icône ;
  - sommeil après 40 s de calme (il bâille, ses paupières tombent, puis il se couche : `endort`), porté endormi, réveil.
  - porté endormi (ou tenu après le réveil), il est tenu par la pointe d'une goutte que le code dessine en direct (test) : une boule au bout d'un ressort, comme quand on décolle un Bidule éveillé, avec l'effet yoyo (la queue s'allonge, se raccourcit et penche), et par-dessus le visage, les sourcils et la sueur d'`attrape` ; ses bras se débattent en tournant vite autour de leur attache, avec des poses fantômes (les positions précédentes, plus pâles et tramées, comme un bras en pose longue). `animations/attrape-boule` montre la goutte à l'équilibre ; le code n'en prend que le visage et la sueur (`tools/boule.py`, tag `attrape-boule-parts`) et les bras de la première image (tag `attrape-boule-arms`), qu'il fait tourner. l'ancienne image `attrape` (4 images) a été retirée, `attrape-boule` la remplace ; `attrape` remplace `porte-endormi`, et ne bouge que selon la souris : un pendule amorti autour de la tête, dont l'angle suit la vitesse horizontale (20° au plus ; immobile, il ne bouge pas, secoué, il oscille) ; tant qu'on le porte il ne repasse jamais par `remue` ni par une pose de sommeil ; lâché, il est réveillé et retombe : il ne se rendort pas (il ne s'endort à nouveau qu'après 40 s de calme, 15 s s'il est « vaseux »). Réveillé pendant qu'on le porte (trop vite, ou secoué), il reste dans `attrape` ; secoué, il joue la boule passée au vert de la nausée (`secoue`), puis reste vert pendant toute la chute et l'atterrissage (versions vertes de `vol`, `chute-legere`, `chute` et `atterrissage`) jusqu'à ce qu'il se remette (`remis` est bleu : de profil, il se secoue la tête de droite à gauche pour retrouver ses esprits, 15 images, 1,4 s ; les gros coups de tête (yeux plissés, traits de vitesse, tête dédoublée) dessinés par Thibault, les petits tirés de la reptation par `tools/remis.py` ; à chaque bout du balancement, des gouttes vertes de nausée partent du haut de la tête dans le sens de l'élan, de plus en plus petites, calque `gouttes` redessiné par `tools/remis_gouttes.py` ; joué une fois, puis il reprend sa marche sans repasser par la face, sans dégradé de couleur) ; retombé nauséeux, il rampe en vert avec des spirales à la place des yeux (la reptation classique, plus lente, qui tournent d'un quart de tour toutes les 3 images) : il est tenu par le haut de la tête, ce qui explique sa tête allongée. La fenêtre est recalée pour que la souris tombe sur le sommet de la tête de l'image `attrape`, et il se balance autour de ce point.
- Personnages : 6 monstres du moodboard et le Bidule « classique », générés par le code, 12 parties sur 6 emplacements (ajoutées à la main depuis le panneau). Les 4 blobs « Il louche », « Yeux dépareillés », « Paupières lourdes » et « Yeux dessus » ont été retirés : c'étaient des états de visage, pas des personnages.
- Limace :
  - étirement collé au sol, deux chutes, écrasement ;
  - demi-tours, passage profil / face, marche sans glissade ;
  - animations à 60 images par seconde.
  - lancé contre un bord de l'écran, il s'écrase contre le mur (`choc-bord`, l'écrasement d'atterrissage à la verticale), coule lentement (`coule`, de plus en plus vite jusqu'à 60 px/s), puis se détache au sol et se reforme (`coule-fin`, dessinée contre le mur, qui finit sur la première image de `repos` pendant que la fenêtre rentre dans l'écran). Secoué, il reste vert tout du long (`choc-bord-vert`, `coule-vert`, `coule-fin-vert`), puis garde sa nausée au sol. La fenêtre dépasse de 22 px de l'écran pendant qu'il est au mur (à vérifier sur macOS) ;
  - rattrapé en l'air (ou décroché du mur), il est tenu par la goutte qui se balance dès le clic, sans attendre que la souris bouge, quel que soit l'état où on l'attrape (éveillé, endormi, tiré du sol) ; la secousse de l'image n'existe plus pour les persos dessinés ;
- Animations de Thibault branchées : reptation (12 images, dos plus droit), demi-tour aligné dessus, saut, baille, dort, mange, rot, chute, repos (de face, double clignement, queue côté d'où il vient), remue (de profil sur la pose de dort : la bulle éclate, l'œil de devant s'entrouvre), regard (6 images de face, le regard suit la souris : devant et de côté, en haut, au milieu et en bas), reforme (8 images : de la flaque de chute jusqu'à la pose de repos, avec un rebond), attrape (4 images : tenu par la souris, étiré et pincé en haut ; les bras alternent entre le haut et le bas, dessinés à la main ; le bas du corps des images 2 à 4 est aligné sur l'image 1 par `tools/attrape_bas.py`), rire (il rit en se soulevant et en se tassant sur place : deux poses dessinées à la main, transitions calculées par `tools/rire.py`).
- Humeurs joyeux (guilleret) et fatigué (vaseux) sur toutes les animations de la limace où son visage apparaît : reptation, demi-tour, saut, repos, regard, bâillement (début et fin), reforme, rot, fins de caresse, coule, coule-fin et remis. Visages de profil dessinés par Thibault dans `crawl.aseprite` (sur l'image 12) : images 13, 14 et 16 = joyeux, la langue qui remue (un visage animé : l'image k de l'animation prend le visage k modulo 3), 15 = l'image 14 les yeux fermés (le clignement), 17-18 = fatigué. Visages de face : `animations/visages-face/visages-face.aseprite` (1 = repos, 2-4 = joyeux avec la langue, 5-7 = les mêmes yeux fermés, 8-9 = fatigué yeux ouverts et fermés, repris du coule-fin fatigué retouché par Thibault). Là où ni l'un ni l'autre ne se pose tel quel (trois quarts du demi-tour, coule, coule-fin, saut écrasé) : chaque œil de l'image reçoit l'œil de face entier, recalé sur lui (trait vertical ou yeux plissés en trait horizontal), la bouche la bouche de l'humeur, et le joyeux la langue de face sous sa bouche. Chaque animation de chaque humeur a son fichier à retoucher à la main : `animations/humeurs/joyeux/` et `animations/humeurs/fatigue/`, `<nom>.aseprite`, balises `normal` (le visage habituel) et `cligne` (celui que l'app montre de temps en temps : yeux fermés pour le joyeux, ouverts pour le fatigué ; sans balise `cligne`, pas de clignement : c'est le cas du demi-tour, de `coule` et de `coule-fin` fatigués, qui gardent les yeux fermés) ; le `regard` fatigué n'a plus qu'une version, les yeux ouverts (le visage de Thibault, déplacé d'un bloc pour chaque direction), pour suivre le curseur. `gen.py --fichiers` n'écrit que ceux qui manquent ; ensuite `gen.py` lit ces fichiers, retouches comprises (`mise run publier` les réexporte). Retouchés à la main : fatigué `baille`, `caresse-fin`, `coule-fin` (les images non retouchées de `coule-fin` ont reçu le visage retouché). Le fatigué yeux fermés a les joues creusées (reprises de l'image 2 de `caresse-fin` fatigué), sur `visages-face` image 9 et sur toutes les animations fatiguées où ce visage apparaît (sauf de profil, qui avait déjà la sienne). Les morceaux du saut (vol, chute-legere, atterrissage, saut-face) sont pris dans `saut`. Pour qu'un visage retouché soit reposé partout, supprimer les fichiers non retouchés de l'humeur concernée, puis `gen.py --fichiers`. L'app prend `nom@humeur` quand elle existe (sinon la neutre) et, de temps en temps, la même image dans `nom@humeur:cligne` (`BLINK_TIME` dans `index.html`). La feuille de la limace est maintenant une grille de 32 images de large (plus de 1 000 images).
- Malade (vert) : toutes les animations vertes (nausee, secoue, vol, chute-legere, atterrissage, chute, choc-bord, coule, coule-fin) ont les yeux en spirale, qui tournent d'un quart de tour toutes les 3 images, dans le sens inverse des aiguilles d'une montre (`dizzy` dans `gen.py` : yeux en trait vertical, horizontal, ou grands yeux blancs dont le contour reste).
- Dort : 8 images, la bulle gonfle (1 à 4) puis dégonfle (5 à 8 = 4 à 1).
- Base de face unique : turn, saut et baille ont été alignés sur la pose de repos (plus de jupe au bas du corps, côté droit droit, queue à gauche) par `tools/rebase_animations.py`, outil à lancer une seule fois. Au retournement, la queue change de côté d'une image à l'autre (images 6 et 7 de turn).
- Bâillement : le Bidule étire ses deux petits bras, qui sortent des côtés du corps et montent à 45° (images 3 à 8 de baille), ajoutés par `tools/baille_bras.py`.
- Candy : le seul style Candy, dessiné image par image (planche, comme la limace), bondissante au lieu de s'étaler. Marche sautillante comme un enfant (ronchon ou vaseuse : elle garde la reptation), demi-tour, pause, regard, saut en "boing boing", rebonds réels et doux quand on la lance (3 au plus, élan de côté et petite toupie au hasard à chaque rebond, inclinaison continue limitée à 60° et remise à plat avant l'atterrissage ; réservés à Candy, `BOUNCY` dans `index.html`), pas d'étirement quand on la soulève (`NO_PULL`) : elle râle "Hey !", apeurée et fâchée, elle panique en tombant (bras qui battent, quelques larmes, pas pendant les rebonds), grosse chute suivie d'une bouderie, bâillement, sommeil (de face), caresse, rire, bouderie, chant pendant 37 % des pauses (jamais en humeur ronchon, un clic ou la souris le coupe). Elle laisse des bonbons en marchant quand elle est guilleret (3 au plus par terre, un petit bonbon menthe, rose ou jaune de la taille de ses pieds, dans sa propre petite fenêtre `bonbon.html` car la sienne la suit partout) ; ils restent jusqu'à ce qu'on clique sur l'un d'eux : elle vient alors le manger (animation `mange`, une par couleur ; elle sert aussi quand on lui glisse un fichier). Les bonbons ne comptent rien et ne servent à rien d'autre (voir "Récompense" dans "À trancher"). Pas encore : rot, évolution, parties.
- Lien avec Claude : la conversation en cours est celle de Claude Desktop (onglet Code) qui a eu le focus en dernier (`~/Library/Application Support/Claude/claude-code-sessions/…/local_*.json`, champs `cliSessionId` et `lastFocusedAt`) ; sinon le journal Claude Code du terminal modifié dans la dernière demi-heure. Dans son journal (`~/.claude/projects/…/<id>.jsonl`), la commande `contexte` (`main.rs`) ne lit que les tokens de la dernière réponse (entrée + cache) ou d'un résumé de compactage, et les rapporte à la fenêtre du modèle (1 M pour les modèles récents, 200 k pour Haiku et les anciens). Vérifiée toutes les 3 s, et tout de suite quand on change de session dans Claude Desktop (la session qui a le focus est relue toutes les 0,7 s) ; ces lectures tournent hors du fil principal de l'app (sinon le Bidule saccade), et un journal qui n'a pas changé n'est pas relu (les heures des prompts, au plus une fois par minute). Bulle de pensée : tant que Claude travaille, une petite bulle en pixel art (28 × 18) flotte au-dessus de la tête du Bidule (posée d'après le haut de la silhouette de l'image affichée, pastilles du côté où il regarde), avec une icône animée de 2 ou 3 images : réfléchit (points), lit (livre), écrit (crayon), commande (terminal), cherche (loupe), web (globe), délègue (deux têtes), bricole (clé, pour les autres outils et les MCP). Elle vient du dernier bloc du journal : nom de l'outil appelé, ou « pense » après un prompt, un résultat d'outil ou un bloc de réflexion ; rien quand la réponse est finie ou que le journal n'a pas bougé depuis 5 min. Seulement en marche ou pendant une caresse (`PENSE_ICONS` dans `index.html`). La fenêtre du Bidule a `backgroundThrottling: disabled` (`tauri.conf.json`) : sans ça, macOS ralentit ses minuteries quand l'app n'a pas le focus (une vérification toutes les 15 s au lieu de 3, et il mettait plus d'une minute à s'endormir). Sinon, l'humeur est lue dans les heures des prompts de `~/.claude` et `~/.claude-masana`, jamais dans le texte.
- Outils : `animations/limace-complete/gen.py` assemble la feuille de la limace, `tools/sim.py` fait tourner le Bidule dans un navigateur sans l'app.
- Chaîne PixelLab (README, « Générer avec PixelLab ») : `tools/pixellab.py` (animer une pose, interpoler entre deux poses, proposer dans le style de références), `planche.py`, `importer.py` (64 × 64, palette du personnage, poussières, recalage sur la source), `verifier.py`, `bilan.py` (ce que la retouche a changé). Skills `animer-bidule` et `creer-bidule`. La bible du style (`moodboard/style-bidules.md`) grandit d'une leçon à chaque animation terminée. Testée de bout en bout avec une fausse API ; avec la vraie, seul le solde a été lu (essai de 40 générations), pas encore de génération.
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

- Humeurs : vérifier dans l'app les visages posés par le code (trois quarts, coule, saut écrasé : la langue est coupée quand il est tout aplati), dessiner ceux des autres humeurs (ronchon, stressé, dans la lune) : deux images de profil dans `crawl.aseprite` et deux de face, puis une ligne dans `HUMEURS` (`gen.py`). Candy n'a pas encore d'humeurs.

- Premier vrai essai PixelLab : « Caressé » avec le skill `animer-bidule`, et la première leçon dans `moodboard/style-bidules.md`. Selon le résultat, décider si PixelLab sert à toutes les animations ou seulement aux ébauches et aux images intermédiaires.

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
