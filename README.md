# InstantChordBT — Détecteur d’accords MIDI

> ## 🚀 Essayez-la en ligne ! · Try it live!
> ### 👉 [Ouvrir l’application — cliquez ici ! · Open the app — click here!](https://cestymour.github.io/chord-finder-midi/)

🇫🇷 Jouez un accord sur votre clavier MIDI et son nom s’affiche instantanément. Ça fonctionne par câble ou en Bluetooth, directement dans le navigateur, sans rien installer.

🇬🇧 Play a chord on your MIDI keyboard and instantly see its name. It works over cable or Bluetooth, right in the browser, with nothing to install. *(English summary [below](#-english).)*

## Fonctionnalités

- **Reconnaissance instantanée des accords** : triades, power chords, accords suspendus, de 6te, 7e, 9e, 11e et 13e.
- **Renversements** : la note la plus grave est indiquée en notation slash (ex. `C/E`).
- **Autres lectures possibles** : quand plusieurs accords correspondent aux notes jouées, le plus probable est affiché en grand, avec jusqu’à trois alternatives en dessous.
- **Notes et intervalles** : chaque accord détaille ses notes en solfège (Do, Ré, Mi…) et leur intervalle par rapport à la fondamentale (1, ♭3, 5, ♭7…).
- **Deux modes de connexion** :
  - **USB / câble** via Web MIDI : toutes les entrées MIDI du système sont écoutées automatiquement.
  - **Bluetooth MIDI (BLE)** via Web Bluetooth : un bouton « Connexion Bluetooth MIDI » apparaît quand aucun instrument n’est détecté.
- **PWA installable** : ajoutez-la à l’écran d’accueil pour l’utiliser comme une application native.

Interface en français ; symboles d’accords au format anglais usuel (C, Dm, Fmaj7, etc.).

## Prérequis

- Un clavier MIDI, filaire ou Bluetooth LE MIDI.
- **Chrome** ou **Edge** sur ordinateur ou Android (recommandé). Web MIDI fonctionne aussi dans d’autres navigateurs, mais Firefox et Safari (donc tous les navigateurs iOS) ne prennent pas en charge Web Bluetooth.
- **HTTPS** ou `localhost` (obligatoire pour Web MIDI et Web Bluetooth).

## Développement

```bash
npm install
npm run dev      # serveur de développement (http://localhost:5173)
npm run build    # build de production dans dist/
npm run preview  # prévisualisation du build
npm run lint     # ESLint
```

## Déploiement

Chaque push sur `main` déclenche le workflow `.github/workflows/deploy.yml`, qui compile l’application et la publie sur GitHub Pages.

En production, `vite.config.js` fixe `base` à `/chord-finder-midi/`. Pour héberger ailleurs, adaptez cette valeur à votre URL.

## Technologies

- [React 19](https://react.dev), [Vite 8](https://vitejs.dev), [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [ble-midi-parser](https://www.npmjs.com/package/ble-midi-parser) pour décoder les paquets MIDI over BLE
- Web MIDI API, Web Bluetooth API

## 🇬🇧 English

**InstantChordBT** shows, in real time, the chord matching the notes you hold on a MIDI keyboard: triads, power chords, sus, 6th, 7th, 9th, 11th and 13th chords, and inversions as slash chords (e.g. `C/E`). When several chords fit, the most likely one is shown first, with up to three alternatives.

- **Connect** by cable (Web MIDI, all inputs are picked up automatically) or over Bluetooth LE MIDI (Web Bluetooth).
- **Browser**: Chrome or Edge on desktop or Android. Firefox and Safari (including every iOS browser) don’t support Web Bluetooth.
- **Install** it as a PWA from your browser.
- The interface is in French; chord symbols use standard English notation.

Run it locally with `npm install` then `npm run dev`.

## Licence

[MIT](LICENSE) © cestymour
