# DEFUSTEL — maison de tailleur — lancer en local

## Lancer

Ouvrir un terminal (PowerShell) et copier :

```powershell
cd "C:\Users\DELL02\Desktop\Personal Builds\Massiri"
python scripts/serve_tournage.py 8096
```

Puis ouvrir : **http://127.0.0.1:8096/**

Arrêter : `Ctrl + C` dans le terminal.

### Adresses utiles

| Page | Adresse |
|---|---|
| Accueil (le film au défilement) | http://127.0.0.1:8096/ |
| Nos accessoires (boutique) | http://127.0.0.1:8096/accessoires.html |

Langue et devise : dans l'en-tête (ou le menu sur téléphone).
Version simple, sans mode tournage : `python -m http.server 8096 --bind 127.0.0.1 --directory site`

## Mode tournage (ordinateur + téléphone qui défilent ensemble)

Ce serveur est déjà ouvert au réseau local. Ordinateur et téléphone sur le **même Wi-Fi**.

1. Trouver l'adresse de l'ordinateur : `ipconfig` (ligne « Adresse IPv4 », ex. 192.168.1.23).
2. **Téléphone (pilote, c'est lui qu'on fait défiler)** : `http://192.168.1.23:8096/?tournage=pilote`
3. **Ordinateur (suit le téléphone)** : `http://127.0.0.1:8096/?tournage=suit`
4. Pour sortir du mode tournage : ajouter `?tournage=off` à l'adresse.

On peut inverser les rôles (l'ordinateur pilote, le téléphone suit).
Si Windows demande l'autorisation du pare-feu pour Python, accepter pour les réseaux privés.
