/**
 * no-out-of-scope — soft.
 * Rete contro il classico lapsus "l'agente/o l'umano è andato oltre la issue":
 * una PR che implementa una singola issue non dovrebbe toccare CI/CD, config di
 * build, lockfile della toolchain o segreti. Quelli sono cambiamenti che
 * appartengono a PR separate e vanno reviewati diversamente.
 *
 * Proxy pragmatico: non conosciamo il brief della issue a tempo di review (vive
 * in app/DB), quindi usiamo un'**allowlist di percorsi protetti**. Una PR che li
 * tocca viene segnalata soft: l'autore conferma che è intenzionale.
 *
 * Permette (non segnala):
 *   - modifiche a `tools/review/**` (questo tool è cross-cutting per natura),
 *   - modifiche a `docs/**` (documentazione, spesso cross-issue),
 *   - PR il cui branch indica esplicitamente il tipo cross-cutting:
 *     `chore/`, `ci/`, `db/`, `release/`, `refactor/lint` (l'autore ha già
 *     dichiarato l'intento nel branch).
 *
 * Escape hatch manuale: nessuno (se serve, si usa un branch `chore/...` o si
 * accetta il warning soft).
 */
import type { Rule } from "../types.js";

// Percorsi "protetti": toccarli in una PR di feature è sospetto.
const PROTECTED_RE =
  /^(\.github\/workflows\/|vercel\.json$|next\.config\.|tsconfig\.json$|eslint\.config\.|drizzle\.config\.|postcss\.config\.|vitest\.config\.|components\.json$|\.env|package\.json$|package-lock\.json$|\.nvmrc$|\.node-version$)/;

// Branch che dichiarano già intento cross-cutting → niente warning.
const CROSS_CUTTING_BRANCH_RE = /^(chore|ci|db|release|refactor\/lint|build)\//;

// Percorsi esclusi dal gate: il tool stesso e la documentazione.
const ALLOWED_PATH_RE = /^(tools\/review\/|docs\/)/;

export const noOutOfScope: Rule = {
  id: "no-out-of-scope",
  defaultSeverity: "soft",
  run({ files, git }) {
    // Se il branch dichiara già intento cross-cutting, la PR è presumibilmente
    // consapevole di toccare CI/config: niente warning.
    if (CROSS_CUTTING_BRANCH_RE.test(git.branch)) return [];

    const hits = new Set<string>();
    for (const f of files) {
      if (f.status === "deleted") continue;
      if (ALLOWED_PATH_RE.test(f.path)) continue;
      if (PROTECTED_RE.test(f.path)) hits.add(f.path);
    }
    if (hits.size === 0) return [];

    const list = [...hits].sort().slice(0, 10).map((p) => `  • ${p}`).join("\n");
    return [
      {
        rule: this.id,
        severity: "soft" as const,
        file: [...hits].sort()[0],
        line: null,
        code: "protected-path-touched",
        message:
          `La PR tocca file protetti (CI/config/build/lockfile), tipicamente fuori scope di una singola issue:\n${list}\n` +
          `Se è intenzionale, va bene; altrimenti separa questi cambiamenti in una PR dedicata (branch \`chore/\`, \`ci/\`, \`db/\`...).`,
      },
    ];
  },
};
