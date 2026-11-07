// Speicherschicht. Mit Code im Link (#CODE): Firestore (familien/{code}/...).
// Ohne Code: lokaler Testmodus im Browser (nur auf localhost). Mit ?emulator: Firestore-Emulator (nur Tests).
import { firebaseConfig } from './firebase-config.js';
import { tageListe } from './regeln.js';

const V = '11.0.2';
const KEY = 'womo-test-v1';
export const SAMMLUNGEN = ['buchungen', 'uebergaben', 'kosten', 'einzahlungen', 'termine', 'zahlstatus'];

// Code aus dem Link; wird auf dem Geraet gemerkt, falls der Startbildschirm-Icon ohne Code oeffnet.
const KEY_CODE = 'womo-code';
const imLink = decodeURIComponent(location.hash.replace(/^#/, '')).trim();
let gemerkt = '';
try { if (imLink) localStorage.setItem(KEY_CODE, imLink); else gemerkt = localStorage.getItem(KEY_CODE) || ''; } catch {}
export const code = imLink || gemerkt;
export const online = code.length > 0;
const lokalerTest = ['localhost', '127.0.0.1'].includes(location.hostname);
const emulator = new URLSearchParams(location.search).has('emulator');

async function hash(pin) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('womo:' + pin));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function pinPasst(person, pin) { return person.pinHash === await hash(pin); }

// ---------- Firestore ----------
let fs, db;
async function fsInit() {
  if (db) return;
  const app = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  fs = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  db = fs.getFirestore(app.initializeApp(firebaseConfig));
  if (emulator) fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
const sauber = (o) => JSON.parse(JSON.stringify(o)); // entfernt undefined

// ---------- lokal (Testmodus) ----------
function lesen() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
function schreiben(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} }
function ergaenzen(d) { for (const s of SAMMLUNGEN) d[s] = d[s] || {}; d.start = d.start || ''; return d; }

export async function laden() {
  if (!online && !lokalerTest) throw new Error('Bitte die Womo-App über den Link mit dem Code öffnen.');
  if (online) {
    await fsInit();
    const fam = await fs.getDoc(fs.doc(db, 'familien', code));
    if (!fam.exists()) throw new Error('Dieser Link ist ungültig.');
    const d = ergaenzen({ personen: {}, adminId: fam.data().adminId, start: fam.data().start || '' });
    (await fs.getDocs(fs.collection(db, 'familien', code, 'personen'))).forEach((x) => { d.personen[x.id] = x.data(); });
    for (const s of SAMMLUNGEN) (await fs.getDocs(fs.collection(db, 'familien', code, s))).forEach((x) => { d[s][x.id] = { ...x.data(), id: x.id }; });
    return d;
  }
  let d = lesen();
  if (!d) {
    const h = await hash('1111'); // TESTDATEN, PIN aller Personen: 1111
    d = { personen: {
      hp: { name: 'HP', konto: 'eltern', pinHash: h }, fr: { name: 'Nora', konto: 'eltern', pinHash: h },
      t: { name: 'Nanouk', konto: 'kind-1', pinHash: h }, s: { name: 'Nene', konto: 'kind-2', pinHash: h } },
      adminId: 'hp' };
    ergaenzen(d); schreiben(d);
  }
  return ergaenzen(d);
}

// Live-Updates: gleiche Familie auf anderen Handys. cb() wird bei Aenderungen gerufen.
export async function abonnieren(d, cb) {
  if (!online) return;
  await fsInit();
  for (const s of SAMMLUNGEN) {
    fs.onSnapshot(fs.collection(db, 'familien', code, s), (snap) => {
      const neu = {}; snap.forEach((x) => { neu[x.id] = { ...x.data(), id: x.id }; }); d[s] = neu; cb();
    });
  }
  fs.onSnapshot(fs.doc(db, 'familien', code), (x) => { if (x.exists()) { d.start = x.data().start || ''; d.adminId = x.data().adminId; cb(); } });
}

// Allgemein: Dokument in einer Sammlung speichern / loeschen.
export async function speichern(d, sammlung, id, daten) {
  const neuId = id || sammlung.slice(0, 1) + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const voll = sauber({ ...daten, id: neuId, erfasstAm: daten.erfasstAm || new Date().toISOString() });
  if (online) await fs.setDoc(fs.doc(db, 'familien', code, sammlung, neuId), voll);
  d[sammlung][neuId] = voll;
  if (!online) schreiben(d);
  return neuId;
}
export async function loeschen(d, sammlung, id) {
  if (online) await fs.deleteDoc(fs.doc(db, 'familien', code, sammlung, id));
  delete d[sammlung][id];
  if (!online) schreiben(d);
}
// Uebergabedatum des Fahrzeugs (Beginn Vertragsjahr 1)
export async function startSetzen(d, iso) {
  if (online) await fs.updateDoc(fs.doc(db, 'familien', code), { start: iso });
  d.start = iso;
  if (!online) schreiben(d);
}

// Reservierungen mit Tagessperre: pro belegtem Tag gibt es ein Dokument tage/{Datum}. Es kann nur neu angelegt, nie
// ueberschrieben werden (Datenbankregel). Belegt jemand denselben Tag gleichzeitig, schlaegt der ganze Schreibvorgang fehl.
// Reservierung und Tagessperren werden in einem Schritt geschrieben (alles oder nichts).
function tageVon(b) { return b ? tageListe(b.von, b.bis) : []; }

export async function buchungSpeichern(d, b) {
  const id = b.id || 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const voll = sauber({ ...b, id, erfasstAm: b.erfasstAm || new Date().toISOString() });
  const neu = tageVon(voll), alt = tageVon(d.buchungen[id]);
  if (online) {
    await fsInit();
    const batch = fs.writeBatch(db);
    for (const t of alt) if (!neu.includes(t)) batch.delete(fs.doc(db, 'familien', code, 'tage', t));
    for (const t of neu) if (!alt.includes(t)) batch.set(fs.doc(db, 'familien', code, 'tage', t), { buchungId: id });
    batch.set(fs.doc(db, 'familien', code, 'buchungen', id), voll);
    try { await batch.commit(); }
    catch (e) {
      if (e && e.code === 'permission-denied') throw new Error('Dieser Zeitraum wurde soeben von jemand anderem reserviert. Bitte ein anderes Datum wählen.');
      throw e;
    }
  }
  d.buchungen[id] = voll;
  if (!online) schreiben(d);
  return id;
}
export async function buchungLoeschen(d, id) {
  if (online) {
    await fsInit();
    const batch = fs.writeBatch(db);
    for (const t of tageVon(d.buchungen[id])) batch.delete(fs.doc(db, 'familien', code, 'tage', t));
    batch.delete(fs.doc(db, 'familien', code, 'buchungen', id));
    await batch.commit();
  }
  delete d.buchungen[id];
  if (!online) schreiben(d);
}

// Einrichtung (nur einrichtung.html): Person mit PIN anlegen.
export async function personAnlegen(id, name, konto, pin) {
  await fsInit();
  await fs.setDoc(fs.doc(db, 'familien', code, 'personen', id), { name, konto, pinHash: await hash(pin) });
}
export async function personenVorhanden() {
  await fsInit();
  return (await fs.getDocs(fs.collection(db, 'familien', code, 'personen'))).size;
}
export function zuruecksetzen() { try { localStorage.removeItem(KEY); } catch {} }
