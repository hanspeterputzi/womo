// Highlights für 2–3 Nächte: besonders schöne Plätze. HP wählt aus, Claude trägt hier ein (kein Firebase nötig).
// Neues Foto: Datei in den Hauptordner legen (Name platz-….jpg), Pfad bei «foto» eintragen.
export const PLAETZE = [
  {
    id: 'morteratsch', titel: 'Camping Morteratsch', ort: 'Pontresina', land: 'Schweiz', region: 'Engadin', art: 'Campingplatz',
    text: 'Campieren mitten in der Natur zwischen Bach und See. Fantastische Bergwelt. Bike- und Wanderparadies.',
    preis: 'ca. CHF 50–59 (Wohnmobil, 2 Erwachsene, mit Strom)', preisStand: '2026-11-25', strom: 'ja', wc: 'ja', dusche: 'ja',
    hinweis: 'Sommer 2027: Mindestaufenthalt 7 Nächte. Kurzaufenthalte erst 30 Tage im Voraus buchbar. Hochsaison 26.6.–16.8., im Juli und August oft ausgebucht.',
    link: 'https://www.camping-morteratsch.ch/', foto: 'platz-morteratsch.jpg', lat: 46.4616, lon: 9.9355,
  },
  {
    id: 'ustaria-la-stalla', titel: 'Ustaria la Stalla', ort: 'Ardez (Unterengadin)', land: 'Schweiz', region: 'Engadin', art: 'Stellplatz',
    text: 'Bauernhof mit Restaurant. Stellplatz auf der Wiese mit Sicht auf Wald, Berge und Himmel. Nationalpark, Naturbadesee Ftan, Bike-, Wander- und Kletterwege in der Nähe.',
    preis: 'ab CHF 46 (1 Person, ohne Kurtaxe)', preisStand: '2026-11-25', strom: 'ja', wc: 'ja', dusche: 'ja',
    hinweis: 'Verlängerungskabel mitbringen. WC und Dusche im Restaurant, bis 5 Minuten zu Fuss. 3 Plätze, Check-in 14–24 Uhr selbständig. Keine Entsorgung von Grau- und Schwarzwasser.',
    link: 'https://nomady.camp/cabin/ustaria-la-stalla-unterengadin-117', foto: 'platz-ustaria-la-stalla.jpg', lat: 46.774, lon: 10.1935,
  },
  {
    id: 'muntanela', titel: 'Camp Muntanela', ort: 'Parsonz (Radons), Val Surses', land: 'Schweiz', region: 'Mittelbünden', art: 'Stellplatz',
    text: 'Einfaches Camp auf der Bergwiese auf 1895 m mit Aussicht auf die Berge, neben dem Restaurant Muntanela. Ruhe, Sonne, Wander- und Bikewege. Gästekarte Val Surses inklusive (Bergbahnen gratis).',
    preis: 'ab CHF 42 (1 Person, ohne Kurtaxe)', preisStand: '2026-11-25', strom: 'nein', wc: 'ja', dusche: 'ja',
    hinweis: 'Kein Strom. 8 Plätze für Campervans. Im Mai Restaurant zu, Sanitär nur sporadisch kontrolliert. Warmwasser begrenzt. Keine Entsorgung von Grau- und Schwarzwasser.',
    link: 'https://nomady.camp/cabin/camp-muntanela-fur-campervans-467', foto: 'platz-muntanela.jpg', lat: 46.5585, lon: 9.5506,
  },
];
