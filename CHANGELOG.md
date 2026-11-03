# Historique des versions

Toutes les évolutions notables d’InstantChordBT sont listées ici, de la plus récente à la plus ancienne.

Le format s’inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les numéros suivent le [versionnage sémantique](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`. Le numéro affiché dans les paramètres de l’application est celui du champ `version` de `package.json`, et chaque version publiée porte un tag git `vX.Y.Z`.

## [Non publié]

## [0.2.0] — 2026-11-03

### Ajouté

- **Application en quatre langues** : français (par défaut), anglais, allemand et espagnol, au choix dans les paramètres par un drapeau. Le choix est mémorisé pour les ouvertures suivantes. Les drapeaux sont dessinés en SVG, car les emoji drapeaux ne s’affichent pas sous Windows.
- Tous les textes sont traduits : interface, messages Bluetooth, types et familles d’accords, renversements.
- Noms de notes selon l’usage de chaque langue : Do Ré Mi (français), Do Re Mi (espagnol), C D E (anglais), C D E … A B H (allemand). Numéro d’octave du Do central : Do3 en français et en espagnol, C4 en anglais et en allemand.
- En allemand, les symboles d’accords écrivent le si « H » et le si bémol « B » (`Hmaj7`), comme le tableau des notes.

### Modifié

- L’onglet Piano affiche l’emoji 🎹 au lieu du voyant MIDI coloré. L’état de la connexion reste affiché sur l’écran Piano.
- La page HTML est déclarée en français, et la langue du document suit la langue choisie.
- Textes gris plus clairs, pour être plus lisibles sur le fond noir : titres de rubriques et indications, ainsi que les textes secondaires (onglets non sélectionnés, boutons, choix du dictionnaire).
- Sur l’écran Piano, les deux boutons « Clavier virtuel » et « Dictionnaire d’accords » ont la même largeur (côte à côte, ou l’un sous l’autre sur écran étroit).

### Corrigé

- Libellé français « Neuvième ajouté » corrigé en « Neuvième ajoutée ».
- Les symboles ♯ et ♭ des paramètres étaient affichés trop bas dans leur bouton ; ils sont maintenant centrés.

## [0.1.0] — 2026-11-03

Première version numérotée. Elle regroupe tout ce qui a été développé depuis le début du projet.

### Détection d’accords

- Reconnaissance instantanée des accords joués : triades, power chords, accords suspendus, de 6te, 7e, 9e, 11e et 13e.
- Correspondance stricte : toutes les notes de l’accord doivent être jouées, et une note en trop annule l’identification.
- Renversements en notation slash (`C/E`).
- Accord le plus probable en grand, avec jusqu’à trois autres lectures possibles.
- Tableau des notes et de leurs intervalles par rapport à la fondamentale.
- Carte « Accord non reconnu » quand les notes jouées ne forment aucun accord connu.
- Classement : un accord à l’état fondamental passe avant un renversement qui utilise les mêmes notes (Do Mi Sol La avec Do à la basse donne `C6`, et non `Am7/C`).

### Connexion du piano

- Par câble (Web MIDI) : toutes les entrées MIDI du système sont écoutées automatiquement.
- En Bluetooth LE MIDI (Web Bluetooth), avec décodage direct des paquets pour les systèmes qui n’exposent pas l’instrument en MIDI (notamment Chrome sous Windows).
- L’application s’ouvre toujours sur l’écran Piano. Sans piano connecté, un grand bouton de connexion Bluetooth est proposé, avec des raccourcis vers le clavier virtuel et le dictionnaire.

### Clavier virtuel

- Clavier de 3 octaves à l’écran pour composer un accord sans piano : 2 octaves visibles en portrait avec défilement, les 3 en paysage et sur ordinateur.

### Dictionnaire d’accords

- Sens inverse de la détection : on choisit une fondamentale et un type d’accord, et ses notes s’allument sur le clavier.
- Extensions (9e, 11e, 13e) placées au-dessus de l’octave, comme on les joue.
- Bouton « Renverser » pour passer d’un renversement à l’autre ; le clavier défile tout seul si une note sort de l’écran.

### Interface

- Navigation par trois onglets : Piano, Clavier, Accords.
- Paramètres (roue crantée) : affichage des altérations en dièses (♯) ou en bémols (♭) dans toute l’application, choix mémorisé ; numéro de version.
- Vrais symboles ♯ et ♭ partout, y compris dans les noms d’accords (`C♯m7♭5`).
- Mise en page adaptée au portrait et au paysage.
- Application installable (PWA).
- Déploiement automatique sur GitHub Pages à chaque mise à jour de la branche `main`.

[Non publié]: https://github.com/cestymour/chord-finder-midi/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cestymour/chord-finder-midi/releases/tag/v0.1.0
