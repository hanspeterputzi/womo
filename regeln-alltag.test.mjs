import assert from 'node:assert/strict';
import { pruefeAlltag, alltagTage, alltagKm, kontostaendeMitAlltag, tankWarnung, pruefeUebergabe, CHECKPUNKTE, TANK } from './regeln.js';
let n = 0; const test = (name, f) => { f(); n++; console.log('OK  ', name); };
const P = { hp: { konto: 'eltern' }, fr: { konto: 'eltern' }, t: { konto: 'kind-1' }, s: { konto: 'kind-2' } };
const B = { b1: { id: 'b1', von: '2026-07-10', bis: '2026-07-20', fahrerId: 't', mitreisende: ['s'] } };
const alleJa = Object.fromEntries(CHECKPUNKTE.map(([k]) => [k, 'ja']));

test('Tank: Skala hat 7 Stufen, voll ist die letzte', () => { assert.equal(TANK.length, 7); assert.equal(TANK[6], 'voll'); });
test('Tank nicht voll: nur mit Bemerkung speicherbar, mit Warnung', () => {
  const u = { buchungId: 'b1', phase: 'ab', datumZeit: '2026-08-01T09:30', km: 100, tank: '1/2', punkte: alleJa, bemerkung: '' };
  const U = [], BB = { b1: B.b1 };
  assert.equal(pruefeUebergabe(u, U, BB).ok, false);
  assert.equal(pruefeUebergabe({ ...u, bemerkung: 'Tankstelle war zu' }, U, BB).ok, true);
  assert.equal(pruefeUebergabe({ ...u, tank: 'voll' }, U, BB).ok, true);
  assert.equal(pruefeUebergabe({ ...u, tank: '3/4', bemerkung: 'x' }, U, BB).ok, false);   // Stufe gibt es nicht
  assert.equal(pruefeUebergabe({ ...u, tank: '' }, U, BB).ok, false);
  assert.equal(tankWarnung({ tank: '1/2' }), true); assert.equal(tankWarnung({ tank: 'voll' }), false); assert.equal(tankWarnung({}), false);
});
test('Alltag: Pruefung', () => {
  const ok = { datum: '2026-08-03', personId: 'hp', km: 25 };
  assert.equal(pruefeAlltag(ok, B, P).ok, true);
  assert.equal(pruefeAlltag({ ...ok, datum: '2026-07-10' }, B, P).ok, false);          // Reisetag (Randtag)
  assert.equal(pruefeAlltag({ ...ok, datum: '2026-07-20' }, B, P).ok, false);          // Reisetag (Randtag)
  assert.equal(pruefeAlltag({ ...ok, datum: '2026-07-21' }, B, P).ok, true);
  assert.equal(pruefeAlltag({ ...ok, personId: 't' }, B, P).ok, false);                // Kind: nicht erlaubt
  assert.equal(pruefeAlltag({ ...ok, km: -1 }, B, P).ok, false);
  assert.equal(pruefeAlltag({ ...ok, km: 1501 }, B, P).ok, false);
  assert.equal(pruefeAlltag({ ...ok, km: NaN }, B, P).ok, false);
  assert.equal(pruefeAlltag({ ...ok, datum: '3.8.2026' }, B, P).ok, false);
});
test('Alltag: ein Tag zaehlt einmal, auch bei mehreren Fahrten und beiden Eltern', () => {
  const A = { a1: { datum: '2026-08-03', km: 10 }, a2: { datum: '2026-08-03', km: 20 }, a3: { datum: '2026-08-04', km: 5 }, a4: { datum: '2025-12-31', km: 7 } };
  assert.equal(alltagTage(A, B, 2026), 2); assert.equal(alltagKm(A, 2026), 35); assert.equal(alltagKm(A, 2025), 7);
});
test('Alltag: reservierte Tage zaehlen nicht doppelt', () => {
  const A = { a1: { datum: '2026-07-12', km: 10 }, a2: { datum: '2026-08-04', km: 5 } };       // a1 liegt in der Reise der Kinder
  assert.equal(alltagTage(A, B, 2026), 1);
});
test('Konto Eltern = Ferien + Alltag, Kinderkonten unveraendert', () => {
  const BB = { b1: { id: 'b1', von: '2026-03-01', bis: '2026-03-10', fahrerId: 'hp', mitreisende: ['fr'] }, b2: { id: 'b2', von: '2026-07-10', bis: '2026-07-20', fahrerId: 't', mitreisende: ['s'] } };
  const A = { a1: { datum: '2026-08-03', km: 10 }, a2: { datum: '2026-08-04', km: 5 }, a3: { datum: '2026-03-05', km: 3 } }; // a3 in Ferienreise der Eltern: zaehlt nicht doppelt
  const r = kontostaendeMitAlltag(Object.values(BB), P, 2026, A, BB);
  assert.equal(r.eltern, 10 + 2); assert.equal(r.alltag, 2); assert.equal(r['kind-1'], 6); assert.equal(r['kind-2'], 5);
});
test('Grenze 183: Ferien 170 + Alltag 14 = 184 ueberschreitet', () => {
  const BB = { b1: { id: 'b1', von: '2026-01-01', bis: '2026-06-19', fahrerId: 'hp', mitreisende: [] } };    // 170 Tage
  const A = {}; for (let i = 1; i <= 14; i++) A['a' + i] = { datum: `2026-09-${String(i).padStart(2, '0')}`, km: 5 };
  const r = kontostaendeMitAlltag(Object.values(BB), P, 2026, A, BB);
  assert.equal(r.eltern, 184);
});
test('Pflichtfelder: ohne Kilometer, Datum/Uhrzeit oder Tank ist nichts speicherbar', () => {
  const ok = { buchungId: 'b1', phase: 'ab', datumZeit: '2026-08-01T09:30', km: 100, tank: 'voll', punkte: alleJa, bemerkung: '' };
  const U = [], BB = { b1: B.b1 };
  assert.equal(pruefeUebergabe(ok, U, BB).ok, true);
  assert.equal(pruefeUebergabe({ ...ok, km: NaN }, U, BB).ok, false);
  assert.equal(pruefeUebergabe({ ...ok, km: undefined }, U, BB).ok, false);
  assert.equal(pruefeUebergabe({ ...ok, datumZeit: '' }, U, BB).ok, false);
  assert.equal(pruefeUebergabe({ ...ok, datumZeit: undefined }, U, BB).ok, false);
  assert.equal(pruefeUebergabe({ ...ok, tank: '' }, U, BB).ok, false);
});
console.log(`\n${n} Testgruppen bestanden`);
