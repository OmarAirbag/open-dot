/**
 * migrations-additive — hard.
 * Enforcement automatica della disciplina di branching/DB di AGENTS.md: le
 * migration drizzle devono essere additive (ADD COLUMN/TABLE/INDEX), mai
 * DROP/RENAME su ciò che è ancora usato. La preview di develop punta allo stesso
 * DB di prod, quindi una migration distruttiva ferma su develop provoca
 * "column does not exist" su dati reali.
 *
 * Modello corretto (expand/contract a due tempi):
 *   1. prima togli l'uso dal codice su main,
 *   2. poi droppi la colonna in una release successiva.
 *
 * La rule guarda le NUOVE righe SQL nei file `drizzle/*.sql` del diff (nuovi
 * statement introdotti dalla PR) e segnala:
 *   - DROP TABLE / DROP COLUMN / DROP INDEX / DROP CONSTRAINT
 *   - RENAME TABLE / RENAME COLUMN (rename ≠ additive)
 *
 * Permette invece tutto ciò che è additivo (ADD COLUMN, CREATE TABLE, CREATE
 * INDEX, ALTER ... ADD ...). Le migration storiche con DROP (0003, 0054) sono
 * già committed e NON nel diff: la rule non le tocca.
 *
 * Escape hatch: uno statement DROP preceduto da commento `-- contract: drop
 * allowed <motivo>` viene lasciato passare (esplicito, documentato nel SQL).
 */
import type { Rule } from "../types.js";

const DROP_RE =
  /\b(DROP\s+(?:TABLE|COLUMN|INDEX|CONSTRAINT|SCHEMA|VIEW)|RENAME\s+(?:TABLE|COLUMN|TO)\b)/i;
// Commento di escape: `-- contract: drop allowed <motivo>`. Cerchiamo nelle
// righe precedenti dello stesso statement (semplificazione: 2 righe sopra).
const DROP_ALLOW_RE = /--\s*contract:\s*drop\s+allowed\b/i;

export const migrationsAdditive: Rule = {
  id: "migrations-additive",
  defaultSeverity: "hard",
  run({ files }) {
    const findings = [];
    for (const f of files) {
      // Solo le migration drizzle (SQL). Altri .sql (es. seed) non contano.
      if (!f.path.startsWith("drizzle/") || !f.path.endsWith(".sql")) continue;

      for (let i = 0; i < f.added.length; i++) {
        const { text, newNo } = f.added[i];
        if (!DROP_RE.test(text)) continue;

        // Cerca l'escape hatch nelle righe aggiunte precedenti (finestra di 3).
        const window = f.added.slice(Math.max(0, i - 3), i + 1);
        if (window.some((l) => DROP_ALLOW_RE.test(l.text))) continue;

        findings.push({
          rule: this.id,
          severity: "hard" as const,
          file: f.path,
          line: newNo,
          code: "destructive-migration",
          message:
            "Migration non additiva: DROP/RENAME rilevato. La preview di develop scrive sul DB di prod: " +
            "usa expand/contract (AGENTS.md §branching-db-rules). Se il drop è davvero intenzionale e sicuro, " +
            "antponi un commento `-- contract: drop allowed <motivo>` per silenziare questa rule.",
        });
      }
    }
    return findings;
  },
};
