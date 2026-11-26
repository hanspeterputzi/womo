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
  {
    id: 'lauerzersee', titel: 'Bauernhof Camping über dem Lauerzersee', ort: 'Lauerz (SZ)', land: 'Schweiz', region: 'übrige Schweiz', art: 'Stellplatz',
    text: 'Stellplatz auf der Wiese eines Bauernhofs auf 900 m, hoch über dem Lauerzersee. Weite Aussicht, kein Durchgangsverkehr. Grill, Feuerstelle und Picknicktisch.',
    preis: 'ab CHF 43 (1 Person, ohne Kurtaxe)', preisStand: '2026-11-25', strom: 'ja', wc: 'ja', dusche: 'nein',
    hinweis: 'Strom CHF 3 pro Nacht, Verlängerungskabel mitbringen. Komposttoilette, keine Dusche, keine Entsorgung auf dem Hof. 4 Plätze, Check-in 16–19.30 Uhr.',
    link: 'https://nomady.camp/cabin/bauernhof-camping-uber-dem-lauerzersee-4362', foto: 'platz-lauerzersee.jpg',
  },
  {
    id: 'sempach', titel: 'TCS Camping Sempach', ort: 'Sempach (LU)', land: 'Schweiz', region: 'übrige Schweiz', art: 'Campingplatz',
    warnung: 'Beim Buchen: «Regular», «Premium Comfort See» und Plätze bis 3 t passen nicht für den Pössl (3,5 t).',
    text: 'Direkt am Sempachersee mit freiem Seebad. Restaurant Seeland am See gleich nebenan. Velowege: Tour rund um den See (31,6 km), Herzroute 99. Spazieren ins Städtli Sempach und zur Vogelwarte.',
    preis: 'ab CHF 53.60 (Nebensaison) bzw. 73.60 (Hochsaison), 2 Personen, 2027 laut PiNCAMP', preisStand: '2026-11-26', strom: 'ja', wc: 'ja', dusche: 'ja',
    hinweis: 'Passt: Standard (gekiest) oder Premium See (max. 5 t). Saison 25.3.–17.10. (PiNCAMP). Ab 13.30 Uhr, Reservation bis 18 Uhr garantiert. Entsorgungsstation.',
    link: 'https://camping.tcs.ch/de/campingplaetze/tcs-camping-sempach/', foto: 'platz-sempach.jpg', lat: 47.1242, lon: 8.1881,
  },
];
