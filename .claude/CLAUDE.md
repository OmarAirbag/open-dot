# CLAUDE.md — [NOME PROGETTO]

> Istruzioni di progetto per Claude Code. Le convenzioni condivise Airbag
> **arrivano dal plugin `airbag-dev`** (marketplace interno), non da una copia in
> questo repo: qui sotto solo ciò che è specifico di questo progetto.
>
> Se le convenzioni non ti risultano in contesto, installa il plugin (una volta
> per macchina, non per repo):
> ```
> /plugin marketplace add Airbag-Studio/airbag-plugins
> /plugin install airbag-dev@airbag-plugins
> ```
> Master e disciplina: `orchestratore-progetti/rules/` (ADR 0002 dell'àncora) —
> un errore nelle regole è una PR lì, mai un'eccezione silenziosa qui.
> `.claude/rules/` di questo repo è per le sole regole specifiche del progetto.

## Progetto

- Cliente / ambito: [DA COMPILARE]
- Piattaforma/stack: [es. iOS Swift/SwiftUI]
- Perimetro compliance: [nessuno | dispositivo medico classe X — vedi docs/architecture.md]

## Comandi

| Cosa | Comando |
|---|---|
| Setup | `[DA COMPILARE]` |
| Build | `[DA COMPILARE]` |
| Test | `[DA COMPILARE]` |
| Lint / format | `[DA COMPILARE]` |

## Specificità di questo repo

- [Eccezioni o aggiunte rispetto alle convenzioni condivise, **con motivazione**]
- [Gotcha che farebbero perdere mezza giornata a chi arriva: branch e deploy,
  migration, segreti, ambienti che condividono un DB, build che vanno lanciate
  in un ordine preciso…]

## Riferimenti

- Architettura: [docs/architecture.md](../docs/architecture.md)
- Comandi e setup: [README.md](../README.md)

<!-- Nota: i subagent del plugin (es. consistency-auditor) NON si auto-invocano —
     li chiami a richiesta (es. "usa consistency-auditor su questo repo"). -->
