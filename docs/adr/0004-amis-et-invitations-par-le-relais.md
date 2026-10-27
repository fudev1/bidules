# Les amis et les invitations passent par le relais, les codes restent en secours

Complète [l'ADR 0003](0003-duel-par-un-relais-sur-internet.md). Donner un code par Slack à chaque défi était lourd. Chaque Bidule a maintenant un code d'ami de six lettres, tiré au hasard au premier lancement et gardé sur la machine. On ajoute un collègue en tapant son code d'ami une fois. Tant que l'app tourne, chaque Bidule garde une connexion de présence au relais (`/presence/<code d'ami>`) : le relais sait qui est en ligne et fait passer les invitations. Inviter un ami, c'est lancer un défi comme avant puis envoyer son code à l'ami par la présence ; s'il accepte, son Bidule relève le défi tout seul. Le duel lui-même ne change pas.

## Options écartées

- **Un compte par personne (identifiant et mot de passe)** : beaucoup de travail pour une équipe qui se connaît. Le code d'ami suffit.
- **Retirer les codes de défi** : ils restent utiles pour jouer avec quelqu'un qu'on n'a pas encore ajouté, ou si la présence ne passe pas.

## Conséquences

- Le relais garde, tant qu'ils sont connectés, les codes d'ami et les noms des Bidules en ligne. Rien n'est écrit ; tout disparaît à la déconnexion.
- La liste d'amis n'est gardée que sur la machine (`amis.json`). Accepter une invitation ajoute celui qui invite à ses amis.
- Qui connaît le code d'ami de quelqu'un peut l'inviter, ou se faire passer pour lui sur le relais. Acceptable entre collègues ; à revoir si les Bidules sortent de l'équipe.
- « Ne pas déranger » est réglé sur la machine : le Bidule refuse lui-même les invitations, et celui qui invite le voit.
- Une invitation sans réponse est annulée au bout de 10 minutes, avant que le défi n'expire (15 minutes).
