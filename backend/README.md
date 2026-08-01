# Rehub — backend

Due comandi.

```bash
npm install
npm run dev
```

Il server parte su `0.0.0.0:3001` e stampa all'avvio l'indirizzo da puntare dal telefono:

```
Rehub backend su http://localhost:3001
  dal telefono:   http://10.100.1.128:3001
  stato:          .../backend/data/state.json
```

**Dal telefono**: stessa wifi del laptop, poi apri l'IP che vedi stampato lì. Non `localhost`, che sul telefono è il telefono.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server con ricarica automatica |
| `npm test` | 53 test sul motore di scoring |
| `npm run typecheck` | controllo dei tipi, senza build |
| `npm run demo:check` | esegue tutto il giro di demo e dice cosa si è rotto |

Non c'è uno step di build: `tsx` esegue il TypeScript direttamente. Si salva e riparte.

## Se qualcosa si rompe

**Lo stato è un file solo**: `data/state.json`. Cancellalo e riparti da capo — al prossimo avvio viene rigenerato.

```bash
rm data/state.json
```

Oppure, senza fermare il server:

```bash
curl -X POST localhost:3001/api/demo/reset
```

## Comandi della demo

| | |
|---|---|
| `POST /api/demo/load/nuovo` | primo accesso, tutto a zero |
| `POST /api/demo/load/soglia` | a una giornata piena dal level-up |
| `POST /api/demo/load/avanzato` | 41 giorni di storico, streak 34, ×2,65, 1433 gemme |
| `POST /api/demo/next-day` | chiude la giornata e avanza. `{"completa": false}` per mostrare uno streak perso |
| `POST /api/demo/set` | forza `streak`, `gemme`, `rpProgressoFase`. La rete di sicurezza |

Il giro che funziona sul palco: carica **soglia**, premi `next-day` una volta e il level-up accade a comando.

## API

Ogni chiamata che modifica ritorna **lo stato intero**, mai un diff. Ogni errore è `{ errore, messaggio }` leggibile, mai uno stack trace.

| | |
|---|---|
| `GET /api/state` | tutto quello che serve alla home |
| `POST /api/tasks/toggle` | `{ blocco, voceId, fatto }` |
| `POST /api/diary` | `{ vas, nota? }` — da VAS 7 in su mette in pausa la giornata |
| `POST /api/day/recovery` | `{ motivo }` — recupero manuale, 1 per fase |
| `POST /api/phase/advance` | conferma del level-up |
| `GET /api/history?giorni=40` | calendario e grafico del dolore |
| `GET /api/store` · `POST /api/store/:id/redeem` · `GET /api/vouchers` | negozio |
| `GET /api/badges` | badge e prossimo da ottenere |
| `GET /api/notifications` | coda, e **perché** l'app tace |

## Dove sta cosa

```
src/domain/     il gioco: scoring, notifiche, negozio, benefit
                funzioni pure, nessun I/O — è l'unica parte testata
src/data/       piano di Marco, profili demo, catalogo, persistenza
src/api/        rotte e composizione delle risposte: non decidono niente
```

Le regole del gioco stanno in `README.md` e `CLAUDE.md` nella cartella sopra, che non sono nel repo.
