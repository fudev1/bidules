# Le duel passe par le réseau local, et l'hôte fait foi

Le Duel (un Pong entre deux collègues) se joue sans serveur sur internet : les deux Bidules se parlent directement sur le réseau local, par une WebSocket gérée côté Rust. Chaque Bidule attend les défis sur un port fixe (47800) tant que « Accepter les défis » est activé ; celui qui défie s'y connecte, et le duel passe par cette même connexion. L'hôte, celui qui a lancé le défi, calcule seul la balle et le score ; l'autre envoie la position de sa raquette et affiche ce qu'on lui renvoie. On trouve les autres Bidules par Bonjour (mDNS), avec une adresse tapée à la main en secours, parce que beaucoup de Wi-Fi d'entreprise bloquent la détection ou isolent les machines. Rien à héberger ni à payer, et rien ne sort du bureau.

## Options écartées

- **Un serveur relais sur internet** : marcherait partout, même en télétravail, mais demande un service à héberger, à payer et à surveiller, et fait sortir des données du réseau.
- **Les deux machines qui calculent la balle chacune de leur côté** : les deux écrans finissent par se contredire (qui a marqué ?) dès que l'effet et l'accélération entrent en jeu.
- **WebRTC** : passe mieux certains réseaux, mais demande quand même un serveur pour se trouver ; trop lourd pour un réseau local.

## Conséquences

- Pas de duel entre deux réseaux différents (télétravail, autre bureau) tant qu'on n'ajoute pas de relais.
- Un port reste ouvert tant que « Accepter les défis » est activé (activé par défaut, coupable dans l'onglet Jouer). Il n'accepte qu'un message de défi, que le joueur doit accepter à la main : pas besoin de code. Au départ, on voulait n'ouvrir un port que pendant le duel, mais alors personne ne peut recevoir de défi.
- Windows et macOS demandent l'accès au réseau local la première fois.
