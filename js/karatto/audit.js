/* カラット: 審査室, the audit room. Where words enter memory, and only here.
   Three desks, one room:
     審査待ち Files     the words the AI flagged (clean evidence in 3 skills over 2 days). Commit (Y) or Not yet (N).
                        One commit in five is spot-checked: type the reading, pick the meaning.
     申告 Claim         a word you know that the games haven't proven: always spot-checked. 40 a day after the founding.
     創業監査 Founding  before the corporation exists: your deck's easiest words, 20 at a time, each one spot-checked.
   The AI argues; Jeff decides. Nothing here touches Anki. */
import { deckWord, buildPool, traps, shuffle } from './words.js?v=15';
import { toKana, sameReading } from './kana.js?v=15';
import { leafSVG } from './leaf.js?v=15';
import { SKILLS, SKILL_J, files, commit, snooze, record, claimsLeft, useClaim, skillsClean, day, compromised, reverify, eligible as eligibleNow } from './evidence.js?v=15';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SK_EN = { meaning: 'Meaning', reading: 'Reading', recall: 'Recall', context: 'Context', listen: 'Listening' };
const CSS = `
#au { position:fixed; inset:0; z-index:50; display:none; align-items:center; justify-content:center; background:#020203; }
#au.on { display:flex; animation:auF .3s ease-out both; }
@keyframes auF { from { opacity:0; } to { opacity:1; } }
#au * { box-sizing:border-box; }
#au { --y:#FFE600; --red:#FF3B30; --ai:#FFE600; --ink:#ECEEF2; --mute:#8A909C; --line:#24282F; --line2:#383D46; --kj:"M PLUS 1", sans-serif; --mono:"M PLUS 1 Code", monospace; --num:Tektur, sans-serif; }
#au .stg { position:relative; width:1280px; height:720px; flex:none; overflow:hidden; transform-origin:center; font:400 12.5px/1.45 var(--mono); color:var(--ink); background:#050506; }
/* the room: a grid, a scan line, registration marks, the big glyph */
#au .grid { position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px); background-size:40px 40px; }
#au .scan { position:absolute; left:0; right:0; height:120px; top:-120px; background:linear-gradient(transparent, rgba(255,230,0,.05), transparent); animation:auScan 7s linear infinite; pointer-events:none; }
@keyframes auScan { to { top:720px; } }
#au .glyph { position:absolute; left:340px; top:120px; font:700 300px/1 var(--kj); color:transparent; -webkit-text-stroke:1px rgba(255,255,255,.035); pointer-events:none; letter-spacing:-.04em; }
#au .crt { position:absolute; inset:0; pointer-events:none; z-index:9; background:repeating-linear-gradient(transparent 0 2px, rgba(0,0,0,.07) 2px 3px); }
#au .reg { position:absolute; width:14px; height:14px; border-color:rgba(255,255,255,.25); border-style:solid; }
#au .lb { font:500 9.5px/1.3 var(--mono); letter-spacing:.16em; text-transform:uppercase; color:var(--mute); }
#au .kj { font-family:var(--kj); font-weight:500; }
#au .key { display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:19px; padding:0 4px; border:1px solid var(--line2); font:700 10px var(--mono); color:#C9CDD6; }
#au .bc { display:inline-block; width:70px; height:11px; background:repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 3px, currentColor 3px 5px, transparent 5px 6px, currentColor 6px 7px, transparent 7px 10px); opacity:.45; vertical-align:middle; }
#au .pnl { position:absolute; background:rgba(6,7,8,.92); border:1px solid var(--line2); clip-path:polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%); }
#au .ph { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 12px; border-bottom:1px solid var(--line); font:700 9.5px var(--mono); letter-spacing:.16em; color:var(--mute); white-space:nowrap; }
#au .ph b { color:#000; background:var(--y); padding:2px 6px; font-weight:700; }
/* top */
#au .top { position:absolute; left:0; right:0; top:0; height:50px; display:flex; align-items:center; gap:14px; padding:0 18px; border-bottom:1px solid var(--line); background:#030304; z-index:3; }
#au .tag { background:var(--y); color:#000; font:700 10px var(--mono); letter-spacing:.12em; padding:3px 6px; }
#au .ttl { font:600 19px var(--kj); }
#au .tabs { display:flex; gap:0; margin-left:10px; border:1px solid var(--line2); }
#au .tab { background:transparent; border:0; border-right:1px solid var(--line2); color:var(--mute); padding:7px 14px; font:700 10px var(--mono); letter-spacing:.12em; cursor:pointer; }
#au .tab:last-child { border-right:0; }
#au .tab b { font:600 14px var(--kj); color:var(--ink); margin-right:8px; letter-spacing:0; }
#au .tab.on { background:var(--y); color:#000; } #au .tab.on b { color:#000; }
#au .tab i { font-style:normal; display:inline-block; min-width:20px; padding:0 5px; margin-left:8px; background:#000; color:var(--y); text-align:center; }
#au .tab.on i { background:#000; }
#au .x { margin-left:auto; background:transparent; border:1px solid var(--line2); color:var(--mute); padding:6px 10px; font:700 10px var(--mono); letter-spacing:.12em; cursor:pointer; }
#au .x:hover { color:#000; background:var(--y); border-color:var(--y); }
/* the queue */
#au .cab { left:20px; top:68px; width:282px; bottom:20px; display:flex; flex-direction:column; z-index:2; }
#au .list { overflow:auto; flex:1; padding:6px 0; }
#au .fo { display:grid; grid-template-columns:34px 1fr auto; align-items:center; gap:8px; padding:6px 12px 6px 10px; border-left:3px solid transparent; cursor:pointer; border-bottom:1px solid #111317; }
#au .fo .n { font:700 10px var(--num); color:var(--mute); }
#au .fo b { font:500 18px/1.15 var(--kj); } #au .fo b small { font:400 10.5px var(--mono); color:var(--mute); margin-left:8px; }
#au .fo .pp { display:flex; gap:2px; } #au .fo .pp s { width:5px; height:11px; background:#22252B; } #au .fo .pp s.on { background:var(--y); }
#au .fo:hover { background:#0D0E10; }
#au .fo.sel { border-left-color:var(--y); background:linear-gradient(90deg, rgba(255,230,0,.12), transparent); }
#au .fo.done { opacity:.32; }
#au .empty { color:var(--mute); font-size:11.5px; padding:14px; line-height:1.6; }
/* the record */
#au .desk { position:absolute; left:322px; top:68px; width:582px; height:632px; z-index:2; }
#au .paper { position:absolute; inset:0; background:rgba(6,7,8,.94); border:1px solid var(--line2); clip-path:polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px)); overflow:hidden;
  transition:transform .5s cubic-bezier(.6,0,.4,1), opacity .4s, clip-path .4s; }
#au .paper.in { animation:auIn .45s cubic-bezier(.2,1,.3,1) both; }
@keyframes auIn { 0% { clip-path:inset(50% 0 50% 0); opacity:0; } 60% { clip-path:inset(0); opacity:1; } 70% { opacity:.6; } 100% { opacity:1; } }
#au .paper.out { animation:auOut .6s cubic-bezier(.7,0,.8,.3) both; }
@keyframes auOut { 0% { transform:none; } 35% { transform:scaleY(.015); opacity:1; } 100% { transform:translate(560px,-210px) scale(.02,.015); opacity:0; } }
#au .paper.back { transform:translateX(-640px); opacity:0; }
#au .rec { padding:16px 24px 0; }
#au .subj { display:flex; align-items:flex-end; gap:24px; margin:10px 0 2px; min-height:128px; }
#au .subj .big { font:500 96px/1 var(--kj); letter-spacing:.02em; }
#au .subj .rd { font:500 22px var(--kj); color:var(--y); letter-spacing:.1em; padding-bottom:10px; }
#au .hide .rd, #au .hide .mean { filter:blur(9px); opacity:.5; user-select:none; }
#au .mean { font:500 15px/1.4 var(--mono); max-width:530px; min-height:21px; }
#au .src { font:500 9.5px var(--mono); letter-spacing:.12em; color:var(--mute); margin-top:8px; text-transform:uppercase; }
#au table { width:100%; border-collapse:collapse; margin-top:16px; font-size:11.5px; }
#au th { text-align:left; font:700 9px var(--mono); letter-spacing:.16em; color:var(--mute); border-bottom:1px solid var(--line2); padding:5px 0; }
#au td { padding:6px 0; border-bottom:1px solid #121418; }
#au td .code { font:700 9px var(--mono); letter-spacing:.14em; color:var(--mute); display:inline-block; width:34px; }
#au td .pp { display:flex; gap:3px; } #au td .pp s { width:18px; height:12px; background:#15171B; border:1px solid #23262C; }
#au td .pp s.on { background:var(--y); border-color:var(--y); } #au td .pp s.today { outline:1px solid var(--ink); outline-offset:1px; }
#au td.ms { color:var(--red); }
/* stamps */
#au .band { position:absolute; left:-10px; right:-10px; top:46%; padding:12px 34px; background:var(--y); color:#000; display:flex; justify-content:space-between; align-items:center; transform:rotate(-4deg); animation:auBand .35s cubic-bezier(.2,1.4,.4,1) both; z-index:4; }
#au .band b { font:700 44px/1 var(--kj); } #au .band span { font:700 11px var(--mono); letter-spacing:.2em; text-align:right; }
#au .band.grey { background:#2A2D33; color:var(--ink); }
#au .band::before, #au .band::after { content:''; position:absolute; left:0; right:0; height:4px; background:repeating-linear-gradient(-45deg, #000 0 6px, transparent 6px 12px); opacity:.5; }
#au .band::before { top:4px; } #au .band::after { bottom:4px; }
@keyframes auBand { 0% { clip-path:inset(0 100% 0 0); } 100% { clip-path:inset(0); } }
#au .desk.thud { animation:auT .3s steps(3); }
@keyframes auT { 33% { transform:translate(3px,-2px); filter:hue-rotate(40deg); } 66% { transform:translate(-2px,1px); } }
/* verification */
#au .slip { position:absolute; left:0; right:0; bottom:0; background:#0A0A07; border-top:1px solid var(--y); padding:0 24px 18px; animation:auS .35s cubic-bezier(.2,1.2,.4,1) both; z-index:3; }
@keyframes auS { from { transform:translateY(100%); } to { transform:none; } }
#au .slip h5 { margin:0 -24px 12px; padding:6px 24px; font:700 10px var(--mono); letter-spacing:.16em; color:#000; display:flex; justify-content:space-between; background:repeating-linear-gradient(-45deg, var(--y) 0 14px, #E0CB00 14px 28px); }
#au .slip h5 b { font:600 13px/1 var(--kj); }
#au .slip .inp { display:flex; align-items:center; gap:10px; border:1px solid var(--line2); padding:0 12px; background:#000; }
#au .slip .inp span { font:700 18px var(--mono); color:var(--y); }
#au .slip input { flex:1; font:500 22px var(--mono); padding:10px 0; border:0; background:transparent; color:var(--ink); outline:none; caret-color:var(--y); }
#au .slip .echo { font:500 30px var(--kj); min-height:44px; margin-top:8px; letter-spacing:.06em; }
#au .slip .echo i { color:var(--mute); font-style:normal; font-family:var(--mono); font-size:22px; }
#au .opts { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
#au .opt { text-align:left; background:#0D0E10; border:1px solid var(--line2); padding:11px 12px; font:500 12.5px var(--mono); color:var(--ink); cursor:pointer; display:flex; gap:10px; align-items:center; }
#au .opt:hover { border-color:var(--y); }
#au .opt.good { background:var(--y); color:#000; } #au .opt.good .key { border-color:#000; color:#000; } #au .opt.bad { background:var(--red); color:#fff; }
#au .res { font:700 13px var(--mono); }
/* the right: the core link, the AI, the actions */
#au .side { position:absolute; left:924px; top:68px; width:336px; bottom:20px; display:flex; flex-direction:column; gap:10px; z-index:2; }
#au .link { position:relative; height:206px; border:1px solid var(--line2); background:radial-gradient(circle at 50% 54%, rgba(255,230,0,.16), transparent 62%); overflow:hidden; }
#au .link .ring { position:absolute; left:50%; top:54%; border-radius:50%; border:1px dashed rgba(255,236,120,.45); transform:translate(-50%,-50%); animation:auRot 18s linear infinite; }
#au .link .ring.b { border-style:solid; border-color:rgba(255,255,255,.12); animation-duration:30s; animation-direction:reverse; }
#au .link .ring.c { border:3px dotted rgba(255,230,0,.5); animation-duration:9s; }
@keyframes auRot { to { transform:translate(-50%,-50%) rotate(360deg); } }
#au .link .core { position:absolute; left:50%; top:54%; width:64px; height:64px; transform:translate(-50%,-50%); filter:drop-shadow(0 0 10px rgba(255,230,0,.45)); animation:auPl 3s ease-in-out infinite; } #au .link .core svg { display:block; }
@keyframes auPl { 50% { transform:translate(-50%,-50%) scale(.9); } }
#au .link.pulse .core { animation:auHit .7s ease-out; }
@keyframes auHit { 0% { transform:translate(-50%,-50%) scale(1); } 30% { transform:translate(-50%,-50%) scale(1.7); box-shadow:0 0 80px rgba(255,230,0,1), 0 0 0 30px rgba(255,230,0,.2); } 100% { transform:translate(-50%,-50%) scale(1); } }
#au .link .lb { position:absolute; left:10px; top:8px; } #au .link .cnt { position:absolute; right:10px; top:6px; font:700 22px var(--num); color:#FFF08A; }
#au .link .brk { position:absolute; width:16px; height:16px; border:2px solid var(--y); }
#au .ai { border:1px solid #5A5320; border-left:3px solid var(--y); background:#0E0D05; padding:10px 12px; font-size:11.5px; color:#EFE6B8; min-height:104px; }
#au .ai p { margin:6px 0 0; } #au .ai .kj { font-size:13px; color:#fff; } #au .cur::after { content:'▌'; animation:auB 1s steps(1) infinite; color:#FFF08A; } @keyframes auB { 50% { opacity:0; } }
#au .acts { display:flex; flex-direction:column; gap:6px; }
#au .bt { display:grid; grid-template-columns:96px 1fr auto; align-items:center; gap:10px; text-align:left; padding:10px 12px; border:1px solid var(--line2); background:#0B0C0E; color:var(--ink); cursor:pointer; font:500 10.5px var(--mono); letter-spacing:.06em; }
#au .bt b { font:600 18px var(--kj); letter-spacing:0; } #au .bt span.m { color:var(--mute); }
#au .bt.y { background:var(--y); color:#000; border-color:var(--y); clip-path:polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%); } #au .bt.y span.m { color:#3A3500; } #au .bt.y .key { border-color:#000; color:#000; }
#au .bt:hover:not(:disabled) { border-color:var(--y); } #au .bt.y:hover:not(:disabled) { filter:brightness(1.1); } #au .bt:disabled { opacity:.3; cursor:default; }
#au .stat { display:flex; gap:6px; margin-top:auto; } #au .stat div { flex:1; border:1px solid var(--line); padding:7px 10px; } #au .stat b { display:block; font:700 20px var(--num); }
/* claims */
#au .srch .q { display:flex; align-items:center; gap:10px; border:1px solid var(--line2); background:#000; padding:0 12px; margin:12px 0 4px; }
#au .srch .q span { font:700 13px var(--mono); color:var(--y); letter-spacing:.1em; }
#au .srch input { flex:1; font:500 20px var(--mono); padding:10px 0; border:0; background:transparent; color:var(--ink); outline:none; caret-color:var(--y); }
#au .hit { display:grid; grid-template-columns:110px 130px 1fr; gap:12px; align-items:baseline; padding:7px 6px; border-bottom:1px solid #121418; cursor:pointer; border-left:3px solid transparent; }
#au .hit:hover, #au .hit.sel { background:linear-gradient(90deg, rgba(255,230,0,.12), transparent); border-left-color:var(--y); }
#au .hit b { font:500 20px var(--kj); } #au .hit span { font-size:11.5px; color:#B8BCC6; }
#au .done-big { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:10px; }
#au .done-big b { font:600 46px var(--kj); } #au .done-big .lb { color:var(--y); }
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
    <div class="grid"></div><div class="scan"></div><div class="glyph">審査</div>
    <div class="reg" style="left:8px;top:58px;border-width:1px 0 0 1px"></div><div class="reg" style="right:8px;bottom:8px;border-width:0 1px 1px 0"></div>
    <div class="top">${leafSVG(30)}<span class="tag">AUD-00</span><span class="ttl">審査室</span><span class="lb">Memory admission · カラット core</span><div class="tabs"></div><span class="lb" id="au-cl"></span><button class="x" type="button" id="au-x">閉じる · CLOSE <span class="key">Esc</span></button></div>
    <div class="pnl cab"><div class="ph"><span id="au-ch">QUEUE</span><span id="au-cn"></span></div><div class="list"></div></div>
    <div class="desk"></div>
    <div class="side">
      <div class="link"><span class="lb">CORE LINK // 記憶</span><span class="cnt" id="au-m">0</span>
        <div class="ring" style="width:168px;height:168px"></div><div class="ring b" style="width:124px;height:124px"></div><div class="ring c" style="width:88px;height:88px"></div><div class="core">${leafSVG(64, { N: 23 })}</div>
        <div class="brk" style="left:96px;top:58px;border-width:2px 0 0 2px"></div><div class="brk" style="right:96px;top:58px;border-width:2px 2px 0 0"></div><div class="brk" style="left:96px;bottom:22px;border-width:0 0 2px 2px"></div><div class="brk" style="right:96px;bottom:22px;border-width:0 2px 2px 0"></div></div>
      <div class="ai"><div class="lb" style="color:#FFF08A">ANALYSIS // カラットの所見</div><p id="au-say" class="cur"></p></div>
      <div class="acts"></div>
      <div class="stat"><div><span class="lb">committed now</span><b id="au-n">0</b></div><div><span class="lb">claims today</span><b id="au-c">—</b></div></div>
    </div>
    <div class="crt"></div>
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
function rvList() { return compromised(save()).map(f => A.byId.get(f.id)).filter(Boolean); }
function current() {
  if (A.tab === 'rv') { const L = rvList(); A.sel = Math.min(A.sel, Math.max(0, L.length - 1)); return L[A.sel] || null; }
  if (A.tab === 'files') { const L = fileList(); A.sel = Math.min(A.sel, Math.max(0, L.length - 1)); return L[A.sel] || null; }
  if (A.tab === 'found') { const B = foundBatch(); return B[A.bi] || null; }
  return A.claim || null;
}

function render() {
  const s = save(), nF = fileList().length, left = claimsLeft(s, A.ctx.founding);
  const nR = rvList().length;
  $a('.tabs').innerHTML = [['files', '審査待ち', 'Files', nF], ['claim', '申告', 'Claim'], ...(nR || A.tab === 'rv' ? [['rv', '復旧', 'Reverify', nR]] : []), ...(A.ctx.founding ? [['found', '創業監査', 'Founding audit']] : [])]
    .map(([id, j, e, n]) => `<button type="button" class="tab${A.tab === id ? ' on' : ''}" data-t="${id}"><b>${j}</b>${e.toUpperCase()}${n ? `<i>${n}</i>` : ''}</button>`).join('');
  A.root.querySelectorAll('.tab').forEach(b => b.onclick = () => { if (A.busy) return; A.tab = b.dataset.t; A.check = null; A.claim = null; render(); });
  $a('#au-cl').textContent = A.tab === 'claim' ? (left === Infinity ? 'claims · unlimited during the founding' : `claims left today · ${left}/40`) : '';
  $a('#au-n').textContent = A.committed.length; $a('#au-m').textContent = memN(); $a('#au-c').textContent = left === Infinity ? '∞' : left;
  cabinet(); desk(); actions();
}
function pips(w, n = 5) {
  const r = save().words[w.id] || {}, cl = new Set(skillsClean(r));
  return SKILLS.slice(0, n).map(k => `<s class="${cl.has(k) ? 'on' : ''}"></s>`).join('');
}
const idx = i => String(i + 1).padStart(3, '0');
function cabinet() {
  const L = $a('.list');
  if (A.tab === 'files') {
    const F = fileList(); $a('#au-ch').innerHTML = '<b>QUEUE</b> 審査待ち'; $a('#au-cn').innerHTML = String(F.length).padStart(3, '0') + ' WAITING <span class="bc"></span>';
    L.innerHTML = F.map((w, i) => `<div class="fo${i === A.sel ? ' sel' : ''}" data-i="${i}"><span class="n">${idx(i)}</span><b>${esc(w.w)}<small>${esc(w.r)}</small></b><span class="pp">${pips(w)}</span></div>`).join('') || '<div class="empty">QUEUE EMPTY.<br>The AI flags a word once it has clean evidence in 3 skills over 2 different days. Run shifts in the Great Factory.</div>';
    L.querySelectorAll('.fo').forEach(f => f.onclick = () => { if (A.busy) return; A.sel = +f.dataset.i; A.check = null; render(); });
  } else if (A.tab === 'rv') {
    const F = rvList(); $a('#au-ch').innerHTML = '<b>BREACH</b> 復旧'; $a('#au-cn').innerHTML = String(F.length).padStart(3, '0') + ' COMPROMISED <span class="bc"></span>';
    L.innerHTML = F.map((w, i) => `<div class="fo${i === A.sel ? ' sel' : ''}" data-i="${i}"><span class="n">${idx(i)}</span><b>${esc(w.w)}</b><span class="lb" style="color:var(--red)">COMP</span></div>`).join('') || '<div class="empty">Nothing compromised. Words lost in a breach come here: they stay in memory, marked, until you prove them again.</div>';
    L.querySelectorAll('.fo').forEach(f => f.onclick = () => { if (A.busy) return; A.sel = +f.dataset.i; A.check = null; render(); });
  } else if (A.tab === 'found') {
    const B = foundBatch(); $a('#au-ch').innerHTML = '<b>BATCH</b> 創業監査'; $a('#au-cn').textContent = idx(Math.min(A.bi, Math.max(0, B.length - 1))) + ' / ' + String(B.length).padStart(3, '0');
    L.innerHTML = B.map((w, i) => `<div class="fo${i === A.bi ? ' sel' : ''}${i < A.bi ? ' done' : ''}"><span class="n">${idx(i)}</span><b>${esc(w.w)}</b><span class="lb">${w.lvl ? 'N' + w.lvl : ''}</span></div>`).join('') || '<div class="empty">Every deck word is in memory or waiting in the queue.</div>';
  } else {
    $a('#au-ch').innerHTML = '<b>CLAIMS</b> 申告'; const rc = A.committed.map(id => A.byId.get(id)).filter(Boolean).reverse();
    $a('#au-cn').textContent = rc.length ? rc.length + ' THIS SESSION' : '';
    L.innerHTML = rc.map((w, i) => `<div class="fo done"><span class="n">${idx(i)}</span><b>${esc(w.w)}<small>${esc(w.r)}</small></b><span></span></div>`).join('') || '<div class="empty">Claim a word you know that the games haven\'t proven yet. Every claim is verified: the reading, typed, then the meaning.</div>';
  }
}
const CODE = { meaning: 'MNG', reading: 'RDG', recall: 'RCL', context: 'CTX', listen: 'LST' };
function paperHTML(w, opts = {}) {
  const r = save().words[w.id] || {}, ev = r.ev || {}, today = day();
  const days = []; for (let i = 7; i >= 0; i--) days.push(day(Date.now() - i * 864e5));
  const rows = SKILLS.map(k => { const e = ev[k] || { d: [] }; return `<tr><td style="width:150px"><span class="code">${CODE[k]}</span><span class="kj">${SKILL_J[k]}</span> <span class="lb">${SK_EN[k]}</span></td><td><span class="pp">${days.map(d => `<s class="${e.d.includes(d) ? 'on' : ''}${d === today ? ' today' : ''}"></s>`).join('')}</span></td>
    <td class="${e.miss && !e.d.length ? 'ms' : ''}" style="width:140px;text-align:right">${e.d.length ? e.d.length + (e.d.length > 1 ? ' DAYS' : ' DAY') + (e.at ? ' · ' + esc(e.at).toUpperCase() : '') : e.miss ? 'MISS ' + new Date(e.miss).toLocaleDateString('ja-JP') : '—'}</td></tr>`; }).join('');
  const no = String(w.id).slice(-6), hide = !!opts.hide;
  return `<div class="ph"><span><b>REC #${no}</b> ${opts.kind || ''}</span><span>${w.lvl ? 'JLPT N' + w.lvl + ' · ' : ''}${new Date().toLocaleDateString('ja-JP')} <span class="bc"></span></span></div>
    <div class="rec"><div class="lb">SUBJECT // 対象</div>
    <div class="subj${hide ? ' hide' : ''}"><span class="big">${esc(w.w)}</span><span class="rd">${esc(w.r)}</span></div>
    <div class="${hide ? 'hide' : ''}"><div class="mean">${esc(w.m.length > 120 ? w.m.slice(0, 118) + '…' : w.m)}</div></div>
    <div class="src">SRC ジェフの日本語 · NOTE …${String(w.id).slice(-6)}${r.flag ? ' · FLAGGED ' + new Date(r.flag).toLocaleDateString('ja-JP') : ''}${r.snooze ? ' · DEFERRED ×' + r.snooze.n : ''}</div>
    <table><tr><th>EVIDENCE // 証拠</th><th>LAST 8 DAYS</th><th style="text-align:right">STATUS</th></tr>${rows}</table></div>`;
}
function desk() {
  const D = $a('.desk'), w = current();
  if (A.tab === 'claim' && !A.claim) return claimDesk(D);
  if (!w) {
    D.innerHTML = `<div class="paper in"><div class="ph"><span><b>REC —</b> IDLE</span><span class="bc"></span></div><div class="done-big"><span class="lb">${A.tab === 'files' ? 'QUEUE CLEARED' : 'BATCH COMPLETE'}</span><b>${A.tab === 'files' ? '処理完了' : '監査完了'}</b><span class="lb">${A.tab === 'found' && A.words.length ? 'PRESS Y FOR THE NEXT BATCH' : 'NO RECORD LOADED'}</span></div></div>`;
    say(A.tab === 'files' ? 'Nothing left to argue about. Go make evidence: the factory is open.' : 'The batch is done. Another twenty whenever you want.'); return;
  }
  const kind = A.tab === 'files' ? 'ADMISSION 審査' : A.tab === 'rv' ? 'REVERIFY 復旧' : A.tab === 'found' ? 'FOUNDING 創業監査' : 'CLAIM 申告';
  const done = A.check && A.check.step === 'done';
  D.innerHTML = `<div class="paper in">${paperHTML(w, { kind, hide: A.tab !== 'files' ? !done : !!A.check && !done })}${A.check ? slipHTML() : ''}</div>`;
  if (A.check) wireSlip();
  say(finding(w));
}
function finding(w) {
  const r = save().words[w.id] || {}, cl = skillsClean(r), days = new Set(); cl.forEach(k => r.ev[k].d.forEach(d => days.add(d)));
  if (A.check) return A.check.step === 'reading' ? 'Spot check. Type the reading in romaji, then Enter. No furigana on the file now.' : A.check.step === 'meaning' ? 'Reading accepted. Now its meaning: 1 to 4.' : A.check.msg;
  if (A.tab === 'rv') { const r2 = save().words[w.id] || {}; return `Compromised on ${new Date(r2.comp).toLocaleDateString('ja-JP')}: a rival copied this key. It stays certified. Prove it again, no furigana: the reading, typed, then the meaning. Fail and it stays marked, still yours.`; }
  if (A.tab === 'files') return `${cl.length} skills clean (${cl.map(k => SKILL_J[k]).join('・')}) over ${days.size} days. ${r.snooze ? 'Deferred ' + r.snooze.n + ' time' + (r.snooze.n > 1 ? 's' : '') + ' before; the evidence is fresh. ' : ''}I believe you know ${w.w}. Commit it to memory?`;
  if (A.tab === 'found') return `Founding audit. ${w.w}: do you know it? Y and I spot-check it, N and it waits for the games.`;
  return `A claim. ${cl.length ? cl.length + ' skill' + (cl.length > 1 ? 's' : '') + ' on file.' : 'No evidence on file.'} Every claim is spot-checked.`;
}
let sayH = 0;
function say(t) { const p = $a('#au-say'); if (!p) return; clearInterval(sayH); let i = 0; p.textContent = ''; sayH = setInterval(() => { if (!A) return clearInterval(sayH); i += 2; p.textContent = t.slice(0, i); if (i >= t.length) clearInterval(sayH); }, 16); }
function actions() {
  const X = $a('.acts'), w = current();
  if (A.check) { X.innerHTML = `<button class="bt" type="button" id="au-ab"><b>取り下げ</b><span class="m">ABORT CHECK</span><span class="key">Esc</span></button>`; $a('#au-ab').onclick = () => { A.check = null; render(); }; return; }
  if (A.tab === 'files') {
    const r = w && save().words[w.id], n = r && r.snooze ? r.snooze.n + 1 : 1;
    X.innerHTML = `<button class="bt y" type="button" id="au-y" ${w ? '' : 'disabled'}><b>記憶する</b><span class="m">COMMIT TO MEMORY</span><span class="key">Y</span></button>
      <button class="bt" type="button" id="au-no" ${w ? '' : 'disabled'}><b>保留</b><span class="m">DEFER · AGAIN IN ${[3, 7, 14][Math.min(2, n - 1)]} DAYS</span><span class="key">N</span></button>
      <button class="bt" type="button" id="au-nx" ${fileList().length > 1 ? '' : 'disabled'}><b>次</b><span class="m">NEXT RECORD</span><span class="key">→</span></button>`;
    $a('#au-y').onclick = yes; $a('#au-no').onclick = no; $a('#au-nx').onclick = () => move(1);
  } else if (A.tab === 'rv') {
    X.innerHTML = `<button class="bt y" type="button" id="au-y" ${w ? '' : 'disabled'}><b>再検証</b><span class="m">REVERIFY · NO FURIGANA</span><span class="key">Y</span></button>
      <button class="bt" type="button" id="au-nx" ${rvList().length > 1 ? '' : 'disabled'}><b>次</b><span class="m">NEXT RECORD</span><span class="key">→</span></button>`;
    $a('#au-y').onclick = yes; $a('#au-nx').onclick = () => move(1);
  } else if (A.tab === 'found') {
    X.innerHTML = `<button class="bt y" type="button" id="au-y" ${w || A.words.length ? '' : 'disabled'}><b>${w ? '知ってる' : '次の束'}</b><span class="m">${w ? 'I KNOW IT · VERIFY' : 'NEXT BATCH OF 20'}</span><span class="key">Y</span></button>
      <button class="bt" type="button" id="au-no" ${w ? '' : 'disabled'}><b>まだ</b><span class="m">NOT YET · LEAVE IT TO THE GAMES</span><span class="key">N</span></button>`;
    $a('#au-y').onclick = yes; $a('#au-no').onclick = no;
  } else {
    X.innerHTML = A.claim ? `<button class="bt y" type="button" id="au-y"><b>申告する</b><span class="m">CLAIM · VERIFY</span><span class="key">Y</span></button><button class="bt" type="button" id="au-no"><b>戻る</b><span class="m">BACK TO THE QUERY</span><span class="key">N</span></button>`
      : `<button class="bt" type="button" disabled><b>検索</b><span class="m">KANJI · KANA · ROMAJI · ENGLISH</span><span></span></button>`;
    if (A.claim) { $a('#au-y').onclick = yes; $a('#au-no').onclick = no; }
  }
}

/* ---------------- claims: the search ---------------- */
function claimDesk(D) {
  D.innerHTML = `<div class="paper in srch"><div class="ph"><span><b>CLAIM</b> 申告書 // I KNOW THIS WORD</span><span>${new Date().toLocaleDateString('ja-JP')} <span class="bc"></span></span></div>
    <div class="rec"><div class="q"><span>QUERY&gt;</span><input id="au-q" autocomplete="off" spellcheck="false" placeholder="kaisha · かいしゃ · 会社 · company" value="${esc(A.q)}"></div><div id="au-qk" class="lb" style="min-height:16px;color:var(--y)"></div>
    <div id="au-hits"></div></div></div>`;
  const q = $a('#au-q'); q.focus(); q.oninput = () => { A.q = q.value; A.hsel = 0; hits(); }; hits();
  say(claimsLeft(save(), A.ctx.founding) > 0 ? 'Name a word you know. I will check it myself.' : 'No claims left today. The factory is still open.');
}
function hits() {
  const s = save(), raw = A.q.trim().toLowerCase(), kana = /[a-z]/.test(raw) ? toKana(raw, true).kana : raw;
  $a('#au-qk').textContent = /[a-z]/.test(raw) && kana !== raw ? '→ ' + kana : '';
  A.hits = !raw ? [] : A.words.filter(w => !(s.words[w.id] && s.words[w.id].cert) && (w.w.includes(raw) || (kana && w.r.startsWith(kana)) || (raw.length > 2 && /[a-z]/.test(raw) && w.m.toLowerCase().includes(raw)))).slice(0, 12);
  $a('#au-hits').innerHTML = A.hits.map((w, i) => `<div class="hit${i === A.hsel ? ' sel' : ''}" data-i="${i}"><b>${esc(w.w)}</b><span class="kj">${esc(w.r)}</span><span>${esc(w.s)}</span></div>`).join('') || (raw ? '<div class="lb" style="margin-top:10px">NO MATCH · NOT IN THE DECK, OR ALREADY IN MEMORY</div>' : '');
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
  if (c.step === 'reading') return `<div class="slip"><h5><span>VERIFICATION // 1 OF 2 // READING</span><b>抜き打ち検査</b></h5><div class="inp"><span>&gt;</span><input id="au-r" autocomplete="off" spellcheck="false" placeholder="type the reading in romaji, then Enter"></div><div class="echo" id="au-e"></div></div>`;
  if (c.step === 'meaning') return `<div class="slip"><h5><span>VERIFICATION // 2 OF 2 // MEANING</span><b>抜き打ち検査</b></h5><div class="opts">${c.opts.map((o, i) => `<button class="opt" type="button" data-i="${i}"><span class="key">${i + 1}</span>${esc(o.s)}</button>`).join('')}</div></div>`;
  return `<div class="slip"><h5 style="${c.pass ? '' : 'background:var(--red);color:#fff'}"><span>VERIFICATION // ${c.pass ? 'PASSED' : 'FAILED'}</span><b>${c.pass ? '合格' : '不合格'}</b></h5><div class="res">${esc(c.msg)}</div></div>`;
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
  record(save(), c.w.id, 'reading', ok, 'typed', 'audit', A.tab === 'rv');
  if (!ok) return endCheck(false, `Read as 「${toKana(v, true).kana}」. It is 「${c.w.r}」.`);
  c.step = 'meaning'; render();
}
function meanAns(i) {
  const c = A.check; if (c.step !== 'meaning') return; const ok = c.opts[i].right;
  record(save(), c.w.id, 'meaning', ok, 'pick', 'audit', A.tab === 'rv');
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
  if (A.tab === 'rv') return startCheck(w, pass => { reverify(save(), w.id, pass); A.ctx.persist(); say(pass ? `${w.w} restored. The key is clean again.` : `Not this time. ${w.w} stays in memory, still marked. Try again later, or answer it in any game.`); render(); });
  if (A.tab === 'files') {
    const fw = save().words[w.id]; if (!eligibleNow(fw)) { commit(save(), w.id, 'audit'); A.ctx.persist(); say(`The evidence changed since the flag (a miss): ${w.w} goes back to training.`); return render(); }
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
function move(d) { if (A.busy || A.check || (A.tab !== 'files' && A.tab !== 'rv')) return; const n = (A.tab === 'rv' ? rvList() : fileList()).length; if (n < 2) return; A.sel = (A.sel + d + n) % n; render(); }
function stampIt(w, how) {
  A.busy = true; const P = $a('.paper'), D = $a('.desk');
  P.insertAdjacentHTML('beforeend', `<div class="band"><b>記憶</b><span>${how === 'claim' ? 'CLAIMED' : how === 'founding' ? 'FOUNDED' : 'COMMITTED'}<br>TO MEMORY // REC #${String(w.id).slice(-6)}</span></div>`);
  D.classList.add('thud'); setTimeout(() => D.classList.remove('thud'), 300);
  setTimeout(() => { const L = $a('.link'); if (L) { L.classList.remove('pulse'); void L.offsetWidth; L.classList.add('pulse'); } }, 950);
  commit(save(), w.id, how); A.committed.push(w.id); A.ctx.persist();
  say(['Committed.', 'Into memory.', 'Filed in the wall.', '記憶完了.'][Math.random() * 4 | 0] + ` ${w.w} is mine now.`);
  setTimeout(() => { P.classList.remove('in'); P.classList.add('out'); }, 600);
  setTimeout(() => { A.busy = false; if (A.tab === 'found') A.bi++; if (A.tab === 'claim') A.claim = null; render(); }, 1250);
}
function rejectIt(w, failed) {
  A.busy = true; const P = $a('.paper');
  const d = snooze(save(), w.id); A.ctx.persist();
  P.insertAdjacentHTML('beforeend', `<div class="band grey"><b>保留</b><span>DEFERRED<br>AGAIN IN ${d} DAYS · FRESH EVIDENCE</span></div>`);
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
