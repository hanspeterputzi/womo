import { SCHWELLE, dauer, konten, kontostaende, stufe, kollision, pruefeBuchung } from './regeln.js';
import * as S from './speicher.js';

const app = document.getElementById('app');
const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const KONTO_NAME = { 'eltern': 'Eltern', 'kind-1': 'Nanouk', 'kind-2': 'Nene' };
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const iso = (j, m, t) => `${j}-${String(m + 1).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
const fmt = (s) => s.split('-').reverse().join('.');

let D, ich = null, ansicht = new Date(), formular = null;

function liste() { return Object.values(D.buchungen); }
function farbKonto(b) { return konten(b, D.personen)[0] || 'eltern'; }

async function start() {
  try { D = await S.laden(); }
  catch (e) { app.innerHTML = `<h1>Womo</h1><div class="fehler">${h(e.message || 'Verbindung fehlgeschlagen.')}</div>`; return; }
  S.abonnieren(D, () => { const f = document.getElementById('form'); if (ich && f && f.innerHTML === '') kalender(); });
  try { const id = sessionStorage.getItem('womo-ich'); if (id && D.personen[id]) ich = id; } catch {}
  zeige();
}

function zeige() { ich ? kalender() : anmeldung(); }

function anmeldung() {
  app.innerHTML = `<h1>Womo</h1><div class="card"><label>Wer bist du?</label>
  <select id="p">${Object.entries(D.personen).map(([i, p]) => `<option value="${i}">${h(p.name)}</option>`).join('')}</select>
  <label>PIN (4 Ziffern)</label><input id="pin" inputmode="numeric" maxlength="4" autocomplete="off" type="password">
  <div id="msg"></div><p><button class="primaer" id="ok">Weiter</button></p>
  <p class="klein-t">Der PIN zeigt nur, wer eine Buchung erfasst. Er schützt keine Daten.</p></div>`;
  document.getElementById('ok').onclick = async () => {
    const id = document.getElementById('p').value, pin = document.getElementById('pin').value;
    if (await S.pinPasst(D.personen[id], pin)) { ich = id; try { sessionStorage.setItem('womo-ich', id); } catch {} zeige(); }
    else document.getElementById('msg').innerHTML = '<div class="fehler">PIN falsch.</div>';
  };
}

function kontoPanel(J) {
  const st = kontostaende(liste(), D.personen, J);
  return `<div class="card"><div class="zeile mitte"><strong>Tageskonto ${J}</strong><span class="klein-t">Warnung gelb ab 90 %, rot darüber</span></div>` +
    Object.keys(SCHWELLE).map((k) => {
      const t = st[k], s = stufe(t, k), pr = Math.min(100, Math.round(t / SCHWELLE[k] * 100));
      const txt = s === 'rot' ? `rottxt">${t} von ${SCHWELLE[k]} · überschritten` : s === 'gelb' ? `gelbtxt">${t} von ${SCHWELLE[k]} · bald erreicht` : `">${t} von ${SCHWELLE[k]} Tagen`;
      return `<div class="konto"><div class="zeile mitte"><span>${KONTO_NAME[k]}</span><span class="${txt}</span></div><div class="balken ${s}"><i style="width:${pr}%"></i></div></div>`;
    }).join('') + '</div>';
}

function kalender() {
  const J = ansicht.getFullYear(), M = ansicht.getMonth();
  const erster = new Date(J, M, 1), n = new Date(J, M + 1, 0).getDate();
  const versatz = (erster.getDay() + 6) % 7, heute = new Date();
  const bs = liste();
  let zellen = ['Mo','Di','Mi','Do','Fr','Sa','So'].map((x) => `<div class="kopf">${x}</div>`).join('');
  for (let i = 0; i < versatz; i++) zellen += '<div class="tag leer"></div>';
  for (let t = 1; t <= n; t++) {
    const d = iso(J, M, t), hier = bs.filter((b) => b.von <= d && d <= b.bis);
    const ist = hier.length > 1 ? ' koll' : '';
    const hz = heute.getFullYear() === J && heute.getMonth() === M && heute.getDate() === t ? ' heute' : '';
    zellen += `<div class="tag${ist}${hz}" data-d="${d}">${t}${hier.map((b) => `<span class="bal ${farbKonto(b)}">${h(D.personen[b.fahrerId]?.name || b.ausnahmeFahrer?.name || '')}</span>`).join('')}</div>`;
  }
  const monatsB = bs.filter((b) => b.von <= iso(J, M, n) && b.bis >= iso(J, M, 1)).sort((a, b) => a.von < b.von ? -1 : 1);
  const kolls = monatsB.filter((a, i) => monatsB.some((b, j) => i !== j && kollision(a, b)));
  app.innerHTML = `<div class="zeile mitte"><h1>Womo</h1><span class="klein-t">${h(D.personen[ich].name)} · <a href="#" id="aus">wechseln</a></span></div>
  ${kontoPanel(J)}
  <div class="card"><div class="zeile mitte"><button id="zu">‹</button><strong>${MONATE[M]} ${J}</strong><button id="vor">›</button></div>
  <div class="monat" style="margin-top:8px">${zellen}</div>
  <p><button class="primaer" id="neu">Neue Reservierung</button></p>
  ${kolls.length ? `<div class="warn">Achtung: Überschneidung im ${MONATE[M]}. Bitte im Gespräch lösen.</div>` : ''}</div>
  <div class="card"><strong>Buchungen im ${MONATE[M]}</strong>${monatsB.length ? monatsB.map(buchungHtml).join('') : '<p class="klein-t">Keine.</p>'}</div>
  <div id="form"></div>`;
  document.getElementById('zu').onclick = () => { ansicht = new Date(J, M - 1, 1); kalender(); };
  document.getElementById('vor').onclick = () => { ansicht = new Date(J, M + 1, 1); kalender(); };
  document.getElementById('aus').onclick = (e) => { e.preventDefault(); ich = null; try { sessionStorage.removeItem('womo-ich'); } catch {} zeige(); };
  document.getElementById('neu').onclick = () => formularZeigen('');
  app.querySelectorAll('.tag[data-d]').forEach((el) => el.onclick = () => formularZeigen(el.dataset.d));
  app.querySelectorAll('[data-del]').forEach((el) => el.onclick = async () => {
    if (confirm('Reservierung löschen?')) { await S.buchungLoeschen(D, el.dataset.del); kalender(); }
  });
}

function buchungHtml(b) {
  const wer = D.personen[b.fahrerId]?.name || b.ausnahmeFahrer?.name || '?';
  const mit = (b.mitreisende || []).map((i) => D.personen[i]?.name).filter(Boolean);
  const darf = b.erfasstVon === ich || ich === D.adminId;
  return `<div class="b"><div class="zeile mitte"><span><strong>${fmt(b.von)} – ${fmt(b.bis)}</strong> · ${dauer(b)} Tage</span>
  ${darf ? `<button class="klein" data-del="${b.id}">Löschen</button>` : ''}</div>
  <div class="klein-t">Fahrer: ${h(wer)}${mit.length ? ' · mit ' + h(mit.join(', ')) : ''}${b.gaeste ? ' · ' + b.gaeste + ' Gast/Gäste' : ''}${b.ziel ? ' · ' + h(b.ziel) : ''}<br>Zählt für: ${konten(b, D.personen).map((k) => KONTO_NAME[k]).join(' und ')} · erfasst von ${h(D.personen[b.erfasstVon]?.name || '?')}</div></div>`;
}

function formularZeigen(tag) {
  const ids = Object.keys(D.personen);
  const el = document.getElementById('form');
  el.innerHTML = `<div class="card"><strong>Neue Reservierung</strong>
  <label>Abreise (zählt voll)</label><input type="date" id="von" value="${tag}">
  <label>Rückkehr (zählt voll)</label><input type="date" id="bis" value="${tag}">
  <label>Fahrer</label><select id="fahrer">${ids.map((i) => `<option value="${i}"${i === ich ? ' selected' : ''}>${h(D.personen[i].name)}</option>`).join('')}<option value="">Ausnahme: kein Eigentümer</option></select>
  <div id="ausn" class="versteckt"><label>Name des Fahrers</label><input id="an"><label>Freigabe Familienrat am</label><input type="date" id="af"><label>Verantwortlicher Eigentümer</label><select id="av">${ids.map((i) => `<option value="${i}">${h(D.personen[i].name)}</option>`).join('')}</select></div>
  <label>Mitreisende Eigentümer</label><div id="mit">${ids.map((i) => `<span class="chk"><input type="checkbox" value="${i}" id="m${i}"><label for="m${i}" style="margin:0">${h(D.personen[i].name)}</label></span>`).join('')}</div>
  <label>Gäste (ohne Eigentum)</label><input type="number" id="gaeste" min="0" max="3" value="0">
  <label>Ziel</label><input id="ziel" maxlength="80">
  <div id="msg"></div>
  <p class="zeile"><button class="primaer" id="spei">Speichern</button><button id="abb">Abbrechen</button></p></div>`;
  const f = document.getElementById('fahrer');
  f.onchange = () => document.getElementById('ausn').classList.toggle('versteckt', f.value !== '');
  document.getElementById('abb').onclick = () => { el.innerHTML = ''; };
  document.getElementById('spei').onclick = async () => {
    const b = { von: val('von'), bis: val('bis'), fahrerId: f.value || null,
      mitreisende: ids.filter((i) => document.getElementById('m' + i).checked && i !== f.value),
      gaeste: parseInt(val('gaeste') || '0', 10), ziel: val('ziel').trim(), erfasstVon: ich };
    if (!f.value) b.ausnahmeFahrer = { name: val('an').trim(), freigabeAm: val('af'), verantwortlichId: val('av') };
    const p = pruefeBuchung(b, D.personen);
    const msg = document.getElementById('msg');
    if (!p.ok) { msg.innerHTML = `<div class="fehler">${p.fehler.map(h).join('<br>')}</div>`; return; }
    const koll = liste().filter((x) => kollision(x, b));
    await S.buchungSpeichern(D, b);
    ansicht = new Date(b.von + 'T12:00:00');
    kalender();
    if (koll.length) document.getElementById('form').innerHTML = `<div class="warn">Gespeichert. Überschneidung mit ${koll.map((x) => fmt(x.von) + '–' + fmt(x.bis)).join(', ')}. Bitte im Gespräch lösen.</div>`;
  };
}
const val = (id) => document.getElementById(id).value;
start();
