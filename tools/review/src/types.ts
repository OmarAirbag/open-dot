/**
 * Tipi condivisi del reviewer. Una rule produce Finding[] a partire da un
 * FileDiff (o, per le rule su git metadata, dal GitContext).
 */

/** Severità di un finding. Determina l'exit code del CLI. */
export type Severity = "hard" | "soft" | "advisory";

/**
 * Una singola violazione riscontrata da una rule.
 *
 * - `rule`: id della rule (deve matchare una sezione del review-contract.md).
 * - `file`/`line`: posizione nel diff (line `null` = a livello di file).
 * - `code`: identificatore breve, es. "secret-pattern" per distinguere più
 *   cause interne alla stessa rule.
 * - `message`: testo mostrato all'utente, in italiano, con il "perché".
 */
export interface Finding {
  rule: string;
  severity: Severity;
  file: string;
  line: number | null;
  code: string;
  message: string;
}

/**
 * Una riga del diff con il suo numero nel file finale (dove ha senso).
 * `newNo` null per le righe rimosse o di contesto "puro".
 */
export interface DiffLine {
  kind: "add" | "del" | "ctx" | "hunk" | "meta";
  text: string;
  newNo: number | null;
  oldNo: number | null;
}

/** Un file come appare nel diff, già parsato in righe. */
export interface FileDiff {
  /** Path relativo alla radice del repo, come da `git diff --name-only`. */
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  /** Righe "add" con il relativo numero nel file nuovo. */
  added: { text: string; newNo: number }[];
  /** Righe "del" con il numero nel file vecchio. */
  removed: { text: string; oldNo: number }[];
  /** Raw hunks, per le rule che vogliono guardare anche contesto/meta. */
  hunks: DiffLine[][];
}

/**
 * Metadati git che alcune rule (commit-msg, branch-naming) consumano invece
 * del diff dei file.
 */
export interface GitContext {
  /** Subject dei commit nel range base..head. */
  commitSubjects: string[];
  /** Nome del branch HEAD. */
  branch: string;
}

/** Contesto completo passato a ogni rule. */
export interface RuleContext {
  files: FileDiff[];
  git: GitContext;
}

/**
 * Una rule registrata nel registry. Implementata come funzione pura:
 * date le aggiunte del diff (e il contesto), restituisce i finding.
 *
 * Le rule che operano su git metadata (commit/branch) ignorano `files` e
 * leggono `ctx.git`.
 */
export interface Rule {
  /** Id della rule: deve matchare una `## <id>` del review-contract.md. */
  id: string;
  /** Severità di default se il contratto non la_override. */
  defaultSeverity: Severity;
  /** Esegue il controllo. */
  run(ctx: RuleContext): Finding[];
}

/**
 * Rule lette dal review-contract.md. La severity può essere override-ata dal
 * contratto (es. una rule di default `soft` promossa a `hard` per questo repo).
 */
export interface ContractRule {
  id: string;
  severity: Severity;
  /** Scope glob opzionale (es. `src/**`). `null` = tutti i file. */
  scope: string | null;
  /** Corpo descrittivo del contratto (testo umano, mostrato nel prompt). */
  description: string;
}
