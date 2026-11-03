# InstantChordBT — Détecteur d’accords MIDI

> ## 🚀 Essayez-la en ligne ! · Try it live!
> ### 👉 [Ouvrir l’application — cliquez ici ! · Open the app — click here!](https://cestymour.github.io/chord-finder-midi/)

🇫🇷 Jouez un accord sur votre clavier MIDI et son nom s’affiche instantanément. Ça fonctionne par câble ou en Bluetooth, directement dans le navigateur, sans rien installer. Pas de piano sous la main ? Composez l’accord sur le clavier virtuel à l’écran, ou cherchez un accord dans le dictionnaire pour voir quelles touches jouer.

🇬🇧 Play a chord on your MIDI keyboard and instantly see its name. It works over cable or Bluetooth, right in the browser, with nothing to install. No piano at hand? Build the chord on the on-screen keyboard, or look a chord up in the dictionary to see which keys to play. *(English summary [below](#-english).)*

## Fonctionnalités

L’application comporte trois écrans, accessibles par les onglets en haut : **Piano**, **Clavier** et **Accords**. Elle s’ouvre toujours sur l’écran Piano.

- **Reconnaissance instantanée des accords** : triades, power chords, accords suspendus, de 6te, 7e, 9e, 11e et 13e.
- **Renversements** : la note la plus grave est indiquée en notation slash (ex. `C/E`).
- **Autres lectures possibles** : quand plusieurs accords correspondent aux notes jouées, le plus probable est affiché en grand, avec jusqu’à trois alternatives en dessous.
- **Notes et intervalles** : chaque accord détaille ses notes en solfège (Do, Ré, Mi…) et leur intervalle par rapport à la fondamentale (1, ♭3, 5, ♭7…).
- **Écran Piano**, pour jouer sur un vrai clavier MIDI :
  - **USB / câble** via Web MIDI : toutes les entrées MIDI du système sont écoutées automatiquement.
  - **Bluetooth MIDI (BLE)** via Web Bluetooth : tant qu’aucun instrument n’est connecté, un grand bouton « Connexion Bluetooth MIDI » est proposé. En dessous, des raccourcis mènent au clavier virtuel et au dictionnaire.
  - Sur l’écran Piano, une ligne d’état indique la connexion MIDI (connecté, aucun instrument, non disponible).
- **Écran Clavier** (clavier virtuel, sans piano) : un clavier de 3 octaves (Do2–Si4). En portrait, 2 octaves sont visibles et on fait défiler pour la troisième ; en paysage et sur ordinateur, les 3 octaves sont affichées. Chaque clic enfonce une touche et la laisse enfoncée, un second clic la relâche ; « Effacer » relâche tout. Chaque touche enfoncée fait entendre sa note. La détection d’accord est la même qu’avec un piano.
- **Écran Accords** (dictionnaire) : le sens inverse. Choisissez une fondamentale et un type d’accord, et ses notes s’allument sur le clavier. Les extensions (9e, 11e, 13e) sont placées au-dessus de l’octave, comme on les joue. « Renverser » passe d’un renversement à l’autre, et le clavier défile tout seul si une note sort de l’écran. Chaque choix fait entendre l’accord en arpège.
- **Paramètres** (roue crantée) : choix de la langue, de l’affichage des altérations, en dièses (♯) ou en bémols (♭), pour toute l’application, et du son (activé ou coupé). Ces choix sont mémorisés pour les ouvertures suivantes. La version de l’application y est aussi indiquée.
- **Quatre langues** : français (par défaut), anglais, allemand et espagnol. Les noms de notes suivent l’usage de chaque langue (Do Ré Mi, C D E, Do Re Mi, et en allemand H pour si et B pour si bémol).
- **Son de piano** synthétisé par le navigateur (Web Audio), sans fichier audio à télécharger. L’écran Piano reste muet, puisqu’on entend le vrai piano.
- **PWA installable** : ajoutez-la à l’écran d’accueil pour l’utiliser comme une application native.

Symboles d’accords au format anglais usuel (C, Dm, Fmaj7, C♯m7♭5, etc.), sauf en allemand où le si s’écrit H (Hmaj7).

## Prérequis

- Un clavier MIDI, filaire ou Bluetooth LE MIDI (facultatif grâce au clavier virtuel et au dictionnaire).
- **Chrome** ou **Edge** sur ordinateur ou Android (recommandé). Web MIDI fonctionne aussi dans d’autres navigateurs, mais Firefox et Safari (donc tous les navigateurs iOS) ne prennent pas en charge Web Bluetooth.
- **HTTPS** ou `localhost` (obligatoire pour Web MIDI et Web Bluetooth).

## Développement

Node.js 20.19+ requis par Vite (le fichier `.nvmrc` indique Node 24 : `nvm use`).

```bash
npm install
npm run dev      # serveur de développement (http://localhost:5173)
npm run build    # build de production dans dist/
npm run preview  # prévisualisation du build
npm run lint     # ESLint
```

La version affichée dans les paramètres est celle du champ `version` de `package.json`. L’historique des versions est dans [CHANGELOG.md](CHANGELOG.md).

## Déploiement

Chaque push sur `main` déclenche le workflow `.github/workflows/deploy.yml`, qui compile l’application et la publie sur GitHub Pages.

En production, `vite.config.js` fixe `base` à `/chord-finder-midi/`. Pour héberger ailleurs, adaptez cette valeur à votre URL.

## Technologies

- [React 19](https://react.dev), [Vite 8](https://vitejs.dev), [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [ble-midi-parser](https://www.npmjs.com/package/ble-midi-parser) pour décoder les paquets MIDI over BLE
- Web MIDI API, Web Bluetooth API, Web Audio API

## 🇬🇧 English

**InstantChordBT** shows, in real time, the chord matching the notes you hold on a MIDI keyboard: triads, power chords, sus, 6th, 7th, 9th, 11th and 13th chords, and inversions as slash chords (e.g. `C/E`). When several chords fit, the most likely one is shown first, with up to three alternatives.

The app has three screens, picked from the tabs at the top. It always opens on **Piano**.

- **Piano**: connect by cable (Web MIDI, all inputs are picked up automatically) or over Bluetooth LE MIDI (Web Bluetooth). Until an instrument is connected, a large Bluetooth button is shown, with shortcuts to the two other screens.
- **Clavier** (virtual keyboard, no piano needed): a 3-octave on-screen keyboard (2 octaves visible in portrait, scroll for the third). Click keys to hold them down (click again to release) and hear each note; the chord is detected the same way.
- **Accords** (chord dictionary): pick a root and a chord type to see its keys light up on the keyboard, and step through its inversions. Each choice plays the chord as an arpeggio.
- **Settings** (gear icon): pick the language (French by default, English, German or Spanish) and show accidentals as sharps (♯) or flats (♭) throughout the app, and turn the sound on or off. These choices are remembered. The app version is shown here too.
- **Browser**: Chrome or Edge on desktop or Android. Firefox and Safari (including every iOS browser) don’t support Web Bluetooth.
- **Install** it as a PWA from your browser.
- Chord symbols use standard English notation, except in German, which writes B natural as H (Hmaj7).

Run it locally with `npm install` then `npm run dev`.

## Licence

[MIT](LICENSE) © cestymour
