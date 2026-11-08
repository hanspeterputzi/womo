// Womo-Reservierung: Regelfunktionen (Stand 07.11.2026)
// Reine Berechnung ohne Datenbank. Laeuft im Browser und in Node.
// Grundlage: womo-datenmodell-entwurf.md. Zahlen kommen nur aus der Berechnung.

export const SCHWELLE = { 'eltern': 183, 'kind-1': 92, 'kind-2': 92 };
export const MAX_PERSONEN = 4;

const MS_TAG = 86400000;
const tagNr = (iso) => {
  const [j, m, t] = iso.split('-').map(Number);
  return Date.UTC(j, m - 1, t) / MS_TAG;
};

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

// Kontostaende pro Konto im Jahr J, mit Teilungsregel fuer beide Kinder allein.
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
    const h = Math.floor(t / 2);
    const stand1 = r['kind-1'], stand2 = r['kind-2'];
    r['kind-1'] += h; r['kind-2'] += h;
    if (t % 2) {
      let extra;
      if (stand1 !== stand2) extra = stand1 < stand2 ? 'kind-1' : 'kind-2';
      else {
        const e = personen[b.erfasstVon] && personen[b.erfasstVon].konto;
        extra = (e === 'kind-1' || e === 'kind-2') ? e : 'kind-1';
      }
      r[extra] += 1;
    }
  }
  return r;
}

// Warnstufe: gelb ab 90 % der Schwelle, rot darueber. Nur Anzeige.
export function stufe(tageImJahr, konto) {
  const s = SCHWELLE[konto];
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.von || '') || !/^\d{4}-\d{2}-\d{2}$/.test(b.bis || '')) fehler.push('Datum fehlt oder hat ein falsches Format.');
  else if (b.von > b.bis) fehler.push('Die Rückkehr liegt vor der Abreise.');
  else if (dauer(b) > MAX_TAGE) fehler.push(`Eine Reservierung darf höchstens ${MAX_TAGE} Tage dauern.`);
  const eig = eigentuemer(b, personen);
  if (eig.length === 0) fehler.push('Mindestens ein Eigentümer muss im Fahrzeug sitzen.');
  if (!b.fahrerId) {
    const a = b.ausnahmeFahrer;
    if (!(a && a.name && a.freigabeAm && a.freigabeAm < b.von && personen[a.verantwortlichId]))
      fehler.push('Ohne Eigentümer als Fahrer braucht es die Freigabe des Familienrats vor der Reise und einen verantwortlichen Eigentümer.');
  }
  if (eig.length + (b.gaeste || 0) > MAX_PERSONEN) fehler.push('Mehr als 4 Personen im Fahrzeug.');
  return { ok: fehler.length === 0, fehler };
}

// =====================================================================
// Version 2: Uebergabe-Checkliste (Anhang B) und Kilometerstand
// =====================================================================
export const TANK = ['auf Reserve', '1/6', '1/3', '1/2', '2/3', '5/6', 'voll'];
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
  if (!Number.isInteger(u.km) || u.km < 0 || u.km > 999999) fehler.push('Kilometerstand fehlt oder ist ungültig.');
  if (!TANK.includes(u.tank)) fehler.push('Tankstand fehlt.');
  else if (u.tank !== 'voll') fehler.push('Der Tank muss voll sein (Vertrag Ziffer 10). Bei der Rückgabe immer, und damit auch bei der Übergabe an den Nächsten. Bitte zuerst volltanken.');
  const offen = CHECKPUNKTE.filter(([k]) => u.punkte?.[k] !== 'ja' && u.punkte?.[k] !== 'nein');
  if (offen.length) fehler.push(`Bitte bei jedem Punkt Ja oder Nein wählen (noch offen: ${offen.length}).`);
  const nein = CHECKPUNKTE.filter(([k]) => u.punkte?.[k] === 'nein');
  if (nein.length && !(u.bemerkung || '').trim()) fehler.push('Bei Nein bitte den Mangel in der Bemerkung beschreiben.');
  if (u.phase === 'rueck' && u.schluessel !== 'ja') fehler.push('Bitte zuerst den Schlüssel am Schlüsselbrett hinterlegen. Papa is watching you. 😉');
  if (Number.isInteger(u.km) && u.km >= 0) { const p = kmPlausibel(u, uebergaben, buchungen); if (!p.ok) fehler.push(p.text); }
  return { ok: fehler.length === 0, fehler };
}

// Statistik: aktueller Stand, gefahrene km je Reise, km im Jahr (Zuordnung nach Abreisetag).
export function kmStatistik(uebergaben, buchungen, J) {
  const proBuchung = {};
  let stand = 0;
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
export const DARLEHEN_CHF = [360, 600, 840, 1080, 1320, 1560, 1800, 2040];     // Anhang A, nur Tochter und Sohn, bei Kaufpreis CHF 60 000
export const FRIST_TAGE = 10;                                                    // Vertrag Ziffer 4, Zahlungsverzug
export const KOSTENARTEN = {
  betrieb: 'Laufende Kosten (Versicherung, Steuer, Vignette, Konto, Kleines)',
  ruecklage: 'Reparatur, Reifen, grosser Service (zuerst aus der Rücklage)',
  selbstbehalt: 'Selbstbehalt nach Schaden (Verursacher)',
  praemie: 'Bonusverlust und höhere Prämie nach Schaden',
};
export const ZWECKE = { betrieb: 'Laufende Kosten', ruecklage: 'Rücklage', darlehen: 'Darlehensrate', sonst: 'Anderes' };
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
