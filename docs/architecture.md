# Architettura — [nome-progetto]

## Panoramica

[Diagramma o descrizione dei componenti principali e di come comunicano.]

## Layer

- **Presentation**: [dove vive, pattern usato — es. SwiftUI + MVVM @Observable]
- **Domain**: [use case e modelli, zero dipendenze da framework]
- **Data**: [repository e sorgenti: rete, persistenza, BLE, ...]

## Decisioni

Le decisioni architetturali motivate vivono in [adr/](adr/), una per file.

## Compliance

- Perimetro: [nessuno | GDPR | dispositivo medico classe X]
- [Se regolato: link a soup.md, strategia di tracciabilità requisito→codice→test]
