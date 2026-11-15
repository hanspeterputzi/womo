import assert from 'node:assert/strict';
import { ZUBEHOER_KATALOG, ZUBEHOER_GRUPPEN, ZUBEHOER_RAENGE, pruefeZubehoer, zubehoerListe, neuZaehlen } from './regeln.js';
let n = 0; const test = (name, f) => { f(); n++; console.log('OK  ', name); };
test('Katalog: eindeutige Ids, gueltiger Rang, Name und Gruppe gesetzt', () => {
  const ids = ZUBEHOER_KATALOG.map((x) => x[0]); assert.equal(new Set(ids).size, ids.length);
  for (const [, g, r, t] of ZUBEHOER_KATALOG) { assert.ok(ZUBEHOER_RAENGE.includes(r)); assert.ok(g && t && t.length <= 80); }
  assert.ok(ZUBEHOER_GRUPPEN.length >= 8);
});
test('Katalog: nichts, was das Fahrzeug schon hat', () => {
  const txt = ZUBEHOER_KATALOG.map((x) => x[3].toLowerCase()).join('|');
  for (const w of ['fahrradträger', 'markise', 'rückfahrkamera', 'auffahrkeil', 'wasserwaage', 'zweitbatterie']) assert.ok(!txt.includes(w), w);
});
test('Katalog: keine Preise, keine Namen im Text (Repository ist oeffentlich)', () => {
  const alles = JSON.stringify(ZUBEHOER_KATALOG);
  assert.ok(!/CHF|€|Fr\./.test(alles)); assert.ok(!/Putzi|Melzer|Nora|Nanouk|Nene/.test(alles));
});
test('Liste: ohne Eintraege ist nichts vorhanden', () => {
  const l = zubehoerListe({}); assert.equal(l.length, ZUBEHOER_KATALOG.length); assert.ok(l.every((x) => !x.haben && !x.eigen));
});
test('Liste: Haben-Markierung und eigene Eintraege', () => {
  const t = {
    zb_z001: { id: 'zb_z001', art: 'Zubehoer', typ: 'haben', katId: 'z001', haben: true },
    zb_z002: { id: 'zb_z002', art: 'Zubehoer', typ: 'haben', katId: 'z002', haben: false },
    e1: { id: 'e1', art: 'Zubehoer', typ: 'eigen', titel: 'Wäscheständer', gruppe: 'Sauberkeit und Hygiene', rang: 'B', notiz: 'klappbar', erfasstVon: 'fr' },
    zb_e1: { id: 'zb_e1', art: 'Zubehoer', typ: 'haben', katId: 'e1', haben: true },
    x: { id: 'x', art: 'MFK', titel: 'MFK' },
  };
  const l = zubehoerListe(t);
  assert.equal(l.find((x) => x.id === 'z001').haben, true); assert.equal(l.find((x) => x.id === 'z002').haben, false);
  const e = l.find((x) => x.id === 'e1'); assert.ok(e.eigen && e.haben && e.hinweis === 'klappbar'); assert.equal(l.length, ZUBEHOER_KATALOG.length + 1);
});
test('Pruefung: Name, Rang, Gruppe, Laengen', () => {
  const ok = { titel: 'Test', gruppe: 'Küche und Essen', rang: 'A', notiz: '' };
  assert.ok(pruefeZubehoer(ok).ok);
  assert.ok(!pruefeZubehoer({ ...ok, titel: '  ' }).ok); assert.ok(!pruefeZubehoer({ ...ok, titel: 'x'.repeat(81) }).ok);
  assert.ok(!pruefeZubehoer({ ...ok, rang: 'D' }).ok); assert.ok(!pruefeZubehoer({ ...ok, gruppe: '' }).ok);
  assert.ok(!pruefeZubehoer({ ...ok, gruppe: 'g'.repeat(41) }).ok); assert.ok(!pruefeZubehoer({ ...ok, notiz: 'n'.repeat(201) }).ok);
});
console.log(n + ' Tests bestanden');
import { zubehoerGeloescht } from './regeln.js';
{
  const t = { zb_z003: { id: 'zb_z003', art: 'Zubehoer', typ: 'haben', katId: 'z003', haben: false, weg: true }, zb_z004: { id: 'zb_z004', art: 'Zubehoer', typ: 'haben', katId: 'z004', haben: true, weg: true } };
  const l = zubehoerListe(t), g = zubehoerGeloescht(t);
  assert.equal(l.length, ZUBEHOER_KATALOG.length - 2); assert.ok(!l.some((x) => x.id === 'z003' || x.id === 'z004'));
  assert.deepEqual(g.map((x) => x.id).sort(), ['z003', 'z004']);
  const t2 = { ...t, zb_z003: { ...t.zb_z003, weg: false } };
  assert.equal(zubehoerListe(t2).length, ZUBEHOER_KATALOG.length - 1); assert.deepEqual(zubehoerGeloescht(t2).map((x) => x.id), ['z004']);
  assert.equal(zubehoerGeloescht({}).length, 0);
  console.log('OK   Loeschen und Wiederherstellen von Katalogeintraegen');
}
