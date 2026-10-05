/**
 * Registry delle rule: mappa id → implementazione.
 *
 * Aggiungere una rule:
 * 1. Crea src/rules/<id>.ts che esporta un `Rule`.
 * 2. Importalo qui e aggiungilo all'array RULES.
 * 3. Aggiungi la sezione `## <id>  [severity]  [scope: ...]` a
 *    review-contract.md (sennà il contract validator se ne accorge).
 *
 * L'engine esegue solo le rule il cui id compare nel contratto caricato: così
 * il contratto è anche un "on/off" per progetto.
 */
import type { Rule } from "../types.js";
import { noSecrets } from "./no-secrets.js";
import { noJunkFiles } from "./no-junk-files.js";
import { noNewEslintDisable } from "./no-new-eslint-disable.js";
import { diffHygiene } from "./diff-hygiene.js";
import { noDebugResidue } from "./no-debug-residue.js";
import { noBroadIgnores } from "./no-broad-ignores.js";
import { commitMsg } from "./commit-msg.js";
import { branchNaming } from "./branch-naming.js";
import { migrationsAdditive } from "./migrations-additive.js";
import { noOutOfScope } from "./no-out-of-scope.js";

export const RULES: Rule[] = [
  noSecrets,
  noJunkFiles,
  noNewEslintDisable,
  diffHygiene,
  noDebugResidue,
  noBroadIgnores,
  migrationsAdditive,
  noOutOfScope,
  commitMsg,
  branchNaming,
];

/** Trova una rule per id. */
export function findRule(id: string): Rule | undefined {
  return RULES.find((r) => r.id === id);
}
