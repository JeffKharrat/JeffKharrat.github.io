/* カラット: 審査室, the audit room. Where words enter memory, and only here.
   Three desks, one room:
     審査待ち Files     the words the AI flagged (clean evidence in 3 skills over 2 days). Commit (Y) or Not yet (N).
                        One commit in five is spot-checked: type the reading, pick the meaning.
     申告 Claim         a word you know that the games haven't proven: always spot-checked. 40 a day after the founding.
     創業監査 Founding  before the corporation exists: your deck's easiest words, 20 at a time, each one spot-checked.
   The AI argues; Jeff decides. Nothing here touches Anki. */
import { deckWord, buildPool, traps, shuffle } from './words.js';
import { toKana, sameReading } from './kana.js';
import { SKILLS, SKILL_J, files, commit, snooze, record, claimsLeft, useClaim, skillsClean, day } from './evidence.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SK_EN = { meaning: 'Meaning', reading: 'Reading', recall: 'Recall', context: 'Context', listen: 'Listening' };
const CSS = `
#au { position:fixed; inset:0; z-index:50; display:none; align-items:center; justify-content:center; background:#040507; }
#au.on { display:flex; animation:auF .35s ease-out both; }
@keyframes auF { from { opacity:0; } to { opacity:1; } }
#au * { box-sizing:border-box; }
#au .stg { position:relative; width:1280px; height:720px; flex:none; overflow:hidden; transform-origin:center; font:400 13px/1.45 "M PLUS 1 Code", monospace; color:#E9EBF0;
  background:linear-gradient(#0B0D12 0, #10131A 58%, #0A0B0E 58.1%, #0E1015 100%); }
/* the room: blinds, the light through them, the lamp, the desk edge */
#au .blind { position:absolute; left:930px; top:66px; width:320px; height:250px; background:repeating-linear-gradient(#2A2618 0 9px, #0B0C10 9px 14px); box-shadow:0 0 0 6px #14171D; opacity:.8; }
#au .blind::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg, rgba(255,196,0,.0), rgba(255,210,120,.18) 60%, rgba(255,196,0,0)); }
#au .rays { position:absolute; inset:0; pointer-events:none; background:repeating-linear-gradient(-28deg, rgba(255,214,120,.035) 0 22px, transparent 22px 44px); -webkit-mask:linear-gradient(115deg, transparent 30%, #000 60%, transparent 95%); mask:linear-gradient(115deg, transparent 30%, #000 60%, transparent 95%); animation:auR 18s linear infinite; }
@keyframes auR { to { background-position:88px 0; } }
#au .lampg { position:absolute; left:330px; top:120px; width:600px; height:600px; pointer-events:none; background:radial-gradient(closest-side, rgba(255,205,120,.13), rgba(255,196,0,0)); }
#au .edge { position:absolute; left:0; right:0; top:417px; height:3px; background:#232833; }
#au .sign { position:absolute; left:320px; top:74px; font:400 120px/1 "Dela Gothic One"; color:rgba(233,235,240,.035); letter-spacing:.05em; pointer-events:none; }
/* top */
#au .top { position:absolute; left:0; right:0; top:0; height:52px; display:flex; align-items:center; gap:18px; padding:0 20px; border-bottom:1px solid #262B35; background:rgba(8,9,12,.85); z-index:3; }
#au .ttl { font:400 20px "Dela Gothic One"; }
#au .lb { font:500 11px/1.3 "M PLUS 1 Code", monospace; letter-spacing:.12em; text-transform:uppercase; color:#9AA1B0; }
#au .tabs { display:flex; gap:4px; margin-left:12px; }
#au .tab { background:transparent; border:1px solid #2F3541; color:#9AA1B0; padding:7px 12px; font:500 12px "M PLUS 1 Code"; cursor:pointer; }
#au .tab b { font:400 14px "Dela Gothic One"; color:#E9EBF0; margin-right:6px; font-weight:400; }
#au .tab.on { border-color:#FFC400; color:#E9EBF0; background:rgba(255,196,0,.06); }
#au .tab i { font-style:normal; display:inline-block; min-width:18px; padding:0 5px; margin-left:6px; background:#FFC400; color:#111; font-weight:700; text-align:center; }
#au .x { margin-left:auto; background:transparent; border:1px solid #3A4150; color:#9AA1B0; padding:6px 10px; font:500 11px "M PLUS 1 Code"; cursor:pointer; }
#au .x:hover { color:#E9EBF0; border-color:#FFC400; }
#au .key { display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:20px; padding:0 4px; border:1px solid #4A5160; font:700 10.5px "M PLUS 1 Code"; color:#C9CDD6; }
/* the cabinet */
#au .cab { position:absolute; left:22px; top:72px; width:280px; bottom:22px; background:linear-gradient(90deg, #12151B, #171B22); border:1px solid #2A2F3A; padding:12px 0 12px 12px; display:flex; flex-direction:column; z-index:2; }
#au .cab .hd { display:flex; justify-content:space-between; padding-right:12px; margin-bottom:8px; }
#au .list { overflow:auto; flex:1; padding-right:8px; display:flex; flex-direction:column; gap:5px; }
#au .fo { position:relative; display:flex; align-items:center; gap:10px; padding:7px 10px 7px 14px; background:#C9B98F; color:#1B1810; cursor:pointer; transition:transform .2s, background .2s; clip-path:polygon(0 0, 46% 0, 50% 5px, 100% 5px, 100% 100%, 0 100%); padding-top:11px; }
#au .fo:nth-child(2n) { background:#C2B184; }
#au .fo b { font:400 19px/1.1 "Dela Gothic One"; font-weight:400; }
#au .fo span { font-size:11px; color:#4A4230; }
#au .fo .pp { margin-left:auto; display:flex; gap:2px; }
#au .fo .pp s { width:6px; height:10px; background:rgba(27,24,16,.18); }
#au .fo .pp s.on { background:#1B1810; }
#au .fo.sel { transform:translateX(14px); background:#E8DDBE; }
#au .fo.done { opacity:.35; }
#au .empty { color:#9AA1B0; font-size:12px; padding:10px 12px 0 0; }
/* the dossier on the desk */
#au .desk { position:absolute; left:334px; top:76px; width:572px; height:620px; z-index:2; }
#au .paper { position:absolute; inset:0; background:#ECE5D1; color:#1B1810; padding:26px 30px 22px; transform:rotate(-.8deg); box-shadow:0 30px 60px rgba(0,0,0,.6), 0 2px 0 #D6CDB4;
  background-image:linear-gradient(rgba(27,24,16,.05) 1px, transparent 1px); background-size:100% 26px; transition:transform .5s cubic-bezier(.3,1.2,.4,1), opacity .4s; }
#au .paper.in { animation:auIn .5s cubic-bezier(.2,1.1,.4,1) both; }
#au .paper.out { transform:translate(560px,-260px) rotate(14deg) scale(.3); opacity:0; transition:transform .55s cubic-bezier(.6,0,.8,.4), opacity .5s .1s; }
#au .paper.back { transform:translate(-600px,40px) rotate(-10deg); opacity:0; transition:transform .45s ease-in, opacity .4s; }
@keyframes auIn { from { transform:translate(-520px,30px) rotate(-9deg); opacity:0; } to { transform:rotate(-.8deg); opacity:1; } }
#au .clip { position:absolute; left:206px; top:-12px; width:18px; height:54px; border:3px solid #8E949E; border-radius:9px; }
#au .ph { display:flex; justify-content:space-between; font:700 11px "M PLUS 1 Code"; letter-spacing:.1em; border-bottom:2px solid #1B1810; padding-bottom:6px; }
#au .subj { display:flex; align-items:flex-end; gap:22px; margin:18px 0 6px; min-height:112px; }
#au .subj ruby { font:400 76px/1 "Dela Gothic One"; ruby-position:over; }
#au .subj rt { font:500 16px "M PLUS 1 Code"; letter-spacing:.12em; color:#5A513C; }
#au .subj.hide rt { visibility:hidden; }
#au .mean { font:500 16px/1.4 "M PLUS 1 Code"; max-width:520px; }
#au .mean.hide { filter:blur(7px); user-select:none; }
#au .src { font-size:11px; color:#6A6048; margin-top:4px; }
#au table { width:100%; border-collapse:collapse; margin-top:14px; font-size:12px; }
#au th { text-align:left; font:700 10px "M PLUS 1 Code"; letter-spacing:.1em; color:#6A6048; border-bottom:1px solid #1B1810; padding:4px 0; }
#au td { padding:5px 0; border-bottom:1px solid rgba(27,24,16,.15); }
#au td .pp { display:flex; gap:3px; } #au td .pp s { width:14px; height:12px; border:1px solid rgba(27,24,16,.4); }
#au td .pp s.on { background:#1B1810; border-color:#1B1810; } #au td .pp s.today { box-shadow:0 0 0 2px #FFC400; }
#au td.ms { color:#B23A22; }
#au .find { margin-top:14px; padding:10px 12px; border-left:4px solid #4A5BFF; background:rgba(74,91,255,.08); font-size:12.5px; }
#au .find b { font:700 10px "M PLUS 1 Code"; letter-spacing:.12em; color:#3242C8; display:block; margin-bottom:2px; }
/* hanko */
#au .hanko { position:absolute; right:40px; bottom:40px; width:136px; height:136px; border:6px solid #C8341F; border-radius:50%; color:#C8341F; display:flex; flex-direction:column; align-items:center; justify-content:center;
  font:400 40px/1 "Dela Gothic One"; transform:rotate(-14deg); opacity:.88; mix-blend-mode:multiply; animation:auH .32s cubic-bezier(.2,1.6,.4,1) both; }
#au .hanko small { font:700 9px "M PLUS 1 Code"; letter-spacing:.12em; margin-top:6px; }
#au .hanko.grey { color:#5C5A52; border-color:#5C5A52; }
@keyframes auH { from { transform:rotate(-30deg) scale(2.4); opacity:0; } 60% { opacity:.95; } to { transform:rotate(-14deg) scale(1); opacity:.88; } }
#au .desk.thud { animation:auT .25s; }
@keyframes auT { 30% { transform:translateY(3px); } }
/* the spot check slip */
#au .slip { position:absolute; left:20px; right:20px; bottom:18px; background:#FFF8DF; border:2px solid #1B1810; border-top:8px solid #FFC400; padding:14px 16px; color:#1B1810; transform:rotate(1.2deg); animation:auS .4s cubic-bezier(.2,1.3,.4,1) both; box-shadow:0 14px 30px rgba(0,0,0,.35); }
@keyframes auS { from { transform:translateY(80px) rotate(4deg); opacity:0; } to { transform:rotate(1.2deg); opacity:1; } }
#au .slip h5 { margin:0 0 8px; font:400 18px "Dela Gothic One"; display:flex; justify-content:space-between; align-items:baseline; }
#au .slip h5 span { font:700 10px "M PLUS 1 Code"; letter-spacing:.12em; color:#6A6048; }
#au .slip input { width:100%; font:500 22px "M PLUS 1 Code"; padding:8px 10px; border:2px solid #1B1810; background:#fff; color:#1B1810; outline:none; }
#au .slip .echo { font:500 26px "M PLUS 1 Code"; min-height:36px; margin-top:6px; letter-spacing:.06em; }
#au .slip .echo i { color:#9A8F72; font-style:normal; }
#au .opts { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
#au .opt { text-align:left; background:#fff; border:2px solid #1B1810; padding:10px 12px; font:500 13px "M PLUS 1 Code"; color:#1B1810; cursor:pointer; display:flex; gap:10px; align-items:center; }
#au .opt .key { border-color:#1B1810; color:#1B1810; }
#au .opt:hover { background:#FFF0B8; }
#au .opt.good { background:#FFE27A; } #au .opt.bad { background:#F7B8A8; }
#au .res { font:700 13px "M PLUS 1 Code"; margin-top:8px; }
/* the right side: the AI, the actions */
#au .side { position:absolute; left:936px; top:330px; width:322px; bottom:22px; display:flex; flex-direction:column; gap:10px; z-index:2; }
#au .ai { border:1px solid #2F3B9A; background:linear-gradient(#0F1330, #0B0E1E); padding:12px 14px; font-size:12px; color:#C8CEFF; min-height:132px; position:relative; }
#au .ai::before { content:''; position:absolute; left:-1px; top:-1px; width:9px; height:9px; background:#4A5BFF; }
#au .ai .eye { width:34px; height:34px; border-radius:50%; background:radial-gradient(circle, #fff 0 12%, #8C98FF 13% 30%, #4A5BFF 31% 52%, transparent 53%); float:right; animation:auE 3s ease-in-out infinite; box-shadow:0 0 18px rgba(74,91,255,.6); }
@keyframes auE { 50% { transform:scale(.88); box-shadow:0 0 28px rgba(74,91,255,.9); } }
#au .ai p { margin:6px 0 0; } #au .ai .cur::after { content:'▌'; animation:auB 1s steps(1) infinite; } @keyframes auB { 50% { opacity:0; } }
#au .acts { display:flex; flex-direction:column; gap:8px; }
#au .bt { display:flex; align-items:center; gap:12px; text-align:left; padding:12px 14px; border:1px solid #3A4150; background:#12151B; color:#E9EBF0; cursor:pointer; font:500 12px "M PLUS 1 Code"; }
#au .bt b { font:400 20px "Dela Gothic One"; font-weight:400; min-width:84px; }
#au .bt span.m { color:#9AA1B0; } #au .bt .key { margin-left:auto; }
#au .bt.y { background:#FFC400; color:#111; border-color:#FFC400; } #au .bt.y span.m { color:#3A3010; } #au .bt.y .key { border-color:#111; color:#111; }
#au .bt:hover:not(:disabled) { filter:brightness(1.12); } #au .bt:disabled { opacity:.35; cursor:default; }
#au .stat { display:flex; gap:8px; } #au .stat div { flex:1; border:1px solid #262B35; padding:8px 10px; } #au .stat b { display:block; font:800 22px Tektur, sans-serif; }
/* claim search */
#au .srch { position:absolute; inset:0; background:#ECE5D1; color:#1B1810; padding:26px 30px; transform:rotate(-.8deg); box-shadow:0 30px 60px rgba(0,0,0,.6); }
#au .srch input { width:100%; font:500 20px "M PLUS 1 Code"; padding:10px 12px; border:2px solid #1B1810; background:#fff; outline:none; margin:10px 0 4px; }
#au .hit { display:flex; gap:12px; align-items:baseline; padding:7px 4px; border-bottom:1px solid rgba(27,24,16,.15); cursor:pointer; }
#au .hit:hover, #au .hit.sel { background:#FFF0B8; }
#au .hit b { font:400 20px "Dela Gothic One"; font-weight:400; min-width:90px; } #au .hit span { font-size:12px; color:#4A4230; }
#au .done-big { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:8px; color:#1B1810; }
#au .done-big b { font:400 44px "Dela Gothic One"; font-weight:400; }
`;

let A = null;                       // the room's state while open

export function openAudit(ctx) {
  /* ctx: { save, deck, KD, founding, demo, persist(), onClose(committedIds), tab } */
  if (!document.getElementById('au-css')) { const st = document.createElement('style'); st.id = 'au-css'; st.textContent = CSS; document.head.appendChild(st); }
  let root = document.getElementById('au');
  if (!root) { root = document.createElement('div'); root.id = 'au'; document.body.appendChild(root); }
  const words = (ctx.deck || []).map(w => deckWord(w, ctx.KD)).filter(w => w.w && w.s);
  const byId = new Map(words.map(w => [w.id, w]));
  A = { ctx, root, words, byId, pool: buildPool(ctx.KD, words), tab: ctx.tab || (files(ctx.save).length ? 'files' : ctx.founding ? 'found' : 'claim'),
    committed: [], since: 0, sel: 0, busy: false, check: null, q: '', hits: [], hsel: 0, batch: null, bi: 0, nToday: 0 };
  root.innerHTML = `<div class="stg">
    <div class="blind"></div><div class="rays"></div><div class="lampg"></div><div class="edge"></div><div class="sign">審査</div>
    <div class="top"><span class="ttl">審査室</span><span class="lb">Audit room · カラット</span><div class="tabs"></div><span class="lb" id="au-cl"></span><button class="x" type="button" id="au-x">閉じる · Close <span class="key">Esc</span></button></div>
    <div class="cab"><div class="hd"><span class="lb" id="au-ch">書類棚 · Files</span><span class="lb" id="au-cn"></span></div><div class="list"></div></div>
    <div class="desk"></div>
    <div class="side"><div class="ai"><div class="eye"></div><div class="lb" style="color:#8C98FF">カラットの所見 · The AI</div><p id="au-say" class="cur"></p></div><div class="acts"></div>
      <div class="stat"><div><span class="lb">committed now</span><b id="au-n">0</b></div><div><span class="lb">in memory</span><b id="au-m">0</b></div></div></div>
  </div>`;
  fit(); addEventListener('resize', fit);
  root.querySelector('#au-x').onclick = close;
  root.classList.add('on');
  addEventListener('keydown', keys, true);
  render();
}
function fit() { if (!A) return; const s = Math.min(innerWidth / 1280, innerHeight / 720); A.root.querySelector('.stg').style.transform = `scale(${s})`; }
function close() {
  if (!A) return; removeEventListener('keydown', keys, true); removeEventListener('resize', fit);
  A.root.classList.remove('on'); const c = A.ctx, ids = A.committed; A = null; c.onClose && c.onClose(ids);
}
const $a = s => A.root.querySelector(s);
const save = () => A.ctx.save;
const memN = () => Object.values(save().words).filter(w => w.cert).length;

/* ---------------- what's on each desk ---------------- */
function fileList() { return files(save()).map(f => A.byId.get(f.id)).filter(Boolean); }
function foundBatch() {
  if (A.batch && A.bi < A.batch.length) return A.batch;
  const s = save(), cand = A.words.filter(w => !(s.words[w.id] && (s.words[w.id].cert || s.words[w.id].flag)) && !(A.skipped || new Set()).has(w.id) && w.r);
  cand.sort((a, b) => (b.lvl || 0) - (a.lvl || 0) || a.w.length - b.w.length || a.id - b.id);   // N5 first, short first
  A.batch = cand.slice(0, 20); A.bi = 0; return A.batch;
}
function current() {
  if (A.tab === 'files') { const L = fileList(); A.sel = Math.min(A.sel, Math.max(0, L.length - 1)); return L[A.sel] || null; }
  if (A.tab === 'found') { const B = foundBatch(); return B[A.bi] || null; }
  return A.claim || null;
}

function render() {
  const s = save(), nF = fileList().length, left = claimsLeft(s, A.ctx.founding);
  $a('.tabs').innerHTML = [['files', '審査待ち', 'Files', nF], ['claim', '申告', 'Claim'], ...(A.ctx.founding ? [['found', '創業監査', 'Founding audit']] : [])]
    .map(([id, j, e, n]) => `<button type="button" class="tab${A.tab === id ? ' on' : ''}" data-t="${id}"><b>${j}</b>${e}${n ? `<i>${n}</i>` : ''}</button>`).join('');
  A.root.querySelectorAll('.tab').forEach(b => b.onclick = () => { if (A.busy) return; A.tab = b.dataset.t; A.check = null; A.claim = null; render(); });
  $a('#au-cl').textContent = A.tab === 'claim' ? (left === Infinity ? 'claims · unlimited during the founding' : `claims left today · ${left}/40`) : '';
  $a('#au-n').textContent = A.committed.length; $a('#au-m').textContent = memN();
  cabinet(); desk(); actions();
}
function pips(w, n = 5) {
  const r = save().words[w.id] || {}, cl = new Set(skillsClean(r));
  return SKILLS.slice(0, n).map(k => `<s class="${cl.has(k) ? 'on' : ''}"></s>`).join('');
}
function cabinet() {
  const L = $a('.list');
  if (A.tab === 'files') {
    const F = fileList(); $a('#au-ch').textContent = '書類棚 · Flagged files'; $a('#au-cn').textContent = F.length + ' waiting';
    L.innerHTML = F.map((w, i) => `<div class="fo${i === A.sel ? ' sel' : ''}" data-i="${i}"><b>${esc(w.w)}</b><span>${esc(w.r)}</span><span class="pp">${pips(w)}</span></div>`).join('') || '<div class="empty">No file waiting. The AI flags a word once it has clean evidence in 3 skills over 2 different days: play the Great Factory.</div>';
    L.querySelectorAll('.fo').forEach(f => f.onclick = () => { if (A.busy) return; A.sel = +f.dataset.i; A.check = null; render(); });
  } else if (A.tab === 'found') {
    const B = foundBatch(); $a('#au-ch').textContent = '創業監査 · This batch'; $a('#au-cn').textContent = Math.min(A.bi + 1, B.length) + ' / ' + B.length;
    L.innerHTML = B.map((w, i) => `<div class="fo${i === A.bi ? ' sel' : ''}${i < A.bi ? ' done' : ''}"><b>${esc(w.w)}</b><span>${w.lvl ? 'N' + w.lvl : ''}</span></div>`).join('') || '<div class="empty">Every deck word is in memory or waiting in the files.</div>';
  } else {
    $a('#au-ch').textContent = '申告 · Recent claims'; const rc = A.committed.map(id => A.byId.get(id)).filter(Boolean).reverse();
    $a('#au-cn').textContent = rc.length ? rc.length + ' today' : '';
    L.innerHTML = rc.map(w => `<div class="fo done"><b>${esc(w.w)}</b><span>${esc(w.r)}</span></div>`).join('') || '<div class="empty">Claim a word you know that the games haven\'t proven yet. Every claim is spot-checked: the reading, typed, then the meaning.</div>';
  }
}
function paperHTML(w, opts = {}) {
  const r = save().words[w.id] || {}, ev = r.ev || {}, today = day();
  const days = []; for (let i = 7; i >= 0; i--) days.push(day(Date.now() - i * 864e5));
  const rows = SKILLS.map(k => { const e = ev[k] || { d: [] }; return `<tr><td style="width:120px"><b>${SKILL_J[k]}</b> <span style="color:#6A6048">${SK_EN[k]}</span></td><td><span class="pp">${days.map(d => `<s class="${e.d.includes(d) ? 'on' : ''}${d === today ? ' today' : ''}"></s>`).join('')}</span></td>
    <td class="${e.miss && !e.d.length ? 'ms' : ''}" style="width:130px">${e.d.length ? e.d.length + ' day' + (e.d.length > 1 ? 's' : '') + (e.at ? ' · ' + esc(e.at) : '') : e.miss ? 'missed ' + new Date(e.miss).toLocaleDateString() : '—'}</td></tr>`; }).join('');
  const no = String(w.id).padStart(5, '0'), hide = !!opts.hide;
  return `<div class="clip"></div><div class="ph"><span>審査ファイル № ${no}</span><span>${opts.kind || ''}</span><span>${new Date().toLocaleDateString('ja-JP')}</span></div>
    <div class="lb" style="color:#6A6048;margin-top:12px">対象 · Subject${w.lvl ? ' · JLPT N' + w.lvl : ''}</div>
    <div class="subj${hide ? ' hide' : ''}"><ruby>${esc(w.w)}<rt>${esc(w.r)}</rt></ruby></div>
    <div class="mean${hide ? ' hide' : ''}">${esc(w.m.length > 120 ? w.m.slice(0, 118) + '…' : w.m)}</div>
    <div class="src">ジェフの日本語 · note ${w.id}${r.flag ? ' · flagged ' + new Date(r.flag).toLocaleDateString() : ''}${r.snooze ? ' · deferred ' + r.snooze.n + '×' : ''}</div>
    <table><tr><th>証拠 · Evidence</th><th>last 8 days</th><th></th></tr>${rows}</table>`;
}
function desk() {
  const D = $a('.desk'), w = current();
  if (A.tab === 'claim' && !A.claim) return claimDesk(D);
  if (!w) {
    D.innerHTML = `<div class="paper in"><div class="done-big"><b>${A.tab === 'files' ? '処理完了' : '監査完了'}</b><span>${A.tab === 'files' ? 'No file left on the desk.' : 'Batch done.'}</span>${A.tab === 'found' && A.words.length ? '<span class="lb" style="color:#6A6048">Press Y for the next batch</span>' : ''}</div></div>`;
    say(A.tab === 'files' ? 'Nothing left to argue about. Go make evidence: the factory is open.' : 'The batch is done. Another twenty whenever you want.'); return;
  }
  const kind = A.tab === 'files' ? '審査' : A.tab === 'found' ? '創業監査' : '申告';
  const done = A.check && A.check.step === 'done';
  D.innerHTML = `<div class="paper in">${paperHTML(w, { kind, hide: A.tab !== 'files' ? !done : !!A.check && !done })}${A.check ? slipHTML() : ''}</div>`;
  if (A.check) wireSlip();
  say(finding(w));
}
function finding(w) {
  const r = save().words[w.id] || {}, cl = skillsClean(r), days = new Set(); cl.forEach(k => r.ev[k].d.forEach(d => days.add(d)));
  if (A.check) return A.check.step === 'reading' ? 'Spot check. Type the reading in romaji, then Enter. No furigana on the file now.' : A.check.step === 'meaning' ? 'Reading accepted. Now its meaning: 1 to 4.' : A.check.msg;
  if (A.tab === 'files') return `${cl.length} skills clean (${cl.map(k => SKILL_J[k]).join('・')}) over ${days.size} days. ${r.snooze ? 'Deferred ' + r.snooze.n + ' time' + (r.snooze.n > 1 ? 's' : '') + ' before; the evidence is fresh. ' : ''}I believe you know ${w.w}. Commit it to memory?`;
  if (A.tab === 'found') return `Founding audit. ${w.w}: do you know it? Y and I spot-check it, N and it waits for the games.`;
  return `A claim. ${cl.length ? cl.length + ' skill' + (cl.length > 1 ? 's' : '') + ' on file.' : 'No evidence on file.'} Every claim is spot-checked.`;
}
let sayH = 0;
function say(t) { const p = $a('#au-say'); if (!p) return; clearInterval(sayH); let i = 0; p.textContent = ''; sayH = setInterval(() => { if (!A) return clearInterval(sayH); i += 2; p.textContent = t.slice(0, i); if (i >= t.length) clearInterval(sayH); }, 16); }
function actions() {
  const X = $a('.acts'), w = current();
  if (A.check) { X.innerHTML = `<button class="bt" type="button" id="au-ab"><b>取り下げ</b><span class="m">Withdraw</span><span class="key">Esc</span></button>`; $a('#au-ab').onclick = () => { A.check = null; render(); }; return; }
  if (A.tab === 'files') {
    const r = w && save().words[w.id], n = r && r.snooze ? r.snooze.n + 1 : 1;
    X.innerHTML = `<button class="bt y" type="button" id="au-y" ${w ? '' : 'disabled'}><b>記憶する</b><span class="m">Commit to memory</span><span class="key">Y</span></button>
      <button class="bt" type="button" id="au-no" ${w ? '' : 'disabled'}><b>保留</b><span class="m">Not yet · again in ${[3, 7, 14][Math.min(2, n - 1)]} days</span><span class="key">N</span></button>
      <button class="bt" type="button" id="au-nx" ${fileList().length > 1 ? '' : 'disabled'}><b>次</b><span class="m">Next file</span><span class="key">→</span></button>`;
    $a('#au-y').onclick = yes; $a('#au-no').onclick = no; $a('#au-nx').onclick = () => move(1);
  } else if (A.tab === 'found') {
    X.innerHTML = `<button class="bt y" type="button" id="au-y" ${w || A.words.length ? '' : 'disabled'}><b>${w ? '知ってる' : '次の束'}</b><span class="m">${w ? 'I know it · spot check' : 'Next batch of 20'}</span><span class="key">Y</span></button>
      <button class="bt" type="button" id="au-no" ${w ? '' : 'disabled'}><b>まだ</b><span class="m">Not yet · leave it to the games</span><span class="key">N</span></button>`;
    $a('#au-y').onclick = yes; $a('#au-no').onclick = no;
  } else {
    X.innerHTML = A.claim ? `<button class="bt y" type="button" id="au-y"><b>申告する</b><span class="m">Claim · spot check</span><span class="key">Y</span></button><button class="bt" type="button" id="au-no"><b>戻る</b><span class="m">Back to the search</span><span class="key">N</span></button>`
      : `<button class="bt" type="button" disabled><b>検索</b><span class="m">Type a word: kanji, kana, romaji or English</span></button>`;
    if (A.claim) { $a('#au-y').onclick = yes; $a('#au-no').onclick = no; }
  }
}

/* ---------------- claims: the search ---------------- */
function claimDesk(D) {
  D.innerHTML = `<div class="srch"><div class="ph"><span>申告書 · Claim form</span><span>${new Date().toLocaleDateString('ja-JP')}</span></div>
    <div class="lb" style="color:#6A6048;margin-top:14px">I know this word</div><input id="au-q" autocomplete="off" spellcheck="false" placeholder="kaisha · かいしゃ · 会社 · company" value="${esc(A.q)}"><div id="au-qk" class="lb" style="color:#6A6048;min-height:16px"></div>
    <div id="au-hits"></div></div>`;
  const q = $a('#au-q'); q.focus(); q.oninput = () => { A.q = q.value; A.hsel = 0; hits(); }; hits();
  say(claimsLeft(save(), A.ctx.founding) > 0 ? 'Name a word you know. I will check it myself.' : 'No claims left today. The factory is still open.');
}
function hits() {
  const s = save(), raw = A.q.trim().toLowerCase(), kana = /[a-z]/.test(raw) ? toKana(raw, true).kana : raw;
  $a('#au-qk').textContent = /[a-z]/.test(raw) && kana !== raw ? '→ ' + kana : '';
  A.hits = !raw ? [] : A.words.filter(w => !(s.words[w.id] && s.words[w.id].cert) && (w.w.includes(raw) || (kana && w.r.startsWith(kana)) || (raw.length > 2 && /[a-z]/.test(raw) && w.m.toLowerCase().includes(raw)))).slice(0, 12);
  $a('#au-hits').innerHTML = A.hits.map((w, i) => `<div class="hit${i === A.hsel ? ' sel' : ''}" data-i="${i}"><b>${esc(w.w)}</b><span>${esc(w.r)}</span><span>${esc(w.s)}</span></div>`).join('') || (raw ? '<div class="lb" style="color:#6A6048;margin-top:10px">Not in your deck, or already in memory.</div>' : '');
  A.root.querySelectorAll('.hit').forEach(h => h.onclick = () => pickClaim(A.hits[+h.dataset.i]));
}
function pickClaim(w) { if (!w) return; if (claimsLeft(save(), A.ctx.founding) <= 0) return say('No claims left today.'); A.claim = w; A.check = null; render(); }

/* ---------------- the spot check ---------------- */
function startCheck(w, then) {
  const opts = shuffle([w, ...traps(w, 'meaning', '', 3, A.pool)]).map(e => ({ s: e.s, right: e.w === w.w }));
  A.check = { w, step: 'reading', opts, then, typed: '' }; render();
}
function slipHTML() {
  const c = A.check;
  if (c.step === 'reading') return `<div class="slip"><h5>抜き打ち検査 <span>SPOT CHECK · 1/2 · READING</span></h5><input id="au-r" autocomplete="off" spellcheck="false" placeholder="romaji"><div class="echo" id="au-e"></div></div>`;
  if (c.step === 'meaning') return `<div class="slip"><h5>抜き打ち検査 <span>SPOT CHECK · 2/2 · MEANING</span></h5><div class="opts">${c.opts.map((o, i) => `<button class="opt" type="button" data-i="${i}"><span class="key">${i + 1}</span>${esc(o.s)}</button>`).join('')}</div></div>`;
  return `<div class="slip"><h5>抜き打ち検査 <span>SPOT CHECK · ${c.pass ? 'PASSED' : 'FAILED'}</span></h5><div class="res">${esc(c.msg)}</div></div>`;
}
function wireSlip() {
  const c = A.check;
  if (c.step === 'reading') {
    const i = $a('#au-r'), e = $a('#au-e'); i.focus();
    i.oninput = () => { const k = toKana(i.value); e.innerHTML = esc(k.kana) + '<i>' + esc(k.rest) + '</i>'; };
  }
  if (c.step === 'meaning') A.root.querySelectorAll('.opt').forEach(b => b.onclick = () => meanAns(+b.dataset.i));
}
function readAns(v) {
  const c = A.check, ok = sameReading(v, [c.w.r]);
  record(save(), c.w.id, 'reading', ok, 'audit', 'audit');
  if (!ok) return endCheck(false, `Read as 「${toKana(v, true).kana}」. It is 「${c.w.r}」.`);
  c.step = 'meaning'; render();
}
function meanAns(i) {
  const c = A.check; if (c.step !== 'meaning') return; const ok = c.opts[i].right;
  record(save(), c.w.id, 'meaning', ok, 'audit', 'audit');
  const bs = A.root.querySelectorAll('.opt'); c.opts.forEach((o, j) => { if (o.right) bs[j].classList.add('good'); }); if (!ok) bs[i].classList.add('bad');
  setTimeout(() => endCheck(ok, ok ? 'Reading and meaning confirmed.' : `It means: ${c.w.s}.`), ok ? 350 : 900);
}
function endCheck(pass, msg) {
  const c = A.check; c.step = 'done'; c.pass = pass; c.msg = msg; render();
  setTimeout(() => { if (!A || A.check !== c) return; A.check = null; c.then(pass); }, pass ? 600 : 2000);
}

/* ---------------- decisions ---------------- */
function yes() {
  if (A.busy || A.check) return; const w = current();
  if (A.tab === 'found' && !w) { A.batch = null; render(); return; }
  if (!w) return;
  if (A.tab === 'files') {
    A.since++; const spot = A.since >= 5 || Math.random() < .2;
    if (spot) { A.since = 0; return startCheck(w, pass => pass ? stampIt(w, 'audit') : rejectIt(w, true)); }
    return stampIt(w, 'audit');
  }
  if (A.tab === 'found') return startCheck(w, pass => pass ? stampIt(w, 'founding') : (A.bi++, render()));
  if (A.tab === 'claim') return startCheck(w, pass => { if (pass) { useClaim(save()); stampIt(w, 'claim'); } else { A.claim = null; render(); } });
}
function no() {
  if (A.busy || A.check) return; const w = current();
  if (A.tab === 'files' && w) return rejectIt(w, false);
  if (A.tab === 'found' && w) { A.skipped = A.skipped || new Set(); A.skipped.add(w.id); A.bi++; return render(); }
  if (A.tab === 'claim') { A.claim = null; render(); }
}
function move(d) { if (A.busy || A.check || A.tab !== 'files') return; const n = fileList().length; if (n < 2) return; A.sel = (A.sel + d + n) % n; render(); }
function stampIt(w, how) {
  A.busy = true; const P = $a('.paper'), D = $a('.desk');
  P.insertAdjacentHTML('beforeend', `<div class="hanko">記憶<small>${how === 'claim' ? 'CLAIMED' : how === 'founding' ? 'FOUNDED' : 'COMMITTED'}</small></div>`);
  D.classList.add('thud'); setTimeout(() => D.classList.remove('thud'), 260);
  commit(save(), w.id, how); A.committed.push(w.id); A.ctx.persist();
  say(['Committed.', 'Into memory.', 'Filed in the wall.', '記憶完了.'][Math.random() * 4 | 0] + ` ${w.w} is mine now.`);
  setTimeout(() => { P.classList.remove('in'); P.classList.add('out'); }, 520);
  setTimeout(() => { A.busy = false; if (A.tab === 'found') A.bi++; if (A.tab === 'claim') A.claim = null; render(); }, 1100);
}
function rejectIt(w, failed) {
  A.busy = true; const P = $a('.paper');
  const d = snooze(save(), w.id); A.ctx.persist();
  P.insertAdjacentHTML('beforeend', `<div class="hanko grey">保留<small>AGAIN IN ${d} DAYS</small></div>`);
  say(failed ? `Spot check failed. Deferred ${d} days, fresh evidence only.` : `Not yet, then. I will ask again in ${d} days, on new evidence.`);
  setTimeout(() => { P.classList.remove('in'); P.classList.add('back'); }, 700);
  setTimeout(() => { A.busy = false; render(); }, 1250);
}

/* ---------------- keys (captured: the room has the keyboard while open) ---------------- */
function keys(e) {
  if (!A) return;
  const typing = e.target && e.target.tagName === 'INPUT';
  e.stopImmediatePropagation();
  if (e.key === 'Escape') { e.preventDefault(); if (A.check) { A.check = null; render(); } else if (A.tab === 'claim' && A.claim) { A.claim = null; render(); } else close(); return; }
  if (A.check && A.check.step === 'meaning' && /^[1-4]$/.test(e.key)) { e.preventDefault(); return meanAns(+e.key - 1); }
  if (A.check && A.check.step === 'reading' && e.key === 'Enter') { e.preventDefault(); const i = $a('#au-r'); if (i && i.value.trim()) readAns(i.value); return; }
  if (A.tab === 'claim' && !A.claim && typing) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); A.hsel = Math.max(0, Math.min(A.hits.length - 1, A.hsel + (e.key === 'ArrowDown' ? 1 : -1))); hits(); }
    if (e.key === 'Enter') { e.preventDefault(); pickClaim(A.hits[A.hsel]); }
    return;
  }
  if (typing) return;
  const k = e.key.toLowerCase();
  if (k === 'y') { e.preventDefault(); yes(); } else if (k === 'n') { e.preventDefault(); no(); }
  else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
}
