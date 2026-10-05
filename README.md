<!-- ▼▼▼ SETUP DEL TEMPLATE — segui questi passi, poi CANCELLA questo riquadro ▼▼▼ -->
> 🚀 **Repo creato da `airbag-repo-template`.** Tre passi per renderlo operativo:
>
> 1. **Convenzioni** — non si sincronizzano nel repo: arrivano dal plugin `airbag-dev` del
>    marketplace interno per chi lavora in sessione, e nel brief per gli Airbagent (ADR 0002
>    dell'àncora, AP-497). Nessun secret da impostare.
> 2. **Contratto di review** — personalizza `tools/review/review-contract.md` (è del progetto:
>    attiva le rule del tuo stack). Il gate `airbag-review.yml` gira già su ogni PR con il motore
>    in `tools/review/src`, che da qui in poi è tuo. Vedi [tools/review/README.md](tools/review/README.md).
> 3. **Compila e registra** — questo README, `.claude/CLAUDE.md`, `docs/architecture.md`; aggiungi il
>    progetto a `registry/projects.yaml` nell'àncora `orchestratore-progetti`. Chi lavora sul repo
>    installa il plugin **una volta per macchina** (è da lì che arrivano le convenzioni;
>    `.claude/rules/` resta per le sole regole specifiche del repo):
>    ```
>    /plugin marketplace add Airbag-Studio/airbag-plugins
>    /plugin install airbag-dev@airbag-plugins
>    ```
>
> Guida completa + passi per piattaforma: `GUIDA-NUOVO-PROGETTO.md` nell'àncora. **Fatto? Cancella questo riquadro.**
<!-- ▲▲▲ fine SETUP DEL TEMPLATE ▲▲▲ -->

# [nome-progetto]

[Cosa fa, in 1 paragrafo. Cliente/ambito.]

## Stack e requisiti minimi

- [es. iOS 17+ / Swift 6 / Xcode 16 — oppure Node 22 LTS / Next.js 16]
- [toolchain e versioni necessarie]

## Setup locale

```bash
[comandi per partire da zero]
```

## Build & test

```bash
[comandi build]
[comandi test]
```

## Architettura

Vedi [docs/architecture.md](docs/architecture.md).

## Review delle PR (gate)

Ogni PR passa dal gate **Airbag review** (`.github/workflows/airbag-review.yml`):
esegue le regole di [tools/review/review-contract.md](tools/review/review-contract.md)
sul diff — le violazioni `hard` bloccano il merge. Contratto e motore sono del
progetto (il motore è lo snapshot ereditato dal template alla creazione).
Manuale: [tools/review/README.md](tools/review/README.md).

## Compliance

[Se applicabile: classe di rischio, link a docs/soup.md — altrimenti rimuovere la sezione.]
