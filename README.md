# AutoGrid

Grilles d'évaluation CECRL, correction rapide en couleurs et export PDF.

## Installer ou mettre à jour (Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/Vylca/autogrid/main/install.sh | bash
```

La même commande sert pour les mises à jour. Après la première installation, `autogrid-update` suffit.

L'application s'installe dans `~/.local/share/autogrid` et apparaît dans le menu des applications. Rien d'autre n'est nécessaire.

## Où sont mes données ?

Tout reste sur l'ordinateur, dans `~/.config/AutoGrid/autogrid-data.json`. Une copie de sécurité (`autogrid-data.backup.json`) est faite à chaque lancement. Les mises à jour n'y touchent pas.

## Développement

```bash
npm install
npm start          # lancer l'application
npm test           # tests du calcul des notes et de l'import CSV
npm run dist       # construire le paquet Linux dans release/
```

Une nouvelle version est publiée en poussant un tag `vX.Y.Z` : GitHub construit le paquet Linux et le met en ligne.
