// Tests zu den Korrekturen aus dem Audit vom 08.11.2026
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { kmZahl, datumGueltig, pruefeBuchung, kmPlausibel, kmStatistik, pruefeAlltag, vorschauBuchung } from './regeln.js';
let n = 0; const test = (name, f) => { f(); n++; console.log('OK  ', name); };
const P = { hp: { konto: 'eltern' }, fr: { konto: 'eltern' }, t: { konto: 'kind-1' }, s: { konto: 'kind-2' } };

test('Kilometer: Punkt, Komma und Buchstaben werden abgelehnt', () => {
  assert.equal(kmZahl('12450'), 12450); assert.equal(kmZahl(" 12'450 "), 12450); assert.equal(kmZahl('12 450'), 12450);
  for (const t of ['12450.5', '12450,5', '18.5', 'abc', '', '  ', '-5', '12e3', '99999999']) assert.ok(Number.isNaN(kmZahl(t)), t);
});
test('Datum: 31. Februar ist ungültig, Schaltjahr 29.2. gültig', () => {
  assert.equal(datumGueltig('2027-02-31'), false); assert.equal(datumGueltig('2027-02-29'), false);
  assert.equal(datumGueltig('2028-02-29'), true); assert.equal(datumGueltig('2027-13-01'), false); assert.equal(datumGueltig(''), false);
  assert.equal(pruefeBuchung({ von: '2027-02-31', bis: '2027-03-02', fahrerId: 'hp', mitreisende: [] }, P).ok, false);
});
test('Personen: Ausnahmefahrer zählt mit, negative Gäste abgelehnt', () => {
  const aus = { name: 'X', freigabeAm: '2027-05-01', verantwortlichId: 'hp' };
  const b = { von: '2027-06-01', bis: '2027-06-03', fahrerId: null, ausnahmeFahrer: aus, mitreisende: ['hp'], gaeste: 3 };
  assert.equal(pruefeBuchung(b, P).ok, false);                                  // 1 + 1 + 3 = 5
  assert.equal(pruefeBuchung({ ...b, gaeste: 2 }, P).ok, true);                 // 4
  assert.equal(pruefeBuchung({ von: '2027-06-01', bis: '2027-06-03', fahrerId: 'hp', mitreisende: [], gaeste: 3 }, P).ok, true);   // 4, Fahrer ist Eigentümer
  const neg = pruefeBuchung({ von: '2027-06-01', bis: '2027-06-03', fahrerId: 'hp', mitreisende: [], gaeste: -2 }, P);
  assert.equal(neg.ok, false); assert.match(neg.fehler[0], /Gäste/);
});
test('Km: Waise (gelöschte Reservierung) blockiert nicht mehr', () => {
  const B = { b2: { id: 'b2', von: '2027-08-01', bis: '2027-08-05' } };
  const U = [{ buchungId: 'b1', phase: 'ab', km: 12450 }];                     // b1 existiert nicht mehr
  assert.equal(kmPlausibel({ buchungId: 'b2', phase: 'ab', km: 12700 }, U, B).ok, true);
  assert.equal(kmStatistik(U, B, 2027).stand, 0);
  const B2 = { ...B, b1: { id: 'b1', von: '2027-07-01', bis: '2027-07-05' } };  // bestehende Reservierung: Prüfung bleibt
  assert.equal(kmPlausibel({ buchungId: 'b2', phase: 'ab', km: 100 }, U, B2).ok, false);
});
test('Alltag: 18.5 km wird abgelehnt (vorher 185)', () => {
  assert.ok(Number.isNaN(kmZahl('18.5')));
  assert.equal(pruefeAlltag({ datum: '2027-03-03', personId: 'hp', km: kmZahl('18.5') }, {}, P).ok, false);
});
test('Vorschau: Konto über Schwelle und entfallende Alltagstage', () => {
  const lang = { id: 'x', von: '2027-01-01', bis: '2027-07-31', fahrerId: 'hp', mitreisende: [] };      // 212 Tage
  const v = vorschauBuchung(lang, {}, P, {});
  assert.deepEqual(v.ueber.map((u) => [u.konto, u.jahr, u.tage, u.schwelle]), [['eltern', 2027, 212, 181]]);
  const kurz = { id: 'y', von: '2027-06-01', bis: '2027-06-05', fahrerId: 'hp', mitreisende: [] };
  const al = { a1: { datum: '2027-06-03', km: 10 } };
  const v2 = vorschauBuchung(kurz, {}, P, al);
  assert.equal(v2.ueber.length, 0); assert.deepEqual(v2.entfallen, ['2027-06-03']);
  const kind = { id: 'z', von: '2027-01-01', bis: '2027-04-15', fahrerId: 't', mitreisende: [] };          // 105 Tage > 92
  assert.equal(vorschauBuchung(kind, {}, P, {}).ueber[0].konto, 'kind-1');
  const ueberJahr = { id: 'j', von: '2027-12-30', bis: '2028-01-02', fahrerId: 'hp', mitreisende: [] };
  assert.equal(vorschauBuchung(ueberJahr, {}, P, {}).ueber.length, 0);
});
test('Version: version.json, app.js und speicher.js haben dieselbe Nummer', () => {
  const v = JSON.parse(fs.readFileSync(new URL('./version.json', import.meta.url))).v;
  for (const f of ['app.js', 'speicher.js']) {
    const t = fs.readFileSync(new URL('./' + f, import.meta.url), 'utf8');
    const treffer = [...t.matchAll(/\.js\?v=(\w+)/g)].map((m) => m[1]);
    assert.ok(treffer.length > 0, f); assert.ok(treffer.every((x) => x === v), `${f}: ${treffer} != ${v}`);
  }
});
console.log(`\n${n} Testgruppen bestanden`);
