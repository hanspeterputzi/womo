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

// Pruefung vor dem Speichern. Liefert { ok, fehler: [Text] }.
export function pruefeBuchung(b, personen) {
  const fehler = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.von || '') || !/^\d{4}-\d{2}-\d{2}$/.test(b.bis || '')) fehler.push('Datum fehlt oder hat ein falsches Format.');
  else if (b.von > b.bis) fehler.push('Die Rückkehr liegt vor der Abreise.');
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
