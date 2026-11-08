import {
  SCHWELLE, dauer, konten, kontostaende, kontostaendeMitAlltag, pruefeAlltag, alltagTage, alltagKm, tankWarnung, stufe, kollision, ueberschneidungen, pruefeBuchung,
  TANK, CHECKPUNKTE, pruefeUebergabe, kmStatistik,
  KOSTENARTEN, ZWECKE, TERMINARTEN, kostenAnteile, eingezahlt, vertragsJahr, zahlplan, zahlungsSperre, terminStufe, rueckgabeFertig, addJahre, chf,
} from './regeln.js?v=20261108h';
import * as S from './speicher.js?v=20261108h';

const app = document.getElementById('app');
const toast = document.getElementById('toast');
const formEl = document.getElementById('form');
const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const KONTO_NAME = { 'eltern': 'Eltern', 'kind-1': 'Nanouk', 'kind-2': 'Nene' };
const REIHENFOLGE = ['hp', 'fr', 't', 's'];
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const iso = (j, m, t) => `${j}-${String(m + 1).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
const fmt = (s) => s.split('-').reverse().join('.');
const zahl = (n) => Number(n).toLocaleString('de-CH');
const FARBE = { 'hp': 'var(--hp)', 'eltern': 'var(--eltern)', 'nora': 'var(--nora)', 'kind-1': 'var(--kind-1)', 'kind-2': 'var(--kind-2)' };
// Farbe je Person: HP blau, Nora hellblau, Nanouk rosa, Nene tuerkis.
const PERSON_FARBE = { hp: 'hp', fr: 'nora', t: 'kind-1', s: 'kind-2' };
const val = (id) => document.getElementById(id).value;
const heute = () => { const d = new Date(); return iso(d.getFullYear(), d.getMonth(), d.getDate()); };

let D, ich = null, tab = 'kalender', ansicht = new Date(), jahrK = new Date().getFullYear();

// Buchhaltung: HP fuehrt sie, die Tochter ist Stellvertreterin (Vertrag Ziffer 11).
const buchhalter = () => ich === D.adminId || ich === 't';
const liste = () => Object.values(D.buchungen);
// Alltagsfahrten liegen als Eintraege mit art 'Alltag' in der Sammlung 'termine' (keine neue Datenbankregel noetig).
const termineEcht = () => Object.values(D.termine).filter((x) => x.art !== 'Alltag');
const alltagMap = () => Object.fromEntries(Object.values(D.termine).filter((x) => x.art === 'Alltag').map((x) => [x.id, x]));
// Regel (HP, 07.11.2026): Niemand aendert oder loescht einen Eintrag, den jemand anders erfasst hat. Auch HP nicht.
const eigener = (x) => !!x && !!ich && x.erfasstVon === ich;
const nurEigene = () => hinweis('Das ist ein Eintrag von ' + 'jemand anderem. Den kann nur die Person ändern, die ihn erfasst hat.');
// Farbe einer Reservierung: sitzt nur Nora von den Eltern im Fahrzeug, hellblau, sonst die Farbe des Kontos.
function farbKonto(b) {
  const k = konten(b, D.personen)[0] || 'eltern';
  if (k !== 'eltern') return k;
  const eltern = [b.fahrerId, ...(b.mitreisende || [])].filter((i) => D.personen[i]?.konto === 'eltern');
  const nur = (id) => eltern.length > 0 && eltern.every((i) => i === id);
  return nur('fr') ? 'nora' : nur('hp') ? 'hp' : 'eltern';
}
const initial = (name) => h((name || '?').trim().charAt(0).toUpperCase());
const avatar = (id) => { const p = D.personen[id]; const f = PERSON_FARBE[id] || p?.konto; return `<span class="av ${f === 'nora' ? 'nora' : ''}" style="background:${FARBE[f] || 'var(--muted)'}">${initial(p?.name)}</span>`; };
const idsGeordnet = () => { const i = Object.keys(D.personen); return [...REIHENFOLGE.filter((x) => i.includes(x)), ...i.filter((x) => !REIHENFOLGE.includes(x))]; };
const rang = (id) => { const i = REIHENFOLGE.indexOf(id); return i < 0 ? 99 : i; };
function personenGeordnet() { return Object.entries(D.personen).sort((a, b) => rang(a[0]) - rang(b[0]) || a[1].name.localeCompare(b[1].name)); }
function hinweis(text) { toast.textContent = text; clearTimeout(hinweis.t); hinweis.t = setTimeout(() => { toast.textContent = ''; }, 6000); }
function rappen(txt) { const t = String(txt).trim().replace(/['’\s]/g, '').replace(',', '.'); return /^\d+(\.\d{1,2})?$/.test(t) ? Math.round(parseFloat(t) * 100) : NaN; }
function schliessen() { formEl.innerHTML = ''; }
function sheet(inhalt) {
  formEl.innerHTML = `<div class="sheet" role="dialog"><div class="griff"></div>${inhalt}</div>`;
  formEl.onclick = (e) => { if (e.target === formEl) schliessen(); };
}
function fehler(texte) { const m = document.getElementById('msg'); if (m) m.innerHTML = `<div class="fehler">${[].concat(texte).map(h).join('<br>')}</div>`; }
async function sicher(fn) { try { await fn(); } catch (e) { fehler('Speichern fehlgeschlagen: ' + (e.message || e)); } }

async function start() {
  try { D = await S.laden(); }
  catch (e) { app.innerHTML = `<div class="login"><p class="gross" style="font-size:24px;font-weight:800">Womo</p><div class="fehler">${h(e.message || 'Verbindung fehlgeschlagen.')}</div></div>`; return; }
  S.abonnieren(D, () => { if (ich && formEl.innerHTML === '') zeige(); });
  try { const id = sessionStorage.getItem('womo-ich'); if (id && D.personen[id]) ich = id; } catch {}
  zeige();
}

function zeige() {
  if (!ich) return anmeldung();
  ({ kalender, fahrten, kosten, termine, vertrag, unterwegs })[tab]();
}

function anmeldung() {
  let zuletzt = ''; try { zuletzt = localStorage.getItem('womo-person') || ''; } catch {}
  app.innerHTML = `<div class="login"><p class="gross">Womo</p><p class="sub">Wer bist du?</p>
  <label for="p">Name</label>
  <select id="p">${personenGeordnet().map(([i, p]) => `<option value="${i}"${i === zuletzt ? ' selected' : ''}>${h(p.name)}</option>`).join('')}</select>
  <label for="pin">PIN (4 Ziffern)</label><input id="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" type="password">
  <div id="msg"></div><button id="ok">Weiter</button>
  <p class="klein-t" style="margin-top:14px">Der PIN zeigt nur, wer eine Eintragung erfasst. Er schützt keine Daten.</p></div>`;
  const los = async () => {
    const id = document.getElementById('p').value, pin = document.getElementById('pin').value;
    if (await S.pinPasst(D.personen[id], pin)) { ich = id; tab = 'kalender'; try { sessionStorage.setItem('womo-ich', id); localStorage.setItem('womo-person', id); } catch {} zeige(); }
    else document.getElementById('msg').innerHTML = `<div class="fehler">PIN für ${h(D.personen[id].name)} falsch. Name oben richtig gewählt?</div>`;
  };
  document.getElementById('ok').onclick = los;
  document.getElementById('pin').onkeydown = (e) => { if (e.key === 'Enter') los(); };
}

// ---------- Rahmen mit Kopfleiste und Tab-Leiste ----------
const ICON = {
  kalender: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  fahrten: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4v2h6V4M9 13l2 2 4-4"/>',
  kosten: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.500 0-2.500.8-2.500 2s1 1.700 2.500 2 2.500.8 2.500 2-1 2-2.500 2c-1 0-2-.5-2.500-1.500M12 6v2M12 16v2"/>',
  termine: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4"/>',
  unterwegs: '<path d="M3 20 12 5l9 15zM12 5v15M9 20l3-6 3 6"/>',
  vertrag: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
};
const TABS = [['kalender', 'Kalender'], ['termine', 'Termine'], ['fahrten', 'Fahrten'], ['kosten', 'Kosten'], ['unterwegs', 'Unterwegs'], ['vertrag', 'Vertrag']];
const SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ORTE = [
  ['u1', '<path d="M3 20 12 5l9 15zM12 5v15M9 20l3-6 3 6"/>', 'Campingplätze', 'TCS Camping, ACSI, camping.info, PiNCAMP', 'Sicher, Strom und Sanitär vorhanden'],
  ['u2', '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3"/>', 'Offizielle Stellplätze', 'Gemeinden, Städte, Häfen, Thermen, Freizeitparks, Bergbahnen', 'Nur ausgewiesene Plätze, Platzregeln beachten'],
  ['u3', '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-2.5 5-2.5 8h2.5v10"/>', 'Gasthöfe, Restaurants, Hotels', 'Stellplatz auf dem Parkplatz des Betriebs', 'Vorher fragen, oft gratis bei Konsumation'],
  ['u4', '<path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-5h4v5"/>', 'Bauernhöfe, Winzer, Private', 'Auch Bekannte und Verwandte mit Garten oder Parkplatz', 'Meist einfach, dafür ruhig. Vorab anfragen'],
];
const LAENDER = [
  ['🇫🇷', 'Frankreich', 'Aires de camping-car', ['Stellplätze heissen «Aires de camping-car».']],
  ['🇮🇹', 'Italien', 'Aree di sosta, Agricamper', ['Stellplätze heissen «Aree di sosta», Bauernhöfe «Agricamper».']],
  ['🇪🇸', 'Spanien', 'Áreas de autocaravanas', ['Stellplätze heissen «Áreas de autocaravanas».']],
  ['🇩🇪', 'Deutschland', 'Wohnmobilstellplätze', ['Stellplätze heissen «Wohnmobilstellplätze».']],
  ['🇭🇷', 'Kroatien', 'Wildcampen verboten, nur Camping oder Stellplatz', ['Wildcampen ist verboten. Nur Campingplatz oder Stellplatz.'], true],
  ['🇦🇹', 'Österreich', 'Freistehen meist verboten', ['Freistehen ist in den meisten Bundesländern verboten oder streng geregelt (Landesgesetze, hohe Strafen möglich). Campingplatz oder Stellplatz wählen.', 'Maut: Bis 3,5 t zulässigem Gesamtgewicht gilt die Vignette, darüber die GO-Box. Das Gewicht unseres Fahrzeugs vorher prüfen.']],
  ['🇸🇮', 'Slowenien', 'Wildcampen verboten', ['Wildcampen ist verboten, auch Übernachten am Strassenrand und auf Parkplätzen. Strafen von mehreren hundert Euro.', 'Autobahn: nur elektronische Vignette, an das Kennzeichen gebunden. Vor der Fahrt kaufen.']],
  ['🇳🇱', 'Niederlande', 'Freistehen streng verboten', ['Freistehen ist verboten, auch auf normalen Parkplätzen. «Camperplaatsen» oder Campingplätze benutzen.', 'Viele Städte haben Umweltzonen. Vor der Einfahrt prüfen.']],
  ['🇧🇪', 'Belgien', 'Wildcampen verboten', ['Wildcampen ist verboten, in Flandern und an der Küste streng kontrolliert. Sicher: Stellplatz oder Campingplatz.', 'Umweltzone Brüssel (LEZ): ausländische Fahrzeuge vorher online anmelden, Zulassung des Fahrzeugs prüfen (lez.brussels).']],
  ['🇱🇺', 'Luxemburg', 'Freistehen verboten', ['Freistehen ist verboten. Abseits von Städten wird eine Nacht teils geduldet, das ist keine Rechtsgrundlage. Auf Privatgrund mit Erlaubnis möglich.', 'Maut: nicht geprüft.']],
  ['🇩🇰', 'Dänemark', 'Kein Jedermannsrecht', ['Übernachten nur auf Campingplätzen und ausgewiesenen Plätzen. Zu einer Nacht am Strassenrand widersprechen sich die Quellen.', 'Keine Autobahnmaut, aber Gebühr für Storebælt- und Öresundbrücke (pro Fahrt, Preis nach Fahrzeug).']],
  ['🇸🇪', 'Schweden', 'Jedermannsrecht gilt nicht für Wohnmobile', ['Das Jedermannsrecht gilt für Wohnmobile nur eingeschränkt: nicht im Wald oder abseits fester Strassen. Üblich sind Rastplätze und öffentliche Parkplätze. Verbotsschilder beachten.', 'Meist keine Maut. Stau-Gebühr in Stockholm und Göteborg, automatisch erfasst.']],
  ['🇳🇴', 'Norwegen', 'Jedermannsrecht nur für Zelte', ['Das Jedermannsrecht gilt für Zelte, nicht für Wohnmobile. Auf vielen Rastplätzen ausserhalb von Städten wird Übernachten geduldet, an Hotspots (z. B. Geiranger, Preikestolen) ist es verboten.', 'Viele Mautstationen (AutoPASS). Ausländische Fahrzeuge vorher registrieren (Epass24) oder Chip besorgen, sonst droht eine höhere Klasse.']],
  ['🇫🇮', 'Finnland', 'Für Wohnmobile unklar', ['Das Jedermannsrecht deckt vor allem Zelten ab. Für Wohnmobile ist Übernachten ausserhalb von Campingplätzen unklar: nicht auf Strassen und öffentlichen Parkplätzen, auf Privatgrund nur mit Zustimmung des Eigentümers.', 'Maut: nicht geprüft.']],
  ['🇵🇹', 'Portugal', 'Freistehen eingeschränkt', ['Freistehen ist eingeschränkt und regional verschieden, die Quellen widersprechen sich. Ein Gesetz zum Parken und Übernachten von Wohnmobilen gilt laut Berichten seit Januar 2026 (nicht im Original geprüft). Schilder und Gemeindeverbote beachten, Stellplätze nutzen.', 'Viele Autobahnen sind mautpflichtig. Transponder (Via Verde oder kompatible Box), Mautklasse des Fahrzeugs vorher prüfen.']],
  ['🇬🇷', 'Griechenland', 'Rechtslage im Wandel', ['Ein Gesetz von 2025 sah hohe Strafen (ab 300 Euro) für Camping ausserhalb von Plätzen vor. Laut Berichten wurde 2026 das Parkverbot für Wohnmobile per Polizeidirektive zurückgenommen (nicht im Original geprüft). Sicher: Campingplatz.', 'Maut: nicht geprüft.']],
];
const PLATTFORMEN = [
  ['Schweiz: offiziell und legal', ['Wohnmobilland', "Parkn'Sleep", 'stellplatz.info', 'WoMo-Stellplatz Europa']],
  ['Schweiz: Höfe und Private', ['Nomady', 'Landcamp.ch', 'schweizerbauern.ch', 'Swiss Hosts (ungeprüft)', 'Myfarm.ch (ungeprüft)']],
  ['Schweiz: Campingplätze', ['PiNCAMP', 'swisscamps.ch', 'camping.ch']],
  ['Europa: Stellplätze', ['Campercontact', 'Stellplatz-Radar', 'camping.info', 'ADAC Camping', 'CaraMaps', 'Camping-App.eu', 'TopPlatz', 'Stellplatz Europe', 'SPF-Mobil (Android)', 'Searchforsites', 'iOverlander', 'NorCamp (Skandinavien)']],
  ['Europa: Camping-Rabatt', ['ACSI CampingCard', 'ACSI Eurocampings', 'ADAC Campcard']],
  ['Europa: Höfe und Private', ['AlpacaCamping', 'Hinterland', 'MyCabin', 'VanSite', 'Roadsurfer Spots', 'StayFree', 'Camperland', 'LandReise.de', 'Landvergnügen', 'Bauernleben (AT)', 'Schau aufs Land (AT, IT, SI)', 'France Passion (ungeprüft)', 'Campspace (ungeprüft)', 'Hipcamp (ungeprüft)']],
  ['Parkplatz-Apps (nur, wo erlaubt)', ['EasyPark', 'Camppa']],
  ['Freistehen, nur als Zusatz', ['park4night (nicht alles erlaubt)']],
];
function unterwegs() {
  const such = (n) => 'https://www.google.com/search?q=' + encodeURIComponent(n + ' Wohnmobil Stellplatz');
  const suchL = (q) => 'https://www.google.com/search?q=' + encodeURIComponent(q);
  const chip = (n) => {
    const m = n.match(/^(.*?)\s*\((.*)\)\s*$/), name = m ? m[1] : n, note = m ? m[2] : '';
    return `<a class="u-chip" href="${such(name)}" target="_blank" rel="noopener">${h(name)}${note ? `<em class="${note === 'ungeprüft' ? 'u-un' : ''}">${h(note)}</em>` : ''}</a>`;
  };
  app.innerHTML = rahmen(`<div class="u-ban"><span class="u-bic">${SVG('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>')}</span>
    <div><strong>Keine Übernachtung auf Autobahnraststätten</strong><span>Vertrag Ziffer 9 und Anhang C. Stattdessen:</span></div></div>
  <div class="karte"><p class="titel">Wo übernachten?</p>${ORTE.map(([c, ic, t, w, hin]) => `<a class="u-ort u-ortlink" href="${such(t)}" target="_blank" rel="noopener"><span class="u-ic ${c}">${SVG(ic)}</span>
    <div class="u-tx"><strong>${h(t)}</strong><span>${h(w)}</span><span class="u-hint ${c}">${h(hin)}</span></div><span class="u-pfeil" aria-hidden="true">›</span></a>`).join('')}<p class="info" style="margin:6px 0 0">Tippen öffnet eine Websuche.</p></div>
  <div class="karte"><p class="titel">Nach Land</p>
    ${LAENDER.map(([f, l, t, sz, v]) => `<details class="u-det u-lnd${v ? ' verbot' : ''}"><summary><span class="u-flag">${f}</span><span class="u-lt"><strong>${h(l)}</strong><em>${h(t)}</em></span></summary>
      <ul class="info" style="padding-left:18px;margin:4px 0 8px">${sz.map((x) => `<li style="margin-bottom:4px">${h(x)}</li>`).join('')}</ul>
      <div class="u-chips"><a class="u-chip" href="${suchL(l + ' Wohnmobil übernachten Regeln')}" target="_blank" rel="noopener">Regeln suchen</a><a class="u-chip" href="${suchL(l + ' Maut Wohnmobil')}" target="_blank" rel="noopener">Maut suchen</a></div></details>`).join('')}
    <p class="info">Stand 08.11.2026. Quellen: Reiseportale und Berichte, keine amtlichen Stellen. Die Angaben ändern sich und widersprechen sich teils. Vor der Reise prüfen. Der Vertrag (Ziffer 9) bestimmt, wohin wir dürfen.</p></div>
  <div class="karte"><p class="titel">Apps und Plattformen</p>
    ${PLATTFORMEN.map(([g, l], i) => `<details class="u-det"${i === 0 ? ' open' : ''}><summary><span>${h(g)}</span><b>${l.length}</b></summary><div class="u-chips">${l.map(chip).join('')}</div></details>`).join('')}
    <p class="info">Tippen öffnet eine Websuche. «ungeprüft»: Quelle nicht abrufbar oder nur erwähnt.</p></div>
  <p class="info" style="text-align:center;margin:4px 20px 0">Angebote, Preise und Regeln ändern sich. Vor der Reise prüfen. Die Liste ist eine Auswahl, keine Zusicherung.</p>`);
  bindRahmen();
}
const VERTRAG_REGELN = [
  ['Nutzung (Ziffer 7)', ['Gezählt wird in Tagen pro Kalenderjahr. Jeder angebrochene Tag zählt voll, Abreise- und Rückkehrtag beide.', 'Wer im Fahrzeug sitzt, zählt, auch wer nur mitreist. Sitzen Vater oder Mutter mit Tochter oder Sohn im Fahrzeug, zählen die Tage nur für Vater und Mutter.', 'Ungenutzte Tage verfallen am Jahresende, kein Übertrag.', 'Im Dezember werden die Ferienwochen des Folgejahres besprochen. Wochenenden können kurzfristig über die App reserviert werden.', 'Im Fahrzeug reisen höchstens 4 Personen.', 'Übergabe und Rückgabe immer zu Hause in Chur, mit der Checkliste.', 'Das Fahrzeug wird nicht verliehen oder vermietet.']],
  ['Alltagsfahrten der Eltern (Ziffer 7)', ['Vater und Mutter dürfen das Fahrzeug auch privat im Alltag nutzen. Alltagsfahrten müssen nicht reserviert werden.', 'Jeder Tag mit mindestens einer Alltagsfahrt zählt als ein Tag im gemeinsamen Konto von Vater und Mutter. Mehrere Fahrten am selben Tag zählen einen Tag.', 'Reisetage und Alltagstage zusammen betragen für Vater und Mutter höchstens 183 Tage pro Kalenderjahr.', 'Datum und gefahrene Kilometer jeder Alltagsfahrt werden in der App eingetragen.', 'Reisen gehen Alltagsfahrten immer vor, Reisen der Eltern wie der Kinder. An reservierten Tagen gibt es keine Alltagsfahrt.', 'Vor Beginn einer Reise von Tochter oder Sohn sind Vater und Mutter dafür verantwortlich, dass das Fahrzeug mit vollem Tank bereitsteht.']],
  ['Wer fährt (Ziffer 8)', ['Grundsätzlich fahren nur die Eigentümer. Partner, Freunde und Enkel reisen mit, fahren aber nicht.', 'Der Familienrat kann vor der Reise im Einzelfall eine Person zum Fahren freigeben, wenn Versicherung, Führerausweis, Fahrerfahrung und Haftung geklärt sind.', 'Bei jeder Fahrt reist mindestens ein Eigentümer mit, auch bei freigegebenen Fahrern.', 'Kinder reisen nur auf zugelassenen Sitzplätzen mit passendem Rückhaltesystem.']],
  ['Reiseregeln (Ziffer 9)', ['Erlaubt: Schweiz, Westeuropa, Nordeuropa, Tschechien, Polen, Baltikum, Ungarn, Slowenien bis Griechenland mit Kroatien, Bosnien-Herzegowina, Montenegro, Albanien, Nordmazedonien.', 'Verboten: andere Kontinente, Serbien, Türkei, Russland, Rumänien und ex-russische Staaten ausser dem Baltikum.', 'Nicht auf Autobahnraststätten übernachten, wenn immer möglich.', 'Winter: Gebrauch grundsätzlich möglich. Weil weder Allrad noch winterfest, sind höhere Lagen mit Schneewahrscheinlichkeit nicht vorgesehen.', 'Rauchen und Tiere im Fahrzeug sind verboten.']],
  ['Sauberkeit und Übergabe (Ziffer 10)', ['Das Fahrzeug soll immer sauber übernommen werden können. Wer es zuvor gefahren hat, reinigt es und gibt es sauber zurück.', 'Das Fahrzeug wird IMMER mit vollem Tank zurückgegeben. Wer es zuletzt gefahren hat, tankt es vor der Rückgabe voll und trägt den Tankstand in die Checkliste ein.']],
  ['Übergabe-Checkliste (Anhang B)', ['Bei jeder Übergabe und Rückgabe in Chur ausfüllen. Jeder Eintrag mit Ja oder Nein, Mängel in der Bemerkung.', 'Tankstand: bei der Rückgabe immer voll.', 'Weitere Punkte: Kilometerstand, Innenraum und Aussen sauber, Kühlschrank geleert und geputzt, Frischwasser- und Abwassertank geleert, Gasflasche und Gasanlage, Toilette geleert, Wohnraumbatterie, Aufstelldach, Markise, Veloträger und Anhängerkupplung, Reifen, Unterlagen, Zubehör, neue Schäden.']],
];
function vertrag() {
  app.innerHTML = rahmen(`<div class="karte"><p class="titel">Vertragsregeln</p>
    <p class="info" style="margin:0 0 6px">Kurzfassung des Miteigentumsvertrags. Bei Widerspruch gilt der Vertrag.</p>
    ${VERTRAG_REGELN.map(([t, l], i) => `<details class="det"${i === 0 ? ' open' : ''}><summary>${t}</summary><ul class="info" style="padding-left:18px;margin:6px 0 10px">${l.map((x) => `<li style="margin-bottom:4px">${x}</li>`).join('')}</ul></details>`).join('')}</div>`);
  bindRahmen();
}
function rahmen(inhalt) {
  return `<div class="kopf"><div class="marke"><span class="keil"></span>PÖSSL</div>
    <button class="chip" id="aus" title="Person wechseln">${avatar(ich)}${h(D.personen[ich].name)}</button></div>
  <main>${inhalt}</main>
  <nav class="tabs">${TABS.map(([k, n]) => `<button data-t="${k}" class="${k === tab ? 'aktiv' : ''}"><svg viewBox="0 0 24 24">${ICON[k]}</svg>${n}</button>`).join('')}</nav>`;
}
function bindRahmen() {
  document.getElementById('aus').onclick = (e) => { e.preventDefault(); ich = null; try { sessionStorage.removeItem('womo-ich'); } catch {} zeige(); };
  app.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.t; schliessen(); zeige(); window.scrollTo(0, 0); });
}

// Hinweise oben im Kalender: Zahlungsverzug, faellige Termine
function hinweiseHtml() {
  const t = heute(); let out = '';
  const sp = zahlungsSperre(D.zahlstatus[ich], t);
  if (sp.stufe === 'gesperrt') out += `<div class="hinweiskarte rot">Nutzungsverbot wegen Zahlungsverzug seit ${fmt(sp.ab)}, bis die Zahlung erfolgt ist (Vertrag Ziffer 4).</div>`;
  else if (sp.stufe === 'erinnert') out += `<div class="hinweiskarte gelb">Zahlungserinnerung: Bitte bis ${fmt(sp.frist)} zahlen, sonst gilt ein Nutzungsverbot.</div>`;
  termineEcht().filter((x) => ['ueberfaellig', 'bald'].includes(terminStufe(x, t))).sort((a, b) => (a.faelligAm < b.faelligAm ? -1 : 1)).slice(0, 3).forEach((x) => {
    const u = terminStufe(x, t) === 'ueberfaellig';
    out += `<div class="hinweiskarte ${u ? 'rot' : 'gelb'}">${h(x.titel)}: ${u ? 'überfällig seit' : 'fällig am'} ${fmt(x.faelligAm)}</div>`;
  });
  return out;
}

// =====================================================================
// Kalender (Version 1)
// =====================================================================
function ringe(J) {
  const st = kontostaendeMitAlltag(liste(), D.personen, J, alltagMap(), D.buchungen);
  const U = 2 * Math.PI * 32;
  return `<div class="karte"><p class="titel">Tageskonto ${J}</p><div class="ringe">` +
    Object.keys(SCHWELLE).map((k) => {
      const t = st[k], s = stufe(t, k), pr = Math.min(1, t / SCHWELLE[k]);
      const farbe = s === 'rot' ? 'var(--rot)' : s === 'gelb' ? 'var(--gelb)' : k === 'eltern' ? 'url(#gEltern)' : FARBE[k];
      const sub = s === 'rot' ? 'überschritten' : s === 'gelb' ? 'bald erreicht' : `von ${SCHWELLE[k]} Tagen`;
      const sub2 = k === 'eltern' && st.alltag ? `<div class="sub">davon Alltag ${st.alltag}</div>` : '';
      return `<div class="ring ${s}"><svg viewBox="0 0 76 76">${k === 'eltern' ? '<defs><linearGradient id="gEltern" gradientUnits="userSpaceOnUse" x1="70" y1="38" x2="6" y2="38"><stop offset="0" stop-color="#f97316"/><stop offset="1" stop-color="#7dd3fc"/></linearGradient></defs>' : ''}<circle class="bg" cx="38" cy="38" r="32"${k === 'eltern' ? ' style="stroke:url(#gEltern);opacity:.4"' : ''}/><circle class="fg" cx="38" cy="38" r="32" stroke="${farbe}" stroke-dasharray="${(pr * U).toFixed(1)} ${U.toFixed(1)}"/></svg>
      <div class="zahl">${t}</div><div class="name">${KONTO_NAME[k]}</div><div class="sub">${sub}</div>${sub2}</div>`;
    }).join('') + '</div></div>';
}

function kalender() {
  const J = ansicht.getFullYear(), M = ansicht.getMonth();
  const erster = new Date(J, M, 1), n = new Date(J, M + 1, 0).getDate();
  const versatz = (erster.getDay() + 6) % 7, jetzt = new Date();
  const bs = liste();
  let zellen = '';
  const tT = heute(), terminTag = {};
  termineEcht().forEach((x) => { (terminTag[x.faelligAm] = terminTag[x.faelligAm] || []).push(x); });
  const RANG = { ueberfaellig: 3, bald: 2, offen: 1, erledigt: 0 };
  for (let i = 0; i < versatz; i++) zellen += '<div class="tag leer"></div>';
  for (let t = 1; t <= n; t++) {
    const d = iso(J, M, t), hier = bs.filter((b) => b.von <= d && d <= b.bis);
    const wd = (versatz + t - 1) % 7;
    const cls = ['tag', wd >= 5 ? 'we' : '', hier.length > 1 ? 'koll' : '',
      jetzt.getFullYear() === J && jetzt.getMonth() === M && jetzt.getDate() === t ? 'heute' : ''].join(' ');
    zellen += `<div class="${cls}" data-d="${d}"><span class="nr">${t}</span>${terminTag[d] ? `<span class="tm ${['erledigt', 'offen', 'bald', 'ueberfaellig'][Math.max(...terminTag[d].map((x) => RANG[terminStufe(x, tT)]))]}" title="${h(terminTag[d].map((x) => x.titel).join(', '))}"></span>` : ''}${hier.length ? `<span class="streifen">${hier.map((b) => `<i class="${farbKonto(b)}"></i>`).join('')}</span>` : ''}</div>`;
  }
  const monatsB = bs.filter((b) => b.von <= iso(J, M, n) && b.bis >= iso(J, M, 1)).sort((a, b) => a.von < b.von ? -1 : 1);
  const kolls = monatsB.filter((a, i) => monatsB.some((b, j) => i !== j && kollision(a, b)));
  const monatsT = termineEcht().filter((x) => x.faelligAm >= iso(J, M, 1) && x.faelligAm <= iso(J, M, n)).sort((a, b) => (a.faelligAm < b.faelligAm ? -1 : 1));
  const TCHIP = { ueberfaellig: ['rot', 'überfällig'], bald: ['gelb', 'bald fällig'], offen: ['', 'offen'], erledigt: ['ok', 'erledigt'] };
  app.innerHTML = rahmen(`${hinweiseHtml()}${ringe(J)}
  <div class="karte">
    <div class="monatskopf"><h2>${MONATE[M]} ${J}</h2><div class="nav"><button id="zu" aria-label="Voriger Monat">‹</button><button id="hj" class="heute-b">Heute</button><button id="vor" aria-label="Nächster Monat">›</button></div></div>
    <div class="woche">${['Mo','Di','Mi','Do','Fr','Sa','So'].map((x) => `<div>${x}</div>`).join('')}</div>
    <div class="monat">${zellen}</div>
    <div class="legende">${[['hp', 'HP'], ['nora', 'Nora'], ['kind-1', 'Nanouk'], ['kind-2', 'Nene']].map(([k, n]) => `<span><i class="punkt ${k}"></i>${n}</span>`).join('')}</div>
    ${kolls.length ? `<div class="warn">Überschneidung im ${MONATE[M]}. Bitte im Gespräch lösen.</div>` : ''}
  </div>
  <div class="karte"><p class="titel">Reservierungen im ${MONATE[M]}</p>${monatsB.length ? monatsB.map(buchungHtml).join('') : '<p class="leer-t">Keine Reservierungen.</p>'}</div>
  <div class="karte"><p class="titel">Termine im ${MONATE[M]}</p>${monatsT.length ? monatsT.map((x) => { const [c, txt] = TCHIP[terminStufe(x, tT)]; return `<div class="b" style="padding:8px 0"><span class="tm ${c || 'offen'}" style="position:static;flex:none;margin-top:6px"></span><div class="inhalt"><div class="zeit" style="font-size:15px">${h(x.titel)}</div><div class="meta">${fmt(x.faelligAm)} · <span class="chipk ${c}">${txt}</span></div></div></div>`; }).join('') : '<p class="leer-t">Keine Termine.</p>'}</div>`) +
  '<button id="neu">＋ Reservieren</button>';
  bindRahmen();
  document.getElementById('zu').onclick = () => { ansicht = new Date(J, M - 1, 1); kalender(); };
  document.getElementById('vor').onclick = () => { ansicht = new Date(J, M + 1, 1); kalender(); };
  document.getElementById('hj').onclick = () => { ansicht = new Date(); kalender(); };
  document.getElementById('neu').onclick = () => formularZeigen('');
  app.querySelectorAll('.tag[data-d]').forEach((el) => el.onclick = () => formularZeigen(el.dataset.d));
  app.querySelectorAll('[data-edit]').forEach((el) => el.onclick = () => { const x = D.buchungen[el.dataset.edit]; if (!eigener(x)) return nurEigene(); formularZeigen('', x); });
  app.querySelectorAll('[data-del]').forEach((el) => el.onclick = async () => {
    if (!eigener(D.buchungen[el.dataset.del])) return nurEigene();
    if (confirm('Reservierung löschen?')) { await sicher(async () => { await S.buchungLoeschen(D, el.dataset.del); kalender(); }); }
  });
}

function buchungHtml(b) {
  const wer = D.personen[b.fahrerId]?.name || b.ausnahmeFahrer?.name || '?';
  const mit = (b.mitreisende || []).map((i) => D.personen[i]?.name).filter(Boolean);
  const darf = eigener(b);
  const zaehlt = konten(b, D.personen).map((k) => KONTO_NAME[k]).join(' und ');
  const av = b.fahrerId ? avatar(b.fahrerId) : `<span class="av" style="background:var(--muted)">${initial(wer)}</span>`;
  return `<div class="b">${av}<div class="inhalt">
    <div class="zeit">${fmt(b.von).slice(0, 6)} – ${fmt(b.bis)}</div>
    <div class="meta"><span class="tagetxt">${dauer(b)} Tage</span> · ${h(wer)}${mit.length ? ' mit ' + h(mit.join(', ')) : ''}${b.gaeste ? ` · ${b.gaeste} Gast/Gäste` : ''}${b.ziel ? ' · ' + h(b.ziel) : ''}</div>
    <div class="meta">Zählt für ${h(zaehlt)} · erfasst von ${h(D.personen[b.erfasstVon]?.name || '?')}</div></div>
    ${darf ? `<div style="display:flex;flex-direction:column;gap:6px;align-self:flex-start"><button class="kl" style="color:var(--acc)" data-edit="${b.id}">Ändern</button><button class="kl" data-del="${b.id}">Löschen</button></div>` : ''}</div>`;
}

function formularZeigen(tag, ex) {
  if (ex && !eigener(ex)) return nurEigene();
  const ids = idsGeordnet();
  const fahrerWahl = ex ? (ex.fahrerId || '') : ich;
  const aus = ex && !ex.fahrerId ? ex.ausnahmeFahrer || {} : null;
  sheet(`<h3>${ex ? 'Reservierung ändern' : 'Neue Reservierung'}</h3>
  <div class="zwei"><div><label for="von">Abreise</label><input type="date" id="von" value="${h(ex ? ex.von : tag)}"></div>
  <div><label for="bis">Rückkehr</label><input type="date" id="bis" value="${h(ex ? ex.bis : tag)}"></div></div>
  <label for="fahrer">Fahrer</label><select id="fahrer">${ids.map((i) => `<option value="${i}"${i === fahrerWahl ? ' selected' : ''}>${h(D.personen[i].name)}</option>`).join('')}<option value=""${fahrerWahl === '' ? ' selected' : ''}>Ausnahme: kein Eigentümer</option></select>
  <div id="ausn" class="${aus ? '' : 'versteckt'}"><label for="an">Name des Fahrers</label><input id="an" value="${h(aus?.name || '')}"><label for="af">Freigabe Familienrat am</label><input type="date" id="af" value="${h(aus?.freigabeAm || '')}"><label for="av">Verantwortlicher Eigentümer</label><select id="av">${ids.map((i) => `<option value="${i}"${i === aus?.verantwortlichId ? ' selected' : ''}>${h(D.personen[i].name)}</option>`).join('')}</select></div>
  <label>Mitreisende Eigentümer</label><div class="mitw" id="mit">${ids.map((i) => `<span class="chk"><input type="checkbox" value="${i}" id="m${i}"${ex?.mitreisende?.includes(i) ? ' checked' : ''}><label for="m${i}">${h(D.personen[i].name)}</label></span>`).join('')}</div>
  <div class="zwei"><div><label for="gaeste">Gäste (ohne Eigentum)</label><input type="number" id="gaeste" min="0" max="3" value="${ex ? ex.gaeste || 0 : 0}" inputmode="numeric"></div>
  <div><label for="ziel">Ziel</label><input id="ziel" maxlength="80" placeholder="optional" value="${h(ex?.ziel || '')}"></div></div>
  <div id="msg"></div>
  <div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="spei">${ex ? 'Änderung speichern' : 'Speichern'}</button></div>`);
  const f = document.getElementById('fahrer');
  f.onchange = () => document.getElementById('ausn').classList.toggle('versteckt', f.value !== '');
  document.getElementById('abb').onclick = schliessen;
  document.getElementById('spei').onclick = async () => {
    const b = { von: val('von'), bis: val('bis'), fahrerId: f.value || null,
      mitreisende: ids.filter((i) => document.getElementById('m' + i).checked && i !== f.value),
      gaeste: parseInt(val('gaeste') || '0', 10), ziel: val('ziel').trim(), erfasstVon: ex ? ex.erfasstVon : ich };
    if (ex) { b.id = ex.id; if (ex.erfasstAm) b.erfasstAm = ex.erfasstAm; }
    if (!f.value) b.ausnahmeFahrer = { name: val('an').trim(), freigabeAm: val('af'), verantwortlichId: val('av') };
    const p = pruefeBuchung(b, D.personen);
    const fehlerListe = [...p.fehler];
    // Doppelbelegung ist nicht erlaubt: jedes Datum gehoert nur einer Reservierung.
    if (p.ok) {
      for (const x of ueberschneidungen(b, liste())) {
        const wer = D.personen[x.fahrerId]?.name || x.ausnahmeFahrer?.name || '?';
        fehlerListe.push(`Vom ${fmt(x.von)} bis ${fmt(x.bis)} ist das Fahrzeug schon für ${wer} reserviert. Ein Datum kann nur einmal vergeben werden. Bitte ein anderes Datum wählen.`);
      }
    }
    // Zahlungsverzug (Vertrag Ziffer 4): wer gesperrt ist, darf nicht fahren oder mitreisen.
    for (const id of [b.fahrerId, ...b.mitreisende].filter(Boolean)) {
      const sp = zahlungsSperre(D.zahlstatus[id], heute());
      if (sp.stufe === 'gesperrt') fehlerListe.push(`${D.personen[id]?.name} hat ein Nutzungsverbot wegen Zahlungsverzug (Vertrag Ziffer 4). Bitte zuerst die Zahlung klären.`);
    }
    if (fehlerListe.length) { fehler(fehlerListe); return; }
    await sicher(async () => {
      await S.buchungSpeichern(D, b);
      ansicht = new Date(b.von + 'T12:00:00');
      schliessen(); kalender();
      hinweis(ex ? 'Reservierung geändert.' : 'Reservierung gespeichert.');
    });
  };
}

// =====================================================================
// Fahrten: Uebergabe-Checkliste (Anhang B) und Kilometerstand (Version 2)
// =====================================================================
function fahrten() {
  const J = new Date().getFullYear();
  const st = kmStatistik(Object.values(D.uebergaben), D.buchungen, J);
  const bs = liste().sort((a, b) => (a.von < b.von ? 1 : -1)).slice(0, 40);
  app.innerHTML = rahmen(`<div class="hinweiskarte rot" style="font-size:16px;text-align:center">Rauchen und Tiere sind verboten</div>
  <div class="karte"><p class="titel">Kilometerstand</p>
    <p class="grosszahl">${st.stand ? zahl(st.stand) : '–'} <small>km</small></p>
    <p class="info">${st.stand ? `Gefahren ${J}: ${zahl(st.jahr)} km (Zuordnung nach Abreisetag der Reise).` : 'Noch kein Stand erfasst. Er entsteht aus den Übergaben und Rückgaben.'}</p></div>
  ${alltagKarte(J)}
  <div class="karte"><p class="titel">Fahrten und Übergaben</p>
    <p class="info" style="margin:0 0 6px">Übergabe und Rückgabe finden zu Hause in Chur statt, mit der Checkliste nach Anhang B.</p>
    ${bs.length ? bs.map((b) => fahrtHtml(b, st)).join('') : '<p class="leer-t">Noch keine Reservierungen.</p>'}</div>`);
  bindRahmen();
  app.querySelectorAll('[data-u]').forEach((el) => el.onclick = () => { const [bid, phase] = el.dataset.u.split('|'); uebergabeForm(bid, phase); });
  const an = document.getElementById('aneu'); if (an) an.onclick = () => alltagForm();
  app.querySelectorAll('[data-ad]').forEach((b) => b.onclick = async () => { const x = D.termine[b.dataset.ad]; if (!eigener(x)) return nurEigene(); if (confirm('Alltagsfahrt löschen?')) await sicher(async () => { await S.loeschen(D, 'termine', x.id); fahrten(); }); });
}

// Alltagsfahrten der Eltern: ohne Reservierung, zaehlen mit Ferienreisen zusammen auf das Konto der Eltern (183 Tage).
function alltagKarte(J) {
  const st = kontostaendeMitAlltag(liste(), D.personen, J, alltagMap(), D.buchungen);
  const L = Object.values(alltagMap()).sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : (a.erfasstAm || '') < (b.erfasstAm || '') ? 1 : -1)).slice(0, 15);
  const elternIch = D.personen[ich]?.konto === 'eltern';
  const rot = st.eltern > SCHWELLE.eltern;
  return `<div class="karte"><div class="kopfzeile"><p class="titel">Alltagsfahrten der Eltern</p>${elternIch ? '<button class="btn pri" id="aneu">＋ Alltagsfahrt</button>' : ''}</div>
    <p class="grosszahl">${st.eltern} <small>von ${SCHWELLE.eltern} Tagen (Eltern ${J})</small></p>
    <p class="info" style="margin:0 0 4px">${st.eltern - st.alltag} ${st.eltern - st.alltag === 1 ? 'Tag' : 'Tage'} Ferienreisen + ${st.alltag} ${st.alltag === 1 ? 'Tag' : 'Tage'} Alltag. Alltag ${J}: ${zahl(alltagKm(alltagMap(), J))} km.</p>
    ${rot ? `<div class="hinweiskarte rot">Die Eltern haben mehr als ${SCHWELLE.eltern} Tage erreicht (Ferien und Alltag zusammen).</div>` : ''}
    <p class="info" style="margin:0 0 6px">Alltagsfahrten brauchen keine Reservierung. Ein Tag zählt einmal, egal wie viele Fahrten. Ferienreisen gehen immer vor. Vor einer Ferienreise der Kinder sind die Eltern dafür verantwortlich, dass der Tank voll ist.</p>
    ${L.length ? L.map((a) => `<div class="b" style="padding:8px 0"><div class="inhalt"><div class="zeit" style="font-size:15px">${fmt(a.datum)} · ${zahl(a.km)} km</div><div class="meta">${h(D.personen[a.personId]?.name || '?')}${a.notiz ? ' · ' + h(a.notiz) : ''}</div></div>${eigener(a) ? `<button class="kl" data-ad="${a.id}">Löschen</button>` : ''}</div>`).join('') : '<p class="leer-t">Noch keine Alltagsfahrten.</p>'}</div>`;
}

function alltagForm() {
  const eltern = idsGeordnet().filter((i) => D.personen[i].konto === 'eltern');
  sheet(`<h3>Alltagsfahrt</h3>
  <label for="a_datum">Datum</label><input type="date" id="a_datum" value="${heute()}">
  <label for="a_wer">Wer</label><select id="a_wer">${eltern.map((i) => `<option value="${i}"${i === ich ? ' selected' : ''}>${h(D.personen[i].name)}</option>`).join('')}</select>
  <label for="a_km">Gefahrene Kilometer (alle Fahrten des Tages)</label><input id="a_km" inputmode="numeric" placeholder="z. B. 18">
  <label for="a_notiz">Bemerkung (optional)</label><input id="a_notiz" maxlength="80">
  <div id="msg"></div>
  <div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="spei">Speichern</button></div>`);
  document.getElementById('abb').onclick = schliessen;
  document.getElementById('spei').onclick = async () => {
    const kmTxt = val('a_km').replace(/\D/g, '');
    const a = { datum: val('a_datum'), personId: val('a_wer'), km: kmTxt === '' ? NaN : parseInt(kmTxt, 10), notiz: val('a_notiz').trim(), erfasstVon: ich };
    const p = pruefeAlltag(a, D.buchungen, D.personen);
    if (!p.ok) { fehler(p.fehler); return; }
    await sicher(async () => { await S.speichern(D, 'termine', null, { ...a, art: 'Alltag', titel: 'Alltagsfahrt', faelligAm: a.datum, erledigtAm: '' }); schliessen(); fahrten(); hinweis('Alltagsfahrt gespeichert.'); });
  };
}

function fahrtHtml(b, st) {
  const ab = D.uebergaben[b.id + '_ab'], rk = D.uebergaben[b.id + '_rueck'];
  const wer = D.personen[b.fahrerId]?.name || b.ausnahmeFahrer?.name || '?';
  const maengel = [ab, rk].some((u) => u && (CHECKPUNKTE.some(([k]) => u.punkte?.[k] === 'nein') || (u.schaeden || '').trim()));
  const km = st.proBuchung[b.id];
  const fertigR = rueckgabeFertig(rk);
  const schlOffen = rk && !fertigR;
  const tankNV = tankWarnung(ab) || tankWarnung(rk);
  const knopf = (fertig, id, text, offen) => `<button class="btn${fertig ? ' ok' : offen ? ' gelb' : ''}" data-u="${b.id}|${id}">${fertig ? '✓ ' : ''}${text}</button>`;
  return `<div class="b" style="flex-direction:column;gap:6px">
    <div class="zeit">${fmt(b.von).slice(0, 6)} – ${fmt(b.bis)} <span class="meta">· ${h(wer)}</span></div>
    ${km !== undefined || maengel || schlOffen || tankNV ? `<div class="btnzeile" style="margin:0">${km !== undefined ? `<span class="chipk">${zahl(km)} km gefahren</span>` : ''}${maengel ? '<span class="chipk rot">Mängel gemeldet</span>' : ''}${schlOffen ? '<span class="chipk gelb">Schlüssel noch nicht quittiert</span>' : ''}${tankNV ? '<span class="chipk rot">Tank nicht voll</span>' : ''}</div>` : ''}
    <div class="btnzeile" style="margin:0">${knopf(!!ab, 'ab', `Übergabe ${ab ? 'ansehen' : 'erfassen'}`)}${knopf(fertigR, 'rueck', `Rückgabe ${rk ? 'ansehen' : 'erfassen'}`, schlOffen)}</div></div>`;
}

function uebergabeForm(bid, phase) {
  const b = D.buchungen[bid]; if (!b) return;
  const id = bid + '_' + phase, ex = D.uebergaben[id], ab = D.uebergaben[bid + '_ab'];
  const darf = !ex || eigener(ex);
  const pad = (n) => String(n).padStart(2, '0');
  const jetzt = new Date(), lokal = `${jetzt.getFullYear()}-${pad(jetzt.getMonth() + 1)}-${pad(jetzt.getDate())}T${pad(jetzt.getHours())}:${pad(jetzt.getMinutes())}`;
  const dis = darf ? '' : 'disabled';
  const radio = (name, wert, text, cls, aktiv) => `<span class="chk ${cls}"><input type="radio" name="${name}" id="${name}_${wert}" value="${wert}" ${aktiv ? 'checked' : ''} ${dis}><label for="${name}_${wert}">${text}</label></span>`;
  sheet(`<h3>${phase === 'ab' ? 'Übergabe' : 'Rückgabe'}</h3>
  ${phase === 'ab' ? '<div class="hinweiskarte rot" style="font-size:16px;text-align:center;margin-bottom:10px">Rauchen und Tiere sind verboten</div>' : ''}
  <p class="info" style="margin:0">${fmt(b.von)} – ${fmt(b.bis)} · ${h(D.personen[b.fahrerId]?.name || b.ausnahmeFahrer?.name || '?')}${ex ? ` · erfasst von ${h(D.personen[ex.erfasstVon]?.name || '?')}` : ''}</p>
  ${phase === 'rueck' && ab ? `<p class="info">Bei der Übergabe: ${zahl(ab.km)} km, Tank ${h(ab.tank)}.</p>` : ''}
  <label for="u_dt">Datum und Uhrzeit</label><input type="datetime-local" id="u_dt" value="${h(ex?.datumZeit || lokal)}" ${dis}>
  <label for="u_km">Kilometerstand</label><input id="u_km" inputmode="numeric" value="${ex ? ex.km : ''}" placeholder="z. B. 12450" ${dis}>
  <label>Tankstand (Vertrag: immer voll)</label><div class="mitw">${TANK.map((t, i) => radio('u_tank', String(i), t, t === 'voll' ? 'ja' : '', ex?.tank === t)).join('')}</div>
  <div id="tankw"></div>
  <label>Checkliste (Anhang B)</label>
  ${darf && phase === 'ab' ? '<div class="btnzeile" style="margin:0 0 4px"><button class="btn" id="alleja" type="button">Alle auf Ja setzen</button></div>' : ''}
  <div>${CHECKPUNKTE.map(([k, text]) => `<div class="cp"><div class="pt">${h(text)}</div><div class="mitw">${radio('p_' + k, 'ja', 'Ja', 'ja', ex?.punkte?.[k] === 'ja')}${radio('p_' + k, 'nein', 'Nein', 'nein', ex?.punkte?.[k] === 'nein')}</div></div>`).join('')}</div>
  <label for="u_bem">Bemerkung (bei Nein: den Mangel beschreiben)</label><textarea id="u_bem" ${dis}>${h(ex?.bemerkung || '')}</textarea>
  <label for="u_sch">Neue Schäden oder Mängel</label><textarea id="u_sch" ${dis}>${h(ex?.schaeden || '')}</textarea>
  ${phase === 'rueck' ? `<label>Schlüssel (letzte Pflicht der Rückgabe)</label><p class="info" style="margin:0 0 6px">Der Schlüssel hängt am Schlüsselbrett der Eltern. Ohne Häkchen ist die Rückgabe nicht abgeschlossen.</p><div class="mitw"><span class="chk ja"><input type="checkbox" id="u_schl" ${ex?.schluessel === 'ja' ? 'checked' : ''} ${dis}><label for="u_schl">Schlüssel hängt am Schlüsselbrett der Eltern</label></span></div>${ex?.schluesselAm ? `<p class="info">Quittiert am ${fmt(ex.schluesselAm.slice(0, 10))}, ${ex.schluesselAm.slice(11, 16)} Uhr, von ${h(D.personen[ex.schluesselVon]?.name || '?')}.</p>` : ''}` : ''}
  <div id="msg"></div>
  <div class="aktion"><button id="abb">${darf ? 'Abbrechen' : 'Schliessen'}</button>${darf ? '<button class="primaer" id="spei">Speichern</button>' : ''}</div>`);
  document.getElementById('abb').onclick = schliessen;
  if (!darf) return;
  const eltRei = !(b.fahrerId && D.personen[b.fahrerId]?.konto === 'eltern') && !(b.mitreisende || []).some((i) => D.personen[i]?.konto === 'eltern');
  const tw = () => { const el = formEl.querySelector('input[name="u_tank"]:checked'); document.getElementById('tankw').innerHTML = el && TANK[+el.value] !== 'voll' ? `<div class="hinweiskarte rot">Achtung: Der Tank ist nicht voll. Der Vertrag (Ziffer 10) verlangt immer einen vollen Tank. Speichern geht nur mit einer Bemerkung.${phase === 'ab' && eltRei ? ' Vor einer Ferienreise der Kinder sind die Eltern fürs Volltanken verantwortlich.' : ''}</div>` : ''; };
  formEl.querySelectorAll('input[name="u_tank"]').forEach((i) => i.onchange = tw); tw();
  if (phase === 'ab') document.getElementById('alleja').onclick = () => CHECKPUNKTE.forEach(([k]) => { document.getElementById(`p_${k}_ja`).checked = true; });
  document.getElementById('spei').onclick = async () => {
    const punkte = {}; for (const [k] of CHECKPUNKTE) { const el = formEl.querySelector(`input[name="p_${k}"]:checked`); if (el) punkte[k] = el.value; }
    const tankEl = formEl.querySelector('input[name="u_tank"]:checked');
    const kmTxt = val('u_km').replace(/\D/g, '');
    const u = { buchungId: bid, phase, datumZeit: val('u_dt'), km: kmTxt === '' ? NaN : parseInt(kmTxt, 10), tank: tankEl ? TANK[+tankEl.value] : '',
      punkte, bemerkung: val('u_bem').trim(), schaeden: val('u_sch').trim(), erfasstVon: ex?.erfasstVon || ich };
    if (phase === 'rueck') {
      u.schluessel = document.getElementById('u_schl').checked ? 'ja' : '';
      if (u.schluessel === 'ja') { u.schluesselAm = ex?.schluessel === 'ja' && ex.schluesselAm ? ex.schluesselAm : lokal; u.schluesselVon = ex?.schluessel === 'ja' && ex.schluesselVon ? ex.schluesselVon : ich; }
    }
    const p = pruefeUebergabe(u, Object.values(D.uebergaben), D.buchungen);
    if (!p.ok) { fehler(p.fehler); return; }
    await sicher(async () => { await S.speichern(D, 'uebergaben', id, { ...u, erfasstAm: ex?.erfasstAm }); schliessen(); fahrten(); hinweis(phase === 'ab' ? 'Übergabe gespeichert.' : 'Rückgabe abgeschlossen, Schlüssel quittiert.'); });
  };
}

// =====================================================================
// Kosten und Zahlungsstatus (Version 3)
// =====================================================================
function kosten() {
  const J = jahrK, ids = idsGeordnet(), t = heute(), buch = buchhalter();
  const kl = Object.values(D.kosten), el = Object.values(D.einzahlungen);
  const r = kostenAnteile(kl, el, ids, J);
  const von = `${J}-01-01`, bis = `${J + 1}-01-01`;
  const name = (i) => h(D.personen[i]?.name || '?');

  const anteile = ids.map((i) => {
    const ein = eingezahlt(el, i, 'betrieb', von, bis), saldo = r.anteil[i] - ein;
    const chip = r.total === 0 && ein === 0 ? '<span class="chipk">–</span>' : saldo > 0 ? `<span class="chipk rot">noch ${chf(saldo)}</span>` : saldo < 0 ? `<span class="chipk ok">Guthaben ${chf(-saldo)}</span>` : '<span class="chipk ok">ausgeglichen</span>';
    return `<div class="z"><div class="l"><strong>${name(i)}</strong><div class="meta">Anteil ${chf(r.anteil[i])} · einbezahlt ${chf(ein)}</div></div><div class="r">${chip}</div></div>`;
  }).join('');

  let plan;
  if (!D.start) {
    plan = `<p class="info" style="margin-top:0">Das Übergabedatum des Fahrzeugs fehlt. Ohne dieses Datum kann die App das Vertragsjahr und die Beträge für Rücklage und Darlehen nicht berechnen.</p>${ich === D.adminId ? startFeld('') : '<p class="info">HP trägt das Datum ein.</p>'}`;
  } else {
    const n = vertragsJahr(D.start, t);
    if (n === null) plan = `<p class="info" style="margin-top:0">Der Vertrag beginnt am ${fmt(D.start)}.</p>${ich === D.adminId ? startFeld(D.start) : ''}`;
    else if (n > 8) plan = `<p class="info" style="margin-top:0">Die 8 Vertragsjahre sind abgelaufen (Beginn ${fmt(D.start)}). Weiteres regelt Ziffer 14 des Vertrags.</p>`;
    else plan = `<p class="info" style="margin-top:0">Vertragsjahr <strong>${n} von 8</strong> · ${fmt(addJahre(D.start, n - 1))} bis ${fmt(addJahre(D.start, n))} (Beginn ${fmt(D.start)}).</p><div class="zeilen">` +
      ids.map((i) => {
        const zp = zahlplan(D.start, t, el, D.personen[i], i);
        return `<div class="z"><div class="l"><strong>${name(i)}</strong>${zp.posten.map((p) => `<div class="meta">${ZWECKE[p.zweck]}: Soll ${chf(p.soll)} · bezahlt ${chf(p.ist)}</div>`).join('')}</div><div class="r">${zp.posten.map((p) => `<div><span class="chipk ${p.offen > 0 ? 'gelb' : 'ok'}">${p.offen > 0 ? 'offen ' + chf(p.offen) : 'bezahlt'}</span></div>`).join('')}</div></div>`;
      }).join('') + `</div><p class="info">Soll laut Vertrag Ziffer 5 (Rücklage) und Anhang A (Darlehen, bei Kaufpreis CHF 60 000).</p>${ich === D.adminId ? `<details class="det"><summary>Übergabedatum ändern</summary>${startFeld(D.start)}</details>` : ''}`;
  }

  const status = ids.map((i) => {
    const sp = zahlungsSperre(D.zahlstatus[i], t);
    const chip = sp.stufe === 'gesperrt' ? `<span class="chipk rot">Nutzungsverbot seit ${fmt(sp.ab)}</span>` : sp.stufe === 'erinnert' ? `<span class="chipk gelb">Erinnert, Frist bis ${fmt(sp.frist)}</span>` : '<span class="chipk ok">in Ordnung</span>';
    const knopf = !buch ? '' : sp.stufe === 'ok' ? `<button class="btn" data-st="${i}|erinnert">Erinnerung senden</button>` : `<button class="btn pri" data-st="${i}|ok">Zahlung erfolgt</button>`;
    return `<div class="z"><div class="l"><strong>${name(i)}</strong><div>${chip}</div></div><div class="r">${knopf}</div></div>`;
  }).join('');

  const kjahr = kl.filter((k) => k.datum.slice(0, 4) === String(J)).sort((a, b) => (a.datum < b.datum ? 1 : -1));
  const ejahr = el.filter((e) => e.datum.slice(0, 4) === String(J)).sort((a, b) => (a.datum < b.datum ? 1 : -1));
  app.innerHTML = rahmen(`
  <div class="karte"><div class="monatskopf" style="margin:0"><h2>Kosten ${J}</h2><div class="nav"><button id="jz" aria-label="Voriges Jahr">‹</button><button id="jv" aria-label="Nächstes Jahr">›</button></div></div></div>
  <div class="karte"><p class="titel">Rücklage</p><p class="grosszahl"><small>CHF</small> ${chf(r.ruecklagePool)}</p>
    <p class="info">Guthaben aus allen Einzahlungen auf die Rücklage minus Reparaturen, Reifen und grosse Services (diese werden zuerst aus der Rücklage bezahlt, Ziffer 5).${r.ausRuecklage ? ` Aus der Rücklage bezahlt ${J}: CHF ${chf(r.ausRuecklage)}.` : ''}</p></div>
  <div class="karte"><p class="titel">Anteile ${J}</p><p class="grosszahl"><small>CHF</small> ${chf(r.total)} <small>Kosten total</small></p>
    <div class="zeilen" style="margin-top:8px">${anteile}</div>
    <p class="info">Laufende Kosten tragen alle je ein Viertel. Beim Selbstbehalt zahlt der Verursacher allein, beim Bonusverlust 5/8 (Ziffer 12). «Einbezahlt» zählt nur Einzahlungen für laufende Kosten.</p></div>
  <div class="karte"><p class="titel">Zahlplan Vertragsjahr</p>${plan}</div>
  <div class="karte"><p class="titel">Zahlungsstatus</p><div class="zeilen">${status}</div>
    <p class="info">Bei Zahlungsverzug: Erinnerung, 10 Tage Frist, danach Nutzungsverbot bis zur Zahlung (Ziffer 4). Die App sperrt dann Reservierungen für diese Person.</p></div>
  <div class="karte"><div class="kopfzeile"><p class="titel">Kosten ${J}</p>${buch ? '<button class="btn pri" id="kneu">＋ Kosten</button>' : ''}</div>
    ${kjahr.length ? kjahr.map((k) => `<div class="b" style="padding:10px 0"><div class="inhalt"><div class="zeit" style="font-size:15px">${fmt(k.datum).slice(0, 6)} · CHF ${chf(k.betrag)}</div><div class="meta">${h(KOSTENARTEN[k.art])}${k.verursacherId ? ' · Verursacher ' + name(k.verursacherId) : ''}${k.text ? ' · ' + h(k.text) : ''}</div></div>${buch && eigener(k) ? `<button class="kl" data-dk="${k.id}">Löschen</button>` : ''}</div>`).join('') : '<p class="leer-t">Keine Kosten erfasst.</p>'}</div>
  <div class="karte"><div class="kopfzeile"><p class="titel">Einzahlungen ${J}</p>${buch ? '<button class="btn pri" id="eneu">＋ Einzahlung</button>' : ''}</div>
    ${ejahr.length ? ejahr.map((e) => `<div class="b" style="padding:10px 0"><div class="inhalt"><div class="zeit" style="font-size:15px">${fmt(e.datum).slice(0, 6)} · CHF ${chf(e.betrag)}</div><div class="meta">${name(e.personId)} · ${h(ZWECKE[e.zweck])}${e.text ? ' · ' + h(e.text) : ''}</div></div>${buch && eigener(e) ? `<button class="kl" data-de="${e.id}">Löschen</button>` : ''}</div>`).join('') : '<p class="leer-t">Keine Einzahlungen erfasst.</p>'}
    ${buch ? '' : '<p class="info">Eintragen können HP (Buchhaltung) und Nanouk (Stellvertreterin), Vertrag Ziffer 11. Alle sehen die Zahlen.</p>'}</div>`);
  bindRahmen();
  document.getElementById('jz').onclick = () => { jahrK = J - 1; kosten(); };
  document.getElementById('jv').onclick = () => { jahrK = J + 1; kosten(); };
  const kn = document.getElementById('kneu'); if (kn) kn.onclick = kostenForm;
  const en = document.getElementById('eneu'); if (en) en.onclick = einzahlungForm;
  app.querySelectorAll('[data-dk]').forEach((b) => b.onclick = async () => { if (!eigener(D.kosten[b.dataset.dk])) return nurEigene(); if (confirm('Kosteneintrag löschen?')) await sicher(async () => { await S.loeschen(D, 'kosten', b.dataset.dk); kosten(); }); });
  app.querySelectorAll('[data-de]').forEach((b) => b.onclick = async () => { if (!eigener(D.einzahlungen[b.dataset.de])) return nurEigene(); if (confirm('Einzahlung löschen?')) await sicher(async () => { await S.loeschen(D, 'einzahlungen', b.dataset.de); kosten(); }); });
  app.querySelectorAll('[data-st]').forEach((b) => b.onclick = async () => {
    const [pid, neu] = b.dataset.st.split('|');
    await sicher(async () => { await S.speichern(D, 'zahlstatus', pid, neu === 'ok' ? { status: 'ok', erfasstVon: ich } : { status: 'erinnert', erinnertAm: heute(), erfasstVon: ich }); kosten(); hinweis(neu === 'ok' ? 'Status auf «in Ordnung» gesetzt.' : 'Erinnerung gesetzt. Die Frist beträgt 10 Tage.'); });
  });
  const sb = document.getElementById('startspei');
  if (sb) sb.onclick = async () => { const v = val('startdatum'); if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { hinweis('Bitte ein Datum wählen.'); return; } await sicher(async () => { await S.startSetzen(D, v); kosten(); hinweis('Übergabedatum gespeichert.'); }); };
}
function startFeld(wert) {
  return `<label for="startdatum" style="display:block;margin:10px 0 6px;font-size:13px;font-weight:700;color:var(--muted)">Übergabedatum des Fahrzeugs</label><div class="btnzeile" style="margin:0"><input type="date" id="startdatum" value="${h(wert)}" style="flex:1;min-width:150px;font:inherit;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--soft);color:var(--fg)"><button class="btn pri" id="startspei">Speichern</button></div>`;
}

function kostenForm() {
  const ids = idsGeordnet();
  sheet(`<h3>Kosten erfassen</h3>
  <div class="zwei"><div><label for="k_datum">Datum</label><input type="date" id="k_datum" value="${heute()}"></div>
  <div><label for="k_betrag">Betrag in CHF</label><input id="k_betrag" inputmode="decimal" placeholder="z. B. 120.50"></div></div>
  <label for="k_art">Art</label><select id="k_art">${Object.entries(KOSTENARTEN).map(([k, n]) => `<option value="${k}">${h(n)}</option>`).join('')}</select>
  <div id="k_ver" class="versteckt"><label for="k_verursacher">Verursacher</label><select id="k_verursacher">${ids.map((i) => `<option value="${i}">${h(D.personen[i].name)}</option>`).join('')}</select></div>
  <label for="k_text">Beschreibung</label><input id="k_text" maxlength="100" placeholder="optional">
  <p class="info">Alle Kosten laufen über das gemeinsame Konto.</p>
  <div id="msg"></div><div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="spei">Speichern</button></div>`);
  const art = document.getElementById('k_art');
  art.onchange = () => document.getElementById('k_ver').classList.toggle('versteckt', !['selbstbehalt', 'praemie'].includes(art.value));
  document.getElementById('abb').onclick = schliessen;
  document.getElementById('spei').onclick = async () => {
    const betrag = rappen(val('k_betrag')), f = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val('k_datum'))) f.push('Datum fehlt.');
    if (!(betrag > 0)) f.push('Bitte einen Betrag über 0 eingeben, höchstens zwei Nachkommastellen.');
    if (f.length) { fehler(f); return; }
    const k = { datum: val('k_datum'), betrag, art: art.value, text: val('k_text').trim(), erfasstVon: ich };
    if (['selbstbehalt', 'praemie'].includes(art.value)) k.verursacherId = val('k_verursacher');
    await sicher(async () => { await S.speichern(D, 'kosten', null, k); jahrK = parseInt(k.datum.slice(0, 4), 10); schliessen(); kosten(); hinweis('Kosten gespeichert.'); });
  };
}

function einzahlungForm() {
  const ids = idsGeordnet();
  sheet(`<h3>Einzahlung erfassen</h3>
  <div class="zwei"><div><label for="e_datum">Datum</label><input type="date" id="e_datum" value="${heute()}"></div>
  <div><label for="e_betrag">Betrag in CHF</label><input id="e_betrag" inputmode="decimal" placeholder="z. B. 120"></div></div>
  <label for="e_person">Eigentümer</label><select id="e_person">${ids.map((i) => `<option value="${i}">${h(D.personen[i].name)}</option>`).join('')}</select>
  <label for="e_zweck">Zweck</label><select id="e_zweck">${Object.entries(ZWECKE).map(([k, n]) => `<option value="${k}">${h(n)}</option>`).join('')}</select>
  <label for="e_text">Beschreibung</label><input id="e_text" maxlength="100" placeholder="optional">
  <div id="msg"></div><div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="spei">Speichern</button></div>`);
  document.getElementById('abb').onclick = schliessen;
  document.getElementById('spei').onclick = async () => {
    const betrag = rappen(val('e_betrag')), f = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val('e_datum'))) f.push('Datum fehlt.');
    if (!(betrag > 0)) f.push('Bitte einen Betrag über 0 eingeben, höchstens zwei Nachkommastellen.');
    if (f.length) { fehler(f); return; }
    const e = { datum: val('e_datum'), betrag, zweck: val('e_zweck'), personId: val('e_person'), text: val('e_text').trim(), erfasstVon: ich };
    await sicher(async () => { await S.speichern(D, 'einzahlungen', null, e); jahrK = parseInt(e.datum.slice(0, 4), 10); schliessen(); kosten(); hinweis('Einzahlung gespeichert.'); });
  };
}

// =====================================================================
// Termine: MFK, Service, Reifenwechsel, Winterlager, ...
// =====================================================================
function termine() {
  const t = heute();
  const L = termineEcht().sort((a, b) => (!!a.erledigtAm - !!b.erledigtAm) || (a.faelligAm < b.faelligAm ? -1 : 1));
  const CHIP = { ueberfaellig: ['rot', 'überfällig'], bald: ['gelb', 'bald fällig'], offen: ['', 'offen'], erledigt: ['ok', 'erledigt'] };
  app.innerHTML = rahmen(`<div class="karte"><div class="kopfzeile"><p class="titel">Termine</p><button class="btn pri" id="tneu">＋ Termin</button></div>
    <p class="info" style="margin:0 0 6px">HP organisiert Service, MFK, Reifenwechsel und Winterlager (Ziffer 11). Die Kosten tragen alle nach Ziffer 5.</p>
    ${L.length ? L.map((x) => { const s = terminStufe(x, t), [c, txt] = CHIP[s];
      return `<div class="b" style="padding:12px 0"><div class="inhalt"><div class="zeit" style="font-size:16px">${h(x.titel)}</div>
        <div class="meta">${x.erledigtAm ? 'erledigt am ' + fmt(x.erledigtAm) : 'fällig am ' + fmt(x.faelligAm)} · <span class="chipk ${c}">${txt}</span>${x.art && x.art !== x.titel ? ' · ' + h(x.art) : ''}</div>${x.notiz ? `<div class="meta">${h(x.notiz)}</div>` : ''}
        ${eigener(x) ? `<div class="btnzeile">${x.erledigtAm ? `<button class="btn" data-tw="${x.id}">Wieder öffnen</button>` : `<button class="btn pri" data-te="${x.id}">Erledigt</button>`}<button class="btn rot" data-td="${x.id}">Löschen</button></div>` : `<div class="meta">erfasst von ${h(D.personen[x.erfasstVon]?.name || '?')}</div>`}</div></div>`; }).join('') : '<p class="leer-t">Noch keine Termine. Trage zum Beispiel den MFK-Termin ein.</p>'}</div>`);
  bindRahmen();
  document.getElementById('tneu').onclick = terminForm;
  const upd = (id, aend) => !eigener(D.termine[id]) ? nurEigene() : sicher(async () => { await S.speichern(D, 'termine', id, { ...D.termine[id], ...aend }); termine(); });
  app.querySelectorAll('[data-te]').forEach((b) => b.onclick = () => upd(b.dataset.te, { erledigtAm: heute() }));
  app.querySelectorAll('[data-tw]').forEach((b) => b.onclick = () => upd(b.dataset.tw, { erledigtAm: '' }));
  app.querySelectorAll('[data-td]').forEach((b) => b.onclick = async () => { if (!eigener(D.termine[b.dataset.td])) return nurEigene(); if (confirm('Termin löschen?')) await sicher(async () => { await S.loeschen(D, 'termine', b.dataset.td); termine(); }); });
}

function terminForm() {
  sheet(`<h3>Neuer Termin</h3>
  <label for="t_art">Art</label><select id="t_art">${TERMINARTEN.map((a) => `<option>${h(a)}</option>`).join('')}</select>
  <label for="t_titel">Bezeichnung</label><input id="t_titel" maxlength="80" value="${h(TERMINARTEN[0])}">
  <label for="t_datum">Fällig am</label><input type="date" id="t_datum">
  <label for="t_notiz">Notiz</label><input id="t_notiz" maxlength="120" placeholder="optional">
  <div id="msg"></div><div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="spei">Speichern</button></div>`);
  const art = document.getElementById('t_art');
  art.onchange = () => { if (TERMINARTEN.includes(val('t_titel'))) document.getElementById('t_titel').value = art.value; };
  document.getElementById('abb').onclick = schliessen;
  document.getElementById('spei').onclick = async () => {
    const f = [];
    if (!val('t_titel').trim()) f.push('Bezeichnung fehlt.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val('t_datum'))) f.push('Bitte ein Datum wählen.');
    if (f.length) { fehler(f); return; }
    await sicher(async () => { await S.speichern(D, 'termine', null, { art: art.value, titel: val('t_titel').trim(), faelligAm: val('t_datum'), notiz: val('t_notiz').trim(), erledigtAm: '', erfasstVon: ich }); schliessen(); termine(); hinweis('Termin gespeichert.'); });
  };
}

start();
