import assert from 'node:assert/strict';
import { pruefeAlltag, alltagTage, alltagKm, kontostaendeMitAlltag, tankWarnung, rueckgabeFertig, teile, kostenAnteile, vertragsJahr, zahlplan, zahlungsSperre, terminStufe, kmPlausibel, pruefeUebergabe, kmStatistik, addTage, addJahre, chf, CHECKPUNKTE, RUECKLAGE_CHF, DARLEHEN_CHF } from './regeln.js';
const IDS = ['hp', 'fr', 't', 's'];
let n = 0; const test = (name, f) => { f(); n++; console.log('OK  ', name); };
const summe = (o) => Object.values(o).reduce((a, b) => a + b, 0);

test('Vertragstabellen stimmen mit Vertrag ueberein', () => {
  assert.equal(RUECKLAGE_CHF.reduce((a, b) => a + b, 0), 1595);          // Ziffer 5: CHF 1 595 je Eigentuemer
  assert.equal(RUECKLAGE_CHF.reduce((a, b) => a + b, 0) * 4, 6380);      // CHF 6 380 fuer alle vier
  assert.equal(DARLEHEN_CHF.reduce((a, b) => a + b, 0), 9600);           // Anhang A: Rueckzahlung CHF 9 600
});
test('teile: Rappen gehen nie verloren', () => {
  assert.deepEqual(teile(10000, IDS), { hp: 2500, fr: 2500, t: 2500, s: 2500 });
  assert.deepEqual(teile(10001, IDS, 0), { hp: 2501, fr: 2500, t: 2500, s: 2500 });
  assert.deepEqual(teile(10001, IDS, 2), { hp: 2500, fr: 2500, t: 2501, s: 2500 });
  assert.deepEqual(teile(10003, IDS, 3), { hp: 2501, fr: 2501, t: 2500, s: 2501 });   // Rest ab Position 3: s, hp, fr
  for (let b = 1; b < 200; b++) for (let s = 0; s < 4; s++) assert.equal(summe(teile(b, IDS, s)), b);
});
test('Laufende Kosten: je ein Viertel', () => {
  const r = kostenAnteile([{ datum: '2026-03-01', betrag: 40000, art: 'betrieb' }], [], IDS, 2026);
  assert.deepEqual(r.anteil, { hp: 10000, fr: 10000, t: 10000, s: 10000 }); assert.equal(r.total, 40000);
});
test('Ruecklage zahlt zuerst, Rest wird geviertelt', () => {
  const ein = IDS.map((i) => ({ datum: '2026-01-15', betrag: 10000, zweck: 'ruecklage', personId: i }));      // Pool 400.00
  const kost = [{ datum: '2026-03-01', betrag: 30000, art: 'ruecklage' }, { datum: '2026-06-01', betrag: 50000, art: 'ruecklage' }];
  const r = kostenAnteile(kost, ein, IDS, 2026);
  assert.equal(r.ausRuecklage, 40000);                                  // 300 + 100 aus der Ruecklage
  assert.deepEqual(r.anteil, { hp: 10000, fr: 10000, t: 10000, s: 10000 });  // Rest 400.00 geviertelt
  assert.equal(r.ruecklagePool, 0); assert.equal(r.total, 80000);
});
test('Ruecklage reicht: niemand zahlt extra', () => {
  const ein = IDS.map((i) => ({ datum: '2026-01-15', betrag: 10000, zweck: 'ruecklage', personId: i }));
  const r = kostenAnteile([{ datum: '2026-03-01', betrag: 30000, art: 'ruecklage' }], ein, IDS, 2026);
  assert.deepEqual(r.anteil, { hp: 0, fr: 0, t: 0, s: 0 }); assert.equal(r.ruecklagePool, 10000);
});
test('Selbstbehalt: Verursacher allein', () => {
  const r = kostenAnteile([{ datum: '2026-05-01', betrag: 100000, art: 'selbstbehalt', verursacherId: 't' }], [], IDS, 2026);
  assert.deepEqual(r.anteil, { hp: 0, fr: 0, t: 100000, s: 0 });
});
test('Bonusverlust: Verursacher 5/8, die anderen je 1/8', () => {
  const r = kostenAnteile([{ datum: '2026-05-01', betrag: 80000, art: 'praemie', verursacherId: 's' }], [], IDS, 2026);
  assert.deepEqual(r.anteil, { hp: 10000, fr: 10000, t: 10000, s: 50000 });
  const r2 = kostenAnteile([{ datum: '2026-05-01', betrag: 80001, art: 'praemie', verursacherId: 's' }], [], IDS, 2026);
  assert.equal(summe(r2.anteil), 80001);
});
test('Kosten aus anderem Jahr zaehlen nicht, der Pool schon', () => {
  const ein = [{ datum: '2025-12-01', betrag: 20000, zweck: 'ruecklage', personId: 'hp' }];
  const kost = [{ datum: '2025-12-15', betrag: 5000, art: 'ruecklage' }, { datum: '2026-02-01', betrag: 20000, art: 'ruecklage' }];
  const r = kostenAnteile(kost, ein, IDS, 2026);
  assert.equal(r.total, 20000); assert.equal(r.ausRuecklage, 15000);             // Pool 200 - 50 = 150 gedeckt
  assert.equal(summe(r.anteil), 5000);                                           // Rest 50.00
});
test('Vertragsjahr ab Uebergabedatum', () => {
  const s = '2026-06-15';
  assert.equal(vertragsJahr(s, '2026-06-14'), null); assert.equal(vertragsJahr(s, '2026-06-15'), 1);
  assert.equal(vertragsJahr(s, '2027-06-14'), 1); assert.equal(vertragsJahr(s, '2027-06-15'), 2);
  assert.equal(vertragsJahr(s, '2034-06-14'), 8); assert.equal(vertragsJahr(s, '2034-06-15'), 9);
  assert.equal(vertragsJahr('', '2026-06-15'), null);
});
test('Zahlplan: Soll aus Vertrag, Ist aus Einzahlungen im Vertragsjahr', () => {
  const ein = [{ datum: '2027-06-20', betrag: 30000, zweck: 'darlehen', personId: 't' }, { datum: '2027-06-10', betrag: 36000, zweck: 'darlehen', personId: 't' }];
  const kind = zahlplan('2026-06-15', '2027-07-01', ein, { konto: 'kind-1' }, 't');
  assert.equal(kind.jahr, 2);
  assert.deepEqual(kind.posten, [{ zweck: 'ruecklage', soll: 12000, ist: 0, offen: 12000 }, { zweck: 'darlehen', soll: 60000, ist: 30000, offen: 30000 }]);
  const eltern = zahlplan('2026-06-15', '2027-07-01', [], { konto: 'eltern' }, 'hp');
  assert.deepEqual(eltern.posten, [{ zweck: 'ruecklage', soll: 12000, ist: 0, offen: 12000 }]);
  assert.equal(zahlplan('2026-06-15', '2035-01-01', [], { konto: 'eltern' }, 'hp').posten, undefined);
});
test('Zahlungsverzug: 10 Tage Frist, danach Nutzungsverbot', () => {
  const st = { status: 'erinnert', erinnertAm: '2026-11-01' };
  assert.deepEqual(zahlungsSperre(st, '2026-11-11'), { stufe: 'erinnert', frist: '2026-11-11' });
  assert.deepEqual(zahlungsSperre(st, '2026-11-12'), { stufe: 'gesperrt', ab: '2026-11-12' });
  assert.deepEqual(zahlungsSperre({ status: 'ok' }, '2026-11-12'), { stufe: 'ok' });
  assert.deepEqual(zahlungsSperre(undefined, '2026-11-12'), { stufe: 'ok' });
  assert.equal(addTage('2026-12-25', 10), '2027-01-04'); assert.equal(addJahre('2028-02-29', 1), '2029-03-01');
});
test('Termine: ueberfaellig, bald, offen, erledigt', () => {
  const h = '2026-11-07';
  assert.equal(terminStufe({ faelligAm: '2026-11-06' }, h), 'ueberfaellig');
  assert.equal(terminStufe({ faelligAm: '2026-11-07' }, h), 'bald');
  assert.equal(terminStufe({ faelligAm: '2026-12-07' }, h), 'bald');
  assert.equal(terminStufe({ faelligAm: '2026-12-08' }, h), 'offen');
  assert.equal(terminStufe({ faelligAm: '2026-01-01', erledigtAm: '2026-01-02' }, h), 'erledigt');
});
const alleJa = Object.fromEntries(CHECKPUNKTE.map(([k]) => [k, 'ja']));
const B = { b1: { von: '2026-07-01' }, b2: { von: '2026-08-01' }, b0: { von: '2025-05-01' } };
const U = [{ buchungId: 'b1', phase: 'ab', km: 1000 }, { buchungId: 'b1', phase: 'rueck', km: 1450 }, { buchungId: 'b2', phase: 'ab', km: 1450 }, { buchungId: 'b2', phase: 'rueck', km: 1900 }, { buchungId: 'b0', phase: 'ab', km: 100 }, { buchungId: 'b0', phase: 'rueck', km: 600 }];
test('Kilometer: Statistik', () => {
  const s = kmStatistik(U, B, 2026);
  assert.equal(s.stand, 1900); assert.equal(s.jahr, 900); assert.deepEqual(s.proBuchung, { b1: 450, b2: 450, b0: 500 });
  assert.equal(kmStatistik(U, B, 2025).jahr, 500);
});
test('Kilometer: Plausibilitaet', () => {
  assert.equal(kmPlausibel({ buchungId: 'b2', phase: 'ab', km: 1400 }, U, B).ok, false);       // tiefer als Rueckgabe b1 (1450)
  assert.equal(kmPlausibel({ buchungId: 'b2', phase: 'ab', km: 1460 }, U, B).ok, true);
  assert.equal(kmPlausibel({ buchungId: 'b1', phase: 'rueck', km: 1500 }, U, B).ok, false);    // hoeher als spaeterer Stand b2 ab (1450)
  assert.equal(kmPlausibel({ buchungId: 'b3', phase: 'ab', km: 2000 }, [...U, ], { ...B, b3: { von: '2026-09-01' } }).ok, true);
});
test('Uebergabe-Pruefung', () => {
  const ok = { buchungId: 'b3', phase: 'ab', datumZeit: '2026-09-01T10:00', km: 1950, tank: 'voll', punkte: alleJa, bemerkung: '' };
  const B3 = { ...B, b3: { von: '2026-09-01' } };
  assert.equal(pruefeUebergabe(ok, U, B3).ok, true);
  assert.equal(pruefeUebergabe({ ...ok, tank: '' }, U, B3).ok, false);
  assert.equal(pruefeUebergabe({ ...ok, tank: '5/6' }, U, B3).ok, false);
  assert.equal(pruefeUebergabe({ ...ok, tank: 'Reserve' }, U, B3).ok, false);
  assert.equal(pruefeUebergabe({ ...ok, tank: '3/4' }, U, B3).ok, false);                        // Tank nicht voll: gesperrt (Ziffer 10)
  assert.equal(pruefeUebergabe({ ...ok, phase: 'rueck', tank: '1/2' }, U, B3).ok, false);
  assert.equal(pruefeUebergabe({ ...ok, phase: 'rueck' }, U, B3).ok, false);                       // Rueckgabe ohne Schluessel: nicht abschliessbar
  assert.equal(pruefeUebergabe({ ...ok, phase: 'rueck', schluessel: 'nein' }, U, B3).ok, false);
  assert.equal(pruefeUebergabe({ ...ok, phase: 'rueck', schluessel: 'ja' }, U, B3).ok, true);
  assert.equal(pruefeUebergabe({ ...ok, phase: 'ab' }, U, B3).ok, true);                           // Uebergabe braucht keinen Schluessel
  assert.ok(CHECKPUNKTE.some(([k]) => k === 'kuehlschrank'));
  assert.ok(pruefeUebergabe({ ...ok, phase: 'rueck', schluessel: 'nein' }, U, B3).fehler.some((f) => f.includes('Papà ti sta guardando. 😉')));
  assert.equal(rueckgabeFertig({ schluessel: 'ja' }), true); assert.equal(rueckgabeFertig({}), false); assert.equal(rueckgabeFertig(undefined), false);
  assert.equal(pruefeUebergabe({ ...ok, km: -5 }, U, B3).ok, false);
  assert.equal(pruefeUebergabe({ ...ok, km: 1500 }, U, B3).ok, false);                           // tiefer als bekannter Stand
  assert.equal(pruefeUebergabe({ ...ok, punkte: { ...alleJa, gas: undefined } }, U, B3).ok, false); // Punkt offen
  assert.equal(pruefeUebergabe({ ...ok, punkte: { ...alleJa, gas: 'nein' } }, U, B3).ok, false);   // Nein ohne Bemerkung
  assert.equal(pruefeUebergabe({ ...ok, punkte: { ...alleJa, gas: 'nein' }, bemerkung: 'Gasflasche leer' }, U, B3).ok, true);
});
test('Franken-Anzeige', () => { assert.equal(chf(5), '0.05'); assert.ok(chf(123456).endsWith('.56')); assert.equal(chf(100000).replace(/\D/g, ''), '100000'); });
console.log(`\n${n} Testgruppen bestanden`);

// ---- Sperre gegen Doppelbelegung und Tagesliste ----
import { ueberschneidungen, tageListe, pruefeBuchung, MAX_TAGE } from './regeln.js';
{
  let m = 0; const t2 = (name, f) => { f(); m++; console.log('OK  ', name); };
  const bk = (id, von, bis) => ({ id, von, bis });
  const BS = [bk('a', '2027-03-05', '2027-03-14'), bk('b', '2027-06-04', '2027-06-13')];
  t2('Ueberschneidung: gleiche Tage werden erkannt', () => {
    assert.equal(ueberschneidungen(bk('n', '2027-03-05', '2027-03-14'), BS).length, 1);   // gleicher Bereich
    assert.equal(ueberschneidungen(bk('n', '2027-03-01', '2027-03-05'), BS).length, 1);   // trifft den Abreisetag
    assert.equal(ueberschneidungen(bk('n', '2027-03-14', '2027-03-20'), BS).length, 1);   // trifft den Rueckkehrtag
    assert.equal(ueberschneidungen(bk('n', '2027-03-08', '2027-03-09'), BS).length, 1);   // mitten drin
    assert.equal(ueberschneidungen(bk('n', '2027-03-01', '2027-06-30'), BS).length, 2);   // umschliesst beide
  });
  t2('Ueberschneidung: freie Tage sind frei', () => {
    assert.equal(ueberschneidungen(bk('n', '2027-03-15', '2027-06-03'), BS).length, 0);   // genau dazwischen
    assert.equal(ueberschneidungen(bk('n', '2027-03-01', '2027-03-04'), BS).length, 0);
    assert.equal(ueberschneidungen(bk('n', '2027-06-14', '2027-06-20'), BS).length, 0);
  });
  t2('Aendern: die eigene Reservierung blockiert sich nicht selbst', () => {
    assert.equal(ueberschneidungen(bk('a', '2027-03-06', '2027-03-12'), BS).length, 0);   // verkuerzen
    assert.equal(ueberschneidungen(bk('a', '2027-03-03', '2027-03-16'), BS).length, 0);   // verlaengern
    assert.equal(ueberschneidungen(bk('a', '2027-06-10', '2027-06-12'), BS).length, 1);   // auf Belegtes verschieben
  });
  t2('Tagesliste: inklusive, Monats- und Jahreswechsel, Schaltjahr', () => {
    assert.deepEqual(tageListe('2026-07-01', '2026-07-01'), ['2026-07-01']);
    assert.deepEqual(tageListe('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    assert.deepEqual(tageListe('2028-02-28', '2028-03-01'), ['2028-02-28', '2028-02-29', '2028-03-01']);
    assert.equal(tageListe('2027-03-05', '2027-03-14').length, 10);
  });
  t2('Maximale Dauer wegen der Tagessperre', () => {
    const P = { hp: { konto: 'eltern' } };
    assert.equal(pruefeBuchung({ von: '2026-01-01', bis: '2026-10-27', fahrerId: 'hp', mitreisende: [] }, P).ok, true);   // 300 Tage
    assert.equal(pruefeBuchung({ von: '2026-01-01', bis: '2026-10-28', fahrerId: 'hp', mitreisende: [] }, P).ok, false);  // 301 Tage
    assert.equal(MAX_TAGE, 300);
  });
  console.log(`\n${m} weitere Testgruppen bestanden`);
}
