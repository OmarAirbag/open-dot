/**
 * generate: subcommand che rigenera gli artefatti "regole di qualità" a partire
 * dal contratto, per essere iniettati nei system-prompt del coding-agent.
 *
 * È la chiusura del loop S2: le stesse rule che il reviewer controlla diventano
 * le istruzioni che l'agente segue. Si rigenerano a mano (o in CI) e si
 * committano — così non c'è I/O a runtime e si vede il diff nel codice.
 *
 * I path di output NON vivono qui: arrivano dal chiamante via `--out <path>`
 * (ripetibile), così il motore resta portabile tra progetti. In questo repo i
 * path stanno nello script npm `review:generate` (package.json):
 *
 *   src/lib/agents/quality-rules.generated.ts   ← importato da cma-agent-spec.ts
 *   scripts/agent-runner/quality-rules.generated.mjs ← importato da run.mjs
 *
 * `run.mjs` gira in GHA via `node` puro (non tsx): NON può importare un .ts,
 * per questo servono due file. Il contenuto (identico) è quello di
 * `review:prompt`; l'estensione decide solo chi può importarlo.
 *
 * Gli artefatti sono marcati `@generated` e gitignored-NO: vanno committati.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadContract } from "./contract.js";
import { generatePromptBlock } from "./prompt.js";

/** Header standard per marcare gli artefatti come generati (non editare). */
const GENERATED_HEADER = `// @generated — generato da "npm run review:generate" a partire da
// tools/review/review-contract.md. NON MODIFICARE A MANO: cambia il contratto e
// rigenera. Questo file è la chiusura del loop S2: le regole qui sotto sono le
// stesse che il reviewer (\`npm run review:diff\`) controllerà sulla PR.`;

/** Modulo ESM (valido sia .ts che .mjs) che esporta le regole come stringa. */
function emitModule(markdown: string): string {
  // Template literal: escapa backtick e ${ per non rompere la stringa.
  const safe = markdown.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  return `${GENERATED_HEADER}
export const QUALITY_RULES = \`${safe}\`;
`;
}

/**
 * Rigenera gli artefatti dal contratto e li scrive negli output richiesti
 * (path relativi al cwd). Ritorna i path assoluti scritti.
 */
export function runGenerate(
  contractPath: string | undefined,
  outs: string[],
): string[] {
  if (outs.length === 0) {
    throw new Error(
      "generate: nessun output dichiarato. Passa almeno un --out <path> " +
        "(.ts o .mjs); in questo repo i path stanno nello script npm review:generate.",
    );
  }
  const contract = loadContract(contractPath);
  const content = emitModule(generatePromptBlock(contract));

  const written: string[] = [];
  for (const out of outs) {
    const abs = resolve(process.cwd(), out);
    writeFileSync(abs, content, "utf8");
    written.push(abs);
  }
  return written;
}
