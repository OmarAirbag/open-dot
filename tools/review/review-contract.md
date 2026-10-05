# Review contract — [nome-progetto]

> **Sorgente unica.** Questo file genera due output, senza duplicazione:
>
> 1. **(A) Prevenzione** — il subcommand `prompt`/`generate` ne estrae le
>    regole e le inietta nel system-prompt del coding-agent, così lavora già
>    in regola.
> 2. **(B) Rilevazione** — il subcommand `diff` le esegue sul git diff della
>    PR e segnala le violazioni (hard = blocca, soft = avvisa, advisory = nota).
>
> Modifica qui dentro e sia il prompt dell'agente sia il reviewer si allineano
> automaticamente. È il loop chiuso: stessa sorgente per prevenzione e check.
>
> **Questo file è DEL PROGETTO**, come il motore che lo esegue.
> Personalizzalo — attiva/disattiva regole, cambia severity e scope, riscrivi
> le descrizioni con i vincoli reali del tuo repo.
>
> Sintassi delle sezioni:
>
> ```
>   ## <rule-id>  [hard|soft|advisory]  [scope: <glob>]
>   <corpo descrittivo>
> ```
>
> - `hard`: la CI / subcommand `diff` esce con codice 1 (blocca il merge).
> - `soft`: avvertimento non bloccante (da sistemare, ma la PR passa).
> - `advisory`: nota informativa.
> - `scope`: glob opzionale per limitare i file su cui la rule gira
>   (es. `src/**`). Se omesso, la rule gira su tutto il diff.
>
> **Regole dormienti.** Il motore esegue solo le rule dichiarate qui: i
> detector non dichiarati restano spenti. Oltre a quelle attive sotto, il
> motore include questi detector attivabili aggiungendo la sezione:
>
> ```
>   ## no-debug-residue  [soft]  [scope: src/**]     console.*/debugger nuovi (stack JS/TS)
>   ## no-broad-ignores  [soft]  [scope: src/**]     @ts-ignore, as any, : any (stack TS)
>   ## no-new-eslint-disable  [soft]  [scope: src/**]  eslint-disable senza // WHY (stack JS/TS)
>   ## migrations-additive  [hard]  [scope: <dir>/*.sql]  DROP/RENAME vietati nelle migration SQL
>   ## no-out-of-scope  [soft]                       tocchi a file protetti (CI/config/lockfile)
> ```

## no-secrets  [hard]

Nessun segreto nel diff. Casi coperti:

- chiavi API-like: AWS (`AKIA...`), OpenAI (`sk-...`), GitHub (`ghp_/gho_/...`),
  Slack (`xoxb-/xoxp-`), private key PEM, JWT;
- file `.env*` aggiunti (eccetto `.env.example`, che è template intenzionale).

I segreti appartengono a `.env.local` / al secret manager (gitignored), non al
repo. Se la regola spara su qualcosa che non è un segreto (es. esempio in un
test), aggiungilo al pattern come eccezione documentata.

## no-junk-files  [hard]

Niente file di scarto nel repo. Estensioni bloccate: `.bak .orig .tmp .swp .old
.rej`. Nomi bloccati: `.DS_Store`, `Thumbs.db`.

Questi file sono sempre non intenzionali → gate hard. Se il tuo `.gitignore`
li copre già, questa rule è la rete di backup sul diff.

## diff-hygiene  [soft]

Niente rumore invisibile nel diff:

- marker di conflitto non risolti (`<<<<<<<`, `=======`, `>>>>>>>`);
- righe con CRLF (`\r`) — i repo Airbag usano LF;
- trailing whitespace.

Se il repo ha un formatter configurato (prettier/biome/swiftformat), questa
rule è ridondante sui file che il formatter copre: valuta di restringere lo
scope o toglierla.

## commit-msg  [advisory]

Convenzione "Chiavi ovunque" (airbag-conventions):

- **BUONO** — `[KEY-NN] feat(scope): descrizione` (chiave issue + Conventional
  Commits; l'ideale documentato).
- **ACCETTABILE** — `feat(scope): descrizione` (conventional senza chiave),
  `KEY-NN: descrizione` (chiave senza conventional), `Merge ...`.
- **DA EVITARE** — commit senza chiave né tipo, o messaggi vaghi
  (`wip`, `fix`, `update`, <8 caratteri).

**Advisory, non fail**: si segnalano solo i chiaramente fuori convenzione.
Alza a `soft`/`hard` quando la storia del repo è disciplinata.

## branch-naming  [advisory]

Prefissi di branch accettati:

- umani: `feature/`, `feat/`, `fix/`, `hotfix/`, `release/`, `db/`, `chore/`,
  `docs/`, `perf/`, `ci/`, `refactor/`, `style/`, `test/`;
- agente: `agent/(epic/|story/|sub/)?KEY-NN`;
- auto: `claude/...`;
- integrazione: `develop`, `main`, `master`, `dev`.

Convenzione documentata: `feature/KEY-NN-slug`. Advisory: si segnala solo ciò
che è chiaramente fuori dai prefissi previsti.
