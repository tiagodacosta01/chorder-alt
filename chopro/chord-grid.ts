import { SongKey, applyEnharmonic, harmonicIndex, transposeChord } from "./music";

export type ChordVariant = "secdom" | "aem" | null;

export type ChordRow = {
  triad: string;
  seventh: string;
  slash: string | null;
  variante: string | null;
  varType: ChordVariant;
  romanLabel: string;
};

// Reference grid in C major — all other keys computed via transposeChord
const C_GRID: ChordRow[] = [
  { triad: "C",    seventh: "C7M",   slash: null,  variante: "C7", varType: "aem",    romanLabel: "I" },
  { triad: "Dm",   seventh: "Dm7",   slash: null,  variante: "A7", varType: "secdom", romanLabel: "IIm" },
  { triad: "Em",   seventh: "Em7",   slash: "C/E", variante: "B7", varType: "secdom", romanLabel: "IIIm" },
  { triad: "F",    seventh: "F7M",   slash: null,  variante: "Fm", varType: "aem",    romanLabel: "IV" },
  { triad: "G",    seventh: "G7",    slash: null,  variante: null, varType: null,     romanLabel: "V" },
  { triad: "Am",   seventh: "Am7",   slash: null,  variante: "E7", varType: "secdom", romanLabel: "VIm" },
  { triad: "Bdim", seventh: "Bm7b5", slash: "G/B", variante: null, varType: null,     romanLabel: "VIIdim" },
];

export function applyEnharmonicToGrid(grid: ChordRow[], preference: "sharp" | "flat" | null): ChordRow[] {
  if (!preference) return grid;
  const preferSharp = preference === "sharp";
  return grid.map((row) => ({
    ...row,
    triad:    applyEnharmonic(row.triad, preferSharp),
    seventh:  applyEnharmonic(row.seventh, preferSharp),
    slash:    row.slash    ? applyEnharmonic(row.slash, preferSharp)    : null,
    variante: row.variante ? applyEnharmonic(row.variante, preferSharp) : null,
  }));
}

export function buildChordGrid(key: string): ChordRow[] {
  if (!key || key === "C") return C_GRID;
  const semitones = harmonicIndex(key as SongKey);
  if (semitones === undefined || semitones === 0) return C_GRID;

  return C_GRID.map((row) => ({
    triad:      transposeChord(row.triad, "C", semitones),
    seventh:    transposeChord(row.seventh, "C", semitones),
    slash:      row.slash ? transposeChord(row.slash, "C", semitones) : null,
    variante:   row.variante ? transposeChord(row.variante, "C", semitones) : null,
    varType:    row.varType,
    romanLabel: row.romanLabel,
  }));
}
