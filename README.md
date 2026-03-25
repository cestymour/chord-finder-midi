# InstantChordBT — Détecteur d’accords MIDI

Application web (**React** + **Vite**) qui affiche en temps réel le ou les accords correspondant aux notes jouées sur un clavier MIDI. Connexion possible en **USB / filaire** (Web MIDI) ou en **Bluetooth Low Energy** (Web Bluetooth + parsing BLE MIDI).

Interface en français (noms de notes, libellés d’accords) ; symboles d’accord au format usuel anglais (C, Dm, Fmaj7, etc.).

## Fonctionnalités

- Détection d’accords à partir des notes MIDI actives (analyse par classes de hauteur, plusieurs modèles : triades, 6e, 7e, 9e, 11e, 13e, suspendus, power chords, etc.).
- **Web MIDI** : sélection d’une entrée MIDI du système (câble, interface, pilote virtuel).
- **Bluetooth MIDI** : appairage d’un périphérique compatible BLE MIDI (navigateur et OS doivent exposer Web Bluetooth).
- **PWA** : installable, cache et mise à jour du service worker via `vite-plugin-pwa`.

## Prérequis

- **HTTPS** ou `localhost` (obligatoire pour Web MIDI et Web Bluetooth).
- Navigateur récent avec **Web MIDI** (Chrome, Edge, Opera, etc.).
- **Web Bluetooth** : surtout **Chrome** ou **Edge** sur desktop/Android ; la prise en charge varie selon l’OS (Safari/Firefox limitent souvent l’API).

## Installation et scripts

```bash
npm install
npm run dev      # serveur de développement (http://localhost:5173)
npm run build    # build de production dans dist/
npm run preview  # prévisualisation du build
npm run lint     # ESLint
```

## Déploiement

Le fichier `vite.config.js` fixe `base` à `/chord-finder-midi/` en production : hébergez le contenu de `dist/` sous ce chemin (GitHub Pages, etc.), ou adaptez `base` à votre URL.

## Technologies

- [React 19](https://react.dev), [Vite 8](https://vitejs.dev)
- [ble-midi-parser](https://www.npmjs.com/package/ble-midi-parser) pour les paquets MIDI over BLE
- Web MIDI API, Web Bluetooth API

## Licence

[MIT](LICENSE)
