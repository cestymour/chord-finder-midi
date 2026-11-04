# Historique des versions

Toutes les évolutions notables d’InstantChordBT sont listées ici, de la plus récente à la plus ancienne.

Le format s’inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les numéros suivent le [versionnage sémantique](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`. Le numéro affiché dans les paramètres de l’application est celui du champ `version` de `package.json`, et chaque version publiée porte un tag git `vX.Y.Z`.

## [Non publié]

## [0.11.0] — 2026-11-05

### Ajouté

- **Accord plaqué dans « Accord → Notes »** : retoucher le même accord le fait entendre plaqué (toutes les notes ensemble), puis de nouveau arpégé, et ainsi de suite.
- **Hors ligne** : les polices de l'appli sont gardées en cache, l'affichage reste le même sans connexion.

### Modifié

- **Son de piano** : un vrai piano enregistré (Salamander Grand Piano d'Alexander Holm, licence CC-BY, crédité dans l'ⓘ du réglage « Son ») remplace le son synthétisé. Les échantillons (~900 Ko) sont gardés en cache avec l'appli : le son marche hors ligne.
- **Paramètres** : les ⓘ ouvrent leur explication dans une fenêtre, comme sur l'écran d'accueil, au lieu de l'insérer sous le réglage.
- **Écran d'accueil** : les trois boutons (Bluetooth, câble USB, Piano virtuel) ont le même style, contour vert atténué et icône verte ; le vert franc vient au survol ou quand l'explication USB est ouverte.
- **Paysage** : les onglets et la ligne d'état du piano tiennent sur une seule ligne, pour laisser plus de hauteur au reste. Les onglets gardent la même largeur (moitié gauche) sur les deux écrans. La ligne d'état y est une pastille plus claire, séparée des onglets par un trait, pour bien distinguer les deux.
- **« Accord → Notes »** : boutons plus hauts, plus faciles à toucher, avec le contour vert de l'écran d'accueil, et noms des fondamentales en plus grand. Moins d'espace autour de la carte de l'accord. En paysage, les 12 fondamentales tiennent sur une ligne.
- **Clavier en paysage** : sur un téléphone couché, les touches gardent leur largeur du portrait ; on en voit donc davantage (environ 4 octaves au lieu de 3).
- **Ordinateur** : l'appli utilise la largeur de l'écran au lieu d'une colonne de téléphone. Le clavier entier est visible, les autres possibilités s'affichent à droite de l'accord principal (centré quand il est seul), et dans « Accord → Notes » les fondamentales sont à droite de la carte de l'accord, avec les grilles « Classiques » et « Altérés » côte à côte.
- **« Connecter un piano »** : survol vert discret au lieu du rouge, réservé à « Déconnecter ».

### Corrigé

- **Paysage** : la carte de l'accord principal n'a plus de petite barre de défilement ; le nom de l'accord s'adapte à la hauteur disponible et les espaces sont resserrés.
- **Accords en bémols** : le ♭ (ou ♯, 𝄪, 𝄫), dessiné dans une police plus haute, n'agrandit plus la carte de l'accord ; les boutons en dessous ne bougent plus d'un accord à l'autre.

## [0.10.0] — 2026-11-04

### Modifié

- **Écran d'accueil repensé** : le Bluetooth et le câble USB ont maintenant deux ronds verts de même taille, côte à côte (le câble USB a son symbole). En dessous, un grand bouton « Piano virtuel », avec un petit clavier dessiné, sous la question « Pas de piano connecté ? ».
- **Explications en fenêtre** : toucher le rond USB ou un ⓘ ouvre l'explication dans une fenêtre en haut de l'écran, sans rien décaler. Elle se ferme en touchant ailleurs (ou avec Échap).
- **« Votre piano n'apparaît pas ? »** : après avoir fermé la liste des appareils Bluetooth sans choisir, ce conseil n'est plus un message affiché en permanence, mais un discret ⓘ sur le rond Bluetooth.
- **« Clavier virtuel » devient « Piano virtuel »**, et son message d'attente « Jouez un accord au piano… ».
- **Bandeau d'état** : il garde la même hauteur avec ou sans le bouton « Connecter un piano ».

## [0.9.0] — 2026-11-04

### Corrigé

- **Renversements dans « Accord → Notes »** : chaque renversement met le degré suivant de l'accord à la basse et empile les autres notes au-dessus dans le même ordre (Dm9 : Ré Fa La Do Mi, puis Fa La Do Mi Ré, La Do Mi Ré Fa…). Avec les accords de 9e, 11e et 13e, les notes se mélangeaient, et après un tour complet on ne retrouvait pas la position de départ (le Dm9 revenait avec Ré Mi Fa La Do).

### Modifié

- **Onglets plus explicites** : « Piano » et « Accords » deviennent « Notes → Accord » (je joue des notes, l'appli trouve l'accord) et « Accord → Notes » (je choisis un accord, l'appli montre ses notes).
- **Dictionnaire en tableau** : les types d'accords sont rangés dans une grille, avec la famille en ligne (majeur, mineur, dominante, sus, diminué, augmenté…) et la note la plus haute en colonne (triade, 6e, 7e, 9e, 11e, 13e). On lit l'accord à l'intersection : la ligne « m » croisée avec la colonne 9e donne m9. Les accords altérés (7♭9, 7♯9, m7♭5…) ont leur propre tableau, accord de base en ligne et altération en colonne, replié sous « Altérés ▸ ». Les boutons ne répètent plus la fondamentale (`m7` au lieu de `C♯m7`, `M` pour l'accord majeur) et sont plus compacts.
- **Clavier moins haut** : le piano à l'écran prend un peu moins de place, sur les deux écrans, pour laisser plus de place au reste.

## [0.8.0] — 2026-11-04

### Modifié

- **Noms d'accords tout en dièses ou tout en bémols** : le réglage des altérations décide maintenant du nom de chaque accord sur touche noire. Avec les dièses, on lit toujours C♯, D♯, F♯, G♯, A♯ ; avec les bémols, toujours D♭, E♭, G♭, A♭, B♭. La basse d'un accord renversé suit la même règle (E/A♭ en bémols, D♯/G en dièses). Les notes du tableau gardent leur nom exact à partir de la fondamentale (la tierce de D♯ est Fa𝄪, celle de G♭m est Si𝄫).

## [0.7.1] — 2026-11-04

### Modifié

- **Affichage plus stable entre deux accords** : un accord reconnu s'affiche toujours tout de suite. Quand les touches enfoncées ne forment plus d'accord (doigts qui se posent ou se lèvent un à un), l'affichage précédent reste un quart de seconde avant de changer.

## [0.7.0] — 2026-11-03

### Ajouté

- **Nouveaux accords** reconnus et proposés dans le dictionnaire : m6/9, maj7♯5, dimM7 (diminué septième majeure), 7♯5♭9 et 7♯5♯9 (dominantes altérées), maj7♯11, 13♯11, 13♭9 et 7♭13.
- **Quinte facultative** aussi dans add9, madd9, 7sus4 et 9sus4 (Do Mi Ré donne Cadd9, Do Ré Fa Si♭ donne C9sus4), et **neuvième facultative** dans m11 (Do Mi♭ Fa Si♭ propose Cm11).
- **Câble USB autorisé à la demande** : la demande d'accès aux appareils MIDI ne s'ouvre plus au lancement. Un bouton « Autoriser le câble USB » la déclenche, et une fois l'accès accordé, le piano en USB est détecté tout seul aux lancements suivants.
- **Lecteurs d'écran** : l'accord joué est annoncé (par exemple « Cm, Mineur ») quand il change, une fois les doigts posés.

### Modifié

- **Coupure Bluetooth** : pendant la reconnexion automatique, l'écran Piano reste affiché (seule la ligne d'état indique la reconnexion) au lieu de revenir à l'écran de connexion.
- **Clavier virtuel sans piano** : la ligne d'état affiche simplement « Clavier virtuel », au lieu de « Connexion… » ou d'un message MIDI en rouge.
- **Navigateur sans Bluetooth** (iPhone, Firefox) : le gros bouton Bluetooth, inutilisable, est remplacé par le message « Bluetooth non disponible », et le clavier virtuel et le dictionnaire passent au premier plan.
- **Accords renversés mieux écrits** : quand la fondamentale peut s'écrire avec un dièse ou un bémol (F♯/G♭ majeur, D♯m/E♭m), l'écriture qui donne la basse la plus simple est gardée (E♭m6/C plutôt que D♯m6/B♯).
- **Écran de connexion** : le bouton « Dictionnaire d'accords » est retiré (le dictionnaire reste dans l'onglet Accords), et le bouton « Clavier virtuel » porte l'icône 🎹.
- **Dictionnaire** : la carte de l'accord choisi et les fondamentales restent affichées en haut ; seuls les types d'accord défilent dessous. Le titre « Fondamentale » est retiré.
- **Paramètres** : un bouton ⓘ après « Affichage des altérations » explique pourquoi des bémols restent affichés avec les dièses (et inversement) : dans un accord, chaque note garde son nom exact.
- **Nom de m6 corrigé** : « Mineur sixte » en français et « Menor con sexta » en espagnol (« sixte mineure » désigne un autre intervalle).

### Corrigé

- **Clavier virtuel** : plusieurs touchers très rapides ne désynchronisent plus le son et les touches allumées.
- **Reconnexion Bluetooth au lancement** : si le piano retrouvé par le navigateur refuse la première connexion, l'appli attend qu'il se signale (jusqu'à 10 s) puis réessaie, au lieu d'afficher tout de suite « Connexion impossible ».

## [0.6.1] — 2026-11-03

### Corrigé

- **Accord tenu conservé** : brancher ou débrancher un autre instrument MIDI n’efface plus l’accord en cours ni l’état de la pédale. Seules les notes du piano qui se déconnecte sont relâchées, et chaque piano a sa propre pédale de sustain.
- **Reconnexion Bluetooth plus fiable** : après une déconnexion puis une reconnexion rapides, une nouvelle coupure relance bien la reconnexion automatique (l’appli ne reste plus « connectée » sans recevoir de notes).
- **Piano Bluetooth libéré** : une connexion annulée (« Déconnecter » pendant la connexion) ou ratée ne garde plus le piano connecté en arrière-plan, ce qui empêchait d’autres appareils de s’y connecter.
- **Touches cliquées conservées** quand on touche l’onglet déjà affiché.
- **Son** : le clavier et le dictionnaire ne deviennent plus muets sur les anciens Safari (iOS).

## [0.6.0] — 2026-11-03

### Modifié

- **Écrans Piano et Clavier réunis** : il ne reste que deux onglets, Piano et Accords. Sans piano connecté, l’écran Piano propose toujours d’abord la connexion. Le bouton « Clavier virtuel » affiche le clavier à l’écran, et un bouton « Connecter un piano » dans la ligne d’état ramène à la connexion.
- **Clavier affiché avec un piano connecté** : les touches jouées sur le vrai piano s’allument à l’écran, avec le nom des notes. Le clavier défile tout seul vers les notes jouées. On peut aussi toucher le clavier à l’écran ; jouer sur le vrai piano efface les touches touchées.
- **Clavier de 88 touches** (au lieu de 3 octaves), ouvert sur la zone centrale, le reste par défilement. Le dictionnaire l’utilise aussi.
- **Écrans plus épurés** : les longues explications (câble USB, messages d’erreur Bluetooth, accords incomplets) sont remplacées par un message court suivi d’un bouton ⓘ qui affiche le détail.
- **Paramètres redessinés** : le son et les accords incomplets se règlent avec un interrupteur, dièses/bémols avec deux boutons accolés. En bas, sous un trait, la version, l’auteur (cestymour, lien vers le code sur GitHub) et la licence MIT.

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

[Non publié]: https://github.com/cestymour/chord-finder-midi/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/cestymour/chord-finder-midi/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/cestymour/chord-finder-midi/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/cestymour/chord-finder-midi/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cestymour/chord-finder-midi/releases/tag/v0.1.0
