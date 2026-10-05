/**
 * prompt: subcommand che estrae il contratto in un blocco markdown pronto da
 * iniettare nel system-prompt del coding-agent. Chiude il loop: le stesse
 * regole che il reviewer controlla diventano le istruzioni che l'agente segue.
 *
 * Output (stdout), pensato per essere concatenato o redirectato:
 *
 *   ## Regole di qualità (obbligatorie)
 *
 *   ### no-secrets [hard]
 *   <descrizione dal contratto>
 *
 *   ### ...
 *
 * L'integrazione nei 2 prompt esistenti (run.mjs:59, cma-agent-spec.ts:14) è
 * step S2, fuori POC: qui generiamo solo il testo.
 */
import type { ContractRule, Severity } from "./types.js";

const SEV_LABEL: Record<Severity, string> = {
  hard: "HARD — violazione blocca il merge",
  soft: "SOFT — violazione va sistemata ma non blocca",
  advisory: "ADVISORY — segnato, da considerare",
};

function ruleSection(c: ContractRule): string {
  const scope = c.scope ? `  scope: ${c.scope}` : "";
  const lines = [
    `### ${c.id} [${SEV_LABEL[c.severity]}]${scope}`,
    "",
    c.description,
    "",
  ];
  return lines.join("\n");
}

/** Genera il blocco markdown con tutte le rule del contratto. */
export function generatePromptBlock(contract: ContractRule[]): string {
  const parts = [
    "## Regole di qualità (obbligatorie)",
    "",
    "Queste regole derivano da `review-contract.md` e sono le stesse che il",
    "reviewer automatico (`npm run review:diff`) controllerà sulla PR. Seguile",
    "per passare la review al primo colpo.",
    "",
  ];
  for (const c of contract) parts.push(ruleSection(c));
  return parts.join("\n");
}
