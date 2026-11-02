# AutoGrid

Grilles d'évaluation CECRL, correction rapide en couleurs et export PDF.

## Installer ou mettre à jour (Linux et macOS)

```bash
curl -fsSL https://raw.githubusercontent.com/Vylca/autogrid/main/install.sh | bash
```

Copier cette commande dans le Terminal. La même commande sert pour les mises à jour. Sous Linux, après la première installation, `autogrid-update` suffit.

Sous Linux, l'application s'installe dans `~/.local/share/autogrid` et apparaît dans le menu des applications. Sous macOS, elle s'installe dans le dossier Applications (puce Apple ou Intel, détectée automatiquement). Rien d'autre n'est nécessaire.

## Où sont mes données ?

Tout reste sur l'ordinateur, dans `~/.config/AutoGrid/autogrid-data.json` (Linux) ou `~/Library/Application Support/AutoGrid/autogrid-data.json` (macOS). Une copie de sécurité (`autogrid-data.backup.json`) est faite à chaque lancement. Les mises à jour n'y touchent pas.

## Développement

```bash
npm install
npm start          # lancer l'application
npm test           # tests du calcul des notes et de l'import CSV
npm run dist       # construire le paquet Linux dans release/
npm run dist:mac   # construire les paquets macOS (sur un Mac)
```

Pour publier une nouvelle version, changer `version` dans `package.json` et pousser sur `main` : GitHub construit les paquets Linux et macOS et les met en ligne.
