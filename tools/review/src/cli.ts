/**
 * CLI del reviewer POC.
 *
 * Subcommand:
 *   diff      esegue le rule sul git diff base..head (default origin/develop..HEAD)
 *   prompt    estrae il contratto come markdown per il system-prompt dell'agente
 *   contract  valida solo la sintassi del review-contract.md
 *
 * Uso:
 *   npm run review:diff [-- --base origin/develop] [-- --head HEAD] [-- --contract path]
 *   npm run review:prompt [-- --contract path]
 *   npm run review:contract [-- --contract path]
 *   npm run review:generate  (i --out vivono nello script npm)
 *
 * La base di default è `origin/develop`, overridabile con --base o con l'env
 * AIRBAG_REVIEW_BASE (per repo con branch d'integrazione diverso).
 *
 * Exit code: 0 pulito, 1 se hard violations o errore. Offline (no --env-file),
 * coerente con `jira:check`.
 */
import { parseArgs } from "node:util";
import { loadContract, ContractParseError } from "./contract.js";
import { loadDiff, loadGitContext } from "./git.js";
import { runRules } from "./engine.js";
import { printReport, hasHard } from "./report.js";
import { generatePromptBlock } from "./prompt.js";
import { runGenerate } from "./generate.js";
import { resolveLlmOptions, reviewWithLlm } from "./llm.js";
import { RULES } from "./rules/index.js";

function fail(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

function commonOptions() {
  const { values } = parseArgs({
    options: {
      base: {
        type: "string",
        default: process.env.AIRBAG_REVIEW_BASE || "origin/develop",
      },
      head: { type: "string", default: "HEAD" },
      contract: { type: "string" }, // path opzionale; default calcolato dal modulo
      out: { type: "string", multiple: true }, // output di `generate` (ripetibile)
      llm: { type: "boolean", default: false }, // attiva il layer LLM (S4)
    },
    allowPositionals: true,
  });
  return values;
}

async function main() {
  const subcommand = process.argv[2];
  if (!subcommand || !["diff", "prompt", "contract", "generate"].includes(subcommand)) {
    fail(
      "Usage: npm run review:<diff|prompt|contract|generate> [-- --base origin/develop --head HEAD --llm]",
    );
  }

  const opts = commonOptions();

  // Carica il contratto (validazione implicita: parseContract lancia su errore).
  let contract;
  try {
    contract = loadContract(opts.contract as string | undefined);
  } catch (e) {
    if (e instanceof ContractParseError) {
      fail(`✗ Contratto invalido: ${e.message}`);
    }
    throw e;
  }

  if (contract.length === 0) {
    fail("✗ Contratto vuoto: nessuna rule dichiarata.");
  }

  if (subcommand === "contract") {
    console.log(`✅ Contratto valido: ${contract.length} rule dichiarate.`);
    for (const c of contract) {
      const scope = c.scope ? ` scope=${c.scope}` : "";
      console.log(`  • ${c.id} [${c.severity}]${scope}`);
    }
    return;
  }

  if (subcommand === "prompt") {
    process.stdout.write(generatePromptBlock(contract) + "\n");
    return;
  }

  if (subcommand === "generate") {
    const outs = (opts.out as string[] | undefined) ?? [];
    if (outs.length === 0) {
      fail(
        "✗ generate: nessun --out dichiarato. In questo repo usa `npm run review:generate` " +
          "(i path degli artefatti vivono nello script npm).",
      );
    }
    const written = runGenerate(opts.contract as string | undefined, outs);
    console.log("✅ Artefatti rigenerati dal contratto:");
    for (const w of written) console.log(`  • ${w}`);
    console.log("  Committa i file modificati: chiudono il loop S2 (prompt del coding-agent).");
    return;
  }

  // subcommand === "diff"
  const files = loadDiff({ base: opts.base as string, head: opts.head as string });
  const git = loadGitContext({ base: opts.base as string, head: opts.head as string });

  const { findings, diagnostics } = runRules(
    contract,
    { files, git },
    RULES.map((r) => r.id),
  );

  // Layer LLM opzionale (S4): advisory puro, off di default. Si attiva con
  // --llm o AIRBAG_REVIEW_LLM=1. Errori/timeout non bloccano mai.
  const llmOpts = resolveLlmOptions(opts.llm === true);
  const llm = llmOpts.enabled ? await reviewWithLlm(files, contract, llmOpts) : undefined;

  printReport({
    base: opts.base as string,
    head: opts.head as string,
    fileCount: files.length,
    findings,
    diagnostics,
    llm,
  });

  if (hasHard(findings)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
