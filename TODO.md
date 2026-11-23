# TODO — évolutions prévues

## Mode micro : reconnaître les accords d'un vrai piano acoustique

**Statut :** les deux moteurs sont faits, reste à les comparer sur le terrain. Fait : le moteur A (`src/micChroma.js`), le moteur B (`src/micBasicPitch.js`, modèle chargé par `src/micBasicPitchModel.js`), la capture commune (`src/micCapture.js`), le suivi commun (`src/micTracker.js`), le hook `src/useMicrophone.js` et toute l'intégration (ronds « Micro A » et « Micro B », statut avec vumètre et durée de chaque analyse, son coupé pendant l'écoute, textes `mic.*` dans les 8 langues, tests sur signaux synthétiques, et le vrai modèle B exécuté dans les tests). Reste à faire :

1. **Essais sur le vrai piano droit** avec les deux moteurs (protocole plus bas). Les seuils ont été réglés sur des signaux synthétiques seulement : ils devront sans doute bouger (`MIN_FUNDAMENTAL`, `GHOST_RATIO`, `MATCH_CENTS` dans `micChroma.js` ; `BASIC_PITCH_TRACKER`, `EDGE_FRAMES`, `READ_FRAMES` dans `micBasicPitch.js` ; `onSalience`, `offSalience`, `enterDb`, `gateDb` dans `micTracker.js`). La durée affichée à côté du vumètre sert à juger la charge de calcul (moteur B : environ 1,7 s par analyse dans un navigateur sans carte graphique ; inconnue sur un vrai téléphone).
2. **Enregistrements WAV** du piano droit, à ajouter aux tests dès qu'il y en a.
3. **Moteur B trop lent sur téléphone ?** Pistes : le backend WASM de TensorFlow.js (`@tensorflow/tfjs-backend-wasm`, souvent plus rapide que WebGL sur mobile pour un petit modèle, mais ses fichiers `.wasm` sont à servir et à mettre en cache), ou espacer les analyses (`minIntervalMs`). Quand les analyses sont espacées de plus de 300 ms, le suivi affiche déjà une lecture sans attendre sa confirmation (`slowFrameMs`).
4. **Accords peu fiables** (9, 11, 13, altérés) : décision reportée après les essais (rien de filtré pour l'instant).
5. **Une fois le moteur choisi** : un seul rond « Micro » sous « Écoutez votre piano » (supprimer l'autre moteur, le libellé « A » / « B », `MicButton engine`, la durée d'analyse de `MicLevel` et la clé `mic.computeTime` ; si A est gardé, retirer aussi TensorFlow.js, le modèle et ses règles de cache dans `vite.config.js`), puis publier en **1.1.0** (nouvelle source de notes, sans rien casser de l'existant : version mineure).

Écart avec le plan ci-dessous : le moteur A ne fait pas un simple chroma. Il estime des notes (somme des harmoniques, puis retrait de ceux de chaque note retenue), et c'est le suivi qui replie en classes de hauteur et garde la note la plus grave comme basse. Le grave est analysé sur environ 340 ms, le reste sur les 170 ms les plus récentes.

### Idée à étudier plus tard : étalonnage sur le piano de l'utilisateur

Pas décidé, ne pas développer pour l'instant. Proposer, micro allumé, de jouer quelques notes demandées une à une (par exemple La1, Do3, Mi4… en notation française), et mesurer pour chacune la fréquence réelle de la fondamentale et de ses harmoniques. On en déduirait les réglages propres à cet instrument : écart d'accord (au lieu du recalage automatique), inharmonicité des cordes selon le registre (où chercher chaque harmonique), timbre (force relative des harmoniques, utile pour le retrait des harmoniques et les fantômes), niveau du micro (seuils de silence). Résultat enregistré dans `localStorage`, avec un bouton pour refaire l'étalonnage. À évaluer après les essais : le gain doit justifier une étape de plus pour l'utilisateur.

### Objectif

Ajouter une **3ᵉ source de notes** : le micro de l'appareil écoute un piano acoustique (piano droit, sans sortie MIDI) et l'appli en déduit l'accord joué. Ce mode **s'ajoute** au Bluetooth et à l'USB/MIDI et ne les remplace pas : l'utilisateur choisit sa source.

L'exactitude dans l'extrême grave et l'extrême aigu n'est pas prioritaire : ces notes servent peu pour les accords. On vise le registre central, en gros de Mi1 à Do5 (MIDI 40 à 84, E2 à C6 en notation anglaise).

### Pourquoi c'est faisable

- **Navigateur :** `navigator.mediaDevices.getUserMedia({ audio })` et la Web Audio API (`AudioContext`, `AnalyserNode` ou mieux un `AudioWorklet`). Il faut un contexte sécurisé, déjà exigé par l'appli. Contrairement à Web MIDI et Web Bluetooth, ça marche **aussi sur Safari et iOS** : le mode micro ouvrirait l'appli aux iPhone.
- **Architecture :** le micro devient une source de plus dans `pianoSources` (clé `"mic"`), qui appelle `handleNoteOn` / `handleNoteOff` (et `onRelease` quand on coupe le micro), comme `useMIDI` et `useBluetoothMIDI`. `identifyChords`, les cartes, la portée, `DISPLAY_HOLD_MS` et `ChordAnnouncer` restent inchangés.
- Tout le traitement reste **local** dans le navigateur. Aucun son ne part sur le réseau, ce qu'il faudra dire dans le texte d'aide (ⓘ).

### Difficultés connues

1. **Harmoniques.** Un Do produit aussi un Sol (3ᵉ harmonique) et un Mi (5ᵉ harmonique) : une note seule peut ressembler à un accord majeur. Il faut atténuer les harmoniques, ou laisser un modèle appris s'en charger.
2. **Résolution dans le grave.** Deux notes voisines ne sont séparées que de 1,6 Hz (La0) à environ 5 Hz (Mi2). Les distinguer demande une longue fenêtre d'analyse, donc de la latence. C'est le principal risque pour la **basse**, et donc pour les renversements (`C/E`).
3. **Piano droit.** Accord souvent approximatif (prévoir une tolérance de ± 30 à 50 cents, voire un recalage automatique du La de référence), cordes inharmoniques (harmoniques aigus décalés vers le haut), son qui décroît vite.
4. **Fin des notes.** Le micro ne voit ni le relâchement des touches ni la pédale. Il faut décider quand une note « s'arrête » : seuil d'énergie avec hystérésis, plus une attaque nouvelle qui remplace l'accord précédent.
5. **Environnement.** Micro de téléphone, écho de la pièce, voix, bruit.
6. **Rétroaction.** Le son de piano de l'appli (`pianoSound.js`) ne doit pas être capté. Couper la lecture tant que le micro écoute, ou au minimum ne pas jouer le clavier virtuel dans ce mode.
7. **Traitements du navigateur.** Demander `echoCancellation: false`, `noiseSuppression: false` et `autoGainControl: false` : sinon le navigateur traite la musique comme du bruit et la déforme.

### Fiabilité attendue (à confirmer sur le terrain)

| Ce qui est joué | Fiabilité probable |
|---|---|
| Triades (C, Am, G…) en position fondamentale, registre central | Bonne |
| Accords de 7ᵉ | Correcte |
| Renversements, basse | Fragile |
| 9, 11, 13, accords altérés | Peu fiable |

### Deux approches : coder les deux, puis choisir sur le terrain

On ne sait pas d'avance laquelle tiendra dans la réalité : latence, exactitude, poids, consommation sur mobile. **On implémente les deux derrière une même interface**, avec un réglage (au moins en phase de test) pour passer de l'une à l'autre, puis on décide après des essais en conditions réelles sur un vrai piano droit. Il est possible que l'une des deux ne marche pas du tout ; on la retirera alors.

Interface commune proposée : un module sans React (comme `chords.js`) qui reçoit des blocs audio et renvoie à intervalles réguliers `{ notes: Set<midi>, confidence }`, ou `{ pcs, bass, confidence }` converti ensuite en notes MIDI. Le hook `useMicrophone` compare avec l'état précédent et émet les note on / note off.

#### Approche A — chromagramme (traitement du signal classique)

Principe :
1. Fenêtre de Hann et FFT sur l'audio du micro (taille 8192 à 16384 échantillons à 44,1 ou 48 kHz, donc 170 à 340 ms ; recouvrement de 50 à 75 % pour rafraîchir toutes les 50 à 100 ms). Variante : une transformée à Q constant (CQT), qui donne directement une case par demi-ton.
2. Recherche des pics du spectre, avec interpolation parabolique pour affiner la fréquence. On se limite au registre utile (MIDI 40 à 84 environ).
3. Atténuation des harmoniques : pour chaque pic candidat, retirer l'énergie attendue à 2f, 3f, 4f, 5f (ou méthode du produit spectral).
4. Repliement en **12 classes de hauteur** (le chroma), normalisation, lissage dans le temps.
5. Seuil : une classe compte comme jouée au-dessus d'une fraction de la classe la plus forte.
6. **Basse :** le pic fondamental fiable le plus grave donne la note de basse.
7. Conversion en notes MIDI pour `identifyChords` : la basse, puis chaque autre classe placée dans l'octave au-dessus. `identifyChords` réduit déjà tout en classes de hauteur et ne garde que la note la plus grave pour la notation `/basse`. Une variante plus directe serait une fonction `identifyChordsFromPcs(pcs, bassPc)` dans `chords.js`.

Avantages : léger (rien à télécharger), rapide, entièrement testable avec des signaux synthétiques, code sous notre contrôle.
Inconvénients : sensible aux harmoniques et au timbre ; l'octave est perdue (seule la basse est estimée) ; réglage empirique des seuils.

#### Approche B — modèle appris (transcription par machine learning)

Principe : un réseau de neurones qui transcrit l'audio en notes MIDI (hauteur, début et fin de chaque note), exécuté dans le navigateur avec TensorFlow.js.

Candidats (licences, poids et compatibilité à vérifier avant de choisir) :
- **Basic Pitch** (Spotify, paquet npm `@spotify/basic-pitch`) : polyphonique et générique, modèle léger (quelques Mo), entrée à 22 050 Hz. **Point à vérifier en premier :** il traite l'audio par blocs de quelques secondes, ce qui ne convient pas au temps réel. Mesurer la latence obtenue avec des blocs courts et glissants.
- **Onsets and Frames** (Magenta.js) : entraîné spécifiquement sur le piano, donc probablement plus précis sur ce timbre, mais plus lourd et plus gourmand en calcul.

Avantages : gère bien mieux les harmoniques et la polyphonie ; donne de vraies notes MIDI, octave comprise, directement utilisables par `identifyChords` (basse et renversements compris).
Inconvénients : plusieurs Mo à télécharger (à précacher dans le service worker pour le hors-ligne : ajouter l'extension des fichiers du modèle à `workbox.globPatterns` et vérifier `maximumFileSizeToCacheInBytes`) ; calcul plus lourd sur téléphone (batterie, chauffe) ; latence potentiellement élevée ; dépendance externe. À charger à la demande dans un bloc séparé, comme VexFlow avec `loadVexFlow`.

### Intégration dans l'appli

- **Choix de la source :** sur l'écran de connexion (`ConnectScreen`), un 3ᵉ bouton rond « Micro » à côté de Bluetooth et USB, dans le même style (contour vert discret `--accent-line`). Une fois le micro actif, `ConnectionStatus` affiche « Micro » avec un bouton pour l'arrêter, comme « Déconnecter » en Bluetooth.
- **Hook `useMicrophone`** (dans `App.jsx` ou un fichier à part) : statuts du type `idle | prompt | listening | denied | unsupported | error`. La demande d'autorisation se fait sur un geste de l'utilisateur, comme « Autoriser le câble USB ». On suit `navigator.permissions.query({ name: "microphone" })` là où c'est disponible.
- **Réglage du moteur** (A / B) dans `SettingsDialog`, au moins pendant la phase de test ; on le retirera une fois le choix fait. Éventuellement un réglage de sensibilité (seuil).
- **Indicateur de niveau** (petit vumètre) pour voir que le micro entend bien, ce qui aidera aussi au diagnostic.
- **Pas d'accords incertains :** n'envoyer de notes que si la confiance dépasse un seuil. Pour ce mode, envisager de limiter l'affichage aux familles fiables (triades, 7ᵉ) ou de signaler « détection approximative ».
- **Textes courts avec détails derrière ⓘ** (règle de l'appli) : clés `mic.*` à ajouter dans les **8 langues** de `i18n.js` (bouton, statuts, refus, aide expliquant les limites et que l'audio reste sur l'appareil).
- Mettre à jour `CLAUDE.md` (architecture) et `CHANGELOG.md` (`[Non publié]`) au moment de l'implémentation.

### Tests

- **Tests unitaires (Vitest)** pour la partie pure : repérage des pics, atténuation des harmoniques, chroma, conversion en notes MIDI, sur des signaux synthétiques (sinusoïdes plus harmoniques, accords générés, léger désaccord).
- **Enregistrements réels** du piano droit (fichiers WAV courts : notes seules, triades, 7ᵉ, renversements, avec et sans pédale) rejoués dans les deux moteurs, pour comparer hors navigateur et éviter les régressions.

### Protocole d'essai grandeur nature (pour choisir A, B ou les deux)

Sur le vrai piano droit, avec le téléphone et avec l'ordinateur :
1. Jouer une liste fixe d'accords (triades majeures et mineures sur plusieurs fondamentales, 7ᵉ, quelques renversements, quelques 9ᵉ), dans le registre central puis plus grave.
2. Pour chaque moteur, noter : **taux d'accords justes**, **latence** ressentie entre l'attaque et l'affichage, **stabilité** (pas de clignotement entre deux accords), comportement avec la pédale, avec du bruit de fond (voix, pièce qui résonne), et charge sur le téléphone (fluidité, chauffe, batterie).
3. Décider : garder A, garder B, ou garder les deux (par exemple A par défaut et B en option « précis mais plus lourd »). Supprimer ce qui ne marche pas.
