import assert from 'node:assert/strict';
import { SCHWELLE, tage, konten, kontostaende, stufe, kollision, pruefeBuchung } from './regeln.js';

const P = { hp: { konto: 'eltern' }, fr: { konto: 'eltern' }, t: { konto: 'kind-1' }, s: { konto: 'kind-2' } };
const plus = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const B = (von, n, fahrerId = 't', mitreisende = ['s'], erfasstVon = 't', erfasstAm = 'a') =>
  ({ von, bis: plus(von, n - 1), fahrerId, mitreisende, erfasstVon, erfasstAm, gaeste: 0 });
let n = 0; const test = (name, f) => { f(); n++; console.log('OK  ', name); };

test('Schwellen aus Rechnung', () => {
  assert.equal(181 + 92 + 92, 365);   // Entscheid HP77 08.11.2026: Schwellen ergeben zusammen genau ein Jahr
  assert.deepEqual(SCHWELLE, { 'eltern': 181, 'kind-1': 92, 'kind-2': 92 });
});
test('Randtage zaehlen voll', () => {
  assert.equal(tage({ von: '2026-07-01', bis: '2026-07-01' }, 2026), 1);
  assert.equal(tage({ von: '2026-07-01', bis: '2026-07-02' }, 2026), 2);
});
test('Silvester teilt auf beide Jahre', () => {
  const s = { von: '2026-12-30', bis: '2027-01-02' };
  assert.equal(tage(s, 2026), 2); assert.equal(tage(s, 2027), 2); assert.equal(tage(s, 2025), 0);
});
test('Schaltjahr 366 Tage', () => assert.equal(tage({ von: '2028-01-01', bis: '2028-12-31' }, 2028), 366));
test('Konten: Kind allein, mit Eltern, beide Kinder', () => {
  assert.deepEqual(konten(B('2026-07-01', 3, 't', ['hp']), P), ['eltern']);
  assert.deepEqual(konten(B('2026-07-01', 3, 't', []), P), ['kind-1']);
  assert.deepEqual(konten(B('2026-07-01', 3, 't', ['s']), P), ['kind-1', 'kind-2']);
});
test('Warnstufen', () => {
  const k = (m) => kontostaende([B('2026-01-01', m, 't', [])], P, 2026)['kind-1'];
  assert.equal(stufe(k(92), 'kind-1'), 'gelb'); assert.equal(stufe(k(93), 'kind-1'), 'rot');
  assert.equal(stufe(82, 'kind-1'), 'ok'); assert.equal(stufe(83, 'kind-1'), 'gelb');
  assert.equal(stufe(181, 'eltern'), 'gelb'); assert.equal(stufe(182, 'eltern'), 'rot');
});
test('Kollision inkl. Randtag', () => {
  const a = { von: '2026-07-01', bis: '2026-07-10' };
  assert.ok(kollision(a, { von: '2026-07-10', bis: '2026-07-12' }));
  assert.ok(!kollision(a, { von: '2026-07-11', bis: '2026-07-12' }));
});
test('Teilung: 7 Tage Gleichstand', () => {
  let r = kontostaende([B('2026-07-01', 7)], P, 2026); assert.deepEqual([r['kind-1'], r['kind-2']], [4, 3]);
  r = kontostaende([B('2026-07-01', 7, 't', ['s'], 's')], P, 2026); assert.deepEqual([r['kind-1'], r['kind-2']], [3, 4]);
  r = kontostaende([B('2026-07-01', 7, 't', ['s'], 'hp')], P, 2026); assert.deepEqual([r['kind-1'], r['kind-2']], [4, 3]);
  r = kontostaende([B('2026-07-01', 8)], P, 2026); assert.deepEqual([r['kind-1'], r['kind-2']], [4, 4]);
});
test('Teilung: Summe = Reisetage (1 bis 39)', () => {
  for (let i = 1; i < 40; i++) { const r = kontostaende([B('2026-03-01', i)], P, 2026); assert.equal(r['kind-1'] + r['kind-2'], i); }
});
test('Teilung: Ausgleich ueber mehrere Reisen', () => {
  let r = kontostaende([B('2026-03-01', 7), B('2026-06-01', 7)], P, 2026); assert.deepEqual([r['kind-1'], r['kind-2']], [7, 7]);
  const e = B('2026-02-01', 5, 's', []);
  r = kontostaende([e, B('2026-07-01', 7, 't', ['s'], 's')], P, 2026); assert.deepEqual([r['kind-1'], r['kind-2']], [4, 8]);
  const r2 = kontostaende([B('2026-07-01', 7, 't', ['s'], 's'), e], P, 2026); assert.deepEqual(r2, r);
});
test('Eltern im Fahrzeug: nur Eltern zaehlen', () => {
  assert.deepEqual(kontostaende([B('2026-07-01', 7, 'hp', ['t', 's'])], P, 2026), { 'eltern': 7, 'kind-1': 0, 'kind-2': 0 });
  assert.deepEqual(kontostaende([B('2026-07-01', 5, 't', ['fr'])], P, 2026), { 'eltern': 5, 'kind-1': 0, 'kind-2': 0 });
  const r = kontostaende([B('2026-07-01', 5, 'hp', ['s'])], P, 2026); assert.equal(r.eltern, 5); assert.equal(r['kind-2'], 0);
});
test('Silvester mit Teilung', () => {
  const b = B('2026-12-30', 4); assert.equal(kontostaende([b], P, 2026)['kind-1'], 1); assert.equal(kontostaende([b], P, 2027)['kind-2'], 1);
  const c = B('2026-12-29', 5), a = kontostaende([c], P, 2026), d = kontostaende([c], P, 2027);
  assert.equal(a['kind-1'] + a['kind-2'], 3); assert.equal(d['kind-1'] + d['kind-2'], 2);
});
test('Pruefung Buchung (Eigentuemer, Ausnahme, max. 4)', () => {
  const V = '2026-07-01';
  const ok = (b) => pruefeBuchung(b, P).ok;
  assert.ok(ok({ von: V, bis: V, fahrerId: 't', mitreisende: [] }));
  const aus = { name: 'X', freigabeAm: '2026-06-01', verantwortlichId: 'hp' };
  assert.ok(!ok({ von: V, bis: V, fahrerId: null, mitreisende: [], gaeste: 3, ausnahmeFahrer: aus }));
  assert.ok(ok({ von: V, bis: V, fahrerId: null, mitreisende: ['hp'], gaeste: 2, ausnahmeFahrer: aus }));
  assert.ok(!ok({ von: V, bis: V, fahrerId: 't', mitreisende: ['s'], gaeste: 3 }));
  assert.ok(ok({ von: V, bis: V, fahrerId: 't', mitreisende: ['s'], gaeste: 2 }));
  assert.ok(!ok({ von: V, bis: V, fahrerId: null, mitreisende: ['hp'], gaeste: 0 }));
  assert.ok(!ok({ von: V, bis: V, fahrerId: null, mitreisende: ['hp'], gaeste: 0, ausnahmeFahrer: { ...aus, freigabeAm: '2026-07-02' } }));
  assert.ok(!ok({ von: '2026-07-05', bis: V, fahrerId: 't', mitreisende: [] }));
  assert.ok(!ok({ von: V, bis: V, fahrerId: null, mitreisende: [], gaeste: 2 }));
});
console.log(`\n${n} Testgruppen bestanden`);
