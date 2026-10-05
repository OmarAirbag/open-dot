/**
 * Parser del review-contract.md — la sorgente unica.
 *
 * Formato delle sezioni (vedi review-contract.md):
 *
 *   ## <rule-id>  [hard|soft|advisory]  [scope: <glob>]
 *   <corpo descrittivo libero, una o più righe, fino alla prossima ##>
 *
 * Esempio:
 *   ## no-secrets  [hard]
 *   Nessun segreto nel diff: ...
 *
 *   ## no-debug-residue  [soft]  scope: src/**
 *   Nessun console.* nuovo in src/ ...
 *
 * Il parser è volutamente tollerante: severity e scope sono opzionali e in
 * ordine libero. Spazi multipli OK. Se la severity manca, la rule usa la sua
 * defaultSeverity (definita nel codice della rule).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ContractRule, Severity } from "./types.js";

const VALID_SEVERITIES: Severity[] = ["hard", "soft", "advisory"];

export class ContractParseError extends Error {}

interface RawSection {
  id: string;
  headerRaw: string;
  body: string;
  line: number;
}

/** Trova il path del review-contract.md rispetto a questo modulo. */
export function defaultContractPath(): string {
  // Da src/contract.ts → sale due livelli per tools/review/review-contract.md.
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "review-contract.md");
}

/** Legge e splitta il markdown in sezioni `##`. */
function splitSections(markdown: string): RawSection[] {
  const lines = markdown.split("\n");
  const sections: RawSection[] = [];
  let current: RawSection | null = null;
  let lineNo = 0;

  for (const line of lines) {
    lineNo++;
    // match "## id  [sev]  [scope: ...]" — esattamente due # e uno spazio.
    const m = /^##\s+(\S+)(.*)$/.exec(line);
    if (m) {
      if (current) sections.push(current);
      current = { id: m[1], headerRaw: m[2] ?? "", body: "", line: lineNo };
      continue;
    }
    if (current) current.body += line + "\n";
  }
  if (current) sections.push(current);
  return sections;
}

/** Estrae severity e scope dal resto dell'header (dopo l'id). */
function parseHeader(
  rest: string,
  sectionLine: number,
  id: string,
): { severity: Severity | null; scope: string | null } {
  let severity: Severity | null = null;
  let scope: string | null = null;

  // Token fra parentesi quadre: [hard], [soft], [advisory], [scope: src/**]
  const bracketTokens = [...rest.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
  for (const tok of bracketTokens) {
    const lower = tok.toLowerCase();
    if (VALID_SEVERITIES.includes(lower as Severity)) {
      if (severity) {
        throw new ContractParseError(
          `riga ${sectionLine}: severity dichiarata due volte per la rule "${id}".`,
        );
      }
      severity = lower as Severity;
      continue;
    }
    const scopeMatch = /^scope:\s*(.+)$/i.exec(tok);
    if (scopeMatch) {
      if (scope) {
        throw new ContractParseError(
          `riga ${sectionLine}: scope dichiarato due volte per la rule "${id}".`,
        );
      }
      scope = scopeMatch[1].trim();
      continue;
    }
    throw new ContractParseError(
      `riga ${sectionLine}: token "[${tok}]" non riconosciuto per la rule "${id}". ` +
        `Previsto [hard|soft|advisory] o [scope: glob].`,
    );
  }

  // Testo fuori dalle parentesi quadre = quasi certamente un errore di sintassi
  // (es. `scope: src/**` senza brackets, che prima veniva ignorato in silenzio
  // lasciando la rule senza scope). Meglio fallire forte che ignorare.
  const leftover = rest.replace(/\[[^\]]+\]/g, "").trim();
  if (leftover) {
    throw new ContractParseError(
      `riga ${sectionLine}: testo non riconosciuto nell'header della rule "${id}": "${leftover}". ` +
        `Severity e scope vanno tra parentesi quadre: [hard|soft|advisory] [scope: glob].`,
    );
  }
  return { severity, scope };
}

/** Parsa l'intero contratto in ContractRule[]. Lancia su sintassi invalida. */
export function parseContract(markdown: string): ContractRule[] {
  const sections = splitSections(markdown);
  const rules: ContractRule[] = [];
  const seen = new Set<string>();

  for (const s of sections) {
    if (seen.has(s.id)) {
      throw new ContractParseError(
        `riga ${s.line}: rule "${s.id}" dichiarata due volte nel contratto.`,
      );
    }
    seen.add(s.id);
    const { severity, scope } = parseHeader(s.headerRaw, s.line, s.id);
    // Severity obbligatoria nel contratto: niente default silente, esplicitiamo.
    if (!severity) {
      throw new ContractParseError(
        `riga ${s.line}: severity mancante per la rule "${s.id}". ` +
          `Usa [hard], [soft] o [advisory].`,
      );
    }
    rules.push({
      id: s.id,
      severity,
      scope,
      description: s.body.trim(),
    });
  }
  return rules;
}

/** Legge il contratto dal path (default: review-contract.md accanto al tool). */
export function loadContract(path?: string): ContractRule[] {
  const file = path ?? defaultContractPath();
  const markdown = readFileSync(file, "utf8");
  return parseContract(markdown);
}
