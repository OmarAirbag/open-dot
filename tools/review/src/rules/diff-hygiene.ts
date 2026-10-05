/**
 * diff-hygiene — soft.
 * Pattern invisibili che nessun tool controlla oggi (verificato: nessun
 * formatter configurato, niente prettier/biome):
 *   - trailing whitespace ([ \t]+$)
 *   - marker di conflitto non risolti (<<<<<<< / ======= / >>>>>>>)
 *   - CRLF su file non binari (\r)
 */
import type { Rule } from "../types.js";

const TRAILING_WS_RE = /[ \t]+$/;
const CONFLICT_MARKER_RE = /^(<{7}|={7}|>{7})( |$)/;

export const diffHygiene: Rule = {
  id: "diff-hygiene",
  defaultSeverity: "soft",
  run({ files }) {
    const findings = [];
    for (const f of files) {
      // Saltiamo i binari (non hanno .added significativo) e i lockfile (CRLF
      // di servizio). Limite pragmatico: solo file di testo comuni.
      if (/\.(lock|png|jpg|jpeg|gif|webp|ico|pdf|zip|gz|woff2?)$/i.test(f.path)) continue;

      for (const { text, newNo } of f.added) {
        if (CONFLICT_MARKER_RE.test(text)) {
          findings.push({
            rule: this.id,
            severity: "soft" as const,
            file: f.path,
            line: newNo,
            code: "conflict-marker",
            message: "Marker di conflitto non risolto nel diff. Risolvi il merge.",
          });
        }
        if (text.includes("\r")) {
          findings.push({
            rule: this.id,
            severity: "soft" as const,
            file: f.path,
            line: newNo,
            code: "crlf",
            message: "Riga con CRLF (\\r). Il repo usa LF: configura git autocrlf o l'editor.",
          });
        }
        if (TRAILING_WS_RE.test(text) && text.trim().length > 0) {
          findings.push({
            rule: this.id,
            severity: "soft" as const,
            file: f.path,
            line: newNo,
            code: "trailing-ws",
            message: "Whitespace finale sulla riga. Rimuovila.",
          });
        }
      }
    }
    return findings;
  },
};
