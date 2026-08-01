/**
 * The full demo tour, run against a live server (TODO-backend.md §10).
 *
 * This is not a test: the tests cover the engine in isolation. This drives the
 * real HTTP surface in the order the demo will follow, so that anything that
 * only breaks through the wire — persistence, rollover, a route wired to the
 * wrong function — breaks here instead of on stage.
 *
 *   npm run demo:check
 *
 * Run it three times in a row. If the third run does not read exactly like the
 * first, something is keeping state it should not.
 */

const BASE = process.env['REHAPP_URL'] ?? 'http://localhost:3001';

let passati = 0;
const falliti: string[] = [];

function verifica(etichetta: string, condizione: boolean, dettaglio?: unknown): void {
  if (condizione) {
    passati += 1;
    console.log(`  ok   ${etichetta}`);
  } else {
    falliti.push(etichetta);
    console.log(`  FAIL ${etichetta}${dettaglio === undefined ? '' : `  → ${JSON.stringify(dettaglio)}`}`);
  }
}

async function chiama(
  metodo: string,
  percorso: string,
  corpo?: unknown,
): Promise<{ stato: number; dati: any }> {
  const risposta = await fetch(`${BASE}${percorso}`, {
    method: metodo,
    ...(corpo === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
  });
  return { stato: risposta.status, dati: await risposta.json() };
}

const get = (p: string) => chiama('GET', p);
const post = (p: string, corpo?: unknown) => chiama('POST', p, corpo);

function titolo(testo: string): void {
  console.log(`\n${testo}`);
}

async function giro(): Promise<void> {
  titolo('0 · il server risponde');
  const salute = await get('/api/health');
  verifica('GET /api/health', salute.dati?.ok === true);

  titolo('1 · primo accesso');
  const nuovo = await post('/api/demo/load/nuovo');
  verifica('tutto a zero', nuovo.dati.barra.rpProgressoFase === 0 && nuovo.dati.barra.gemme === 0);
  verifica('fase 1 di 4', nuovo.dati.fase.numero === 1 && nuovo.dati.fase.totaleFasi === 4);
  verifica('soglia 308', nuovo.dati.fase.sogliaRp === 308, nuovo.dati.fase.sogliaRp);
  verifica('la giornata vale 22 RP', nuovo.dati.oggi.rpPotenziali === 22, nuovo.dati.oggi.rpPotenziali);
  verifica('niente ancora sbloccato', nuovo.dati.benefit.every((b: any) => !b.sbloccato));

  titolo('2 · tutto o niente per blocco');
  const esercizi: string[] = nuovo.dati.oggi.blocchi
    .find((b: any) => b.id === 'esercizi')
    .voci.map((v: any) => v.id);
  let stato = await post('/api/tasks/toggle', {
    blocco: 'esercizi',
    voceId: esercizi[0],
    fatto: true,
  });
  verifica('1 esercizio su 3 → 0 RP maturati', stato.dati.oggi.rpMaturati === 0);
  for (const id of esercizi.slice(1)) {
    stato = await post('/api/tasks/toggle', { blocco: 'esercizi', voceId: id, fatto: true });
  }
  verifica('blocco completo → 16 RP', stato.dati.oggi.rpMaturati === 16, stato.dati.oggi.rpMaturati);

  titolo('3 · errori leggibili, mai uno stack trace');
  const inesistente = await post('/api/tasks/toggle', { blocco: 'esercizi', voceId: 'pippo' });
  verifica('voce inesistente → 400', inesistente.stato === 400);
  verifica('con messaggio leggibile', typeof inesistente.dati.messaggio === 'string');
  const vasAssurdo = await post('/api/diary', { vas: 42 });
  verifica('VAS 42 → 400', vasAssurdo.stato === 400);
  const troppoPresto = await post('/api/phase/advance');
  verifica('level-up prematuro → 409', troppoPresto.stato === 409);

  titolo('4 · il momento clou: level-up a comando');
  const soglia = await post('/api/demo/load/soglia');
  verifica('286 su 308', soglia.dati.fase.rpProgresso === 286, soglia.dati.fase.rpProgresso);
  verifica('manca una giornata piena', soglia.dati.fase.sogliaRp - soglia.dati.fase.rpProgresso === 22);
  const gemmePrima = soglia.dati.barra.gemme;
  const dopoLevelUp = await post('/api/demo/next-day', {});
  verifica('passa in fase 2', dopoLevelUp.dati.fase.numero === 2, dopoLevelUp.dati.fase.numero);
  verifica('nuova soglia 462', dopoLevelUp.dati.fase.sogliaRp === 462);
  verifica(
    'bonus di 62 gemme pagato',
    dopoLevelUp.dati.barra.gemme >= gemmePrima + 62,
    { prima: gemmePrima, dopo: dopoLevelUp.dati.barra.gemme },
  );
  verifica('il grafico del dolore si sblocca', dopoLevelUp.dati.benefit[0].sbloccato === true);

  titolo('5 · profilo avanzato: calendario e grafico pieni');
  const avanzato = await post('/api/demo/load/avanzato');
  verifica('streak 34', avanzato.dati.barra.streakGiorni === 34, avanzato.dati.barra.streakGiorni);
  verifica('moltiplicatore ×2.65', avanzato.dati.barra.moltiplicatore === 2.65);
  verifica('1433 gemme', avanzato.dati.barra.gemme === 1433, avanzato.dati.barra.gemme);
  verifica('la giornata aperta è normale', avanzato.dati.oggi.tipoGiorno === 'normale');
  const storico = await get('/api/history?giorni=50');
  verifica('41 giorni di storico', storico.dati.giorni.length === 41, storico.dati.giorni.length);
  verifica(
    'con giorni di recupero dentro',
    storico.dati.giorni.some((g: any) => g.tipoGiorno === 'recupero'),
  );
  verifica(
    'e un giorno perso, per il calendario',
    storico.dati.giorni.some((g: any) => g.tipoGiorno === 'normale' && !g.checklistCompleta),
  );
  verifica('il dolore varia, il grafico ha una forma', new Set(storico.dati.giorni.map((g: any) => g.vas)).size > 2);

  titolo('6 · badge');
  const badge = await get('/api/badges');
  verifica('tutti e quattro ottenuti', badge.dati.badge.every((b: any) => b.ottenuto), badge.dati.badge.map((b: any) => [b.id, b.ottenuto]));

  titolo('7 · negozio e voucher');
  const negozio = await get('/api/store');
  verifica('sei ricompense', negozio.dati.ricompense.length === 6);
  const palestra = negozio.dati.ricompense.find((r: any) => r.id === 'fitlab-10e');
  verifica('la palestra è bloccata fino alla fase 3', palestra.sbloccato === false);
  const riscatto = await post('/api/store/attiva-sport-20/redeem');
  verifica('riscatto riuscito', riscatto.stato === 200);
  verifica(
    'codice nel formato giusto',
    /^REHAPP-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(riscatto.dati.voucher?.codice ?? ''),
    riscatto.dati.voucher?.codice,
  );
  verifica('gemme scalate', riscatto.dati.stato.barra.gemme === 933, riscatto.dati.stato.barra.gemme);
  const bis = await post('/api/store/attiva-sport-20/redeem');
  verifica('non si riscatta due volte → 409', bis.stato === 409);
  const pozzo1 = await post('/api/store/farmacia-5-ripetibile/redeem');
  const pozzo2 = await post('/api/store/farmacia-5-ripetibile/redeem');
  verifica(
    'il pozzo cresce: 150 poi 200',
    pozzo1.dati.voucher.gemmeSpese === 150 && pozzo2.dati.voucher.gemmeSpese === 200,
    [pozzo1.dati.voucher?.gemmeSpese, pozzo2.dati.voucher?.gemmeSpese],
  );
  const voucher = await get('/api/vouchers');
  verifica('tre voucher in tasca', voucher.dati.voucher.length === 3, voucher.dati.voucher.length);

  titolo('8 · il giorno di recupero, il pezzo che vale il progetto');
  const primaDelDolore = await get('/api/state');
  const conDolore = await post('/api/diary', { vas: 8, nota: 'ginocchio gonfio' });
  verifica('diventa giorno di recupero', conDolore.dati.oggi.tipoGiorno === 'recupero');
  verifica('per dolore', conDolore.dati.oggi.motivoRecupero === 'dolore');
  verifica('moltiplicatore congelato', conDolore.dati.barra.moltiplicatoreCongelato === true);
  verifica(
    'streak intatto',
    conDolore.dati.barra.streakGiorni === primaDelDolore.dati.barra.streakGiorni,
  );
  verifica(
    'gli esercizi non sono richiesti oggi',
    conDolore.dati.oggi.blocchi.find((b: any) => b.id === 'esercizi').richiestoOggi === false,
  );
  verifica(
    'e tutto vale zero',
    conDolore.dati.oggi.blocchi.every((b: any) => b.rpOggi === 0),
  );

  titolo('9 · il silenzio viene prima del promemoria');
  const notifiche = await get('/api/notifications');
  verifica('l’app tace', notifiche.dati.silenzio?.motivo === 'giorno-di-recupero', notifiche.dati.silenzio);
  verifica(
    'nessun promemoria di esercizi',
    !notifiche.dati.coda.some((n: any) => n.tipo === 'esercizi'),
  );
  verifica('mai più di tre notifiche', notifiche.dati.coda.length <= 3);

  titolo('10 · streak perso, e cosa resta');
  const rpPrima = (await get('/api/state')).dati.barra.rpTotali;
  await post('/api/demo/load/avanzato');
  const perso = await post('/api/demo/next-day', { completa: false });
  verifica('streak azzerato', perso.dati.barra.streakGiorni === 0);
  verifica('moltiplicatore a ×1, mai 0.95', perso.dati.barra.moltiplicatore === 1);
  verifica('gli RP non arretrano', perso.dati.barra.rpTotali > 0 && rpPrima > 0);
}

console.log(`Giro di demo su ${BASE}`);
try {
  await giro();
} catch (errore) {
  console.error('\nIl giro si è interrotto:', errore instanceof Error ? errore.message : errore);
  console.error('Il server è avviato? `npm run dev`');
  process.exit(2);
}

console.log(
  falliti.length === 0
    ? `\n✓ ${passati} controlli, tutti passati`
    : `\n✗ ${falliti.length} falliti su ${passati + falliti.length}:\n  - ${falliti.join('\n  - ')}`,
);
process.exit(falliti.length === 0 ? 0 : 1);
