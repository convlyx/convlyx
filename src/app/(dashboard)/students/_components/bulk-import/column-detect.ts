import { LICENSE_CATEGORIES, type LicenseCategory } from "@/lib/license-categories";

/** Our import target fields. Name + email are required; phone + category optional. */
export type ImportField = "name" | "email" | "phone" | "category";

export const IMPORT_FIELDS: ImportField[] = ["name", "email", "phone", "category"];

/**
 * Header synonyms used to pre-fill the column mapping. PT-PT first, with a few
 * common English fallbacks (schools sometimes keep English headers). Extend
 * these lists as real-world spreadsheets reveal new conventions.
 */
const SYNONYMS: Record<ImportField, string[]> = {
  name: ["nome", "name", "aluno", "nome completo", "nome do aluno", "formando"],
  email: ["email", "e-mail", "correio", "correio eletronico", "mail"],
  phone: [
    "telefone", "telemovel", "contacto", "contato", "phone", "tel",
    "numero", "nr", "movel", "telem",
  ],
  category: ["categoria", "category", "carta", "categoria de carta", "carta de conducao"],
};

/** Lowercase, strip accents and surrounding whitespace for tolerant matching. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Guess which spreadsheet column maps to each of our fields. Prefers an exact
 * (normalized) header match; falls back to a substring match. Each column is
 * claimed by at most one field, so two fields never point at the same column.
 */
export function autoDetectColumns(
  headers: string[],
): Record<ImportField, string | null> {
  const result: Record<ImportField, string | null> = {
    name: null,
    email: null,
    phone: null,
    category: null,
  };
  const used = new Set<string>();

  const pick = (field: ImportField, predicate: (h: string) => boolean) => {
    if (result[field]) return;
    const match = headers.find((h) => !used.has(h) && predicate(h));
    if (match) {
      result[field] = match;
      used.add(match);
    }
  };

  // First pass: exact normalized equality (highest confidence).
  for (const field of IMPORT_FIELDS) {
    const syns = SYNONYMS[field].map(normalize);
    pick(field, (h) => syns.includes(normalize(h)));
  }
  // Second pass: substring match for headers like "Telemóvel do aluno".
  for (const field of IMPORT_FIELDS) {
    const syns = SYNONYMS[field].map(normalize);
    pick(field, (h) => {
      const n = normalize(h);
      return syns.some((s) => n.includes(s));
    });
  }

  return result;
}

/**
 * Coerce a raw spreadsheet cell into a license category, or null if it doesn't
 * match. Tolerates lowercase and surrounding labels: "b", "Categoria B",
 * "Carta B" all resolve to "B". Tokenizes on non-alphanumerics and returns the
 * first token that is a known category (checked longest-first so "C1E" wins
 * over "C").
 */
export function parseCategory(raw: string | undefined): LicenseCategory | null {
  if (!raw) return null;
  const tokens = raw.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const known = [...LICENSE_CATEGORIES].sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    const hit = known.find((c) => c === token);
    if (hit) return hit;
  }
  return null;
}
