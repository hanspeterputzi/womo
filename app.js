import { SCHWELLE, dauer, konten, kontostaende, stufe, kollision, pruefeBuchung } from './regeln.js';
import * as S from './speicher.js';

const app = document.getElementById('app');
const toast = document.getElementById('toast');
const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const KONTO_NAME = { 'eltern': 'Eltern', 'kind-1': 'Nanouk', 'kind-2': 'Nene' };
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const iso = (j, m, t) => `${j}-${String(m + 1).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
const fmt = (s) => s.split('-').reverse().join('.');
const FARBE = { 'eltern': 'var(--eltern)', 'kind-1': 'var(--kind-1)', 'kind-2': 'var(--kind-2)' };

let D, ich = null, ansicht = new Date();

function liste() { return Object.values(D.buchungen); }
function farbKonto(b) { return konten(b, D.personen)[0] || 'eltern'; }
function initial(name) { return h((name || '?').trim().charAt(0).toUpperCase()); }
function avatar(id) { const p = D.personen[id]; return `<span class="av" style="background:${FARBE[p?.konto] || 'var(--muted)'}">${initial(p?.name)}</span>`; }
function hinweis(text) { toast.textContent = text; clearTimeout(hinweis.t); hinweis.t = setTimeout(() => { toast.textContent = ''; }, 6000); }

async function start() {
  try { D = await S.laden(); }
  catch (e) { app.innerHTML = `<div class="login"><p class="gross" style="font-size:24px;font-weight:800">Womo</p><div class="fehler">${h(e.message || 'Verbindung fehlgeschlagen.')}</div></div>`; return; }
  S.abonnieren(D, () => { const f = document.getElementById('form'); if (ich && f && f.innerHTML === '') kalender(); });
  try { const id = sessionStorage.getItem('womo-ich'); if (id && D.personen[id]) ich = id; } catch {}
  zeige();
}

function zeige() { ich ? kalender() : anmeldung(); }

const REIHENFOLGE = ['hp', 'fr', 't', 's'];
function personenGeordnet() {
  const rang = (id) => { const i = REIHENFOLGE.indexOf(id); return i < 0 ? 99 : i; };
  return Object.entries(D.personen).sort((a, b) => rang(a[0]) - rang(b[0]) || a[1].name.localeCompare(b[1].name));
}

function anmeldung() {
  let zuletzt = ''; try { zuletzt = localStorage.getItem('womo-person') || ''; } catch {}
  app.innerHTML = `<div class="login"><p class="gross">Womo</p><p class="sub">Wer bist du?</p>
  <label for="p">Name</label>
  <select id="p">${personenGeordnet().map(([i, p]) => `<option value="${i}"${i === zuletzt ? ' selected' : ''}>${h(p.name)}</option>`).join('')}</select>
  <label for="pin">PIN (4 Ziffern)</label><input id="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" type="password">
  <div id="msg"></div><button id="ok">Weiter</button>
  <p class="klein-t" style="margin-top:14px">Der PIN zeigt nur, wer eine Buchung erfasst. Er schützt keine Daten.</p></div>`;
  const los = async () => {
    const id = document.getElementById('p').value, pin = document.getElementById('pin').value;
    if (await S.pinPasst(D.personen[id], pin)) { ich = id; try { sessionStorage.setItem('womo-ich', id); localStorage.setItem('womo-person', id); } catch {} zeige(); }
    else document.getElementById('msg').innerHTML = `<div class="fehler">PIN für ${h(D.personen[id].name)} falsch. Name oben richtig gewählt?</div>`;
  };
  document.getElementById('ok').onclick = los;
  document.getElementById('pin').onkeydown = (e) => { if (e.key === 'Enter') los(); };
}

function ringe(J) {
  const st = kontostaende(liste(), D.personen, J);
  const U = 2 * Math.PI * 32;
  return `<div class="karte"><p class="titel">Tageskonto ${J}</p><div class="ringe">` +
    Object.keys(SCHWELLE).map((k) => {
      const t = st[k], s = stufe(t, k), pr = Math.min(1, t / SCHWELLE[k]);
      const farbe = s === 'rot' ? 'var(--rot)' : s === 'gelb' ? 'var(--gelb)' : FARBE[k];
      const sub = s === 'rot' ? 'überschritten' : s === 'gelb' ? 'bald erreicht' : `von ${SCHWELLE[k]} Tagen`;
      return `<div class="ring ${s}"><svg viewBox="0 0 76 76"><circle class="bg" cx="38" cy="38" r="32"/><circle class="fg" cx="38" cy="38" r="32" stroke="${farbe}" stroke-dasharray="${(pr * U).toFixed(1)} ${U.toFixed(1)}"/></svg>
      <div class="zahl">${t}</div><div class="name">${KONTO_NAME[k]}</div><div class="sub">${sub}</div></div>`;
    }).join('') + '</div></div>';
}

function kalender() {
  const J = ansicht.getFullYear(), M = ansicht.getMonth();
  const erster = new Date(J, M, 1), n = new Date(J, M + 1, 0).getDate();
  const versatz = (erster.getDay() + 6) % 7, heute = new Date();
  const bs = liste();
  let zellen = '';
  for (let i = 0; i < versatz; i++) zellen += '<div class="tag leer"></div>';
  for (let t = 1; t <= n; t++) {
    const d = iso(J, M, t), hier = bs.filter((b) => b.von <= d && d <= b.bis);
    const wd = (versatz + t - 1) % 7;
    const cls = ['tag', wd >= 5 ? 'we' : '', hier.length > 1 ? 'koll' : '',
      heute.getFullYear() === J && heute.getMonth() === M && heute.getDate() === t ? 'heute' : ''].join(' ');
    zellen += `<div class="${cls}" data-d="${d}"><span class="nr">${t}</span>${hier.length ? `<span class="streifen">${hier.map((b) => `<i class="${farbKonto(b)}"></i>`).join('')}</span>` : ''}</div>`;
  }
  const monatsB = bs.filter((b) => b.von <= iso(J, M, n) && b.bis >= iso(J, M, 1)).sort((a, b) => a.von < b.von ? -1 : 1);
  const kolls = monatsB.filter((a, i) => monatsB.some((b, j) => i !== j && kollision(a, b)));
  app.innerHTML = `<div class="kopf"><div class="marke"><span class="keil"></span>PÖSSL</div>
    <button class="chip" id="aus" title="Person wechseln">${avatar(ich)}${h(D.personen[ich].name)}</button></div>
  <main>
  ${ringe(J)}
  <div class="karte">
    <div class="monatskopf"><h2>${MONATE[M]} ${J}</h2><div class="nav"><button id="zu" aria-label="Voriger Monat">‹</button><button id="hj" class="heute-b">Heute</button><button id="vor" aria-label="Nächster Monat">›</button></div></div>
    <div class="woche">${['Mo','Di','Mi','Do','Fr','Sa','So'].map((x) => `<div>${x}</div>`).join('')}</div>
    <div class="monat">${zellen}</div>
    <div class="legende">${Object.keys(KONTO_NAME).map((k) => `<span><i class="punkt ${k}"></i>${KONTO_NAME[k]}</span>`).join('')}</div>
    ${kolls.length ? `<div class="warn">Überschneidung im ${MONATE[M]}. Bitte im Gespräch lösen.</div>` : ''}
  </div>
  <div class="karte"><p class="titel">Reservierungen im ${MONATE[M]}</p>${monatsB.length ? monatsB.map(buchungHtml).join('') : '<p class="leer-t">Keine Reservierungen.</p>'}</div>
  </main>
  <button id="neu">＋ Reservieren</button>
  <div id="form"></div>`;
  document.getElementById('zu').onclick = () => { ansicht = new Date(J, M - 1, 1); kalender(); };
  document.getElementById('vor').onclick = () => { ansicht = new Date(J, M + 1, 1); kalender(); };
  document.getElementById('hj').onclick = () => { ansicht = new Date(); kalender(); };
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
  const zaehlt = konten(b, D.personen).map((k) => KONTO_NAME[k]).join(' und ');
  const av = b.fahrerId ? avatar(b.fahrerId) : `<span class="av" style="background:var(--muted)">${initial(wer)}</span>`;
  return `<div class="b">${av}<div class="inhalt">
    <div class="zeit">${fmt(b.von).slice(0, 6)} – ${fmt(b.bis)}</div>
    <div class="meta"><span class="tagetxt">${dauer(b)} Tage</span> · ${h(wer)}${mit.length ? ' mit ' + h(mit.join(', ')) : ''}${b.gaeste ? ` · ${b.gaeste} Gast/Gäste` : ''}${b.ziel ? ' · ' + h(b.ziel) : ''}</div>
    <div class="meta">Zählt für ${h(zaehlt)} · erfasst von ${h(D.personen[b.erfasstVon]?.name || '?')}</div></div>
    ${darf ? `<button class="kl" data-del="${b.id}">Löschen</button>` : ''}</div>`;
}

function formularZeigen(tag) {
  const ids = Object.keys(D.personen);
  const el = document.getElementById('form');
  el.innerHTML = `<div class="sheet" role="dialog" aria-label="Neue Reservierung"><div class="griff"></div><h3>Neue Reservierung</h3>
  <div class="zwei"><div><label for="von">Abreise</label><input type="date" id="von" value="${tag}"></div>
  <div><label for="bis">Rückkehr</label><input type="date" id="bis" value="${tag}"></div></div>
  <label for="fahrer">Fahrer</label><select id="fahrer">${ids.map((i) => `<option value="${i}"${i === ich ? ' selected' : ''}>${h(D.personen[i].name)}</option>`).join('')}<option value="">Ausnahme: kein Eigentümer</option></select>
  <div id="ausn" class="versteckt"><label for="an">Name des Fahrers</label><input id="an"><label for="af">Freigabe Familienrat am</label><input type="date" id="af"><label for="av">Verantwortlicher Eigentümer</label><select id="av">${ids.map((i) => `<option value="${i}">${h(D.personen[i].name)}</option>`).join('')}</select></div>
  <label>Mitreisende Eigentümer</label><div class="mitw" id="mit">${ids.map((i) => `<span class="chk"><input type="checkbox" value="${i}" id="m${i}"><label for="m${i}">${h(D.personen[i].name)}</label></span>`).join('')}</div>
  <div class="zwei"><div><label for="gaeste">Gäste (ohne Eigentum)</label><input type="number" id="gaeste" min="0" max="3" value="0" inputmode="numeric"></div>
  <div><label for="ziel">Ziel</label><input id="ziel" maxlength="80" placeholder="optional"></div></div>
  <div id="msg"></div>
  <div class="aktion"><button id="abb">Abbrechen</button><button class="primaer" id="spei">Speichern</button></div></div>`;
  const f = document.getElementById('fahrer');
  const zu = () => { el.innerHTML = ''; };
  el.onclick = (e) => { if (e.target === el) zu(); };
  f.onchange = () => document.getElementById('ausn').classList.toggle('versteckt', f.value !== '');
  document.getElementById('abb').onclick = zu;
  document.getElementById('spei').onclick = async () => {
    const b = { von: val('von'), bis: val('bis'), fahrerId: f.value || null,
      mitreisende: ids.filter((i) => document.getElementById('m' + i).checked && i !== f.value),
      gaeste: parseInt(val('gaeste') || '0', 10), ziel: val('ziel').trim(), erfasstVon: ich };
    if (!f.value) b.ausnahmeFahrer = { name: val('an').trim(), freigabeAm: val('af'), verantwortlichId: val('av') };
    const p = pruefeBuchung(b, D.personen);
    const msg = document.getElementById('msg');
    if (!p.ok) { msg.innerHTML = `<div class="fehler">${p.fehler.map(h).join('<br>')}</div>`; return; }
    const koll = liste().filter((x) => kollision(x, b));
    try { await S.buchungSpeichern(D, b); }
    catch (e) { msg.innerHTML = `<div class="fehler">Speichern fehlgeschlagen: ${h(e.message)}</div>`; return; }
    ansicht = new Date(b.von + 'T12:00:00');
    el.innerHTML = '';
    kalender();
    hinweis(koll.length ? `Gespeichert. Überschneidung mit ${koll.map((x) => fmt(x.von) + '–' + fmt(x.bis)).join(', ')}. Bitte im Gespräch lösen.` : 'Reservierung gespeichert.');
  };
}
const val = (id) => document.getElementById(id).value;
start();
