import {
  SCHWELLE, dauer, konten, kontostaende, kontostaendeMitAlltag, pruefeAlltag, alltagTage, alltagKm, tankWarnung, tankOffen, stufe, kollision, ueberschneidungen, pruefeBuchung, kmZahl, vorschauBuchung,
  TANK, CHECKPUNKTE, pruefeUebergabe, kmStatistik,
  KOSTENARTEN, ZWECKE, TERMINARTEN, ANSCHAFFUNG_MAX_CHF, anschaffung, kostenAnteile, eingezahlt, vertragsJahr, zahlplan, faelligkeiten, VORLAUF_TAGE, addTage, zahlungsSperre, terminStufe, rueckgabeFertig, addJahre, chf,
  WUNSCH_MAX_RAPPEN, WUNSCH_FOTO_MAX, WUNSCH_FRIST_TAGE, WUNSCH_STATUS, wunschTotal, pruefeWunsch, wunschStand, pruefeKauf, istNeu, neuZaehlen, NEU_BEREICHE,
  achtJahrePlan, ERLASS_CHF, zahlungenAusJournal, kontenListe, buchVorlagen, BUCH_TEXT_MAX, pruefeBuchsatz, kontoSalden, erfolgsrechnung, bilanz, kontoblatt,
} from './regeln.js?v=20261112h';
import * as S from './speicher.js?v=20261112h';

const app = document.getElementById('app');
const toast = document.getElementById('toast');
const formEl = document.getElementById('form');
const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const KONTO_NAME = { 'eltern': 'Eltern', 'kind-1': 'Nanouk', 'kind-2': 'Nene' };
const REIHENFOLGE = ['hp', 'fr', 't', 's'];
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = (j, m, t) => `${j}-${String(m + 1).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
const fmt = (s) => s.split('-').reverse().join('.');
const zahl = (n) => Number(n).toLocaleString('de-CH');
const FARBE = { 'hp': 'var(--hp)', 'eltern': 'var(--eltern)', 'nora': 'var(--nora)', 'kind-1': 'var(--kind-1)', 'kind-2': 'var(--kind-2)' };
// Farbe je Person: HP blau, Nora hellblau, Nanouk rosa, Nene tuerkis.
const PERSON_FARBE = { hp: 'hp', fr: 'nora', t: 'kind-1', s: 'kind-2' };
const val = (id) => document.getElementById(id).value;
// Gemeinsamer Seitenkopf aller Tabs: grosser Titel, rechts (wenn es etwas zu erfassen gibt) ein Knopf mit Beschriftung.
const seitenkopf = (titel, id, label) => `<div class="seitenkopf"><h2>${titel}</h2>${id ? `<button class="t-plus lang" id="${id}">${label}</button>` : ''}</div>`;
// Zeit immer nach Schweizer Zeit, auch wenn das Handy im Ausland läuft.
const ZH = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const jetztLokal = () => ZH.format(new Date()).replace(' ', 'T');
const heute = () => jetztLokal().slice(0, 10);

let D, ich = null, tab = 'kalender', ansicht = new Date(), jahrK = new Date().getFullYear();

// «Neu seit deinem letzten Besuch»: Zeitpunkt des letzten Besuchs wird je Person auf dem Gerät gemerkt (beim Verlassen der App).
// Neu ist, was andere nach diesem Zeitpunkt erfasst haben. Geänderte Einträge zählen nicht als neu (nur neu erfasste).
let seit = '';
const keySeit = () => 'womo-zuletzt-' + ich;
function seitLesen() { try { seit = localStorage.getItem(keySeit()) || ''; } catch { seit = ''; } }
function besuchMerken() { if (!ich) return; try { localStorage.setItem(keySeit(), new Date().toISOString()); } catch {} }
function besuchStart() { seitLesen(); if (!seit) besuchMerken(); }   // erster Besuch: nichts ist neu
const neuZ = () => neuZaehlen(D, seit, ich);
const neuPille = (x) => istNeu(x, seit, ich) ? '<span class="neu">NEU</span>' : '';
document.addEventListener('visibilitychange', () => {
  if (!ich || !D) return;
  if (document.visibilityState === 'hidden') besuchMerken();
  else { seitLesen(); if (formEl.innerHTML === '') zeige(); }
});

// Buchhaltung: HP fuehrt sie, die Tochter ist Stellvertreterin (Vertrag Ziffer 11).
const buchhalter = () => ich === D.adminId || ich === 't';
const liste = () => Object.values(D.buchungen);
// Alltagsfahrten liegen als Eintraege mit art 'Alltag' in der Sammlung 'termine' (keine neue Datenbankregel noetig).
const termineEcht = () => Object.values(D.termine).filter((x) => x.art !== 'Alltag' && x.art !== 'Tank');
const tankFuellungen = () => Object.values(D.termine).filter((x) => x.art === 'Tank');
const waLink = (text) => 'https://wa.me/?text=' + encodeURIComponent(text);
const tankText = (tk, wann, wer) => `⛽ Womo: Der Tank ist nicht voll (${tk}), zuletzt erfasst am ${fmt(wann.slice(0, 10))} von ${wer}. Bitte volltanken, bevor das Womo wieder gebraucht wird (Vertrag Ziffer 10).`;
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
toast.onclick = () => { toast.textContent = ''; };
function hinweis(text) { toast.textContent = text; clearTimeout(hinweis.t); hinweis.t = setTimeout(() => { toast.textContent = ''; }, 6000); }
function rappen(txt) { const t = String(txt).trim().replace(/['’\s]/g, '').replace(',', '.'); return /^\d+(\.\d{1,2})?$/.test(t) ? Math.round(parseFloat(t) * 100) : NaN; }
function schliessen() { formEl.innerHTML = ''; }
function sheet(inhalt) {
  formEl.innerHTML = `<div class="sheet" role="dialog"><div class="griff"></div>${inhalt}</div>`;
  formEl.onclick = (e) => { if (e.target === formEl) schliessen(); };
}
function fehler(texte) { const m = document.getElementById('msg'); if (m) m.innerHTML = `<div class="fehler">${[].concat(texte).map(h).join('<br>')}</div>`; }
// Läuft schon ein Speichern, wird ein zweiter Tipp ignoriert (kein doppelter Eintrag).
async function sicher(fn) {
  if (sicher.l) return; sicher.l = true;
  try { await fn(); } catch (e) { fehler('Speichern fehlgeschlagen: ' + (e.message || e)); } finally { sicher.l = false; }
}

// Eingabe des Zugangscodes, falls die App ohne Code geoeffnet wird (z. B. Icon auf dem iPhone-Startbildschirm).
function codeFeld(meldung) {
  app.innerHTML = `<div class="login"><p class="gross">Womo</p><p class="sub">Zugang einrichten</p>
  <p class="info">Füge den Link ein, den du per Nachricht bekommen hast (oder nur den Code dahinter). Das ist nur einmal nötig.</p>
  <label for="cd">Link oder Code</label><input id="cd" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="300">
  <div id="msg">${meldung ? `<div class="fehler">${h(meldung)}</div>` : ''}</div><button id="cok">Weiter</button></div>`;
  const los = () => {
    if (S.codeSetzen(document.getElementById('cd').value)) location.reload();
    else document.getElementById('msg').innerHTML = '<div class="fehler">Das sieht nicht nach dem Link oder Code aus. Bitte den ganzen Link aus der Nachricht einfügen.</div>';
  };
  document.getElementById('cok').onclick = los;
  document.getElementById('cd').onkeydown = (e) => { if (e.key === 'Enter') los(); };
}

async function start() {
  app.innerHTML = '<div class="login"><p class="gross">Womo</p><p class="sub">Daten werden geladen …</p></div>';
  try { D = await S.laden(); }
  catch (e) {
    if (!S.online || /ungültig/.test(e.message || '')) { codeFeld(!S.online ? '' : 'Dieser Code ist ungültig.'); return; }
    app.innerHTML = `<div class="login"><p class="gross" style="font-size:24px;font-weight:800">Womo</p><div class="fehler">${h(e.message || 'Verbindung fehlgeschlagen.')}</div></div>`; return;
  }
  try { await S.abonnieren(D, () => { if (ich && formEl.innerHTML === '') zeige(); }); }
  catch (e) { app.innerHTML = `<div class="login"><p class="gross" style="font-size:24px;font-weight:800">Womo</p><div class="fehler">${h('Daten konnten nicht geladen werden: ' + (e.message || e))}</div><button id="nochmal">Nochmals versuchen</button></div>`; document.getElementById('nochmal').onclick = () => location.reload(); return; }
  try { const id = sessionStorage.getItem('womo-ich'); if (id && D.personen[id]) { ich = id; besuchStart(); } } catch {}
  zeige();
}

function zeige() {
  if (!ich) return anmeldung();
  ({ kalender, fahrten, kosten, wunschliste, termine, vertrag, unterwegs })[tab]();
}

function anmeldung() {
  if (!Object.keys(D.personen).length) { app.innerHTML = '<div class="login"><p class="gross">Womo</p><div class="fehler">Es sind noch keine Personen eingerichtet. Bitte zuerst die Einrichtung durchführen.</div></div>'; return; }
  let zuletzt = ''; try { zuletzt = localStorage.getItem('womo-person') || ''; } catch {}
  app.innerHTML = `<div class="login"><p class="gross">Womo</p><p class="sub">Wer bist du?</p>
  <label for="p">Name</label>
  <select id="p">${personenGeordnet().map(([i, p]) => `<option value="${i}"${i === zuletzt ? ' selected' : ''}>${h(p.name)}</option>`).join('')}</select>
  <label for="pin">Passwort</label><input id="pin" maxlength="40" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" type="password">
  <div id="msg"></div><button id="ok">Weiter</button>
  <p class="klein-t" style="margin-top:14px">Das Passwort zeigt nur, wer eine Eintragung erfasst. Er schützt keine Daten.</p></div>`;
  const los = async () => {
    const id = document.getElementById('p').value, pin = document.getElementById('pin').value;
    let sp = { n: 0, bis: 0 }; try { sp = JSON.parse(localStorage.getItem('womo-pinfehler')) || sp; } catch {}
    if (Date.now() < sp.bis) { document.getElementById('msg').innerHTML = `<div class="fehler">Zu viele Fehlversuche. Bitte ${Math.ceil((sp.bis - Date.now()) / 1000)} Sekunden warten.</div>`; return; }
    if (await S.pinPasst(D.personen[id], pin)) { try { localStorage.removeItem('womo-pinfehler'); } catch {} ich = id; tab = 'kalender'; try { sessionStorage.setItem('womo-ich', id); localStorage.setItem('womo-person', id); } catch {} besuchStart(); zeige(); }
    else { sp.n++; if (sp.n >= 5) { sp.bis = Date.now() + 60000; sp.n = 0; } try { localStorage.setItem('womo-pinfehler', JSON.stringify(sp)); } catch {} document.getElementById('msg').innerHTML = `<div class="fehler">Passwort für ${h(D.personen[id].name)} falsch (Gross- und Kleinschreibung beachten). Name oben richtig gewählt?</div>`; }
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
  wunschliste: '<path d="M12 3l2.600 5.600 6.100.700-4.500 4.200 1.200 6L12 16.600 6.600 19.500l1.200-6L3.300 9.300l6.100-.700z"/>',
};
// Der Tab «Wunschliste» heisst in der Leiste «Wünsche» (7 Tabs, sonst ist die Beschriftung zu breit). Die Seite heisst «Wunschliste».
const TABS = [['kalender', 'Kalender'], ['termine', 'Termine'], ['fahrten', 'Fahrten'], ['kosten', 'Kosten'], ['wunschliste', 'Wünsche'], ['unterwegs', 'Unterwegs'], ['vertrag', 'Vertrag']];
const SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ORTE = [
  ['u1', '<path d="M3 20 12 5l9 15zM12 5v15M9 20l3-6 3 6"/>', 'Campingplätze', 'Organisierte Campingplätze mit Strom und Sanitär', 'Sicher, Strom und Sanitär vorhanden', [
    ['Verbände und Clubs', [['TCS Camping (CH)', 'https://www.tcs.ch/de/camping-reisen/camping/'], ['Swisscamps (CH)', 'https://www.swisscamps.ch/de'], ['ADAC PiNCAMP (DE)', 'https://www.pincamp.de/'], ['Deutscher Camping-Club (DE)', 'https://camping-club.de/'], ['Österr. Camping Club (AT)', 'https://www.campingclub.at/'], ['Camping and Caravanning Club (UK)', 'https://www.campingandcaravanningclub.co.uk/'], ['ACS Camping Card (CH)', 'https://www.acs.ch/en/mitgliedschaft/clubleistungen/camping-card.php']]],
    ['Dachverbände Europa', [['EFCO & HPA (Verband der Campingwirtschaft)', 'https://www.efcohpa.eu/'], ['FICC (Camping-Weltverband)', 'https://ficc.org/en/'], ['Camping Key Europe', 'https://en.service.camping.se/guide/information-about-camping-key-europe'], ['Ratgeber: Verbände und Ketten (promobil)', 'https://www.promobil.de/stellplaetze/campingplatz-organisationen-ketten-verbaende-bonussystem-mehrwert/']]],
    ['Gruppen und Ketten', [['Leading Campings of Europe', 'https://www.leadingcampings.com/de/'], ['Les Castels (FR)', 'https://www.les-castels.com/'], ['Huttopia', 'https://europe.huttopia.com/'], ['Top Camping Austria', 'https://www.topcamping.at/']]],
    ['Rabattkarten und Führer', [['ACSI CampingCard', 'https://www.campingcard.com/'], ['ADAC Campcard', 'https://www.pincamp.de/campingthemen/adac-campcard'], ['ADAC Campingführer', 'https://www.adac.de/services/buecher-magazine/campingfuehrer/']]],
    ['Suchportale', [['ACSI Eurocampings', 'https://www.eurocampings.de/'], ['camping.info', 'https://www.camping.info/de'], ['camping.ch (CH)', 'https://camping.ch/'], ['NorCamp (Skandinavien)', 'https://www.norcamp.de/'], ['StayFree (Camping, Stellplätze, frei)', 'https://www.stayfree.app/'], ['park4night (Camping, Stellplätze, frei)', 'https://park4night.com/en']]]]],
  ['u2', '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3"/>', 'Offizielle Stellplätze', 'Gemeinden, Städte, Häfen, Thermen, Freizeitparks, Bergbahnen', 'Nur ausgewiesene Plätze, Platzregeln beachten', [
    ['Stellplatz-Apps und Verzeichnisse', [['Wohnmobilland (CH)', 'https://www.womoland.ch/'], ['stellplatz.info', 'https://stellplatz.info/'], ['Campercontact', 'https://www.campercontact.com/de'], ['promobil Stellplatz-Atlas', 'https://www.promobil.de/stellplaetze/'], ['Stellplatz-Radar-App (promobil)', 'https://www.promobil.de/stellplatz-radar'], ['CaraMaps', 'https://www.caramaps.com/'], ['Camping-App.eu', 'https://camping-app.eu/'], ['Bordatlas (Europa)', 'https://bordatlas.de/'], ['Searchforsites', 'https://www.searchforsites.co.uk/'], ['iOverlander', 'https://ioverlander.com/'], ['StayFree (Camping, Stellplätze, frei)', 'https://www.stayfree.app/'], ['park4night (Camping, Stellplätze, frei)', 'https://park4night.com/en']]],
    ['Autohöfe in Deutschland', [['Artikel: Übernachten auf Autohöfen (promobil)', 'https://www.promobil.de/uebernachtungstipps/auf-vielen-deutschen-autohoefen-kann-man-mit-dem-camper-guenstig-uebernachten/'], ['Websuche: Autohof Wohnmobil übernachten', 'https://www.google.com/search?q=' + encodeURIComponent('Autohof Wohnmobil übernachten Stellplatz')]], 'In Deutschland gibt es rund 230 Autohöfe direkt an Autobahnausfahrten, etwa die Hälfte erlaubt Wohnmobilen das Übernachten. Kosten: 0 bis 25 Euro pro Nacht, bezahlt wird meist an der Tankstelle, Strom gibt es selten. In stellplatz.info und Campercontact (oben) einfach nach «Autohof» suchen.'],
    ['Parkplatz-Apps (nur, wo erlaubt)', [['EasyPark', 'https://easypark.com/de-ch']]]]],
  ['u3', '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-2.5 5-2.5 8h2.5v10"/>', 'Gasthöfe, Restaurants, Hotels', 'Stellplatz auf dem Parkplatz des Betriebs', 'Vorher fragen, oft gratis bei Konsumation', null],
  ['u4', '<path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-5h4v5"/>', 'Bauernhöfe, Winzer, Private', 'Auch Bekannte und Verwandte mit Garten oder Parkplatz', 'Meist einfach, dafür ruhig. Vorab anfragen', [
    ['Schweiz', [['Landcamp.ch', 'https://www.landcamp.ch/'], ['Nomady', 'https://nomady.camp/'], ['Myfarm.ch', 'https://www.myfarm.ch/de']]],
    ['Europa', [['AlpacaCamping', 'https://www.alpacacamping.de/'], ['Landvergnügen', 'https://landvergnuegen.com/'], ['Hinterland', 'https://hinterland.camp/en'], ['VanSite', 'https://vansite.eu/de'], ['Roadsurfer Spots', 'https://roadsurfer.com/de/spots/'], ['Camperland', 'https://www.camperland.de/'], ['France Passion (FR)', 'https://www.france-passion.com/'], ['Campspace', 'https://campspace.com/en'], ['Hipcamp', 'https://www.hipcamp.com/en-GB']]]]],
];
const LAENDER = [
  ['🇫🇷', 'Frankreich', 'Gemeinden entscheiden, Aires nutzen', ['Stellplätze heissen «Aires de camping-car».', 'Die Gemeinden entscheiden. In vielen ländlichen Gegenden wird eine Nacht im Wohnmobil geduldet, nicht aber an Küsten, in Schutzgebieten, bei Denkmälern und bei Trinkwasserquellen. Auf Korsika ist es streng verboten. Busse bis 1500 Euro. Am sichersten sind die Aires de camping-car.']],
  ['🇮🇹', 'Italien', 'Wildcampen verboten', ['Stellplätze heissen «Aree di sosta», Bauernhöfe «Agricamper».', 'Wildcampen ist verboten, in Touristengebieten wird oft kontrolliert. Bussen bis etwa 500 Euro, je nach Region. Erlaubt sind Campingplätze, ausgewiesene Aree di sosta und Privatgrund mit Erlaubnis des Besitzers. Die Quellen widersprechen sich teils.']],
  ['🇪🇸', 'Spanien', 'Meist verboten, je nach Region verschieden', ['Stellplätze heissen «Áreas de autocaravanas».', 'Freies Campen ist in den meisten Regionen nicht erlaubt. Es gibt kein einheitliches Landesgesetz, die Regionen regeln es selbst. Übernachten im Fahrzeug ist dort möglich, wo Parken erlaubt ist und kein Verbotsschild steht, solange nichts ausgefahren wird (Markise, Tisch, Stühle). Strände sind generell verboten.']],
  ['🇩🇪', 'Deutschland', 'Wildcampen verboten, eine Nacht zur Erholung erlaubt', ['Stellplätze heissen «Wohnmobilstellplätze».', 'Wildcampen ist verboten, in Naturschutzgebieten und auf Privatgrund erst recht. Ausnahme: eine Nacht auf einem Parkplatz, um wieder fahrtüchtig zu werden. Das gilt nur, wenn das Ziel noch nicht erreicht ist. Markise, Tisch und Stühle bleiben eingepackt. Einzelne Gemeinden können es zusätzlich einschränken.']],
  ['🇭🇷', 'Kroatien', 'Wildcampen verboten, nur Camping oder Stellplatz', ['Wildcampen ist verboten. Nur Campingplatz oder Stellplatz.'], true],
  ['🇦🇹', 'Österreich', 'Freistehen meist verboten', ['Freistehen ist in den meisten Bundesländern verboten oder streng geregelt (Landesgesetze, hohe Strafen möglich). Campingplatz oder Stellplatz wählen.', 'Maut: Bis 3,5 t zulässigem Gesamtgewicht gilt die Vignette, darüber die GO-Box. Das Gewicht unseres Fahrzeugs vorher prüfen.']],
  ['🇸🇮', 'Slowenien', 'Wildcampen verboten', ['Wildcampen ist verboten, auch Übernachten am Strassenrand und auf Parkplätzen. Strafen von mehreren hundert Euro.', 'Autobahn: nur elektronische Vignette, an das Kennzeichen gebunden. Vor der Fahrt kaufen.']],
  ['🇳🇱', 'Niederlande', 'Freistehen streng verboten', ['Freistehen ist verboten, auch auf normalen Parkplätzen. «Camperplaatsen» oder Campingplätze benutzen.', 'Viele Städte haben Umweltzonen. Vor der Einfahrt prüfen.']],
  ['🇧🇪', 'Belgien', 'Wildcampen verboten', ['Wildcampen ist verboten, in Flandern und an der Küste streng kontrolliert. Sicher: Stellplatz oder Campingplatz.', 'Umweltzone Brüssel (LEZ): ausländische Fahrzeuge vorher online anmelden, Zulassung des Fahrzeugs prüfen (lez.brussels).']],
  ['🇱🇺', 'Luxemburg', 'Freistehen verboten', ['Freistehen ist verboten. Abseits von Städten wird eine Nacht teils geduldet, das ist keine Rechtsgrundlage. Auf Privatgrund mit Erlaubnis möglich.', 'Keine Autobahnmaut und keine Vignette für Pkw und Wohnmobile. Einzelne Brücken oder Tunnel können Gebühren haben. Keine Umweltzonen.']],
  ['🇩🇰', 'Dänemark', 'Kein Jedermannsrecht', ['Übernachten nur auf Campingplätzen und ausgewiesenen Plätzen. Zu einer Nacht am Strassenrand widersprechen sich die Quellen.', 'Keine Autobahnmaut, aber Gebühr für Storebælt- und Öresundbrücke (pro Fahrt, Preis nach Fahrzeug).']],
  ['🇸🇪', 'Schweden', 'Jedermannsrecht gilt nicht für Wohnmobile', ['Das Jedermannsrecht gilt für Wohnmobile nur eingeschränkt: nicht im Wald oder abseits fester Strassen. Üblich sind Rastplätze und öffentliche Parkplätze. Verbotsschilder beachten.', 'Meist keine Maut. Stau-Gebühr in Stockholm und Göteborg, automatisch erfasst.', 'Einbrüche in Wohnmobile auf Rastplätzen sind häufig, das deutsche Auswärtige Amt warnt davor.']],
  ['🇳🇴', 'Norwegen', 'Jedermannsrecht nur für Zelte', ['Das Jedermannsrecht gilt für Zelte, nicht für Wohnmobile. Auf vielen Rastplätzen ausserhalb von Städten wird Übernachten geduldet, an Hotspots (z. B. Geiranger, Preikestolen) ist es verboten.', 'Viele Mautstationen (AutoPASS). Ausländische Fahrzeuge vorher registrieren (Epass24) oder Chip besorgen, sonst droht eine höhere Klasse.']],
  ['🇫🇮', 'Finnland', 'Für Wohnmobile unklar', ['Das Jedermannsrecht deckt vor allem Zelten ab. Für Wohnmobile ist Übernachten ausserhalb von Campingplätzen unklar: nicht auf Strassen und öffentlichen Parkplätzen, auf Privatgrund nur mit Zustimmung des Eigentümers.', 'Die öffentlichen Strassen sind für private Pkw und Wohnmobile maut- und vignettenfrei.']],
  ['🇵🇹', 'Portugal', 'Freistehen eingeschränkt', ['Freistehen ist eingeschränkt und regional verschieden, die Quellen widersprechen sich. Ein Gesetz zum Parken und Übernachten von Wohnmobilen gilt laut Berichten seit Januar 2026 (nicht im Original geprüft). Schilder und Gemeindeverbote beachten, Stellplätze nutzen.', 'Viele Autobahnen sind mautpflichtig. Transponder (Via Verde oder kompatible Box), Mautklasse des Fahrzeugs vorher prüfen.']],
  ['🇬🇷', 'Griechenland', 'Parken erlaubt, Campen verboten', ['Wohnmobile dürfen seit der Polizeiverordnung 2026 wie andere Fahrzeuge parken: in Ortschaften bis 7,5 m ohne Zeitlimit, längere 24 Stunden, ausserhalb ohne Zeitgrenze. Wer Stühle, Tisch oder Markise aufbaut, campt: das bleibt verboten (Gesetz 5170/2025, Strafen ab etwa 300 Euro). Die Quellen nennen für die Verordnung Februar oder April 2026, den amtlichen Text habe ich nicht gefunden.', 'Keine Vignette. Fast alle Autobahnen sind mautpflichtig, der Preis hängt von der Fahrzeughöhe ab. Preise steigen, die Quellen widersprechen sich: vor der Reise mit dem Routenplaner mit Mautkosten (z. B. ADAC) prüfen.']],
];
// Rot = Wildcampen oder Freistehen ist verboten (gleiche Regel für alle Länder).
const VERBOT_LAND = new Set(['Kroatien', 'Österreich', 'Slowenien', 'Niederlande', 'Belgien', 'Luxemburg', 'Deutschland', 'Spanien', 'Italien']);
// Weitere Länder aus Vertrag Ziffer 9 (Stand der Recherche 08.11.2026, Quellen: Reiseportale und Automobilclubs, keine Behörden).
LAENDER.push(
  ['🇨🇭', 'Schweiz', 'Kein Landesgesetz, Kantone und Gemeinden entscheiden', ['Wildcampen ist nicht generell verboten, aber Kantone und Gemeinden regeln es selbst. In Schutzgebieten und Nationalparks ist es verboten. Verbotsschilder gelten. Auf Privatgrund nur mit Erlaubnis. Bussen je nach Kanton etwa 200 bis 2000 Franken.', 'Autobahnvignette: 40 Franken, 14 Monate gültig, für Fahrzeuge bis 3,5 t. Schwerere Wohnmobile zahlen die Schwerverkehrsabgabe. Tunnel und Pässe können extra kosten.']],
  ['🇱🇮', 'Liechtenstein', 'Eigentlich verboten, örtlich geduldet', ['Freies Campen ist eigentlich nicht erlaubt, wird aber je nach Gemeinde nicht streng kontrolliert. Am sichersten sind Campingplätze und ausgewiesene Stellplätze.']],
  ['🇨🇿', 'Tschechien', 'Wildcampen verboten', ['Wildcampen und Freistehen sind verboten. Übernachten geht auf Campingplätzen, ausgewiesenen Stellplätzen und mit Erlaubnis des Eigentümers auf Parkplätzen, wenn kein Verbotsschild steht. Die Quellen widersprechen sich bei Parkplätzen.', 'Autobahnen und Schnellstrassen: elektronische Vignette für Fahrzeuge bis 3,5 t, an das Kennzeichen gebunden, vor der Fahrt kaufen. Ohne Vignette drohen etwa 830 Euro Busse. Preise vorher prüfen, die Quellen nennen verschiedene Beträge.']],
  ['🇵🇱', 'Polen', 'Rechtlich heikel, oft geduldet', ['Wildcampen ist durch Umwelt- und Waldgesetz eigentlich verboten, wird in der Praxis aber oft geduldet. Die Quellen widersprechen sich. Mit dem Wohnmobil im Wald ist es nicht erlaubt (nur Zelte in ausgewiesenen Wäldern). Bussen ab etwa 100 Zloty bis 120 Euro.', 'Keine Vignette. Streckenmaut über e-TOLL (GPS-App) für Fahrzeuge über 3,5 t. Die privaten Autobahnen A1, A2 und A4 werden separat an Mautstellen bezahlt.']],
  ['🇪🇪', 'Estland', 'Freies Übernachten vielerorts einfach', ['Übernachten ist vielerorts unkompliziert, Naturcamping ist verbreitet. Auf Privatgrund nur mit Erlaubnis des Besitzers. In Nationalparks und Schutzgebieten die Regeln vor Ort beachten.', 'Alle öffentlichen Strassen sind für Pkw und Wohnmobile maut- und vignettenfrei.']],
  ['🇱🇻', 'Lettland', 'Keine einheitliche Regel', ['Es gibt keine einheitliche Regelung. Eine Nacht freies Stehen ist oft möglich, wo es nicht ausdrücklich verboten ist. Privatgrund nur mit Erlaubnis. Üblich sind Campingplätze, vor allem an der Ostseeküste.', 'Keine Vignette für Fahrzeuge bis 3,5 t. Im Badeort Jūrmala wird eine Maut erhoben.']],
  ['🇱🇹', 'Litauen', 'Keine einheitliche Regel', ['Es gibt keine einheitliche Regelung. Eine Nacht freies Stehen ist oft möglich, wo es nicht ausdrücklich verboten ist. Privatgrund nur mit Erlaubnis. Üblich sind Campingplätze, vor allem an der Ostseeküste.', 'Keine Vignette für Pkw und Wohnmobile. Die Einfahrt auf die Kurische Nehrung kostet eine Gebühr.']],
  ['🇭🇺', 'Ungarn', 'Wildcampen mit Fahrzeug nicht erlaubt', ['Wildcampen mit dem Wohnmobil ist nicht erlaubt, die Quellen widersprechen sich aber. Campingplätze und Stellplätze nutzen.', 'Autobahnen und Schnellstrassen (mit «M»): elektronische Vignette e-Matrica, an das Kennzeichen gebunden. Ohne Vignette bleiben 60 Minuten zum Nachkaufen. Über 3,5 t gilt das Mautsystem HU-GO.']],
  ['🇧🇦', 'Bosnien-Herzegowina', 'Freies Campen verboten, Minengefahr', ['Freies Campen ist grundsätzlich verboten. Wegen der Minengefahr befestigte Wege nicht verlassen und Schilder beachten.', 'Keine Vignette. Maut nur abschnittsweise auf der A1, bar in Mark oder Euro. Versicherungsnachweis vorher bei der Versicherung klären (internationale Versicherungskarte «BIH»), die Quellen widersprechen sich.']],
  ['🇲🇪', 'Montenegro', 'Nicht erlaubt, abseits teils geduldet', ['Freistehen ist nicht erlaubt, abseits der Touristengebiete wird es teils geduldet. An Stränden und in Nationalparks verboten.', 'Maut nur auf der Autobahn A1 (Bar–Boljare) und im Sozina-Tunnel. Einreise mit Personalausweis: Aufenthalt höchstens 30 Tage.']],
  ['🇦🇱', 'Albanien', 'Abseits der Städte meist geduldet', ['Freistehen wird abseits der Städte meist geduldet, in Nationalparks ist es eingeschränkt. Nachtfahrten meiden, viele Fahrzeuge sind unbeleuchtet.', 'Maut: Die Quellen widersprechen sich (kleine Gebühr im Kalimash-Tunnel, sonst meist mautfrei). Einreise ohne Visum mit Pass oder Personalausweis, Versicherungskarte mitnehmen.']],
  ['🇲🇰', 'Nordmazedonien', 'Freies Campen nicht erlaubt', ['Freies Campen ist grundsätzlich nicht erlaubt, auf Privatgrund mit Einverständnis des Eigentümers möglich.', 'Autobahn: kleine Gebühren, bar oder mit Karte. Eine Meldepflicht bei der Polizei nach 24 Stunden wird genannt, die Quelle ist undatiert, bitte vorher prüfen.']],
  ['🇮🇪', 'Irland', 'Offiziell nicht erlaubt', ['Wildcampen ist offiziell nicht erlaubt (Schilder «Temporary Dwelling prohibited»). Eine Nacht auf öffentlichem Grund wird teils geduldet. Der grösste Teil des Landes ist privat, dort nur mit Erlaubnis des Besitzers.', 'Maut praktisch nur auf der M50 bei Dublin, per Kennzeichen erfasst. Bis 20 Uhr des Folgetags online bezahlen (eflow.ie), sonst Strafgebühr.']],
  ['🇬🇧', 'Vereinigtes Königreich', 'England: nur mit Erlaubnis, Schottland anders', ['England, Wales und Nordirland: Übernachten ausserhalb von Campingplätzen ist ohne Erlaubnis des Grundbesitzers nicht erlaubt. Schottland: Jedermannsrecht, gilt aber vor allem für Zelte. Wohnmobile dürfen nur zur Wiederherstellung der Fahrtüchtigkeit pausieren. Im Gebiet Loch Lomond gelten Sonderregeln.', 'Zu Maut und Einreise habe ich nichts Verlässliches gefunden. Vor der Reise bei gov.uk und beim ADAC prüfen.']],
  ['🇸🇰', 'Slowakei', 'Wildcampen unklar, Parken erlaubt, nicht biwakieren', ['Zum Wildcampen fand sich keine verlässliche Regel. Auf normalen Parkplätzen darf ein Wohnmobil laut einem Ratgeber stehen, solange nicht biwakiert wird (keine Möbel draussen, nicht kochen) und kein Einfahrtsverbot gilt. Campingplätze, Bauernhöfe und Wohnmobilzonen sind sicher.', 'Autobahnen und Schnellstrassen: elektronische Vignette, an das Kennzeichen gebunden, für Fahrzeuge bis 3,5 t zulässigem Gesamtgewicht. Kauf online, per App «eznamka» oder an Grenzübergängen und Tankstellen. Preise vor dem Kauf auf der offiziellen Seite prüfen.']],
  ['🇧🇬', 'Bulgarien', 'Wildcampen offiziell verboten, teils geduldet', ['Die Quellen widersprechen sich: Ein Ratgeber nennt Wildcampen und Freistehen offiziell verboten, ein Camping-Blog schreibt, es werde in manchen Gegenden geduldet, wo es nicht ausdrücklich verboten ist. Vor Ort nachfragen und Campingplätze oder Stellplätze nutzen.', 'Maut auf allen Nationalstrassen: nur elektronische Vignette, an das Kennzeichen gebunden (Online-Shop, App BGTOLL, Automaten und Verkaufsstellen). Preise vor dem Kauf auf bgtoll.bg prüfen. Einreise mit Personalausweis möglich.']],
  ['🇨🇾', 'Zypern', 'Freies Campen nicht erlaubt', ['Laut ADAC ist freies Campen nicht erlaubt und nur auf offiziell ausgewiesenen Flächen zulässig. In Staatswäldern ist es verboten und wird streng geahndet.', 'Linksverkehr, Scheinwerfer für den Linksverkehr einstellen. Zu Maut und Fähre fand sich nichts Verlässliches, vor der Reise klären.']],
  ['🇲🇹', 'Malta', 'Freies Campen verboten, Genehmigung teils möglich', ['Laut ADAC ist freies Campen verboten, in einigen Gemeinden kann eine Genehmigung eingeholt werden. Eine andere Quelle schreibt, es sei problemlos möglich: Die Quellen widersprechen sich. Es gibt nur wenige Campingplätze.', 'Linksverkehr, Scheinwerfer für den Linksverkehr einstellen. Höchstmasse Wohnmobil: 12 m Länge, 2,55 m Breite, 4 m Höhe. Zu Maut und Fähre fand sich nichts Verlässliches, vor der Reise klären.']],
  ['🇮🇸', 'Island', 'Ausserhalb von Campingplätzen verboten', ['Übernachten ausserhalb von Campingplätzen ist verboten, ausser mit Erlaubnis des Landbesitzers.', 'Seit 2026 gibt es eine Streckenmaut statt einer Vignette. Einziger klassischer Mautpunkt ist der Tunnel Vaðlaheiðargöng bei Akureyri (online innert 24 Stunden bezahlen, Quelle älter). Anreise nur per Fähre (Smyril Line ab Hirtshals, etwa 42 Stunden).']],
);
LAENDER.sort((a, b) => a[1].localeCompare(b[1], 'de'));
// Rot = Wildcampen oder Freistehen ist verboten (gleiche Regel für alle Länder).
VERBOT_LAND.add('Tschechien'); VERBOT_LAND.add('Ungarn'); VERBOT_LAND.add('Bosnien-Herzegowina'); VERBOT_LAND.add('Montenegro'); VERBOT_LAND.add('Nordmazedonien'); VERBOT_LAND.add('Irland'); VERBOT_LAND.add('Island'); VERBOT_LAND.add('Zypern'); VERBOT_LAND.add('Malta');
// Direkte Links zu Campingverbänden und Campingplatz-Verzeichnissen je Land (am 08.11.2026 geprüft: Seite erreichbar).
const CI = (slug) => ['camping.info', 'https://www.camping.info/de/land/' + slug];
const LAND_LINKS = {
  'Schweiz': [['Swisscamps (Verband)', 'https://www.swisscamps.ch/de'], ['TCS Camping', 'https://www.tcs.ch/de/camping-reisen/camping/'], ['camping.ch', 'https://camping.ch/']],
  'Liechtenstein': [CI('liechtenstein')],
  'Deutschland': [['Deutscher Camping-Club', 'https://camping-club.de/'], ['ADAC PiNCAMP', 'https://www.pincamp.de/'], CI('deutschland')],
  'Österreich': [['Österr. Camping Club', 'https://www.campingclub.at/'], ['Top Camping Austria', 'https://www.topcamping.at/'], CI('austria')],
  'Frankreich': [['FNHPA (Verband)', 'https://fnhpa-pro.fr/'], ['Les Castels', 'https://www.les-castels.com/'], ['Huttopia', 'https://europe.huttopia.com/'], CI('frankreich')],
  'Italien': [['Federcampeggio', 'https://www.federcampeggio.it/'], CI('italien')],
  'Spanien': [CI('spanien')],
  'Portugal': [['FCMP (Verband)', 'https://www.fcmportugal.com/'], ['Orbitur', 'https://www.orbitur.pt/pt/'], CI('portugal')],
  'Niederlande': [['Recron (Verband)', 'https://www.recron.nl/'], CI('niederlande')],
  'Belgien': [['Camping.be', 'https://www.camping.be/nl/'], CI('belgien')],
  'Luxemburg': [['Camprilux', 'https://www.camping.lu/'], CI('luxemburg')],
  'Dänemark': [['Dansk Camping Union', 'https://www.dcu.dk/da'], CI('danemark')],
  'Schweden': [['SCR Camping.se (Verband)', 'https://camping.se/sv'], ['Camping Key Europe', 'https://en.service.camping.se/guide/information-about-camping-key-europe'], CI('schweden')],
  'Norwegen': [['Camping.no', 'https://camping.no/nb/'], CI('norwegen')],
  'Finnland': [['Camping Finland (Verband)', 'https://camping.fi/'], CI('finnland')],
  'Island': [['Camping Card Iceland', 'https://utilegukortid.is/?lang=en'], CI('island')],
  'Irland': [['Irish Caravan & Camping Club', 'https://www.iccc.ie/'], CI('irland')],
  'Vereinigtes Königreich': [['Camping and Caravanning Club', 'https://www.campingandcaravanningclub.co.uk/']],
  'Kroatien': [['Croatian Camping Association', 'https://www.camping.hr/'], CI('kroatien')],
  'Slowenien': [['Avtokampi.si (Info-Portal)', 'https://avtokampi.si/'], CI('slowenien')],
  'Griechenland': [CI('griechenland')],
  'Tschechien': [['Asociace kempů ČR (Verband)', 'https://www.camp.cz/asociace/index.aspx?sflang=en'], CI('tschechien')],
  'Polen': [['PFCC (Verband)', 'https://pfcc.eu/'], CI('polen')],
  'Ungarn': [CI('ungarn')],
  'Slowakei': [CI('slowakei')], 'Bulgarien': [CI('bulgarien')], 'Zypern': [CI('zypern')], 'Malta': [CI('malta')],
  'Estland': [CI('estland')], 'Lettland': [CI('lettland')], 'Litauen': [CI('litauen')],
  'Bosnien-Herzegowina': [CI('bosnien-herzegowina')], 'Montenegro': [CI('montenegro')], 'Albanien': [CI('albanien')], 'Nordmazedonien': [CI('mazedonien')],
};
function unterwegs() {
  const such = (n) => 'https://www.google.com/search?q=' + encodeURIComponent(n === 'Campingplätze' ? 'Campingplatz Wohnmobil Verband' : n + ' Wohnmobil Stellplatz');
  const suchL = (q) => 'https://www.google.com/search?q=' + encodeURIComponent(q);
  const chip = ([n, url]) => {
    const m = n.match(/^(.*?)\s*\((.*)\)\s*$/), name = m ? m[1] : n, note = m ? m[2] : '';
    return `<a class="u-chip" href="${h(url)}" target="_blank" rel="noopener">${h(name)}${note ? `<em>${h(note)}</em>` : ''}</a>`;
  };
  app.innerHTML = rahmen(`${seitenkopf('Unterwegs')}<div class="u-ban slim"><span class="u-bic">${SVG('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>')}</span>
    <div><strong>Keine Übernachtung auf Autobahnraststätten</strong></div></div>
  <div class="karte"><p class="titel">Wo übernachten?</p>${ORTE.map(([c, ic, t, w, hin, gruppen]) => {
      const kopf = `<span class="u-ic ${c}">${SVG(ic)}</span><div class="u-tx"><strong>${h(t)}</strong><span>${h(w)}</span><span class="u-hint ${c}">${h(hin)}</span></div>`;
      const kopfLink = `<a class="u-ortlink u-kopf" href="${such(t)}" target="_blank" rel="noopener">${kopf}<span class="u-pfeil" aria-hidden="true">›</span></a>`;
      return gruppen ? `<div class="u-ort" style="flex-direction:column;gap:0">${kopfLink}
        <div style="margin-top:4px">${gruppen.map(([g, l, hin2]) => `<details class="u-det"><summary><span>${h(g)}</span><b>${l.length}</b></summary>${hin2 ? `<p class="info" style="margin:0 0 8px">${h(hin2)}</p>` : ''}<div class="u-chips">${l.map(chip).join('')}</div></details>`).join('')}</div></div>`
        : `<div class="u-ort">${kopfLink}</div>`;
    }).join('')}<p class="info" style="margin:6px 0 0">Ein Tipp auf einen Namen öffnet direkt die Webseite (am 08.11.2026 geprüft: Seite erreichbar, Qualität der Angebote nicht). Ein Tipp auf das Symbol oder den Titel einer Kategorie öffnet eine Google-Suche.</p></div>
  <div class="karte"><p class="titel">Nach Land</p>
    <p class="info" style="margin:0 0 8px">Überblick für ganz Europa: <a class="u-chip" href="https://www.promobil.de/tipp/stellplaetze-europa-regeln-fuer-wohnmobile/" target="_blank" rel="noopener">Stellplatz-Regeln im EU-Ausland<em>promobil</em></a></p>
    ${LAENDER.map(([f, l, t, sz]) => `<details class="u-det u-lnd${VERBOT_LAND.has(l) ? ' verbot' : ''}"><summary><span class="u-flag">${f}</span><span class="u-lt"><strong>${h(l)}</strong><em>${h(t)}</em></span></summary>
      <ul class="info" style="padding-left:18px;margin:4px 0 8px">${sz.map((x) => `<li style="margin-bottom:4px">${h(x)}</li>`).join('')}</ul>
      <div class="u-gt">Campingplätze und Verbände</div><div class="u-chips">${(LAND_LINKS[l] || []).map(chip).join('')}</div>
      <div class="u-gt">Regeln und Maut</div><div class="u-chips"><a class="u-chip" href="${suchL(l + ' Wohnmobil übernachten Regeln')}" target="_blank" rel="noopener">Regeln suchen</a><a class="u-chip" href="${suchL(l + ' Maut Wohnmobil')}" target="_blank" rel="noopener">Maut suchen</a></div></details>`).join('')}
    <p class="info">Stand 08.11.2026 (Slowakei, Bulgarien, Zypern, Malta: 11.11.2026). Quellen: Reiseportale, Automobilclubs und Berichte, keine amtlichen Stellen. Die Angaben ändern sich und widersprechen sich teils. Rot = Wildcampen oder Freistehen verboten. Vor der Reise prüfen. Der Vertrag (Ziffer 9) bestimmt, wohin wir dürfen.</p></div>
  <p class="info" style="text-align:center;margin:4px 20px 0">Angebote, Preise und Regeln ändern sich. Vor der Reise prüfen. Die Liste ist eine Auswahl, keine Zusicherung.</p>`);
  bindRahmen();
}
const VERTRAG_REGELN = [
  ['Nutzung (Ziffer 7)', ['Gezählt wird in Tagen pro Kalenderjahr. Jeder angebrochene Tag zählt voll, Abreise- und Rückkehrtag beide.', 'Wer im Fahrzeug sitzt, zählt, auch wer nur mitreist. Sitzen Vater oder Mutter mit Tochter oder Sohn im Fahrzeug, zählen die Tage nur für Vater und Mutter.', 'Ungenutzte Tage verfallen am Jahresende, kein Übertrag.', 'Im Dezember werden die Ferienwochen des Folgejahres besprochen. Wochenenden können kurzfristig über die App reserviert werden.', 'Übernahme und Rückgabe immer zu Hause in Chur.', 'Das Fahrzeug wird nicht verliehen oder vermietet.']],
  ['Alltagsfahrten der Eltern (Ziffer 7 b)', ['Vater und Mutter dürfen das Fahrzeug auch privat im Alltag nutzen. Alltagsfahrten müssen nicht reserviert werden.', 'Jeder Tag mit mindestens einer Alltagsfahrt zählt als ein Tag im gemeinsamen Konto von Vater und Mutter. Mehrere Fahrten am selben Tag zählen einen Tag.', 'Reisetage und Alltagstage zusammen betragen für Vater und Mutter höchstens 181 Tage pro Kalenderjahr.', 'Datum und gefahrene Kilometer jeder Alltagsfahrt werden in der App eingetragen.', 'Reisen gehen Alltagsfahrten immer vor, Reisen der Eltern wie der Kinder. An reservierten Tagen gibt es keine Alltagsfahrt.']],
  ['Wer fährt (Ziffer 8)', ['Grundsätzlich fahren nur die Eigentümer/innen. Partner, Freunde und Enkel reisen mit, fahren aber nicht. Insgesamt reisen höchstens 4 Personen.', 'Der Familienrat (alle vier Eigentümer/innen) kann vor der Reise im Einzelfall eine Person zum Fahren freigeben, wenn Versicherung, Führerausweis, Fahrerfahrung und Haftung geklärt sind.', 'Bei jeder Fahrt reist mindestens ein/e Eigentümer/in mit, auch bei freigegebenen Fahrern.']],
  ['Bussen (Ziffer 12)', ['Bussen und Strafen trägt der/die fahrende Eigentümer/in.']],,
  ['Reiseregeln (Ziffer 9)', ['Erlaubt: Schweiz, Westeuropa, Nordeuropa, Tschechien, Polen, Baltikum, Ungarn, Slowenien bis Griechenland mit Kroatien, Bosnien-Herzegowina, Montenegro, Albanien, Nordmazedonien, Slowakei, Bulgarien, Irland, Grossbritannien, Zypern, Malta.', 'Verboten: andere Kontinente, Serbien, Türkei, Rumänien und ex-russische Staaten ausser dem Baltikum. Streng verboten: Russland, Ukraine, Weissrussland und Moldau.', 'Auf Autobahnraststätten wird aus Sicherheitsgründen nicht übernachtet. Mögliche Plätze zeigt «Unterwegs».', 'Winter: Im Winter wird nur Richtung Süden mit sehr tiefer Schneewahrscheinlichkeit gefahren. Das Fahrzeug hat weder Allrad noch ist es speziell winterfest.', 'Rauchen und Tiere im Fahrzeug sind verboten.']],
  ['Sauberkeit und Übernahme (Ziffer 10)', ['Das Fahrzeug soll immer sauber übernommen werden können. Wer es zuvor gefahren hat, reinigt es und gibt es sauber zurück.', 'Das Fahrzeug wird IMMER mit vollem Tank zurückgegeben. Wer es zuletzt gefahren hat, tankt es vor der Rückgabe voll und trägt den Tankstand in die Checkliste ein.', 'Bei jeder Übernahme und Rückgabe wird die Checkliste in der App (Fahrten) ausgefüllt.']],
  ['Übernahme-Checkliste (Fahrten)', ['Bei jeder Übernahme und Rückgabe in Chur ausfüllen. Jeder Eintrag mit Ja oder Nein, Mängel in der Bemerkung.', 'Tankstand: bei der Rückgabe immer voll.', 'Weitere Punkte: Kilometerstand, Innenraum und Aussen sauber, Kühlschrank geleert und geputzt, Frischwasser- und Abwassertank geleert, Gasflasche und Gasanlage, Toilette geleert, Wohnraumbatterie, Aufstelldach, Markise, Veloträger und Anhängerkupplung, Reifen, Unterlagen, Zubehör, neue Schäden.']],
];
function vertrag() {
  app.innerHTML = rahmen(`${seitenkopf('Vertrag')}
    <p class="info" style="margin:0 6px 14px">Kurzfassung des Miteigentumsvertrags. Bei Widerspruch gilt der Vertrag.</p>
    ${VERTRAG_REGELN.map(([t, l]) => `<details class="sek"><summary><span>${t}</span></summary><div class="sek-in"><ul class="info" style="padding-left:18px;margin:0">${l.map((x) => `<li style="margin-bottom:6px">${x}</li>`).join('')}</ul></div></details>`).join('')}
    <details class="sek"><summary><span>Datensicherung</span><b>jeden Sonntag</b></summary><div class="sek-in">
      <p class="info" style="margin:0 0 8px">Alle Reservierungen, Übernahmen, Kosten, Einzahlungen und Termine werden automatisch gesichert: <strong>jeden Sonntag um 20 Uhr</strong>.</p>
      <p class="info" style="margin:0 0 8px"><strong>Wo:</strong> auf dem Mac von HP, im Benutzerordner (Home) im Ordner <strong>Womo-Sicherung</strong>, darin der Ordner <strong>Sicherungen</strong>. Jede Sicherung ist eine Datei «womo-sicherung-Datum_Uhrzeit.json». Die PINs sind nicht enthalten.</p>
      <p class="info" style="margin:0">Der Mac muss am Sonntag eingeschaltet sein. Ist er aus, wird die Sicherung beim nächsten Einschalten nachgeholt. Sicherungen werden zwei Jahre aufbewahrt.</p></div></details>`);
  bindRahmen();
}
function rahmen(inhalt) {
  const nz = neuZ().nach;
  return `<div class="kopf"><div class="marke"><span class="keil"></span>PÖSSL</div>
    <button class="chip" id="aus" title="Person wechseln">${avatar(ich)}${h(D.personen[ich].name)}</button></div>
  <main>${inhalt}</main>
  <nav class="tabs">${TABS.map(([k, n]) => `<button data-t="${k}" class="${k === tab ? 'aktiv' : ''}"><svg viewBox="0 0 24 24">${ICON[k]}</svg>${n}${nz[k] ? `<i class="tb" aria-label="${nz[k]} neu">${nz[k]}</i>` : ''}</button>`).join('')}</nav>`;
}
// Anzeige «Neu seit deinem letzten Besuch» (oben im Kalender)
function neuKarte() {
  const r = neuZ();
  if (!r.gesamt) return '';
  const teile = Object.entries(r.nach).filter(([, n]) => n > 0);
  return `<div class="neu-karte"><div class="neu-kopf"><span class="neu-zahl">${r.gesamt}</span><strong>Neu seit deinem letzten Besuch</strong><button class="neu-ok" id="neugesehen">Gesehen</button></div>
    <div class="neu-chips">${teile.map(([k, n]) => `<button class="neu-chip" data-neu="${k}">${NEU_BEREICHE[k]} <b>${n}</b></button>`).join('')}</div></div>`;
}
function bindNeu() {
  const g = document.getElementById('neugesehen');
  if (g) g.onclick = () => { besuchMerken(); seitLesen(); zeige(); };
  app.querySelectorAll('[data-neu]').forEach((b) => b.onclick = () => { tab = b.dataset.neu; schliessen(); zeige(); window.scrollTo(0, 0); });
}
function bindRahmen() {
  document.getElementById('aus').onclick = (e) => { e.preventDefault(); besuchMerken(); ich = null; seit = ''; try { sessionStorage.removeItem('womo-ich'); } catch {} zeige(); };
  app.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.t; schliessen(); zeige(); window.scrollTo(0, 0); });
}

// Hinweise oben im Kalender: Zahlungsverzug, faellige Termine
const fzText = (f) => f.rueckstand ? `überfällig CHF ${chf(f.rueckstand.betrag)} seit ${fmt(f.rueckstand.seit)}` : f.naechste ? `nächste CHF ${chf(f.naechste.betrag)} am ${fmt(f.naechste.datum)}` : 'nichts mehr offen';
function hinweiseHtml() {
  const t = heute(); let out = '';
  const to = tankOffen(Object.values(D.uebergaben), tankFuellungen());
  if (to) out += `<div class="hinweiskarte rot">⛽ Tank nicht voll: ${h(to.tank)}, zuletzt erfasst am ${fmt(to.datumZeit.slice(0, 10))} von ${h(D.personen[to.erfasstVon]?.name || '?')}. Der Vertrag verlangt immer einen vollen Tank.<div class="btnzeile"><button class="btn" id="tankvoll">Jetzt voll getankt</button><a class="btn" href="${waLink(tankText(to.tank, to.datumZeit, D.personen[to.erfasstVon]?.name || '?'))}" target="_blank" rel="noopener" style="text-decoration:none">Familie per WhatsApp warnen</a></div></div>`;
  const sp = zahlungsSperre(D.zahlstatus[ich], t);
  if (sp.stufe === 'gesperrt') out += `<div class="hinweiskarte rot">Nutzungsverbot wegen Zahlungsverzug seit ${fmt(sp.ab)}, bis die Zahlung erfolgt ist (Vertrag Ziffer 4).</div>`;
  else if (sp.stufe === 'erinnert') out += `<div class="hinweiskarte gelb">Zahlungserinnerung: Bitte bis ${fmt(sp.frist)} zahlen, sonst gilt ein Nutzungsverbot.</div>`;
  if (D.start && D.personen[ich]) faelligkeiten(D.start, t, zahlungenAusJournal(D.journal, D.personen), D.personen[ich], ich).forEach((f) => {
    if (f.rueckstand) out += `<div class="hinweiskarte rot">${ZWECKE[f.zweck]} überfällig: CHF ${chf(f.rueckstand.betrag)} seit ${fmt(f.rueckstand.seit)}.</div>`;
    else if (f.naechste && f.naechste.datum <= addTage(t, VORLAUF_TAGE)) out += `<div class="hinweiskarte gelb">${ZWECKE[f.zweck]} fällig am ${fmt(f.naechste.datum)}: CHF ${chf(f.naechste.betrag)}.</div>`;
  });
  termineEcht().filter((x) => ['ueberfaellig', 'bald'].includes(terminStufe(x, t))).sort((a, b) => (a.faelligAm < b.faelligAm ? -1 : 1)).slice(0, 3).forEach((x) => {
    const u = terminStufe(x, t) === 'ueberfaellig';
    out += `<div class="hinweiskarte ${u ? 'rot' : 'gelb'}">${h(x.titel)}: ${u ? 'überfällig seit' : 'fällig am'} ${fmt(x.faelligAm)}</div>`;
  });
  // Wunschliste: was auf dich wartet (ein Tipp öffnet den Tab)
  wunschListe().forEach((w) => {
    const st = wunschStandVon(w), titel = `«${h(w.titel)}» (${wunschPreisText(w)})`;
    const karte = (kl, text) => { out += `<div class="hinweiskarte ${kl}" data-neu="wunschliste" style="cursor:pointer">⭐ Wunschliste: ${text}</div>`; };
    if (st.status === 'offen' && w.erfasstVon !== ich && !st.antworten[ich]) karte('gelb', `${titel} wartet auf deine Antwort bis ${fmt(st.frist)}.`);
    else if (st.status === 'freigegeben' && w.erfasstVon === ich) karte('ok', `${titel} ist freigegeben, du kannst kaufen.`);
    else if (st.status === 'gekauft' && ich === D.adminId && !st.erstattet) karte('gelb', `${titel}: CHF ${chf(w.gekauftBetrag)} an ${h(D.personen[w.erfasstVon]?.name || '?')} erstatten.`);
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
      d === tT ? 'heute' : ''].join(' ');
    zellen += `<div class="${cls}" data-d="${d}"><span class="nr">${t}</span>${terminTag[d] ? `<span class="tm ${['erledigt', 'offen', 'bald', 'ueberfaellig'][Math.max(...terminTag[d].map((x) => RANG[terminStufe(x, tT)]))]}" title="${h(terminTag[d].map((x) => x.titel).join(', '))}"></span>` : ''}${hier.length ? `<span class="streifen">${hier.map((b) => `<i class="${farbKonto(b)}">${initial(D.personen[b.fahrerId]?.name || b.ausnahmeFahrer?.name)}</i>`).join('')}</span>` : ''}</div>`;
  }
  const monatsB = bs.filter((b) => b.von <= iso(J, M, n) && b.bis >= iso(J, M, 1)).sort((a, b) => a.von < b.von ? -1 : 1);
  const kolls = monatsB.filter((a, i) => monatsB.some((b, j) => i !== j && kollision(a, b)));
  const monatsT = termineEcht().filter((x) => x.faelligAm >= iso(J, M, 1) && x.faelligAm <= iso(J, M, n)).sort((a, b) => (a.faelligAm < b.faelligAm ? -1 : 1));
  const TCHIP = { ueberfaellig: ['rot', 'überfällig'], bald: ['gelb', 'bald fällig'], offen: ['', 'offen'], erledigt: ['ok', 'erledigt'] };
  app.innerHTML = rahmen(`${seitenkopf('Kalender', 'resneu', '＋ Reservieren')}${neuKarte()}${hinweiseHtml()}${ringe(J)}
  <div class="karte">
    <div class="monatskopf"><h2>${MONATE[M]} ${J}</h2><div class="nav"><button id="zu" aria-label="Voriger Monat">‹</button><button id="hj" class="heute-b">Heute</button><button id="vor" aria-label="Nächster Monat">›</button></div></div>
    <div class="woche">${['Mo','Di','Mi','Do','Fr','Sa','So'].map((x) => `<div>${x}</div>`).join('')}</div>
    <div class="monat">${zellen}</div>
    <div class="legende">${[['hp', 'HP'], ['nora', 'Nora'], ['kind-1', 'Nanouk'], ['kind-2', 'Nene']].map(([k, n]) => `<span><i class="punkt ${k}"></i>${n}</span>`).join('')}</div>
    ${kolls.length ? `<div class="warn">Überschneidung im ${MONATE[M]}. Bitte im Gespräch lösen.</div>` : ''}
  </div>
  <div class="karte"><p class="titel">Reservierungen im ${MONATE[M]}</p>${monatsB.length ? monatsB.map(buchungHtml).join('') : '<p class="leer-t">Keine Reservierungen.</p>'}</div>
  <div class="karte"><p class="titel">Termine im ${MONATE[M]}</p>${monatsT.length ? monatsT.map((x) => { const [c, txt] = TCHIP[terminStufe(x, tT)]; return `<div class="b" style="padding:8px 0"><span class="tm ${c || 'offen'}" style="position:static;flex:none;margin-top:6px"></span><div class="inhalt"><div class="zeit" style="font-size:15px">${h(x.titel)}${neuPille(x)}</div><div class="meta">${fmt(x.faelligAm)} · <span class="chipk ${c}">${txt}</span></div></div></div>`; }).join('') : '<p class="leer-t">Keine Termine.</p>'}</div>`);
  bindRahmen(); bindNeu();
  const tv = document.getElementById('tankvoll'); if (tv) tv.onclick = async () => { if (confirm('Der Tank ist jetzt voll?')) await sicher(async () => { await S.speichern(D, 'termine', null, { art: 'Tank', titel: 'Tank gefüllt', faelligAm: heute(), datumZeit: jetztLokal(), erledigtAm: heute(), erfasstVon: ich }); kalender(); hinweis('Danke, Tank als voll gemeldet.'); }); };
  document.getElementById('zu').onclick = () => { ansicht = new Date(J, M - 1, 1); kalender(); };
  document.getElementById('vor').onclick = () => { ansicht = new Date(J, M + 1, 1); kalender(); };
  document.getElementById('hj').onclick = () => { ansicht = new Date(); kalender(); };
  document.getElementById('resneu').onclick = () => formularZeigen('');
  app.querySelectorAll('.tag[data-d]').forEach((el) => el.onclick = () => formularZeigen(el.dataset.d));
  app.querySelectorAll('[data-edit]').forEach((el) => el.onclick = () => { const x = D.buchungen[el.dataset.edit]; if (!eigener(x)) return nurEigene(); formularZeigen('', x); });
  app.querySelectorAll('[data-del]').forEach((el) => el.onclick = async () => {
    if (!eigener(D.buchungen[el.dataset.del])) return nurEigene();
    const ue = ['ab', 'rueck'].filter((ph) => D.uebergaben[el.dataset.del + '_' + ph]).length;
    if (confirm(ue ? 'Reservierung löschen? Die erfasste Übernahme/Rückgabe (Checkliste, Kilometer) wird ebenfalls gelöscht.' : 'Reservierung löschen?')) { await sicher(async () => { await S.buchungLoeschen(D, el.dataset.del); kalender(); }); }
  });
}

function buchungHtml(b) {
  const wer = D.personen[b.fahrerId]?.name || b.ausnahmeFahrer?.name || '?';
  const mit = (b.mitreisende || []).map((i) => D.personen[i]?.name).filter(Boolean);
  const darf = eigener(b);
  const zaehlt = konten(b, D.personen).map((k) => KONTO_NAME[k]).join(' und ');
  const av = b.fahrerId ? avatar(b.fahrerId) : `<span class="av" style="background:var(--muted)">${initial(wer)}</span>`;
  return `<div class="b">${av}<div class="inhalt">
    <div class="zeit">${fmt(b.von).slice(0, 6)} – ${fmt(b.bis)}${neuPille(b)}</div>
    <div class="meta"><span class="tagetxt">${dauer(b)} Tage</span> · ${h(wer)}${mit.length ? ' mit ' + h(mit.join(', ')) : ''}${b.gaeste ? ` · ${b.gaeste} Gast/Gäste` : ''}${b.ziel ? ' · ' + h(b.ziel) : ''}</div>
    <div class="meta">Zählt für ${h(zaehlt)} · erfasst von ${h(D.personen[b.erfasstVon]?.name || '?')}</div></div>
    ${darf ? `<div style="display:flex;flex-direction:column;gap:10px;align-self:flex-start"><button class="kl" style="color:var(--acc)" data-edit="${h(b.id)}">Ändern</button><button class="kl" data-del="${h(b.id)}">Löschen</button></div>` : ''}</div>`;
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
  <div id="ausn" class="${aus ? '' : 'versteckt'}"><label for="an">Name des Fahrers</label><input id="an" value="${h(aus?.name || '')}"><label for="af">Freigabe Familienrat am</label><input type="date" id="af" value="${h(aus?.freigabeAm || '')}"><label for="av">Verantwortliche/r Eigentümer/in</label><select id="av">${ids.map((i) => `<option value="${i}"${i === aus?.verantwortlichId ? ' selected' : ''}>${h(D.personen[i].name)}</option>`).join('')}</select></div>
  <label>Mitreisende Eigentümer/innen</label><div class="mitw" id="mit">${ids.map((i) => `<span class="chk"><input type="checkbox" value="${i}" id="m${i}"${ex?.mitreisende?.includes(i) ? ' checked' : ''}><label for="m${i}">${h(D.personen[i].name)}</label></span>`).join('')}</div>
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
    if (b.bis < heute() && !(ex && ex.von === b.von && ex.bis === b.bis) && !confirm('Diese Reservierung liegt in der Vergangenheit. Das verändert die Tageskonten rückwirkend. Trotzdem speichern?')) return;
    const vs = vorschauBuchung(b, D.buchungen, D.personen, alltagMap());
    const warn = [...vs.ueber.map((u) => `${KONTO_NAME[u.konto]} ${u.jahr}: ${u.tage} Tage, Schwelle ${u.schwelle}.`), ...(vs.entfallen.length ? [`Alltagsfahrten am ${vs.entfallen.map(fmt).join(', ')} zählen nicht mehr (Reisen gehen vor).`] : [])];
    if (warn.length && !confirm('Achtung:\n' + warn.join('\n') + '\nTrotzdem speichern?')) return;
    await sicher(async () => {
      await S.buchungSpeichern(D, b);
      ansicht = new Date(b.von + 'T12:00:00');
      schliessen(); kalender();
      hinweis(ex ? 'Reservierung geändert.' : 'Reservierung gespeichert.');
    });
  };
}

// =====================================================================
// Fahrten: Uebergabe-Checkliste und Kilometerstand (Version 2)
// =====================================================================
const FAHRT_ICON = '<path d="M3 17V8a2 2 0 0 1 2-2h9l5 5v6M3 17h2M9 17h6M19 17h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>';
const KOSTEN_ICON = '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6v2M12 16v2"/>';
function reiseText(b, kurz) {
  const [j1, m1, d1] = b.von.split('-').map(Number), [j2, m2, d2] = b.bis.split('-').map(Number);
  const mo = (m) => kurz ? MONATE[m - 1].slice(0, 3) + '.' : MONATE[m - 1], jahr = j2 === new Date().getFullYear() ? '' : ' ' + j2;
  if (b.von === b.bis) return `${d1}. ${mo(m1)}${jahr}`;
  return m1 === m2 && j1 === j2 ? `${d1}.–${d2}. ${mo(m2)}${jahr}` : `${d1}. ${mo(m1).slice(0, 3)} – ${d2}. ${mo(m2).slice(0, 3)}${jahr}`;
}
function fahrtInfo(b, st) {
  const ab = D.uebergaben[b.id + '_ab'], rk = D.uebergaben[b.id + '_rueck'];
  const wer = D.personen[b.fahrerId]?.name || b.ausnahmeFahrer?.name || '?';
  const maengel = [ab, rk].some((u) => u && (CHECKPUNKTE.some(([k]) => u.punkte?.[k] === 'nein') || (u.schaeden || '').trim()));
  return { ab, rk, wer, maengel, km: st.proBuchung[b.id], fertigR: rueckgabeFertig(rk), schlOffen: !!rk && !rueckgabeFertig(rk), tankNV: tankWarnung(ab) || tankWarnung(rk) };
}
function fahrtChips(f) {
  return `${f.km !== undefined ? `<span class="chipk">${zahl(f.km)} km gefahren</span>` : ''}${f.maengel ? '<span class="chipk rot">Mängel gemeldet</span>' : ''}${f.schlOffen ? '<span class="chipk gelb">Schlüssel noch nicht quittiert</span>' : ''}${f.tankNV ? '<span class="chipk rot">Tank nicht voll</span>' : ''}`;
}
function fahrten() {
  const J = new Date().getFullYear(), t = heute();
  const st = kmStatistik(Object.values(D.uebergaben), D.buchungen, J);
  const alle = liste().sort((a, b) => (a.von < b.von ? -1 : a.von > b.von ? 1 : 0));
  const kommend = alle.filter((b) => b.bis >= t), vorbei = alle.filter((b) => b.bis < t).reverse().slice(0, 40);
  const elternIch = D.personen[ich]?.konto === 'eltern';
  const nr = (iso) => { const [j, m, d] = iso.split('-').map(Number); return Date.UTC(j, m - 1, d) / 86400000; };
  const knopf = (f, b, id, text, pri) => `<button class="btn${f ? ' ok' : pri ? ' gelb' : ''}" data-u="${h(b.id)}|${id}">${f ? '✓ ' : ''}${text}</button>`;
  const n = kommend[0];
  let karte = `<div class="f-next"><span class="t-lab">Nächste Reise</span><span class="f-nt">Keine Reise geplant</span><span class="t-nd">Reservierungen machst du im Tab «Kalender».</span></div>`;
  if (n) {
    const f = fahrtInfo(n, st), laeuft = n.von <= t;
    karte = `<div class="f-next"><span class="t-lab">${laeuft ? 'Laufende Reise' : 'Nächste Reise'}</span><span class="f-nt">${reiseText(n)}</span>
      <span class="t-nd">${h(f.wer)}${n.ziel ? ' · ' + h(n.ziel) : ''}</span>
      <span class="t-pille ${laeuft ? 'gelb' : 'blau'}">${laeuft ? 'unterwegs' : `in ${nr(n.von) - nr(t)} ${nr(n.von) - nr(t) === 1 ? 'Tag' : 'Tagen'}`}</span>
      ${fahrtChips(f) ? `<span class="f-chips">${fahrtChips(f)}</span>` : ''}
      <div class="btnzeile zk" style="margin:14px 0 0">${knopf(!!f.ab, n, 'ab', `Übernahme ${f.ab ? 'ansehen' : 'erfassen'}`)}${knopf(f.fertigR, n, 'rueck', `Rückgabe ${f.rk ? 'ansehen' : 'erfassen'}`, f.schlOffen)}</div></div>`;
  }
  const pilleFuer = (b) => {
    const f = fahrtInfo(b, st);
    if (b.bis < t) return f.fertigR ? ['ok', '✓ fertig'] : f.ab ? ['gelb', 'Rückgabe offen'] : ['rot', 'ohne Checkliste'];
    const d = nr(b.von) - nr(t); return ['blau', d <= 0 ? 'unterwegs' : `in ${d} ${d === 1 ? 'Tag' : 'Tagen'}`];
  };
  const zeile = (b) => { const f = fahrtInfo(b, st), [k, txt] = pilleFuer(b); return `<button class="t-z ${k}" data-reise="${h(b.id)}"><span class="t-sq blau"><svg viewBox="0 0 24 24" aria-hidden="true">${FAHRT_ICON}</svg></span><span class="t-zt"><strong>${reiseText(b, true)}${neuPille(b)}${neuPille(f.ab)}${neuPille(f.rk)}</strong><small>${h(f.wer)}${b.ziel ? ' · ' + h(b.ziel) : ''}</small></span><span class="t-pl ${k}">${txt}</span></button>`; };
  app.innerHTML = rahmen(`${seitenkopf('Fahrten', elternIch ? 'aneu' : null, '＋ Alltagsfahrt')}
  <div class="u-ban slim"><span class="u-bic">${SVG('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>')}</span><div><strong>Rauchen und Tiere sind verboten</strong></div></div>
  ${karte}
  ${kommend.length > 1 ? `<p class="t-lab2">Weitere Reisen</p>${kommend.slice(1).map(zeile).join('')}` : ''}
  <div class="karte km-karte" style="margin-top:14px"><div><p class="titel" style="margin:0 0 4px">Kilometerstand</p>
    <p class="info" style="margin:0">${st.stand ? `Gefahren ${J}: ${zahl(st.jahr)} km` : 'Noch kein Stand erfasst.'}</p></div>
    <p class="grosszahl">${st.stand ? zahl(st.stand) : '–'} <small>km</small></p></div>
  ${alltagSek(J)}
  ${vorbei.length ? `<details class="sek"><summary><span>Vergangene Reisen</span><b>${vorbei.length}</b></summary><div class="sek-in">${vorbei.map(zeile).join('')}</div></details>` : ''}
  <p class="info" style="margin:14px 6px 0">Übernahme und Rückgabe finden zu Hause in Chur statt, mit der Checkliste.</p>`);
  bindRahmen();
  app.querySelectorAll('[data-u]').forEach((el) => el.onclick = () => { const [bid, phase] = el.dataset.u.split('|'); uebergabeForm(bid, phase); });
  const an = document.getElementById('aneu'); if (an) an.onclick = () => alltagForm();
  app.querySelectorAll('[data-ad]').forEach((b) => b.onclick = async () => { const x = D.termine[b.dataset.ad]; if (!eigener(x)) return nurEigene(); if (confirm('Alltagsfahrt löschen?')) await sicher(async () => { await S.loeschen(D, 'termine', x.id); fahrten(); }); });
  app.querySelectorAll('[data-reise]').forEach((el) => el.onclick = () => {
    const b = D.buchungen[el.dataset.reise]; if (!b) return; const f = fahrtInfo(b, st);
    sheet(`<div class="t-sk"><span class="t-sq blau gross"><svg viewBox="0 0 24 24" aria-hidden="true">${FAHRT_ICON}</svg></span><div><h3 style="margin:0">${reiseText(b)}</h3><div class="info" style="margin:2px 0 0">${h(f.wer)}${b.ziel ? ' · ' + h(b.ziel) : ''}</div></div></div>
      ${fahrtChips(f) ? `<p class="f-chips" style="margin:6px 0 0">${fahrtChips(f)}</p>` : ''}
      <div class="t-akt2"><button class="gross-btn pri" id="f_ab">Übernahme ${f.ab ? 'ansehen' : 'erfassen'}</button><button class="gross-btn" id="f_rk">Rückgabe ${f.rk ? 'ansehen' : 'erfassen'}</button><button class="gross-btn" id="abb">Schliessen</button></div>`);
    document.getElementById('abb').onclick = schliessen;
    document.getElementById('f_ab').onclick = () => uebergabeForm(b.id, 'ab');
    document.getElementById('f_rk').onclick = () => uebergabeForm(b.id, 'rueck');
  });
}

// Alltagsfahrten der Eltern: ohne Reservierung, zaehlen mit Ferienreisen zusammen auf das Konto der Eltern (181 Tage).
function alltagSek(J) {
  const st = kontostaendeMitAlltag(liste(), D.personen, J, alltagMap(), D.buchungen);
  const L = Object.values(alltagMap()).sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : (a.erfasstAm || '') < (b.erfasstAm || '') ? 1 : -1)).slice(0, 15);
  const rot = st.eltern > SCHWELLE.eltern;
  return `<details class="sek"><summary><span>Alltagsfahrten der Eltern</span><b>${st.eltern} / ${SCHWELLE.eltern}</b></summary><div class="sek-in">
    <p class="info" style="margin:0 0 6px">${st.eltern - st.alltag} ${st.eltern - st.alltag === 1 ? 'Tag' : 'Tage'} Ferienreisen + ${st.alltag} ${st.alltag === 1 ? 'Tag' : 'Tage'} Alltag. Alltag ${J}: ${zahl(alltagKm(alltagMap(), J))} km.</p>
    ${rot ? `<div class="hinweiskarte rot">Die Eltern haben mehr als ${SCHWELLE.eltern} Tage erreicht (Ferien und Alltag zusammen).</div>` : ''}
    <p class="info" style="margin:0 0 8px">Alltagsfahrten brauchen keine Reservierung. Ein Tag zählt einmal, egal wie viele Fahrten. Ferienreisen gehen immer vor. Vor einer Ferienreise der Kinder sind die Eltern dafür verantwortlich, dass der Tank voll ist.</p>
    ${L.length ? L.map((a) => `<div class="b" style="padding:8px 0"><div class="inhalt"><div class="zeit" style="font-size:15px">${fmt(a.datum)} · ${zahl(a.km)} km${neuPille(a)}</div><div class="meta">${h(D.personen[a.personId]?.name || '?')}${a.notiz ? ' · ' + h(a.notiz) : ''}</div></div>${eigener(a) ? `<button class="kl" data-ad="${h(a.id)}">Löschen</button>` : ''}</div>`).join('') : '<p class="leer-t">Noch keine Alltagsfahrten.</p>'}</div></details>`;
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
    const a = { datum: val('a_datum'), personId: val('a_wer'), km: kmZahl(val('a_km')), notiz: val('a_notiz').trim(), erfasstVon: ich };
    const p = pruefeAlltag(a, D.buchungen, D.personen);
    const fe = [...p.fehler];
    if (Number.isNaN(a.km)) fe.push('Kilometer nur als ganze Zahl eingeben, ohne Punkt und Komma.');
    if (zahlungsSperre(D.zahlstatus[ich], heute()).stufe === 'gesperrt') fe.push('Du hast ein Nutzungsverbot wegen Zahlungsverzug (Vertrag Ziffer 4).');
    if (fe.length) { fehler([...new Set(fe)]); return; }
    await sicher(async () => { await S.speichern(D, 'termine', null, { ...a, art: 'Alltag', titel: 'Alltagsfahrt', faelligAm: a.datum, erledigtAm: '' }); schliessen(); fahrten(); hinweis('Alltagsfahrt gespeichert.'); });
  };
}

function uebergabeForm(bid, phase) {
  const b = D.buchungen[bid]; if (!b) return;
  const id = bid + '_' + phase, ex = D.uebergaben[id], ab = D.uebergaben[bid + '_ab'];
  const darf = !ex || eigener(ex);
  const lokal = jetztLokal();
  const dis = darf ? '' : 'disabled';
  const radio = (name, wert, text, cls, aktiv) => `<span class="chk ${cls}"><input type="radio" name="${name}" id="${name}_${wert}" value="${wert}" ${aktiv ? 'checked' : ''} ${dis}><label for="${name}_${wert}">${text}</label></span>`;
  sheet(`<h3>${phase === 'ab' ? 'Übernahme' : 'Rückgabe'}</h3>
  ${phase === 'ab' ? `<div class="u-ban slim"><span class="u-bic">${SVG('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>')}</span><div><strong>Rauchen und Tiere sind verboten</strong></div></div>` : ''}
  <p class="info" style="margin:0">${fmt(b.von)} – ${fmt(b.bis)} · ${h(D.personen[b.fahrerId]?.name || b.ausnahmeFahrer?.name || '?')}${ex ? ` · erfasst von ${h(D.personen[ex.erfasstVon]?.name || '?')}` : ''}</p>
  ${phase === 'rueck' && ab ? `<p class="info">Bei der Übernahme: ${zahl(ab.km)} km, Tank ${h(ab.tank)}.</p>` : ''}
  <label for="u_dt">Datum und Uhrzeit</label><input type="datetime-local" id="u_dt" value="${h(ex?.datumZeit || lokal)}" ${dis}>
  <label for="u_km">Kilometerstand</label><input id="u_km" inputmode="numeric" value="${ex ? ex.km : ''}" placeholder="z. B. 12450" ${dis}>
  <label>Tankstand (Vertrag: immer voll)</label>
  <div class="tank" id="tankg">${TANK.map((t, i) => `<span class="tk ${i <= 1 ? 'tr' : i <= 3 ? 'tg' : 'to'}${t === 'voll' ? ' tv' : ''}"><input type="radio" name="u_tank" id="u_tank_${i}" value="${i}" ${ex?.tank === t ? 'checked' : ''} ${dis}><label for="u_tank_${i}">${t}</label></span>`).join('')}</div>
  <div class="tankanz" id="tankanz"></div>
  <div id="tankw"></div>
  <label>Checkliste</label>
  ${darf && phase === 'ab' ? '<div class="btnzeile" style="margin:0 0 4px"><button class="btn" id="alleja" type="button">Alle auf Ja setzen</button></div>' : ''}
  <div>${CHECKPUNKTE.map(([k, text]) => `<div class="cp"><div class="pt">${h(text)}</div><div class="mitw">${radio('p_' + k, 'ja', 'Ja', 'ja', ex?.punkte?.[k] === 'ja')}${radio('p_' + k, 'nein', 'Nein', 'nein', ex?.punkte?.[k] === 'nein')}</div></div>`).join('')}</div>
  <label for="u_bem">Bemerkung (bei Nein: den Mangel beschreiben)</label><textarea id="u_bem" ${dis}>${h(ex?.bemerkung || '')}</textarea>
  <label for="u_sch">Neue Schäden oder Mängel</label><textarea id="u_sch" ${dis}>${h(ex?.schaeden || '')}</textarea>
  ${phase === 'rueck' ? `<label>Schlüssel (letzte Pflicht der Rückgabe)</label><p class="info" style="margin:0 0 6px">Der Schlüssel hängt am Schlüsselbrett der Eltern. Ohne Häkchen ist die Rückgabe nicht abgeschlossen.</p><div class="mitw"><span class="chk ja"><input type="checkbox" id="u_schl" ${ex?.schluessel === 'ja' ? 'checked' : ''} ${dis}><label for="u_schl">Schlüssel hängt am Schlüsselbrett der Eltern</label></span></div>${ex?.schluesselAm ? `<p class="info">Quittiert am ${fmt(ex.schluesselAm.slice(0, 10))}, ${ex.schluesselAm.slice(11, 16)} Uhr, von ${h(D.personen[ex.schluesselVon]?.name || '?')}.</p>` : ''}` : ''}
  <div id="msg"></div>
  <div class="aktion"><button id="abb">${darf ? 'Abbrechen' : 'Schliessen'}</button>${darf ? '<button class="primaer" id="spei">Speichern</button>' : ''}</div>`);
  document.getElementById('abb').onclick = schliessen;
  const gauge = () => {
    const el = formEl.querySelector('input[name="u_tank"]:checked'), i = el ? +el.value : -1, g = document.getElementById('tankg');
    const a = document.getElementById('tankanz'); a.textContent = i < 0 ? 'Bitte den Tankstand wählen.' : i === TANK.length - 1 ? 'Tank voll ✓' : `Tank: ${TANK[i]}, nicht voll`;
    a.className = 'tankanz' + (i < 0 ? '' : i === TANK.length - 1 ? ' ok' : i <= 1 ? ' rot' : ' gelb');
  };
  formEl.querySelectorAll('input[name="u_tank"]').forEach((i) => i.addEventListener('change', gauge)); gauge();
  if (!darf) return;
  const eltRei = !(b.fahrerId && D.personen[b.fahrerId]?.konto === 'eltern') && !(b.mitreisende || []).some((i) => D.personen[i]?.konto === 'eltern');
  const tw = () => { const el = formEl.querySelector('input[name="u_tank"]:checked'); document.getElementById('tankw').innerHTML = el && TANK[+el.value] !== 'voll' ? `<div class="hinweiskarte rot">Achtung: Der Tank ist nicht voll. Der Vertrag (Ziffer 10) verlangt immer einen vollen Tank. Speichern geht nur mit einer Bemerkung.${phase === 'ab' && eltRei ? ' Vor einer Ferienreise der Kinder sind die Eltern fürs Volltanken verantwortlich.' : ''}</div>` : ''; };
  formEl.querySelectorAll('input[name="u_tank"]').forEach((i) => i.onchange = tw); tw();
  if (phase === 'ab') document.getElementById('alleja').onclick = () => CHECKPUNKTE.forEach(([k]) => { document.getElementById(`p_${k}_ja`).checked = true; });
  document.getElementById('spei').onclick = async () => {
    const punkte = {}; for (const [k] of CHECKPUNKTE) { const el = formEl.querySelector(`input[name="p_${k}"]:checked`); if (el) punkte[k] = el.value; }
    const tankEl = formEl.querySelector('input[name="u_tank"]:checked');
    const u = { buchungId: bid, phase, datumZeit: val('u_dt'), km: kmZahl(val('u_km')), tank: tankEl ? TANK[+tankEl.value] : '',
      punkte, bemerkung: val('u_bem').trim(), schaeden: val('u_sch').trim(), erfasstVon: ex?.erfasstVon || ich };
    if (phase === 'rueck') {
      u.schluessel = document.getElementById('u_schl').checked ? 'ja' : '';
      if (u.schluessel === 'ja') { u.schluesselAm = ex?.schluessel === 'ja' && ex.schluesselAm ? ex.schluesselAm : lokal; u.schluesselVon = ex?.schluessel === 'ja' && ex.schluesselVon ? ex.schluesselVon : ich; }
    }
    const p = pruefeUebergabe(u, Object.values(D.uebergaben), D.buchungen);
    const fe = [...p.fehler];
    if (Number.isNaN(u.km)) fe.unshift('Kilometerstand nur als ganze Zahl eingeben, ohne Punkt und Komma.');
    if (!ex && zahlungsSperre(D.zahlstatus[ich], heute()).stufe === 'gesperrt') fe.push('Du hast ein Nutzungsverbot wegen Zahlungsverzug (Vertrag Ziffer 4).');
    if (fe.length) { fehler([...new Set(fe)]); return; }
    const letzter = Math.max(0, ...Object.values(D.uebergaben).filter((x) => D.buchungen[x.buchungId] && x.km <= u.km).map((x) => x.km));
    if (u.km - letzter > 3000 && !confirm(`Der Stand ${zahl(u.km)} km liegt ${zahl(u.km - letzter)} km über dem letzten Stand (${zahl(letzter)} km). Stimmt das?`)) return;
    await sicher(async () => {
      await S.speichern(D, 'uebergaben', id, { ...u, erfasstAm: ex?.erfasstAm }); schliessen(); fahrten(); hinweis(phase === 'ab' ? 'Übernahme gespeichert.' : 'Rückgabe abgeschlossen, Schlüssel quittiert.');
      if (tankWarnung(u)) sheet(`<h3>Tank nicht voll</h3><div class="hinweiskarte rot">Gespeichert. Der Tank ist nicht voll (${h(u.tank)}). Bitte die anderen warnen.</div><div class="aktion"><button id="abb">Schliessen</button><a class="primaer" style="text-decoration:none;text-align:center;display:block;padding:14px" href="${waLink(tankText(u.tank, u.datumZeit, D.personen[u.erfasstVon]?.name || '?'))}" target="_blank" rel="noopener">Familie per WhatsApp warnen</a></div>`), document.getElementById('abb').onclick = schliessen;
    });
  };
}

// =====================================================================
// Kosten und Zahlungsstatus (Version 3)
// =====================================================================
function kosten() {
  const J = jahrK, ids = idsGeordnet(), t = heute(), buch = buchhalter();
  const kl = Object.values(D.kosten), eAlt = Object.values(D.einzahlungen), el = zahlungenAusJournal(D.journal, D.personen);   // Zahlplan: nur aus den Buchungen
  const von = `${J}-01-01`, bis = `${J + 1}-01-01`;
  const name = (i) => h(D.personen[i]?.name || '?');

  const elternIds = ids.filter((i) => D.personen[i].konto === 'eltern'), kinderIds = ids.filter((i) => D.personen[i].konto !== 'eltern');

  let plan;
  if (!D.start) {
    plan = `<p class="info" style="margin-top:0">Das Übernahmedatum des Fahrzeugs fehlt. Ohne dieses Datum kann die App das Vertragsjahr und die Beträge für Rücklage und Darlehen nicht berechnen.</p>${ich === D.adminId ? startFeld('') : '<p class="info">HP trägt das Datum ein.</p>'}`;
  } else {
    const n = vertragsJahr(D.start, t);
    if (n === null) plan = `<p class="info" style="margin-top:0">Der Vertrag beginnt am ${fmt(D.start)}.</p>${ich === D.adminId ? startFeld(D.start) : ''}`;
    else if (n > 8) plan = `<p class="info" style="margin-top:0">Die 8 Vertragsjahre sind abgelaufen (Beginn ${fmt(D.start)}). Weiteres regelt Ziffer 14 des Vertrags.</p>`;
    else plan = `<p class="info" style="margin-top:0">Vertragsjahr <strong>${n} von 8</strong> · ${fmt(addJahre(D.start, n - 1))} bis ${fmt(addJahre(D.start, n))} (Beginn ${fmt(D.start)}).</p><div class="zeilen">` +
      ids.map((i) => {
        const zp = zahlplan(D.start, t, el, D.personen[i], i);
        return `<div class="z"><div class="l"><strong>${name(i)}</strong>${zp.posten.map((p) => `<div class="meta">${ZWECKE[p.zweck]}: Soll ${chf(p.soll)} · bezahlt ${chf(p.ist)}</div>`).join('')}</div><div class="r">${zp.posten.map((p) => `<div><span class="chipk ${p.offen > 0 ? 'gelb' : 'ok'}">${p.offen > 0 ? 'offen ' + chf(p.offen) : 'bezahlt'}</span></div>`).join('')}</div></div>`;
      }).join('') + `</div><p class="info">Soll laut Vertrag Ziffer 5 (Rücklage) und Anhang A (Darlehen, Rückzahlung je CHF 9 600).</p>${ich === D.adminId ? `<details class="det"><summary>Übernahmedatum ändern</summary>${startFeld(D.start)}</details>` : ''}`;
  }

  // ---- Offene Zahlungen (immer sichtbar) und Zahlungen der Kinder ueber 8 Jahre ----
  const plaene = Object.fromEntries(ids.map((i) => [i, D.start && D.personen[i] ? achtJahrePlan(D.start, t, el, D.personen[i], i) : null]));
  const offenKarte = !D.start
    ? `<div class="karte"><h3 style="margin:0 0 6px;font-size:17px">Offene Zahlungen</h3><p class="info" style="margin:0">Das Übernahmedatum des Fahrzeugs fehlt. Ohne dieses Datum kann die App nicht berechnen, welche Zahlungen wann fällig sind.</p>${ich === D.adminId ? startFeld('') : '<p class="info">HP trägt das Datum ein.</p>'}</div>`
    : (() => {
      const zeilen = ids.map((i) => {
        const fz = faelligkeiten(D.start, t, el, D.personen[i], i), pl = plaene[i];
        const ueber = fz.some((f) => f.rueckstand), bald = fz.some((f) => f.naechste && f.naechste.datum <= addTage(t, VORLAUF_TAGE));
        const chip = ueber ? `<span class="chipk rot">überfällig ${chf(pl.total.offenFaellig)}</span>` : bald ? '<span class="chipk gelb">bald fällig</span>' : '<span class="chipk ok">pünktlich</span>';
        return `<div class="z"><div class="l"><strong>${name(i)}</strong>${fz.map((f) => `<div class="meta">${ZWECKE[f.zweck]}: ${fzText(f)}</div>`).join('')}<div class="meta">Noch zu zahlen bis Vertragsende: CHF ${chf(pl.total.offen)}</div></div><div class="r">${chip}</div></div>`;
      }).join('');
      const ueberTotal = ids.reduce((s, i) => s + plaene[i].total.offenFaellig, 0), offenTotal = ids.reduce((s, i) => s + plaene[i].total.offen, 0);
      return `<div class="karte"><h3 style="margin:0 0 6px;font-size:17px">Offene Zahlungen</h3>
        <div class="hero-stand ${ueberTotal > 0 ? 'rot' : 'ok'}" style="margin:0 0 6px">${ueberTotal > 0 ? `Überfällig insgesamt: CHF ${chf(ueberTotal)}` : 'Nichts überfällig.'}</div>
        <div class="zeilen">${zeilen}</div>
        <p class="info" style="margin-bottom:0">Noch zu zahlen bis Vertragsende (alle vier): CHF ${chf(offenTotal)}. Darlehensraten (Tochter und Sohn) monatlich am letzten Tag des Monats, Rücklage (alle vier) jährlich bis 31. Dezember. Es zählen alle gebuchten Zahlungen, auch im Voraus bezahlte. Die Zahlungen kommen aus deinen Buchungen: Darlehensrate = Bank an «Darlehen an …», Rücklage = Bank an «Rücklage …».</p></div>`;
    })();
  const chipJ = (s) => s === 'ueberfaellig' ? '<span class="chipk rot">überfällig</span>' : s === 'bezahlt' ? '<span class="chipk ok">bezahlt</span>' : '<span class="chipk">offen</span>';
  const kinderPlan = kinderIds.filter((i) => plaene[i]).map((i) => {
    const pl = plaene[i];
    return `<div class="zeilen" style="margin-bottom:14px"><div class="z" style="padding-bottom:2px"><div class="l"><strong style="font-size:16px">${name(i)}</strong><div class="meta">Bezahlt CHF ${chf(pl.total.bezahlt)} von ${chf(pl.total.soll)} · noch offen CHF ${chf(pl.total.offen)}</div></div></div>${pl.jahre.map((j) => {
      const d = j.darlehen, r = j.ruecklage, s = [d.status, r.status].includes('ueberfaellig') ? 'ueberfaellig' : d.status === 'bezahlt' && r.status === 'bezahlt' ? 'bezahlt' : 'offen';
      return `<div class="z"><div class="l"><strong>Jahr ${j.jahr}</strong><div class="meta">Raten ${fmt(d.von)} bis ${fmt(d.bis)}</div><div class="meta">Darlehen: ${chf(d.bezahlt)} von ${chf(d.soll)} (${chf(d.monatlich)} pro Monat)</div><div class="meta">Rücklage: ${chf(r.bezahlt)} von ${chf(r.soll)}, bis ${fmt(r.bis)}</div><div class="meta">Restschuld nach Plan: ${chf(j.restschuldPlan)}</div></div><div class="r">${chipJ(s)}</div></div>`;
    }).join('')}</div>`;
  }).join('');
  const kinderInhalt = !D.start ? '<p class="info" style="margin-top:0">Das Übernahmedatum fehlt.</p>' : `${kinderPlan}<p class="info" style="margin-top:0">Soll laut Anhang A (Darlehen, Rückzahlung je CHF 9 600) und Ziffer 5 (Rücklage). Die Restschuld nach Plan rechnet den Erlass von CHF ${ERLASS_CHF} pro Jahr ein. Erfasste Zahlungen werden der Reihe nach den Jahren zugeordnet, das älteste Jahr zuerst.</p>`;
  const status = ids.map((i) => {
    const sp = zahlungsSperre(D.zahlstatus[i], t);
    const chip = sp.stufe === 'gesperrt' ? `<span class="chipk rot">Nutzungsverbot seit ${fmt(sp.ab)}</span>` : sp.stufe === 'erinnert' ? `<span class="chipk gelb">Erinnert, Frist bis ${fmt(sp.frist)}</span>` : '<span class="chipk ok">in Ordnung</span>';
    const knopf = !buch ? '' : sp.stufe === 'ok' ? `<button class="btn" data-st="${i}|erinnert">Erinnerung senden</button>` : `<button class="btn pri" data-st="${i}|ok">Zahlung erfolgt</button>`;
    return `<div class="z"><div class="l"><strong>${name(i)}</strong><div>${chip}</div></div><div class="r">${knopf}</div></div>`;
  }).join('');

  const kjahr = kl.filter((k) => k.datum.slice(0, 4) === String(J)).sort((a, b) => (a.datum < b.datum ? 1 : -1));
  const eAltListe = eAlt.sort((a, b) => (a.datum < b.datum ? 1 : -1));
  // ---- Einfache doppelte Buchhaltung ----
  const jn = D.journal, kname = Object.fromEntries(kontenListe(D.personen).map((k) => [k.nr, k.name]));
  const stichtag = t.slice(0, 4) === String(J) ? t : `${J}-12-31`;
  const bi = bilanz(jn, D.personen, stichtag), er = erfolgsrechnung(jn, D.personen, von, `${J}-12-31`);
  const sal = kontoSalden(jn, D.personen, '', stichtag);
  const jahrBuch = Object.values(jn).filter((b) => b.datum.slice(0, 4) === String(J)).sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : (a.erfasstAm || '') < (b.erfasstAm || '') ? 1 : -1));
  const kz = (k) => `<button class="z bz" data-kb="${k.nr}"><span class="l"><strong>${h(k.name)}</strong><span class="meta"> ${k.nr}</span></span><span class="r">${chf(k.saldo)}</span></button>`;
  const total = (titel, rp) => `<div class="z" style="border-top:2px solid var(--line)"><div class="l"><strong>${titel}</strong></div><div class="r"><strong>${chf(rp)}</strong></div></div>`;
  const kopf = (titel) => `<div class="z" style="padding-bottom:2px"><div class="l"><span class="meta" style="font-weight:700;letter-spacing:.04em;text-transform:uppercase">${titel}</span></div></div>`;
  const leerZ = (txt) => `<div class="z"><div class="l"><span class="meta">${txt}</span></div></div>`;
  const mein = `<div class="hero-zeile"><div><div class="hero-l">Bank CHF</div><div class="hero-z">${chf(sal['1020'].saldo)}</div></div><div><div class="hero-l">${er.ergebnis >= 0 ? 'Gewinn' : 'Verlust'} ${J}</div><div class="hero-z">${chf(er.ergebnis)}</div></div></div>
      <div class="hero-stand ${bi.stimmt ? 'ok' : 'rot'}">${!Object.keys(jn).length ? 'Noch keine Buchungen erfasst.' : bi.stimmt ? `Bilanz stimmt: Aktiven und Passiven je CHF ${chf(bi.sAktiven)}.` : 'Achtung: Die Bilanz geht nicht auf. Bitte die Buchungen prüfen.'}</div>`;
  const bilanzInhalt = `<p class="info" style="margin-top:0">Stand ${fmt(stichtag)}. Konten ohne Buchungen sind ausgeblendet. Antippen zeigt das Kontoblatt.</p>
    <div class="zeilen">${kopf('Aktiven')}${bi.aktiven.length ? bi.aktiven.map(kz).join('') : leerZ('Noch nichts gebucht.')}${total('Total Aktiven', bi.sAktiven)}</div>
    ${(() => { const fz = sal['1530'].saldo + sal['1531'].saldo, max = ANSCHAFFUNG_MAX_CHF * 100; return `<p class="info" style="margin:8px 0 0">Fahrzeug und Zubehör: CHF ${chf(fz)} von CHF ${chf(max)} Obergrenze (Vertrag Ziffer 3).${fz > max ? ' Darüber müssen alle Beteiligten einverstanden sein.' : ''}</p>`; })()}
    <div class="zeilen" style="margin-top:12px">${kopf('Passiven')}${bi.passiven.length ? bi.passiven.map(kz).join('') : leerZ('Noch nichts gebucht.')}
    <div class="z"><div class="l"><strong>Gewinn / Verlust</strong><div class="meta">Ertrag minus Aufwand, alle Jahre bis zum Stand</div></div><div class="r">${chf(bi.ergebnis)}</div></div>${total('Total Passiven', bi.sPassivenMitErgebnis)}</div>`;
  const erfInhalt = `<p class="info" style="margin-top:0">${fmt(von)} bis ${fmt(`${J}-12-31`)}.</p>
    <div class="zeilen">${kopf('Ertrag')}${er.ertrag.length ? er.ertrag.map(kz).join('') : leerZ('Kein Ertrag.')}${total('Total Ertrag', er.sErtrag)}</div>
    <div class="zeilen" style="margin-top:12px">${kopf('Aufwand')}${er.aufwand.length ? er.aufwand.map(kz).join('') : leerZ('Kein Aufwand.')}${total('Total Aufwand', er.sAufwand)}</div>
    <div class="zeilen" style="margin-top:12px">${total(er.ergebnis >= 0 ? 'Gewinn' : 'Verlust', er.ergebnis)}</div>`;
  const alleKonten = kontenListe(D.personen).map((k) => ({ ...k, saldo: sal[k.nr].saldo }));
  const kontenInhalt = `<p class="info" style="margin-top:0">Stand ${fmt(stichtag)}. Antippen zeigt das Kontoblatt.</p>${Object.entries({ aktiv: 'Aktiven', passiv: 'Passiven', ertrag: 'Ertrag', aufwand: 'Aufwand' }).map(([typ, tt]) => `<div class="zeilen">${kopf(tt)}${alleKonten.filter((k) => k.typ === typ).map(kz).join('')}</div>`).join('')}`;
  const journalInhalt = (jahrBuch.length ? jahrBuch.map((b) => zeileK('data-dj', b.id, 'CHF ' + chf(b.betrag), fmt(b.datum).slice(0, 6) + ' · ' + h(b.text) + '<br>' + h(kname[b.soll] || b.soll) + ' an ' + h(kname[b.haben] || b.haben), b)).join('') : '<p class="leer-t">Keine Buchungen erfasst.</p>')
    + (buch ? '' : '<p class="info">Buchen können HP (Buchhaltung) und Nanouk (Stellvertreterin), Vertrag Ziffer 11. Alle sehen die Zahlen.</p>');
  const sek = (titel, zusatz, inhalt, offen) => `<details class="sek"${offen ? ' open' : ''}><summary><span>${titel}</span><b>${zusatz}</b></summary><div class="sek-in">${inhalt}</div></details>`;
  function zeileK(attr, id, titel, sub, x) { return `<button class="t-z blau" ${attr}="${h(id)}"><span class="t-sq blau"><svg viewBox="0 0 24 24" aria-hidden="true">${KOSTEN_ICON}</svg></span><span class="t-zt"><strong>${titel}${neuPille(x)}</strong><small>${sub}</small></span><span class="t-pf" aria-hidden="true">›</span></button>`; }
  app.innerHTML = rahmen(`${seitenkopf('Kosten', buch ? 'kplus' : null, '＋ Buchen')}
  <div class="karte hero"><div class="monatskopf" style="margin:0 0 10px"><h2 style="font-size:18px">Jahr ${J}</h2><div class="nav"><button id="jz" aria-label="Voriges Jahr">‹</button><button id="jv" aria-label="Nächstes Jahr">›</button></div></div>
    ${mein}
  </div>
  ${offenKarte}
  ${sek('Bilanz', 'CHF ' + chf(bi.sAktiven), bilanzInhalt, true)}
  ${sek('Erfolgsrechnung', J + ': ' + chf(er.ergebnis), erfInhalt, false)}
  ${sek('Buchungen ' + J, jahrBuch.length + (jahrBuch.length === 1 ? ' Eintrag' : ' Einträge'), journalInhalt, jahrBuch.length > 0 && jahrBuch.length <= 3)}
  ${sek('Alle Konten', '', kontenInhalt, false)}
  ${sek('Zahlungen der Kinder, 8 Jahre', D.start ? 'CHF ' + chf(kinderIds.reduce((s, i) => s + (plaene[i] ? plaene[i].total.offen : 0), 0)) + ' offen' : 'Datum fehlt', kinderInhalt, false)}
  ${sek('Zahlplan aller', D.start ? 'Jahr ' + (vertragsJahr(D.start, t) ?? '–') : 'Datum fehlt', plan, false)}
  ${sek('Zahlungsstatus', '', `<div class="zeilen">${status}</div><p class="info">Bei Zahlungsverzug: Erinnerung, 10 Tage Frist, danach Nutzungsverbot bis zur Zahlung (Ziffer 4). Die App sperrt dann Reservierungen für diese Person.</p>`, false)}
  ${kjahr.length ? sek('Frühere Kostenerfassung ' + J, kjahr.length + (kjahr.length === 1 ? ' Eintrag' : ' Einträge'), '<p class="info" style="margin-top:0">Diese Kosten wurden vor der Buchhaltung erfasst. Neue Kosten bitte als Buchung erfassen.</p>' + kjahr.map((k) => zeileK('data-dk', k.id, 'CHF ' + chf(k.betrag), fmt(k.datum).slice(0, 6) + ' · ' + h(k.text || KOSTENARTEN[k.art]) + (k.verursacherId ? ' · ' + name(k.verursacherId) : ''), k)).join(''), false) : ''}
  ${eAltListe.length ? sek('Frühere Einzahlungen', eAltListe.length + (eAltListe.length === 1 ? ' Eintrag' : ' Einträge'), '<p class="info" style="margin-top:0">Diese Einzahlungen wurden vor der Buchhaltung erfasst. Sie zählen nicht mehr für den Zahlplan. Bitte als Buchung erfassen.</p>' + eAltListe.map((e) => zeileK('data-de', e.id, 'CHF ' + chf(e.betrag), fmt(e.datum) + ' · ' + name(e.personId) + ' · ' + h(ZWECKE[e.zweck]) + (e.text ? ' · ' + h(e.text) : ''), e)).join(''), false) : ''}`);
  bindRahmen();
  document.getElementById('jz').onclick = () => { jahrK = J - 1; kosten(); };
  document.getElementById('jv').onclick = () => { jahrK = J + 1; kosten(); };
  const eintragSheet = (titel, info, x, loeschen) => {
    const darf = buch && eigener(x);
    sheet(`<h3 style="margin:0 0 6px">${titel}</h3><p class="info" style="margin:0 0 6px">${info}</p>${darf ? '' : '<p class="info">Nur die Person, die den Eintrag erfasst hat, kann ihn löschen.</p>'}<div id="msg"></div>
      <div class="t-akt2">${darf ? '<button class="gross-btn rot" id="e_del">Löschen</button>' : ''}<button class="gross-btn" id="abb">Schliessen</button></div>`);
    document.getElementById('abb').onclick = schliessen;
    if (darf) document.getElementById('e_del').onclick = async () => { if (confirm('Eintrag löschen?')) await sicher(async () => { await loeschen(); schliessen(); kosten(); }); };
  };
  app.querySelectorAll('[data-dk]').forEach((b) => b.onclick = () => { const k = D.kosten[b.dataset.dk]; if (k) eintragSheet('CHF ' + chf(k.betrag), `${fmt(k.datum)} · ${h(KOSTENARTEN[k.art])}${k.verursacherId ? ' · Verursacher ' + name(k.verursacherId) : ''}${k.text ? ' · ' + h(k.text) : ''}<br>Erfasst von ${name(k.erfasstVon)}.`, k, () => S.loeschen(D, 'kosten', k.id)); });
  app.querySelectorAll('[data-de]').forEach((b) => b.onclick = () => { const e = D.einzahlungen[b.dataset.de]; if (e) eintragSheet('CHF ' + chf(e.betrag), `${fmt(e.datum)} · ${name(e.personId)} · ${h(ZWECKE[e.zweck])}${e.text ? ' · ' + h(e.text) : ''}<br>Erfasst von ${name(e.erfasstVon)}.`, e, () => S.loeschen(D, 'einzahlungen', e.id)); });
  app.querySelectorAll('[data-dj]').forEach((b) => b.onclick = () => { const j = D.journal[b.dataset.dj]; if (j) eintragSheet('CHF ' + chf(j.betrag), `${fmt(j.datum)} · ${h(j.text)}<br>Soll: ${h(kname[j.soll] || j.soll)}<br>Haben: ${h(kname[j.haben] || j.haben)}<br>Erfasst von ${name(j.erfasstVon)}.`, j, () => S.loeschen(D, 'journal', j.id)); });
  app.querySelectorAll('[data-kb]').forEach((b) => b.onclick = () => {
    const kb = kontoblatt(jn, D.personen, b.dataset.kb, stichtag); if (!kb.konto) return;
    const vz = (rp) => (rp < 0 ? '−' : '') + chf(Math.abs(rp));
    sheet(`<h3 style="margin:0 0 4px">${h(kb.konto.name)}</h3><p class="info" style="margin:0 0 8px">Konto ${kb.konto.nr} · Stand ${fmt(stichtag)}: <strong>CHF ${chf(kb.saldo)}</strong></p>
      <div class="zeilen">${kb.zeilen.length ? kb.zeilen.slice().reverse().map((z) => `<div class="z"><div class="l"><strong>${h(z.b.text)}</strong><div class="meta">${fmt(z.b.datum)} · Gegenkonto: ${h(kname[z.b.soll === kb.konto.nr ? z.b.haben : z.b.soll] || '?')}</div></div><div class="r">${vz(z.betrag)}<div class="meta">Saldo ${vz(z.saldo)}</div></div></div>`).join('') : '<p class="leer-t">Noch keine Buchungen auf diesem Konto.</p>'}</div>
      <div class="t-akt2"><button class="gross-btn" id="abb">Schliessen</button></div>`);
    document.getElementById('abb').onclick = schliessen;
  });
  const kp = document.getElementById('kplus'); if (kp) kp.onclick = buchungForm;
  app.querySelectorAll('[data-st]').forEach((b) => b.onclick = async () => {
    const [pid, neu] = b.dataset.st.split('|');
    await sicher(async () => { await S.speichern(D, 'zahlstatus', pid, neu === 'ok' ? { status: 'ok', erfasstVon: ich } : { status: 'erinnert', erinnertAm: heute(), erfasstVon: ich }); kosten(); hinweis(neu === 'ok' ? 'Status auf «in Ordnung» gesetzt.' : 'Erinnerung gesetzt. Die Frist beträgt 10 Tage.'); });
  });
  const sb = document.getElementById('startspei');
  if (sb) sb.onclick = async () => { const v = val('startdatum'); if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { hinweis('Bitte ein Datum wählen.'); return; } await sicher(async () => { await S.startSetzen(D, v); kosten(); hinweis('Übernahmedatum gespeichert.'); }); };
}
function startFeld(wert) {
  return `<label for="startdatum" style="display:block;margin:10px 0 6px;font-size:13px;font-weight:700;color:var(--muted)">Übernahmedatum des Fahrzeugs</label><div class="btnzeile" style="margin:0"><input type="date" id="startdatum" value="${h(wert)}" style="flex:1;min-width:150px;font:inherit;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--soft);color:var(--fg)"><button class="btn pri" id="startspei">Speichern</button></div>`;
}

function buchungForm() {
  const gruppen = { aktiv: 'Aktiven', passiv: 'Passiven', ertrag: 'Ertrag', aufwand: 'Aufwand' }, kl = kontenListe(D.personen);
  const optionen = (sel) => Object.entries(gruppen).map(([typ, tt]) => `<optgroup label="${tt}">${kl.filter((k) => k.typ === typ).map((k) => `<option value="${k.nr}"${k.nr === sel ? ' selected' : ''}>${k.nr} ${h(k.name)}</option>`).join('')}</optgroup>`).join('');
  const vorl = buchVorlagen(D.personen), v0 = vorl[0];
  sheet(`<h3>Buchung erfassen</h3>
  <label for="b_vorlage">Vorlage</label><select id="b_vorlage">${vorl.map((v) => `<option value="${v.id}">${h(v.name)}</option>`).join('')}</select>
  <div class="zwei"><div><label for="b_datum">Datum</label><input type="date" id="b_datum" value="${heute()}"></div>
  <div><label for="b_betrag">Betrag in CHF</label><input id="b_betrag" inputmode="decimal" placeholder="z. B. 45.50"></div></div>
  <label for="b_soll">Soll (wohin geht es?)</label><select id="b_soll">${optionen(v0.soll)}</select>
  <label for="b_haben">Haben (woher kommt es?)</label><select id="b_haben">${optionen(v0.haben)}</select>
  <label for="b_text">Buchungstext</label><input id="b_text" maxlength="${BUCH_TEXT_MAX}" placeholder="z. B. Gasflasche">
  <p class="info" id="b_hilfe" style="margin-bottom:0"></p>
  <div id="msg"></div><div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="spei">Speichern</button></div>`);
  const kn = Object.fromEntries(kl.map((k) => [k.nr, k.name])), hilfe = document.getElementById('b_hilfe');
  const zeigeHilfe = () => { hilfe.textContent = `Gebucht wird: ${kn[val('b_soll')] || '?'} an ${kn[val('b_haben')] || '?'}. Betrag immer positiv eingeben.`; };
  document.getElementById('b_vorlage').onchange = () => { const v = vorl.find((x) => x.id === val('b_vorlage')); if (v && v.soll) { document.getElementById('b_soll').value = v.soll; document.getElementById('b_haben').value = v.haben; } zeigeHilfe(); };
  document.getElementById('b_soll').onchange = zeigeHilfe; document.getElementById('b_haben').onchange = zeigeHilfe; zeigeHilfe();
  document.getElementById('abb').onclick = schliessen;
  document.getElementById('spei').onclick = async () => {
    const b = { datum: val('b_datum'), soll: val('b_soll'), haben: val('b_haben'), betrag: rappen(val('b_betrag')), text: val('b_text').trim(), erfasstVon: ich };
    const p = pruefeBuchsatz(b, D.personen);
    if (!p.ok) { fehler(p.fehler); return; }
    await sicher(async () => { await S.speichern(D, 'journal', null, b); jahrK = parseInt(b.datum.slice(0, 4), 10); schliessen(); kosten(); hinweis('Buchung gespeichert.'); });
  };
}

// =====================================================================
// Termine: MFK, Service, Reifenwechsel, Winterlager, ...
// =====================================================================
const TERMIN_ICON = {
  MFK: '<path d="M9 4h6v2H9zM7 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1M8.5 14l2.5 2.5 4.500-5"/>',
  Service: '<path d="M14.700 6.300a4 4 0 0 0-5.400 5.400L3 18l3 3 6.300-6.300a4 4 0 0 0 5.400-5.400l-2.600 2.600-2.400-.6-.6-2.400z"/>',
  Reifenwechsel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
  Winterlager: '<path d="M12 2v20M4.200 7l15.600 10M19.800 7 4.200 17M9 3.500l3 2.500 3-2.500M9 20.500l3-2.500 3 2.500"/>',
  Vignette: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14h4"/>',
  Versicherung: '<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  Sonstiges: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
};
function termine() {
  const t = heute();
  const nr = (iso) => { const [j, m, d] = iso.split('-').map(Number); return Date.UTC(j, m - 1, d) / 86400000; };
  const isoVon = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
  const tageBis = (x) => nr(x.faelligAm) - nr(t);
  const rel = (x) => { const d = tageBis(x); return d === 0 ? 'heute' : d === 1 ? 'morgen' : d > 1 ? `in ${d} Tagen` : d === -1 ? 'seit gestern' : `seit ${-d} Tagen`; };
  const pilleText = (x) => { const d = tageBis(x); return d < 0 ? `${-d} ${-d === 1 ? 'Tag' : 'Tage'}` : d === 0 ? 'heute' : `${d} ${d === 1 ? 'Tag' : 'Tage'}`; };
  const WT = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const wochentag = (iso) => WT[new Date(nr(iso) * 86400000).getUTCDay()];
  const datum = (iso) => { const [j, m, d] = iso.split('-').map(Number); return `${d}. ${MONATE[m - 1]} ${j}`; };
  const kurz = (iso) => { const [j, m, d] = iso.split('-').map(Number); return `${wochentag(iso).slice(0, 2)}, ${d}. ${MONATE[m - 1].slice(0, 3)}`; };
  const L = termineEcht();
  const offen = L.filter((x) => !x.erledigtAm).sort((a, b) => (a.faelligAm < b.faelligAm ? -1 : a.faelligAm > b.faelligAm ? 1 : 0));
  const fertig = L.filter((x) => x.erledigtAm).sort((a, b) => (a.erledigtAm < b.erledigtAm ? 1 : -1));
  const icon = (x) => `<svg viewBox="0 0 24 24" aria-hidden="true">${TERMIN_ICON[x.art] || TERMIN_ICON[x.titel] || TERMIN_ICON.Sonstiges}</svg>`;
  const klasse = (x) => ({ ueberfaellig: 'rot', bald: 'gelb', offen: 'blau', erledigt: 'ok' })[terminStufe(x, t)];

  // Karte oben: nächster Termin mit Ring (voll = fällig oder überfällig, leer = mindestens 30 Tage entfernt)
  const n = offen[0];
  let next = `<div class="t-next leer"><div><p class="t-lab">Nächster Termin</p><p class="t-nt">Keine offenen Termine</p><p class="t-nd">Alles erledigt.</p></div></div>`;
  if (n) {
    const d = tageBis(n), k = klasse(n), U = 2 * Math.PI * 34, voll = Math.max(0.06, Math.min(1, 1 - d / 30));
    const mitte = d === 0 ? '<b>Heute</b>' : `<b>${Math.abs(d)}</b><small>${Math.abs(d) === 1 ? 'Tag' : 'Tage'}</small>`;
    const pille = d < 0 ? 'zu spät' : d === 0 ? 'heute fällig' : d === 1 ? 'morgen fällig' : `in ${d} Tagen`;
    next = `<button class="t-next ${k}" data-tid="${h(n.id)}"><span class="t-ring"><svg viewBox="0 0 84 84"><circle class="rb" cx="42" cy="42" r="34"/><circle class="rf" cx="42" cy="42" r="34" stroke-dasharray="${(voll * U).toFixed(1)} ${U.toFixed(1)}"/></svg><span class="t-mid">${mitte}</span></span>
      <span class="t-ntx"><span class="t-lab">Nächster Termin</span><span class="t-nt">${h(n.titel)}</span><span class="t-nd">${wochentag(n.faelligAm).slice(0, 2)}, ${datum(n.faelligAm)}</span><span class="t-pille ${k}">${pille}</span></span></button>`;
  }

  // Wochenstreifen: die nächsten 14 Tage ab Montag dieser Woche
  const heuteNr = nr(t), montag = heuteNr - ((new Date(heuteNr * 86400000).getUTCDay() + 6) % 7);
  const tagMap = {}; offen.forEach((x) => { (tagMap[x.faelligAm] = tagMap[x.faelligAm] || []).push(x); });
  const strip = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<small>${w}</small>`).join('') + Array.from({ length: 14 }, (_, i) => {
    const iso = isoVon(montag + i), xs = tagMap[iso] || [], k = xs.length ? klasse(xs[0]) : '', dd = +iso.slice(8);
    return `<${xs.length ? 'button' : 'div'} class="t-tg${iso === t ? ' heute' : ''}${montag + i < heuteNr ? ' vorbei' : ''} ${k}"${xs.length ? ` data-tid="${h(xs[0].id)}"` : ''}>${dd}<u></u></${xs.length ? 'button' : 'div'}>`;
  }).join('');

  // Gruppen (der erste Termin steht schon in der Karte oben)
  const rest = offen.slice(1);
  const zeile = (x) => { const k = klasse(x); return `<button class="t-z ${k}" data-tid="${h(x.id)}"><span class="t-sq ${k}">${icon(x)}</span><span class="t-zt"><strong>${h(x.titel)}${neuPille(x)}</strong><small>${kurz(x.faelligAm)}</small></span><span class="t-pl ${k}">${pilleText(x)}</span></button>`; };
  const gruppe = (titel, xs) => xs.length ? `<p class="t-lab2">${titel}</p>${xs.map(zeile).join('')}` : '';
  const listen = gruppe('Überfällig', rest.filter((x) => klasse(x) === 'rot')) + gruppe('Bald (30 Tage)', rest.filter((x) => klasse(x) === 'gelb')) + gruppe('Später', rest.filter((x) => klasse(x) === 'blau'));
  const erl = fertig.map((x) => `<button class="t-fertig" data-tid="${h(x.id)}"><span class="t-haken">✓</span><span><strong>${h(x.titel)}</strong><small>erledigt am ${fmt(x.erledigtAm)}</small></span></button>`).join('');

  app.innerHTML = rahmen(`${seitenkopf('Termine', 'tneu', '＋ Termin')}
    ${next}
    <div class="t-woche">${strip}</div>
    ${listen}
    ${fertig.length ? `<details class="sek" style="margin-top:20px"><summary><span>Erledigt</span><b>${fertig.length}</b></summary><div class="sek-in">${erl}</div></details>` : ''}
    <p class="info" style="margin:18px 6px 0">HP organisiert Service, MFK, Reifenwechsel und Winterlager (Ziffer 11). Die Kosten tragen alle nach Ziffer 5.</p>`);
  bindRahmen();
  document.getElementById('tneu').onclick = terminForm;
  const upd = (id, aend) => !eigener(D.termine[id]) ? nurEigene() : sicher(async () => { await S.speichern(D, 'termine', id, { ...D.termine[id], ...aend }); schliessen(); termine(); });
  app.querySelectorAll('[data-tid]').forEach((b) => b.onclick = () => {
    const x = D.termine[b.dataset.tid]; if (!x) return;
    const darf = eigener(x), k = klasse(x);
    sheet(`<div class="t-sk"><span class="t-sq ${k} gross">${icon(x)}</span><div><h3 style="margin:0">${h(x.titel)}</h3><div class="info" style="margin:2px 0 0">${x.erledigtAm ? 'Erledigt am ' + fmt(x.erledigtAm) : wochentag(x.faelligAm) + ', ' + datum(x.faelligAm) + ' · ' + rel(x)}</div></div></div>
      ${x.art && x.art !== x.titel ? `<p class="info">Art: ${h(x.art)}</p>` : ''}${x.notiz ? `<p class="info">${h(x.notiz)}</p>` : ''}
      <p class="info">Erfasst von ${h(D.personen[x.erfasstVon]?.name || '?')}.${darf ? '' : ' Nur diese Person kann den Termin ändern.'}</p><div id="msg"></div>
      <div class="t-akt2">${darf ? (x.erledigtAm ? '<button class="gross-btn" id="t_wieder">Wieder öffnen</button>' : '<button class="gross-btn pri" id="t_erledigt">Als erledigt markieren</button>') + '<button class="gross-btn rot" id="t_loeschen">Löschen</button>' : ''}<button class="gross-btn" id="abb">Schliessen</button></div>`);
    document.getElementById('abb').onclick = schliessen;
    if (darf) {
      const e = document.getElementById('t_erledigt'), w = document.getElementById('t_wieder');
      if (e) e.onclick = () => upd(x.id, { erledigtAm: heute() });
      if (w) w.onclick = () => upd(x.id, { erledigtAm: '' });
      document.getElementById('t_loeschen').onclick = async () => { if (confirm('Termin löschen?')) await sicher(async () => { await S.loeschen(D, 'termine', x.id); schliessen(); termine(); }); };
    }
  });
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


// =====================================================================
// Wunschliste (Vertrag Ziffer 5, «Einrichtung»): Einrichtungsgegenstände bis CHF 200 pro Stück
// =====================================================================
const WUNSCH_ICON = '<path d="M12 3l2.600 5.600 6.100.700-4.500 4.200 1.200 6L12 16.600 6.600 19.500l1.200-6L3.300 9.300l6.100-.700z"/>';
const wunschListe = () => Object.values(D.wuensche);
const wunschStandVon = (w) => wunschStand(w, Object.values(D.wunschaktionen), idsGeordnet(), heute());
const wunschPreisText = (w) => w.menge > 1 ? `${w.menge} × CHF ${chf(w.preis)} = CHF ${chf(wunschTotal(w))}` : `CHF ${chf(w.preis)}`;
const wunschKlasse = (s) => ({ offen: 'blau', freigegeben: 'ok', abgelehnt: 'rot', gekauft: 'ok' })[s];

function wunschliste() {
  const t = heute();
  const alle = wunschListe().map((w) => ({ w, s: wunschStandVon(w) })).sort((a, b) => (a.w.datum < b.w.datum ? 1 : a.w.datum > b.w.datum ? -1 : 0));
  const pille = ({ w, s }) => {
    if (s.status === 'offen') {
      return [wunschKlasse('offen'), 'bis ' + fmt(s.frist).slice(0, 6)];
    }
    if (s.status === 'gekauft') return s.erstattet ? ['ok', 'erstattet'] : ['gelb', 'Erstattung offen'];
    return [wunschKlasse(s.status), WUNSCH_STATUS[s.status]];
  };
  const zeile = (e) => {
    const { w, s } = e, [k, txt] = pille(e);
    const meinAntwortOffen = s.status === 'offen' && w.erfasstVon !== ich && !s.antworten[ich];
    const sub = `${wunschPreisText(w)} · ${h(D.personen[w.erfasstVon]?.name || '?')} · ${fmt(w.datum).slice(0, 6)}`;
    const bild = w.foto ? `<span class="t-sq ${k} mit-foto"><img src="${h(w.foto)}" alt=""></span>` : `<span class="t-sq ${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${WUNSCH_ICON}</svg></span>`;
    return `<button class="t-z ${k}" data-wid="${h(w.id)}">${bild}<span class="t-zt"><strong>${h(w.titel)}${neuPille(w)}${meinAntwortOffen ? '<span class="neu gelb">Antwort fehlt</span>' : ''}</strong><small>${sub}</small></span><span class="t-pl ${k}">${txt}</span></button>`;
  };
  const gruppe = (titel, xs, offen) => xs.length ? `<p class="t-lab2">${titel}</p>${xs.map(zeile).join('')}` : '';
  const dein = alle.filter((e) => e.s.status === 'offen' && e.w.erfasstVon !== ich && !e.s.antworten[ich]);
  const laufend = alle.filter((e) => e.s.status === 'offen' && !dein.includes(e));
  const frei = alle.filter((e) => e.s.status === 'freigegeben');
  const gekauft = alle.filter((e) => e.s.status === 'gekauft'), abgelehnt = alle.filter((e) => e.s.status === 'abgelehnt');
  const leer = alle.length === 0 ? '<div class="karte"><p class="leer-t" style="margin:6px 0">Noch keine Wünsche. Mit «＋ Wunsch» schlägst du etwas für das Womo vor (Leuchte, Überzüge, Geschirr usw.).</p></div>' : '';
  app.innerHTML = rahmen(`${seitenkopf('Wunschliste', 'wneu', '＋ Wunsch')}
    <div class="karte"><p class="info" style="margin:0">Einrichtung für das Womo: <strong>bis CHF 200 pro Stück</strong>. Vorher hier vorschlagen. Die anderen haben ${WUNSCH_FRIST_TAGE} Tage Zeit, wer nicht antwortet, stimmt zu. Bei Widerspruch gilt: höchstens ein Nein, sonst abgelehnt (qualifizierte Mehrheit, Ziffer 13). Bei 2 zu 2 ist der Kauf abgelehnt. Wer ohne Freigabe kauft, bezahlt selbst (Vertrag Ziffer 5).</p>
      <p class="info" style="margin:8px 0 0"><strong>Verbrauchsmaterial</strong> (Putzmittel, Spülmittel, Abfallsäcke, Salz, Pfeffer, Teebeutel usw.) braucht keinen Wunsch: einfach kaufen und unter «Kosten» erfassen.</p></div>
    ${leer}${gruppe('Wartet auf deine Antwort', dein)}${gruppe('Freigegeben, kann gekauft werden', frei)}${gruppe('Antworten laufen', laufend)}
    ${gekauft.length ? `<details class="sek" style="margin-top:20px"><summary><span>Gekauft</span><b>${gekauft.length}</b></summary><div class="sek-in">${gekauft.map(zeile).join('')}</div></details>` : ''}
    ${abgelehnt.length ? `<details class="sek"><summary><span>Abgelehnt</span><b>${abgelehnt.length}</b></summary><div class="sek-in">${abgelehnt.map(zeile).join('')}</div></details>` : ''}`);
  bindRahmen(); bindNeu();
  document.getElementById('wneu').onclick = wunschForm;
  app.querySelectorAll('[data-wid]').forEach((b) => b.onclick = () => wunschDetail(b.dataset.wid));
}

// Foto im Handy verkleinern (längste Seite höchstens 1000 px, JPEG), damit es in den Wunsch passt (Firestore: 1 MiB pro Eintrag).
function fotoVerkleinern(file) {
  return new Promise((ok, nein) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      try {
        let max = 1000, q = 0.72, out = '';
        for (let i = 0; i < 10; i++) {
          const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * f)); c.height = Math.max(1, Math.round(img.naturalHeight * f));
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length <= 150000) break;
          q = Math.max(0.4, q - 0.08); max = Math.round(max * 0.85);
        }
        URL.revokeObjectURL(url);
        if (out.length > WUNSCH_FOTO_MAX) nein(new Error('Das Foto ist auch verkleinert zu gross.')); else ok(out);
      } catch (e) { URL.revokeObjectURL(url); nein(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); nein(new Error('Das Bild kann nicht gelesen werden.')); };
    img.src = url;
  });
}

function wunschForm() {
  sheet(`<h3>Neuer Wunsch</h3>
  <label for="w_titel">Was soll gekauft werden?</label><input id="w_titel" maxlength="100" placeholder="Konkretes Produkt, z. B. Leselampe mit Clip, weiss">
  <div class="zwei"><div><label for="w_preis">Preis pro Stück, CHF</label><input id="w_preis" inputmode="decimal" placeholder="z. B. 24.90"></div>
  <div><label for="w_menge">Stückzahl</label><input type="number" id="w_menge" min="1" max="99" value="1" inputmode="numeric"></div></div>
  <label for="w_link">Link zum Produkt</label><input id="w_link" type="url" inputmode="url" maxlength="300" autocapitalize="off" autocorrect="off" placeholder="https://… (empfohlen)">
  <label for="w_notiz">Notiz</label><input id="w_notiz" maxlength="200" placeholder="optional, z. B. wofür, Farbe">
  <label>Foto (optional)</label><label class="foto-wahl" for="w_foto" id="w_fwahl">📷 Foto aufnehmen oder auswählen</label><input type="file" id="w_foto" accept="image/*" style="display:none">
  <div id="w_fprev"></div>
  <p class="info">Höchstens CHF 200 pro Stück, gleichartige Stücke zusammen höchstens CHF 200. Darüber: Familienrat. Die anderen haben ${WUNSCH_FRIST_TAGE} Tage Zeit zum Antworten.</p>
  <div id="msg"></div><div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="spei">Vorschlagen</button></div>`);
  document.getElementById('abb').onclick = schliessen;
  let foto = '';
  const vorschau = () => { document.getElementById('w_fprev').innerHTML = foto ? `<div class="foto-vor"><img src="${h(foto)}" alt="Vorschau"><button type="button" class="kl" id="w_fweg">Foto entfernen</button></div><p class="info" style="margin:4px 0 0">Das Foto wird verkleinert gespeichert (${Math.round(foto.length / 1024)} KB).</p>` : ''; const wg = document.getElementById('w_fweg'); if (wg) wg.onclick = () => { foto = ''; document.getElementById('w_foto').value = ''; vorschau(); }; document.getElementById('w_fwahl').textContent = foto ? '📷 Anderes Foto wählen' : '📷 Foto aufnehmen oder auswählen'; };
  document.getElementById('w_foto').onchange = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    document.getElementById('w_fprev').innerHTML = '<p class="info">Foto wird verkleinert …</p>';
    try { foto = await fotoVerkleinern(f); vorschau(); }
    catch (x) { foto = ''; vorschau(); fehler('Das Foto konnte nicht verarbeitet werden: ' + (x.message || x)); }
  };
  document.getElementById('spei').onclick = async () => {
    const w = { titel: val('w_titel').trim(), preis: rappen(val('w_preis')), menge: parseInt(val('w_menge') || '1', 10), link: val('w_link').trim(), notiz: val('w_notiz').trim(), foto: foto || undefined, datum: heute(), erfasstVon: ich };
    const p = pruefeWunsch(w);
    if (!p.ok) { fehler(p.fehler); return; }
    await sicher(async () => { const id = await S.speichern(D, 'wuensche', null, w); schliessen(); wunschliste(); hinweis(`Wunsch gespeichert. Die anderen haben bis ${fmt(addTage(w.datum, WUNSCH_FRIST_TAGE))} Zeit.`); wunschDetail(id); });
  };
}

function wunschDetail(id) {
  const w = D.wuensche[id]; if (!w) return;
  const s = wunschStandVon(w), ids = idsGeordnet(), mein = w.erfasstVon === ich, halter = ich === D.adminId;
  const k = wunschKlasse(s.status);
  const stimmeChip = (i) => {
    if (i === w.erfasstVon) return '<span class="chipk ok">Vorschlag</span>';
    const a = s.antworten[i];
    if (a) return a.stimme === 'ja' ? '<span class="chipk ok">Ja</span>' : '<span class="chipk rot">Nein</span>';
    return s.abgelaufen || s.status !== 'offen' ? '<span class="chipk ok">zählt als Ja</span>' : '<span class="chipk gelb">noch offen</span>';
  };
  const zeilen = ids.map((i) => { const a = s.antworten[i]; return `<div class="z"><div class="l"><strong>${h(D.personen[i].name)}</strong>${a && a.stimme === 'nein' ? `<div class="meta">${a.grund ? 'Grund: ' + h(a.grund) : ''}${a.grund && a.alternative ? '<br>' : ''}${a.alternative ? 'Alternative: ' + h(a.alternative) : ''}</div>` : ''}</div><div class="r">${stimmeChip(i)}</div></div>`; }).join('');
  const stand = s.status === 'offen' ? `Antworten bis ${fmt(s.frist)} (einschliesslich). Wer nicht antwortet, stimmt zu.`
    : s.status === 'freigegeben' ? `Freigegeben: ${s.ja} Ja zu ${s.nein.length} Nein. ${mein ? 'Du kannst kaufen.' : 'Kaufen darf, wer den Wunsch vorgeschlagen hat.'}`
    : s.status === 'abgelehnt' ? `Abgelehnt: ${s.ja} Ja zu ${s.nein.length} Nein${s.nein.length === s.ja ? ' (Gleichstand gilt als abgelehnt, Ziffer 13)' : ''}. Nicht kaufen.`
    : `Gekauft am ${fmt(w.gekauftAm)} für CHF ${chf(w.gekauftBetrag)} von ${h(D.personen[w.erfasstVon]?.name || '?')}. ${s.erstattet ? 'Erstattet am ' + fmt((s.erstattet.datum || s.erstattet.erfasstAm || '').slice(0, 10)) + '.' : 'Der Vater erstattet den Betrag vom gemeinsamen Konto (Ziffer 5).'}`;
  const waText = `⭐ Womo-Wunsch von ${D.personen[w.erfasstVon]?.name || '?'}: ${w.titel}${w.menge > 1 ? ' (' + w.menge + ' Stück)' : ''}, ${wunschPreisText(w)}.${w.link ? ' ' + w.link : ''} Bitte in der Womo-App bis ${fmt(s.frist)} antworten (Ja oder Nein).`;
  const meinAntwort = s.status === 'offen' && !mein;
  const kaufen = s.status === 'freigegeben' && mein;
  const erstatten = s.status === 'gekauft' && halter && !s.erstattet;
  sheet(`<div class="t-sk"><span class="t-sq ${k} gross"><svg viewBox="0 0 24 24" aria-hidden="true">${WUNSCH_ICON}</svg></span><div><h3 style="margin:0">${h(w.titel)}</h3><div class="info" style="margin:2px 0 0">${wunschPreisText(w)} · von ${h(D.personen[w.erfasstVon]?.name || '?')}, ${fmt(w.datum)}</div></div></div>
    <p class="hinweiskarte ${k === 'blau' ? 'gelb' : k}" style="margin:12px 0 8px">${stand}</p>
    ${w.foto ? `<img class="w-foto" id="w_fbig" src="${h(w.foto)}" alt="Foto: ${h(w.titel)}">` : ''}
    ${w.link ? `<p class="info" style="margin:0 0 6px"><a class="u-chip" href="${h(w.link)}" target="_blank" rel="noopener">Produkt ansehen<em>Link</em></a></p>` : ''}${w.notiz ? `<p class="info" style="margin:0 0 6px">${h(w.notiz)}</p>` : ''}
    <div class="zeilen">${zeilen}</div>
    ${meinAntwort ? `<label for="w_grund">Nur bei Nein: Grund</label><input id="w_grund" maxlength="200" placeholder="Warum nicht?"><label for="w_alt">Nur bei Nein: Alternative (Produkt, Preis)</label><input id="w_alt" maxlength="200" placeholder="Was wäre besser?">` : ''}
    ${kaufen ? `<div class="zwei"><div><label for="w_betrag">Bezahlt, CHF</label><input id="w_betrag" inputmode="decimal" value="${chf(wunschTotal(w)).replace(/[’' ]/g, '')}"></div><div><label for="w_kdatum">Kaufdatum</label><input type="date" id="w_kdatum" value="${heute()}"></div></div>` : ''}
    <div id="msg"></div>
    <div class="t-akt2">${meinAntwort ? `<button class="gross-btn pri" id="w_ja">${s.antworten[ich] ? 'Antwort ändern: Ja' : 'Ja, einverstanden'}</button><button class="gross-btn rot" id="w_nein">${s.antworten[ich] ? 'Antwort ändern: Nein' : 'Nein'}</button>` : ''}
      ${kaufen ? '<button class="gross-btn pri" id="w_kauf">Gekauft eintragen</button>' : ''}
      ${erstatten ? '<button class="gross-btn pri" id="w_erst">Betrag erstattet</button>' : ''}
      ${s.status === 'offen' ? `<a class="gross-btn" style="text-align:center;text-decoration:none" href="${waLink(waText)}" target="_blank" rel="noopener">Familie per WhatsApp informieren</a>` : ''}
      ${mein && s.status !== 'gekauft' ? '<button class="gross-btn rot" id="w_del">Wunsch löschen</button>' : ''}<button class="gross-btn" id="abb">Schliessen</button></div>`);
  document.getElementById('abb').onclick = schliessen;
  const fb = document.getElementById('w_fbig');
  if (fb) fb.onclick = () => { const o = document.createElement('div'); o.className = 'foto-gross'; o.innerHTML = `<img src="${h(w.foto)}" alt="">`; o.onclick = () => o.remove(); document.body.appendChild(o); };
  const aktion = (aid, daten, text) => sicher(async () => { await S.speichern(D, 'wunschaktionen', aid, { wunschId: w.id, erfasstVon: ich, ...daten }); schliessen(); wunschliste(); hinweis(text); });
  if (meinAntwort) {
    document.getElementById('w_ja').onclick = () => aktion(`${w.id}_a_${ich}`, { art: 'antwort', personId: ich, stimme: 'ja' }, 'Danke, du hast Ja gesagt.');
    document.getElementById('w_nein').onclick = () => {
      const grund = val('w_grund').trim(), alt = val('w_alt').trim();
      if (!grund && !alt) { fehler('Bei Nein bitte einen Grund oder eine Alternative angeben. Nur Nein zu sagen genügt nicht.'); return; }
      aktion(`${w.id}_a_${ich}`, { art: 'antwort', personId: ich, stimme: 'nein', grund, alternative: alt }, 'Danke, dein Nein ist gespeichert.');
    };
  }
  if (kaufen) document.getElementById('w_kauf').onclick = async () => {
    const betrag = rappen(val('w_betrag')), datum = val('w_kdatum'), p = pruefeKauf(w, betrag, datum);
    if (!p.ok) { fehler(p.fehler); return; }
    await sicher(async () => {
      // Kosten zuerst (feste Nummer: kein doppelter Eintrag), dann der Wunsch
      const kid = await S.speichern(D, 'kosten', 'kw_' + w.id, { datum, betrag, art: 'betrieb', text: `Einrichtung (Wunschliste): ${w.titel}`.slice(0, 100), wunschId: w.id, erfasstVon: ich });
      await S.speichern(D, 'wuensche', w.id, { ...w, gekauftAm: datum, gekauftBetrag: betrag, kostenId: kid });
      schliessen(); wunschliste(); hinweis('Gekauft eingetragen. Der Betrag zählt zu den laufenden Kosten. Der Vater erstattet vom gemeinsamen Konto.');
    });
  };
  if (erstatten) document.getElementById('w_erst').onclick = () => { if (confirm(`Hast du CHF ${chf(w.gekauftBetrag)} an ${D.personen[w.erfasstVon]?.name || '?'} erstattet?`)) aktion(`${w.id}_erstattet`, { art: 'erstattet', datum: heute() }, 'Erstattung eingetragen.'); };
  const del = document.getElementById('w_del');
  if (del) del.onclick = async () => { if (confirm('Wunsch löschen? Alle Antworten dazu werden ebenfalls gelöscht.')) await sicher(async () => { for (const a of Object.values(D.wunschaktionen).filter((x) => x.wunschId === w.id)) await S.loeschen(D, 'wunschaktionen', a.id); await S.loeschen(D, 'wuensche', w.id); schliessen(); wunschliste(); }); };
}

start();
