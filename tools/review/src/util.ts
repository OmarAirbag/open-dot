/**
 * Utilità condivise delle rule.
 */

const GENERATED_RE = /(\.generated\.|\.gen\.)/;

/** True se il path è un artefatto generato (da non valutare come "codice scritto"). */
export function isGenerated(path: string): boolean {
  return GENERATED_RE.test(path);
}
