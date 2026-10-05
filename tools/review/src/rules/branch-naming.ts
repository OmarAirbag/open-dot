/**
 * branch-naming — advisory.
 * Prefissi reali (verificato da git branch -a): feature/, feat/, fix/, db/,
 * chore/, docs/, perf/, ci/, agent/(epic|story|sub/)?AH-NN, claude/, + develop/main.
 * Documentato: feature/AH-NN-slug (docs/processo-requisiti-issue-documenti.md:95).
 *
 * Advisory perché la storia mostra feat/ e feature/ coesistenti e la cosa non
 * ha mai causato problemi; segnaliamo solo ciò che è chiaramente fuori.
 */
import type { Rule } from "../types.js";

const HUMAN_PREFIX_RE = /^(feature|feat|fix|hotfix|release|db|chore|docs|perf|ci|refactor|style|test)\//;
const AGENT_BRANCH_RE = /^agent\/(epic\/|story\/|sub\/)?[A-Z][A-Z0-9]{1,9}-\d{1,6}$/;
const CLAUDE_BRANCH_RE = /^claude\//;
const INTEGRATION_RE = /^(develop|main|master|dev)$/;

export const branchNaming: Rule = {
  id: "branch-naming",
  defaultSeverity: "advisory",
  run({ git }) {
    const branch = git.branch.trim();
    if (!branch) return []; // detached HEAD in CI: niente da controllare.
    if (INTEGRATION_RE.test(branch)) return [];
    if (HUMAN_PREFIX_RE.test(branch)) return [];
    if (AGENT_BRANCH_RE.test(branch)) return [];
    if (CLAUDE_BRANCH_RE.test(branch)) return [];

    return [
      {
        rule: this.id,
        severity: "advisory" as const,
        file: "",
        line: null,
        code: "unexpected-prefix",
        message:
          `Branch "${branch}" non segue i prefissi attesi ` +
          `(feature/|fix/|db/|chore/|…, oppure agent/AH-NN per gli agenti). ` +
          `Convenzione: feature/AH-NN-slug. (Advisory.)`,
      },
    ];
  },
};
