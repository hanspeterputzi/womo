import {
  SCHWELLE, schwellen, pruefeMinus, minusFuerReservierung, minusAmTag, pruefeTausch, TAUSCH_MAX_TAGE, dauer, konten, kontostaende, kontostaendeMitAlltag, pruefeAlltag, alltagTage, alltagKm, tankWarnung, tankOffen, stufe, kollision, ueberschneidungen, pruefeBuchung, kmZahl, vorschauBuchung, feiertagAm, feiertage, FEIERTAGE, naechsterFeiertag, feiertagStatistik, seltenstBlock,
  TANK, CHECKPUNKTE, pruefeUebergabe, kmStatistik,
  KOSTENARTEN, ZWECKE, TERMINARTEN, ANSCHAFFUNG_MAX_CHF, anschaffung, kostenAnteile, eingezahlt, vertragsJahr, zahlplan, faelligkeiten, VORLAUF_TAGE, addTage, zahlungsSperre, terminStufe, rueckgabeFertig, addJahre, chf,
  WUNSCH_MAX_RAPPEN, WUNSCH_FOTO_MAX, WUNSCH_FRIST_TAGE, WUNSCH_STATUS, wunschTotal, pruefeWunsch, wunschStand, pruefeKauf, istNeu, neuZaehlen, NEU_BEREICHE,
  FRAGE_ANHANG_MAX, FRAGE_BILD_MAX, FRAGE_ANHANG_SUMME, FRAGE_PDF_MAX, FRAGE_STATUS, FRAGE_TITEL_MAX, FRAGE_TEXT_MAX, FRAGE_GRUND_MAX, pruefeFrage, frageStand,
  rundgangSchritte, pruefeSchritt, naechsterOffener, uebergabeAusRundgang, pruefeRundgang, ueFotoName, UE_FOTO_PFLICHT, UE_SCHADEN_FOTOS, UE_MANGEL_MAX, UE_SCHADEN_MAX,
  NOTFALL_FELDER, NOTFALL_DOKUMENTE, NOTFALL_WERT_MAX, NOTFALL_TEL_MAX, NOTFALL_MED_MAX, NOTFALL_DOK_MAX, pruefeNotfallTel, notfallFehlt, notfallAuszug,
  ORT_PRO_JAHR, ORT_TEXT_MIN, ORT_TEXT_MAX, ORT_PRAKTISCH_MAX, ORT_ARTEN, ORT_LAENDER, ORT_FAVORIT_AB, pruefeOrt, ortStand, ortReihenfolge,
  achtJahrePlan, pruefeFahrfreigabe, fahrfreigabeStand, jahreSeit, FAHRFREIGABE_STATUS, ERLASS_CHF, zahlungenAusJournal, zuBuchen, wunschGebucht, kontenListe, buchVorlagen, BUCH_TEXT_MAX, pruefeBuchsatz, kontoSalden, erfolgsrechnung, bilanz, kontoblatt,
} from './regeln.js?v=20261115i';
import * as S from './speicher.js?v=20261115i';
const VER = (() => { try { return new URL(import.meta.url).searchParams.get('v') || '0'; } catch { return '0'; } })();
// Offline-Speicher: haelt die Notfallkarte bereit, auch ohne Netz (sw.js).
try { if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(() => fetch('notfall.html?v=' + VER).catch(() => {})).catch(() => {}); } catch {}
// Das Bild der Startseite wird sofort im Hintergrund geladen, waehrend die Daten noch kommen.
try { const vor = new Image(); vor.src = 'possl.png?v=' + VER; } catch {}
// Stile kommen aus stil.css mit der aktuellen Version. So passt das Aussehen immer zu diesem Programm, auch wenn index.html noch im Zwischenspeicher liegt.
await new Promise((ok) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'stil.css?v=' + VER; l.onload = l.onerror = () => ok(); document.head.appendChild(l); setTimeout(ok, 2500); });

const app = document.getElementById('app');
// Roter Notfall-Link fuer Ladeseite und Fehlerseiten: Die Notfallkarte muss auch dann erreichbar sein, wenn die App selbst nicht startet (kein Netz).
const SOS_GROSS = `<a class="sos-gross" href="notfall.html?v=${VER}">🆘 Notfallkarte öffnen<small>funktioniert auch ohne Netz</small></a>`;
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
// Rollen der Buchhaltung: 'hp' (Hauptbuchhalter), 'stv1' (Stellvertretung, Nanouk), 'stv2' (zweite Stellvertretung, Nene, nur wenn er einen Schluessel eingegeben hat).
const rolle = () => !ich ? null : ich === D.adminId ? 'hp' : ich === 't' ? 'stv1' : (ich === 's' && S.schluesselGet('s')) ? 'stv2' : null;
const buchhalter = () => rolle() !== null;
const liste = () => Object.values(D.buchungen);
// Alltagsfahrten liegen als Eintraege mit art 'Alltag' in der Sammlung 'termine' (keine neue Datenbankregel noetig).
const termineEcht = () => Object.values(D.termine).filter((x) => x.art !== 'Alltag' && x.art !== 'Tank' && x.art !== 'Tausch' && x.art !== 'Fahrfreigabe' && x.art !== 'FahrAntwort' && x.art !== 'Frage' && x.art !== 'FrageAntwort' && x.art !== 'Minus');
// «Nicht verfuegbar» (Minus-Termin): art 'Minus' in 'termine', jede Person nur fuer sich, nur Warnung.
const minusListe = () => Object.values(D.termine).filter((x) => x.art === 'Minus');
// Tausch von Nutzungstagen (Vertrag Ziffer 7 a): Eintraege mit art 'Tausch' in der Sammlung 'termine' (keine neue Datenbankregel noetig).
const tauschListe = () => Object.values(D.termine).filter((x) => x.art === 'Tausch');
const tauschMap = () => Object.fromEntries(tauschListe().map((x) => [x.id, x]));
const tankFuellungen = () => Object.values(D.termine).filter((x) => x.art === 'Tank');
// Direktlink auf einen Punkt in der App (ohne Zugangscode): w = Wunsch, f = Frage, a = Fahrerfreigabe.
// Der Code bleibt auf dem Gerät gespeichert; wer die App noch nicht eingerichtet hat, gibt ihn einmal ein und landet danach beim Punkt.
const appLink = (art, id) => location.origin + location.pathname + '?' + art + '=' + encodeURIComponent(id);
const mitLink = (text, art, id) => id ? text + '\n\nIn der App öffnen: ' + appLink(art, id) : text;
const ZIEL_OK = /^[A-Za-z0-9_-]{1,80}$/;
let ziel = (() => {
  try {
    const q = new URLSearchParams(location.search);
    for (const art of ['w', 'f', 'a']) { const id = q.get(art); if (id && ZIEL_OK.test(id)) { sessionStorage.setItem('womo-ziel', art + ':' + id); break; } }
    const z = sessionStorage.getItem('womo-ziel') || '';
    return /^[wfa]:[A-Za-z0-9_-]{1,80}$/.test(z) ? z : '';
  } catch { return ''; }
})();
function zielOeffnen() {
  if (!ziel || !ich) return;
  const [art, id] = ziel.split(':'); ziel = ''; try { sessionStorage.removeItem('womo-ziel'); history.replaceState(null, '', location.pathname + location.hash); } catch {}
  const da = art === 'w' ? D.wuensche[id] : D.termine[id];
  tab = 'wunschliste'; famAnsicht = art === 'w' ? 'wunsch' : art === 'f' ? 'fragen' : 'fahrer';
  zeige(); window.scrollTo(0, 0);
  if (!da) { hinweis('Dieser Eintrag existiert nicht mehr.'); return; }
  if (art === 'w') wunschDetail(id); else if (art === 'f') frageDetail(id); else freigabeDetail(id);
}
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
  app.innerHTML = `<div class="login"><p class="gross">Womo</p><p class="sub">Daten werden geladen …</p>${SOS_GROSS}</div>`;
  try { D = await S.laden(); }
  catch (e) {
    if (!S.online || /ungültig/.test(e.message || '')) { codeFeld(!S.online ? '' : 'Dieser Code ist ungültig.'); return; }
    app.innerHTML = `<div class="login"><p class="gross" style="font-size:24px;font-weight:800">Womo</p><div class="fehler">${h(e.message || 'Verbindung fehlgeschlagen.')}</div>${SOS_GROSS}<button id="nochmal">Nochmals versuchen</button></div>`; document.getElementById('nochmal').onclick = () => location.reload(); return;
  }
  try { await S.abonnieren(D, () => { if (ich && formEl.innerHTML === '') zeige(); }); }
  catch (e) { app.innerHTML = `<div class="login"><p class="gross" style="font-size:24px;font-weight:800">Womo</p><div class="fehler">${h('Daten konnten nicht geladen werden: ' + (e.message || e))}</div>${SOS_GROSS}<button id="nochmal">Nochmals versuchen</button></div>`; document.getElementById('nochmal').onclick = () => location.reload(); return; }
  try { const id = sessionStorage.getItem('womo-ich'); if (id && D.personen[id] && !abgelaufen()) { ich = id; besuchStart(); aktivMerken(); } } catch {}
  zeige();
  zielOeffnen();
}

function zeige() {
  notfallMerken();
  if (!ich) return anmeldung();
  ({ kalender, fahrten, kosten, wunschliste, termine, vertrag, unterwegs })[tab]();
}

function anmeldung() {
  if (!Object.keys(D.personen).length) { app.innerHTML = '<div class="login"><p class="gross">Womo</p><div class="fehler">Es sind noch keine Personen eingerichtet. Bitte zuerst die Einrichtung durchführen.</div></div>'; return; }
  let zuletzt = ''; try { zuletzt = localStorage.getItem('womo-person') || ''; } catch {}
  app.innerHTML = `<div class="start">
    <div class="start-top"><span class="start-marke"><span class="keil"></span>PÖSSL</span><span class="start-r"><a class="sos" href="notfall.html?v=${VER}" aria-label="Notfall: Notfallkarte öffnen">SOS</a><button class="start-thm" id="sthm" type="button" aria-label="Darstellung wechseln: Auto, Hell, Dunkel">${THEMA_NAME[themaLesen()]}</button></span></div>
    <div class="start-szene" aria-hidden="true">
      <div class="sterne"></div><div class="sonne"></div>
      <div class="wolke w1"></div><div class="wolke w2"></div><div class="wolke w3"></div>
      <svg class="hügel" viewBox="0 0 400 160" preserveAspectRatio="none"><path class="h1" d="M0 86C60 34 124 38 192 74S322 118 400 56V160H0Z"/><path class="h2" d="M0 118C70 78 142 94 212 108S342 78 400 102V160H0Z"/><path class="h3" d="M0 140C80 116 160 130 240 138S360 118 400 130V160H0Z"/></svg>
      <div class="strasse"><i></i></div>
      <div class="van-wrap"><img class="van" src="possl.png?v=${VER}" alt="" width="760" height="417" decoding="async"><div class="licht"></div></div>
    </div>
    <div class="start-karte">
      <h1 class="wortmarke-h"><span class="wortmarke" role="img" aria-label="Roadcamp" style="-webkit-mask-image:url(roadcamp.png?v=${VER});mask-image:url(roadcamp.png?v=${VER})"></span></h1><p class="sub">Unser Wohnmobil</p>
      <label for="p">Wer bist du?</label>
      <select id="p">${personenGeordnet().map(([i, p]) => `<option value="${i}"${i === zuletzt ? ' selected' : ''}>${h(p.name)}</option>`).join('')}</select>
      <label for="pin">Passwort</label><input id="pin" maxlength="40" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" type="password">
      <div id="msg"></div><button class="ok" id="ok" type="button">Weiter<span aria-hidden="true">→</span></button>
      <p class="klein-t">Das Passwort zeigt nur, wer eine Eintragung erfasst. Er schützt keine Daten.</p>
    </div></div>`;
  { const st = document.getElementById('sthm'), sz = app.querySelector('.start'), im = app.querySelector('.van'); const go = () => sz.classList.add('los');
    st.onclick = () => { const f = ['auto', 'hell', 'dunkel']; const n = f[(f.indexOf(themaLesen()) + 1) % 3]; themaSetzen(n); st.textContent = THEMA_NAME[n]; };
    if (im.complete) go(); else { im.onload = go; im.onerror = go; setTimeout(go, 2500); }
    // Notbremse: falls Animationen auf dem Gerät nicht laufen, bleibt der Van trotzdem sichtbar.
    setTimeout(() => { const w = app.querySelector('.van-wrap'); if (w && getComputedStyle(w).opacity === '0') w.style.opacity = '1'; }, 3600); }
  const los = async () => {
    const id = document.getElementById('p').value, pin = document.getElementById('pin').value;
    let sp = { n: 0, bis: 0 }; try { sp = JSON.parse(localStorage.getItem('womo-pinfehler')) || sp; } catch {}
    if (Date.now() < sp.bis) { document.getElementById('msg').innerHTML = `<div class="fehler">Zu viele Fehlversuche. Bitte ${Math.ceil((sp.bis - Date.now()) / 1000)} Sekunden warten.</div>`; return; }
    if (await S.pinPasst(D.personen[id], pin)) { try { localStorage.removeItem('womo-pinfehler'); } catch {} ich = id; tab = 'kalender'; aktivMerken(); try { sessionStorage.setItem('womo-ich', id); localStorage.setItem('womo-person', id); } catch {} besuchStart(); zeige(); zielOeffnen(); }
    else { sp.n++; if (sp.n >= 5) { sp.bis = Date.now() + 60000; sp.n = 0; } try { localStorage.setItem('womo-pinfehler', JSON.stringify(sp)); } catch {} document.getElementById('msg').innerHTML = `<div class="fehler">Passwort für ${h(D.personen[id].name)} falsch (Gross- und Kleinschreibung beachten). Name oben richtig gewählt?</div>`; }
  };
  document.getElementById('ok').onclick = los;
  document.getElementById('pin').onkeydown = (e) => { if (e.key === 'Enter') los(); };
}

// ---------- Rahmen mit Kopfleiste und Tab-Leiste ----------
const ICON = {
  kalender: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  fahrten: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4v2h6V4M9 13l2 2 4-4"/>',
  kosten: '<circle cx="12" cy="12" r="9.500"/><text x="12" y="14.800" text-anchor="middle" font-size="7.200" font-weight="800" font-family="-apple-system,Helvetica,Arial,sans-serif" fill="currentColor" stroke="none">CHF</text>',
  termine: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4"/>',
  unterwegs: '<path d="M3 20 12 5l9 15zM12 5v15M9 20l3-6 3 6"/>',
  vertrag: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
  wunschliste: '<path d="M12 3l2.600 5.600 6.100.700-4.500 4.200 1.200 6L12 16.600 6.600 19.500l1.200-6L3.300 9.300l6.100-.700z"/>',
};
// Der Tab «Wunschliste» heisst in der Leiste «Familienrat» (7 Tabs, sonst ist die Beschriftung zu breit). Die Seite heisst «Wunschliste».
const TABS = [['kalender', 'Kalender'], ['termine', 'Termine'], ['fahrten', 'Fahrten'], ['kosten', 'Kosten'], ['wunschliste', 'Familienrat'], ['unterwegs', 'Unterwegs'], ['vertrag', 'Vertrag']];
const SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ORTE = [
  ['u1', '<path d="M3 20 12 5l9 15zM12 5v15M9 20l3-6 3 6"/>', 'Campingplätze', 'Organisierte Campingplätze mit Strom und Sanitär', 'Sicher, Strom und Sanitär vorhanden', [
    ['Verbände und Clubs', [['TCS Camping (CH)', 'https://www.tcs.ch/de/camping-reisen/camping/'], ['Swisscamps (CH)', 'https://www.swisscamps.ch/de'], ['ADAC PiNCAMP (DE)', 'https://www.pincamp.de/'], ['Deutscher Camping-Club (DE)', 'https://camping-club.de/'], ['Österr. Camping Club (AT)', 'https://www.campingclub.at/'], ['Camping and Caravanning Club (UK)', 'https://www.campingandcaravanningclub.co.uk/'], ['ACS Camping Card (CH)', 'https://www.acs.ch/en/mitgliedschaft/clubleistungen/camping-card.php']]],
    ['Dachverbände Europa', [['EFCO & HPA (Verband der Campingwirtschaft)', 'https://www.efcohpa.eu/'], ['FICC (Camping-Weltverband)', 'https://ficc.org/en/'], ['Camping Key Europe', 'https://en.service.camping.se/guide/information-about-camping-key-europe'], ['Ratgeber: Verbände und Ketten (promobil)', 'https://www.promobil.de/stellplaetze/campingplatz-organisationen-ketten-verbaende-bonussystem-mehrwert/']]],
    ['Gruppen und Ketten', [['Leading Campings of Europe', 'https://www.leadingcampings.com/de/'], ['Les Castels (FR)', 'https://www.les-castels.com/'], ['Huttopia', 'https://europe.huttopia.com/'], ['Top Camping Austria', 'https://www.topcamping.at/']]],
    ['Rabattkarten und Führer', [['ACSI CampingCard', 'https://www.campingcard.com/'], ['ADAC Campcard', 'https://www.pincamp.de/campingthemen/adac-campcard'], ['ADAC Campingführer', 'https://www.adac.de/services/buecher-magazine/campingfuehrer/']]],
    ['Suchportale', [['ACSI Eurocampings', 'https://www.eurocampings.de/'], ['camping.info', 'https://www.camping.info/de'], ['camping.ch (CH)', 'https://camping.ch/'], ['NorCamp (Skandinavien)', 'https://www.norcamp.de/'], ['StayFree (Camping, Stellplätze, frei)', 'https://www.stayfree.app/'], ['park4night (Camping, Stellplätze, frei)', 'https://park4night.com/en']]]]],
  ['u2', '<defs><mask id="womoM"><rect width="24" height="24" fill="#fff"/><g fill="#000"><rect x="4.7" y="6.6" width="2.9" height="1.3" rx=".3"/><path d="M4.1 12.6 5.3 10.3H8.1V12.6Z"/><rect x="16.2" y="8.7" width="3.1" height="2.7" rx=".3"/><rect x="10.7" y="9.2" width="3.3" height="5.9" rx=".3"/><circle cx="5.2" cy="16.3" r="2.6"/><circle cx="17.2" cy="16.3" r="2.6"/></g></mask></defs><path mask="url(#womoM)" d="M2.6 5.6H15.2L17 6.4H22.4Q22.8 6.4 22.8 6.8V15.6H1.2V13.6L3.4 12.8 5.2 9.8 3 10Q1.4 10 1.4 8.6V6.8Q1.4 5.6 2.6 5.6Z"/><circle cx="5.2" cy="16.3" r="1.8"/><circle cx="17.2" cy="16.3" r="1.8"/>', 'Offizielle Stellplätze', 'Gemeinden, Städte, Häfen, Thermen, Freizeitparks, Bergbahnen', 'Nur ausgewiesene Plätze, Platzregeln beachten', [
    ['Stellplatz-Apps und Verzeichnisse', [['Wohnmobilland (CH)', 'https://www.womoland.ch/'], ['stellplatz.info', 'https://stellplatz.info/'], ['Campercontact', 'https://www.campercontact.com/de'], ['promobil Stellplatz-Atlas', 'https://www.promobil.de/stellplaetze/'], ['Stellplatz-Radar-App (promobil)', 'https://www.promobil.de/stellplatz-radar'], ['CaraMaps', 'https://www.caramaps.com/'], ['Camping-App.eu', 'https://camping-app.eu/'], ['Bordatlas (Europa)', 'https://bordatlas.de/'], ['Searchforsites', 'https://www.searchforsites.co.uk/'], ['iOverlander', 'https://ioverlander.com/'], ['StayFree (Camping, Stellplätze, frei)', 'https://www.stayfree.app/'], ['park4night (Camping, Stellplätze, frei)', 'https://park4night.com/en']]],
    ['Autohöfe in Deutschland', [['Artikel: Übernachten auf Autohöfen (promobil)', 'https://www.promobil.de/uebernachtungstipps/auf-vielen-deutschen-autohoefen-kann-man-mit-dem-camper-guenstig-uebernachten/'], ['Websuche: Autohof Wohnmobil übernachten', 'https://www.google.com/search?q=' + encodeURIComponent('Autohof Wohnmobil übernachten Stellplatz')]], 'In Deutschland gibt es rund 230 Autohöfe direkt an Autobahnausfahrten, etwa die Hälfte erlaubt Wohnmobilen das Übernachten. Kosten: 0 bis 25 Euro pro Nacht, bezahlt wird meist an der Tankstelle, Strom gibt es selten. In stellplatz.info und Campercontact (oben) einfach nach «Autohof» suchen.'],
    ['Parkplatz-Apps (nur, wo erlaubt)', [['EasyPark', 'https://easypark.com/de-ch']]]]],
  ['u3', '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 11v10"/><path fill="currentColor" d="M17 3c-2.300 1.600-3 4.600-3 8h3z"/>', 'Gasthöfe, Restaurants, Hotels', 'Stellplatz auf dem Parkplatz des Betriebs', 'Vorher fragen, oft gratis bei Konsumation', null],
  ['u4', '<path d="M8.200 6.500c1-.6 2.400-.9 3.800-.9s2.800.3 3.800.9l1 4.500c.3 1.800-.2 3.600-1.200 5.200H8.400C7.400 14.600 6.900 12.800 7.200 11z"/><path d="M8.300 6.600C7.500 5 6 4.300 4.800 4.800M15.700 6.600C16.500 5 18 4.300 19.200 4.800"/><path d="M7.300 9.300 3.200 8.300c-.9 1.300.2 3.200 4 3.600M16.700 9.300l4.100-1c.9 1.300-.2 3.200-4 3.600"/><path d="M8.400 15.800c-.3 2.700 1.200 4.700 3.600 4.700s3.900-2 3.600-4.700"/><circle cx="9.800" cy="11" r=".75" fill="currentColor" stroke="none"/><circle cx="14.200" cy="11" r=".75" fill="currentColor" stroke="none"/><circle cx="10.400" cy="18" r=".6" fill="currentColor" stroke="none"/><circle cx="13.600" cy="18" r=".6" fill="currentColor" stroke="none"/><path d="M11 5.700c.4-.9 1.600-.9 2 0"/>', 'Bauernhöfe, Winzer, Private', 'Auch Bekannte und Verwandte mit Garten oder Parkplatz', 'Meist einfach, dafür ruhig. Vorab anfragen', [
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
  app.innerHTML = rahmen(`${seitenkopf('Unterwegs')}<div class="u-ban slim"><span class="u-bic">${SVG('<circle cx="12" cy="12" r="10"/><path d="M6.5 15.5V9M6.5 13h11v2.5M17.5 15.5v-2a2 2 0 0 0-2-2H11v2"/><circle cx="9" cy="11" r=".6"/><path d="M5 5l14 14"/>')}</span>
    <div><strong>Keine Übernachtung auf Autobahnraststätten</strong></div></div>
  ${orteKarte()}
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
  <p class="info" style="text-align:center;margin:4px 20px 0">Angebote, Preise und Regeln ändern sich. Vor der Reise prüfen. Die Liste ist eine Auswahl, keine Zusicherung.</p>
  <button class="gross-btn" id="nf_edit" style="width:100%;margin-top:14px;min-height:46px;font-size:14px">SOS-Karte: Angaben ändern</button>`);
  bindRahmen(); bindNotfallOrte();
}
const VERTRAG_REGELN = [
  ['Nutzungszeit (Ziffer 7 a)', ['Jede/r Eigentümer/in hat ein Viertel der Nutzungszeit pro Kalenderjahr: Tochter und Sohn je 92 Tage, Vater und Mutter zusammen die übrigen Tage, höchstens 181 Tage.', 'Gezählt wird in Tagen pro Kalenderjahr. Jeder angebrochene Tag zählt voll, Abreise- und Rückkehrtag beide.', 'Wer im Fahrzeug sitzt, zählt, auch wer nur mitreist. Sitzen Vater oder Mutter mit Tochter oder Sohn im Fahrzeug, zählen die Tage nur für Vater und Mutter.', 'Reisen Tochter und Sohn zusammen ohne Vater und Mutter, werden die Tage je zur Hälfte auf beide verteilt. Bei einer ungeraden Zahl trägt jedes Kind einen halben Tag mehr (7 Tage: je 3.5 Tage).', 'Ungenutzte Tage verfallen am Jahresende, kein Übertrag.', 'Nutzungstage dürfen innerhalb des Kalenderjahres abgetreten werden, in der App nur von den Eltern an beide Kinder zugleich: Nanouk und Nene bekommen je gleich viele Tage dazu, die Konten von HP und Nora sinken je um dieselbe Zahl. Die Höchstgrenze von 181 Tagen für Vater und Mutter bleibt. Die App erfasst das im Kalender unter «Nutzungstage abtreten».', 'Im Dezember werden die Ferienwochen des Folgejahres besprochen. Wochenenden können kurzfristig über die App reserviert werden.', 'Kollisionen werden im gemeinsamen Gespräch gelöst, mit Rücksicht auf berufliche Bindungen wie Schulferien. Bei Gleichstand über eine Reservierung entscheidet das Los.', 'Übernahme und Rückgabe immer zu Hause in Chur.']],
  ['Verbot (Ziffer 7 b)', ['Das Fahrzeug wird nicht verliehen oder vermietet.', 'Wer gegen das Verleih-, Rauch- oder Tierverbot verstösst, zahlt Reinigung und Schaden voll (Ziffer 12 g).']],
  ['Alltagsfahrten der Eltern (Ziffer 7 c)', ['Vater und Mutter dürfen das Fahrzeug auch privat im Alltag nutzen. Alltagsfahrten müssen nicht reserviert werden.', 'Vater und Mutter nutzen das Fahrzeug erst dann für Alltagsfahrten, wenn sie den Skoda nicht mehr einlösen.', 'Jeder Tag mit mindestens einer Alltagsfahrt zählt als ein Tag im gemeinsamen Konto von Vater und Mutter. Mehrere Fahrten am selben Tag zählen einen Tag.', 'Reisetage und Alltagstage zusammen betragen für Vater und Mutter höchstens 181 Tage pro Kalenderjahr.', 'Datum und gefahrene Kilometer jeder Alltagsfahrt werden in der App eingetragen.', 'Reisen gehen Alltagsfahrten immer vor, Reisen der Eltern wie der Kinder. An reservierten Tagen gibt es keine Alltagsfahrt.']],
  ['Wer fährt (Ziffer 8)', ['Wer fährt, trinkt nicht. Alkoholisiertes Fahren mit dem Fahrzeug ist verboten. Die Folgen trägt der/die Fahrende.', 'Grundsätzlich fahren nur die Eigentümer/innen. Partner, Freunde und Enkel reisen mit, fahren aber nicht. Insgesamt reisen höchstens 4 Personen.', 'Der Familienrat (alle vier Eigentümer/innen) kann vor der Reise im Einzelfall eine Person zum Fahren freigeben, wenn Versicherung, Führerausweis, Fahrerfahrung und Haftung geklärt sind. In der App: Tab «Fahrten», Abschnitt «Fahrerfreigabe». Es braucht 3 von 4 Stimmen, Schweigen gilt nicht als Ja.', 'Bei jeder Fahrt reist mindestens ein/e Eigentümer/in mit, auch bei freigegebenen Fahrern.', 'Wer Mitreisende mitnimmt, informiert sie über Rauch- und Tierverbot und trägt Schäden am Fahrzeug, die sie verursachen (Ziffer 12 f).']],
  ['Bussen (Ziffer 12 b und e)', ['Bussen und Strafen trägt der/die fahrende Eigentümer/in.', 'Parkbussen und Radarbussen, bei denen der Halter belangt wird, zahlt der Vater zuerst. Der Fahrer ersetzt sie innert 30 Tagen (der Fahrer ergibt sich aus der Reservierung in der App).']],
  ['Entscheide und Patt (Ziffer 13)', ['Alltagsentscheide brauchen die qualifizierte Mehrheit: alle Stimmen ausser einer, bei vier Eigentümer/innen also 3 zu 1. Bei Gleichstand ist das Geschäft abgelehnt.', 'Pflichtmassnahmen (MFK, Haftpflichtversicherung, sicherheitsrelevante Reparaturen) gelten mit dem Vertrag als beschlossen. Bei Gleichstand über eine Reservierung entscheidet das Los. Bei anderem Gleichstand bleibt die bisherige Regelung, nach 2 Wochen folgt die Mediation.']],
  ['Reiseregeln (Ziffer 9)', ['Erlaubt: Schweiz, Westeuropa, Nordeuropa, Tschechien, Polen, Baltikum, Ungarn, Slowenien bis Griechenland mit Kroatien, Bosnien-Herzegowina, Montenegro, Albanien, Nordmazedonien, Slowakei, Bulgarien, Irland, Grossbritannien, Zypern, Malta.', 'Verboten: andere Kontinente, Serbien, Türkei, Rumänien und ex-russische Staaten ausser dem Baltikum. Streng verboten: Russland, Ukraine, Weissrussland und Moldau.', 'Auf Autobahnraststätten wird aus Sicherheitsgründen nicht übernachtet. Mögliche Plätze zeigt «Unterwegs».', 'Winter: Im Winter wird nur Richtung Süden mit sehr tiefer Schneewahrscheinlichkeit gefahren. Das Fahrzeug hat weder Allrad noch ist es speziell winterfest.', 'Rauchen und Tiere im Fahrzeug sind verboten.']],
  ['Sauberkeit und Übernahme (Ziffer 10)', ['Das Fahrzeug soll immer sauber übernommen werden können. Wer es zuvor gefahren hat, reinigt es und gibt es sauber zurück.', 'Das Fahrzeug wird IMMER mit vollem Tank zurückgegeben. Wer es zuletzt gefahren hat, tankt es vor der Rückgabe voll und trägt den Tankstand in die Checkliste ein.', 'Bei jeder Übernahme und Rückgabe wird die Checkliste in der App (Fahrten) ausgefüllt.', 'Gibt jemand das Fahrzeug nicht voll zurück, trägt er/sie Tankstand und Grund in die Checkliste ein. Die App warnt alle. Voll tankt, wer das Fahrzeug als Nächster benützt. Die Person, die nicht voll zurückgab, bezahlt den Treibstoff gegen Tankbeleg und zusätzlich einen Zuschlag von CHF 10. Bei Wiederholung berät der Familienrat.']],
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
    <div class="kopfr"><a class="sos" href="notfall.html?v=${VER}" aria-label="Notfall: Notfallkarte öffnen">SOS</a><button class="chip" id="aus" title="Menü: Darstellung, Person wechseln" aria-haspopup="dialog">${avatar(ich)}${h(D.personen[ich].name)}</button></div></div>
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
  app.querySelectorAll('[data-neu]').forEach((b) => b.onclick = () => { tab = b.dataset.neu; if (b.dataset.fa) famAnsicht = b.dataset.fa; schliessen(); zeige(); window.scrollTo(0, 0); });
}
// ---------- Hell, Dunkel oder Auto (folgt dem Handy) ----------
const THEMA_NAME = { auto: 'Auto', hell: 'Hell', dunkel: 'Dunkel' };
function themaLesen() { try { const t = localStorage.getItem('womo-theme'); return t === 'hell' || t === 'dunkel' ? t : 'auto'; } catch { return 'auto'; } }
function themaSetzen(t) {
  try { if (t === 'auto') localStorage.removeItem('womo-theme'); else localStorage.setItem('womo-theme', t); } catch {}
  const r = document.documentElement; if (t === 'hell') r.setAttribute('data-theme', 'light'); else if (t === 'dunkel') r.setAttribute('data-theme', 'dark'); else r.removeAttribute('data-theme');
}
// ---------- Abmeldung nach 30 Minuten ohne Benutzung ----------
// Danach ist die Anmeldung nötig. Die Seite wird dabei neu geladen, so holt jede/r die aktuelle Version.
const INAKTIV_MS = 30 * 60 * 1000;
function aktivMerken() { try { localStorage.setItem('womo-aktiv', String(Date.now())); } catch {} }
function abgelaufen() { try { const t = +localStorage.getItem('womo-aktiv') || 0; return !t || Date.now() - t > INAKTIV_MS; } catch { return false; } }
function inaktivPruefen() {
  if (!ich || !abgelaufen()) return;
  besuchMerken(); ich = null; seit = ''; try { sessionStorage.removeItem('womo-ich'); } catch {}
  location.reload();
}
let aktivT = 0;
['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((ev) => addEventListener(ev, () => { if (ich && Date.now() - aktivT > 5000) { aktivT = Date.now(); aktivMerken(); } }, { passive: true, capture: true }));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') inaktivPruefen(); });
addEventListener('pageshow', inaktivPruefen);
setInterval(inaktivPruefen, 30000);
function bindRahmen() {
  document.getElementById('aus').onclick = (e) => {
    e.preventDefault();
    sheet(`<h3>${h(D.personen[ich].name)}</h3>
    <div class="t-akt2"><button class="gross-btn" id="m_thm" type="button">Darstellung: ${THEMA_NAME[themaLesen()]}</button>
    <p class="info" style="margin:0">Darstellung antippen: Auto, Hell, Dunkel.</p>
    <button class="gross-btn" id="m_ich" type="button">Person wechseln</button>
    <button class="gross-btn" id="abb" type="button">Schliessen</button></div>`);
    document.getElementById('abb').onclick = schliessen;
    document.getElementById('m_thm').onclick = (ev) => { const f = ['auto', 'hell', 'dunkel']; const n = f[(f.indexOf(themaLesen()) + 1) % 3]; themaSetzen(n); ev.currentTarget.textContent = 'Darstellung: ' + THEMA_NAME[n]; };
    document.getElementById('m_ich').onclick = () => { schliessen(); besuchMerken(); ich = null; seit = ''; try { sessionStorage.removeItem('womo-ich'); } catch {} zeige(); };
  };
  app.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.t; schliessen(); zeige(); window.scrollTo(0, 0); });
}

// Hinweise oben im Kalender: Zahlungsverzug, Tank, Zahlungen (Termine stehen nur unter dem Kalender)
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
  // Fahrerfreigabe: was auf dich wartet
  fahrFreigaben().forEach((f) => { const st = fahrStandVon(f); if (st.status === 'offen' && f.erfasstVon !== ich && !st.antworten[ich]) out += `<div class="hinweiskarte gelb" data-neu="wunschliste" data-fa="fahrer" style="cursor:pointer">🚐 Fahrerfreigabe: ${h(f.person)} soll vom ${fmt(f.von)} bis ${fmt(f.bis)} fahren. Deine Antwort fehlt.</div>`; });
  // Fragen: was auf deine Antwort wartet (ein Tipp öffnet die Rubrik)
  frageListe().forEach((f) => {
    const st = frageStandVon(f), von = h(D.personen[f.erfasstVon]?.name || '?');
    if (st.status !== 'offen') return;
    if (f.erfasstVon !== ich && !st.antworten[ich]) out += `<div class="hinweiskarte ${st.ueberfaellig ? 'rot' : 'gelb'}" data-neu="wunschliste" data-fa="fragen" style="cursor:pointer">❓ Frage von ${von}: «${h(f.titel)}» wartet auf deine Antwort${st.ueberfaellig ? ' (Frist abgelaufen)' : ' bis ' + fmt(st.frist)}.</div>`;
    else if (f.erfasstVon === ich && st.ueberfaellig) out += `<div class="hinweiskarte rot" data-neu="wunschliste" data-fa="fragen" style="cursor:pointer">❓ Deine Frage «${h(f.titel)}» ist überfällig. Es fehlt die Antwort von ${st.ohneAntwort.map((i) => h(D.personen[i].name)).join(', ')}. Tippe, um zu erinnern.</div>`;
  });
  // Wunschliste: was auf dich wartet (ein Tipp öffnet den Tab)
  wunschListe().forEach((w) => {
    const st = wunschStandVon(w), titel = `«${h(w.titel)}» (${wunschPreisText(w)})`;
    const karte = (kl, text) => { out += `<div class="hinweiskarte ${kl}" data-neu="wunschliste" data-fa="wunsch" style="cursor:pointer">⭐ Wunschliste: ${text}</div>`; };
    if (st.status === 'offen' && w.erfasstVon !== ich && !st.antworten[ich]) karte('gelb', `${titel} wartet auf deine Antwort bis ${fmt(st.frist)}.`);
    else if (st.status === 'freigegeben' && w.erfasstVon === ich) karte('ok', `${titel} ist freigegeben, du kannst kaufen.`);
    else if (st.status === 'gekauft' && buchhalter() && !st.erstattet) karte('gelb', `${titel}: CHF ${chf(w.gekauftBetrag)} an ${h(D.personen[w.erfasstVon]?.name || '?')} erstatten.`);
  });
  if (buchhalter()) { const zb = zuBuchen(D.wuensche, D.wunschaktionen, D.journal, D.personen); if (zb.length) out += `<div class="hinweiskarte gelb" data-neu="kosten" style="cursor:pointer">📒 Buchhaltung: ${zb.length} ${zb.length === 1 ? 'Wunschbuchung ist' : 'Wunschbuchungen sind'} noch zu buchen.</div>`; }
  return out;
}

// =====================================================================
// Kalender (Version 1)
// =====================================================================
function ringe(J) {
  const st = kontostaendeMitAlltag(liste(), D.personen, J, alltagMap(), D.buchungen);
  const sw = schwellen(tauschMap(), J);
  const U = 2 * Math.PI * 32;
  return `<div class="karte"><p class="titel">Tageskonto ${J}</p><div class="ringe">` +
    Object.keys(SCHWELLE).map((k) => {
      const t = st[k], s = stufe(t, k, sw[k]), pr = Math.min(1, t / sw[k]);
      const farbe = s === 'rot' ? 'var(--rot)' : s === 'gelb' ? 'var(--gelb)' : k === 'eltern' ? 'url(#gEltern)' : FARBE[k];
      const sub = s === 'rot' ? 'überschritten' : s === 'gelb' ? 'bald erreicht' : `von ${zahl(sw[k])} Tagen`;
      const sub2 = k === 'eltern' && st.alltag ? `<div class="sub">davon Alltag ${st.alltag}</div>` : '';
      const dl = sw[k] - SCHWELLE[k], sub3 = dl ? `<div class="sub">${dl > 0 ? '+' : '−'}${zahl(Math.abs(dl))} abgetreten</div>` : '';
      return `<div class="ring ${s}"><svg viewBox="0 0 76 76">${k === 'eltern' ? '<defs><linearGradient id="gEltern" gradientUnits="userSpaceOnUse" x1="70" y1="38" x2="6" y2="38"><stop offset="0" stop-color="#f97316"/><stop offset="1" stop-color="#7dd3fc"/></linearGradient></defs>' : ''}<circle class="bg" cx="38" cy="38" r="32"${k === 'eltern' ? ' style="stroke:url(#gEltern);opacity:.4"' : ''}/><circle class="fg" cx="38" cy="38" r="32" stroke="${farbe}" stroke-dasharray="${(pr * U).toFixed(1)} ${U.toFixed(1)}"/></svg>
      <div class="zahl">${t}</div><div class="name">${KONTO_NAME[k]}</div><div class="sub">${sub}</div>${sub2}${sub3}</div>`;
    }).join('') + '</div></div>';
}

// Feiertage im angezeigten Monat (Text unter dem Kalender, auf dem Handy gibt es kein Schweben mit dem Finger).
function feiertageMonat(J, M, n) {
  const von = iso(J, M, 1), bis = iso(J, M, n);
  const l = feiertage(J).filter((f) => f.von <= bis && f.bis >= von);
  if (!l.length) return '';
  const tm = (d) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`;
  return `<div class="fe-zeile">${l.map((f) => `<span><b>${h(f.name)}</b> ${f.von === f.bis ? tm(f.von) : tm(f.von) + '–' + tm(f.bis)}</span>`).join('')}</div>`;
}
// Fairness-Gedaechtnis: wer hatte wie oft welchen Feiertagsblock (aus allen Reservierungen berechnet, ueber alle Jahre).
function feiertagKarte() {
  const ids = idsGeordnet().filter((i) => D.personen[i]);
  const st = feiertagStatistik(liste(), D.personen);
  const nx = naechsterFeiertag(heute());
  let nxZeile = '';
  if (nx) {
    const sb = seltenstBlock(st, nx.id, ids);
    const wer = sb.ids.map((i) => h(D.personen[i].name)).join(' und ');
    nxZeile = `<p class="info" style="margin:0 0 10px"><strong>Als Nächstes: ${h(nx.name)} ${nx.von.slice(0, 4)}</strong> (${fmt(nx.von)}${nx.von === nx.bis ? '' : ' bis ' + fmt(nx.bis)}).<br>${st.jahre.length === 0 ? 'Noch keine Reservierung erfasst.' : sb.alleGleich ? 'Bisher hatten alle diesen Feiertag gleich oft.' : `Bisher am seltensten: <strong>${wer}</strong>. Bei Gleichstand ist diese Person zuerst dran.`}</p>`;
  }
  const kopf = `<tr><th></th>${ids.map((i) => `<th><i class="punkt ${PERSON_FARBE[i] || ''}"></i>${h(D.personen[i].name)}</th>`).join('')}</tr>`;
  const zeilen = FEIERTAGE.map((f) => {
    const mal = ids.map((i) => st.je[i][f.id].mal), min = Math.min(...mal), gleich = mal.every((x) => x === min);
    const istNx = !!nx && nx.id === f.id;
    return `<tr${istNx ? ' class="nx"' : ''}><th>${h(f.name)}${istNx ? '<small class="nx-m">als Nächstes</small>' : ''}</th>${ids.map((i, k) => { const z = st.je[i][f.id]; return `<td class="${istNx && !gleich && mal[k] === min ? 'dran' : ''}"${z.jahre.length ? ` title="${h(f.name)}: ${z.jahre.join(', ')}"` : ''}><b>${z.mal}</b>${z.zuletzt ? `<small>${z.zuletzt}</small>` : ''}</td>`; }).join('')}</tr>`;
  }).join('');
  const sum = `<tr class="sum"><th>Feiertage zusammen</th>${ids.map((i) => `<td><b>${st.total[i].mal}</b></td>`).join('')}</tr><tr class="sum"><th>Feiertagstage</th>${ids.map((i) => `<td><b>${st.total[i].tage}</b></td>`).join('')}</tr>`;
  const von = st.jahre.length ? (st.jahre[0] === st.jahre[st.jahre.length - 1] ? `Erfasst: ${st.jahre[0]}.` : `Erfasst: ${st.jahre[0]} bis ${st.jahre[st.jahre.length - 1]}.`) : '';
  return `<details class="sek"><summary><span>Feiertage: wer hatte wie oft?</span></summary><div class="sek-in">${nxZeile}
    <div class="ff-wrap"><table class="ff-tab">${kopf}${zeilen}${sum}</table></div>
    <p class="info" style="margin:10px 0 0">Grosse Zahl = wie oft, kleine Zahl = zuletzt im Jahr. Grün hinterlegt = beim nächsten Feiertag bisher am seltensten. Es zählt, wer an mindestens einem Tag des Feiertags im Fahrzeug sass oder sitzen wird (Fahrer und Mitreisende), egal ob schon gefahren oder erst reserviert. ${von} Die App rechnet das aus allen Reservierungen und merkt es sich darum über alle Jahre, solange die Reservierungen bestehen. Reisen vor dem Start der App fehlen.</p></div></details>`;
}

// «Nicht verfuegbar»: Stoppsignal im Tag. Eigener Eintrag = grosses rotes Signal, Eintraege der anderen = kleines graues Signal mit Namen.
const STOPP = (kl) => `<svg class="stopp ${kl}" viewBox="0 0 24 24" aria-hidden="true"><polygon points="8,1.500 16,1.500 22.500,8 22.500,16 16,22.500 8,22.500 1.500,16 1.500,8"/><rect x="6" y="10" width="12" height="4" rx="1"/></svg>`;
function minusZelle(d) {
  const ids = minusAmTag(minusListe(), d).filter((i) => D.personen[i]);
  if (!ids.length) return '';
  const eigen = ids.includes(ich), andere = ids.filter((i) => i !== ich);
  const tip = 'Nicht verfügbar: ' + ids.map((i) => D.personen[i].name).join(', ');
  const kl = andere.length ? `<span class="mn">${STOPP('grau')}${eigen ? andere.length : andere.length + '×'}</span>` : '';
  return `<span class="mi${eigen ? ' eigen' : ''}" title="${h(tip)}">${eigen ? STOPP('rot gross') : ''}${kl}</span>`;
}
function minusKarte(J, M, n) {
  const von = iso(J, M, 1), bis = iso(J, M, n);
  const L = minusListe().filter((x) => x.von <= bis && x.bis >= von).sort((a, b) => (a.von < b.von ? -1 : a.von > b.von ? 1 : 0));
  const bereich = (x) => reiseText(x, true);
  return `<div class="karte"><p class="titel">Kein Bedarf am Wohnmobil</p>
  <p class="info" style="margin:0 0 8px">Hier siehst du, wer an welchen Tagen kein Bedarf am Wohnmobil hat. Jede Person trägt nur für sich selbst ein. Es ist nur ein Hinweis, die Tage zählen nicht im Tageskonto.</p>
  ${L.length ? L.map((x) => `<div class="b" style="padding:8px 0"><span style="flex:none;margin-top:1px">${STOPP(eigener(x) ? 'rot gross' : 'grau gross')}</span><div class="inhalt"><div class="zeit" style="font-size:15px">${h(D.personen[x.personId]?.name || '?')}: ${bereich(x)}${neuPille(x)}</div>${x.grund ? `<div class="meta">${h(x.grund)}</div>` : ''}</div>${eigener(x) ? `<button class="kl" data-medit="${h(x.id)}">Ändern</button>` : ''}</div>`).join('') : '<p class="leer-t">Niemand hat sich für diesen Monat eingetragen.</p>'}
  <div class="aktion" style="margin-top:10px"><button class="primaer" id="minusneu">Ich habe kein Bedarf an diesem Datum</button></div></div>`;
}
function minusForm(ex) {
  const start = ex ? ex.von : heute();
  sheet(`<h3>${ex ? 'Eintrag ändern' : 'Ich habe kein Bedarf an diesem Datum'}</h3>
  <p class="info" style="margin:0 0 4px">Für ${h(D.personen[ich].name)}. Alle sehen den Eintrag. Wenn du an diesen Tagen reservieren willst, warnt dich die App.</p>
  <div class="zwei"><div><label for="mi_von">Von</label><input type="date" id="mi_von" value="${h(start)}"></div>
  <div><label for="mi_bis">Bis (einschliesslich)</label><input type="date" id="mi_bis" value="${h(ex ? ex.bis : start)}"></div></div>
  <label for="mi_grund">Grund (optional)</label><input id="mi_grund" maxlength="80" placeholder="z. B. Arbeit, Familienfest" value="${h(ex?.grund || '')}">
  <div id="msg"></div>
  <div class="aktion">${ex ? '<button id="mdel">Löschen</button>' : ''}<button id="abb">Abbrechen</button><button class="primaer" id="spei">Speichern</button></div>`);
  const md = document.getElementById('mdel'); if (md) md.onclick = async () => { if (!eigener(ex)) return nurEigene(); if (confirm('Diesen Eintrag «nicht verfügbar» löschen?')) await sicher(async () => { await S.loeschen(D, 'termine', ex.id); schliessen(); kalender(); hinweis('Eintrag gelöscht.'); }); };
  const vonEl = document.getElementById('mi_von'), bisEl = document.getElementById('mi_bis');
  vonEl.onchange = () => { if (!bisEl.value || bisEl.value < vonEl.value) bisEl.value = vonEl.value; };
  document.getElementById('abb').onclick = schliessen;
  document.getElementById('spei').onclick = async () => {
    const m = { von: val('mi_von'), bis: val('mi_bis') || val('mi_von'), grund: val('mi_grund').trim(), personId: ich };
    const p = pruefeMinus(m, D.personen);
    if (!p.ok) { fehler(p.fehler); return; }
    await sicher(async () => {
      await S.speichern(D, 'termine', ex ? ex.id : null, { ...(ex || {}), art: 'Minus', titel: 'Nicht verfügbar', faelligAm: m.von, erledigtAm: '', ...m, erfasstVon: ex ? ex.erfasstVon : ich });
      ansicht = new Date(m.von + 'T12:00:00'); schliessen(); kalender(); hinweis('Eintrag gespeichert.');
    });
  };
}

const GLOCKE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4"/></svg>';
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
    const fe = feiertagAm(d);
    const cls = ['tag', wd >= 5 ? 'we' : '', fe ? 'fei' : '', hier.length > 1 ? 'koll' : '',
      d === tT ? 'heute' : ''].join(' ');
    zellen += `<div class="${cls}" data-d="${d}"${fe ? ` title="${h(fe.name)}"` : ''}><span class="nr">${t}</span>${minusZelle(d)}${terminTag[d] ? `<span class="tm ${['erledigt', 'offen', 'bald', 'ueberfaellig'][Math.max(...terminTag[d].map((x) => RANG[terminStufe(x, tT)]))]}" title="${h('Termin: ' + terminTag[d].map((x) => x.titel).join(', '))}">${GLOCKE}</span>` : ''}${hier.length ? `<span class="streifen">${hier.map((b) => `<i class="${farbKonto(b)}">${initial(D.personen[b.fahrerId]?.name || b.ausnahmeFahrer?.name)}</i>`).join('')}</span>` : ''}</div>`;
  }
  const monatsB = bs.filter((b) => b.von <= iso(J, M, n) && b.bis >= iso(J, M, 1)).sort((a, b) => a.von < b.von ? -1 : 1);
  const kolls = monatsB.filter((a, i) => monatsB.some((b, j) => i !== j && kollision(a, b)));
  const monatsT = termineEcht().filter((x) => x.faelligAm >= iso(J, M, 1) && x.faelligAm <= iso(J, M, n)).sort((a, b) => (a.faelligAm < b.faelligAm ? -1 : 1));
  const TCHIP = { ueberfaellig: ['rot', 'überfällig'], bald: ['gelb', 'bald fällig'], offen: ['', 'offen'], erledigt: ['ok', 'erledigt'] };
  app.innerHTML = rahmen(`${seitenkopf('Kalender', 'resneu', '＋ Reservieren')}${neuKarte()}${hinweiseHtml()}${ringe(J)}${tauschSek(J)}
  <div class="karte">
    <div class="monatskopf"><h2>${MONATE[M]} ${J}</h2><div class="nav"><button id="zu" aria-label="Voriger Monat">‹</button><button id="hj" class="heute-b">Heute</button><button id="vor" aria-label="Nächster Monat">›</button></div></div>
    <div class="woche">${['Mo','Di','Mi','Do','Fr','Sa','So'].map((x) => `<div>${x}</div>`).join('')}</div>
    <div class="monat">${zellen}</div>
    <div class="legende">${[['hp', 'HP'], ['nora', 'Nora'], ['kind-1', 'Nanouk'], ['kind-2', 'Nene']].map(([k, n]) => `<span><i class="punkt ${k}"></i>${n}</span>`).join('')}<span><i class="leg-fe"></i>Feiertag (Tag orange)</span><span><i class="leg-tm">${GLOCKE}</i>Termin</span><span>${STOPP("rot")}Ich habe kein Bedarf</span><span>${STOPP("grau")}Andere ohne Bedarf</span></div>
    ${feiertageMonat(J, M, n)}
    ${kolls.length ? `<div class="warn">Überschneidung im ${MONATE[M]}. Bitte im Gespräch lösen.</div>` : ''}
  </div>
  <div class="karte"><p class="titel">Termine im ${MONATE[M]}</p>${monatsT.length ? monatsT.map((x) => { const [c, txt] = TCHIP[terminStufe(x, tT)]; return `<div class="b" style="padding:8px 0"><span class="tm lt ${terminStufe(x, tT)}">${GLOCKE}</span><div class="inhalt"><div class="zeit" style="font-size:15px">${h(x.titel)}${neuPille(x)}</div><div class="meta">${fmt(x.faelligAm)} · <span class="chipk ${c}">${txt}</span></div></div></div>`; }).join('') : '<p class="leer-t">Keine Termine.</p>'}</div>
  ${feiertagKarte()}
  <div class="karte"><p class="titel">Reservierungen im ${MONATE[M]}</p>${monatsB.length ? monatsB.map(buchungHtml).join('') : '<p class="leer-t">Keine Reservierungen.</p>'}</div>
  ${minusKarte(J, M, n)}`);
  bindRahmen(); bindNeu(); bindTausch(J);
  const mn = document.getElementById('minusneu'); if (mn) mn.onclick = () => minusForm();
  app.querySelectorAll('[data-medit]').forEach((el) => el.onclick = () => { const x = D.termine[el.dataset.medit]; if (!eigener(x)) return nurEigene(); minusForm(x); });
  const tv = document.getElementById('tankvoll'); if (tv) tv.onclick = async () => { if (confirm('Der Tank ist jetzt voll?')) await sicher(async () => { await S.speichern(D, 'termine', null, { art: 'Tank', titel: 'Tank gefüllt', faelligAm: heute(), datumZeit: jetztLokal(), erledigtAm: heute(), erfasstVon: ich }); kalender(); hinweis('Danke, Tank als voll gemeldet.'); }); };
  document.getElementById('zu').onclick = () => { ansicht = new Date(J, M - 1, 1); kalender(); };
  document.getElementById('vor').onclick = () => { ansicht = new Date(J, M + 1, 1); kalender(); };
  document.getElementById('hj').onclick = () => { ansicht = new Date(); kalender(); };
  document.getElementById('resneu').onclick = () => formularZeigen('');
  app.querySelectorAll('.tag[data-d]').forEach((el) => el.onclick = () => { if (besetztMeldung(el.dataset.d)) return; formularZeigen(el.dataset.d); });
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

// Ein Tag, der schon zu einer Reservierung gehoert, ist besetzt (Randtage zaehlen mit): sofort melden, kein Formular.
function besetztMeldung(tag) {
  const x = liste().find((b) => b.von <= tag && tag <= b.bis);
  if (!x) return false;
  const wer = D.personen[x.fahrerId]?.name || x.ausnahmeFahrer?.name || '?';
  sheet(`<h3>Womo ist besetzt</h3>
  <div class="fehler">Am ${fmt(tag)} ist das Womo schon für ${h(wer)} reserviert (${fmt(x.von)} bis ${fmt(x.bis)}). Ein Tag kann nur einmal vergeben werden.</div>
  <div class="aktion"><button class="primaer" id="abb">OK</button></div>`);
  document.getElementById('abb').onclick = schliessen;
  return true;
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
  <div id="mhinw"></div>
  <div id="msg"></div>
  <div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="spei">${ex ? 'Änderung speichern' : 'Speichern'}</button></div>`);
  const f = document.getElementById('fahrer');
  // Nicht verfuegbar (Minus-Termine): eigene = Warnung, die der anderen = nur Info.
  const minusPruef = () => {
    const bb = { von: val('von'), bis: val('bis'), fahrerId: f.value || null, mitreisende: ids.filter((i) => document.getElementById('m' + i).checked && i !== f.value) };
    if (!bb.von || !bb.bis || bb.bis < bb.von) return { warnung: [], info: [] };
    return minusFuerReservierung(minusListe().filter((m) => D.personen[m.personId]), bb);
  };
  const minusText = (m) => `${h(D.personen[m.personId].name)}: ${m.von === m.bis ? fmt(m.von) : fmt(m.von) + ' bis ' + fmt(m.bis)}${m.grund ? ' (' + h(m.grund) + ')' : ''}`;
  const besetztHtml = () => {
    const bb = { id: ex?.id, von: val('von'), bis: val('bis') };
    if (!bb.von || !bb.bis || bb.bis < bb.von) return '';
    const u = ueberschneidungen(bb, liste());
    return u.length ? `<div class="fehler"><strong>Womo ist besetzt.</strong><br>${u.map((x) => `${fmt(x.von)} bis ${fmt(x.bis)}: ${h(D.personen[x.fahrerId]?.name || x.ausnahmeFahrer?.name || '?')}`).join('<br>')}</div>` : '';
  };
  const minusZeigen = () => {
    const r = minusPruef();
    document.getElementById('mhinw').innerHTML = besetztHtml() + (r.warnung.length ? `<div class="hinweiskarte gelb">⚠ Du hast dich für diese Tage als nicht verfügbar eingetragen:<br>${r.warnung.map(minusText).join('<br>')}</div>` : '') + (r.info.length ? `<p class="info" style="margin:8px 0 0">Info: Nicht verfügbar sind<br>${r.info.map(minusText).join('<br>')}</p>` : '');
  };
  ['von', 'bis', 'fahrer'].forEach((k) => { document.getElementById(k).addEventListener('change', minusZeigen); });
  document.getElementById('mit').addEventListener('change', minusZeigen);
  minusZeigen();
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
    const vs = vorschauBuchung(b, D.buchungen, D.personen, alltagMap(), tauschMap());
    const warn = [...vs.ueber.map((u) => `${KONTO_NAME[u.konto]} ${u.jahr}: ${u.tage} Tage, Schwelle ${u.schwelle}.`), ...(vs.entfallen.length ? [`Alltagsfahrten am ${vs.entfallen.map(fmt).join(', ')} zählen nicht mehr (Reisen gehen vor).`] : [])];
    const mw = minusFuerReservierung(minusListe().filter((m) => D.personen[m.personId]), b).warnung;
    if (mw.length) warn.push(...mw.map((m) => `${D.personen[m.personId].name} hat sich für ${m.von === m.bis ? fmt(m.von) : fmt(m.von) + ' bis ' + fmt(m.bis)} als nicht verfügbar eingetragen.`));
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
const ICON_ALK = '<circle cx="12" cy="12" r="10"/><path d="M8.500 6.500h7l-.6 4a2.900 2.900 0 0 1-5.800 0zM12 13.300V17.500M9.500 17.500h5"/><path d="M4.900 4.900l14.200 14.200"/>';
const ICON_RAUCH = '<circle cx="12" cy="12" r="10"/><path d="M5.500 14.500h9v3h-9zM12.500 14.500v3M16.500 14.500c0-1.500 1.500-1.500 1.500-3.200S16.500 9.700 16.500 8"/><path d="M4.900 4.900l14.200 14.200"/>';
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
  const ueKnopf = (b, ph, ex) => `<button class="btn ue" data-u="${h(b.id)}|${ph}">${ph === 'ab' ? 'Übernahme' : 'Rückgabe'}<br>${ueZweit(b.id, ph, ex)}</button>`;
  const n = kommend[0];
  let karte = `<div class="f-next"><span class="t-lab">Nächste Reise</span><span class="f-nt">Keine Reise geplant</span><span class="t-nd">Reservierungen machst du im Tab «Kalender».</span></div>`;
  if (n) {
    const f = fahrtInfo(n, st), laeuft = n.von <= t;
    karte = `<div class="f-next"><span class="t-lab">${laeuft ? 'Laufende Reise' : 'Nächste Reise'}</span><span class="f-nt">${reiseText(n)}</span>
      <span class="t-nd">${h(f.wer)}${n.ziel ? ' · ' + h(n.ziel) : ''}</span>
      <span class="t-pille ${laeuft ? 'gelb' : 'blau'}">${laeuft ? 'unterwegs' : `in ${nr(n.von) - nr(t)} ${nr(n.von) - nr(t) === 1 ? 'Tag' : 'Tagen'}`}</span>
      ${fahrtChips(f) ? `<span class="f-chips">${fahrtChips(f)}</span>` : ''}
      <div class="btnzeile zk" style="margin:14px 0 0">${ueKnopf(n, 'ab', f.ab)}${ueKnopf(n, 'rueck', f.rk)}</div></div>`;
  }
  const pilleFuer = (b) => {
    const f = fahrtInfo(b, st);
    if (b.bis < t) return f.fertigR ? ['ok', '✓ fertig'] : f.ab ? ['gelb', 'Rückgabe offen'] : ['rot', 'ohne Checkliste'];
    const d = nr(b.von) - nr(t); return ['blau', d <= 0 ? 'unterwegs' : `in ${d} ${d === 1 ? 'Tag' : 'Tagen'}`];
  };
  const zeile = (b) => { const f = fahrtInfo(b, st), [k, txt] = pilleFuer(b); return `<button class="t-z ${k}" data-reise="${h(b.id)}"><span class="t-sq blau"><svg viewBox="0 0 24 24" aria-hidden="true">${FAHRT_ICON}</svg></span><span class="t-zt"><strong>${reiseText(b, true)}${neuPille(b)}${neuPille(f.ab)}${neuPille(f.rk)}</strong><small>${h(f.wer)}${b.ziel ? ' · ' + h(b.ziel) : ''}</small></span><span class="t-pl ${k}">${txt}</span></button>`; };
  app.innerHTML = rahmen(`${seitenkopf('Fahrten', elternIch ? 'aneu' : null, '＋ Alltagsfahrt')}
  <div class="u-ban slim"><span class="u-bic">${SVG(ICON_ALK)}</span><div><strong>Fahren unter Alkohol ist verboten</strong></div></div>
  <div class="u-ban slim"><span class="u-bic">${SVG(ICON_RAUCH)}</span><div><strong>Rauchen und Tiere sind verboten</strong></div></div>
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
      <div class="t-akt2"><button class="gross-btn ue" id="f_ab">Übernahme<br>${ueZweit(b.id, 'ab', f.ab)}</button><button class="gross-btn ue" id="f_rk">Rückgabe<br>${ueZweit(b.id, 'rueck', f.rk)}</button><button class="gross-btn" id="abb">Schliessen</button></div>`);
    document.getElementById('abb').onclick = schliessen;
    document.getElementById('f_ab').onclick = () => uebergabeForm(b.id, 'ab');
    document.getElementById('f_rk').onclick = () => uebergabeForm(b.id, 'rueck');
  });
}

// Fahrerfreigabe fuer eine Drittperson (Vertrag Ziffer 8 und 13). Vorschlag und Antworten liegen in 'termine' (keine neue Datenbankregel noetig).
const fahrFreigaben = () => Object.values(D.termine).filter((x) => x.art === 'Fahrfreigabe');
const fahrAntworten = () => Object.values(D.termine).filter((x) => x.art === 'FahrAntwort');
const fahrStandVon = (f) => fahrfreigabeStand(f, fahrAntworten(), idsGeordnet(), heute());
const fahrKlasse = (st) => ({ offen: 'blau', freigegeben: 'ok', abgelehnt: 'rot', vorbei: 'blau' })[st];
function freigabeListe() {
  const L = fahrFreigaben().map((f) => ({ f, s: fahrStandVon(f) })).sort((a, b) => (a.f.von < b.f.von ? 1 : a.f.von > b.f.von ? -1 : 0));
  const dein = (e) => e.s.status === 'offen' && e.f.erfasstVon !== ich && !e.s.antworten[ich];
  return { L, dein, wartet: L.filter(dein).length, aktiv: L.filter((e) => e.s.status !== 'vorbei').length };
}
function fahrerSeite() {
  const { L, dein, wartet } = freigabeListe();
  const zeile = (e) => { const { f, s } = e, k = fahrKlasse(s.status);
    return `<button class="t-z ${k}" data-ff="${h(f.id)}"><span class="t-sq ${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${FAHRT_ICON}</svg></span><span class="t-zt"><strong>${h(f.person)}${dein(e) ? '<span class="neu gelb">Antwort fehlt</span>' : ''}</strong><small>${fmt(f.von).slice(0, 6)} bis ${fmt(f.bis).slice(0, 6)} · von ${h(D.personen[f.erfasstVon]?.name || '?')}</small></span><span class="t-pl ${k}">${FAHRFREIGABE_STATUS[s.status]}</span></button>`; };
  const gruppe = (titel, xs) => xs.length ? `<p class="t-lab2">${titel}</p>${xs.map(zeile).join('')}` : '';
  const dn = L.filter(dein), lauf = L.filter((e) => e.s.status === 'offen' && !dein(e));
  const frei = L.filter((e) => e.s.status === 'freigegeben'), abg = L.filter((e) => e.s.status === 'abgelehnt'), vor = L.filter((e) => e.s.status === 'vorbei');
  app.innerHTML = rahmen(`${seitenkopf('Fahrerfreigabe', 'ffneu', '＋ Freigabe')}${famSeg()}
    <div class="karte"><p class="info" style="margin:0">Es fahren nur die Eigentümer/innen (Ziffer 8). Soll im Einzelfall eine andere Person fahren, schlägt ein/e Eigentümer/in sie <strong>vor der Reise</strong> hier vor. Am besten, bevor du den Termin einträgst: Dann weisst du vorher, ob die Freigabe kommt.</p>
      <p class="info" style="margin:8px 0 0"><strong>Nötig sind 3 von 4 Stimmen.</strong> Wer vorschlägt, zählt als Ja. Schweigen gilt nicht als Ja. Bei 2 zu 2 ist die Freigabe abgelehnt. Sie gilt nur für die genannte Reise. Ein/e Eigentümer/in reist immer mit. Wer die Person fahren lässt, trägt im Schadenfall den Selbstbehalt und alle nicht versicherten Kosten.</p></div>
    ${L.length ? '' : '<div class="karte"><p class="leer-t" style="margin:6px 0">Noch keine Freigaben. Mit «＋ Freigabe» schlägst du eine Person als Fahrer/in vor.</p></div>'}${gruppe('Wartet auf deine Antwort', dn)}${gruppe('Antworten laufen', lauf)}${gruppe('Freigegeben', frei)}${gruppe('Abgelehnt', abg)}${gruppe('Reise vorbei', vor)}`);
  bindRahmen(); bindNeu(); bindSeg(); bindFreigabe();
}
function bindFreigabe() {
  const n = document.getElementById('ffneu'); if (n) n.onclick = freigabeForm;
  app.querySelectorAll('[data-ff]').forEach((b) => b.onclick = () => freigabeDetail(b.dataset.ff));
}
function freigabeForm() {
  const ids = idsGeordnet(), chk = (id, text) => `<span class="chk ja"><input type="checkbox" id="${id}"><label for="${id}">${text}</label></span>`;
  sheet(`<h3>Fahrerfreigabe vorschlagen</h3>
  <p class="info" style="margin:0 0 4px">Vor der Reise. Die anderen antworten, es braucht 3 von 4 Stimmen. Schweigen gilt nicht als Ja.</p>
  <label for="ff_p">Wer soll fahren? (Name)</label><input id="ff_p" maxlength="60" autocomplete="off">
  <label for="ff_b">Wer ist die Person?</label><input id="ff_b" maxlength="60" placeholder="z. B. Partner von Nanouk" autocomplete="off">
  <label for="ff_g">Grund</label><input id="ff_g" maxlength="150" placeholder="Warum soll diese Person fahren?" autocomplete="off">
  <div class="zwei"><div><label for="ff_v">Reise von</label><input type="date" id="ff_v" value="${heute()}"></div><div><label for="ff_t">bis</label><input type="date" id="ff_t" value="${heute()}"></div></div>
  <label for="ff_m">Welche/r Eigentümer/in reist im Fahrzeug mit?</label><select id="ff_m"><option value="">Bitte wählen</option>${ids.map((i) => `<option value="${i}">${h(D.personen[i].name)}</option>`).join('')}</select>
  <div class="zwei" style="align-items:start"><div><label for="ff_al">Jahrgang<br>der Person</label><input id="ff_al" style="height:54px" type="number" inputmode="numeric" min="1900" max="${new Date().getFullYear() - 18}" placeholder="z. B. 1990"></div><div><label for="ff_pr">Führerprüfung<br>bestanden am</label><input type="date" id="ff_pr" style="height:54px"></div></div>
  <label>Das ist geklärt (zum Bestätigen antippen)</label>
  <div class="mitw ff-chk">${chk('ff_a', 'Der Führerausweis ist geprüft.')}${chk('ff_s', 'In der Haftpflichtversicherung der Person ist das Fahren fremder Fahrzeuge versichert.')}${chk('ff_h', 'Ich trage im Schadenfall den Selbstbehalt und alle nicht versicherten Kosten.')}</div>
  <div id="msg"></div><div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="spei">Vorschlagen</button></div>`);
  document.getElementById('abb').onclick = schliessen;
  document.getElementById('spei').onclick = async () => {
    const f = { art: 'Fahrfreigabe', person: val('ff_p').trim(), bez: val('ff_b').trim(), grund: val('ff_g').trim(), von: val('ff_v'), bis: val('ff_t'), mitEig: val('ff_m'),
      ausweis: document.getElementById('ff_a').checked, jahrgang: parseInt(val('ff_al'), 10), alter: new Date().getFullYear() - parseInt(val('ff_al'), 10), pruefung: val('ff_pr'), versicherung: document.getElementById('ff_s').checked, haftung: document.getElementById('ff_h').checked,
      datum: heute(), erfasstVon: ich };
    const p = pruefeFahrfreigabe(f, heute(), idsGeordnet());
    if (!p.ok) { fehler(p.fehler); return; }
    f.titel = ('Fahrfreigabe ' + f.person).slice(0, 80); f.faelligAm = f.von;
    await sicher(async () => { const id = await S.speichern(D, 'termine', null, f); schliessen(); wunschliste(); hinweis('Vorschlag gespeichert. Die anderen müssen jetzt antworten.'); freigabeDetail(id); });
  };
}
function freigabeDetail(id) {
  const f = D.termine[id]; if (!f) return;
  const s = fahrStandVon(f), ids = idsGeordnet(), mein = f.erfasstVon === ich, k = fahrKlasse(s.status);
  const chip = (i) => { if (i === f.erfasstVon) return '<span class="chipk ok">Vorschlag</span>'; const a = s.antworten[i]; return a ? (a.stimme === 'ja' ? '<span class="chipk ok">Ja</span>' : '<span class="chipk rot">Nein</span>') : '<span class="chipk gelb">noch offen</span>'; };
  const zeilen = ids.map((i) => { const a = s.antworten[i]; return `<div class="z"><div class="l"><strong>${h(D.personen[i].name)}</strong>${a && a.stimme === 'nein' && a.grund ? `<div class="meta">Grund: ${h(a.grund)}</div>` : ''}</div><div class="r">${chip(i)}</div></div>`; }).join('');
  const nein = s.nein.length;
  const stand = s.status === 'offen' ? `Noch nicht entschieden: ${s.ja} Ja, ${nein} Nein, ${s.ohneAntwort.length} offen. Nötig sind ${ids.length - 1} Ja.`
    : s.status === 'freigegeben' ? `Freigegeben für die Reise vom ${fmt(f.von)} bis ${fmt(f.bis)}: ${s.ja} Ja, ${nein} Nein.`
    : s.status === 'abgelehnt' ? `Abgelehnt: ${s.ja} Ja, ${nein} Nein. ${h(f.person)} darf nicht fahren.`
    : `Die Reise ist vorbei. Die Freigabe gilt nicht mehr.`;
  const mitName = D.personen[f.mitEig]?.name || '?';
  const meinAntwort = s.status === 'offen' && !mein;
  const waText = mitLink(`🚐 Womo: ${D.personen[f.erfasstVon]?.name || '?'} möchte ${f.person} (${f.bez}) vom ${fmt(f.von)} bis ${fmt(f.bis)} fahren lassen. Bitte in der Womo-App (Tab Familienrat, Umschalter Fahrer) mit Ja oder Nein antworten.`, 'a', f.id);
  sheet(`<div class="t-sk"><span class="t-sq ${k} gross"><svg viewBox="0 0 24 24" aria-hidden="true">${FAHRT_ICON}</svg></span><div><h3 style="margin:0">${h(f.person)} soll fahren</h3><div class="info" style="margin:2px 0 0">${h(f.bez)} · von ${h(D.personen[f.erfasstVon]?.name || '?')}, ${fmt(f.datum)}</div></div></div>
    <p class="hinweiskarte ${k === 'blau' ? 'gelb' : k}" style="margin:12px 0 8px">${stand}</p>
    <p class="info" style="margin:0 0 6px"><strong>Reise:</strong> ${fmt(f.von)} bis ${fmt(f.bis)}<br><strong>Grund:</strong> ${h(f.grund)}<br><strong>Im Fahrzeug mit:</strong> ${h(mitName)}<br><strong>Person:</strong> ${f.jahrgang ? 'Jahrgang ' + f.jahrgang : f.alter + ' Jahre'}, Führerprüfung am ${fmt(f.pruefung)} (vor ${jahreSeit(f.pruefung, f.datum)} Jahren)<br><strong>Geklärt:</strong> Führerausweis geprüft. Haftpflicht der Person deckt das Fahren fremder Fahrzeuge. Haftung: ${h(D.personen[f.erfasstVon]?.name || '?')} trägt den Selbstbehalt und die nicht versicherten Kosten.</p>
    <div class="zeilen">${zeilen}</div>
    ${meinAntwort ? '<label for="ff_grund">Nur bei Nein: Grund</label><input id="ff_grund" maxlength="200" placeholder="Warum nicht?">' : ''}
    <div id="msg"></div>
    <div class="t-akt2">${meinAntwort ? `<button class="gross-btn pri" id="ff_ja">${s.antworten[ich] ? 'Antwort ändern: Ja' : 'Ja, einverstanden'}</button><button class="gross-btn rot" id="ff_nein">${s.antworten[ich] ? 'Antwort ändern: Nein' : 'Nein'}</button>` : ''}
      ${s.status === 'offen' ? `<a class="gross-btn" style="text-align:center;text-decoration:none" href="${waLink(waText)}" target="_blank" rel="noopener">Familie per WhatsApp informieren</a>` : ''}
      <button class="gross-btn" id="abb">Schliessen</button>${mein && s.status !== 'freigegeben' ? '<button class="gross-btn rot" id="ff_del">Vorschlag löschen</button>' : ''}</div>`);
  document.getElementById('abb').onclick = schliessen;
  const antw = (stimme, grund) => sicher(async () => { await S.speichern(D, 'termine', `fa_${f.id}_${ich}`, { art: 'FahrAntwort', titel: 'Antwort Fahrfreigabe', faelligAm: heute(), freigabeId: f.id, personId: ich, stimme, grund: grund || '', erfasstVon: ich }); schliessen(); wunschliste(); hinweis(stimme === 'ja' ? 'Danke, du hast Ja gesagt.' : 'Danke, dein Nein ist gespeichert.'); });
  if (meinAntwort) {
    document.getElementById('ff_ja').onclick = () => antw('ja');
    document.getElementById('ff_nein').onclick = () => { const g = val('ff_grund').trim(); if (!g) { fehler('Bei Nein bitte einen Grund angeben.'); return; } antw('nein', g); };
  }
  const del = document.getElementById('ff_del');
  if (del) del.onclick = async () => { if (confirm('Vorschlag löschen? Alle Antworten dazu werden ebenfalls gelöscht.')) await sicher(async () => { for (const a of fahrAntworten().filter((x) => x.freigabeId === f.id)) await S.loeschen(D, 'termine', a.id); await S.loeschen(D, 'termine', f.id); schliessen(); wunschliste(); }); };
}

// Abtretung von Nutzungstagen: Eltern treten ungenutzte Tage an beide Kinder zugleich ab (Vertrag Ziffer 7 a).
function tauschSek(J) {
  const L = tauschListe().filter((x) => Number(x.jahr) === J).sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : (a.erfasstAm || '') < (b.erfasstAm || '') ? 1 : -1));
  return `<details class="sek"><summary><span>Nutzungstage abtreten</span><b>${L.length ? L.length + (L.length === 1 ? ' Abtretung' : ' Abtretungen') : 'keine'}</b></summary><div class="sek-in">
    <p class="info" style="margin:0 0 8px">Die Eltern können ungenutzte Tage des Kalenderjahres an die Kinder abtreten. Die Abtretung geht immer an beide Kinder zugleich: Nanouk und Nene bekommen je gleich viele Tage dazu, die Konten von HP und Nora sinken je um dieselbe Zahl. Die Tage verfallen am Jahresende, ein Übertrag ins nächste Jahr gibt es nicht.</p>
    ${L.length ? L.map((t) => `<div class="b" style="padding:8px 0"><div class="inhalt"><div class="zeit" style="font-size:15px">${zahl(t.tage)} ${t.tage === 1 ? 'Tag' : 'Tage'}${t.an === 'kinder' ? ' je Kind' : ''}: ${h(KONTO_NAME[t.von] || '?')} an ${t.an === 'kinder' ? 'Nanouk und Nene' : h(KONTO_NAME[t.an] || '?')}${neuPille(t)}</div><div class="meta">${fmt(t.datum)} · erfasst von ${h(D.personen[t.erfasstVon]?.name || '?')}</div></div>${eigener(t) ? `<button class="kl" data-td="${h(t.id)}">Löschen</button>` : ''}</div>`).join('') : `<p class="leer-t">Keine Abtretung im Jahr ${J}.</p>`}
    <div class="btnzeile"><button class="btn pri" id="tneu" type="button">Tage abtreten</button></div></div></details>`;
}
function bindTausch(J) {
  const b = document.getElementById('tneu'); if (b) b.onclick = () => tauschForm(J);
  app.querySelectorAll('[data-td]').forEach((el) => el.onclick = async () => { const x = D.termine[el.dataset.td]; if (!eigener(x)) return nurEigene(); if (confirm('Diese Abtretung löschen? Die Tage gehen an die Eltern zurück.')) await sicher(async () => { await S.loeschen(D, 'termine', x.id); kalender(); }); });
}
function tauschForm(J) {
  const meins = D.personen[ich].konto, jetztJ = +heute().slice(0, 4);
  if (meins !== 'eltern') { sheet(`<h3>Nutzungstage abtreten</h3><p class="info">Abtreten können nur Vater und Mutter, und nur an beide Kinder zugleich.</p><div class="aktion"><button class="primaer" id="abb">Schliessen</button></div>`); document.getElementById('abb').onclick = schliessen; return; }
  const jahre = [jetztJ, jetztJ + 1];
  const stand = (jj) => kontostaendeMitAlltag(liste(), D.personen, jj, alltagMap(), D.buchungen);
  const freiEltern = (jj) => Math.max(0, schwellen(tauschMap(), jj).eltern - stand(jj).eltern);
  const frei = (jj) => Math.floor(freiEltern(jj)) / 2;
  const j0 = jahre.includes(J) ? J : jetztJ;
  sheet(`<h3>Nutzungstage abtreten</h3>
  <p class="info" style="margin:0 0 4px"><strong>Die Eltern können</strong> ungenutzte Tage an die Kinder abtreten. Nanouk und Nene bekommen immer beide gleich viele Tage dazu, damit es gerecht bleibt. Beispiel: Treten die Eltern 5 Tage ab, bekommen Nanouk und Nene je 5 Tage mehr, und die Konten von HP und Nora sinken je um 5 Tage. Die Tage gelten nur im gewählten Kalenderjahr und verfallen am Jahresende.</p>
  <label for="t_jahr">Kalenderjahr</label><select id="t_jahr">${jahre.map((jj) => `<option value="${jj}"${jj === j0 ? ' selected' : ''}>${jj}</option>`).join('')}</select>
  <p class="info" id="t_frei" style="margin:6px 0 0"></p>
  <label for="t_tage">Anzahl Tage je Kind (ganz oder halb)</label><input id="t_tage" inputmode="decimal" placeholder="z. B. 5">
  <div id="msg"></div>
  <div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="spei">Abtreten</button></div>`);
  const zeigeFrei = () => { document.getElementById('t_frei').textContent = `Im Jahr ${val('t_jahr')} möglich: höchstens ${zahl(frei(+val('t_jahr')))} Tage je Kind. Die Eltern haben noch ${zahl(freiEltern(+val('t_jahr')))} ungenutzte Tage.`; };
  zeigeFrei(); document.getElementById('t_jahr').onchange = zeigeFrei;
  document.getElementById('abb').onclick = schliessen;
  document.getElementById('spei').onclick = async () => {
    const t = { von: 'eltern', an: 'kinder', tage: Number(val('t_tage').trim().replace(',', '.')), jahr: +val('t_jahr') };
    const p = pruefeTausch(t, tauschMap(), stand(t.jahr), jetztJ);
    const fe = [...p.fehler];
    if (zahlungsSperre(D.zahlstatus[ich], heute()).stufe === 'gesperrt') fe.push('Du hast ein Nutzungsverbot wegen Zahlungsverzug (Vertrag Ziffer 4).');
    if (fe.length) { fehler([...new Set(fe)]); return; }
    await sicher(async () => { await S.speichern(D, 'termine', null, { art: 'Tausch', titel: 'Abtretung Nutzungstage', faelligAm: heute(), datum: heute(), ...t, personId: ich, erfasstVon: ich, erledigtAm: '' }); schliessen(); kalender(); hinweis('Abtretung gespeichert.'); });
  };
}

// Alltagsfahrten der Eltern: ohne Reservierung, zaehlen mit Ferienreisen zusammen auf das Konto der Eltern (181 Tage).
function alltagSek(J) {
  const st = kontostaendeMitAlltag(liste(), D.personen, J, alltagMap(), D.buchungen);
  const L = Object.values(alltagMap()).sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : (a.erfasstAm || '') < (b.erfasstAm || '') ? 1 : -1)).slice(0, 15);
  const sw = schwellen(tauschMap(), J), rot = st.eltern > sw.eltern;
  return `<details class="sek"><summary><span>Alltagsfahrten der Eltern</span><b>${st.eltern} / ${zahl(sw.eltern)}</b></summary><div class="sek-in">
    <p class="info" style="margin:0 0 6px">${st.eltern - st.alltag} ${st.eltern - st.alltag === 1 ? 'Tag' : 'Tage'} Ferienreisen + ${st.alltag} ${st.alltag === 1 ? 'Tag' : 'Tage'} Alltag. Alltag ${J}: ${zahl(alltagKm(alltagMap(), J))} km.</p>
    ${rot ? `<div class="hinweiskarte rot">Die Eltern haben mehr als ${zahl(sw.eltern)} Tage erreicht (Ferien und Alltag zusammen).</div>` : ''}
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
  if (!D.uebergaben[bid + '_' + phase]) return rundgang(bid, phase);   // neue Uebernahme/Rueckgabe: gefuehrter Rundgang
  const id = bid + '_' + phase, ex = D.uebergaben[id], ab = D.uebergaben[bid + '_ab'];
  const darf = !ex || eigener(ex);
  const lokal = jetztLokal();
  const dis = darf ? '' : 'disabled';
  const radio = (name, wert, text, cls, aktiv) => `<span class="chk ${cls}"><input type="radio" name="${name}" id="${name}_${wert}" value="${wert}" ${aktiv ? 'checked' : ''} ${dis}><label for="${name}_${wert}">${text}</label></span>`;
  sheet(`<h3>${phase === 'ab' ? 'Übernahme' : 'Rückgabe'}</h3>
  ${phase === 'ab' ? `<div class="u-ban slim"><span class="u-bic">${SVG(ICON_ALK)}</span><div><strong>Wer fährt, trinkt nicht: Fahren unter Alkohol ist verboten</strong></div></div><div class="u-ban slim"><span class="u-bic">${SVG(ICON_RAUCH)}</span><div><strong>Rauchen und Tiere sind verboten</strong></div></div>` : ''}
  <p class="info" style="margin:0">${fmt(b.von)} – ${fmt(b.bis)} · ${h(D.personen[b.fahrerId]?.name || b.ausnahmeFahrer?.name || '?')}${ex ? ` · erfasst von ${h(D.personen[ex.erfasstVon]?.name || '?')}` : ''}</p>
  <div id="ufotos"></div>
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
  if (ex?.rundgang) fotosAnzeigen(id);
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
  const el = zahlungenAusJournal(D.journal, D.personen);   // Zahlplan: nur aus den Buchungen
  const von = `${J}-01-01`, bis = `${J + 1}-01-01`;
  const name = (i) => h(D.personen[i]?.name || '?');
  // Info (blau) und Aktiv (orange): Info nur fuer die Buchhaltung (HP, Stellvertretung), Aktiv fuer alle, die etwas tun koennen.
  const ORANGE = 'background:rgba(245,158,11,.18);border:2px solid rgba(245,158,11,.7)', BLAU = 'background:rgba(59,111,216,.10);border:2px solid rgba(59,111,216,.45)';
  const artStil = (art) => (art === 'aktiv' ? ORANGE : buch ? BLAU : '');
  const artChip = (art) => art === 'aktiv' ? '<span class="chipk gelb">Aktiv</span>' : buch ? '<span class="chipk" style="background:rgba(59,111,216,.22);color:var(--acc)">Info</span>' : '';

  const elternIds = ids.filter((i) => D.personen[i].konto === 'eltern'), kinderIds = ids.filter((i) => D.personen[i].konto !== 'eltern');

  let plan;
  if (!D.start) {
    plan = `<p class="info" style="margin-top:0">Das Übernahmedatum des Fahrzeugs fehlt. Ohne dieses Datum kann die App das Vertragsjahr und die Beträge für Rücklage und Darlehen nicht berechnen.</p>${buchhalter() ? startFeld('') : '<p class="info">HP trägt das Datum ein.</p>'}`;
  } else {
    const n = vertragsJahr(D.start, t);
    if (n === null) plan = `<p class="info" style="margin-top:0">Der Vertrag beginnt am ${fmt(D.start)}.</p>${buchhalter() ? startFeld(D.start) : ''}`;
    else if (n > 8) plan = `<p class="info" style="margin-top:0">Die 8 Vertragsjahre sind abgelaufen (Beginn ${fmt(D.start)}). Weiteres regelt Ziffer 14 des Vertrags.</p>`;
    else plan = `<p class="info" style="margin-top:0">Vertragsjahr <strong>${n} von 8</strong> · ${fmt(addJahre(D.start, n - 1))} bis ${fmt(addJahre(D.start, n))} (Beginn ${fmt(D.start)}).</p><div class="zeilen">` +
      ids.map((i) => {
        const zp = zahlplan(D.start, t, el, D.personen[i], i);
        return `<div class="z"><div class="l"><strong>${name(i)}</strong>${zp.posten.map((p) => `<div class="meta">${ZWECKE[p.zweck]}: Soll ${chf(p.soll)} · bezahlt ${chf(p.ist)}</div>`).join('')}</div><div class="r">${zp.posten.map((p) => `<div><span class="chipk ${p.offen > 0 ? 'gelb' : 'ok'}">${p.offen > 0 ? 'offen ' + chf(p.offen) : 'bezahlt'}</span></div>`).join('')}</div></div>`;
      }).join('') + `</div><p class="info">Soll laut Vertrag Ziffer 5 (Rücklage) und Anhang A (Darlehen, Rückzahlung je CHF 9 600).</p>${buchhalter() ? `<details class="det"><summary>Übernahmedatum ändern</summary>${startFeld(D.start)}</details>` : ''}`;
  }

  // ---- Offene Zahlungen (immer sichtbar) und Zahlungen der Kinder ueber 8 Jahre ----
  const plaene = Object.fromEntries(ids.map((i) => [i, D.start && D.personen[i] ? achtJahrePlan(D.start, t, el, D.personen[i], i) : null]));
  const offenKarte = !D.start
    ? `<div class="karte" style="${artStil(buch ? 'aktiv' : 'info')}"><h3 style="margin:0 0 6px;font-size:17px">Offene Zahlungen ${artChip(buch ? 'aktiv' : 'info')}</h3><p class="info" style="margin:0">Das Übernahmedatum des Fahrzeugs fehlt. Ohne dieses Datum kann die App nicht berechnen, welche Zahlungen wann fällig sind.</p>${buchhalter() ? startFeld('') : '<p class="info">HP trägt das Datum ein.</p>'}</div>`
    : (() => {
      const zeilen = ids.map((i) => {
        const fz = faelligkeiten(D.start, t, el, D.personen[i], i), pl = plaene[i];
        const ueber = fz.some((f) => f.rueckstand), bald = fz.some((f) => f.naechste && f.naechste.datum <= addTage(t, VORLAUF_TAGE));
        const chip = ueber ? `<span class="chipk rot">überfällig ${chf(pl.total.offenFaellig)}</span>` : bald ? '<span class="chipk gelb">bald fällig</span>' : '<span class="chipk ok">pünktlich</span>';
        return `<div class="z"><div class="l"><strong>${name(i)}</strong>${fz.map((f) => `<div class="meta">${ZWECKE[f.zweck]}: ${fzText(f)}</div>`).join('')}<div class="meta">Noch zu zahlen bis Vertragsende: CHF ${chf(pl.total.offen)}</div></div><div class="r">${chip}</div></div>`;
      }).join('');
      const ueberTotal = ids.reduce((s, i) => s + plaene[i].total.offenFaellig, 0), offenTotal = ids.reduce((s, i) => s + plaene[i].total.offen, 0);
      return `<div class="karte" style="${artStil('info')}"><h3 style="margin:0 0 6px;font-size:17px">Offene Zahlungen ${artChip('info')}</h3>
        <div class="hero-stand ${ueberTotal > 0 ? 'rot' : 'ok'}" style="margin:0 0 6px">${ueberTotal > 0 ? `Überfällig insgesamt: CHF ${chf(ueberTotal)}` : 'Nichts überfällig.'}</div>
        <div class="zeilen">${zeilen}</div>
        <p class="info" style="margin-bottom:0">Noch zu zahlen bis Vertragsende (alle vier): CHF ${chf(offenTotal)}. Darlehensraten (Tochter und Sohn) monatlich am letzten Tag des Monats, Rücklage (alle vier) jährlich bis 31. Dezember. Es zählen alle gebuchten Zahlungen, auch im Voraus bezahlte.${buch ? ' Die Zahlungen kommen aus deinen Buchungen: Darlehensrate = Bank an «Darlehen an …», Rücklage = Bank an «Rücklage …».' : ''}</p></div>`;
    })();
  const zb = zuBuchen(D.wuensche, D.wunschaktionen, D.journal, D.personen);
  const zbKarte = (!zb.length || !buch) ? '' : `<div class="karte" style="background:rgba(245,158,11,.18);border:2px solid rgba(245,158,11,.7)"><h3 style="margin:0 0 6px;font-size:17px;color:var(--gelb-t)">📒 Zu buchen: Wünsche ${artChip('aktiv')}</h3>
    <div class="zeilen">${zb.map((z, i) => `<div class="z"><div class="l"><strong>${h(z.titel)}</strong><div class="meta">${z.art === 'kauf' ? 'Kauf' : 'Erstattung'} · CHF ${chf(z.betrag)} · ${fmt(z.datum)} · ${name(z.personId)}</div></div><div class="r">${buch ? `<button class="btn pri" data-zb="${i}">Buchen</button>` : '<span class="chipk gelb">HP bucht</span>'}</div></div>`).join('')}</div>
    <p class="info" style="margin-bottom:0">Gekaufte Wünsche kommen erst jetzt in die Buchhaltung. Beim Kauf wählst du das Aufwandskonto, die Gegenbuchung läuft über den Kreditor der Person, die ausgelegt hat.</p></div>`;
  // Anleitung (nur fuer die Buchhaltung: HP und Stellvertreterin). Bewusst ohne Namen, der Code der App ist oeffentlich.
  const schritte = [
    ['Der Wunsch wird bewilligt', 'ok', 'Macht: die App', 'Es wird noch nichts gebucht. Die Person, die den Wunsch vorgeschlagen hat, sieht im Kalender «freigegeben, du kannst kaufen». Der Wunsch steht im Tab «Wünsche» und im Archiv.'],
    ['Die Person kauft und bezahlt aus eigener Tasche', '', 'Ausserhalb der App', ''],
    ['Der Kauf wird eingetragen', '', 'Macht: die kaufende Person', 'Tab «Wünsche» → auf den Wunsch tippen → Betrag und Kaufdatum prüfen → «Gekauft eintragen». Das kann nur die Person, die den Wunsch vorgeschlagen hat. Danach erscheinen bei der Buchhaltung die orange Karte «Zu buchen: Wünsche» im Tab «Kosten» und ein Hinweis im Kalender.'],
    ['Den Kauf buchen', 'gelb', 'Macht: die Buchhaltung', 'Tab «Kosten» → orange Karte «Zu buchen» → «Buchen» → bei «Soll» das Aufwandskonto wählen (das entscheidet die Buchhaltung, alles andere ist schon ausgefüllt) → «Speichern».<br>Gebucht wird: Aufwand an das Kreditor-Konto der kaufenden Person. Das Womo schuldet ihr jetzt den Betrag.'],
    ['Das Geld zurückzahlen', '', 'Ausserhalb der App', 'Vom gemeinsamen Konto an die kaufende Person.'],
    ['Die Rückzahlung bestätigen', '', 'Macht: der Halter, im Notfall die Stellvertretung', 'Tab «Wünsche» → auf den Wunsch tippen → «Betrag erstattet». Diesen Knopf sehen nur der Halter und die Stellvertretung.'],
    ['Die Rückzahlung buchen', 'gelb', 'Macht: die Buchhaltung', 'Tab «Kosten» → die orange Karte zeigt jetzt «Erstattung» → «Buchen» → «Speichern». Hier muss kein Konto gewählt werden.<br>Gebucht wird: Kreditor-Konto der kaufenden Person an Bank CHF. Das Kreditor-Konto steht danach wieder auf 0.'],
  ];
  const anleitung = `<p class="info" style="margin-top:0">Ein Wunsch kommt erst in die Buchhaltung, wenn er bewilligt und gekauft ist. <strong>Automatisch gebucht wird nie etwas.</strong> Die App zeigt nur, was zu buchen ist, und füllt die Buchung vor. Beispiel: ein Wunsch über CHF 12.00.</p>
    <div class="zeilen">${schritte.map(([titel, k, wer, text], i) => `<div class="z" style="align-items:flex-start"><div class="l"><strong>${i + 1}. ${titel}</strong><div style="margin:4px 0"><span class="chipk ${k}">${wer}</span></div>${text ? `<div class="meta">${text}</div>` : ''}</div></div>`).join('')}</div>
    <p class="info" style="margin-bottom:0"><strong>Wichtig:</strong> Zuerst den Kauf buchen (Schritt 4), erst danach die Rückzahlung (Schritt 7). Hast du eine Buchung von Hand erfasst, erkennt die App sie, wenn Betrag und Kreditor-Konto stimmen, und bietet sie nicht nochmals an.</p>`;
  const schritte2 = [
    ['Vorher klären', '', 'Macht: die Stellvertretung', 'Du buchst als Stellvertretung (der bekannte Hinweis erscheint und wird bestätigt). Für alles hier brauchst du nur die App. Du brauchst keinen Zugang zu den Konten von ' + name(D.adminId) + ' (zum Beispiel Claude, GitHub oder Firebase). Die Buchhaltung läuft ohne diese Zugänge weiter.'],
    ['Schlüssel für ' + name('s') + ' erzeugen', 'gelb', 'Macht: die Stellvertretung', 'Tab «Kosten» → ganz nach unten → Abschnitt «Zweite Stellvertretung ' + name('s') + '» → «Schlüssel für ' + name('s') + ' erzeugen» → Hinweis bestätigen → «Ok». Es erscheint ein langer Schlüssel. Er wird nur dieses eine Mal angezeigt.'],
    ['Den Schlüssel weitergeben', '', 'Macht: die Stellvertretung', 'Gib den Schlüssel ' + name('s') + ' selbst weiter, am besten persönlich oder schriftlich. Nicht per Mail oder Chat, wenn es sich vermeiden lässt. Dann «Schliessen» tippen.'],
    ['Den Schlüssel eingeben', '', 'Macht: ' + name('s'), 'App öffnen und anmelden → Tab «Kosten» → ganz nach unten → Abschnitt «Stellvertretung (nur im Notfall)» → «Buchungsschlüssel eingeben» → Schlüssel einfügen → «Speichern». Danach sieht ' + name('s') + ' die Buchen-Knöpfe und kann buchen, immer mit dem Hinweis vorher.'],
    ['Schlüssel verloren oder bekannt geworden', 'gelb', 'Macht: die Stellvertretung', 'Schritt 2 wiederholen. Der alte Schlüssel von ' + name('s') + ' gilt sofort nicht mehr.']
  ];
  const anleitung2 = `<p class="info" style="margin-top:0">So setzt die Stellvertretung eine zweite Stellvertretung ein, wenn ${name(D.adminId)} die Buchhaltung nicht mehr führen kann. Alles geht in der App.</p>
    <div class="zeilen">${schritte2.map(([titel, k, wer, text], i) => `<div class="z" style="align-items:flex-start"><div class="l"><strong>${i + 1}. ${titel}</strong><div style="margin:4px 0"><span class="chipk ${k}">${wer}</span></div><div class="meta">${text}</div></div></div>`).join('')}</div>
    <p class="info" style="margin-bottom:0"><strong>Gut zu wissen:</strong> Den eigenen Schlüssel und den von ${name(D.adminId)} kann niemand ersetzen ausser ${name(D.adminId)}. Bewahre deinen Schlüssel deshalb gut auf, am besten schriftlich an einem sicheren Ort. Die App und ihre Daten laufen ohne Pflege weiter. Die automatische Datensicherung läuft auf dem Computer von ${name(D.adminId)}, ohne ihn gibt es keine neuen Sicherungen. Änderungen am Programm der App sind ohne seine Zugänge nicht möglich.</p>`;
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
  const mein = `<div class="hero-zeile"><div><div class="hero-l">Konto Reise CHF bei<br>Migros Bank</div><div class="hero-z">${chf(sal['1020'].saldo)}</div></div><div><div class="hero-l">Bisheriger Aufwand<br>für ${J}</div><div class="hero-z">${chf(er.sAufwand)}</div></div></div>
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
  const journalInhalt = (jahrBuch.length ? jahrBuch.map((b) => zeileK('data-dj', b.id, 'CHF ' + chf(b.betrag), fmt(b.datum).slice(0, 6) + ' · ' + h(b.text) + (b.stellvertretung ? ' · Stellvertretung' : '') + '<br>' + h(kname[b.soll] || b.soll) + ' an ' + h(kname[b.haben] || b.haben), b)).join('') : '<p class="leer-t">Keine Buchungen erfasst.</p>')
    + (buch ? '' : '<p class="info">Buchen können HP (Buchhaltung) und Nanouk (Stellvertreterin), Vertrag Ziffer 11. Alle sehen die Zahlen.</p>');
  const sek = (titel, zusatz, inhalt, offen, art = 'info') => `<details class="sek"${artStil(art) ? ` style="${artStil(art)}"` : ''}${offen ? ' open' : ''}><summary><span>${titel}</span>${artChip(art)}<b>${zusatz}</b></summary><div class="sek-in">${inhalt}</div></details>`;
  function zeileK(attr, id, titel, sub, x) { return `<button class="t-z blau" ${attr}="${h(id)}"><span class="t-sq blau"><svg viewBox="0 0 24 24" aria-hidden="true">${KOSTEN_ICON}</svg></span><span class="t-zt"><strong>${titel}${neuPille(x)}</strong><small>${sub}</small></span><span class="t-pf" aria-hidden="true">›</span></button>`; }
  app.innerHTML = rahmen(`${seitenkopf('Kosten', buch ? 'kplus' : null, '＋ Buchen')}
  <div class="karte hero"><div class="monatskopf" style="margin:0 0 10px"><h2 style="font-size:18px">Jahr ${J}</h2><div class="nav"><button id="jz" aria-label="Voriges Jahr">‹</button><button id="jv" aria-label="Nächstes Jahr">›</button></div></div>
    ${mein}
  </div>
  ${offenKarte}
  ${zbKarte}
  ${sek('Bilanz', 'CHF ' + chf(bi.sAktiven), bilanzInhalt, true)}
  ${sek('Erfolgsrechnung', J + ': ' + chf(er.ergebnis), erfInhalt, false)}
  ${sek('Buchungen ' + J, jahrBuch.length + (jahrBuch.length === 1 ? ' Eintrag' : ' Einträge'), journalInhalt, jahrBuch.length > 0 && jahrBuch.length <= 3)}
  ${sek('Alle Konten', '', kontenInhalt, false)}
  ${sek('Zahlungen der Kinder, 8 Jahre', D.start ? 'CHF ' + chf(kinderIds.reduce((s, i) => s + (plaene[i] ? plaene[i].total.offen : 0), 0)) + ' offen' : 'Datum fehlt', kinderInhalt, false)}
  ${sek('Zahlplan aller', D.start ? 'Jahr ' + (vertragsJahr(D.start, t) ?? '–') : 'Datum fehlt', plan, false)}
  ${sek('Zahlungsstatus', '', `<div class="zeilen">${status}</div><p class="info">Bei Zahlungsverzug: Erinnerung, 10 Tage Frist, danach Nutzungsverbot bis zur Zahlung (Ziffer 4). Die App sperrt dann Reservierungen für diese Person.</p>`, false, buch ? 'aktiv' : 'info')}
  ${(S.online && rolle() === 'hp') ? sek('Stellvertretung ' + name('t'), '', `<p class="info" style="margin-top:0">${name('t')} bucht nur als Stellvertretung, wenn du nicht mehr kannst. Dafür braucht ${name('t')} einen eigenen Schlüssel. Du erzeugst ihn hier, die App zeigt ihn nur einmal an, und du gibst ihn ${name('t')} selbst weiter. Ein bisheriger Schlüssel von ${name('t')} gilt danach nicht mehr.</p><div class="btnzeile"><button class="btn pri" id="stv_neu">Neuen Schlüssel für ${name('t')} erzeugen</button></div>`, false, 'aktiv') : ''}
  ${(S.online && ['hp', 'stv1'].includes(rolle())) ? sek('Zweite Stellvertretung ' + name('s'), '', `<p class="info" style="margin-top:0">Falls auch ${name('t')} ausfällt oder die Arbeit teilen will, kann ${name('s')} als zweite Stellvertretung eingesetzt werden. Dafür erzeugst du hier einen Schlüssel für ${name('s')}. Die App zeigt ihn nur einmal an, du gibst ihn ${name('s')} selbst weiter. Ein bisheriger Schlüssel von ${name('s')} gilt danach nicht mehr. Die genaue Anleitung steht weiter unten.</p><div class="btnzeile"><button class="btn pri" id="stv2_neu">Schlüssel für ${name('s')} erzeugen</button></div>`, false, 'aktiv') : ''}
  ${(S.online && ich === 's' && !S.schluesselGet('s')) ? sek('Stellvertretung (nur im Notfall)', '', `<p class="info" style="margin-top:0">Das brauchst du nur, wenn du als Stellvertretung der Buchhaltung eingesetzt wirst. Dann bekommst du von ${name('t')} einen Buchungsschlüssel. Den gibst du hier einmal ein. Danach kannst du buchen, immer mit einem Hinweis vorher.</p><div class="btnzeile"><button class="btn pri" id="stv_eingeben">Buchungsschlüssel eingeben</button></div>`, false, 'aktiv') : ''}
  ${buch ? sek('Anleitung: Wunsch buchen', '7 Schritte', anleitung, false) : ''}
  ${['hp', 'stv1'].includes(rolle()) ? sek('Anleitung: zweite Stellvertretung einsetzen', schritte2.length + ' Schritte', anleitung2, false) : ''}`);
  bindRahmen();
  document.getElementById('jz').onclick = () => { jahrK = J - 1; kosten(); };
  document.getElementById('jv').onclick = () => { jahrK = J + 1; kosten(); };
  const eintragSheet = (titel, info, x, loeschen) => {
    const darf = buch && eigener(x);
    sheet(`<h3 style="margin:0 0 6px">${titel}</h3><p class="info" style="margin:0 0 6px">${info}</p>${darf ? '' : '<p class="info">Nur die Person, die den Eintrag erfasst hat, kann ihn löschen.</p>'}<div id="msg"></div>
      <div class="t-akt2"><button class="gross-btn" id="abb">Schliessen</button>${darf ? '<button class="gross-btn rot" id="e_del">Löschen</button>' : ''}</div>`);
    document.getElementById('abb').onclick = schliessen;
    if (darf) document.getElementById('e_del').onclick = () => alsStv(async () => { if (confirm('Eintrag löschen?')) await sicher(async () => { await loeschen(); schliessen(); kosten(); }); });
  };
  app.querySelectorAll('[data-zb]').forEach((b) => b.onclick = () => { const z = zb[parseInt(b.dataset.zb, 10)]; if (z) buchenStarten(() => buchungForm(z)); });
  app.querySelectorAll('[data-dj]').forEach((b) => b.onclick = () => { const j = D.journal[b.dataset.dj]; if (j) eintragSheet('CHF ' + chf(j.betrag), `${fmt(j.datum)} · ${h(j.text)}<br>Soll: ${h(kname[j.soll] || j.soll)}<br>Haben: ${h(kname[j.haben] || j.haben)}<br>Erfasst von ${name(j.erfasstVon)}.${j.stellvertretung ? `<br><strong>Gebucht als Stellvertretung</strong> am ${fmt((j.stellvertretungAm || j.erfasstAm || '').slice(0, 10))}.` : ''}`, j, () => S.journalLoeschen(D, j.id, ich)); });
  app.querySelectorAll('[data-kb]').forEach((b) => b.onclick = () => {
    const kb = kontoblatt(jn, D.personen, b.dataset.kb, stichtag); if (!kb.konto) return;
    const vz = (rp) => (rp < 0 ? '−' : '') + chf(Math.abs(rp));
    sheet(`<h3 style="margin:0 0 4px">${h(kb.konto.name)}</h3><p class="info" style="margin:0 0 8px">Konto ${kb.konto.nr} · Stand ${fmt(stichtag)}: <strong>CHF ${chf(kb.saldo)}</strong></p>
      <div class="zeilen">${kb.zeilen.length ? kb.zeilen.slice().reverse().map((z) => `<div class="z"><div class="l"><strong>${h(z.b.text)}</strong><div class="meta">${fmt(z.b.datum)} · Gegenkonto: ${h(kname[z.b.soll === kb.konto.nr ? z.b.haben : z.b.soll] || '?')}</div></div><div class="r">${vz(z.betrag)}<div class="meta">Saldo ${vz(z.saldo)}</div></div></div>`).join('') : '<p class="leer-t">Noch keine Buchungen auf diesem Konto.</p>'}</div>
      <div class="t-akt2"><button class="gross-btn" id="abb">Schliessen</button></div>`);
    document.getElementById('abb').onclick = schliessen;
  });
  const stvErzeugen = (ziel, wem) => {
    const los = () => alsStv(() => {
      if (!confirm('Neuen Schlüssel erzeugen? Ein bisheriger Schlüssel dieser Person gilt danach nicht mehr.')) return;
      sicher(async () => { const neu = await S.stvSchluesselErzeugen(ich, ziel); schluesselZeigen(neu, wem); });
    });
    if (!S.schluesselGet(ich)) schluesselAbfragen(los); else los();
  };
  const sn = document.getElementById('stv_neu'); if (sn) sn.onclick = () => stvErzeugen('stellvertretung', D.personen.t?.name || 'Nanouk');
  const sn2 = document.getElementById('stv2_neu'); if (sn2) sn2.onclick = () => stvErzeugen('stellvertretung2', D.personen.s?.name || 'Nene');
  const se = document.getElementById('stv_eingeben'); if (se) se.onclick = () => schluesselAbfragen(() => { kosten(); hinweis('Schlüssel gespeichert.'); });
  const kp = document.getElementById('kplus'); if (kp) kp.onclick = () => buchenStarten(() => buchungForm());
  app.querySelectorAll('[data-st]').forEach((b) => b.onclick = () => alsStv(async () => {
    const [pid, neu] = b.dataset.st.split('|');
    await sicher(async () => { await S.speichern(D, 'zahlstatus', pid, neu === 'ok' ? { status: 'ok', erfasstVon: ich } : { status: 'erinnert', erinnertAm: heute(), erfasstVon: ich }); kosten(); hinweis(neu === 'ok' ? 'Status auf «in Ordnung» gesetzt.' : 'Erinnerung gesetzt. Die Frist beträgt 10 Tage.'); });
  }));
  const sb = document.getElementById('startspei');
  if (sb) sb.onclick = () => { const v = val('startdatum'); if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { hinweis('Bitte ein Datum wählen.'); return; } alsStv(() => sicher(async () => { await S.startSetzen(D, v); kosten(); hinweis('Übernahmedatum gespeichert.'); })); };
}
function startFeld(wert) {
  return `<label for="startdatum" style="display:block;margin:10px 0 6px;font-size:13px;font-weight:700;color:var(--muted)">Übernahmedatum des Fahrzeugs</label><div class="btnzeile" style="margin:0"><input type="date" id="startdatum" value="${h(wert)}" style="flex:1;min-width:150px;font:inherit;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--soft);color:var(--fg)"><button class="btn pri" id="startspei">Speichern</button></div>`;
}

// Nanouk bucht nur als Stellvertreterin (Vertrag Ziffer 11 und 15): vor jeder Buchung kommt ein Hinweis.
const stellvertretung = () => ['stv1', 'stv2'].includes(rolle());
// Hinweis fuer die Stellvertreterin vor jeder Handlung, die eigentlich dem Hauptbuchhalter gehoert (Buchen, Erstattung bestaetigen,
// Uebernahmedatum, Zahlungsstatus, Buchung loeschen). Fuer alle anderen geht es direkt weiter.
function alsStv(weiter) {
  if (!stellvertretung()) { weiter(); return; }
  const hp = h(D.personen[D.adminId]?.name || 'HP'), nk = h(D.personen.t?.name || 'Nanouk'), zweite = rolle() === 'stv2';
  const wer = zweite ? nk : hp, text = zweite ? `${nk} führt die Buchhaltung, wenn ${hp} ausfällt. Du buchst nur, wenn ${hp} und ${nk} dazu aus eigener Kraft nicht mehr fähig sind` : `${hp} führt die Buchhaltung. Du buchst nur, wenn ${hp} dazu aus eigener Kraft nicht mehr fähig ist`;
  sheet(`<h3>Stellvertretung</h3><div class="hinweiskarte rot" style="margin:0 0 10px">${text} (Vertrag Ziffer 11 und 15). Jede Buchung von dir wird als Stellvertretung gekennzeichnet.</div>
    <div class="t-akt2"><button class="gross-btn" id="abb">Abbrechen</button><button class="gross-btn rot" id="stv_ja">${zweite ? nk + ' und ' + hp : wer} ${zweite ? 'können' : 'kann'} nicht mehr, ich mache das</button></div>`);
  document.getElementById('abb').onclick = schliessen; document.getElementById('stv_ja').onclick = () => { schliessen(); weiter(); };
}
// Buchungsschluessel einmal eingeben (wird nur auf diesem Geraet gemerkt)
function schluesselAbfragen(weiter) {
  sheet(`<h3>Buchungsschlüssel</h3><p class="info" style="margin:0 0 8px">Buchen darf nur, wer den Buchungsschlüssel kennt. Bitte den Schlüssel einmal eingeben, er wird nur auf diesem Gerät gemerkt.</p>
    <label for="schl">Buchungsschlüssel</label><input id="schl" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="100"><div id="msg"></div>
    <div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="schl_ok">Speichern</button></div>`);
  document.getElementById('abb').onclick = schliessen;
  document.getElementById('schl_ok').onclick = () => { const s = val('schl').trim(); if (s.length < 20) { fehler('Der Schlüssel ist zu kurz. Bitte genau so eingeben, wie er mitgeteilt wurde.'); return; } S.schluesselSet(ich, s); schliessen(); weiter(); };
}
// Neuer Schluessel wird nur einmal angezeigt (HP fuer Nanouk, HP oder Nanouk fuer die zweite Stellvertretung)
function schluesselZeigen(neu, wem) {
  sheet(`<h3>Schlüssel für ${h(wem)}</h3><div class="hinweiskarte gelb" style="margin:0 0 10px">Dieser Schlüssel wird nur jetzt angezeigt. Gib ihn ${h(wem)} selbst weiter (nicht per Mail oder Chat, wenn es sich vermeiden lässt) und schliesse dann das Fenster.</div>
    <div style="font:700 17px/1.5 ui-monospace,Menlo,monospace;word-break:break-all;background:var(--soft);border-radius:12px;padding:14px;user-select:all" id="stv_wert">${h(neu)}</div>
    <div class="t-akt2" style="margin-top:12px"><button class="gross-btn pri" id="stv_kop">Kopieren</button><button class="gross-btn" id="abb">Schliessen, ich habe ihn weitergegeben</button></div>`);
  document.getElementById('abb').onclick = schliessen;
  document.getElementById('stv_kop').onclick = async () => { try { await navigator.clipboard.writeText(neu); hinweis('Schlüssel kopiert.'); } catch { hinweis('Kopieren nicht möglich, bitte den Text markieren und kopieren.'); } };
}
function buchenStarten(weiter) {
  if (S.online && !S.schluesselGet(ich)) { schluesselAbfragen(() => alsStv(weiter)); return; }
  alsStv(weiter);
}
function buchungForm(vor) {
  const gruppen = { aktiv: 'Aktiven', passiv: 'Passiven', ertrag: 'Ertrag', aufwand: 'Aufwand' }, kl = kontenListe(D.personen);
  const optionen = (sel, platzhalter) => (platzhalter ? '<option value="" selected>Bitte Konto wählen</option>' : '') + Object.entries(gruppen).map(([typ, tt]) => `<optgroup label="${tt}">${kl.filter((k) => k.typ === typ).map((k) => `<option value="${k.nr}"${k.nr === sel && !platzhalter ? ' selected' : ''}>${k.nr} ${h(k.name)}</option>`).join('')}</optgroup>`).join('');
  const vorl = buchVorlagen(D.personen), v0 = vorl[0];
  sheet(`<h3>${vor ? (vor.art === 'kauf' ? 'Wunschkauf buchen' : 'Erstattung buchen') : 'Buchung erfassen'}</h3>
  ${vor ? `<p class="info" style="margin:0 0 6px">Wunsch «${h(vor.titel)}», ${vor.art === 'kauf' ? 'gekauft von ' + h(D.personen[vor.personId]?.name || '?') + '. Bitte das Aufwandskonto wählen.' : 'der Betrag wurde vom gemeinsamen Konto erstattet.'}</p>` : `<label for="b_vorlage">Vorlage</label><select id="b_vorlage">${vorl.map((v) => `<option value="${v.id}">${h(v.name)}</option>`).join('')}</select>`}
  <div class="zwei"><div><label for="b_datum">Datum</label><input type="date" id="b_datum" value="${vor ? h(vor.datum) : heute()}"></div>
  <div><label for="b_betrag">Betrag in CHF</label><input id="b_betrag" inputmode="decimal" placeholder="z. B. 45.50" value="${vor ? chf(vor.betrag).replace(/[’' ]/g, '') : ''}"></div></div>
  <label for="b_soll">Soll (wohin geht es?)</label><select id="b_soll">${vor ? optionen(vor.soll, !vor.soll) : optionen(v0.soll)}</select>
  <label for="b_haben">Haben (woher kommt es?)</label><select id="b_haben">${vor ? optionen(vor.haben, !vor.haben) : optionen(v0.haben)}</select>
  <label for="b_text">Buchungstext</label><input id="b_text" maxlength="${BUCH_TEXT_MAX}" placeholder="z. B. Gasflasche" value="${vor ? h((vor.art === 'kauf' ? vor.titel : 'Erstattung: ' + vor.titel).slice(0, BUCH_TEXT_MAX)) : ''}">
  <p class="info" id="b_hilfe" style="margin-bottom:0"></p>
  <div id="msg"></div><div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="spei">Speichern</button></div>`);
  const kn = Object.fromEntries(kl.map((k) => [k.nr, k.name])), hilfe = document.getElementById('b_hilfe');
  const zeigeHilfe = () => { hilfe.textContent = `Gebucht wird: ${kn[val('b_soll')] || '?'} an ${kn[val('b_haben')] || '?'}. Betrag immer positiv eingeben.`; };
  if (!vor) document.getElementById('b_vorlage').onchange = () => { const v = vorl.find((x) => x.id === val('b_vorlage')); if (v && v.soll) { document.getElementById('b_soll').value = v.soll; document.getElementById('b_haben').value = v.haben; } zeigeHilfe(); };
  document.getElementById('b_soll').onchange = zeigeHilfe; document.getElementById('b_haben').onchange = zeigeHilfe; zeigeHilfe();
  document.getElementById('abb').onclick = schliessen;
  document.getElementById('spei').onclick = async () => {
    const b = { datum: val('b_datum'), soll: val('b_soll'), haben: val('b_haben'), betrag: rappen(val('b_betrag')), text: val('b_text').trim(), erfasstVon: ich };
    if (vor) { b.wunschId = vor.wunschId; b.wunschArt = vor.art; }
    if (stellvertretung()) { b.stellvertretung = true; b.stellvertretungAm = new Date().toISOString(); if (rolle() === 'stv2') b.stellvertretungStufe = 2; }
    const p = pruefeBuchsatz(b, D.personen);
    if (!p.ok) { fehler(p.fehler); return; }
    await sicher(async () => { await S.journalSpeichern(D, b, ich); jahrK = parseInt(b.datum.slice(0, 4), 10); schliessen(); kosten(); hinweis('Buchung gespeichert.'); });
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
  if (famAnsicht === 'fragen') return fragenSeite();
  if (famAnsicht === 'fahrer') return fahrerSeite();
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
  const abgelehnt = alle.filter((e) => e.s.status === 'abgelehnt');
  const archiv = alle.filter((e) => e.s.status === 'freigegeben' || e.s.status === 'gekauft');
  const zeileArchiv = (e) => {
    const { w, s } = e, k = wunschKlasse(s.status);
    const sub = `${wunschPreisText(w)} · ${h(D.personen[w.erfasstVon]?.name || '?')} · ${fmt(w.datum)}<br>Abstimmung: ${s.ja} Ja, ${s.nein.length} Nein${w.gekauftAm ? `<br>Gekauft ${fmt(w.gekauftAm)} für CHF ${chf(w.gekauftBetrag)}${s.erstattet ? ', erstattet' : ', noch nicht erstattet'}` : '<br>Noch nicht gekauft'}`;
    const bild = w.foto ? `<span class="t-sq ${k} mit-foto"><img src="${h(w.foto)}" alt=""></span>` : `<span class="t-sq ${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${WUNSCH_ICON}</svg></span>`;
    return `<button class="t-z ${k}" data-wid="${h(w.id)}">${bild}<span class="t-zt"><strong>${h(w.titel)}</strong><small>${sub}</small></span><span class="t-pf" aria-hidden="true">›</span></button>`;
  };
  const leer = alle.length === 0 ? '<div class="karte"><p class="leer-t" style="margin:6px 0">Noch keine Wünsche. Mit «＋ Wunsch» schlägst du etwas für das Womo vor (Leuchte, Überzüge, Geschirr usw.).</p></div>' : '';
  app.innerHTML = rahmen(`${seitenkopf('Wunschliste', 'wneu', '＋ Wunsch')}${famSeg()}
    <div class="karte"><p class="info" style="margin:0">Einrichtung für das Womo: <strong>bis CHF 200 pro Stück</strong>. Vorher hier vorschlagen. Die anderen haben ${WUNSCH_FRIST_TAGE} Tage Zeit, wer nicht antwortet, stimmt zu. Bei Widerspruch gilt: höchstens ein Nein, sonst abgelehnt (qualifizierte Mehrheit, Ziffer 13). Bei 2 zu 2 ist der Kauf abgelehnt. Wer ohne Freigabe kauft, bezahlt selbst (Vertrag Ziffer 5).</p>
      <p class="info" style="margin:8px 0 0"><strong>Verbrauchsmaterial</strong> (Putzmittel, Spülmittel, Abfallsäcke, Salz, Pfeffer, Teebeutel usw.) braucht keinen Wunsch: einfach kaufen und unter «Kosten» erfassen.</p></div>
    ${leer}${gruppe('Wartet auf deine Antwort', dein)}${gruppe('Freigegeben, kann gekauft werden', frei)}${gruppe('Antworten laufen', laufend)}
    ${archiv.length ? `<details class="sek" style="margin-top:20px"><summary><span>Archiv: bewilligte Wünsche</span><b>${archiv.length}</b></summary><div class="sek-in"><p class="info" style="margin-top:0">Alle Wünsche, die eine Mehrheit bekommen haben (auch die schon gekauften). Sie bleiben dauerhaft erhalten und lassen sich nicht löschen. Ein Tipp zeigt, wer wie abgestimmt hat, den Kauf und die Erstattung.</p>${archiv.map(zeileArchiv).join('')}</div></details>` : ''}
    ${abgelehnt.length ? `<details class="sek"><summary><span>Abgelehnt</span><b>${abgelehnt.length}</b></summary><div class="sek-in">${abgelehnt.map(zeile).join('')}</div></details>` : ''}`);
  bindRahmen(); bindNeu();
  document.getElementById('wneu').onclick = wunschForm; bindSeg();
  app.querySelectorAll('[data-wid]').forEach((b) => b.onclick = () => wunschDetail(b.dataset.wid));
}

// Bild im Vollbild: Tipp auf das Bild wechselt zwischen «passt auf den Bildschirm» und «Originalgrösse zum Verschieben».
function fotoGross(src) {
  const o = document.createElement('div'); o.className = 'foto-gross';
  o.innerHTML = `<img src="${h(src)}" alt=""><button type="button" class="foto-zu">✕ Schliessen</button><span class="foto-tipp">Bild antippen: vergrössern</span>`;
  const im = o.querySelector('img'), tipp = o.querySelector('.foto-tipp');
  im.onclick = (e) => { e.stopPropagation(); const v = o.classList.toggle('voll'); tipp.textContent = v ? 'Mit dem Finger verschieben, antippen: verkleinern' : 'Bild antippen: vergrössern'; };
  o.querySelector('.foto-zu').onclick = (e) => { e.stopPropagation(); o.remove(); };
  o.onclick = () => o.remove();
  document.body.appendChild(o);
}

// Foto im Handy verkleinern (längste Seite höchstens 1000 px, JPEG), damit es in den Wunsch passt (Firestore: 1 MiB pro Eintrag).
// klein = Zielgroesse in Zeichen fuer Rundgang-Fotos mit halber Aufloesung (laengste Seite hoechstens 700 px).
function fotoVerkleinern(file, gross, klein) {
  return new Promise((ok, nein) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      try {
        // gross = Zielgrösse in Zeichen (Fragen: Dokumente müssen lesbar bleiben); sonst Wunsch-Foto (150 KB).
        const ziel = klein || gross || 150000;
        let max = klein ? 700 : gross ? 2600 : 1000, q = klein ? 0.72 : gross ? 0.82 : 0.72, out = '';
        for (let i = 0; i < 16; i++) {
          const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * f)); c.height = Math.max(1, Math.round(img.naturalHeight * f));
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length <= ziel) break;
          if (gross && !klein && q > 0.6) q = Math.max(0.6, q - 0.07);          // bei Dokumenten zuerst die Qualität senken, die Auflösung möglichst behalten
          else { q = Math.max(gross && !klein ? 0.5 : 0.4, q - 0.06); max = Math.round(max * 0.9); }
        }
        URL.revokeObjectURL(url);
        if (out.length > (gross ? FRAGE_BILD_MAX : WUNSCH_FOTO_MAX)) nein(new Error('Das Foto ist auch verkleinert zu gross.')); else ok(out);
      } catch (e) { URL.revokeObjectURL(url); nein(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); nein(new Error('Das Bild kann nicht gelesen werden.')); };
    img.src = url;
  });
}

const waTextWunsch = (w) => mitLink(`⭐ Womo-Wunsch von ${D.personen[w.erfasstVon]?.name || '?'}: ${w.titel}${w.menge > 1 ? ' (' + w.menge + ' Stück)' : ''}, ${wunschPreisText(w)}.${w.groesse ? ' Grösse: ' + w.groesse + '.' : ''}${w.link ? ' ' + w.link : ''} Bitte in der Womo-App bis ${fmt(wunschStandVon(w).frist)} antworten (Ja oder Nein).`, 'w', w.id);
const waTextFrage = (f) => mitLink(`❓ Womo-Frage von ${D.personen[f.erfasstVon]?.name || '?'}: ${f.titel}${f.groesse ? ' (Grösse: ' + f.groesse + ')' : ''} Bitte in der Womo-App bis ${fmt(frageStandVon(f).frist)} mit Ja oder Nein antworten. Es müssen alle Ja sagen.`, 'f', f.id);
// Nach dem Speichern WhatsApp mit fertigem Text öffnen; Gruppe oder Person wählt man dort selbst, gesendet wird erst dort.
const waAuto = (text) => setTimeout(() => { try { location.href = waLink(text); } catch {} }, 900);
function wunschForm() {
  sheet(`<h3>Neuer Wunsch</h3>
  <label for="w_titel">Was soll gekauft werden?</label><input id="w_titel" maxlength="100" placeholder="Konkretes Produkt, z. B. Leselampe mit Clip, weiss">
  <div class="zwei"><div><label for="w_preis">Preis pro Stück, CHF</label><input id="w_preis" inputmode="decimal" placeholder="z. B. 24.90"></div>
  <div><label for="w_menge">Stückzahl</label><input type="number" id="w_menge" min="1" max="99" value="1" inputmode="numeric"></div></div>
  <label for="w_link">Link zum Produkt</label><input id="w_link" type="url" inputmode="url" maxlength="300" autocapitalize="off" autocorrect="off" placeholder="https://… (empfohlen)">
  <label for="w_groesse">Grösse (optional)</label><input id="w_groesse" maxlength="60" placeholder="z. B. 30 × 20 × 10 cm">
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
    const w = { titel: val('w_titel').trim(), preis: rappen(val('w_preis')), menge: parseInt(val('w_menge') || '1', 10), link: val('w_link').trim(), groesse: val('w_groesse').trim(), notiz: val('w_notiz').trim(), foto: foto || undefined, datum: heute(), erfasstVon: ich };
    const p = pruefeWunsch(w);
    if (!p.ok) { fehler(p.fehler); return; }
    await sicher(async () => { const id = await S.speichern(D, 'wuensche', null, w); schliessen(); wunschliste(); hinweis(`Wunsch gespeichert. Die anderen haben bis ${fmt(addTage(w.datum, WUNSCH_FRIST_TAGE))} Zeit.`); wunschDetail(id); waAuto(waTextWunsch(D.wuensche[id] || { ...w, id })); });
  };
}

function wunschDetail(id) {
  const w = D.wuensche[id]; if (!w) return;
  const s = wunschStandVon(w), ids = idsGeordnet(), mein = w.erfasstVon === ich, halter = buchhalter();
  const k = wunschKlasse(s.status);
  const stimmeChip = (i) => {
    if (i === w.erfasstVon) return '<span class="chipk ok">Vorschlag</span>';
    const a = s.antworten[i];
    if (a) return a.stimme === 'ja' ? '<span class="chipk ok">Ja</span>' : '<span class="chipk rot">Nein</span>';
    return s.abgelaufen || s.status !== 'offen' ? '<span class="chipk ok">zählt als Ja</span>' : '<span class="chipk gelb">noch offen</span>';
  };
  const zeilen = ids.map((i) => { const a = s.antworten[i]; return `<div class="z"><div class="l"><strong>${h(D.personen[i].name)}</strong>${a && a.stimme === 'nein' ? `<div class="meta">${a.grund ? 'Grund: ' + h(a.grund) : ''}${a.grund && a.alternative ? '<br>' : ''}${a.alternative ? 'Alternative: ' + h(a.alternative) : ''}</div>` : ''}</div><div class="r">${stimmeChip(i)}</div></div>`; }).join('');
  const gb = wunschGebucht(w, D.journal, D.personen, D.wuensche);
  const stand = s.status === 'offen' ? `Antworten bis ${fmt(s.frist)} (einschliesslich). Wer nicht antwortet, stimmt zu.`
    : s.status === 'freigegeben' ? `Freigegeben: ${s.ja} Ja zu ${s.nein.length} Nein. ${mein ? 'Du kannst kaufen.' : 'Kaufen darf, wer den Wunsch vorgeschlagen hat.'}`
    : s.status === 'abgelehnt' ? `Abgelehnt: ${s.ja} Ja zu ${s.nein.length} Nein${s.nein.length === s.ja ? ' (Gleichstand gilt als abgelehnt, Ziffer 13)' : ''}. Nicht kaufen.`
    : `Gekauft am ${fmt(w.gekauftAm)} für CHF ${chf(w.gekauftBetrag)} von ${h(D.personen[w.erfasstVon]?.name || '?')}. ${s.erstattet ? 'Erstattet am ' + fmt((s.erstattet.datum || s.erstattet.erfasstAm || '').slice(0, 10)) + '.' : 'Der Vater erstattet den Betrag vom gemeinsamen Konto (Ziffer 5).'}${buchhalter() ? ` Buchhaltung: ${gb.kauf ? 'Kauf gebucht' : 'Kauf noch nicht gebucht'}${s.erstattet ? (gb.erstattung ? ', Erstattung gebucht' : ', Erstattung noch nicht gebucht') : ''}.` : ''}`;
  const waText = waTextWunsch(w);
  const meinAntwort = s.status === 'offen' && !mein;
  const kaufen = s.status === 'freigegeben' && mein;
  const erstatten = s.status === 'gekauft' && halter && !s.erstattet;
  sheet(`<div class="t-sk"><span class="t-sq ${k} gross"><svg viewBox="0 0 24 24" aria-hidden="true">${WUNSCH_ICON}</svg></span><div><h3 style="margin:0">${h(w.titel)}</h3><div class="info" style="margin:2px 0 0">${wunschPreisText(w)} · von ${h(D.personen[w.erfasstVon]?.name || '?')}, ${fmt(w.datum)}</div></div></div>
    <p class="hinweiskarte ${k === 'blau' ? 'gelb' : k}" style="margin:12px 0 8px">${stand}</p>
    ${w.foto ? `<img class="w-foto" id="w_fbig" src="${h(w.foto)}" alt="Foto: ${h(w.titel)}">` : ''}
    ${w.link ? `<p class="info" style="margin:0 0 6px"><a class="u-chip" href="${h(w.link)}" target="_blank" rel="noopener">Produkt ansehen<em>Link</em></a></p>` : ''}${w.groesse ? `<p class="info" style="margin:0 0 6px"><strong>Grösse:</strong> ${h(w.groesse)}</p>` : ''}${w.notiz ? `<p class="info" style="margin:0 0 6px">${h(w.notiz)}</p>` : ''}
    <div class="zeilen">${zeilen}</div>
    ${meinAntwort ? `<label for="w_grund">Nur bei Nein: Grund</label><input id="w_grund" maxlength="200" placeholder="Warum nicht?"><label for="w_alt">Nur bei Nein: Alternative (Produkt, Preis)</label><input id="w_alt" maxlength="200" placeholder="Was wäre besser?">` : ''}
    ${kaufen ? `<div class="zwei"><div><label for="w_betrag">Bezahlt, CHF</label><input id="w_betrag" inputmode="decimal" value="${chf(wunschTotal(w)).replace(/[’' ]/g, '')}"></div><div><label for="w_kdatum">Kaufdatum</label><input type="date" id="w_kdatum" value="${heute()}"></div></div>` : ''}
    <div id="msg"></div>
    <div class="t-akt2">${meinAntwort ? `<button class="gross-btn pri" id="w_ja">${s.antworten[ich] ? 'Antwort ändern: Ja' : 'Ja, einverstanden'}</button><button class="gross-btn rot" id="w_nein">${s.antworten[ich] ? 'Antwort ändern: Nein' : 'Nein'}</button>` : ''}
      ${kaufen ? '<button class="gross-btn pri" id="w_kauf">Gekauft eintragen</button>' : ''}
      ${erstatten ? '<button class="gross-btn pri" id="w_erst">Betrag erstattet</button>' : ''}
      ${s.status === 'offen' ? `<a class="gross-btn" style="text-align:center;text-decoration:none" href="${waLink(waText)}" target="_blank" rel="noopener">Familie per WhatsApp informieren</a>` : ''}
      <button class="gross-btn" id="abb">Schliessen</button>${mein && ['offen', 'abgelehnt'].includes(s.status) ? '<button class="gross-btn rot" id="w_del">Wunsch löschen</button>' : ''}</div>`);
  document.getElementById('abb').onclick = schliessen;
  const fb = document.getElementById('w_fbig');
  if (fb) fb.onclick = () => fotoGross(w.foto);
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
      await S.speichern(D, 'wuensche', w.id, { ...w, gekauftAm: datum, gekauftBetrag: betrag });
      schliessen(); wunschliste(); hinweis('Gekauft eingetragen. HP bucht den Kauf in der Buchhaltung, der Vater erstattet vom gemeinsamen Konto.');
    });
  };
  if (erstatten) document.getElementById('w_erst').onclick = () => alsStv(() => { if (confirm(`Hast du CHF ${chf(w.gekauftBetrag)} an ${D.personen[w.erfasstVon]?.name || '?'} erstattet?`)) aktion(`${w.id}_erstattet`, { art: 'erstattet', datum: heute() }, 'Erstattung eingetragen.'); });
  const del = document.getElementById('w_del');
  if (del) del.onclick = async () => { if (confirm('Wunsch löschen? Alle Antworten dazu werden ebenfalls gelöscht.')) await sicher(async () => { for (const a of Object.values(D.wunschaktionen).filter((x) => x.wunschId === w.id)) await S.loeschen(D, 'wunschaktionen', a.id); await S.loeschen(D, 'wuensche', w.id); schliessen(); wunschliste(); }); };
}

// =====================================================================
// Fragen an die Familie: Entscheide, die alle vier mittragen müssen (z. B. «Darf Marokko bereist werden?»)
// Einstimmig: alle müssen Ja sagen, ein Nein genügt zur Ablehnung, Schweigen zählt nicht als Ja, keine Frist.
// Gespeichert in der Sammlung «termine» (art «Frage» und «FrageAntwort»), damit keine neue Datenbankregel nötig ist.
// =====================================================================
let famAnsicht = 'wunsch';   // Umschalter in diesem Tab: 'wunsch', 'fragen' oder 'fahrer'
const FRAGE_ICON = '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M10 9.500a2 2 0 1 1 3 1.700c-.7.400-1 .800-1 1.500M12 14.500v.01"/>';
const frageListe = () => Object.values(D.termine).filter((x) => x.art === 'Frage');
const frageAntworten = () => Object.values(D.termine).filter((x) => x.art === 'FrageAntwort');
const frageStandVon = (f) => frageStand(f, frageAntworten(), idsGeordnet(), heute());
// Standardhinweis: gilt für jede Frage, die etwas ändert, das der Vertrag regelt.
const ZUSATZ_REGEL = '<strong>Vertragszusatz nötig:</strong> Wird ein Punkt geändert, der im Vertrag geregelt ist, braucht es zusätzlich einen schriftlichen Vertragszusatz, den alle Eigentümer unterschreiben (Ziffer 13 c). Ein Ja in der App ersetzt ihn nicht.';
const frageKlasse = (st) => ({ offen: 'blau', angenommen: 'ok', abgelehnt: 'rot' })[st];
const zeitText = (iso) => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; const z = ZH.format(d); return `${fmt(z.slice(0, 10))}, ${z.slice(11, 16)} Uhr`; };
const frageWartet = (f, st) => st.status === 'offen' && f.erfasstVon !== ich && !st.antworten[ich];
function famSeg() {
  const nF = frageListe().filter((f) => frageWartet(f, frageStandVon(f))).length;
  const nW = wunschListe().filter((w) => { const st = wunschStandVon(w); return st.status === 'offen' && w.erfasstVon !== ich && !st.antworten[ich]; }).length;
  const nFa = freigabeListe().wartet;
  const b = (k, txt, n) => `<button type="button" data-fa="${k}" class="${famAnsicht === k ? 'aktiv' : ''}">${txt}${n ? `<i>${n}</i>` : ''}</button>`;
  return `<div class="seg" role="tablist">${b('wunsch', 'Wunsch Anschaffung', nW)}${b('fragen', 'Idee kostenlos', nF)}${b('fahrer', 'Fahrer', nFa)}</div>`;
}
function bindSeg() { app.querySelectorAll('.seg button').forEach((b) => b.onclick = () => { famAnsicht = b.dataset.fa; wunschliste(); window.scrollTo(0, 0); }); }

function fragenSeite() {
  const alle = frageListe().map((f) => ({ f, s: frageStandVon(f) })).sort((a, b) => (a.f.erfasstAm < b.f.erfasstAm ? 1 : a.f.erfasstAm > b.f.erfasstAm ? -1 : 0));
  const zeile = (e, archiv) => {
    const { f, s } = e, k = frageKlasse(s.status);
    const txt = s.status === 'offen' ? `${s.ja} von ${s.gesamt}` : FRAGE_STATUS[s.status];
    const sub = `${h(D.personen[f.erfasstVon]?.name || '?')} · ${fmt(f.datum || f.faelligAm)}${archiv ? `<br>Ja ${s.ja}, Nein ${s.nein.length}` : ''}`;
    const neuP = neuPille(f), fehlt = s.ueberfaellig ? '<span class="neu rot">überfällig</span>' : frageWartet(f, s) ? '<span class="neu gelb">Antwort fehlt</span>' : '';
    return `<button class="t-z ${k}" data-fid="${h(f.id)}"><span class="t-sq ${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${FRAGE_ICON}</svg></span><span class="t-zt"><strong>${h(f.titel)}${neuP}${fehlt}</strong><small>${sub}</small></span><span class="t-pl ${k}">${txt}</span></button>`;
  };
  const gruppe = (titel, xs) => xs.length ? `<p class="t-lab2">${titel}</p>${xs.map((e) => zeile(e, false)).join('')}` : '';
  const dein = alle.filter((e) => frageWartet(e.f, e.s));
  const laufend = alle.filter((e) => e.s.status === 'offen' && !dein.includes(e));
  const fertig = alle.filter((e) => e.s.status !== 'offen');
  const leer = alle.length === 0 ? '<div class="karte"><p class="leer-t" style="margin:6px 0">Noch keine Fragen. Mit «＋ Frage» legst du der Familie etwas zum Entscheid vor.</p></div>' : '';
  app.innerHTML = rahmen(`${seitenkopf('Fragen', 'fneu', '＋ Frage')}${famSeg()}
    <div class="karte"><p class="info" style="margin:0">Hier stellst du der Familie eine Frage, wenn etwas entschieden werden soll, das der Vertrag heute nicht erlaubt oder nicht regelt (zum Beispiel ein Reiseland ausserhalb Europas).</p>
      <p class="info" style="margin:8px 0 0"><strong>Alle vier müssen Ja sagen.</strong> Ein einziges Nein genügt zur Ablehnung. Schweigen zählt nicht als Ja, die Frage bleibt offen, bis alle geantwortet haben. Antwortfrist wie bei Wünschen: ${WUNSCH_FRIST_TAGE} Tage. Danach wird die Frage als «überfällig» markiert und du kannst per WhatsApp erinnern. Wer fragt, zählt als Ja. Jede Antwort wird mit Datum und Uhrzeit festgehalten und kann danach nicht mehr geändert werden.</p>
      <p class="info zusatz" style="margin:8px 0 0">${ZUSATZ_REGEL}</p></div>
    ${leer}${gruppe('Wartet auf deine Antwort', dein)}${gruppe('Antworten laufen', laufend)}
    ${fertig.length ? `<details class="sek" style="margin-top:20px"${dein.length || laufend.length ? '' : ' open'}><summary><span>Entschieden (Dokumentation)</span><b>${fertig.length}</b></summary><div class="sek-in"><p class="info" style="margin-top:0">Alle entschiedenen Fragen bleiben dauerhaft erhalten und lassen sich nicht löschen. Ein Tipp zeigt, wer wann wie geantwortet hat.</p>${fertig.map((e) => zeile(e, true)).join('')}</div></details>` : ''}`);
  bindRahmen(); bindNeu(); bindSeg();
  document.getElementById('fneu').onclick = frageForm;
  app.querySelectorAll('[data-fid]').forEach((b) => b.onclick = () => frageDetail(b.dataset.fid));
}

function frageForm() {
  sheet(`<h3>Neue Frage an die Familie</h3>
  <label for="f_titel">Die Frage</label><input id="f_titel" maxlength="${FRAGE_TITEL_MAX}" placeholder="z. B. Darf Marokko bereist werden?">
  <p class="info zusatz" style="margin:0 0 6px">${ZUSATZ_REGEL}</p>
  <label for="f_heute">Was gilt bisher? (optional)</label><input id="f_heute" maxlength="200" placeholder="z. B. Vertrag Ziffer 9: nur Länder in Europa">
  <label for="f_groesse">Grösse (optional)</label><input id="f_groesse" maxlength="60" placeholder="z. B. 30 × 20 × 10 cm (bei Gegenstand)">
  <label for="f_text">Begründung: Warum fragst du? Was soll sich ändern?</label><textarea id="f_text" maxlength="${FRAGE_TEXT_MAX}" placeholder="z. B. Nene möchte im Frühling nach Marokko fahren (Fähre ab Spanien)."></textarea>
  <label>Bilder oder PDF (optional, bis ${FRAGE_ANHANG_MAX})</label><label class="foto-wahl" for="f_dat" id="f_dwahl">📎 Bild oder Datei auswählen</label><input type="file" id="f_dat" accept="image/*,application/pdf" multiple style="display:none">
  <div id="f_dprev"></div>
  <p class="info">Alle vier müssen Ja sagen. Ein Nein genügt zur Ablehnung. Du zählst mit deinem Vorschlag als Ja.</p>
  <div id="msg"></div><div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="spei">Frage stellen</button></div>`);
  document.getElementById('abb').onclick = schliessen;
  let anhaenge = [];
  const aVorschau = () => {
    document.getElementById('f_dprev').innerHTML = anhaenge.map((x, i) => `<div class="foto-vor" style="align-items:center">${x.typ === 'bild' ? `<img src="${h(x.daten)}" alt="" style="width:64px;height:64px">` : '<span class="t-sq blau"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/></svg></span>'}<span class="info" style="flex:1;margin:0;overflow-wrap:anywhere">${h(x.name)}<br>${Math.round(x.daten.length / 1024)} KB</span><button type="button" class="kl" data-aw="${i}">Entfernen</button></div>`).join('');
    document.getElementById('f_dprev').querySelectorAll('[data-aw]').forEach((bt) => bt.onclick = () => { anhaenge.splice(+bt.dataset.aw, 1); aVorschau(); });
  };
  document.getElementById('f_dat').onchange = async (e) => {
    const dateien = [...(e.target.files || [])]; e.target.value = '';
    for (let n = 0; n < dateien.length; n++) {
      const d = dateien[n];
      if (anhaenge.length >= FRAGE_ANHANG_MAX) { fehler(`Höchstens ${FRAGE_ANHANG_MAX} Anhänge pro Frage.`); break; }
      try {
        if (d.type.startsWith('image/')) anhaenge.push({ name: d.name.slice(0, 80) || 'Bild', typ: 'bild', daten: await fotoVerkleinern(d, Math.max(120000, Math.min(600000, Math.floor((FRAGE_ANHANG_SUMME - anhaenge.reduce((a, x) => a + x.daten.length, 0)) / Math.max(1, Math.min(dateien.length - n, FRAGE_ANHANG_MAX - anhaenge.length)))))) });
        else if (d.type === 'application/pdf') {
          const daten = await new Promise((ok, nein) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => nein(new Error('Die Datei kann nicht gelesen werden.')); r.readAsDataURL(d); });
          if (daten.length > FRAGE_PDF_MAX) throw new Error('Die PDF-Datei ist zu gross (höchstens etwa 300 KB): ' + d.name);
          anhaenge.push({ name: d.name.slice(0, 80) || 'Datei.pdf', typ: 'pdf', daten });
        } else throw new Error('Nur Bilder und PDF-Dateien sind möglich: ' + d.name);
      } catch (x) { fehler(x.message || String(x)); }
    }
    aVorschau();
  };
  document.getElementById('spei').onclick = async () => {
    const f = { art: 'Frage', titel: val('f_titel').trim(), text: val('f_text').trim(), bisher: val('f_heute').trim(), groesse: val('f_groesse').trim(), datum: heute(), faelligAm: heute(), erfasstVon: ich };
    if (anhaenge.length) f.anhaenge = anhaenge;
    const p = pruefeFrage(f);
    if (!p.ok) { fehler(p.fehler); return; }
    await sicher(async () => { const id = await S.speichern(D, 'termine', null, f); schliessen(); fragenSeite(); hinweis('Frage gestellt. Alle müssen antworten.'); frageDetail(id); waAuto(waTextFrage(D.termine[id] || { ...f, id })); });
  };
}

function anhangHtml(f) {
  const an = Array.isArray(f.anhaenge) ? f.anhaenge : [];
  if (!an.length) return '';
  return `<div style="margin:6px 0 10px">${an.map((x, i) => x.typ === 'bild'
    ? `<img class="w-foto" data-bild="1" src="${h(x.daten)}" alt="Anhang: ${h(x.name)}"><div class="info" style="margin:-2px 0 8px;text-align:center">🔍 Bild antippen: gross ansehen und vergrössern</div>`
    : `<button type="button" class="btn" data-pdf="${i}" style="margin:0 8px 8px 0">📄 ${h(x.name)}</button>`).join('')}</div>`;
}

function frageDetail(id) {
  const f = D.termine[id]; if (!f || f.art !== 'Frage') return;
  const s = frageStandVon(f), ids = idsGeordnet(), mein = f.erfasstVon === ich, k = frageKlasse(s.status);
  const chip = (i) => {
    if (i === f.erfasstVon) return '<span class="chipk ok">Frage (Ja)</span>';
    const a = s.antworten[i];
    if (a) return a.stimme === 'ja' ? '<span class="chipk ok">Ja</span>' : '<span class="chipk rot">Nein</span>';
    return s.status === 'offen' ? '<span class="chipk gelb">noch offen</span>' : '<span class="chipk">nicht mehr nötig</span>';
  };
  const zeilen = ids.map((i) => {
    const a = s.antworten[i], zt = i === f.erfasstVon ? zeitText(f.erfasstAm) : a ? zeitText(a.erfasstAm) : '';
    return `<div class="z"><div class="l"><strong>${h(D.personen[i].name)}</strong>${zt ? `<div class="meta">${zt}</div>` : ''}${a && a.stimme === 'nein' && a.grund ? `<div class="meta">Grund: ${h(a.grund)}</div>` : ''}</div><div class="r">${chip(i)}</div></div>`;
  }).join('');
  const stand = s.status === 'offen' ? `Offen: ${s.ja} von ${s.gesamt} haben Ja gesagt. Es braucht alle. Noch keine Antwort: ${s.ohneAntwort.map((i) => h(D.personen[i].name)).join(', ')}. ${s.ueberfaellig ? 'Die Frist (' + fmt(s.frist) + ') ist abgelaufen. Die Frage bleibt offen, Schweigen ist kein Ja.' : 'Bitte antworten bis ' + fmt(s.frist) + '.'}`
    : s.status === 'angenommen' ? `Angenommen${s.entschiedenAm ? ' am ' + zeitText(s.entschiedenAm) : ''}: alle ${s.gesamt} haben Ja gesagt.`
    : `Abgelehnt${s.entschiedenAm ? ' am ' + zeitText(s.entschiedenAm) : ''}: ${s.nein.map((i) => h(D.personen[i].name)).join(', ')} ${s.nein.length > 1 ? 'haben' : 'hat'} Nein gesagt. Es gilt weiter die bisherige Regel.`;
  const waText = waTextFrage(f);
  const waErinnerung = mitLink(`⏰ Erinnerung Womo-Frage: «${f.titel}» von ${D.personen[f.erfasstVon]?.name || '?'}. Die Frist ist abgelaufen. Es fehlt noch die Antwort von ${s.ohneAntwort.map((i) => D.personen[i].name).join(', ')}. Bitte in der Womo-App mit Ja oder Nein antworten.`, 'f', f.id);
  const antwort = s.status === 'offen' && !mein && !s.antworten[ich];
  const loeschbar = mein && Object.keys(s.antworten).length === 0 && s.status === 'offen';
  sheet(`<div class="t-sk"><span class="t-sq ${k} gross"><svg viewBox="0 0 24 24" aria-hidden="true">${FRAGE_ICON}</svg></span><div><h3 style="margin:0">${h(f.titel)}</h3><div class="info" style="margin:2px 0 0">von ${h(D.personen[f.erfasstVon]?.name || '?')}, ${zeitText(f.erfasstAm) || fmt(f.datum || f.faelligAm)}</div></div></div>
    <p class="hinweiskarte ${k === 'blau' ? 'gelb' : k}" style="margin:12px 0 8px">${stand}</p>
    ${s.status !== 'abgelehnt' ? `<p class="info zusatz" style="margin:0 0 10px">${ZUSATZ_REGEL}</p>` : ''}
    ${f.bisher ? `<p class="info" style="margin:0 0 6px"><strong>Bisher:</strong> ${h(f.bisher)}</p>` : ''}
    ${f.groesse ? `<p class="info" style="margin:0 0 6px"><strong>Grösse:</strong> ${h(f.groesse)}</p>` : ''}
    <p class="info" style="margin:0 0 6px"><strong>Begründung:</strong> ${h(f.text || '')}</p>
    ${anhangHtml(f)}
    <div class="zeilen">${zeilen}</div>
    ${antwort ? '<label for="f_grund">Nur bei Nein: Grund</label><input id="f_grund" maxlength="' + FRAGE_GRUND_MAX + '" placeholder="Warum nicht?"><p class="info">Deine Antwort kann danach nicht mehr geändert werden.</p>' : ''}
    <div id="msg"></div>
    <div class="t-akt2">${antwort ? '<button class="gross-btn pri" id="f_ja">Ja, einverstanden</button><button class="gross-btn rot" id="f_nein">Nein</button>' : ''}
      ${s.status === 'offen' ? `<a class="gross-btn" style="text-align:center;text-decoration:none" href="${waLink(s.ueberfaellig ? waErinnerung : waText)}" target="_blank" rel="noopener">${s.ueberfaellig ? 'Erinnerung per WhatsApp senden' : 'Familie per WhatsApp informieren'}</a>` : ''}
      <button class="gross-btn" id="abb">Schliessen</button>${loeschbar ? '<button class="gross-btn rot" id="f_del">Frage zurückziehen</button>' : ''}</div>`);
  document.getElementById('abb').onclick = schliessen;
  const antw = (stimme, grund) => sicher(async () => {
    await S.speichern(D, 'termine', `fq_${f.id}_${ich}`, { art: 'FrageAntwort', titel: 'Antwort Frage', faelligAm: heute(), frageId: f.id, personId: ich, stimme, grund: grund || '', erfasstVon: ich });
    schliessen(); fragenSeite(); hinweis(stimme === 'ja' ? 'Danke, du hast Ja gesagt.' : 'Danke, dein Nein ist gespeichert.');
  });
  if (antwort) {
    document.getElementById('f_ja').onclick = () => antw('ja');
    document.getElementById('f_nein').onclick = () => {
      const grund = val('f_grund').trim();
      if (!grund) { fehler('Bei Nein bitte einen Grund angeben. Nur Nein zu sagen genügt nicht.'); return; }
      antw('nein', grund);
    };
  }
  formEl.querySelectorAll('[data-bild]').forEach((im) => im.onclick = () => fotoGross(im.src));
  formEl.querySelectorAll('[data-pdf]').forEach((bt) => bt.onclick = () => {
    const x = (f.anhaenge || [])[+bt.dataset.pdf]; if (!x) return;
    try { const bin = atob(x.daten.split(',')[1]), u8 = Uint8Array.from(bin, (c) => c.charCodeAt(0)); window.open(URL.createObjectURL(new Blob([u8], { type: 'application/pdf' })), '_blank'); }
    catch { hinweis('Die Datei kann nicht geöffnet werden.'); }
  });
  const del = document.getElementById('f_del');
  if (del) del.onclick = async () => { if (confirm('Frage zurückziehen und löschen?')) await sicher(async () => { await S.loeschen(D, 'termine', f.id); schliessen(); fragenSeite(); }); };
}

// =====================================================================
// Gefuehrter Rundgang fuer Uebernahme und Rueckgabe (streng, mit Fotos). Die Regeln stehen in regeln.js (rundgangSchritte).
// Der Stand bleibt auf diesem Handy gespeichert, so kann man unterbrechen und am gleichen Schritt weitermachen.
// =====================================================================
const RG_KEY = (bid, ph) => `womo-rg-${bid}-${ph}-${ich}`;
const rgLesen = (bid, ph) => { try { const j = JSON.parse(localStorage.getItem(RG_KEY(bid, ph))); return j && j.st ? j : null; } catch { return null; } };
const rgLoeschen = (bid, ph) => { try { localStorage.removeItem(RG_KEY(bid, ph)); } catch {} };
const ueZweit = (bid, ph, ex) => ex ? 'ansehen' : rgLesen(bid, ph) ? 'fortsetzen' : 'erfassen';
function rundgang(bid, phase) {
  const b = D.buchungen[bid]; if (!b || !ich) return;
  if (phase === 'rueck' && !D.uebergaben[bid + '_ab']) { hinweis('Zuerst die Übernahme machen. Die Rückgabe kommt danach.'); return; }
  if (zahlungsSperre(D.zahlstatus[ich], heute()).stufe === 'gesperrt') { hinweis('Du hast ein Nutzungsverbot wegen Zahlungsverzug (Vertrag Ziffer 4).'); return; }
  const L = rundgangSchritte(phase), name = phase === 'ab' ? 'Übernahme' : 'Rückgabe', wer = D.personen[b.fahrerId]?.name || b.ausnahmeFahrer?.name || '?';
  const ctxf = () => ({ bid, phase, ich, jetzt: jetztLokal(), uebergaben: Object.values(D.uebergaben), buchungen: D.buchungen });
  const d0 = rgLesen(bid, phase);
  const st = d0 ? d0.st : { fotos: {}, punkte: {}, mangel: {}, km: '', tank: '', tankGrund: '', schadenJa: null, schadenText: '', schluessel: false };
  st.fotos = st.fotos || {}; st.punkte = st.punkte || {}; st.mangel = st.mangel || {};
  const off = naechsterOffener(st, phase, ctxf());
  let idx = off < 0 ? L.length - 1 : off;
  let voll = false;
  const merken = () => { try { localStorage.setItem(RG_KEY(bid, phase), JSON.stringify({ st, idx })); voll = false; } catch { voll = true; } };
  const ok = () => pruefeSchritt(L[idx], st, ctxf());
  const vor = () => { merken(); idx++; zeige(); };
  const fotoBlock = (slot, hilfe, titel) => {
    const f = st.fotos[slot];
    return `${hilfe ? `<p class="info" style="margin:0 0 8px">${hilfe}</p>` : ''}<div>${f ? `<img class="rg-img" src="${h(f)}" alt="${h(titel || '')}">` : '<div class="rg-leer">Noch kein Foto</div>'}</div>
      <label class="foto-wahl rg-kam" for="rg_in_${slot}">📷 ${f ? 'Neues Foto machen' : 'Foto aufnehmen'}</label><input type="file" id="rg_in_${slot}" accept="image/*" capture="environment" style="display:none">`;
  };
  const bindFoto = (slot, nachher) => {
    const inp = document.getElementById('rg_in_' + slot); if (!inp) return;
    inp.onchange = async (ev) => {
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      try { st.fotos[slot] = UE_FOTO_PFLICHT[slot] ? await fotoVerkleinern(f, 0, 60000) : await fotoVerkleinern(f, 130000); /* Pflichtfotos: halbe Aufloesung; Mangel- und Schadenfotos bleiben scharf */ merken(); if (voll) hinweis('Achtung: Der Speicher im Handy ist voll. Bitte die Übergabe jetzt ohne Pause fertig machen.'); nachher ? nachher() : zeige(); }
      catch (x) { fehler('Das Foto konnte nicht verarbeitet werden: ' + (x.message || x)); }
    };
  };
  const zeige = () => {
    const sc = L[idx], pct = Math.round(idx / (L.length - 1) * 100);
    let inner = '', weiter = 'Weiter', auto = false;
    if (sc.typ === 'foto') inner = `<h3>${h(sc.titel)}</h3>${fotoBlock(sc.slot, h(sc.hilfe), sc.titel)}`;
    else if (sc.typ === 'punkt') {
      const a = st.punkte[sc.key];
      inner = `<h3>${h(sc.titel)}</h3><div class="rg-jn"><button type="button" class="rg-ja${a === 'ja' ? ' an' : ''}" id="rg_ja">Ja</button><button type="button" class="rg-nein${a === 'nein' ? ' an' : ''}" id="rg_nein">Nein</button></div>`;
      if (a === 'nein') inner += `<label for="rg_mangel">Was stimmt nicht? (Pflicht)</label><textarea id="rg_mangel" maxlength="${UE_MANGEL_MAX}" placeholder="Kurz und genau">${h(st.mangel[sc.key] || '')}</textarea><label>Foto vom Mangel (Pflicht)</label>${fotoBlock('p_' + sc.key, '', 'Mangel')}`;
    } else if (sc.typ === 'km') {
      const ab = D.uebergaben[bid + '_ab'];
      inner = `<h3>Kilometerstand</h3><p class="info" style="margin:0 0 8px">Lies die Zahl vom Tacho ab (siehe dein Foto).${phase === 'rueck' && ab ? ` Bei der Übernahme waren es ${zahl(ab.km)} km.` : ''}</p><input id="rg_km" inputmode="numeric" class="rg-gross" placeholder="z. B. 12450" value="${h(st.km || '')}" autocomplete="off">`;
    } else if (sc.typ === 'tank') {
      inner = `<h3>Tankstand</h3><p class="info" style="margin:0 0 8px">Der Vertrag verlangt: immer voll tanken.</p><div class="rg-tank">${TANK.map((t) => `<button type="button" class="${st.tank === t ? 'an' : ''}${t === 'voll' ? ' voll' : ''}" data-tank="${h(t)}">${h(t)}</button>`).join('')}</div>`;
      if (st.tank && st.tank !== 'voll') inner += `<div class="hinweiskarte rot" style="margin-top:12px">Der Tank ist nicht voll. Bitte erklären, warum. Die anderen werden gewarnt.</div><label for="rg_tg">Warum nicht voll? (Pflicht)</label><input id="rg_tg" maxlength="${UE_MANGEL_MAX}" value="${h(st.tankGrund || '')}">`;
    } else if (sc.typ === 'schaden') {
      inner = `<h3>Neue Schäden oder Mängel?</h3><p class="info" style="margin:0 0 4px">Kratzer, Dellen, kaputte Teile: alles, was vorher nicht da war.</p><div class="rg-jn"><button type="button" class="rg-ja${st.schadenJa === false ? ' an' : ''}" id="rg_sn">Nein, keine</button><button type="button" class="rg-nein${st.schadenJa === true ? ' an' : ''}" id="rg_sj">Ja</button></div>`;
      if (st.schadenJa) {
        const n = Object.keys(st.fotos).filter((k) => /^s\d$/.test(k)).length;
        inner += `<label for="rg_st">Was ist passiert? (Pflicht)</label><textarea id="rg_st" maxlength="${UE_SCHADEN_MAX}" placeholder="Wo am Fahrzeug, was genau?">${h(st.schadenText || '')}</textarea><label>Fotos vom Schaden (mindestens 1, höchstens ${UE_SCHADEN_FOTOS})</label><div class="rg-gal">${[1, 2, 3].filter((i) => st.fotos['s' + i]).map((i) => `<figure><img src="${h(st.fotos['s' + i])}" alt=""><figcaption>Foto ${i}</figcaption></figure>`).join('')}</div>`;
        if (n < UE_SCHADEN_FOTOS) inner += `<label class="foto-wahl rg-kam" for="rg_in_s${n + 1}">📷 ${n ? 'Weiteres Foto' : 'Foto aufnehmen'}</label><input type="file" id="rg_in_s${n + 1}" accept="image/*" capture="environment" style="display:none">`;
        if (n) inner += `<button type="button" class="kl" id="rg_sweg" style="margin-top:8px">Letztes Foto entfernen</button>`;
      }
    } else if (sc.typ === 'schluessel') {
      inner = `<h3>Schlüssel</h3><p class="info" style="margin:0 0 8px">Der Schlüssel hängt am Schlüsselbrett der Eltern. Ohne Bestätigung ist die Rückgabe nicht abgeschlossen.</p><button type="button" class="rg-schl${st.schluessel ? ' an' : ''}" id="rg_sc">${st.schluessel ? '✓ ' : ''}Schlüssel hängt am Schlüsselbrett der Eltern</button>`;
    } else {
      const r = pruefeRundgang(st, ctxf());
      if (!r.ok) inner = `<h3>Noch nicht fertig</h3><div class="hinweiskarte rot">${r.fehler.map(h).join('<br>')}</div>`;
      else {
        const { u, fotos } = uebergabeAusRundgang(st, ctxf());
        const nein = Object.values(u.punkte).filter((x) => x === 'nein').length;
        inner = `<h3>Alles erfasst</h3><ul class="info rg-sum"><li>Kilometerstand: <strong>${zahl(u.km)}</strong></li><li>Tank: <strong>${h(u.tank)}</strong>${u.tank !== 'voll' ? ' (nicht voll)' : ''}</li><li>Mängel gemeldet: <strong>${nein}</strong></li><li>Neue Schäden: <strong>${u.schaeden ? 'ja' : 'keine'}</strong></li><li>Fotos: <strong>${Object.keys(fotos).length}</strong></li>${phase === 'rueck' ? '<li>Schlüssel am Brett: <strong>ja</strong></li>' : ''}</ul><p class="info">Datum und Uhrzeit setzt die App beim Abschliessen. Danach lässt sich der Rundgang nur noch ansehen.</p>`;
        weiter = `${name} abschliessen`;
      }
    }
    const letzter = sc.typ === 'ende';
    sheet(`<div class="rg-kopf"><span>${name}</span><span>${idx + 1} von ${L.length}</span><button type="button" class="rg-x" id="rg_x" aria-label="Schliessen, Stand bleibt gespeichert">✕</button></div><div class="rg-bar"><i style="width:${pct}%"></i></div>
      <p class="info" style="margin:0 0 8px">${fmt(b.von)} – ${fmt(b.bis)} · ${h(wer)}</p>${inner}<div id="msg"></div><p class="rg-hint" id="rg_hint"></p>
      <div class="rg-nav">${idx > 0 ? '<button class="gross-btn" id="rg_zu">Zurück</button>' : '<span></span>'}<button class="gross-btn pri" id="rg_weiter">${weiter}</button></div>
      <button type="button" class="rg-spaeter" id="rg_pause">Pause: später weitermachen (Stand bleibt gespeichert)</button>
      <button type="button" class="rg-abbruch" id="rg_abbruch">Abbrechen und alles verwerfen</button>`);
    formEl.onclick = null;
    const wb = document.getElementById('rg_weiter');
    const aktual = () => {
      if (letzter) { const r = pruefeRundgang(st, ctxf()); wb.disabled = !r.ok; return; }
      const r = ok(); wb.disabled = !r.ok; document.getElementById('rg_hint').textContent = r.ok ? '' : r.fehler[0];
    };
    aktual();
    document.getElementById('rg_pause').onclick = () => { merken(); schliessen(); fahrten(); };
    document.getElementById('rg_x').onclick = () => { merken(); schliessen(); fahrten(); };
    document.getElementById('rg_abbruch').onclick = () => { if (confirm(`${name} abbrechen? Alle Fotos und Eingaben dieses Rundgangs werden gelöscht. Es wird nichts gespeichert.`)) { rgLoeschen(bid, phase); schliessen(); fahrten(); hinweis(`${name} abgebrochen. Nichts wurde gespeichert.`); } };
    const zu = document.getElementById('rg_zu'); if (zu) zu.onclick = () => { merken(); idx--; zeige(); };
    if (sc.typ === 'foto') bindFoto(sc.slot);
    if (sc.typ === 'punkt') {
      document.getElementById('rg_ja').onclick = () => { st.punkte[sc.key] = 'ja'; delete st.mangel[sc.key]; delete st.fotos['p_' + sc.key]; vor(); };
      document.getElementById('rg_nein').onclick = () => { st.punkte[sc.key] = 'nein'; merken(); zeige(); };
      const m = document.getElementById('rg_mangel'); if (m) { m.oninput = () => { st.mangel[sc.key] = m.value; merken(); aktual(); }; bindFoto('p_' + sc.key); }
    }
    if (sc.typ === 'km') { const k = document.getElementById('rg_km'); k.oninput = () => { st.km = k.value; merken(); aktual(); }; }
    if (sc.typ === 'tank') {
      formEl.querySelectorAll('[data-tank]').forEach((x) => x.onclick = () => { st.tank = x.dataset.tank; if (st.tank === 'voll') st.tankGrund = ''; merken(); zeige(); });
      const g = document.getElementById('rg_tg'); if (g) g.oninput = () => { st.tankGrund = g.value; merken(); aktual(); };
    }
    if (sc.typ === 'schaden') {
      document.getElementById('rg_sn').onclick = () => { st.schadenJa = false; st.schadenText = ''; for (let i = 1; i <= UE_SCHADEN_FOTOS; i++) delete st.fotos['s' + i]; vor(); };
      document.getElementById('rg_sj').onclick = () => { st.schadenJa = true; merken(); zeige(); };
      const t = document.getElementById('rg_st'); if (t) { t.oninput = () => { st.schadenText = t.value; merken(); aktual(); }; }
      const n = Object.keys(st.fotos).filter((k) => /^s\d$/.test(k)).length;
      if (st.schadenJa && n < UE_SCHADEN_FOTOS) bindFoto('s' + (n + 1));
      const w = document.getElementById('rg_sweg'); if (w) w.onclick = () => { delete st.fotos['s' + n]; merken(); zeige(); };
    }
    if (sc.typ === 'schluessel') document.getElementById('rg_sc').onclick = () => { st.schluessel = !st.schluessel; merken(); zeige(); };
    wb.onclick = () => {
      if (!letzter) { const r = ok(); if (!r.ok) { fehler(r.fehler); return; } vor(); return; }
      const r = pruefeRundgang(st, ctxf()); if (!r.ok) { fehler(r.fehler); return; }
      const { u, fotos } = uebergabeAusRundgang(st, ctxf());
      const letzterKm = Math.max(0, ...Object.values(D.uebergaben).filter((x) => D.buchungen[x.buchungId] && x.km <= u.km).map((x) => x.km));
      if (u.km - letzterKm > 3000 && !confirm(`Der Stand ${zahl(u.km)} km liegt ${zahl(u.km - letzterKm)} km über dem letzten Stand (${zahl(letzterKm)} km). Stimmt das?`)) return;
      sicher(async () => {
        await S.uebergabeMitFotos(D, bid + '_' + phase, u, fotos); rgLoeschen(bid, phase); schliessen(); fahrten();
        hinweis(phase === 'ab' ? 'Übernahme gespeichert.' : 'Rückgabe abgeschlossen, Schlüssel quittiert.');
        if (tankWarnung(u)) { sheet(`<h3>Tank nicht voll</h3><div class="hinweiskarte rot">Gespeichert. Der Tank ist nicht voll (${h(u.tank)}). Bitte die anderen warnen.</div><div class="aktion"><button id="abb">Schliessen</button><a class="primaer" style="text-decoration:none;text-align:center;display:block;padding:14px" href="${waLink(tankText(u.tank, u.datumZeit, D.personen[u.erfasstVon]?.name || '?'))}" target="_blank" rel="noopener">Familie per WhatsApp warnen</a></div>`); document.getElementById('abb').onclick = schliessen; }
      });
    };
  };
  zeige();
}
// Fotos einer gespeicherten Uebergabe ansehen (werden erst jetzt aus der Datenbank geholt).
async function fotosAnzeigen(id) {
  const box = document.getElementById('ufotos'); if (!box) return;
  box.innerHTML = '<p class="info" style="margin:6px 0">Fotos werden geladen …</p>';
  try {
    const L = await S.fotosLaden(D, id);
    if (!document.getElementById('ufotos')) return;
    const ord = (s) => { const k = Object.keys(UE_FOTO_PFLICHT).indexOf(s); return k >= 0 ? k : 50 + s.charCodeAt(0) * 10 + (s.charCodeAt(1) || 0); };
    L.sort((x, y) => ord(x.slot) - ord(y.slot));
    box.innerHTML = L.length ? `<label>Fotos (${L.length}), Tipp: gross ansehen</label><div class="rg-gal">${L.map((f) => `<figure><img src="${h(f.foto)}" alt="" data-gross="1"><figcaption>${h(ueFotoName(f.slot))}</figcaption></figure>`).join('')}</div>` : '';
    box.querySelectorAll('[data-gross]').forEach((i) => i.onclick = () => fotoGross(i.src));
  } catch (e) { box.innerHTML = `<p class="info" style="margin:6px 0">Die Fotos konnten nicht geladen werden (${h(e.message || e)}).</p>`; }
}

// =====================================================================
// Notfallkarte: Angaben erfassen (Tab «Unterwegs») und Auszug fuer die Offline-Seite notfall.html im Handy ablegen
// =====================================================================
let auszugLetzter = '', auszugTimer = 0;
function notfallMerken() {
  clearTimeout(auszugTimer);
  auszugTimer = setTimeout(() => {
    try {
      const a = notfallAuszug(D, heute(), new Date().toISOString());
      const s = JSON.stringify({ ...a, stand: '' });
      if (s === auszugLetzter) return;
      try { localStorage.setItem('womo-notfall', JSON.stringify(a)); }
      catch { const k = { ...a, fz: Object.fromEntries(Object.entries(a.fz).map(([n, x]) => [n, { wert: x.wert, foto: '' }])) }; localStorage.setItem('womo-notfall', JSON.stringify(k)); }   // zu wenig Platz: ohne Fotos
      auszugLetzter = s;
    } catch {}
  }, 1500);
}
function notfallForm() {
  const nf = D.notfall, fzE = (k) => nf['fz_' + k], pE = nf['p_' + ich] || {};
  const feld = ([k, name, hint]) => {
    const e = fzE(k), fremd = e && e.erfasstVon !== ich;
    return `<label for="nf_${k}">${h(name)}${fremd ? ` <span style="font-weight:500">(von ${h(D.personen[e.erfasstVon]?.name || '?')}, nur diese Person ändert)</span>` : ''}</label><input id="nf_${k}" maxlength="${NOTFALL_WERT_MAX}" placeholder="${h(hint)}" value="${h(e?.wert || (k === 'gewicht' ? '3500 kg' : ''))}" ${fremd ? 'disabled' : ''}>`;
  };
  const dok = ([k, name]) => {
    const e = fzE(k), fremd = e && e.erfasstVon !== ich;
    return `<label>${h(name)} (Foto)${fremd ? ` <span style="font-weight:500">(von ${h(D.personen[e.erfasstVon]?.name || '?')})</span>` : ''}</label><div id="nd_${k}">${e?.foto ? `<div class="foto-vor"><img src="${h(e.foto)}" alt="${h(name)}"><span class="info" style="margin:0">Gespeichert (${Math.round(e.foto.length / 1024)} KB)</span></div>` : '<p class="info" style="margin:0">Noch kein Foto.</p>'}</div>
      ${fremd ? '' : `<label class="foto-wahl" for="nfd_${k}" id="nfw_${k}">📷 ${e?.foto ? 'Anderes Foto wählen' : 'Foto aufnehmen oder wählen'}</label><input type="file" id="nfd_${k}" accept="image/*" style="display:none">`}`;
  };
  const andere = Object.entries(D.personen).filter(([id]) => id !== ich).map(([id, p]) => { const x = nf['p_' + id]; return `<li>${h(p.name)}: ${x?.tel ? h(x.tel) : '<em>fehlt</em>'}</li>`; }).join('');
  sheet(`<h3>Notfallkarte: Angaben</h3><p class="info" style="margin:0 0 6px">Alles, was Helfer, Polizei oder Versicherung im Notfall brauchen. Leere Felder sind in Ordnung, aber jede Angabe hilft. Wer eine Angabe erfasst hat, ändert sie später allein.</p>
  <p class="titel" style="margin:16px 0 0">Meine Angaben</p>
  <label for="nf_tel">Meine Telefonnummer</label><input id="nf_tel" type="tel" inputmode="tel" maxlength="${NOTFALL_TEL_MAX}" placeholder="+41 79 123 45 67" value="${h(pE.tel || '')}">
  <label for="nf_med">Medizinischer Hinweis (freiwillig)</label><input id="nf_med" maxlength="${NOTFALL_MED_MAX}" placeholder="z. B. Allergie gegen Penicillin, Blutgruppe" value="${h(pE.medizin || '')}">
  <p class="info" style="margin:6px 0 0">Der Hinweis erscheint nur in der Notfallkarte neben deinem Namen. Wer nichts angeben will, lässt das Feld leer.</p>
  ${andere ? `<p class="info" style="margin:10px 0 0">Nummern der anderen (jeder trägt seine eigene ein):</p><ul class="info" style="margin:2px 0 0;padding-left:18px">${andere}</ul>` : ''}
  <p class="titel" style="margin:20px 0 0">Fahrzeug</p>${NOTFALL_FELDER.map(feld).join('')}
  <p class="titel" style="margin:20px 0 0">Dokumente als Foto</p><p class="info" style="margin:0">Gut lesbar, bei Licht, flach auf den Tisch. Die Polizei verlangt sie oft.</p>${NOTFALL_DOKUMENTE.map(dok).join('')}
  <div id="msg"></div><div class="t-akt2"><button class="gross-btn pri" id="nf_ok">Speichern</button><button class="gross-btn" id="abb">Abbrechen</button></div>`);
  document.getElementById('abb').onclick = schliessen;
  const fotos = {};
  NOTFALL_DOKUMENTE.forEach(([k, name]) => {
    const inp = document.getElementById('nfd_' + k); if (!inp) return;
    inp.onchange = async (ev) => {
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      document.getElementById('nd_' + k).innerHTML = '<p class="info" style="margin:0">Foto wird verkleinert …</p>';
      try { fotos[k] = await fotoVerkleinern(f, NOTFALL_DOK_MAX - 20000); document.getElementById('nd_' + k).innerHTML = `<div class="foto-vor"><img src="${h(fotos[k])}" alt="${h(name)}"><span class="info" style="margin:0">Neu (${Math.round(fotos[k].length / 1024)} KB), noch nicht gespeichert</span></div>`; }
      catch (x) { delete fotos[k]; document.getElementById('nd_' + k).innerHTML = ''; fehler('Das Foto konnte nicht verarbeitet werden: ' + (x.message || x)); }
    };
  });
  document.getElementById('nf_ok').onclick = () => sicher(async () => {
    const tel = val('nf_tel').trim(), med = val('nf_med').trim(), fe = pruefeNotfallTel(tel);
    if (fe.length) { fehler(fe); return; }
    if (tel || med || nf['p_' + ich]) await S.speichern(D, 'notfall', 'p_' + ich, { art: 'person', personId: ich, tel, medizin: med, erfasstVon: ich, erfasstAm: pE.erfasstAm });
    for (const [k] of NOTFALL_FELDER) {
      const e = fzE(k); if (e && e.erfasstVon !== ich) continue;
      const w = val('nf_' + k).trim();
      if (w) { if (!e || e.wert !== w) await S.speichern(D, 'notfall', 'fz_' + k, { art: 'fz', schluessel: k, wert: w, foto: e?.foto, erfasstVon: ich, erfasstAm: e?.erfasstAm }); }
      else if (e && !e.foto) await S.loeschen(D, 'notfall', 'fz_' + k);
    }
    for (const [k] of NOTFALL_DOKUMENTE) {
      const e = fzE(k); if (e && e.erfasstVon !== ich) continue;
      if (fotos[k]) await S.speichern(D, 'notfall', 'fz_' + k, { art: 'fz', schluessel: k, wert: '', foto: fotos[k], erfasstVon: ich, erfasstAm: e?.erfasstAm });
    }
    schliessen(); unterwegs(); notfallMerken(); hinweis('Notfallkarte gespeichert. Sie liegt jetzt auch ohne Netz auf deinem Handy.');
  });
}

// =====================================================================
// Unsere Orte: nur das Allerbeste, mit Foto und kurzer Begruendung
// =====================================================================
const ortListe = () => Object.values(D.orte);
const ortStimmenListe = () => D.ortstimmen;
const ortKartenLink = (o) => o.lat != null && o.lon != null ? `https://maps.apple.com/?ll=${o.lat},${o.lon}&q=${encodeURIComponent(o.titel)}` : o.kartenlink ? o.kartenlink : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${o.titel} ${o.ort} ${o.land}`);
const ORT_STERN = '<path d="M12 3l2.600 5.600 6.100.700-4.500 4.200 1.200 6L12 16.600 6.600 19.500l1.200-6L3.300 9.300l6.100-.700z"/>';
function orteKarte() {
  const reihe = ortReihenfolge(ortListe(), ortStimmenListe());
  const frei = pruefeOrt({ erfasstVon: ich, erfasstAm: new Date().toISOString() }, { heute: heute(), buchungen: {}, orte: ortListe() }).platzFrei;
  const kachel = ({ o, s }) => `<button class="ort" data-ort="${h(o.id)}"><span class="ort-bild"><img src="${h(o.foto)}" alt="" loading="lazy">${s.favorit ? `<span class="ort-fav"><svg viewBox="0 0 24 24" aria-hidden="true">${ORT_STERN}</svg> Familien-Favorit</span>` : ''}</span>
    <span class="ort-tx"><strong>${h(o.titel)}${neuPille(o)}</strong><small>${h(o.land)} · ${h(o.ort)} · ${h(o.art)}</small><span class="ort-bes">${h(o.text)}</span><small>${s.anzahl ? `✓ bestätigt von ${s.bestaetigt.map((i) => h(D.personen[i]?.name || '?')).join(', ')}` : `von ${h(D.personen[o.erfasstVon]?.name || '?')}`}</small></span></button>`;
  return `<div class="karte ort-karte"><div class="ort-kopf"><p class="titel" style="margin:0">Unsere besten Orte</p><button class="t-plus lang" id="ort_neu">＋ Ort</button></div>
    <p class="info" style="margin:6px 0 10px">Nur Orte, an die wir wieder hinfahren würden. Foto und Begründung sind Pflicht, höchstens ${ORT_PRO_JAHR} Orte pro Person und Jahr. Andere bestätigen mit «war auch dort». Ab ${ORT_FAVORIT_AB} Bestätigungen wird ein Ort Familien-Favorit.</p>
    ${reihe.length ? `<div class="ort-liste">${reihe.map(kachel).join('')}</div>` : '<p class="leer-t" style="margin:6px 0 0">Noch kein Ort. Nach einer Reise, wenn ein Platz wirklich begeistert hat: hier eintragen.</p>'}
    <p class="info" style="margin:10px 0 0">Du hast dieses Jahr noch <strong>${frei} von ${ORT_PRO_JAHR}</strong> Plätzen frei.</p></div>`;
}
function bindNotfallOrte() {
  const e = document.getElementById('nf_edit'); if (e) e.onclick = notfallForm;
  const n = document.getElementById('ort_neu'); if (n) n.onclick = () => ortForm();
  app.querySelectorAll('[data-ort]').forEach((b) => b.onclick = () => ortDetail(b.dataset.ort));
  bindNeu();
}
function ortForm(id) {
  const ex = id ? D.orte[id] : null;
  if (ex && !eigener(ex)) return nurEigene();
  const t = heute();
  const meine = liste().filter((b) => b.von <= t && (b.fahrerId === ich || (b.mitreisende || []).includes(ich)) && (!ortListe().some((o) => o.buchungId === b.id && o.erfasstVon === ich) || (ex && ex.buchungId === b.id))).sort((a, b) => (a.von < b.von ? 1 : -1));
  const chk = pruefeOrt({ erfasstVon: ich, erfasstAm: ex?.erfasstAm || new Date().toISOString() , id }, { heute: t, buchungen: {}, orte: ortListe() });
  if (!ex && chk.platzFrei === 0) { hinweis(`Du hast dieses Jahr schon ${ORT_PRO_JAHR} Orte eingetragen. Mehr geht nicht. Einen eigenen Ort löschen macht einen Platz frei.`); return; }
  if (!ex && !meine.length) { hinweis('Ein Ort geht nur von einer eigenen Reise (auch während der Reise), von der du noch keinen Ort eingetragen hast.'); return; }
  const zielLand = (b) => ORT_LAENDER.find((l) => (b?.ziel || '').toLowerCase().includes(l.toLowerCase())) || '';
  const b0 = ex ? D.buchungen[ex.buchungId] : meine[0];
  let foto = ex?.foto || '', pos = ex && ex.lat != null ? { lat: ex.lat, lon: ex.lon } : null;
  sheet(`<h3>${ex ? 'Ort ändern' : 'Neuer Ort'}</h3>
  <div class="ort-tor">Nur Orte, für die wir <strong>extra wieder hinfahren</strong> würden. Mittelmässig? Dann nicht eintragen.${ex ? '' : ` Du hast noch ${chk.platzFrei} von ${ORT_PRO_JAHR} Plätzen dieses Jahr.`}</div>
  <label for="o_reise">Auf welcher Reise warst du dort?</label><select id="o_reise" ${ex ? 'disabled' : ''}>${(ex ? [b0] : meine).filter(Boolean).map((b) => `<option value="${h(b.id)}" ${b.id === b0?.id ? 'selected' : ''}>${h(reiseText(b))}${b.ziel ? ' · ' + h(b.ziel) : ''}</option>`).join('')}</select>
  <label for="o_titel">Name des Ortes</label><input id="o_titel" maxlength="60" placeholder="z. B. Camping Seeblick" value="${h(ex?.titel || '')}">
  <div class="zwei"><div><label for="o_land">Land</label><select id="o_land"><option value="">Wählen</option>${ORT_LAENDER.map((l) => `<option ${l === (ex?.land || zielLand(b0)) ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></div>
  <div><label for="o_ort">Ortschaft oder Gegend</label><input id="o_ort" maxlength="60" placeholder="z. B. Gardasee" value="${h(ex?.ort || '')}"></div></div>
  <label for="o_art">Art</label><select id="o_art">${ORT_ARTEN.map((a) => `<option ${a === (ex?.art || 'Stellplatz') ? 'selected' : ''}>${h(a)}</option>`).join('')}</select>
  <p class="info" style="margin:4px 0 0">Nur Orte, wo Übernachten erlaubt ist (Vertrag Ziffer 9).</p>
  <label for="o_text">Was macht diesen Ort aussergewöhnlich? <span id="o_zaehl" style="font-weight:500"></span></label><textarea id="o_text" maxlength="${ORT_TEXT_MAX}" placeholder="Kurz und konkret: Was haben wir gesehen, gehört, erlebt?">${h(ex?.text || '')}</textarea>
  <label for="o_prakt">Praktisches (freiwillig)</label><input id="o_prakt" maxlength="${ORT_PRAKTISCH_MAX}" placeholder="z. B. Preis, Strom, beste Plätze, Zufahrt" value="${h(ex?.praktisch || '')}">
  <label>Foto (Pflicht)</label><div id="o_fprev"></div><label class="foto-wahl" for="o_foto" id="o_fwahl">📷 Foto aufnehmen oder auswählen</label><input type="file" id="o_foto" accept="image/*" style="display:none">
  <label>Standort (freiwillig)</label><div id="o_pos" class="info" style="margin:0"></div><button type="button" class="gross-btn" id="o_gps" style="width:100%;margin-top:6px">📍 Meinen jetzigen Standort einfügen</button>
  <input id="o_link" maxlength="300" inputmode="url" placeholder="oder: Link aus Karten oder Google Maps einfügen" value="${h(ex?.kartenlink || '')}" style="margin-top:8px">
  <label class="ort-chk"><input type="checkbox" id="o_wieder" ${ex?.wiederHin ? 'checked' : ''}> Ich würde für diesen Ort <strong>extra wieder hinfahren</strong>.</label>
  <div id="msg"></div><div class="t-akt2"><button class="gross-btn pri" id="o_ok">Speichern</button><button class="gross-btn" id="abb">Abbrechen</button></div>`);
  document.getElementById('abb').onclick = schliessen;
  const zaehl = () => { const n = val('o_text').trim().length; document.getElementById('o_zaehl').textContent = `(${n} von ${ORT_TEXT_MIN} bis ${ORT_TEXT_MAX})`; document.getElementById('o_zaehl').style.color = n >= ORT_TEXT_MIN ? 'var(--ok-t)' : 'var(--muted)'; };
  document.getElementById('o_text').oninput = zaehl; zaehl();
  const vor = () => { document.getElementById('o_fprev').innerHTML = foto ? `<div class="foto-vor"><img src="${h(foto)}" alt="Vorschau"><span class="info" style="margin:0">${Math.round(foto.length / 1024)} KB</span></div>` : '<p class="info" style="margin:0">Noch kein Foto.</p>'; document.getElementById('o_fwahl').textContent = foto ? '📷 Anderes Foto wählen' : '📷 Foto aufnehmen oder auswählen'; };
  vor();
  const posAnz = () => { document.getElementById('o_pos').textContent = pos ? `Gespeichert: ${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}` : 'Kein Standort. Der Ort wird sonst über Name und Ortschaft in der Karte gesucht.'; };
  posAnz();
  document.getElementById('o_foto').onchange = async (ev) => {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    document.getElementById('o_fprev').innerHTML = '<p class="info" style="margin:0">Foto wird verkleinert …</p>';
    try { foto = await fotoVerkleinern(f); } catch (x) { fehler('Das Foto konnte nicht verarbeitet werden: ' + (x.message || x)); }
    vor();
  };
  document.getElementById('o_gps').onclick = () => {
    if (!navigator.geolocation) { fehler('Dieses Gerät kann den Standort nicht bestimmen.'); return; }
    document.getElementById('o_pos').textContent = 'Standort wird gesucht …';
    navigator.geolocation.getCurrentPosition((p) => { pos = { lat: Math.round(p.coords.latitude * 1e5) / 1e5, lon: Math.round(p.coords.longitude * 1e5) / 1e5 }; posAnz(); }, () => { posAnz(); fehler('Standort nicht möglich. Du kannst stattdessen einen Kartenlink einfügen oder es leer lassen.'); }, { enableHighAccuracy: true, timeout: 20000 });
  };
  document.getElementById('o_ok').onclick = () => sicher(async () => {
    const link = val('o_link').trim();
    if (link && !/^https:\/\/\S+$/.test(link)) { fehler('Der Kartenlink muss mit https:// beginnen.'); return; }
    const o = { titel: val('o_titel').trim(), land: val('o_land'), ort: val('o_ort').trim(), art: val('o_art'), text: val('o_text').trim(), praktisch: val('o_prakt').trim() || undefined, foto, buchungId: ex ? ex.buchungId : val('o_reise'),
      lat: pos ? pos.lat : undefined, lon: pos ? pos.lon : undefined, kartenlink: link || undefined, wiederHin: document.getElementById('o_wieder').checked, besuchtAm: D.buchungen[ex ? ex.buchungId : val('o_reise')]?.von, erfasstVon: ex ? ex.erfasstVon : ich, erfasstAm: ex?.erfasstAm || new Date().toISOString(), id };
    const p = pruefeOrt(o, { heute: heute(), buchungen: D.buchungen, orte: ortListe() });
    if (!p.ok) { fehler(p.fehler); return; }
    const nid = await S.speichern(D, 'orte', id, o); schliessen(); unterwegs(); hinweis('Ort gespeichert. Die anderen können ihn jetzt bestätigen.'); ortDetail(nid);
  });
}
function ortDetail(id) {
  const o = D.orte[id]; if (!o) return;
  const s = ortStand(o, ortStimmenListe()), mein = eigener(o), stimmeId = id + '_' + ich, habe = !!D.ortstimmen[stimmeId];
  const b = D.buchungen[o.buchungId];
  sheet(`<img class="w-foto ort-gross" id="ort_fbig" src="${h(o.foto)}" alt="Foto: ${h(o.titel)}">
  <h3 style="margin-top:4px">${h(o.titel)}</h3>
  ${s.favorit ? `<div class="ort-favband"><svg viewBox="0 0 24 24" aria-hidden="true">${ORT_STERN}</svg> Familien-Favorit</div>` : ''}
  <p class="info" style="margin:2px 0 8px">${h(o.land)} · ${h(o.ort)} · ${h(o.art)}</p>
  <p style="margin:0 0 10px;font-size:17px">${h(o.text)}</p>
  ${o.praktisch ? `<p class="info" style="margin:0 0 10px"><strong>Praktisches:</strong> ${h(o.praktisch)}</p>` : ''}
  <p class="info" style="margin:0 0 4px">Eingetragen von ${h(D.personen[o.erfasstVon]?.name || '?')}${b ? ', Reise ' + h(reiseText(b)) : ''}.</p>
  <p class="info" style="margin:0">${s.anzahl ? `✓ War auch dort und bestätigt: ${s.bestaetigt.map((i) => h(D.personen[i]?.name || '?')).join(', ')}.` : 'Noch von niemandem bestätigt.'}</p>
  <div class="t-akt2"><a class="gross-btn pri" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${h(ortKartenLink(o))}" target="_blank" rel="noopener">In der Karte öffnen</a>
  ${!mein && !habe ? '<button class="gross-btn" id="ort_ja">✓ Ich war auch dort: bestätigen</button>' : ''}
  ${!mein && habe ? '<button class="gross-btn" id="ort_weg">Meine Bestätigung zurückziehen</button>' : ''}
  ${mein ? '<button class="gross-btn" id="ort_edit">Ändern</button><button class="gross-btn rot" id="ort_del">Löschen</button>' : ''}
  <button class="gross-btn" id="abb">Schliessen</button></div><div id="msg"></div>`);
  document.getElementById('abb').onclick = schliessen;
  document.getElementById('ort_fbig').onclick = () => fotoGross(o.foto);
  const ja = document.getElementById('ort_ja'), weg = document.getElementById('ort_weg'), ed = document.getElementById('ort_edit'), del = document.getElementById('ort_del');
  if (ja) ja.onclick = () => sicher(async () => { await S.speichern(D, 'ortstimmen', stimmeId, { ortId: id, personId: ich, erfasstVon: ich }); ortDetail(id); unterwegs(); hinweis('Danke, bestätigt.'); });
  if (weg) weg.onclick = () => sicher(async () => { await S.loeschen(D, 'ortstimmen', stimmeId); ortDetail(id); unterwegs(); });
  if (ed) ed.onclick = () => ortForm(id);
  if (del) del.onclick = () => { if (confirm('Ort löschen? Das Foto und alle Bestätigungen gehen verloren.')) sicher(async () => { for (const v of Object.values(D.ortstimmen).filter((x) => x.ortId === id)) await S.loeschen(D, 'ortstimmen', v.id); await S.loeschen(D, 'orte', id); schliessen(); unterwegs(); }); };
}

start();
