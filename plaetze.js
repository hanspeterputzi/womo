// Highlights für 2–3 Nächte: besonders schöne Plätze. HP wählt aus, Claude trägt hier ein (kein Firebase nötig).
// Neues Foto: Datei in den Hauptordner legen (Name platz-….jpg), Pfad bei «foto» eintragen.
export const PLAETZE = [
  {
    id: 'morteratsch', titel: 'Camping Morteratsch', ort: 'Pontresina', land: 'Schweiz', art: 'Campingplatz',
    text: 'Campieren mitten in der Natur zwischen Bach und See. Fantastische Bergwelt. Bike- und Wanderparadies.',
    preis: 'ca. CHF 50–59 (Wohnmobil, 2 Erwachsene, mit Strom)', preisStand: '2026-11-25', strom: 'ja', wc: 'ja',
    hinweis: 'Sommer 2027: Mindestaufenthalt 7 Nächte. Kurzaufenthalte erst 30 Tage im Voraus buchbar. Hochsaison 26.6.–16.8., im Juli und August oft ausgebucht.',
    link: 'https://www.camping-morteratsch.ch/', foto: 'platz-morteratsch.jpg', lat: 46.4616, lon: 9.9355,
  },
  {
    id: 'ustaria-la-stalla', titel: 'Ustaria la Stalla', ort: 'Scuol (Unterengadin)', land: 'Schweiz', art: 'Stellplatz',
    text: 'Bauernhof mit Restaurant. Stellplatz auf der Wiese mit Sicht auf Wald, Berge und Himmel. Nationalpark, Naturbadesee Ftan, Bike-, Wander- und Kletterwege in der Nähe.',
    preis: 'ab CHF 46 (1 Person, ohne Kurtaxe)', preisStand: '2026-11-25', strom: 'ja', wc: 'ja',
    hinweis: 'Verlängerungskabel mitbringen. WC und Dusche im Restaurant, bis 5 Minuten zu Fuss. 3 Plätze, Check-in 14–24 Uhr selbständig. Keine Entsorgung von Grau- und Schwarzwasser.',
    link: 'https://nomady.camp/cabin/ustaria-la-stalla-unterengadin-117', foto: 'platz-ustaria-la-stalla.jpg', lat: 46.774, lon: 10.1935,
  },
];
