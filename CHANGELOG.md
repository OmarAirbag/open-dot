# Changelog

Tutte le modifiche rilevanti di questo progetto sono documentate qui.
Formato: [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) · Versioning: [SemVer](https://semver.org/lang/it/).

## [Unreleased]

### Added
- Setup iniziale del progetto con le convenzioni Airbag (v0.2.0).
- Motore di review PR a contratto (`tools/review/`, nato in `airbag-forecast`):
  gate `airbag-review.yml` su ogni PR; il `review-contract.md` resta del progetto.

### Changed
- `.claude/CLAUDE.md` allineato a `templates/CLAUDE.md` dell'àncora (convenzioni
  0.4.0): non importa più `@rules/airbag-conventions.md`, rimanda al plugin
  `airbag-dev` con i comandi d'installazione; aggiunta la tabella «Comandi».
  Passo 3 del riquadro di setup nel README: non più «cancella da `.claude/rules/`
  le piattaforme che non usi», ma «installa il plugin una volta per macchina».

### Removed
- Copie delle regole condivise in `.claude/rules/` (`airbag-conventions.md` ferma
  alla 0.2.0 + `design`, `flutter`, `kotlin`, `python`, `swift`, `typescript`,
  `web-style`) e `.claude/agents/consistency-auditor.md` (AP-497): convenzioni
  0.4.0 §2 — `.claude/rules/` contiene solo regole specifiche del repo, le
  condivise (e l'auditor) arrivano dal plugin `airbag-dev`. Resta un `README.md`
  nella cartella che spiega a cosa serve.
- `sync-airbag-review.yml` e `sync-airbag-rules.yml` (AP-568, AP-497): i due
  sync settimanali chiedevano un PAT per repo (`AIRBAG_RULES_TOKEN`) che
  scadeva in silenzio — rossi ogni lunedì dal 20/7 — e una run verde del
  primo avrebbe cancellato le rule nate nel repo consumatore. Le convenzioni
  arrivano dal plugin `airbag-dev` e dal brief degli Airbagent (ADR 0002
  dell'àncora); il motore di review è dello snapshot ereditato alla creazione,
  con la versione di riferimento in `airbag-plan/tools/review`. Un repo nuovo
  non ha più secret da impostare.

<!--
Regole (convenzioni §6, §10):
- Ogni nuova dipendenza = una riga qui (e voce SOUP nei progetti regolati).
- Ogni release: sezione [x.y.z] - AAAA-MM-GG con Added/Changed/Fixed/Removed.
- Il changelog deve permettere di ricostruire cosa è cambiato e perché tra due release.
-->
