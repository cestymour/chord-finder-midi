# Historique des versions

Toutes les évolutions notables d’InstantChordBT sont listées ici, de la plus récente à la plus ancienne.

Le format s’inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les numéros suivent le [versionnage sémantique](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`. Le numéro affiché dans les paramètres de l’application est celui du champ `version` de `package.json`, et chaque version publiée porte un tag git `vX.Y.Z`.

## [Non publié]

## [0.5.0] — 2026-11-03

### Ajouté

- **Nom du piano connecté** dans la ligne d’état de l’écran Piano, avec l’icône Bluetooth quand il est connecté directement (à la place de « MIDI connecté »).
- **Bouton « Déconnecter »** pour le piano Bluetooth, dans la ligne d’état.
- **Reconnexion automatique** : si la liaison Bluetooth se coupe (piano éteint, trop loin), l’application réessaie seule pendant une vingtaine de secondes. Ensuite, le bouton propose « Reconnecter » avec le nom du piano, sans repasser par la liste des appareils, et un lien « Connecter un autre piano ».
- À la réouverture de l’application, le dernier piano Bluetooth est proposé directement, si le navigateur le permet.
- **Connexion par câble USB expliquée** sur l’écran de connexion : le piano branché en USB est détecté tout seul (sur téléphone, avec un adaptateur USB OTG).

### Modifié

- L’écran sans piano s’intitule « Connectez votre piano » et présente les deux moyens : Bluetooth et câble USB.
- **Messages d’erreur utiles** à la place de « Erreur de connexion Bluetooth. » : piano absent de la liste, Bluetooth désactivé, accès refusé, piano déjà connecté ailleurs. Même chose pour l’accès MIDI refusé ou un navigateur qui ne gère pas le MIDI par câble (iPhone, iPad).
- Les ports MIDI virtuels du système (« Midi Through » sous Linux) ne comptent plus comme un piano connecté.
- Débrancher le câble USB relâche les notes en cours, comme une coupure Bluetooth.
- Le bouton Bluetooth s’affiche même si la demande d’autorisation MIDI du navigateur reste sans réponse.

## [0.4.0] — 2026-11-03

### Ajouté

- **Quinte facultative** : les accords de 7e et au-delà sont reconnus sans leur quinte juste, comme on les joue souvent (Do Mi Si♭ donne `C7`). Les accords de 13e se reconnaissent aussi sans leur 9e (et sans leur 11e pour `m13`), par exemple Do Mi Si♭ La.
- Les notes facultatives non jouées restent affichées sous le nom de l’accord, atténuées et entre parenthèses : un G7 joué sans ré montre quand même « (Ré 5) ».
- **Réglage « Accords incomplets »** dans les paramètres (Oui par défaut). Sur « Non », un accord n’est reconnu que si toutes ses notes sont jouées, comme avant. Le choix est mémorisé pour les ouvertures suivantes.
- **Nouveaux types d’accords** : `7♭9`, `7♯9`, `7♯11`, `9sus4`, `add11` et `mM9`, reconnus au piano et proposés dans le dictionnaire.
- **Pédale de sustain** : les notes tenues par la pédale comptent pour l’accord jusqu’à ce qu’on la relève (câble et Bluetooth).

### Modifié

- **Orthographe exacte des notes** : chaque note d’un accord est écrite par rapport à sa fondamentale. Fa mineur s’écrit Fa La♭ Do même en mode dièses, Mi augmenté Mi Sol♯ Si♯, Do diminué 7 Do Mi♭ Sol♭ Si𝄫.
- **Nom de la fondamentale selon l’usage** : sur une touche noire, l’accord prend le nom de la tonalité qui a le moins d’altérations (`B♭`, `E♭`, `A♭`, `D♭` en majeur ; `C♯m`, `F♯m`, `G♯m`, `B♭m` en mineur). Le réglage dièses/bémols décide des cas d’égalité (`F♯`/`G♭`, `D♯m`/`E♭m`) et du nom des notes hors accord.
- Dans le dictionnaire, les boutons de fondamentale suivent le type d’accord choisi (`D♭` en majeur, `C♯` en mineur).
- Les touches enfoncées du clavier portent leur nom dans l’accord (Si♯ et non Do dans Mi augmenté).
- **Intervalles** : le tableau des notes affiche les extensions comme dans le nom de l’accord (`9`, `11`, `13`, `♯9`…, et non `2`, `4`, `6`) et la septième diminuée `𝄫7`, aussi bien au piano que dans le dictionnaire.
- **Accord non reconnu** : un point par touche enfoncée remplace le « ? » (`.`, `..`, `...`, jusqu’à ce qu’un accord soit reconnu).
- Les accords `13` et `maj13` ne contiennent plus de 11e juste, qui frotte contre la tierce et que l’on ne joue pas.

## [0.3.0] — 2026-11-03

### Ajouté

- **Son de piano sur le clavier virtuel** : enfoncer une touche joue la note, la relâcher l’étouffe, et « Effacer » coupe toutes les notes. Le son est synthétisé par le navigateur (Web Audio), sans aucun fichier audio à télécharger.
- **Son dans le dictionnaire d’accords** : choisir une fondamentale, un type d’accord ou un renversement fait entendre l’accord en arpège, du grave à l’aigu.
- Chaque touche brille brièvement au moment où sa note sonne (clavier virtuel et dictionnaire).
- **Réglage « Son »** dans les paramètres (🔊 / 🔇) pour couper le son de l’application. Le choix est mémorisé pour les ouvertures suivantes.

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

[Non publié]: https://github.com/cestymour/chord-finder-midi/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cestymour/chord-finder-midi/releases/tag/v0.1.0
