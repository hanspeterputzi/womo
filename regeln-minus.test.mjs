import assert from 'node:assert/strict';
import { pruefeMinus, minusImZeitraum, minusFuerReservierung, minusAmTag, kontostaende } from './regeln.js';
let n = 0; const test = (name, f) => { f(); n++; console.log('OK  ', name); };
const P = { hp: { konto: 'eltern' }, fr: { konto: 'eltern' }, t: { konto: 'kind-1' }, s: { konto: 'kind-2' } };
const M = [
  { id: 'm1', personId: 't', von: '2027-05-15', bis: '2027-05-16' },   // Sa, So
  { id: 'm2', personId: 's', von: '2027-05-16', bis: '2027-05-16' },
  { id: 'm3', personId: 'hp', von: '2027-06-05', bis: '2027-06-06' },
];
test('Pruefung: gueltig, Ende vor Beginn, ungueltiges Datum, Person fehlt, zu lang, Grund zu lang', () => {
  assert.equal(pruefeMinus({ personId: 't', von: '2027-05-15', bis: '2027-05-16' }, P).ok, true);
  assert.equal(pruefeMinus({ personId: 't', von: '2027-05-15', bis: '2027-05-15' }, P).ok, true);   // ein Tag
  assert.equal(pruefeMinus({ personId: 't', von: '2027-05-16', bis: '2027-05-15' }, P).ok, false);
  assert.equal(pruefeMinus({ personId: 't', von: '2027-02-30', bis: '2027-03-01' }, P).ok, false);
  assert.equal(pruefeMinus({ personId: 't', von: '', bis: '' }, P).ok, false);
  assert.equal(pruefeMinus({ personId: 'x', von: '2027-05-15', bis: '2027-05-16' }, P).ok, false);
  assert.equal(pruefeMinus({ personId: 't', von: '2027-01-01', bis: '2028-06-01' }, P).ok, false);
  assert.equal(pruefeMinus({ personId: 't', von: '2027-05-15', bis: '2027-05-16', grund: 'x'.repeat(81) }, P).ok, false);
});
test('Ueberschneidung: Rand zaehlt, daneben nicht', () => {
  assert.equal(minusImZeitraum(M, '2027-05-16', '2027-05-20').length, 2);
  assert.equal(minusImZeitraum(M, '2027-05-17', '2027-05-20').length, 0);
  assert.equal(minusImZeitraum(M, '2027-05-10', '2027-05-15').length, 1);
});
test('Reservierung: eigenes Minus = Warnung, fremdes = Info', () => {
  const r = minusFuerReservierung(M, { von: '2027-05-14', bis: '2027-05-17', fahrerId: 't', mitreisende: [] });
  assert.deepEqual(r.warnung.map((m) => m.id), ['m1']);
  assert.deepEqual(r.info.map((m) => m.id), ['m2']);
});
test('Reservierung: Mitreisende mit Minus warnen auch, ohne Treffer nichts', () => {
  const r = minusFuerReservierung(M, { von: '2027-05-16', bis: '2027-05-16', fahrerId: 'hp', mitreisende: ['s'] });
  assert.deepEqual(r.warnung.map((m) => m.id), ['m2']); assert.deepEqual(r.info.map((m) => m.id), ['m1']);
  const k = minusFuerReservierung(M, { von: '2027-07-01', bis: '2027-07-10', fahrerId: 't', mitreisende: [] });
  assert.equal(k.warnung.length + k.info.length, 0);
});
test('Pro Tag: Personen ohne Doppelte', () => {
  assert.deepEqual(minusAmTag(M, '2027-05-16').sort(), ['s', 't']);
  assert.deepEqual(minusAmTag([...M, { personId: 't', von: '2027-05-16', bis: '2027-05-16' }], '2027-05-16').sort(), ['s', 't']);
  assert.deepEqual(minusAmTag(M, '2027-05-17'), []);
});
test('Tageskonto bleibt unberuehrt (Minus ist keine Buchung)', () => {
  const k = kontostaende([], P, 2027); assert.equal(k.eltern + k['kind-1'] + k['kind-2'], 0);
});
console.log(`${n} Pruefungen bestanden`);
