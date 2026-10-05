/**
 * Engine: esegue le rule sul diff applicando il contratto.
 *
 * Responsabilità:
 * - Per ogni ContractRule, trovare l'implementazione nel registry.
 * - Applicare lo scope (glob) del contratto ai file prima di passare alla rule.
 * - Riscrivere la severity di ogni finding con quella del contratto (override).
 *   Così il contratto può promuovere una rule di default `soft` a `hard` senza
 *   toccare il codice.
 * - Rilevare rule dichiarate nel contratto ma senza implementazione (warning)
 *   e rule implementate ma non dichiarate (warning) — utile in CI.
 */
import type { ContractRule, FileDiff, Finding, RuleContext, Severity } from "./types.js";
import { findRule } from "./rules/index.js";

export interface EngineDiagnostics {
  /** Id di rule dichiarate nel contratto ma senza implementazione. */
  declaredWithoutImpl: string[];
  /** Id di rule implementate ma non dichiarate nel contratto (silenti). */
  implWithoutDeclared: string[];
}

export interface EngineResult {
  findings: Finding[];
  diagnostics: EngineDiagnostics;
}

/** Match minimale di un glob `**`/`*` su un path. Bastano i nostri casi. */
function matchGlob(glob: string, path: string): boolean {
  // Normalizza: `src/**` → inizia con `src/`; `**/*.ts` → finisce con `.ts`.
  // Convertiamo in regex in modo semplice. Supporta `*` (singolo livello) e
  // `**` (multi-livello).
  let pattern = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\x00") // placeholder temporaneo
    .replace(/\*/g, "[^/]*")
    .replace(/\x00/g, ".*");
  if (!pattern.endsWith("$")) pattern += "$";
  if (!pattern.startsWith("^")) pattern = "^" + pattern;
  return new RegExp(pattern).test(path);
}

/** Filtra i file secondo lo scope del contratto (null = tutti). */
function scopeFiles(files: FileDiff[], scope: string | null): FileDiff[] {
  if (!scope) return files;
  return files.filter((f) => matchGlob(scope, f.path));
}

/**
 * Esegue tutte le rule dichiarate nel contratto.
 * `ctx` contiene già file e git context completi; lo scope viene applicato
 * per-rule dentro il loop.
 */
export function runRules(
  contract: ContractRule[],
  ctx: RuleContext,
  allImplIds: string[] = [],
): EngineResult {
  const findings: Finding[] = [];
  const declaredWithoutImpl: string[] = [];

  for (const c of contract) {
    const impl = findRule(c.id);
    if (!impl) {
      declaredWithoutImpl.push(c.id);
      continue;
    }
    // Applica lo scope: la rule vede solo i file nel suo scope.
    const scopedCtx: RuleContext = {
      files: scopeFiles(ctx.files, c.scope),
      git: ctx.git,
    };
    const raw = impl.run(scopedCtx);
    // Override della severity con quella del contratto.
    for (const f of raw) {
      findings.push({ ...f, severity: overrideSeverity(f.severity, c.severity) });
    }
  }

  // Diagnostica: implementazioni non dichiarate (silenti).
  const declaredIds = new Set(contract.map((c) => c.id));
  const implWithoutDeclared = (allImplIds.length ? allImplIds : []).filter(
    (id) => !declaredIds.has(id),
  );

  return { findings, diagnostics: { declaredWithoutImpl, implWithoutDeclared } };
}

/**
 * Override severity: il contratto vince, ma una rule hard può essere degradata
 * a soft/advisory (utile per spegnere temporaneamente); una soft può salire a
 * hard. Non permettiamo di promuovere advisory a hard senza modificare il
 * contratto (decisione esplicita).
 */
function overrideSeverity(ruleSev: Severity, contractSev: Severity): Severity {
  // Contratto è autoritativo: usa sempre la severity dichiarata.
  return contractSev;
}
