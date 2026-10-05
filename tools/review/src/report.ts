/**
 * Report: output plain testuale dello scorer. Niente colori (convenzione del
 * repo: niente chalk/picocolors). Usa emoji letterali come gli altri script.
 *
 * Output layout:
 *   === Review: base..head (N file) ===
 *
 *   --- HARD (M) ---
 *   path:line  rule  message
 *
 *   --- SOFT (M) ---
 *   ...
 *
 *   --- ADVISORY (M) ---
 *   ...
 *
 *   Riepilogo: N hard, M soft, K advisory → ✅ OK | ✗ BLOCCATO
 */
import type { Finding, Severity } from "./types.js";
import type { EngineDiagnostics } from "./engine.js";
import type { LlmResult } from "./llm.js";

const ORDER: Severity[] = ["hard", "soft", "advisory"];
const GLYPH: Record<Severity, string> = { hard: "✗", soft: "⚠", advisory: "ℹ" };

function loc(f: Finding): string {
  if (f.line == null) return f.file || "(git)";
  return f.file ? `${f.file}:${f.line}` : `(git)`;
}

/** Raggruppa findings per severity preservando l'ordine di esecuzione. */
function group(findings: Finding[]): Record<Severity, Finding[]> {
  const g: Record<Severity, Finding[]> = { hard: [], soft: [], advisory: [] };
  for (const f of findings) g[f.severity].push(f);
  return g;
}

export interface ReportInput {
  base: string;
  head: string;
  fileCount: number;
  findings: Finding[];
  diagnostics: EngineDiagnostics;
  /** Risultato opzionale del layer LLM (S4). */
  llm?: LlmResult;
}

/** Ritorna true se ci sono hard violations (→ exit 1). */
export function hasHard(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === "hard");
}

/** Stampa il report su console.log. */
export function printReport(input: ReportInput): void {
  const { base, head, fileCount, findings, diagnostics, llm } = input;
  const g = group(findings);

  console.log(`\n=== Review: ${base}..${head} (${fileCount} file) ===`);

  for (const sev of ORDER) {
    const arr = g[sev];
    if (arr.length === 0) continue;
    const label = sev.toUpperCase();
    console.log(`\n--- ${label} (${arr.length}) ---`);
    for (const f of arr) {
      console.log(`${GLYPH[f.severity]} ${loc(f).padEnd(48)} ${f.rule}:${f.code}`);
      console.log(`    ${f.message}`);
    }
  }

  if (findings.length === 0) {
    console.log("\n✅ Nessuna violazione. Diff pulito rispetto al contratto.");
  }

  // Diagnostica contratto↔registry.
  const diag: string[] = [];
  for (const id of diagnostics.declaredWithoutImpl) {
    diag.push(`⚠ rule dichiarata nel contratto ma senza implementazione: ${id}`);
  }
  for (const id of diagnostics.implWithoutDeclared) {
    diag.push(`ℹ rule implementata ma non nel contratto (silente): ${id}`);
  }
  if (diag.length) {
    console.log("\n--- Diagnostica ---");
    for (const d of diag) console.log(d);
  }

  // Layer LLM opzionale (S4): advisory puro, non influenza il verdetto.
  if (llm) {
    console.log("\n--- LLM review (advisory) ---");
    if (llm.skipped) {
      console.log(`ℹ ${llm.note ?? "skippato"}`);
    } else {
      const score = llm.riskScore == null ? "n/d" : `${llm.riskScore}/10`;
      console.log(`Risk score: ${score}`);
      if (llm.summary) console.log(`Sintesi: ${llm.summary}`);
      for (const f of llm.findings) {
        console.log(`${GLYPH[f.severity]} ${loc(f).padEnd(48)} ${f.rule}:llm`);
        console.log(`    ${f.message}`);
      }
      console.log("ℹ L'LLM è advisory: non influenza il verdetto (mai hard).");
    }
  }

  // Riepilogo + verdetto.
  const counts = `hard: ${g.hard.length}, soft: ${g.soft.length}, advisory: ${g.advisory.length}`;
  const verdict = hasHard(findings) ? "✗ BLOCCATO (hard violations presenti)" : "✅ OK";
  console.log(`\nRiepilogo: ${counts} → ${verdict}`);
}
