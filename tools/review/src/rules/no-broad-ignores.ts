/**
 * no-broad-ignores — soft, scope src/**.
 * Cerca "type escape" nel diff: @ts-ignore, @ts-nocheck, @ts-expect-error (senza
 // contesto), `as any`, `: any`. In src/ oggi ce ne sono 0 reali (verificato:
 // i 4 hit su "any" sono tutti commenti JSDoc con la parola inglese "any").
 //
 // Questa rule li prende sul diff, dove il signal-to-noise è alto. Per ridurre
 // i falsi positivi su `: any`/`as any`:
 //   - ignora le righe che iniziano con `//` o `*` (commenti JSDoc)
 //   - richiede `any` come token di tipo (non parola in stringa)
 */
import type { Rule } from "../types.js";
import { isGenerated } from "../util.js";

const TS_IGNORE_RE = /\/\/\s*@ts-(?:ignore|nocheck|expect-error)/;
// `as any` o `<any>` come cast, o `: any` come annotazione. Evita la parola
// "any" dentro stringhe/commenti richiedendo un contesto di tipo.
const ANY_TYPE_RE = /\bas\s+any\b|:\s*any\b|<any>|!:\s*any\b/;

export const noBroadIgnores: Rule = {
  id: "no-broad-ignores",
  defaultSeverity: "soft",
  run({ files }) {
    const findings = [];
    for (const f of files) {
      if (!f.path.startsWith("src/")) continue;
      if (isGenerated(f.path)) continue;
      for (const { text, newNo } of f.added) {
        const stripped = text.trim();
        // Salta righe di commento (// o * JSDoc) — i falsi positivi noti stanno lì.
        if (stripped.startsWith("//") || stripped.startsWith("*")) continue;

        if (TS_IGNORE_RE.test(text)) {
          findings.push({
            rule: this.id,
            severity: "soft" as const,
            file: f.path,
            line: newNo,
            code: "ts-ignore",
            message:
              "Nuovo @ts-ignore/@ts-nocheck/@ts-expect-error. Preferisci correggere il tipo " +
              "o, se inevitabile, documenta con // WHY.",
          });
        }
        if (ANY_TYPE_RE.test(text)) {
          findings.push({
            rule: this.id,
            severity: "soft" as const,
            file: f.path,
            line: newNo,
            code: "any",
            message: "Nuovo `any`/`as any`/`: any`. Preferisci un tipo concreto (unknown, generici, zod).",
          });
        }
      }
    }
    return findings;
  },
};
