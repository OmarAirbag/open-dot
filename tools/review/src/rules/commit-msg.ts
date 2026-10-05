/**
 * commit-msg — advisory.
 * Convenzione "Chiavi ovunque" (docs/processo-requisiti-issue-documenti.md:95):
 *   [AH-NN] …  + Conventional Commits.
 *
 * La storia reale è MISTA (verificato dall'analisi git log): 4 stili coesistono
 * — conventional puro, `AH-NN: …`, `[AH-NN] conventional`, e `KEY: implementazione
 * automatica (agente AI)`. Un gate strict Conventional-only reietterebbe >40%
 * dei commit legittimi. Quindi: advisory con 2 tier.
 *
 * - BUONO:   `[AH-NN] feat(scope): …`   (chiave + conventional, l'ideale)
 * - OK:      `feat(scope): …`            (conventional senza chiave)
 *            `AH-NN: …`                  (chiave senza conventional)
 *            `<KEY>: implementazione automatica (agente AI)`  (commit agente)
 *            `Merge …`, `MGP (DB): …`    (merge / migration, dialetti legittimi)
 * - WARN:    nessuna chiave, nessun tipo, messaggio vago.  → advisory (non fail)
 */
import type { Rule } from "../types.js";

const ISSUE_KEY_RE = /\b([A-Z][A-Z0-9]{1,9}-\d{1,6})\b/;
const CONVENTIONAL_RE = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?!?:\s+\S/;
const AGENT_COMMIT_RE = /^[A-Z][A-Z0-9]{1,9}-\d{1,6}:\s+implementazione automatica \(agente AI\)$/;
const MERGE_RE = /^Merge /;
const MIGRATION_RE = /^[A-Z]{2,} \(DB\):/i;
// Troppo corto o solo generico per essere utile.
const VAGUE_RE = /^(wip|fix|update|test|misc|stuff|TODO|tbd)\.?$/i;

export const commitMsg: Rule = {
  id: "commit-msg",
  defaultSeverity: "advisory",
  run({ git }) {
    const findings = [];
    for (const subject of git.commitSubjects) {
      if (MERGE_RE.test(subject)) continue;
      if (AGENT_COMMIT_RE.test(subject)) continue;
      if (MIGRATION_RE.test(subject)) continue;
      const hasKey = ISSUE_KEY_RE.test(subject);
      const isConventional = CONVENTIONAL_RE.test(subject);
      if (hasKey && isConventional) continue; // BUONO
      if (isConventional) continue; // OK (conventional senza chiave)
      if (hasKey) continue; // OK (chiave senza conventional)
      // Altrimenti: warn. Distingui "vago" da "solo non convenzionale".
      const vague = VAGUE_RE.test(subject.trim()) || subject.trim().length < 8;
      findings.push({
        rule: this.id,
        severity: "advisory" as const,
        file: "",
        line: null,
        code: vague ? "vague" : "non-conventional",
        message:
          `Commit senza chiave issue né formato conventional: "${subject}". ` +
          `Ideale: [AH-NN] feat(scope): descrizione. (Advisory — la storia è mista.)`,
      });
    }
    return findings;
  },
};
