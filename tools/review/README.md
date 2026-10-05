# tools/review — PR review a contratto (motore Airbag)

Meccanismo di controllo qualità delle PR basato su **un unico contratto**
(`review-contract.md`) che è sorgente per due flussi:

```
review-contract.md  ──►  (A) system-prompt del coding-agent   [prevenzione]
                   └─►  (B) checklist del reviewer           [rilevazione]
```

Se l'agente rispetta il contratto → la PR passa la review al primo colpo. Se
lo viola → il reviewer lo cattura con lo stesso linguaggio. È un loop chiuso:
modificare il contratto aggiorna sia cosa fa l'agente sia cosa controlla la
review.

## Chi possiede cosa

| Pezzo | Proprietario | Aggiornamento |
|---|---|---|
| `src/`, `tsconfig.json`, questo README | **il progetto** (snapshot ereditato dal template alla creazione) | a mano, via PR |
| `review-contract.md` | **il progetto** | a mano, via PR; personalizzalo |
| `.github/workflows/airbag-review.yml` | il progetto (copiato al bootstrap) | a mano |

Il motore è nato in `airbag-forecast` (oggi `airbag-plan`) ed è arrivato nel
template il 2026-07-06 con un sync settimanale verso i repo consumatori. Il
sync è **ritirato** (AP-568, 2026-09-21): chiedeva un PAT per repo che
scadeva in silenzio, il template era fermo mentre il motore evolveva nel
consumatore, e una run verde avrebbe cancellato le rule nate lì. Stessa
logica di AP-497 per il sync delle convenzioni: una copia vecchia che sembra
autorevole è peggio di nessuna copia. **La versione di riferimento del motore
è quella di `airbag-plan/tools/review`**; questo è lo snapshot che un repo
nuovo eredita. Dove vivano i package di codice condiviso è il `[DA DEFINIRE]`
di §8 delle convenzioni.

**Disciplina**: i fix e le rule nuove del motore si fanno nel repo che le
usa, in `src/`. Le modifiche alle regole del repo si fanno nel contratto.

## Come si lancia

Serve solo Node ≥ 20 (nessuna dipendenza: il motore usa solo `node:*`
builtins + tsx via npx):

```bash
# Esegue le rule sul diff base..head. Exit 0 = pulito, 1 = hard violations.
npx tsx tools/review/src/cli.ts diff --base origin/main --head HEAD

# Valida la sintassi del contratto.
npx tsx tools/review/src/cli.ts contract

# Estrae le regole come markdown (per il system-prompt di un agente).
npx tsx tools/review/src/cli.ts prompt

# Rigenera artefatti da iniettare nei prompt (path a scelta del progetto).
npx tsx tools/review/src/cli.ts generate --out src/lib/quality-rules.generated.ts
```

La base di default è `origin/develop`; si cambia con `--base` o con l'env
`AIRBAG_REVIEW_BASE`. Nei progetti Node conviene aggiungere gli script npm
(`review:diff`, `review:contract`, ...) come alias dei comandi sopra.

## Le rule del motore

Attive nel contratto starter (valide per qualunque stack):

| Rule | Severity | Copre |
|---|---|---|
| `no-secrets` | hard | secret leak (API keys, JWT, `.env*`) |
| `no-junk-files` | hard | `.bak/.orig/.tmp/.swp/.old`, `.DS_Store` |
| `diff-hygiene` | soft | trailing ws, marker conflitto, CRLF |
| `commit-msg` | advisory | chiave issue + conventional commits |
| `branch-naming` | advisory | prefissi branch |

Dormienti (attivabili aggiungendo la sezione al contratto):

| Rule | Quando attivarla |
|---|---|
| `no-debug-residue` | stack JS/TS (console.*/debugger nuovi) |
| `no-broad-ignores` | stack TS (`@ts-ignore`, `as any`, `: any`) |
| `no-new-eslint-disable` | repo con eslint (disable senza `// WHY`) |
| `migrations-additive` | repo con migration SQL (vieta DROP/RENAME) |
| `no-out-of-scope` | protezione file CI/config/lockfile nelle PR di feature |

L'engine esegue **solo le rule dichiarate nel contratto**: il contratto è
l'on/off per-progetto, e severity/scope dichiarati lì vincono sul codice.

## CI: il gate sulla PR

`.github/workflows/airbag-review.yml` esegue il subcommand `diff` su ogni
`pull_request`: hard violations → check rosso → merge bloccato; soft/advisory
→ log senza bloccare. Gira con `npx tsx` senza install (< 1 minuto).

## Layer LLM opzionale

Attivabile con `--llm` o env `AIRBAG_REVIEW_LLM=1` (credenziali:
`MODEL_BASE_URL`, `MODEL_API_KEY`, `MODEL_ID`, override `AIRBAG_REVIEW_*`).
Advisory puro: risk-score 0-10 + findings, mai bloccante, tollerante a errori
e timeout, boundato alle rule del contratto. Off di default e off in CI.

## Aggiungere una rule

1. Crea `src/rules/<id>.ts` che esporta un oggetto `Rule` (modello:
   `src/rules/no-secrets.ts`).
2. Registrala in `src/rules/index.ts`.
3. Documentala qui (attiva o dormiente) e aggiungi la sezione
   `## <id>  [severity]` al contratto (senza, il validator se ne accorge e
   l'engine non la esegue).
4. Se è universale, vale la pena portarla anche in `airbag-plan/tools/review`
   (la versione di riferimento) e nel template, con una PR per uno.

## Architettura

```
src/
├─ cli.ts          parseArgs + dispatch (diff | generate | prompt | contract)
├─ contract.ts     parser di review-contract.md → ContractRule[]
├─ git.ts          git diff --numstat + git diff -U0 → FileDiff[]
├─ engine.ts       runRules: applica scope + severity override
├─ report.ts       output plain, riepilogo + verdetto + blocco LLM
├─ prompt.ts       estrae il contratto come blocco markdown
├─ generate.ts     scrive artefatti per i prompt (path via --out)
├─ llm.ts          layer LLM opzionale (advisory, off di default)
├─ util.ts         helper condivisi (isGenerated)
├─ types.ts        tipi condivisi
└─ rules/          un detector per file + registry (index.ts)
```

Storia e razionale delle decisioni: `docs/airbag-review-tool-analisi.md` in
`airbag-forecast` (repo dove il motore è nato).
