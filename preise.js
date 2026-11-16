// Womo: Preisvergleich Camping. Reine Rechnung, keine Produkte und keine Preise im Code (die Familie tippt sie selbst ein).
// Nur Schweizer Shops. Versandbedingungen: abgelesen am 16.11.2026 von den Shop-Seiten.
export const INF = 1e9;
export const STAND = '16.11.2026';
export const MAX_POSTEN = 12, MAX_MENGE = 99, NAME_MAX = 80, PREIS_MAX = 100000;

// stufen: [bis Bestellwert (einschliesslich), Versand]. minder: Zuschlag bei kleinem Warenwert.
export const SHOPS = [
  { id: 'berger', n: 'Berger CH', such: 'https://www.berger-camping.ch/suche/?q=', stufen: [[100, 19.95], [300, 9.95], [INF, 0]],
    versand: 'bis CHF 100: 19.95, bis CHF 300: 9.95', gratis: 'ab CHF 300', besonders: 'Sperrgut +49.95', hinweis: 'Sperrgut kostet CHF 49.95 extra.' },
  { id: 'schlanser', n: 'Schlanser Flums', such: 'https://www.schlanser.ch/search?search=', stufen: [[INF, 9]],
    versand: 'CHF 9.– (DPD)', gratis: 'keine (im Warenkorb bis CHF 627.– geprüft)', besonders: 'Spedition +30 nur bei markierter Gross-Ausrüstung', hinweis: 'Keine Gratisgrenze. Bei grossen, schweren Artikeln kann im Warenkorb ein Speditionszuschlag von CHF 30.– dazukommen.' },
  { id: 'campingshop', n: 'Campingshop', such: 'https://www.campingshop.ch/search?search=', stufen: [[150, 10.90], [INF, 0]],
    versand: 'bis CHF 150: 10.90', gratis: 'ab CHF 150', besonders: 'Sperrgut 90.– (ab 30 kg oder über 2 m)', hinweis: 'Sperrgut (ab 30 kg oder über 2 m) kostet CHF 90.–.' },
  { id: 'cb24', n: 'Campingbedarf 24', such: 'https://campingbedarf24.ch/search/?qs=', stufen: [[150, 12.95], [INF, 0]], minder: { unter: 50, fee: 9 },
    versand: 'unter CHF 150: 12.95 (DHL)', gratis: 'ab CHF 150', besonders: 'Mindermengenzuschlag 9.– unter etwa CHF 50; Sperrgut, Spedition, Berggebiet extra', hinweis: 'Mindermengenzuschlag 9.– unter etwa CHF 50 (bei 48.70 ja, bei 57.05 nein).' },
  { id: 'galaxus', n: 'Galaxus', such: 'https://www.galaxus.ch/de/search?q=', stufen: [[50, 4.90], [INF, 0]],
    versand: 'unter CHF 50: 4.90', gratis: 'ab CHF 50', besonders: 'Direktlieferung anderer Händler möglich', hinweis: 'Bei Artikeln anderer Händler kann der Versand abweichen. Der Warenkorb entscheidet.' },
  { id: 'gonser', n: 'Gonser', such: 'https://www.gonser.ch/search/?term=', stufen: [[INF, 0]],
    versand: 'gratis (Kleinartikel «GONSERBOX» 6.90)', gratis: 'Kleinartikel ab CHF 35', besonders: 'Stückgut per Spedition', hinweis: 'Kleinartikel: «GONSERBOX» 6.90, gratis ab CHF 35 Kleinartikel. Hier nicht eingerechnet.' },
  { id: 'decathlon', n: 'Decathlon', such: 'https://www.decathlon.ch/de/search?Ntt=', stufen: [[50, 7], [INF, 0]],
    versand: 'bis CHF 50: 7.– (laut AGB)', gratis: 'über CHF 50', besonders: 'Pakete über 30 kg oder 2.5 m: 49.–. Marketplace zählt nicht', hinweis: 'Gratis über CHF 50 nur mit Decathlon-Artikeln, Marketplace zählt nicht. Pakete über 30 kg oder 2.5 m: 49.–.' },
  { id: 'venova', n: 'Venova', such: 'https://www.venova.ch/de/search?q=', stufen: [[INF, 10]],
    versand: 'Post 5.– / 10.– (Economy) / 12.–', gratis: 'keine angegeben', besonders: 'Sperrgut +15, Express 30.–', hinweis: 'Keine Gratisgrenze angegeben. Gerechnet mit Post Economy 10.–, nicht im Warenkorb getestet.' },
];

export const suchLink = (shop, text) => shop.such + encodeURIComponent(String(text || '').trim());

// «12.5», «12,50», «1'234.50» oder «1 234,5» -> Zahl; leer oder ungültig -> null. Höchstens zwei Nachkommastellen.
export function parsePreis(s) {
  if (typeof s === 'number') return Number.isFinite(s) && s > 0 && s <= PREIS_MAX ? Math.round(s * 100) / 100 : null;
  const t = String(s ?? '').trim().replace(/[\s'’]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t); return n > 0 && n <= PREIS_MAX ? n : null;
}

// posten: [{ name, menge, preise: { shopId: Text oder Zahl } }]. Rechnet in Rappen, damit keine Rundungsfehler entstehen.
export function rechneShop(shop, posten) {
  const gewaehlt = posten.filter((p) => p.menge > 0);
  const fehlt = [];
  let rappen = 0;
  for (const p of gewaehlt) {
    const pr = parsePreis(p.preise?.[shop.id]);
    if (pr == null) { fehlt.push(p.name); continue; }
    rappen += Math.round(pr * 100) * p.menge;
  }
  const ware = rappen / 100, hat = gewaehlt.length - fehlt.length;
  let versand = 0, next = null;
  if (hat > 0) {
    for (let i = 0; i < shop.stufen.length; i++) {
      if (ware <= shop.stufen[i][0]) {
        versand = shop.stufen[i][1];
        if (i < shop.stufen.length - 1 && versand !== 0) next = { bis: shop.stufen[i][0], fee: shop.stufen[i + 1][1] };
        break;
      }
    }
  }
  const minder = shop.minder && hat > 0 && ware < shop.minder.unter ? shop.minder.fee : 0;
  const total = Math.round((rappen + Math.round(versand * 100) + Math.round(minder * 100))) / 100;
  return { shop, ware, versand, minder, total, fehlt, hat, voll: gewaehlt.length > 0 && fehlt.length === 0, next };
}

// Rangliste: erst Shops mit allen Preisen (günstigster zuerst), dann Shops mit Lücken, dann Shops ganz ohne Preis.
export function vergleich(posten) {
  const res = SHOPS.map((s) => rechneShop(s, posten));
  const sort = (a, b) => a.total - b.total || a.shop.n.localeCompare(b.shop.n, 'de');
  return {
    voll: res.filter((r) => r.voll).sort(sort),
    teil: res.filter((r) => !r.voll && r.hat > 0).sort(sort),
    keine: res.filter((r) => r.hat === 0),
  };
}

// Gespeicherte Liste prüfen (aus localStorage): ungültige Teile verwerfen.
export function bereinige(x) {
  const out = [];
  if (!Array.isArray(x)) return out;
  for (const p of x.slice(0, MAX_POSTEN)) {
    if (!p || typeof p !== 'object') continue;
    const name = String(p.name ?? '').trim().slice(0, NAME_MAX); if (!name) continue;
    const menge = Math.max(1, Math.min(MAX_MENGE, Math.round(Number(p.menge)) || 1));
    const preise = {};
    for (const s of SHOPS) { const v = p.preise?.[s.id]; if (v != null && String(v).trim() !== '') preise[s.id] = String(v).slice(0, 12); }
    out.push({ id: String(p.id || name + out.length).slice(0, 40), name, menge, preise });
  }
  return out;
}
