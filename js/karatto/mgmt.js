/* カラット: 派閥, the Factions room in the core: seven people at the bureau counter, for conversation practice.
   (The economy and its management tabs were removed on Nov 28: the game is the kanji and the minigames.) */
import { bureau, bureauKey, bureauClose } from './bureau.js?v=23';
import { leafSVG } from './leaf.js?v=23';

const CSS = `
#mg, #mgm { position:fixed; inset:0; z-index:60; display:none; align-items:center; justify-content:center; }
#mg { background:#020203; } #mgm { background:rgba(2,2,3,.8); z-index:70; }
#mg.on, #mgm.on { display:flex; animation:mgF .25s ease-out both; }
@keyframes mgF { from { opacity:0; } to { opacity:1; } }
#mg *, #mgm * { box-sizing:border-box; }
#mg, #mgm { --y:#FFE600; --red:#FF3B30; --ok:#5CFFA0; --ink:#ECEEF2; --mute:#8A909C; --line:#24282F; --line2:#383D46; --kj:"M PLUS 1", sans-serif; --mono:"M PLUS 1 Code", monospace; --num:Tektur, sans-serif; }
#mg .stg, #mgm .stg { position:relative; width:1280px; height:720px; flex:none; overflow:hidden; transform-origin:center; font:400 12px/1.45 var(--mono); color:var(--ink); }
#mg .stg { background:#050506; background-image:linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size:40px 40px; }
#mg .lb, #mgm .lb { font:500 9.5px/1.3 var(--mono); letter-spacing:.16em; text-transform:uppercase; color:var(--mute); }
#mg .kj, #mgm .kj { font-family:var(--kj); font-weight:500; }
#mg .key, #mgm .key { display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:19px; padding:0 4px; border:1px solid var(--line2); font:700 10px var(--mono); color:#C9CDD6; }
#mg .bc { display:inline-block; width:64px; height:10px; background:repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 3px, currentColor 3px 5px, transparent 5px 6px, currentColor 6px 7px, transparent 7px 10px); opacity:.45; vertical-align:middle; }
#mg .top { position:absolute; left:0; right:0; top:0; height:50px; display:flex; align-items:center; gap:14px; padding:0 18px; border-bottom:1px solid var(--line); background:#030304; }
#mg .tag { background:var(--y); color:#000; font:700 10px var(--mono); letter-spacing:.12em; padding:3px 6px; }
#mg .ttl { font:600 19px var(--kj); }
#mg .tabs { display:flex; margin-left:10px; border:1px solid var(--line2); }
#mg .tab { background:transparent; border:0; border-right:1px solid var(--line2); color:var(--mute); padding:7px 7px; font:700 10px var(--mono); letter-spacing:.06em; cursor:pointer; }
#mg .tab:last-child { border-right:0; } #mg .tab b { font:600 14px var(--kj); color:var(--ink); margin-right:7px; letter-spacing:0; }
#mg .tab.on { background:var(--y); color:#000; } #mg .tab.on b { color:#000; }
#mg .tab i { font-style:normal; margin-left:7px; background:var(--red); color:#fff; padding:0 5px; }
#mg .x { margin-left:auto; background:transparent; border:1px solid var(--line2); color:var(--mute); padding:6px 10px; font:700 10px var(--mono); letter-spacing:.12em; cursor:pointer; }
#mg .x:hover { color:#000; background:var(--y); border-color:var(--y); }
#mg .clock { font:700 12px var(--num); color:var(--mute); letter-spacing:.08em; }
#mg .body { position:absolute; left:20px; right:20px; top:66px; bottom:20px; }
.mgp { position:absolute; background:rgba(6,7,8,.94); border:1px solid var(--line2); clip-path:polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%); }
.mgp .ph { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 12px; border-bottom:1px solid var(--line); font:700 9.5px var(--mono); letter-spacing:.16em; color:var(--mute); white-space:nowrap; }
.mgp .ph b { color:#000; background:var(--y); padding:2px 6px; }
.mgp .in { padding:10px 12px; }
/* KPI tiles */
#mg .kpi { position:absolute; width:240px; height:118px; padding:9px 12px; }
#mg .kpi .v { font:700 26px/1.1 var(--num); margin-top:4px; }
#mg .kpi .d { font:700 10px var(--mono); letter-spacing:.06em; } #mg .up { color:var(--ok); } #mg .dn { color:var(--red); }
#mg .kpi svg { position:absolute; left:12px; right:12px; bottom:8px; width:216px; height:30px; }
#mg .kpi.warn { border-color:var(--red); } #mg .kpi.warn .v { color:var(--red); }
#mg .kpi .j { font:600 13px var(--kj); margin-right:6px; }
#mg .kpi.sm { height:92px; padding:7px 11px; } #mg .kpi.sm .v { font-size:22px; margin-top:2px; } #mg .kpi.sm svg { height:22px; bottom:6px; }
#mg .kpi .fc { position:absolute; right:11px; top:30px; font:700 10px var(--num); color:var(--mute); text-align:right; } #mg .kpi .fc b { color:var(--ink); font-size:12px; }
#mg canvas.dio { position:absolute; left:0; top:0; width:1240px; height:170px; border:1px solid var(--line2); }
#mg .fico { display:inline-flex; vertical-align:-5px; margin-right:8px; }
#mg .fcast { grid-column:1 / -1; margin-top:-4px; font:700 10px var(--mono); letter-spacing:.06em; color:var(--mute); min-height:15px; }
#mg .fcast b { font:700 11px var(--num); margin:0 10px 0 4px; } #mg .fcast .up { color:var(--ok); } #mg .fcast .dn { color:var(--red); }
#mg .proj { margin:0 0 6px; padding:8px 14px; border-bottom:1px solid var(--line); font:700 10px var(--mono); letter-spacing:.08em; color:var(--mute); }
#mg .proj b { color:var(--ink); font:700 12px var(--num); margin:0 12px 0 4px; }
/* rows and bars */
#mg .row { display:grid; grid-template-columns:110px 1fr 90px; gap:10px; align-items:center; padding:5px 0; border-bottom:1px solid #121418; }
#mg .row .kj { font-size:13px; }
#mg .bar { height:10px; background:repeating-linear-gradient(90deg, #191B20 0 6px, transparent 6px 8px); position:relative; }
#mg .bar s { position:absolute; left:0; top:0; bottom:0; background:repeating-linear-gradient(90deg, var(--y) 0 6px, transparent 6px 8px); }
#mg .bar s.r { background:repeating-linear-gradient(90deg, var(--red) 0 6px, transparent 6px 8px); }
#mg .bar u { position:absolute; top:-3px; bottom:-3px; width:2px; background:var(--ink); }
#mg .bar em { position:absolute; top:-3px; bottom:-3px; width:1px; background:var(--red); }
#mg .pl { display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #121418; }
#mg .pl b { font:700 12px var(--num); }
#mg .tot { display:flex; justify-content:space-between; padding:6px 0; font:700 13px var(--num); }
#mg .st { display:flex; gap:8px; align-items:center; padding:5px 0; } #mg .st i { width:8px; height:8px; background:var(--mute); } #mg .st i.r { background:var(--red); } #mg .st i.y { background:var(--y); } #mg .st i.g { background:var(--ok); }
/* policies */
#mg .pol { display:grid; grid-template-columns:200px 1fr 520px; gap:6px 16px; align-items:center; padding:8px 14px; border-bottom:1px solid #121418; }
#mg .pol .kj { font-size:17px; } #mg .pol p { margin:0; color:#B8BCC6; font-size:11.5px; }
#mg .seg { display:flex; border:1px solid var(--line2); }
#mg .seg button { flex:1; background:transparent; border:0; border-right:1px solid var(--line2); color:var(--ink); padding:8px 6px; cursor:pointer; font:500 11px var(--mono); }
#mg .seg button:last-child { border-right:0; } #mg .seg button b { display:block; font:600 14px var(--kj); }
#mg .seg button.on { background:var(--y); color:#000; } #mg .seg button:hover:not(.on):not(:disabled) { background:#15161A; }
#mg .seg button:disabled { opacity:.35; cursor:not-allowed; }
#mg .lock { color:var(--red); font:700 9.5px var(--mono); letter-spacing:.12em; }
/* factions */
#mg .fc { position:absolute; width:300px; height:300px; }
#mg .fc .big { font:700 46px/1 var(--num); margin:8px 0 6px; } #mg .fc .big small { font:500 11px var(--mono); color:var(--mute); margin-left:8px; }
#mg .fc .kj.t { font-size:20px; }
/* tables */
#mg table { width:100%; border-collapse:collapse; font-size:11.5px; } #mg th { text-align:right; font:700 9px var(--mono); letter-spacing:.14em; color:var(--mute); padding:6px 8px; border-bottom:1px solid var(--line2); }
#mg td { text-align:right; padding:7px 8px; border-bottom:1px solid #121418; font-family:var(--num); } #mg th:first-child, #mg td:first-child { text-align:left; }
#mg .lg { padding:6px 0; border-bottom:1px solid #121418; display:grid; grid-template-columns:120px 1fr; gap:12px; } #mg .lg span:first-child { color:var(--mute); font:700 10px var(--num); }
/* the modals: briefing and decisions */
#mgm .card { width:760px; background:#060607; border:1px solid var(--line2); padding:0 26px 22px; animation:mgIn .35s cubic-bezier(.2,1.1,.3,1) both; clip-path:polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%); }
@keyframes mgIn { from { clip-path:inset(50% 0 50% 0); } to { clip-path:polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%); } }
#mgm .bar { margin:0 -26px 14px; padding:7px 26px; background:var(--y); color:#000; font:700 10px var(--mono); letter-spacing:.16em; display:flex; justify-content:space-between; }
#mgm .bar.r { background:repeating-linear-gradient(-45deg, var(--y) 0 14px, #E0CB00 14px 28px); }
#mgm h2 { margin:0 0 6px; font:600 32px/1.15 var(--kj); }
#mgm .dl { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin:14px 0; }
#mgm .dl div { border:1px solid var(--line); padding:8px 10px; } #mgm .dl b { display:block; font:700 20px var(--num); } #mgm .dl .up { color:var(--ok); } #mgm .dl .dn { color:var(--red); }
#mgm .ev { max-height:200px; overflow:auto; border-top:1px solid var(--line); }
#mgm .ev div { padding:5px 0; border-bottom:1px solid #121418; font-size:11.5px; }
#mgm .opts { display:flex; flex-direction:column; gap:8px; margin-top:16px; }
#mgm .opt { display:grid; grid-template-columns:28px 190px 1fr; gap:12px; align-items:center; text-align:left; background:#0B0C0E; border:1px solid var(--line2); color:var(--ink); padding:11px 12px; cursor:pointer; font:500 11.5px var(--mono); }
#mgm .opt b { font:600 16px var(--kj); } #mgm .opt span.m { color:#B8BCC6; }
#mgm .opt:hover { border-color:var(--y); } #mgm .opt.def { border-color:#5A5320; }
#mgm .go { margin-top:16px; background:var(--y); color:#000; border:0; padding:11px 20px; font:700 12px var(--mono); letter-spacing:.08em; cursor:pointer; }
#mgm .go .key { border-color:#000; color:#000; margin-left:6px; }
`;
function css() { if (!document.getElementById('mg-css')) { const st = document.createElement('style'); st.id = 'mg-css'; st.textContent = CSS; document.head.appendChild(st); } }
function el(id) { let r = document.getElementById(id); if (!r) { r = document.createElement('div'); r.id = id; document.body.appendChild(r); } return r; }
function fit(r) { const s = Math.min(innerWidth / 1280, innerHeight / 720); const g = r.querySelector('.stg'); if (g) g.style.transform = `scale(${s})`; }

let M = null;
export function openMgmt(c) {
  /* c: { onClose() } */
  css(); const root = el('mg'); M = { c, root };
  root.innerHTML = `<div class="stg"><div class="top">${leafSVG(30)}<span class="tag">FAC-01</span><span class="ttl">派閥</span><span class="lb">紅葉重工 · FACTIONS · 会話の練習</span><span style="flex:1"></span><button class="x" type="button" id="mg-x">閉じる · CLOSE <span class="key">Esc</span></button></div><div class="body"><div class="bur-host" style="position:absolute;inset:0"></div></div></div>`;
  root.querySelector('#mg-x').onclick = closeMgmt; root.classList.add('on'); fit(root);
  addEventListener('keydown', mkeys, true); addEventListener('resize', mfit);
  bureau(root.querySelector('.bur-host'), M);
}
const mfit = () => M && fit(M.root);
export function closeMgmt() { if (!M) return; bureauClose(); removeEventListener('keydown', mkeys, true); removeEventListener('resize', mfit); M.root.classList.remove('on'); const c = M.c; M = null; c.onClose && c.onClose(); }
export const mgmtOpen = () => !!M;
function mkeys(e) { if (!M) return; e.stopImmediatePropagation(); if (bureauKey(e)) { e.preventDefault(); return; } if (e.key === 'Escape') { e.preventDefault(); closeMgmt(); } }
