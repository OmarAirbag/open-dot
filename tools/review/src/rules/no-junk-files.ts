/**
 * no-junk-files — hard.
 * Blocca file di scarto che non sono in .gitignore (verificato: .bak/.orig/.tmp/
 * .swp/.old NON sono ignorati; lo sono solo .DS_Store e build output).
 *
 * Questi file arrivano spesso da tool che l'agente o l'umano hanno lasciato in
 * giro. L'aggiunta al repo è sempre non intenzionale → gate hard.
 */
import type { Rule } from "../types.js";

// Estensioni di file di scarto. .DS_Store è già in .gitignore ma lo teniamo
// per robustezza (in caso di .gitignore modificato/rimosso).
const JUNK_EXT_RE = /\.(bak|orig|tmp|swp|old|rej)$/i;

// Nomi di file di scarto noti.
const JUNK_NAMES_RE = /(^|\/)(\.DS_Store|Thumbs\.db)$|(^|\/)style-export-.*\.tar\.gz$/i;

export const noJunkFiles: Rule = {
  id: "no-junk-files",
  defaultSeverity: "hard",
  run({ files }) {
    const findings = [];
    for (const f of files) {
      // Un file junk è tale qualunque sia lo status (added/modified/renamed):
      // git classifica i file vuoti/binari come "modified" con 0 righe, quindi
      // filtrare per status === "added" li farebbe passare. Escludiamo solo i
      // deleted (un junk che viene rimosso è una buona cosa).
      if (f.status === "deleted") continue;
      if (JUNK_EXT_RE.test(f.path) || JUNK_NAMES_RE.test(f.path)) {
        findings.push({
          rule: this.id,
          severity: "hard" as const,
          file: f.path,
          line: null,
          code: "junk-file",
          message: `File di scarto nel repo: "${f.path}". Rimuovilo (non va committato).`,
        });
      }
    }
    return findings;
  },
};
