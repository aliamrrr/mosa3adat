# Rappels WhatsApp – groupe « Mosa3adat »

Petit programme qui envoie automatiquement deux messages dans votre groupe WhatsApp :

- **le 1er du mois à 9h00** : le message de demande d'aide ;
- **le 2 du mois à 9h00** : le message de relance.

Les messages partent **depuis votre propre compte** (comme si vous les écriviez vous-même). Les textes, le nom du groupe, l'heure et le fuseau horaire se changent dans `config.json`.

> ⚠️ **À savoir** : ce programme se connecte comme « WhatsApp Web / appareil lié » avec une bibliothèque non officielle (Baileys). Ce n'est pas prévu par WhatsApp. Pour 2 messages par mois dans un groupe de proches, le risque est faible, mais il n'est pas nul. N'utilisez pas cet outil pour envoyer beaucoup de messages.

## 1. Installation (sur la machine qui restera allumée)

Il faut **Node.js 20 ou plus récent** (`node -v` pour vérifier).

```bash
cd mosa3adat-rappels
npm install
```

## 2. Première connexion (une seule fois)

```bash
npm run check
```

- Un **QR code** s'affiche. Sur votre téléphone : WhatsApp > Réglages > **Appareils connectés** > **Connecter un appareil**, puis scannez.
- Le programme affiche la liste de vos groupes et confirme que « Mosa3adat » est trouvé. **Rien n'est envoyé** dans ce mode.
- Si le nom ne correspond pas, corrigez `groupName` dans `config.json`.

La session est enregistrée dans le dossier `auth/` : pas besoin de rescanner ensuite. **Ne partagez jamais ce dossier** (il donne accès à votre WhatsApp).

## 3. Lancement permanent

Le plus simple avec **pm2** :

```bash
npm install -g pm2
pm2 start index.js --name mosa3adat
pm2 save
pm2 startup        # copiez-collez la commande affichée pour le démarrage automatique
```

Commandes utiles : `pm2 logs mosa3adat` (voir ce qui se passe), `pm2 restart mosa3adat`, `pm2 stop mosa3adat`.

## Comment ça marche

- Toutes les 5 minutes, le programme regarde si on est le jour prévu, après l'heure prévue, et si le message n'a pas déjà été envoyé ce mois-ci (suivi dans `data/sent.json`).
- Si la machine était éteinte à 9h00, le message part dès qu'elle redémarre **le même jour**. Si elle est éteinte toute la journée, le message de ce jour est manqué.
- En cas de coupure internet, la reconnexion est automatique.
- Si vous vous déconnectez depuis le téléphone (Appareils connectés), supprimez le dossier `auth/` et refaites l'étape 2.

## Où l'héberger ? (gratuit ou presque)

Le programme doit tourner **en continu** et garder le dossier `auth/` entre les redémarrages. Les hébergeurs « gratuits » qui mettent en veille ou effacent le disque (type Heroku, Render gratuit, Replit...) ne conviennent donc pas. Les prix et conditions changent : vérifiez-les sur les sites.

1. **Gratuit : un ordinateur ou un Raspberry Pi à la maison**, allumé en permanence (même un vieux portable). C'est l'option la plus simple.
2. **Gratuit sous conditions : Oracle Cloud « Always Free »** : une petite machine virtuelle gratuite. L'inscription demande une carte bancaire et la disponibilité varie selon les régions.
3. **Quelques euros par mois : un petit VPS** (Hetzner, OVH, Scaleway, DigitalOcean...). Le plus fiable. Une machine avec 1 Go de RAM suffit largement (ce programme n'utilise pas de navigateur, il est léger). Choisissez Ubuntu, connectez-vous en SSH, installez Node.js, puis suivez les étapes 1 à 3.

## Modifier les messages

Ouvrez `config.json`. Chaque message a une `key` (identifiant, ne pas changer), un `day` (jour du mois, 1 à 28 recommandé) et un `text` (`\n` = retour à la ligne). Puis : `pm2 restart mosa3adat`.
