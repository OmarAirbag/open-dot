/**
 * Layer LLM opzionale (S4) — risk-score + report qualitativo advisory.
 *
 * Riusa le env vars del coding-agent runner (`MODEL_BASE_URL`, `MODEL_API_KEY`,
 * `MODEL_ID` in agent-runner.yml), con override `AIRBAG_REVIEW_*`. Off di
 * default: attivato da `--llm` o `AIRBAG_REVIEW_LLM=1`.
 *
 * Principi:
 * - **Advisory puro**: i finding LLM sono severity `advisory` a prescindere,
 *   non promuovono mai a hard e non influenzano l'exit code.
 * - **Tollerante**: se l'LLM è unreachable, il JSON è malformato o va in
 *   timeout, si logga un warning e si ritorna [] — la CI non cade mai per colpa
 *   dell'LLM. Il layer deterministico resta l'unica fonte di verità hard.
 * - **Boundato al contratto**: il prompt impone all'LLM di citare quale rule del
 *   contratto sta violando (id), niente opinioni free.
 * - **Costo/latenza**: si salta su diff piccoli (< MIN_LINES righe added) dove
 *   l'LLM non aggiunge valore rispetto alle rule deterministiche.
 *
 * Output atteso dal modello (response_format json_object):
 *   {
 *     "risk_score": 0-10,
 *     "summary": "string",
 *     "findings": [
 *       { "rule": "<contratto-id o 'llm-extra'>", "file": "...", "line": N|null,
 *         "severity": "advisory", "issue": "...", "suggestion": "..." }
 *     ]
 *   }
 */
import type { ContractRule, FileDiff, Finding } from "./types.js";
import { generatePromptBlock } from "./prompt.js";

/** Soglia minima righe added per giustificare una chiamata LLM. */
const MIN_LINES = 20;
/** Timeout hard della chiamata LLM (ms). */
const TIMEOUT_MS = 60_000;

export interface LlmOptions {
  enabled: boolean;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  /** Soglia righe per skippare (test). Default MIN_LINES. */
  minLines?: number;
}

export interface LlmResult {
  riskScore: number | null;
  summary: string;
  findings: Finding[];
  /** true se la chiamata è stata skippata (diff piccolo o env mancante). */
  skipped: boolean;
  /** Messaggio se skippato o fallito. */
  note?: string;
}

/** Risolve le opzioni leggendo env (override AIRBAG_REVIEW_* vince su MODEL_*). */
export function resolveLlmOptions(enabledViaFlag: boolean): LlmOptions {
  const enabled =
    enabledViaFlag ||
    process.env.AIRBAG_REVIEW_LLM === "1" ||
    process.env.AIRBAG_REVIEW_LLM === "true";

  const baseUrl =
    process.env.AIRBAG_REVIEW_MODEL_BASE_URL ?? process.env.MODEL_BASE_URL;
  const apiKey =
    process.env.AIRBAG_REVIEW_MODEL_API_KEY ?? process.env.MODEL_API_KEY;
  const model = process.env.AIRBAG_REVIEW_MODEL_ID ?? process.env.MODEL_ID;

  return { enabled, baseUrl, apiKey, model };
}

/** Costruisce il prompt utente: diff + contratto + istruzioni di output. */
function buildUserPrompt(
  files: FileDiff[],
  contract: ContractRule[],
  diffText: string,
): string {
  const contractBlock = generatePromptBlock(contract);
  return `Analizza il seguente git diff rispetto al contratto di qualità qui sotto.
Restituisci SOLO un oggetto JSON (response_format json_object), niente testo fuori dal JSON.

Schema:
{
  "risk_score": <intero 0-10>,           // 0=banale, 10=pericoloso per prod
  "summary": "<una riga, italiano>",
  "findings": [
    {
      "rule": "<id regola del contratto O "llm-extra">",
      "file": "<path>",
      "line": <numero riga o null>,
      "severity": "advisory",
      "issue": "<problema, italiano, con riferimento alla regola>",
      "suggestion": "<come sistemarlo>"
    }
  ]
}

Regole:
- "rule" DEVE essere un id presente nel contratto, oppure "llm-extra" per problemi
  non coperti dalle rule deterministiche.
- Segnala SOLO problemi rilevanti: niente false positive, niente stile soggettivo
  non coperto dal contratto.
- Se il diff è pulito e coerente con il contratto: risk_score basso, findings: [].
- Non inventare regole nuove: se un problema non è nel contratto, usa "llm-extra".
- "line" solo se identificabile con certezza dal diff; altrimenti null.

${contractBlock}

--- DIFF (git diff -U0) ---

${diffText}
`;
}

/** Rende il diff come testo unified minimale per l'LLM. */
function renderDiff(files: FileDiff[]): string {
  const parts: string[] = [];
  for (const f of files) {
    parts.push(`diff --git a/${f.path} b/${f.path} [${f.status}]`);
    for (const a of f.added) parts.push(`+${a.newNo}: ${a.text}`);
    for (const r of f.removed) parts.push(`-${r.oldNo}: ${r.text}`);
  }
  return parts.join("\n");
}

/** Chiamata al modello openai-compat. Lancia su errore di rete/HTTP. */
async function callModel(
  baseUrl: string,
  apiKey: string,
  model: string,
  userPrompt: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} dal modello: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("risposta senza choices[0].message.content");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Parse della risposta LLM in LlmResult. Tollerante su campi mancanti. */
function parseResponse(raw: string): LlmResult {
  let parsed: {
    risk_score?: unknown;
    summary?: unknown;
    findings?: unknown;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("risposta LLM non è JSON valido");
  }

  const riskScore =
    typeof parsed.risk_score === "number"
      ? Math.max(0, Math.min(10, Math.round(parsed.risk_score)))
      : null;
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";

  const rawFindings = Array.isArray(parsed.findings) ? parsed.findings : [];
  const findings: Finding[] = rawFindings
    .map((f): Finding | null => {
      // JSON non fidato: restringiamo a record prima di leggerne i campi.
      if (!f || typeof f !== "object") return null;
      const o = f as Record<string, unknown>;
      return {
        rule: typeof o.rule === "string" ? o.rule : "llm-extra",
        severity: "advisory",
        file: typeof o.file === "string" ? o.file : "",
        line: typeof o.line === "number" ? o.line : null,
        code: "llm",
        message: [
          typeof o.issue === "string" ? o.issue : "",
          typeof o.suggestion === "string" ? ` Suggerimento: ${o.suggestion}` : "",
        ].join("").trim() || "(segnalazione LLM senza dettagli)",
      };
    })
    .filter((f): f is Finding => f !== null);

  return { riskScore, summary, findings, skipped: false };
}

/**
 * Esegue la review LLM. Mai throw: errori → result.skipped con note.
 * Chiamare solo se `opts.enabled` (il caller decide).
 */
export async function reviewWithLlm(
  files: FileDiff[],
  contract: ContractRule[],
  opts: LlmOptions,
): Promise<LlmResult> {
  const minLines = opts.minLines ?? MIN_LINES;

  if (!opts.baseUrl || !opts.apiKey || !opts.model) {
    return {
      riskScore: null,
      summary: "",
      findings: [],
      skipped: true,
      note:
        "LLM skippato: env mancante (servono MODEL_BASE_URL, MODEL_API_KEY, MODEL_ID o gli override AIRBAG_REVIEW_*).",
    };
  }

  const addedLines = files.reduce((n, f) => n + f.added.length, 0);
  if (addedLines < minLines) {
    return {
      riskScore: null,
      summary: "",
      findings: [],
      skipped: true,
      note: `LLM skippato: diff piccolo (${addedLines} righe added < ${minLines}).`,
    };
  }

  const diffText = renderDiff(files);
  const userPrompt = buildUserPrompt(files, contract, diffText);

  try {
    const raw = await callModel(opts.baseUrl, opts.apiKey, opts.model, userPrompt);
    return parseResponse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      riskScore: null,
      summary: "",
      findings: [],
      skipped: true,
      note: `LLM non eseguito (errore non bloccante): ${msg}`,
    };
  }
}
