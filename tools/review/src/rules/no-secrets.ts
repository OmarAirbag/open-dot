/**
 * no-secrets — hard.
 * Cerca segreti nel diff: chiavi API-like e file .env* committati.
 *
 * Pattern coperti: AWS (AKIA...), OpenAI/sk-, GitHub (ghp_/gho_/ghu_/ghs_/ghr_),
 * Slack (xoxb-/xoxp-), private key PEM, JWT (3 parti base64 separate da punto),
 * e l'aggiunta di file .env* (escluso .env.example, che è template intenzionale).
 */
import type { Rule } from "../types.js";

const PATTERNS: { code: string; re: RegExp; label: string }[] = [
  { code: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/, label: "AWS Access Key ID" },
  { code: "openai-key", re: /\bsk-[A-Za-z0-9]{20,}\b/, label: "chiave OpenAI-like (sk-...)" },
  { code: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, label: "GitHub token (ghp_/gho_/...)" },
  { code: "slack-token", re: /\bxox[bp]-[A-Za-z0-9-]{10,}\b/, label: "token Slack (xoxb-/xoxp-)" },
  { code: "private-key", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----/, label: "PEM private key" },
  { code: "jwt", re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/, label: "JWT (header.payload.signature)" },
];

// Path di file "segretosi": .env ma NON .env.example (template, legittimo).
const ENV_FILE_RE = /(^|\/)\.env(\.[a-z0-9_-]+)?$/i;
const ENV_EXAMPLE_RE = /(^|\/)\.env\.example$/i;

export const noSecrets: Rule = {
  id: "no-secrets",
  defaultSeverity: "hard",
  run({ files }) {
    const findings = [];
    for (const f of files) {
      // File .env* aggiunti (escluso .env.example).
      if (f.status === "added" && ENV_FILE_RE.test(f.path) && !ENV_EXAMPLE_RE.test(f.path)) {
        findings.push({
          rule: this.id,
          severity: "hard" as const,
          file: f.path,
          line: null,
          code: "env-file",
          message: `File di environment committato: "${f.path}". I segreti appartengono a .env.local (gitignored), non al repo.`,
        });
      }
      // Pattern nelle righe aggiunte.
      for (const { text, newNo } of f.added) {
        for (const p of PATTERNS) {
          if (p.re.test(text)) {
            findings.push({
              rule: this.id,
              severity: "hard" as const,
              file: f.path,
              line: newNo,
              code: p.code,
              message: `Possibile ${p.label} nel diff. Verifica: se è reale, ruotalo e non committarlo.`,
            });
          }
        }
      }
    }
    return findings;
  },
};
