/**
 * no-debug-residue — soft, scope src/**.
 * Cerca console.* e debugger NUOVI nel diff. In src/ eslint ha già
 * `no-console: error` (verificato: 0 violazioni esistenti), quindi questa rule
 * è una rete di backup sul diff + copre `debugger` (non autofissabile).
 *
 * Importante: in scripts/ il console è il canale CLI legittimo (26 file lo
 * usano). La rule è quindi scoped a src/**.
 */
import type { Rule } from "../types.js";
import { isGenerated } from "../util.js";

// console.<qualcosa>( — evita falsi positivi su "console" come parola.
const CONSOLE_RE = /\bconsole\.\w+\s*\(/;
// `debugger;` come statement: ammette whitespace e un commento inline dopo.
const DEBUGGER_RE = /^\s*debugger\s*;?.*$/;

export const noDebugResidue: Rule = {
  id: "no-debug-residue",
  defaultSeverity: "soft",
  run({ files }) {
    const findings = [];
    for (const f of files) {
      if (!f.path.startsWith("src/")) continue;
      if (isGenerated(f.path)) continue;
      for (const { text, newNo } of f.added) {
        if (DEBUGGER_RE.test(text)) {
          findings.push({
            rule: this.id,
            severity: "soft" as const,
            file: f.path,
            line: newNo,
            code: "debugger",
            message: "Statement `debugger` lasciato nel codice. Rimuovilo prima del commit.",
          });
        }
        if (CONSOLE_RE.test(text)) {
          findings.push({
            rule: this.id,
            severity: "soft" as const,
            file: f.path,
            line: newNo,
            code: "console",
            message:
              "Nuova chiamata console.* in src/. Usa il logger (src/lib/log.ts). " +
              "(eslint ha no-console: error, questa è rete di backup sul diff.)",
          });
        }
      }
    }
    return findings;
  },
};
