import { describe, expect, test } from "vitest";
import { CHORD_TEMPLATES } from "./chords.js";
import { ALTERED_COLUMNS, ALTERED_ROWS, MATRIX_COLUMNS, MATRIX_ROWS } from "./explorerLayout.js";

const cells = (rows) => rows.flatMap((row) => row.cells).filter((cell) => cell !== null);

describe("grilles du dictionnaire", () => {
  test("chaque type d'accord apparaît exactement une fois", () => {
    const placed = [...cells(MATRIX_ROWS), ...cells(ALTERED_ROWS)];
    expect([...placed].sort()).toEqual(CHORD_TEMPLATES.map((tpl) => tpl.suffix).sort());
  });

  test("chaque ligne a une case par colonne", () => {
    for (const row of MATRIX_ROWS) expect(row.cells.length).toBe(MATRIX_COLUMNS.length);
    for (const row of ALTERED_ROWS) expect(row.cells.length).toBe(ALTERED_COLUMNS.length);
  });

  test("étiquettes de lignes uniques", () => {
    for (const rows of [MATRIX_ROWS, ALTERED_ROWS]) {
      const labels = rows.map((row) => row.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});
