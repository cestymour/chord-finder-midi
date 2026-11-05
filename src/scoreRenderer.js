// Dessin de la portée de la carte d'accord avec VexFlow (sans React).
// VexFlow et sa police musicale (Bravura) pèsent plusieurs centaines de Ko :
// ils sont chargés à la demande (`loadVexFlow`), hors du bundle principal.

import { VEX_ACCIDENTALS, vexKey } from "./score.js";

let vexFlowPromise = null;

/** Charge VexFlow et sa police une seule fois (même promesse ensuite). */
export function loadVexFlow() {
  vexFlowPromise ??= import("vexflow/bravura").then(async (module) => {
    // Les glyphes sont mesurés avec la police : il faut qu'elle soit prête
    await document.fonts.load("30px Bravura");
    return module;
  });
  return vexFlowPromise;
}

// Taille d'un interligne VexFlow (en unités du dessin), et marges autour
const STAVE_SPACING = 10;
const STAVE_WIDTH = 90;
const GRAND_STAFF_GAP = 70; // haut de la portée de sol → haut de celle de fa
const MARGIN = 2;
const STAVE_TAIL = 2; // lignes de la portée après la note la plus à droite

/**
 * Dessine dans `element` (vidé d'abord) un accord de notes sans hampe sur une
 * ou deux portées (`staves` : { treble, bass } de chooseStaves).
 * `colors` : { line, note, dim } (lignes et clés, têtes de notes, notes non jouées).
 * Renvoie la taille du dessin en interlignes ({ width, height }), pour que
 * l'interligne garde la même taille à l'écran quel que soit l'accord.
 */
export function drawChordScore(VF, element, staves, colors) {
  const {
    Renderer, Stave, StaveNote, StaveConnector, Accidental, Parenthesis,
    Voice, Formatter, ModifierPosition, BarlineType,
  } = VF;
  element.replaceChildren();

  const renderer = new Renderer(element, Renderer.Backends.SVG);
  renderer.resize(STAVE_WIDTH + 40, 400);
  const ctx = renderer.getContext();
  ctx.setFillStyle(colors.line);
  ctx.setStrokeStyle(colors.line);

  const parts = [
    ["treble", staves.treble],
    ["bass", staves.bass],
  ].filter(([, notes]) => notes);
  const grand = parts.length === 2;
  // Large marge au-dessus : les lignes supplémentaires ne sortent jamais du dessin
  const top = 150;

  const drawn = parts.map(([clef, notes], i) => {
    const stave = new Stave(grand ? 18 : 0, top + i * GRAND_STAFF_GAP, STAVE_WIDTH, {
      spacingBetweenLinesPx: STAVE_SPACING,
    });
    stave.addClef(clef);
    stave.setBegBarType(BarlineType.NONE);
    stave.setEndBarType(BarlineType.NONE);
    stave.setContext(ctx);

    // Noire sans hampe : tête noire (« /so ») sur une ronde (pas de hampe)
    const note = new StaveNote({
      keys: notes.map((n) => `${vexKey(n.note, n.midi)}/so`),
      duration: "w",
      clef,
    });
    note.setStyle({ fillStyle: colors.note, strokeStyle: colors.note });
    note.setLedgerLineStyle({ strokeStyle: colors.line });
    notes.forEach((n, index) => {
      const accidental = VEX_ACCIDENTALS[n.note.alter + 2];
      if (accidental) note.addModifier(new Accidental(accidental), index);
      if (n.missing) {
        note.addModifier(new Parenthesis(ModifierPosition.LEFT), index);
        note.addModifier(new Parenthesis(ModifierPosition.RIGHT), index);
        note.setKeyStyle(index, { fillStyle: colors.dim, strokeStyle: colors.dim });
      }
    });
    // Altérations et parenthèses de la couleur des notes
    for (const modifier of note.getModifiers()) {
      modifier.setStyle({ fillStyle: colors.note, strokeStyle: colors.note });
    }
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([note]);
    return { stave, voice };
  });

  Stave.formatBegModifiers(drawn.map((d) => d.stave));
  const formatter = new Formatter();
  drawn.forEach((d) => formatter.joinVoices([d.voice]));
  formatter.format(drawn.map((d) => d.voice), 0);
  // Même début de notes sur les deux portées (clés de largeurs différentes)
  const noteStartX = Math.max(...drawn.map((d) => d.stave.getNoteStartX()));
  drawn.forEach((d) => d.stave.setNoteStartX(noteStartX));

  drawn.forEach((d) => d.stave.draw());
  if (grand) {
    for (const type of ["brace", "singleLeft"]) {
      new StaveConnector(drawn[0].stave, drawn[1].stave).setType(type).setContext(ctx).draw();
    }
  }
  drawn.forEach((d) => d.voice.draw(ctx, d.stave));

  // Portée raccourcie : ses lignes s'arrêtent juste après l'accord (têtes,
  // parenthèses, lignes supplémentaires), quelle que soit sa largeur prévue
  const svg = element.querySelector("svg");
  const end = inkBox([...svg.querySelectorAll(".vf-stavenote")]).right + STAVE_TAIL;
  for (const line of svg.querySelectorAll(".vf-stave path")) {
    line.setAttribute("d", line.getAttribute("d").replace(/L[\d.-]+ /, `L${end} `));
  }

  // Recadre le dessin sur ce qui a été tracé
  const box = inkBox([svg]);
  const x = box.left - MARGIN;
  const y = box.top - MARGIN;
  const width = box.right - box.left + 2 * MARGIN;
  const height = box.bottom - box.top + 2 * MARGIN;
  svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.style.removeProperty("width");
  svg.style.removeProperty("height");
  return { width: width / STAVE_SPACING, height: height / STAVE_SPACING };
}

let measureContext = null;

/**
 * Étendue réellement dessinée par les éléments `roots` (et leurs descendants).
 * Les glyphes (clés, têtes, altérations)
 * sont du texte : getBBox() leur donne toute la hauteur de ligne de la police
 * Bravura (environ 4 fois la portée), d'où de grands vides en haut et en bas.
 * Leur étendue vient donc de l'encre du glyphe (measureText), mesurée depuis
 * leur point d'ancrage (attributs x et y).
 */
function inkBox(roots) {
  measureContext ??= document.createElement("canvas").getContext("2d");
  const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const add = (left, top, right, bottom) => {
    box.left = Math.min(box.left, left);
    box.top = Math.min(box.top, top);
    box.right = Math.max(box.right, right);
    box.bottom = Math.max(box.bottom, bottom);
  };
  const all = (selector) => roots.flatMap((root) => [...root.querySelectorAll(selector)]);
  // Les rectangles transparents (zones de clic de VexFlow) ne comptent pas :
  // avec des parenthèses, celui de l'accord fait toute la hauteur du dessin
  for (const shape of all("path, rect")) {
    if (shape.getAttribute("opacity") === "0") continue;
    const b = shape.getBBox();
    add(b.x, b.y, b.x + b.width, b.y + b.height);
  }
  for (const text of all("text")) {
    if (!text.textContent) continue;
    const style = getComputedStyle(text);
    measureContext.font = `${style.fontSize} ${style.fontFamily}`;
    const ink = measureContext.measureText(text.textContent);
    const baseline = parseFloat(text.getAttribute("y"));
    const x = parseFloat(text.getAttribute("x"));
    add(
      x - ink.actualBoundingBoxLeft,
      baseline - ink.actualBoundingBoxAscent,
      x + ink.actualBoundingBoxRight,
      baseline + ink.actualBoundingBoxDescent,
    );
  }
  return box;
}
