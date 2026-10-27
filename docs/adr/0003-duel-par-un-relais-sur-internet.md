# Le duel passe par un relais sur internet, avec un code de quatre lettres

Remplace [l'ADR 0002](0002-duel-en-reseau-local-avec-hote.md). Le duel en réseau local ne marchait pas au bureau : les sous-réseaux ne se parlent pas (une machine en 192.168.224.x ne joint pas une machine en 192.168.15.x), et il ne pouvait pas marcher en télétravail. Les deux Bidules se connectent maintenant à un petit relais sur Cloudflare Workers (`relais/`). Celui qui défie reçoit un code de quatre lettres, qu'il donne à son collègue ; le collègue le tape pour relever le défi. Le relais met les deux joueurs ensemble et fait passer leurs messages sans les lire. L'hôte, celui qui a lancé le défi, calcule toujours seul la balle et le score.

## Options écartées

- **Garder le réseau local à côté du relais** : deux chemins à maintenir et à expliquer (adresse ou code ?), pour un mode qui ne marche que si tout le monde est sur le même sous-réseau.
- **Un VPN entre collègues (Tailscale...)** : chacun doit l'installer et se connecter ; trop lourd pour un jeu.
- **WebRTC, de machine à machine** : demande quand même un serveur pour se trouver, et souvent un relais quand les réseaux d'entreprise bloquent.

## Conséquences

- Le duel marche partout où il y a internet : au bureau, d'un bureau à l'autre, en télétravail.
- Plus de port ouvert sur la machine, plus d'adresse à taper, plus de « Accepter les défis » : on ne reçoit un défi que si on tape son code.
- Un service à mettre en ligne et à garder : `mise run relais`, sur le compte Cloudflare de Matteo (offre gratuite, Durable Objects). Si le relais tombe, plus de duel.
- Ce qui passe par le relais : les noms des joueurs et les positions de la balle et des raquettes. Rien de Claude, et rien n'est gardé après le duel. Le code d'un défi expire au bout de 15 minutes.
