// Womo-Reservierung: Regelfunktionen (Stand 07.11.2026)
// Reine Berechnung ohne Datenbank. Laeuft im Browser und in Node.
// Grundlage: womo-datenmodell-entwurf.md. Zahlen kommen nur aus der Berechnung.

export const SCHWELLE = { 'eltern': 181, 'kind-1': 92, 'kind-2': 92 };
export const MAX_PERSONEN = 4;

const MS_TAG = 86400000;
const tagNr = (iso) => {
  const [j, m, t] = iso.split('-').map(Number);
  return Date.UTC(j, m - 1, t) / MS_TAG;
};

// Echtes Kalenderdatum (JJJJ-MM-TT)? «2027-02-31» ist kein Datum.
export function datumGueltig(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return false;
  return new Date(tagNr(iso) * MS_TAG).toISOString().slice(0, 10) === iso;
}

// Kilometer aus Text: nur Ziffern, Leerzeichen und Apostroph (12'450). Punkt, Komma und Buchstaben gelten als Fehler (NaN).
export function kmZahl(txt) {
  const t = String(txt ?? '').trim().replace(/['’\s]/g, '');
  return /^\d{1,7}$/.test(t) ? parseInt(t, 10) : NaN;
}

// Gesamtdauer einer Buchung in Tagen (beide Randtage zaehlen).
export const dauer = (b) => tagNr(b.bis) - tagNr(b.von) + 1;

// Tage einer Buchung im Jahr J (beide Randtage zaehlen voll).
export function tage(b, J) {
  const von = Math.max(tagNr(b.von), tagNr(`${J}-01-01`));
  const bis = Math.min(tagNr(b.bis), tagNr(`${J}-12-31`));
  return Math.max(0, bis - von + 1);
}

// Eigentuemer im Fahrzeug (Fahrer und Mitreisende). personen: { id: {konto} }
function eigentuemer(b, personen) {
  const ids = [b.fahrerId, ...(b.mitreisende || [])].filter((i) => i && personen[i]);
  return [...new Set(ids)];
}

// Welche Konten zaehlen: sitzt ein Elternteil im Fahrzeug, nur 'eltern'.
export function konten(b, personen) {
  const k = eigentuemer(b, personen).map((i) => personen[i].konto);
  if (k.includes('eltern')) return ['eltern'];
  return [...new Set(k)].sort();
}

// Kontostaende pro Konto im Jahr J, mit Teilungsregel fuer beide Kinder allein (halbe Tage moeglich).
export function kontostaende(buchungen, personen, J) {
  const r = { 'eltern': 0, 'kind-1': 0, 'kind-2': 0 };
  const sortiert = [...buchungen].sort((a, b) =>
    a.von < b.von ? -1 : a.von > b.von ? 1 : (a.erfasstAm || '') < (b.erfasstAm || '') ? -1 : (a.erfasstAm || '') > (b.erfasstAm || '') ? 1 : 0);
  for (const b of sortiert) {
    const t = tage(b, J);
    if (t === 0) continue;
    const ks = konten(b, personen);
    if (ks.length === 1) { r[ks[0]] += t; continue; }
    if (ks.length === 0) continue;
    // Beide Kinder allein: jedes Kind traegt die Haelfte, ein ungerader Tag zaehlt je einen halben Tag (7 Tage = 3.5 + 3.5).
    r['kind-1'] += t / 2; r['kind-2'] += t / 2;
  }
  return r;
}

// Warnstufe: gelb ab 90 % der Schwelle, rot darueber. Nur Anzeige.
export function stufe(tageImJahr, konto, schwelle) {
  const s = schwelle !== undefined ? schwelle : SCHWELLE[konto];
  return tageImJahr > s ? 'rot' : tageImJahr >= 0.9 * s ? 'gelb' : 'ok';
}

// Kollision: Bereiche ueberschneiden sich, Randtage inklusive. Nur Anzeige.
export function kollision(a, b) {
  return a.von <= b.bis && b.von <= a.bis;
}

// Eine Reservierung darf nie ueber ein Datum laufen, das schon belegt ist (beide Randtage zaehlen).
// Rueckgabe: die bereits vorhandenen Reservierungen, die sich mit b ueberschneiden (ohne b selbst).
export function ueberschneidungen(b, buchungen) {
  return buchungen.filter((x) => x.id !== b.id && kollision(x, b));
}

// Alle Tage von bis (inklusive) als Datumstexte. Grundlage der Tagessperre in der Datenbank.
export const MAX_TAGE = 300;   // technische Grenze: eine Reservierung belegt pro Tag ein Sperr-Dokument
export function tageListe(von, bis) {
  const out = [];
  for (let n = tagNr(von); n <= tagNr(bis); n++) out.push(new Date(n * MS_TAG).toISOString().slice(0, 10));
  return out;
}

// Pruefung vor dem Speichern. Liefert { ok, fehler: [Text] }.
export function pruefeBuchung(b, personen) {
  const fehler = [];
  if (!datumGueltig(b.von) || !datumGueltig(b.bis)) fehler.push('Datum fehlt oder ist kein gültiges Datum.');
  else if (b.von > b.bis) fehler.push('Die Rückkehr liegt vor der Abreise.');
  else if (dauer(b) > MAX_TAGE) fehler.push(`Eine Reservierung darf höchstens ${MAX_TAGE} Tage dauern.`);
  const eig = eigentuemer(b, personen);
  if (eig.length === 0) fehler.push('Mindestens ein Eigentümer muss im Fahrzeug sitzen.');
  if (!b.fahrerId) {
    const a = b.ausnahmeFahrer;
    if (!(a && a.name && a.freigabeAm && a.freigabeAm < b.von && personen[a.verantwortlichId]))
      fehler.push('Ohne Eigentümer als Fahrer braucht es die Freigabe des Familienrats vor der Reise und einen verantwortlichen Eigentümer.');
  }
  const gaeste = b.gaeste ?? 0;
  if (!Number.isInteger(gaeste) || gaeste < 0) fehler.push('Die Zahl der Gäste muss 0 oder mehr sein.');
  else if (eig.length + (b.fahrerId ? 0 : 1) + gaeste > MAX_PERSONEN) fehler.push('Mehr als 4 Personen im Fahrzeug (ein Ausnahmefahrer zählt mit).');
  return { ok: fehler.length === 0, fehler };
}

// =====================================================================
// Version 2: Uebergabe-Checkliste und Kilometerstand
// =====================================================================
export const TANK = ['Reserve', '1/6', '1/3', '1/2', '2/3', '5/6', 'voll'];
export const CHECKPUNKTE = [
  ['innen', 'Innenraum sauber, kein Geruch, nicht geraucht'],
  ['kuehlschrank', 'Kühlschrank geleert und geputzt'],
  ['aussen', 'Aussen sauber, keine neuen Kratzer oder Dellen'],
  ['wasser', 'Frischwasser- und Abwassertank geleert'],
  ['gas', 'Gasflasche und Gasanlage in Ordnung'],
  ['toilette', 'Toilette geleert'],
  ['batterie', 'Wohnraumbatterie geladen, Strom in Ordnung'],
  ['dach', 'Aufstelldach: Dach und Stoffwand (Balg) dicht, trocken, sauber'],
  ['markise', 'Markise eingerollt, trocken'],
  ['traeger', 'Veloträger und Anhängerkupplung in Ordnung'],
  ['reifen', 'Reifen, Reifendruck, Ersatzrad oder Pannenset'],
  ['unterlagen', 'Unterlagen: Fahrzeugausweis, Versicherungsnachweis, Schutzbrief'],
  ['zubehoer', 'Zubehör vollständig (Stützen, Keile, Kabel, Schlauch)'],
];

// Kilometerstand muss zwischen den Staenden der Nachbar-Eintraege liegen (Reihenfolge nach Abreisetag, ab vor rueck).
export function kmPlausibel(neu, uebergaben, buchungen) {
  const key = (u) => { const b = buchungen[u.buchungId]; return (b ? b.von : '9999-99-99') + (u.phase === 'ab' ? '0' : '1'); };
  const mein = key(neu);
  let vor = 0, nach = Infinity;
  for (const u of uebergaben) {
    if (u.buchungId === neu.buchungId && u.phase === neu.phase) continue;
    if (!buchungen[u.buchungId]) continue;   // Waise: Reservierung wurde gelöscht
    const k = key(u);
    if (k < mein) vor = Math.max(vor, u.km); else if (k > mein) nach = Math.min(nach, u.km);
  }
  if (neu.km < vor) return { ok: false, text: `Der Kilometerstand ist tiefer als der letzte bekannte Stand (${vor} km).` };
  if (neu.km > nach) return { ok: false, text: `Der Kilometerstand ist höher als ein späterer Stand (${nach} km).` };
  return { ok: true };
}

// Pruefung vor dem Speichern einer Uebergabe oder Rueckgabe.
export function pruefeUebergabe(u, uebergaben, buchungen) {
  const fehler = [];
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(u.datumZeit || '')) fehler.push('Datum und Uhrzeit fehlen.');
  if (!Number.isInteger(u.km) || u.km < 0 || u.km > 999999) fehler.push('Kilometerstand fehlt oder ist ungültig.');
  if (!TANK.includes(u.tank)) fehler.push('Tankstand fehlt.');
  else if (u.tank !== 'voll' && !(u.bemerkung || '').trim()) fehler.push('Der Tank ist nicht voll. Der Vertrag (Ziffer 10) verlangt immer einen vollen Tank. Bitte zuerst volltanken, oder in der Bemerkung erklären, warum nicht.');
  const offen = CHECKPUNKTE.filter(([k]) => u.punkte?.[k] !== 'ja' && u.punkte?.[k] !== 'nein');
  if (offen.length) fehler.push(`Bitte bei jedem Punkt Ja oder Nein wählen (noch offen: ${offen.length}).`);
  const nein = CHECKPUNKTE.filter(([k]) => u.punkte?.[k] === 'nein');
  if (nein.length && !(u.bemerkung || '').trim()) fehler.push('Bei Nein bitte den Mangel in der Bemerkung beschreiben.');
  if (u.phase === 'rueck' && u.schluessel !== 'ja') fehler.push('Per favore, prima appendi la chiave alla bacheca delle chiavi. Papà ti sta guardando. 😉');
  if (Number.isInteger(u.km) && u.km >= 0) { const p = kmPlausibel(u, uebergaben, buchungen); if (!p.ok) fehler.push(p.text); }
  return { ok: fehler.length === 0, fehler };
}

// Statistik: aktueller Stand, gefahrene km je Reise, km im Jahr (Zuordnung nach Abreisetag).
export function kmStatistik(uebergaben, buchungen, J) {
  const proBuchung = {};
  let stand = 0;
  uebergaben = uebergaben.filter((u) => buchungen[u.buchungId]);   // Waisen (gelöschte Reservierung) zählen nicht
  for (const u of uebergaben) stand = Math.max(stand, u.km);
  const ab = {}, rueck = {};
  for (const u of uebergaben) (u.phase === 'ab' ? ab : rueck)[u.buchungId] = u.km;
  let jahr = 0;
  for (const id of Object.keys(ab)) {
    if (rueck[id] === undefined) continue;
    const km = rueck[id] - ab[id];
    proBuchung[id] = km;
    if (buchungen[id] && buchungen[id].von.slice(0, 4) === String(J)) jahr += km;
  }
  return { stand, proBuchung, jahr };
}

// =====================================================================
// Version 3: Kosten, Rücklage, Zahlungsstatus (Betraege in Rappen, ganze Zahlen)
// =====================================================================
export const RUECKLAGE_CHF = [100, 120, 150, 180, 220, 250, 275, 300];          // Vertrag Ziffer 5, je Eigentuemer
export const DARLEHEN_CHF = [360, 600, 840, 1080, 1320, 1560, 1800, 2040];     // Anhang A, nur Tochter und Sohn, gilt unabhaengig von den tatsaechlichen Anschaffungskosten (Rueckzahlung je CHF 9 600)
export const ANSCHAFFUNG_MAX_CHF = 60000;                                        // Richtwert der Anschaffung (Vertrag Ziffer 3), darueber braucht es das Einverstaendnis aller
export const FRIST_TAGE = 10;                                                    // Vertrag Ziffer 4, Zahlungsverzug
export const KOSTENARTEN = {
  betrieb: 'Laufende Kosten (Versicherung, Steuer, Vignette, Konto, Verbrauchsmaterial, Einrichtung)',
  ruecklage: 'Reparatur, Reifen, grosser Service (zuerst aus der Rücklage)',
  selbstbehalt: 'Selbstbehalt nach Schaden (Verursacher)',
  praemie: 'Bonusverlust und höhere Prämie nach Schaden',
};
export const ZWECKE = { betrieb: 'Laufende Kosten', ruecklage: 'Rücklage', darlehen: 'Darlehensrate', anschaffung: 'Anschaffung', sonst: 'Anderes' };
export const TERMINARTEN = ['MFK', 'Service', 'Reifenwechsel', 'Winterlager', 'Vignette', 'Versicherung', 'Sonstiges'];

const dNr = (iso) => { const [j, m, t] = iso.split('-').map(Number); return Date.UTC(j, m - 1, t) / MS_TAG; };
const nrIso = (n) => new Date(n * MS_TAG).toISOString().slice(0, 10);
export const addTage = (iso, n) => nrIso(dNr(iso) + n);
export const addJahre = (iso, n) => { const [j, m, t] = iso.split('-').map(Number); return new Date(Date.UTC(j + n, m - 1, t)).toISOString().slice(0, 10); };

// Betrag gleichmaessig auf ids verteilen, der Rest (Rappen) rotiert ab Position start.
export function teile(total, ids, start = 0) {
  const n = ids.length, base = Math.floor(total / n), rest = total - base * n, r = {};
  ids.forEach((id, i) => { r[id] = base + ((((i - start) % n) + n) % n < rest ? 1 : 0); });
  return r;
}

// Anteile je Person fuer Kosten im Jahr J. Die Ruecklage zahlt Reparaturen zuerst (Vertrag Ziffer 5), nur der Rest wird geviertelt.
export function kostenAnteile(kosten, einzahlungen, ids, J) {
  const ereignisse = [
    ...einzahlungen.filter((e) => e.zweck === 'ruecklage').map((e) => ({ t: 'ein', datum: e.datum, betrag: e.betrag })),
    ...kosten.map((k) => ({ t: 'kost', datum: k.datum, k })),
  ].sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.t === b.t ? 0 : a.t === 'ein' ? -1 : 1));
  const anteil = Object.fromEntries(ids.map((i) => [i, 0]));
  let pool = 0, lauf = 0, ausRuecklage = 0, total = 0;
  for (const e of ereignisse) {
    if (e.t === 'ein') { pool += e.betrag; continue; }
    const k = e.k, imJahr = k.datum.slice(0, 4) === String(J), nr = lauf++;
    let teil = null;
    if (k.art === 'ruecklage') {
      const gedeckt = Math.min(pool, k.betrag); pool -= gedeckt;
      if (imJahr) ausRuecklage += gedeckt;
      if (k.betrag - gedeckt > 0) teil = teile(k.betrag - gedeckt, ids, nr);
    } else if (k.art === 'selbstbehalt') {
      teil = Object.fromEntries(ids.map((i) => [i, i === k.verursacherId ? k.betrag : 0]));
    } else if (k.art === 'praemie') {
      const achtel = Math.floor(k.betrag / 8);
      teil = Object.fromEntries(ids.map((i) => [i, i === k.verursacherId ? 0 : achtel]));
      teil[k.verursacherId] = k.betrag - achtel * (ids.length - 1);   // Verursacher traegt 5/8 (Ziffer 12)
    } else {
      teil = teile(k.betrag, ids, nr);
    }
    if (imJahr) { total += k.betrag; if (teil) for (const i of ids) anteil[i] += teil[i]; }
  }
  return { anteil, ruecklagePool: pool, ausRuecklage, total };
}

// Einzahlungen je Person, Zweck und Jahr.
export function eingezahlt(einzahlungen, personId, zweck, vonIso, bisIsoExkl) {
  return einzahlungen.filter((e) => e.personId === personId && e.zweck === zweck && e.datum >= vonIso && e.datum < bisIsoExkl).reduce((s, e) => s + e.betrag, 0);
}

// Anschaffung (Kaufpreis, Zoll, Mehrwertsteuer, Ueberfuehrung, Zulassung, Zubehoer): alle Zahlungen zaehlen und werden geviertelt.
// Ueber ANSCHAFFUNG_MAX_CHF brauchen alle Beteiligten ihr Einverstaendnis (Vertrag Ziffer 3), geviertelt wird weiter. Versicherung gehoert nicht dazu.
// saldo = bezahlt minus Anteil: positiv = hat mehr bezahlt als sein Anteil (Vorschuss), negativ = muss noch beitragen.
// Rueckzahlungen: Darlehensraten von Tochter und Sohn, ohne Erlass (der Erlass ist eine zeitabhaengige Schenkung).
export function anschaffung(einzahlungen, personen, ids, maxChf = ANSCHAFFUNG_MAX_CHF) {
  const zahlungen = einzahlungen.filter((e) => e.zweck === 'anschaffung');
  const gesamt = zahlungen.reduce((s, e) => s + e.betrag, 0), max = maxChf * 100;
  const gezaehlt = gesamt, ueber = Math.max(0, gesamt - max);
  const anteile = teile(gezaehlt, ids, 0);
  const bezahlt = Object.fromEntries(ids.map((i) => [i, zahlungen.filter((e) => e.personId === i).reduce((s, e) => s + e.betrag, 0)]));
  const rueck = Object.fromEntries(ids.map((i) => [i, einzahlungen.filter((e) => e.zweck === 'darlehen' && e.personId === i).reduce((s, e) => s + e.betrag, 0)]));
  const saldo = Object.fromEntries(ids.map((i) => [i, bezahlt[i] - anteile[i]]));
  const eltern = ids.filter((i) => personen[i]?.konto === 'eltern'), kinder = ids.filter((i) => personen[i]?.konto !== 'eltern');
  const sum = (liste, o) => liste.reduce((s, i) => s + o[i], 0);
  const vorschuss = Math.max(0, sum(eltern, saldo));                       // was Vater und Mutter ueber ihren Anteil hinaus fuer Tochter und Sohn bezahlt haben
  const rueckgezahlt = sum(kinder, rueck);
  return { gesamt, gezaehlt, ueber, max, offen: Math.max(0, max - gesamt), anteile, bezahlt, saldo, rueck, vorschuss, rueckgezahlt, nettoVorschuss: Math.max(0, vorschuss - rueckgezahlt) };
}

// Vertragsjahr (1 bis 8) ab Uebergabedatum des Fahrzeugs. null = vor Start, 9 = Vertrag abgelaufen.
export function vertragsJahr(startIso, datumIso) {
  if (!startIso || datumIso < startIso) return null;
  let n = 0;
  while (addJahre(startIso, n + 1) <= datumIso) n++;
  return Math.min(n + 1, 9);
}

// Zahlplan der Person im aktuellen Vertragsjahr: Soll aus Vertrag, Ist aus Einzahlungen. Nur wenn das Startdatum bekannt ist.
export function zahlplan(startIso, heuteIso, einzahlungen, person, personId) {
  const n = vertragsJahr(startIso, heuteIso);
  if (n === null || n > 8) return { jahr: n };
  const von = addJahre(startIso, n - 1), bis = addJahre(startIso, n);
  const posten = [['ruecklage', RUECKLAGE_CHF[n - 1] * 100]];
  if (person.konto !== 'eltern') posten.push(['darlehen', DARLEHEN_CHF[n - 1] * 100]);
  return { jahr: n, von, bis, posten: posten.map(([zweck, soll]) => { const ist = eingezahlt(einzahlungen, personId, zweck, von, bis); return { zweck, soll, ist, offen: Math.max(0, soll - ist) }; }) };
}

// Faelligkeiten (Vertrag Ziffer 4 und 5), Betraege in Rappen:
// Darlehensraten (Tochter und Sohn) monatlich am letzten Tag des Monats, die erste Rate im Monat der Uebernahme;
// Ruecklage jaehrlich bis 31. Dezember, Jahr 1 im Kalenderjahr der Uebernahme.
export const VORLAUF_TAGE = 14;   // so viele Tage vor dem Termin erscheint der Hinweis
const monatsEnde = (j, m0) => new Date(Date.UTC(j, m0 + 1, 0)).toISOString().slice(0, 10);
export function sollTermine(startIso, zweck) {
  const [sj, sm] = startIso.split('-').map(Number);
  if (zweck === 'darlehen') return Array.from({ length: 96 }, (_, m) => ({ datum: monatsEnde(sj, sm - 1 + m), betrag: DARLEHEN_CHF[Math.floor(m / 12)] * 100 / 12 }));
  return RUECKLAGE_CHF.map((c, k) => ({ datum: `${sj + k}-12-31`, betrag: c * 100 }));
}
// Je Person und Zweck: Rueckstand (faellig und nicht bezahlt) und naechste Faelligkeit. Es zaehlen alle Einzahlungen, auch im Voraus bezahlte.
export function faelligkeiten(startIso, heuteIso, einzahlungen, person, personId) {
  if (!startIso) return [];
  const zwecke = person.konto === 'eltern' ? ['ruecklage'] : ['ruecklage', 'darlehen'];
  return zwecke.map((zweck) => {
    const ist = einzahlungen.filter((e) => e.personId === personId && e.zweck === zweck).reduce((s, e) => s + e.betrag, 0);
    let cum = 0, rueckstand = null, naechste = null;
    for (const t of sollTermine(startIso, zweck)) {
      const vor = cum; cum += t.betrag;
      if (cum <= ist) continue;
      if (t.datum < heuteIso) { if (!rueckstand) rueckstand = { seit: t.datum, betrag: 0 }; rueckstand.betrag = cum - ist; }
      else { naechste = { datum: t.datum, betrag: cum - Math.max(ist, vor) }; break; }
    }
    return { zweck, ist, rueckstand, naechste };
  });
}

// Zahlungsplan ueber alle 8 Vertragsjahre je Person (Ruecklage fuer alle, Darlehensraten nur Tochter und Sohn).
// Erfasste Einzahlungen werden der Reihe nach den Jahren zugeordnet (aeltestes Jahr zuerst, auch Vorauszahlungen).
// Je Jahr und Zweck: soll, bezahlt, offen, offenFaellig (heute schon faellig und nicht bezahlt) und Status
// 'ueberfaellig' | 'bezahlt' | 'offen' (noch nicht faellig). restschuldPlan: Restschuld laut Anhang A (Erlass eingerechnet).
export const ERLASS_CHF = 675;
export const DARLEHEN_TOTAL_CHF = 15000;     // Anhang A: Darlehen je Kind vor Erlass und Rueckzahlung
export function achtJahrePlan(startIso, heuteIso, einzahlungen, person, personId) {
  if (!startIso) return null;
  const kind = person.konto !== 'eltern';
  const zwecke = kind ? ['ruecklage', 'darlehen'] : ['ruecklage'];
  const rest = {}, jahre = [];
  for (const z of zwecke) rest[z] = einzahlungen.filter((e) => e.personId === personId && e.zweck === z).reduce((s, e) => s + e.betrag, 0);
  const termine = Object.fromEntries(zwecke.map((z) => [z, sollTermine(startIso, z)]));
  let restschuld = DARLEHEN_TOTAL_CHF * 100;
  for (let y = 0; y < 8; y++) {
    const jahr = { jahr: y + 1 };
    for (const z of zwecke) {
      const items = z === 'darlehen' ? termine[z].slice(12 * y, 12 * y + 12) : [termine[z][y]];
      const soll = items.reduce((s, t) => s + t.betrag, 0), bezahlt = Math.min(rest[z], soll); rest[z] -= bezahlt;
      const faellig = items.filter((t) => t.datum < heuteIso).reduce((s, t) => s + t.betrag, 0);
      const offenFaellig = Math.max(0, faellig - bezahlt), offen = soll - bezahlt;
      jahr[z] = { soll, bezahlt, offen, offenFaellig, von: items[0].datum, bis: items[items.length - 1].datum, monatlich: z === 'darlehen' ? items[0].betrag : null, status: offenFaellig > 0 ? 'ueberfaellig' : offen === 0 ? 'bezahlt' : 'offen' };
    }
    if (kind) { restschuld -= (DARLEHEN_CHF[y] + ERLASS_CHF) * 100; jahr.restschuldPlan = restschuld; }
    jahre.push(jahr);
  }
  const summe = (f) => jahre.reduce((s, j) => s + zwecke.reduce((t, z) => t + j[z][f], 0), 0);
  return { jahre, zwecke, total: { soll: summe('soll'), bezahlt: summe('bezahlt'), offen: summe('offen'), offenFaellig: summe('offenFaellig') } };
}

// Zahlungsverzug (Ziffer 4): Erinnerung, 10 Tage Frist, danach Nutzungsverbot bis zur Zahlung.
export function zahlungsSperre(status, heuteIso) {
  if (!status || status.status !== 'erinnert' || !status.erinnertAm) return { stufe: 'ok' };
  const frist = addTage(status.erinnertAm, FRIST_TAGE);
  return heuteIso > frist ? { stufe: 'gesperrt', ab: addTage(frist, 1) } : { stufe: 'erinnert', frist };
}

// Termine (MFK, Service, ...): ueberfaellig, bald (30 Tage), offen, erledigt.
export function terminStufe(t, heuteIso) {
  if (t.erledigtAm) return 'erledigt';
  if (t.faelligAm < heuteIso) return 'ueberfaellig';
  return t.faelligAm <= addTage(heuteIso, 30) ? 'bald' : 'offen';
}

export const chf = (rappen) => (rappen / 100).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Rueckgabe gilt erst als abgeschlossen, wenn der Schluessel quittiert ist.
export const rueckgabeFertig = (rk) => !!rk && rk.schluessel === 'ja';

// Tank nicht voll (nur Warnung, Speichern geht mit Bemerkung).
export const tankWarnung = (u) => !!u && !!u.tank && u.tank !== 'voll';

// =====================================================================
// Alltagsfahrten der Eltern (privat, ohne Reservierung)
// Ein Tag mit mindestens einer Alltagsfahrt zaehlt als ein Tag im Konto der Eltern. Reservierte Tage zaehlen nicht doppelt.
// =====================================================================
export const ALLTAG_MAX_KM = 1500;   // pro Eintrag, Plausibilitaet

const reserviert = (datum, buchungen) => Object.values(buchungen).some((b) => b.von <= datum && datum <= b.bis);

export function pruefeAlltag(a, buchungen, personen) {
  const fehler = [];
  if (!datumGueltig(a.datum)) fehler.push('Datum fehlt oder ist kein gültiges Datum.');
  else if (reserviert(a.datum, buchungen)) fehler.push('An diesem Tag ist das Fahrzeug für eine Reise reserviert. Reisen gehen immer vor.');
  if (!personen[a.personId] || personen[a.personId].konto !== 'eltern') fehler.push('Alltagsfahrten sind nur für Vater und Mutter.');
  if (!Number.isInteger(a.km) || a.km < 0 || a.km > ALLTAG_MAX_KM) fehler.push(`Die gefahrenen Kilometer fehlen oder sind ungültig (0 bis ${ALLTAG_MAX_KM}).`);
  return { ok: fehler.length === 0, fehler };
}

// Anzahl Alltagstage im Jahr J (verschiedene Daten, ohne reservierte Tage).
export function alltagTage(alltag, buchungen, J) {
  const t = new Set();
  for (const a of Object.values(alltag)) if (a.datum && a.datum.slice(0, 4) === String(J) && !reserviert(a.datum, buchungen)) t.add(a.datum);
  return t.size;
}
export const alltagKm = (alltag, J) => Object.values(alltag).filter((a) => a.datum && a.datum.slice(0, 4) === String(J)).reduce((s, a) => s + (a.km || 0), 0);

// Kontostaende inklusive Alltagstage der Eltern.
export function kontostaendeMitAlltag(buchungen, personen, J, alltag, buchungenObj) {
  const r = kontostaende(buchungen, personen, J);
  const al = alltagTage(alltag || {}, buchungenObj || {}, J);
  r.eltern += al;
  return { ...r, alltag: al };
}

// =====================================================================
// Tausch von Nutzungstagen (Vertrag Ziffer 7 a): ungenutzte Tage eines Kalenderjahres duerfen an eine andere Person
// (ein anderes Konto) abgetreten werden. Die Hoechstgrenze von 181 Tagen fuer Vater und Mutter bleibt.
// Ein Tausch ist ein Eintrag mit art 'Tausch' in der Sammlung 'termine': von, an (Konto), tage, jahr.
// =====================================================================
export const TAUSCH_MAX_TAGE = 91;

// Schwellen je Konto im Jahr J, nach Abtretung. Regel (HP77, 13.11.2026): Abgetreten wird nur von Vater und Mutter,
// und nur an beide Kinder zugleich. Eintrag {von:'eltern', an:'kinder', tage}: jedes Kind plus tage, HP und Nora je minus tage (Konto Eltern minus 2 x tage).
// Aeltere Einzel-Eintraege (an: ein Konto) werden weiter mitgerechnet. Eltern nie ueber 181.
export function schwellen(tausch, J) {
  const s = { ...SCHWELLE };
  for (const t of Object.values(tausch || {})) {
    if (Number(t.jahr) !== Number(J)) continue;
    if (t.von === 'eltern' && t.an === 'kinder') { s.eltern -= 2 * t.tage; s['kind-1'] += t.tage; s['kind-2'] += t.tage; continue; }
    if (!(t.von in s) || !(t.an in s)) continue;
    s[t.von] -= t.tage; s[t.an] += t.tage;
  }
  s.eltern = Math.min(SCHWELLE.eltern, s.eltern);
  return s;
}

// t: {von, an, tage, jahr}; stand: Tage je Konto im Jahr (mit Alltag); heuteJahr: aktuelles Jahr (vergangene Jahre sind abgeschlossen).
export function pruefeTausch(t, tauschBisher, stand, heuteJahr) {
  const fehler = [];
  if (t.von !== 'eltern' || t.an !== 'kinder') fehler.push('Abgetreten wird nur von Vater und Mutter und nur an beide Kinder zugleich (Nanouk und Nene).');
  if (!Number.isInteger(t.jahr) || t.jahr < heuteJahr || t.jahr > heuteJahr + 1) fehler.push('Das Jahr muss das laufende oder das nächste sein. Vergangene Tage sind verfallen.');
  if (typeof t.tage !== 'number' || !(t.tage > 0) || t.tage > TAUSCH_MAX_TAGE || (t.tage * 2) % 1 !== 0) fehler.push(`Die Zahl der Tage muss ganz oder halb sein (zum Beispiel 3 oder 2.5), mindestens 0.5 und höchstens ${TAUSCH_MAX_TAGE}.`);
  if (fehler.length === 0) {
    const sw = schwellen(tauschBisher, t.jahr);
    const frei = sw.eltern - (stand.eltern || 0);
    if (t.tage * 2 > frei) fehler.push(`Die Eltern haben im Jahr ${t.jahr} nur noch ${Math.max(0, frei)} ungenutzte Tage frei. Für ${t.tage} Tage je Kind braucht es ${t.tage * 2}. Bereits genutzte oder reservierte Tage lassen sich nicht abtreten.`);
  }
  return { ok: fehler.length === 0, fehler };
}

// Letzter bekannter Tankstand: aus Uebergaben/Rueckgaben und «Getankt»-Meldungen (nach Datum und Uhrzeit). Nicht voll -> Warnung.
export function tankOffen(uebergaben, fuellungen) {
  const alle = [
    ...uebergaben.filter((u) => u.tank && u.datumZeit).map((u) => ({ tank: u.tank, datumZeit: u.datumZeit, phase: u.phase, erfasstVon: u.erfasstVon })),
    ...fuellungen.filter((f) => f.datumZeit).map((f) => ({ tank: 'voll', datumZeit: f.datumZeit, phase: 'getankt', erfasstVon: f.erfasstVon })),
  ].sort((a, b) => (a.datumZeit < b.datumZeit ? -1 : a.datumZeit > b.datumZeit ? 1 : 0));
  const l = alle[alle.length - 1];
  return l && l.tank !== 'voll' ? l : null;
}

// Vorschau vor dem Speichern: Konten, die mit der neuen Reservierung ueber der Schwelle liegen (je Jahr), und Alltagstage, die dadurch entfallen.
export function vorschauBuchung(b, buchungen, personen, alltag, tausch) {
  const ohne = Object.values(buchungen).filter((x) => x.id !== b.id);
  const mit = [...ohne, b];
  const bm = Object.fromEntries(mit.map((x) => [x.id || '_neu', x]));
  const ueber = [];
  const j1 = +b.von.slice(0, 4), j2 = +b.bis.slice(0, 4);
  for (let J = j1; J <= j2; J++) {
    const st = kontostaendeMitAlltag(mit, personen, J, alltag, bm);
    const sw = schwellen(tausch, J);
    for (const k of konten(b, personen)) if (st[k] > sw[k]) ueber.push({ konto: k, jahr: J, tage: st[k], schwelle: sw[k] });
  }
  const entfallen = Object.values(alltag || {}).filter((a) => a.datum >= b.von && a.datum <= b.bis).map((a) => a.datum);
  return { ueber, entfallen: [...new Set(entfallen)].sort() };
}

// =====================================================================
// Wunschliste (Vertrag Ziffer 5, Absatz «Einrichtung»). Betraege in Rappen.
// Einrichtungsgegenstaende bis CHF 200 pro Stueck: vorher in der Wunschliste vorschlagen, 5 Tage Frist,
// wer nicht antwortet stimmt zu. Es braucht immer die qualifizierte Mehrheit (Ziffer 13): alle Stimmen ausser einer.
// Bei Gleichstand (2 zu 2) ist der Kauf abgelehnt, einen Stichentscheid des Halters gibt es nicht.
// Antworten und Erstattung sind eigene Eintraege (Sammlung 'wunschaktionen'), damit niemand
// einen Eintrag einer anderen Person aendert.
// =====================================================================
export const WUNSCH_MAX_RAPPEN = 20000;     // CHF 200 pro Stueck bzw. fuer gleichartige Stuecke zusammen
export const WUNSCH_FRIST_TAGE = 5;
export const WUNSCH_FOTO_MAX = 250000;      // Zeichen des Fotos (JPEG als Text), ein Foto im Handy wird auf etwa 150 KB verkleinert; Firestore erlaubt 1 MiB pro Eintrag
export const WUNSCH_STATUS = { offen: 'Antworten offen', freigegeben: 'Freigegeben', abgelehnt: 'Abgelehnt', gekauft: 'Gekauft' };

export const wunschTotal = (w) => (Number.isInteger(w.preis) ? w.preis : 0) * (Number.isInteger(w.menge) ? w.menge : 1);

export function pruefeWunsch(w) {
  const f = [];
  if (!(w.titel || '').trim()) f.push('Bitte angeben, was gekauft werden soll (Produkt).');
  if (!Number.isInteger(w.preis) || w.preis <= 0) f.push('Bitte den Preis pro Stück angeben (grösser als 0).');
  if (!Number.isInteger(w.menge) || w.menge < 1 || w.menge > 99) f.push('Die Stückzahl muss zwischen 1 und 99 liegen.');
  if (Number.isInteger(w.preis) && w.preis > WUNSCH_MAX_RAPPEN) f.push('Ein Stück kostet mehr als CHF 200. Das ist keine Kleinanschaffung: bitte im Familienrat besprechen (Vertrag Ziffer 5 und 3).');
  else if (Number.isInteger(w.preis) && Number.isInteger(w.menge) && w.menge >= 1 && wunschTotal(w) > WUNSCH_MAX_RAPPEN) f.push('Gleichartige Stücke kosten zusammen mehr als CHF 200. Bitte im Familienrat besprechen (Vertrag Ziffer 5).');
  if ((w.link || '').trim() && !/^https?:\/\/\S+$/i.test(w.link.trim())) f.push('Der Link muss mit http:// oder https:// beginnen.');
  if (w.foto) { if (typeof w.foto !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(w.foto)) f.push('Das Foto ist ungültig. Bitte ein Foto neu auswählen.'); else if (w.foto.length > WUNSCH_FOTO_MAX) f.push('Das Foto ist zu gross. Bitte ein anderes wählen.'); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w.datum || '')) f.push('Datum fehlt.');
  return { ok: f.length === 0, fehler: f };
}

// Stand eines Wunsches. aktionen: alle Eintraege der Sammlung 'wunschaktionen' (werden hier nach wunschId gefiltert).
// ids: alle Eigentuemer. Freigegeben nur mit qualifizierter Mehrheit (mindestens alle ausser einer, und mehr Ja als Nein).
export function wunschStand(w, aktionen, ids, heute) {
  const mine = (aktionen || []).filter((a) => a.wunschId === w.id);
  const frist = addTage(w.datum, WUNSCH_FRIST_TAGE);
  const abgelaufen = heute > frist;
  const antworten = {};
  for (const a of mine) if (a.art === 'antwort' && ids.includes(a.personId) && a.personId !== w.erfasstVon && ['ja', 'nein'].includes(a.stimme)) antworten[a.personId] = a;
  const andere = ids.filter((i) => i !== w.erfasstVon);
  const ohneAntwort = andere.filter((i) => !antworten[i]);
  const nein = andere.filter((i) => antworten[i] && antworten[i].stimme === 'nein');
  const erstattet = mine.find((a) => a.art === 'erstattet') || null;
  const entschieden = abgelaufen || ohneAntwort.length === 0;
  const ja = ids.length - nein.length;             // Vorschlagende/r und alle ohne Antwort (nach der Frist) zaehlen als Ja
  let status;
  if (w.gekauftAm) status = 'gekauft';
  else if (!entschieden) status = 'offen';
  else status = ja >= ids.length - 1 && ja > nein.length ? 'freigegeben' : 'abgelehnt';   // Gleichstand = abgelehnt
  return { frist, abgelaufen, antworten, ohneAntwort, nein, ja, erstattet, status };
}

export function pruefeKauf(w, betrag, datum) {
  const f = [];
  if (!Number.isInteger(betrag) || betrag <= 0) f.push('Bitte den bezahlten Betrag angeben (grösser als 0).');
  else if (betrag > WUNSCH_MAX_RAPPEN) f.push('Der bezahlte Betrag liegt über CHF 200. Das geht nicht als Kleinanschaffung, bitte zuerst im Familienrat besprechen.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum || '')) f.push('Kaufdatum fehlt.');
  else if (w.datum && datum < w.datum) f.push('Das Kaufdatum liegt vor dem Vorschlag.');
  return { ok: f.length === 0, fehler: f };
}

// =====================================================================
// Einfache doppelte Buchhaltung (Tab «Kosten»). Betraege in Rappen, alles in CHF.
// Jede Buchung: Datum, Soll-Konto, Haben-Konto, Betrag, Text. Sammlung 'journal'.
// Aktiv und Aufwand nehmen im Soll zu, Passiv und Ertrag im Haben.
// Namen von Personen stehen nie im Code: die beiden Darlehen an Tochter und Sohn nehmen den Namen aus den Personen.
// =====================================================================
export const KONTO_TYPEN = { aktiv: 'Aktiven', passiv: 'Passiven', ertrag: 'Ertrag', aufwand: 'Aufwand' };
const K = (nr, name, typ, extra = {}) => ({ nr, name, typ, ...extra });
export const KONTEN_BASIS = [
  K('1000', 'Kasse', 'aktiv'), K('1020', 'Reise CHF bei Migros Bank', 'aktiv'),
  K('1300', 'TA (Transitorische Aktiven)', 'aktiv'),
  K('1500', 'Darlehen an Kind 1', 'aktiv', { kind: 'kind-1', vorsilbe: 'Darlehen an ' }), K('1501', 'Darlehen an Kind 2', 'aktiv', { kind: 'kind-2', vorsilbe: 'Darlehen an ' }),
  K('1530', 'Fahrzeug', 'aktiv'), K('1531', 'Zubehör Fahrzeug', 'aktiv'),
  K('2000', 'Kreditoren allgemein', 'passiv'), K('2300', 'TP (Transitorische Passiven)', 'passiv'),
  K('2400', 'Darlehen von Eltern', 'passiv'),
  K('3000', 'Übriger Ertrag (Erstattungen, Zinsen, Kursgewinne)', 'ertrag'), K('3010', 'Geschenkbeitrag Eltern', 'ertrag'),
  K('4000', 'Versicherung', 'aufwand'), K('4010', 'Motorfahrzeugsteuer', 'aufwand'), K('4020', 'Service', 'aufwand'), K('4030', 'Reparaturen', 'aufwand'),
  K('4040', 'Pneus', 'aufwand'), K('4060', 'Vignette', 'aufwand'), K('4070', 'Parkplatzmiete', 'aufwand'),
  K('4080', 'MFK und Gebühren', 'aufwand'),
  K('4100', 'Reinigungsmaterial', 'aufwand'), K('4110', 'Küchenmaterial', 'aufwand'), K('4120', 'Allgemeine Esswaren', 'aufwand'), K('4130', 'Gas', 'aufwand'),
  K('4140', 'Toilettenartikel', 'aufwand'), K('4150', 'Kleinmaterial', 'aufwand'),
  K('4900', 'Allgemeiner Betriebsaufwand', 'aufwand'), K('4910', 'Bankspesen und Zinsen', 'aufwand'), K('4920', 'Kursdifferenzen (Euro)', 'aufwand'), K('4930', 'Abschreibungen', 'aufwand'),
];
// Eigenkapital: ein Konto je Eigentuemer (2800 bis 2803), in der Reihenfolge Vater, Mutter, Tochter, Sohn.
export const EK_BASIS = 2800;
export const DEBITOR_BASIS = 1100;     // Debitoren: ein Konto je Eigentuemer (1100 bis 1103), dazu 1104 Melzer GmbH
export const DEBITOR_FIRMA = { nr: '1104', name: 'Debitor Melzer GmbH' };
export const KREDITOR_BASIS = 2001;    // Kreditoren: 2000 allgemein, dazu ein Konto je Eigentuemer (2001 bis 2004)
export const RUECKLAGE_BASIS = 2600;   // Ruecklage: ein Konto je Eigentuemer (2600 bis 2603), gleiche Reihenfolge wie das Eigenkapital
const EK_REIHENFOLGE = ['hp', 'fr', 't', 's'];
export function eigentuemerGeordnet(personen) {
  const ids = Object.keys(personen || {});
  return [...EK_REIHENFOLGE.filter((i) => ids.includes(i)), ...ids.filter((i) => !EK_REIHENFOLGE.includes(i)).sort()].slice(0, 4);
}
export const ekNr = (personen, personId) => { const i = eigentuemerGeordnet(personen).indexOf(personId); return i < 0 ? null : String(EK_BASIS + i); };
// personen: Objekt id -> { name, konto }. Liefert die Konten mit den echten Namen (Darlehen, Eigenkapital).
export function kontenListe(personen) {
  const p = Object.values(personen || {}), ids = eigentuemerGeordnet(personen);
  const ek = [0, 1, 2, 3].map((i) => ({ nr: String(EK_BASIS + i), name: 'Eigenkapital ' + (ids[i] ? personen[ids[i]].name : (i + 1)), typ: 'passiv' }));
  const liste = KONTEN_BASIS.map((k) => {
    if (!k.kind) return { nr: k.nr, name: k.name, typ: k.typ };
    const person = p.find((x) => x.konto === k.kind);
    return { nr: k.nr, name: person ? k.vorsilbe + person.name : k.name, typ: k.typ };
  });
  const rl = [0, 1, 2, 3].map((i) => ({ nr: String(RUECKLAGE_BASIS + i), name: 'Rücklage ' + (ids[i] ? personen[ids[i]].name : (i + 1)), typ: 'passiv' }));
  const deb = [...[0, 1, 2, 3].map((i) => ({ nr: String(DEBITOR_BASIS + i), name: 'Debitor ' + (ids[i] ? personen[ids[i]].name : (i + 1)), typ: 'aktiv' })), { ...DEBITOR_FIRMA, typ: 'aktiv' }];
  const kre = [0, 1, 2, 3].map((i) => ({ nr: String(KREDITOR_BASIS + i), name: 'Kreditor ' + (ids[i] ? personen[ids[i]].name : (i + 1)), typ: 'passiv' }));
  const i = liste.findIndex((k) => k.nr === '2400') + 1, d = liste.findIndex((k) => k.nr === '1000') + 2, kk = liste.findIndex((k) => k.nr === '2000') + 1;
  return [...liste.slice(0, d), ...deb, ...liste.slice(d, kk), ...kre, ...liste.slice(kk, i), ...rl, ...ek, ...liste.slice(i)];
}
export function buchVorlagen(personen) {
  const ids = eigentuemerGeordnet(personen);
  return [
    { id: 'ausgabe-bank', name: 'Ausgabe, von der Bank bezahlt', soll: '4900', haben: '1020' },
    { id: 'ausgabe-bar', name: 'Ausgabe, bar bezahlt', soll: '4900', haben: '1000' },
    ...ids.map((id, i) => ({ id: 'einlage-' + id, name: 'Einzahlung von ' + personen[id].name + ' auf die Bank', soll: '1020', haben: String(EK_BASIS + i) })),
    ...ids.map((id, i) => ({ id: 'ruecklage-' + id, name: 'Rücklage von ' + personen[id].name + ' auf die Bank', soll: '1020', haben: String(RUECKLAGE_BASIS + i) })),
    ...KONTEN_BASIS.filter((k) => k.kind).map((k) => { const p = Object.values(personen || {}).find((x) => x.konto === k.kind); return p ? { id: 'rate-' + k.kind, name: 'Darlehensrate von ' + p.name + ' auf die Bank', soll: '1020', haben: k.nr } : null; }).filter(Boolean),
    { id: 'abhebung', name: 'Bargeld von der Bank abgehoben', soll: '1000', haben: '1020' },
    { id: 'fahrzeug', name: 'Fahrzeug von der Bank bezahlt', soll: '1530', haben: '1020' },
    { id: 'parkplatz', name: 'Parkplatzmiete (Geschenk der Eltern)', soll: '4070', haben: '3010' },
    { id: 'frei', name: 'Freie Buchung', soll: '', haben: '' },
  ];
}
// Zahlplan aus der Buchhaltung: Als Zahlung zaehlt eine Buchung von einem Geldkonto (Kasse, Bank CHF) an
//   - «Darlehen an <Kind>»  = Darlehensrate des Kindes,
//   - «Ruecklage <Eigentuemer>» = Ruecklage dieses Eigentuemers.
// Liefert Eintraege im Format des Zahlplans: { personId, zweck: 'darlehen' | 'ruecklage', betrag, datum }.
export const GELDKONTEN = ['1000', '1020'];
export function zahlungenAusJournal(journal, personen) {
  const ids = eigentuemerGeordnet(personen), darlehen = {}, ruecklage = {};
  for (const k of KONTEN_BASIS) if (k.kind) { const e = Object.entries(personen || {}).find(([, p]) => p.konto === k.kind); if (e) darlehen[k.nr] = e[0]; }
  ids.forEach((id, i) => { ruecklage[String(RUECKLAGE_BASIS + i)] = id; });
  const out = [];
  for (const b of Object.values(journal || {})) {
    if (!GELDKONTEN.includes(b.soll)) continue;
    if (darlehen[b.haben]) out.push({ personId: darlehen[b.haben], zweck: 'darlehen', betrag: b.betrag, datum: b.datum });
    else if (ruecklage[b.haben]) out.push({ personId: ruecklage[b.haben], zweck: 'ruecklage', betrag: b.betrag, datum: b.datum });
  }
  return out;
}
export const kreditorNr = (personen, personId) => { const i = eigentuemerGeordnet(personen).indexOf(personId); return i < 0 ? null : String(KREDITOR_BASIS + i); };

// Wunschliste -> Buchhaltung. Ein Wunsch kommt erst in die Buchhaltung, wenn er gekauft ist (Freigabe durch die Mehrheit
// und «Gekauft eintragen»). Die App bereitet die Buchungen vor, HP bestaetigt und waehlt das Aufwandskonto selbst:
//   Kauf:        Aufwandskonto (HP waehlt) an «Kreditor <Kaeufer>»   (der Kaeufer hat ausgelegt)
//   Erstattung:  «Kreditor <Kaeufer>» an Bank CHF                   (erst, wenn der Kauf gebucht ist)
// Gebuchte Eintraege tragen wunschId und wunschArt ('kauf' | 'erstattung') im Journal.
// Welche Buchungen zu einem Wunsch schon vorhanden sind. Zaehlt auch, was HP von Hand gebucht hat (ohne Bezug zum Wunsch):
//   Kauf:       Buchung an «Kreditor <Kaeufer>» mit dem Kaufbetrag,
//   Erstattung: Buchung von «Kreditor <Kaeufer>» mit dem Kaufbetrag.
// Eine Handbuchung gilt hoechstens fuer einen Wunsch (zwei gleiche Wuensche brauchen zwei Buchungen).
function buchungsStand(wuensche, journal, personen) {
  const j = Object.values(journal || {}), frei = j.filter((x) => !x.wunschId).sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0)), benutzt = new Set(), res = {};
  const ws = Object.values(wuensche || {}).filter((w) => w.gekauftAm).sort((a, b) => (a.gekauftAm < b.gekauftAm ? -1 : a.gekauftAm > b.gekauftAm ? 1 : 0));
  const nimm = (pruefe) => { const e = frei.find((x) => !benutzt.has(x) && pruefe(x)); if (e) benutzt.add(e); return !!e; };
  for (const w of ws) {
    const kreditor = kreditorNr(personen, w.erfasstVon) || '';
    const kauf = j.some((x) => x.wunschId === w.id && x.wunschArt === 'kauf') || (!!kreditor && nimm((x) => x.haben === kreditor && x.betrag === w.gekauftBetrag));
    const erstattung = j.some((x) => x.wunschId === w.id && x.wunschArt === 'erstattung') || (!!kreditor && nimm((x) => x.soll === kreditor && x.betrag === w.gekauftBetrag));
    res[w.id] = { kauf, erstattung, kreditor };
  }
  return res;
}
export function zuBuchen(wuensche, wunschaktionen, journal, personen) {
  const a = Object.values(wunschaktionen || {}), st = buchungsStand(wuensche, journal, personen), out = [];
  for (const w of Object.values(wuensche || {})) {
    if (!w.gekauftAm) continue;
    const s = st[w.id], erst = a.find((x) => x.wunschId === w.id && x.art === 'erstattet');
    if (!s.kauf) out.push({ wunschId: w.id, titel: w.titel, art: 'kauf', datum: w.gekauftAm, betrag: w.gekauftBetrag, personId: w.erfasstVon, soll: '', haben: s.kreditor });
    else if (erst && !s.erstattung) out.push({ wunschId: w.id, titel: w.titel, art: 'erstattung', datum: erst.datum || (erst.erfasstAm || '').slice(0, 10) || w.gekauftAm, betrag: w.gekauftBetrag, personId: w.erfasstVon, soll: s.kreditor, haben: '1020' });
  }
  return out.sort((x, y) => (x.datum < y.datum ? -1 : x.datum > y.datum ? 1 : 0));
}
export function wunschGebucht(w, journal, personen = {}, wuensche = { [w.id]: w }) {
  const s = buchungsStand(wuensche, journal, personen)[w.id] || { kauf: false, erstattung: false };
  return { kauf: s.kauf, erstattung: s.erstattung };
}
export const BUCH_TEXT_MAX = 100;
export const BUCH_BETRAG_MAX = 100000000;   // CHF 1 Million, gleiche Grenze wie die Datenbankregel

export function pruefeBuchsatz(b, personen) {
  const f = [], nrs = kontenListe(personen).map((k) => k.nr);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.datum || '') || !datumGueltig(b.datum)) f.push('Datum fehlt oder ist ungültig.');
  if (!nrs.includes(b.soll)) f.push('Bitte das Soll-Konto wählen.');
  if (!nrs.includes(b.haben)) f.push('Bitte das Haben-Konto wählen.');
  if (b.soll && b.soll === b.haben) f.push('Soll und Haben müssen verschiedene Konten sein.');
  if (!Number.isInteger(b.betrag) || b.betrag <= 0) f.push('Bitte einen Betrag über 0 eingeben, höchstens zwei Nachkommastellen.');
  else if (b.betrag >= BUCH_BETRAG_MAX) f.push('Der Betrag ist zu gross (höchstens CHF 999 999.99).');
  if (!(b.text || '').trim()) f.push('Bitte einen Buchungstext eingeben, zum Beispiel was gekauft wurde.');
  else if (b.text.length > BUCH_TEXT_MAX) f.push(`Der Text ist zu lang (höchstens ${BUCH_TEXT_MAX} Zeichen).`);
  return { ok: f.length === 0, fehler: f };
}

// Saldi aller Konten. von/bis: nur Buchungen von <= datum <= bis (beide einschliesslich, leer = unbegrenzt).
// saldo ist in der normalen Richtung des Kontos (Aktiv und Aufwand: Soll minus Haben; Passiv und Ertrag: Haben minus Soll).
export function kontoSalden(journal, personen, von, bis) {
  const liste = kontenListe(personen), m = {};
  for (const k of liste) m[k.nr] = { ...k, soll: 0, haben: 0, saldo: 0 };
  for (const b of Object.values(journal || {})) {
    if (von && b.datum < von) continue;
    if (bis && b.datum > bis) continue;
    if (m[b.soll]) m[b.soll].soll += b.betrag;
    if (m[b.haben]) m[b.haben].haben += b.betrag;
  }
  for (const k of liste) { const e = m[k.nr]; e.saldo = (e.typ === 'aktiv' || e.typ === 'aufwand') ? e.soll - e.haben : e.haben - e.soll; }
  return m;
}
const summe = (konten, typ) => konten.filter((k) => k.typ === typ).reduce((s, k) => s + k.saldo, 0);
// Erfolgsrechnung eines Zeitraums
export function erfolgsrechnung(journal, personen, von, bis) {
  const k = Object.values(kontoSalden(journal, personen, von, bis));
  const ertrag = k.filter((x) => x.typ === 'ertrag' && (x.soll || x.haben)), aufwand = k.filter((x) => x.typ === 'aufwand' && (x.soll || x.haben));
  const sErtrag = summe(k, 'ertrag'), sAufwand = summe(k, 'aufwand');
  return { ertrag, aufwand, sErtrag, sAufwand, ergebnis: sErtrag - sAufwand };
}
// Bilanz per Stichtag. Gewinn/Verlust aus allen Jahren bis zum Stichtag steht als eigene Zeile bei den Passiven
// (es gibt noch keinen Jahresabschluss, der das Ergebnis ins Eigenkapital bucht).
export function bilanz(journal, personen, stichtag) {
  const k = Object.values(kontoSalden(journal, personen, '', stichtag));
  const aktiven = k.filter((x) => x.typ === 'aktiv' && (x.soll || x.haben)), passiven = k.filter((x) => x.typ === 'passiv' && (x.soll || x.haben));
  const sA = summe(k, 'aktiv'), sP = summe(k, 'passiv'), ergebnis = summe(k, 'ertrag') - summe(k, 'aufwand');
  return { aktiven, passiven, sAktiven: sA, sPassiven: sP, ergebnis, sPassivenMitErgebnis: sP + ergebnis, stimmt: sA === sP + ergebnis };
}
// Kontoblatt: alle Buchungen eines Kontos bis zum Stichtag, mit laufendem Saldo (neueste zuletzt).
export function kontoblatt(journal, personen, nr, bis) {
  const k = kontenListe(personen).find((x) => x.nr === nr); if (!k) return { konto: null, zeilen: [], saldo: 0 };
  const plus = k.typ === 'aktiv' || k.typ === 'aufwand' ? 'soll' : 'haben';
  const alle = Object.values(journal || {}).filter((b) => (b.soll === nr || b.haben === nr) && (!bis || b.datum <= bis))
    .sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : (a.erfasstAm || '') < (b.erfasstAm || '') ? -1 : 1));
  let s = 0;
  const zeilen = alle.map((b) => { const betrag = b[plus] === nr ? b.betrag : -b.betrag; s += betrag; return { b, betrag, saldo: s }; });
  return { konto: k, zeilen, saldo: s };
}

// =====================================================================
// «Neu seit deinem letzten Besuch» (Eintraege anderer Personen, erfasst nach dem Zeitpunkt seit)
// =====================================================================
export const NEU_BEREICHE = { kalender: 'Kalender', termine: 'Termine', fahrten: 'Fahrten', kosten: 'Kosten', wunschliste: 'Wunschliste' };
export function istNeu(x, seit, ich) {
  return !!x && !!seit && !!ich && typeof x.erfasstAm === 'string' && x.erfasstAm > seit && x.erfasstVon !== ich;
}
// d: { buchungen, uebergaben, termine, kosten, einzahlungen, journal, wuensche, wunschaktionen } (je als Objekt id -> Eintrag)
export function neuZaehlen(d, seit, ich) {
  const z = { kalender: 0, termine: 0, fahrten: 0, kosten: 0, wunschliste: 0 };
  if (!seit || !ich) return { gesamt: 0, nach: z, wunschIds: new Set() };
  const n = (x) => istNeu(x, seit, ich);
  Object.values(d.buchungen || {}).forEach((x) => { if (n(x)) z.kalender++; });
  Object.values(d.uebergaben || {}).forEach((x) => { if (n(x)) z.fahrten++; });
  const frageIds = new Set();
  Object.values(d.termine || {}).forEach((x) => { if (!n(x) || x.art === 'Tank' || x.art === 'Tausch') return; if (x.art === 'Frage') { frageIds.add(x.id); return; } if (x.art === 'FrageAntwort') { if (d.termine && d.termine[x.frageId]) frageIds.add(x.frageId); return; } if (x.art === 'Alltag') z.fahrten++; else z.termine++; });
  Object.values(d.kosten || {}).forEach((x) => { if (n(x)) z.kosten++; });
  Object.values(d.einzahlungen || {}).forEach((x) => { if (n(x)) z.kosten++; });
  Object.values(d.journal || {}).forEach((x) => { if (n(x)) z.kosten++; });
  const wunschIds = new Set();
  Object.values(d.wuensche || {}).forEach((x) => { if (n(x)) wunschIds.add(x.id); });
  Object.values(d.wunschaktionen || {}).forEach((a) => { if (n(a) && d.wuensche && d.wuensche[a.wunschId]) wunschIds.add(a.wunschId); });
  z.wunschliste = wunschIds.size + frageIds.size;
  return { gesamt: z.kalender + z.termine + z.fahrten + z.kosten + z.wunschliste, nach: z, wunschIds };
}

// =====================================================================
// Fahrerfreigabe fuer eine Drittperson (Vertrag Ziffer 8 und 13).
// Ein/e Eigentuemer/in schlaegt eine bestimmte Person fuer eine bestimmte Reise vor. Entscheid mit der qualifizierten
// Mehrheit: alle Stimmen ausser einer (bei vier Eigentuemern 3 zu 1), Gleichstand = abgelehnt. Anders als bei der Wunschliste
// gilt Schweigen NICHT als Ja: wer nicht antwortet, hat nicht zugestimmt. Die Freigabe gilt nur fuer die genannte Reise.
// Liegt in der Sammlung 'termine' (art 'Fahrfreigabe' und 'FahrAntwort'), damit keine neue Datenbankregel noetig ist.
// =====================================================================
export const FAHRFREIGABE_STATUS = { offen: 'Antworten offen', freigegeben: 'Freigegeben', abgelehnt: 'Abgelehnt', vorbei: 'Reise vorbei' };

// Volle Jahre zwischen zwei ISO-Daten.
export function jahreSeit(von, bis) {
  const [a, b, c] = von.split('-').map(Number), [x, y, z] = bis.split('-').map(Number);
  return x - a - ((y < b || (y === b && z < c)) ? 1 : 0);
}

export function pruefeFahrfreigabe(f, heute, ids) {
  const e = [];
  if (!(f.person || '').trim()) e.push('Bitte den Namen der Person angeben, die fahren soll.');
  if (!(f.bez || '').trim()) e.push('Bitte angeben, wer die Person ist (z. B. Partner von Nanouk).');
  if (!(f.grund || '').trim()) e.push('Bitte den Grund angeben (der Familienrat gibt nur in begründeten Fällen frei).');
  if (!datumGueltig(f.von) || !datumGueltig(f.bis)) e.push('Bitte Beginn und Ende der Reise angeben.');
  else {
    if (f.bis < f.von) e.push('Das Ende liegt vor dem Beginn.');
    if (f.bis < heute) e.push('Die Reise ist schon vorbei. Die Freigabe muss vor der Reise erfolgen.');
    else if (f.von < heute) e.push('Die Reise hat schon begonnen. Die Freigabe muss vor der Reise erfolgen.');
  }
  if (!f.ausweis) e.push('Bitte bestätigen: Der Führerausweis wurde geprüft.');
  if (!Number.isInteger(f.alter) || f.alter < 18 || f.alter > 99) e.push('Bitte den Jahrgang der Person angeben (mindestens 18 Jahre alt).');
  if (!datumGueltig(f.pruefung || '')) e.push('Bitte das Datum der Führerprüfung angeben.');
  else if (f.pruefung > heute) e.push('Die Führerprüfung kann nicht in der Zukunft liegen.');
  else if (Number.isInteger(f.alter) && f.alter >= 18 && jahreSeit(f.pruefung, heute) > f.alter - 18) e.push('Alter und Datum der Führerprüfung passen nicht zusammen (die Prüfung wäre vor dem 18. Geburtstag gewesen).');
  if (!f.versicherung) e.push('Bitte bestätigen: Die Haftpflichtversicherung der Person deckt das Fahren fremder Fahrzeuge.');
  if (!f.haftung) e.push('Bitte bestätigen: Du trägst im Schadenfall den Selbstbehalt und alle nicht versicherten Kosten.');
  if (!f.mitEig || !(ids || []).includes(f.mitEig)) e.push('Bitte wählen, welche Eigentümerin oder welcher Eigentümer im Fahrzeug mitreist.');
  return { ok: e.length === 0, fehler: e };
}

// aktionen: Eintraege mit art 'FahrAntwort' (freigabeId, personId, stimme). Vorschlagende/r zaehlt als Ja.
export function fahrfreigabeStand(f, aktionen, ids, heute) {
  const antworten = {};
  for (const a of aktionen || []) if (a.art === 'FahrAntwort' && a.freigabeId === f.id && ids.includes(a.personId) && a.personId !== f.erfasstVon && ['ja', 'nein'].includes(a.stimme)) antworten[a.personId] = a;
  const andere = ids.filter((i) => i !== f.erfasstVon);
  const ohneAntwort = andere.filter((i) => !antworten[i]);
  const nein = andere.filter((i) => antworten[i] && antworten[i].stimme === 'nein');
  const jaVon = andere.filter((i) => antworten[i] && antworten[i].stimme === 'ja');
  const ja = 1 + jaVon.length;
  const n = ids.length;
  let status;
  if (ja >= n - 1 && ja > nein.length) status = 'freigegeben';
  else if (n - nein.length < n - 1 || ohneAntwort.length === 0) status = 'abgelehnt';
  else status = 'offen';
  if (f.bis < heute) status = status === 'freigegeben' ? 'vorbei' : status;
  return { antworten, ohneAntwort, nein, jaVon, ja, status };
}

// =====================================================================
// Fragen an die Familie (Rubrik «Fragen»): Entscheide, die alle vier mittragen muessen (zum Beispiel: darf Marokko bereist werden?).
// Einstimmig: Angenommen ist eine Frage nur, wenn ALLE Ja sagen. Ein einziges Nein genuegt zur Ablehnung. Schweigen gilt NICHT
// als Ja und es gibt keine Frist: die Frage bleibt offen, bis alle geantwortet haben. Wer fragt, zaehlt als Ja.
// Ein entschiedener Fall bleibt unveraendert als Dokumentation erhalten (wer, wann, wie geantwortet hat).
// Liegt in der Sammlung 'termine' (art 'Frage' und 'FrageAntwort'), damit keine neue Datenbankregel noetig ist.
// =====================================================================
export const FRAGE_STATUS = { offen: 'Antworten offen', angenommen: 'Angenommen', abgelehnt: 'Abgelehnt' };
export const FRAGE_ANHANG_MAX = 3, FRAGE_PDF_MAX = 400000, FRAGE_ANHANG_SUMME = 750000, FRAGE_BILD_MAX = 650000;   // Zeichen (Text-Form der Datei); Firestore erlaubt 1 MiB pro Eintrag
export const FRAGE_TITEL_MAX = 80, FRAGE_TEXT_MAX = 600, FRAGE_GRUND_MAX = 300;
export function pruefeFrage(f) {
  const e = [];
  const t = (f.titel || '').trim(), x = (f.text || '').trim();
  if (!t) e.push('Bitte die Frage kurz formulieren (z. B. «Darf Marokko bereist werden?»).');
  else if (t.length > FRAGE_TITEL_MAX) e.push(`Die Frage ist zu lang (höchstens ${FRAGE_TITEL_MAX} Zeichen). Details bitte in die Begründung schreiben.`);
  if (!x) e.push('Bitte die Begründung angeben: Warum wird gefragt, was ändert sich?');
  else if (x.length > FRAGE_TEXT_MAX) e.push(`Die Begründung ist zu lang (höchstens ${FRAGE_TEXT_MAX} Zeichen).`);
  if (f.anhaenge !== undefined) {
    const an = f.anhaenge;
    if (!Array.isArray(an) || an.length > FRAGE_ANHANG_MAX) e.push(`Höchstens ${FRAGE_ANHANG_MAX} Anhänge pro Frage.`);
    else {
      let summe = 0;
      for (const x of an) {
        const ok = x && typeof x.name === 'string' && x.name.length > 0 && x.name.length <= 80 && typeof x.daten === 'string'
          && ((x.typ === 'bild' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x.daten) && x.daten.length <= FRAGE_BILD_MAX)
           || (x.typ === 'pdf' && /^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(x.daten) && x.daten.length <= FRAGE_PDF_MAX));
        if (!ok) { e.push('Ein Anhang ist ungültig oder zu gross (Bilder werden verkleinert, PDF höchstens etwa 300 KB). Bitte neu auswählen.'); break; }
        summe += x.daten.length;
      }
      if (summe > FRAGE_ANHANG_SUMME) e.push('Die Anhänge sind zusammen zu gross. Bitte weniger oder kleinere Dateien wählen.');
    }
  }
  return { ok: e.length === 0, fehler: e };
}
// aktionen: Eintraege mit art 'FrageAntwort' (frageId, personId, stimme, grund). Gezaehlt wird je Person die erste Antwort.
export function frageStand(f, aktionen, ids, heute) {
  const antworten = {};
  const alle = [...(aktionen || [])].filter((a) => a.art === 'FrageAntwort' && a.frageId === f.id && ids.includes(a.personId) && a.personId !== f.erfasstVon && ['ja', 'nein'].includes(a.stimme))
    .sort((a, b) => ((a.erfasstAm || '') < (b.erfasstAm || '') ? -1 : (a.erfasstAm || '') > (b.erfasstAm || '') ? 1 : 0));
  for (const a of alle) if (!antworten[a.personId]) antworten[a.personId] = a;
  const andere = ids.filter((i) => i !== f.erfasstVon);
  const nein = andere.filter((i) => antworten[i] && antworten[i].stimme === 'nein');
  const jaVon = andere.filter((i) => antworten[i] && antworten[i].stimme === 'ja');
  const ohneAntwort = andere.filter((i) => !antworten[i]);
  const ja = (ids.includes(f.erfasstVon) ? 1 : 0) + jaVon.length;
  let status = 'offen';
  if (nein.length > 0) status = 'abgelehnt';
  else if (ohneAntwort.length === 0 && ja === ids.length) status = 'angenommen';
  // Zeitpunkt des Entscheids: die Antwort, die die Frage entschieden hat (erstes Nein, sonst die letzte Ja-Antwort)
  let entschiedenAm = '';
  if (status === 'abgelehnt') entschiedenAm = antworten[nein[0]] ? nein.map((i) => antworten[i].erfasstAm || '').sort()[0] : '';
  else if (status === 'angenommen') entschiedenAm = jaVon.map((i) => antworten[i].erfasstAm || '').sort().slice(-1)[0] || '';
  // Frist wie bei Wünschen (5 Tage ab Fragedatum). Sie ändert nichts am Ergebnis: Schweigen ist kein Ja, die Frage bleibt offen.
  const frist = /^\d{4}-\d{2}-\d{2}$/.test(f.datum || f.faelligAm || '') ? addTage(f.datum || f.faelligAm, WUNSCH_FRIST_TAGE) : '';
  const ueberfaellig = status === 'offen' && !!frist && !!heute && heute > frist;
  return { antworten, ohneAntwort, nein, jaVon, ja, status, entschiedenAm, gesamt: ids.length, frist, ueberfaellig };
}

// =====================================================================
// Notfallkarte (13.11.2026): Angaben zum Fahrzeug und Telefonnummern. Liegen in der Sammlung 'notfall'.
// Jede Angabe ist ein eigener Eintrag (id fz_<Schluessel>), jede Telefonnummer gehoert der Person (id p_<Person>).
// Wie ueberall gilt: Wer einen Eintrag erfasst hat, den aendert nur diese Person.
// Die Notfallkarte (notfall.html) laeuft ohne Netz. Dafuer speichert die App bei jedem Laden einen Auszug im Handy (notfallAuszug).
// =====================================================================
export const NOTFALL_FELDER = [
  ['kennzeichen', 'Kennzeichen', 'z. B. GR 12345'],
  ['fahrzeug', 'Fahrzeug', 'Marke, Modell, Farbe'],
  ['hoehe', 'Höhe in Metern', 'z. B. 2.65 (Tunnel, Brücken)'],
  ['breite', 'Breite in Metern', 'z. B. 2.05'],
  ['laenge', 'Länge in Metern', 'z. B. 5.99'],
  ['gewicht', 'Gesamtgewicht in kg', 'zulässiges Gesamtgewicht laut Fahrzeugausweis'],
  ['reifen', 'Reifendruck in bar', 'vorne und hinten'],
  ['treibstoff', 'Treibstoff und AdBlue', 'z. B. Diesel, AdBlue ja'],
  ['gas', 'Gas', 'Flaschentyp und Ort der Flasche'],
  ['versicherung', 'Versicherung', 'Gesellschaft und Telefon (Haftpflicht, Kasko)'],
  ['police', 'Policennummer', ''],
  ['schutzbrief', 'Schutzbrief / Pannenhilfe', 'Name und Telefon, auch fürs Ausland'],
  ['hinweis', 'Wichtig für Helfer', 'z. B. Aufstelldach, Gasflasche im Bodenfach'],
];
export const NOTFALL_DOKUMENTE = [['ausweis', 'Fahrzeugausweis'], ['vnachweis', 'Versicherungsnachweis']];   // Foto, lesbar, ohne Netz
export const NOTFALL_WERT_MAX = 200, NOTFALL_TEL_MAX = 30, NOTFALL_MED_MAX = 200, NOTFALL_DOK_MAX = 400000;
export const notfallFeldIds = () => [...NOTFALL_FELDER.map((f) => f[0]), ...NOTFALL_DOKUMENTE.map((f) => f[0])];
export function pruefeNotfallTel(tel) {
  const t = String(tel || '').trim();
  if (!t) return [];
  return /^\+?[0-9][0-9 ]{5,28}$/.test(t) ? [] : ['Die Telefonnummer darf nur Ziffern und Leerzeichen enthalten, im Ausland mit + und Landesvorwahl (z. B. +41 79 123 45 67).'];
}
export function notfallFehlt(d) {
  const e = Object.values(d.notfall || {});
  const fz = new Set(e.filter((x) => x.art === 'fz' && (x.wert || x.foto)).map((x) => x.schluessel));
  const fehlt = notfallFeldIds().filter((k) => !fz.has(k));
  const ohneTel = Object.keys(d.personen || {}).filter((p) => !e.some((x) => x.art === 'person' && x.personId === p && (x.tel || '').trim()));
  return { fehlt, ohneTel, gesamt: notfallFeldIds().length + Object.keys(d.personen || {}).length };
}
// Auszug fuer die Notfallkarte: alles, was ohne Netz angezeigt wird. Reine Daten, keine PINs.
export function notfallAuszug(d, heute, jetzt) {
  const e = Object.values(d.notfall || {});
  const fz = {};
  for (const x of e) if (x.art === 'fz') fz[x.schluessel] = { wert: x.wert || '', foto: x.foto || '' };
  const personen = Object.entries(d.personen || {}).map(([id, p]) => {
    const x = e.find((y) => y.art === 'person' && y.personId === id) || {};
    return { id, name: p.name, tel: x.tel || '', medizin: x.medizin || '' };
  });
  const nm = (id) => d.personen?.[id]?.name || '?';
  const b = Object.values(d.buchungen || {}).filter((x) => x.von <= heute && heute <= x.bis).sort((a, c) => (a.von < c.von ? 1 : -1))[0];
  const reise = b ? { fahrer: b.fahrerId ? nm(b.fahrerId) : (b.ausnahmeFahrer?.name || '?'), mit: (b.mitreisende || []).map(nm), gaeste: b.gaeste || 0, ziel: b.ziel || '', von: b.von, bis: b.bis } : null;
  const u = Object.values(d.uebergaben || {}).filter((x) => x.datumZeit).sort((a, c) => (a.datumZeit < c.datumZeit ? 1 : -1))[0];
  const letzte = u ? {
    wann: u.datumZeit, phase: u.phase, km: Number.isFinite(u.km) ? u.km : null, tank: u.tank || '', schaeden: (u.schaeden || '').trim(), bemerkung: (u.bemerkung || '').trim(),
    maengel: CHECKPUNKTE.filter(([k]) => u.punkte?.[k] === 'nein').map(([, t]) => t),
  } : null;
  return { v: 1, stand: jetzt, fz, personen, reise, letzte };
}

// =====================================================================
// Unsere Orte (13.11.2026): nur ausserordentlich gute Stellplaetze und Campingplaetze, mit Bild und kurzer Beschreibung.
// Huerden gegen Mittelmass: (1) nur von einer eigenen, beendeten Reise, (2) ein Ort pro Reise und Person, (3) hoechstens
// 3 Orte pro Person und Jahr, (4) Foto und Begruendung sind Pflicht, (5) andere bestaetigen («war auch dort»).
// Orte liegen in 'orte', Bestaetigungen in 'ortstimmen' (id <ortId>_<Person>).
// =====================================================================
export const ORT_PRO_JAHR = 3, ORT_FOTO_MAX = 250000, ORT_TEXT_MIN = 30, ORT_TEXT_MAX = 300, ORT_PRAKTISCH_MAX = 150, ORT_FAVORIT_AB = 2;
export const ORT_ARTEN = ['Campingplatz', 'Stellplatz', 'Bauernhof', 'Gasthof', 'Anderer Platz mit Erlaubnis'];
export const ORT_LAENDER = ['Schweiz', 'Liechtenstein', 'Frankreich', 'Italien', 'Spanien', 'Portugal', 'Deutschland', 'Österreich', 'Belgien', 'Niederlande', 'Luxemburg', 'Dänemark', 'Schweden', 'Norwegen', 'Finnland', 'Island', 'Irland', 'Vereinigtes Königreich', 'Tschechien', 'Slowakei', 'Polen', 'Ungarn', 'Slowenien', 'Kroatien', 'Bosnien-Herzegowina', 'Montenegro', 'Albanien', 'Nordmazedonien', 'Griechenland', 'Bulgarien', 'Estland', 'Lettland', 'Litauen', 'Zypern', 'Malta'];
export function pruefeOrt(o, ctx) {
  const f = [], heute = ctx.heute, jahr = String(heute).slice(0, 4);
  const titel = (o.titel || '').trim(), ort = (o.ort || '').trim(), text = (o.text || '').trim();
  if (titel.length < 3 || titel.length > 60) f.push('Bitte den Namen des Ortes angeben (3 bis 60 Zeichen).');
  if (!ORT_LAENDER.includes(o.land)) f.push('Bitte das Land wählen.');
  if (ort.length < 2 || ort.length > 60) f.push('Bitte die Ortschaft oder Gegend angeben.');
  if (!ORT_ARTEN.includes(o.art)) f.push('Bitte die Art des Ortes wählen.');
  if (text.length < ORT_TEXT_MIN) f.push(`Bitte kurz beschreiben, was diesen Ort aussergewöhnlich macht (mindestens ${ORT_TEXT_MIN} Zeichen, du hast ${text.length}).`);
  if (text.length > ORT_TEXT_MAX) f.push(`Die Beschreibung ist zu lang (höchstens ${ORT_TEXT_MAX} Zeichen). Kurz fassen: nur das Besondere.`);
  if ((o.praktisch || '').length > ORT_PRAKTISCH_MAX) f.push(`«Praktisches» ist zu lang (höchstens ${ORT_PRAKTISCH_MAX} Zeichen).`);
  if (o.wiederHin !== true) f.push('Bitte bestätigen: Du würdest für diesen Ort extra wieder hinfahren. Sonst gehört er nicht in die Liste.');
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(o.foto || '')) f.push('Ein Foto ist Pflicht. Ein Ort ohne Bild kommt nicht in die Liste.');
  else if (o.foto.length > ORT_FOTO_MAX) f.push('Das Foto ist zu gross.');
  const hat = (o.lat !== undefined && o.lat !== null) || (o.lon !== undefined && o.lon !== null);
  if (hat && !(Number.isFinite(o.lat) && o.lat >= -90 && o.lat <= 90 && Number.isFinite(o.lon) && o.lon >= -180 && o.lon <= 180)) f.push('Der Standort ist ungültig.');
  const b = (ctx.buchungen || {})[o.buchungId];
  if (!b) f.push('Bitte die Reise wählen, auf der du dort warst. Nur Orte von eigenen Reisen sind erlaubt.');
  else {
    if (!(b.fahrerId === o.erfasstVon || (b.mitreisende || []).includes(o.erfasstVon))) f.push('Du warst auf dieser Reise nicht dabei. Nur wer dort war, kann einen Ort eintragen.');
    if (!(b.bis <= heute)) f.push('Diese Reise ist noch nicht vorbei. Den Ort bitte nach der Rückkehr eintragen.');
    if ((ctx.orte || []).some((x) => x.id !== o.id && x.buchungId === o.buchungId && x.erfasstVon === o.erfasstVon)) f.push('Von dieser Reise hast du schon einen Ort eingetragen. Pro Reise zählt nur dein bester Ort.');
  }
  const dieses = (o.erfasstAm || heute).slice(0, 4) || jahr;
  const n = (ctx.orte || []).filter((x) => x.id !== o.id && x.erfasstVon === o.erfasstVon && (x.erfasstAm || '').slice(0, 4) === dieses).length;
  if (n >= ORT_PRO_JAHR) f.push(`Du hast dieses Jahr schon ${ORT_PRO_JAHR} Orte eingetragen. Mehr geht nicht: Die Liste soll nur das Allerbeste enthalten. Einen eigenen Ort löschen macht einen Platz frei.`);
  return { ok: f.length === 0, fehler: f, platzFrei: Math.max(0, ORT_PRO_JAHR - n) };
}
export function ortStand(o, stimmen) {
  const von = [...new Set(Object.values(stimmen || {}).filter((s) => s.ortId === o.id && s.personId !== o.erfasstVon).map((s) => s.personId))];
  return { bestaetigt: von, anzahl: von.length, favorit: von.length >= ORT_FAVORIT_AB };
}
export function ortReihenfolge(orte, stimmen) {
  return orte.map((o) => ({ o, s: ortStand(o, stimmen) })).sort((a, b) => (b.s.favorit - a.s.favorit) || (b.s.anzahl - a.s.anzahl) || ((b.o.erfasstAm || '') < (a.o.erfasstAm || '') ? -1 : 1));
}
