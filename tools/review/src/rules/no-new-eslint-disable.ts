/**
 * no-new-eslint-disable — soft.
 * Rete su uno dei gap più significativi (verificato): esistono 20
 * `eslint-disable` in src/, tutti silenti, di cui 15 su react-hooks rules che
 * mascherano bug reali (exhaustive-deps, set-state-in-effect). eslint non li
 * riprenderà mai per costruzione.
 *
 * Strategia: segnala ogni NUOVA riga `eslint-disable` nel diff, a meno che non
 * sia seguita da un commento `// WHY ...` (o inline a fine riga). Il WHY rende
 * la soppressione intenzionale e documentata.
 */
import type { Rule } from "../types.js";
import { isGenerated } from "../util.js";

const ESLINT_DISABLE_RE = /^\s*(\/\/|\/\*|<!--)\s*eslint-disable(?:-next-line|-line)?\b/;

export const noNewEslintDisable: Rule = {
  id: "no-new-eslint-disable",
  defaultSeverity: "soft",
  run({ files }) {
    const findings = [];
    for (const f of files) {
      if (!f.path.startsWith("src/")) continue;
      if (isGenerated(f.path)) continue;
      for (const { text, newNo } of f.added) {
        if (!ESLINT_DISABLE_RE.test(text)) continue;
        // Permessivo: accetta // WHY ... inline o sulla riga.
        if (/\bWHY\b/.test(text)) continue;
        findings.push({
          rule: this.id,
          severity: "soft" as const,
          file: f.path,
          line: newNo,
          code: "unjustified-disable",
          message:
            "Nuovo eslint-disable non giustificato. Aggiungi un commento `// WHY <ragione>` " +
            "per renderlo intenzionale. Attenzione a react-hooks/exhaustive-deps e set-state-in-effect.",
        });
      }
    }
    return findings;
  },
};
