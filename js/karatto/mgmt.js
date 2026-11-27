/* カラット: 経営, the management console in the core. Overview (the planet's numbers and their last three days),
   policies, factions, quarterly reports, the log. Also the briefing after time away, and the decisions (決裁).
   Marathon-style: black, hairlines, micro labels, the AI's yellow. */
import { POL, FAC, GROUPS, EVENTS, LEDGER, resolve, setPolicy, dirProgress, capacity, forecast } from './sim.js?v=8';
import { bureau, bureauKey, bureauClose } from './bureau.js?v=8';
import { inbox, contracted, spendable, reserve, govOf } from './gov.js?v=8';
import { ICON } from './icons.js?v=8';
import { createDiorama } from './diorama.js?v=8';
import { leafSVG } from './leaf.js?v=8';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const yen = v => (v < 0 ? '−¥' : '¥') + Math.abs(Math.round(v)).toLocaleString();
const sgn = (v, d = 0) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(d);
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
#mg .tab { background:transparent; border:0; border-right:1px solid var(--line2); color:var(--mute); padding:7px 13px; font:700 10px var(--mono); letter-spacing:.12em; cursor:pointer; }
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

/* a sparkline from the hourly history */
function spark(hist, k, w = 216, h = 30) {
  const v = hist.slice(-72).map(x => x[k]); if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1;
  const pts = v.map((y, i) => `${(i / (v.length - 1) * w).toFixed(1)},${(h - 2 - (y - lo) / r * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="#FFE600" stroke-width="1.4" vector-effect="non-scaling-stroke"/><line x1="0" x2="${w}" y1="${h - 1}" y2="${h - 1}" stroke="#24282F"/></svg>`;
}
const delta = (hist, k) => { const a = hist[Math.max(0, hist.length - 25)], b = hist[hist.length - 1]; return a && b ? b[k] - a[k] : 0; };

/* ================= the console ================= */
let M = null;
export function openMgmt(c) {
  /* c: { save, ctx(), persist(), onClose(), tab } */
  css(); const root = el('mg'); M = { c, root, tab: c.tab || 'over', base: () => base(), refresh: () => M && render() };
  root.innerHTML = `<div class="stg"><div class="top">${leafSVG(30)}<span class="tag">MGT-01</span><span class="ttl">経営</span><span class="lb">Management · カラット</span><div class="tabs"></div><span class="clock" id="mg-ck"></span><button class="x" type="button" id="mg-x">閉じる · CLOSE <span class="key">Esc</span></button></div><div class="body"></div></div>`;
  root.querySelector('#mg-x').onclick = closeMgmt; root.classList.add('on'); fit(root);
  addEventListener('keydown', mkeys, true); addEventListener('resize', mfit);
  render();
}
const mfit = () => M && fit(M.root);
export function closeMgmt() { if (!M) return; dioStop(); bureauClose(); removeEventListener('keydown', mkeys, true); removeEventListener('resize', mfit); M.root.classList.remove('on'); const c = M.c; M = null; c.onClose && c.onClose(); }
export const mgmtOpen = () => !!M;
export function refreshMgmt() { if (M) render(); }
function mkeys(e) { const mm = document.getElementById('mgm'); if (!M || (mm && mm.classList.contains('on'))) return; e.stopImmediatePropagation();
  if (M.tab === 'fac' && !(e.target && e.target.tagName === 'INPUT') && bureauKey(e)) { e.preventDefault(); return; }
  if (e.key === 'Escape') { e.preventDefault(); closeMgmt(); } const n = ['1', '2', '3', '4', '5', '6'].indexOf(e.key); if (n >= 0) { M.tab = TABS[n][0]; render(); } }
const TABS = [['over', '概要', 'Overview'], ['live', '現場', 'Live'], ['pol', '社則', 'Policies'], ['fac', '派閥', 'Factions'], ['rep', '決算', 'Reports'], ['log', '記録', 'Log']];
function render() {
  const { save } = M.c, S = save.sim;
  const I = inbox(save, M.c.ctx()), nI = (I.major ? 1 : 0) + I.routine.length;
  M.root.querySelector('.tabs').innerHTML = TABS.map(([k, j, e], i) => `<button type="button" class="tab${M.tab === k ? ' on' : ''}" data-t="${k}"><b>${j}</b>${e.toUpperCase()}${k === 'fac' && nI ? `<i>${nI}</i>` : ''}</button>`).join('');
  M.root.querySelectorAll('.tab').forEach(b => b.onclick = () => { M.tab = b.dataset.t; render(); });
  M.root.querySelector('#mg-ck').textContent = `Q${S.q.n} · ${new Date(S.t).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  const B = M.root.querySelector('.body');
  if (M.tab === 'fac') { dioStop(); B.innerHTML = '<div class="bur-host" style="position:absolute;inset:0"></div>'; bureau(B.querySelector('.bur-host'), M); return; }
  B.innerHTML = { over, live, pol, rep, log }[M.tab]();
  if (M.tab === 'over') { const c = B.querySelector('canvas.dio'); dioStart(c, { x: 0, y: 236, w: 1240, h: 170 }); c.onclick = () => { M.tab = 'live'; render(); }; }
  else if (M.tab === 'live') dioStart(B.querySelector('canvas.live'), { x: 0, y: 0, w: 1240, h: 634 }); else dioStop();
  if (M.tab === 'pol') B.querySelectorAll('[data-p]').forEach(b => {
    b.onclick = () => { if (setPolicy(save, b.dataset.p, +b.dataset.v)) { M.c.persist(); M.fc = null; render(); } };
    b.onmouseenter = () => polCast(b.dataset.p, +b.dataset.v); b.onfocus = b.onmouseenter;
  });
}
function kpi(x, y, j, en, v, d, h, k, warn, tip, f) {
  return `<div class="mgp kpi sm${warn ? ' warn' : ''}" style="left:${x}px;top:${y}px" title="${esc(tip)}"><div><span class="j">${j}</span><span class="lb">${en}</span></div><div class="v">${v}</div><div class="d ${d && d.v > 0 ? 'up' : d && d.v < 0 ? 'dn' : 'lb'}">${d ? d.t : ''}</div>${f ? `<div class="fc">24H →<br><b>${f}</b></div>` : ''}${k ? spark(h, k) : ''}</div>`;
}
/* the forecast with the policies as they are: cached for the hour */
function base() { const S = M.c.save.sim; if (!M.fc || M.fc.t !== S.t) M.fc = { t: S.t, v: forecast(M.c.save, M.c.ctx(), null, 24), alt: {} }; return M.fc; }
function over() {
  const { save, ctx } = M.c, S = save.sim, corp = save.corp, X = ctx(), L = S.last || {}, Cp = capacity(S, X), h = S.hist, F = base().v.s;
  const pop = S.pop.w + S.pop.c + S.pop.e, hourly = (L.R || 0) - (L.K || 0);
  const d24 = (k, f = v => v, n = 0, invert) => { const v = delta(h, k); return { v: invert ? -v : v, t: (v >= 0 ? '▲ ' : '▼ ') + f(Math.abs(v)) + ' / 24H' }; };
  const tiles = [
    ['資金', 'Funds', yen(corp.funds), { v: hourly, t: (hourly >= 0 ? '▲ ' : '▼ ') + yen(Math.abs(hourly)) + ' / HOUR' }, 'f', corp.funds < 0, 'Revenue minus costs, every hour. Below zero: one recovery facility of ¥3,000 per quarter; past it, the optional spending winds down. The 24H figure is an operating estimate.', yen(F.funds)],
    ['株価', 'Share price', yen(S.share), d24('x', yen), 'x', false, 'An indicator: follows funds, fame, the board\'s mood and stability. The Exchange\'s session moves are shown apart.', yen(F.share)],
    ['安定度', 'Stability', S.stab.toFixed(0), d24('s', v => v.toFixed(1)), 's', S.stab < 30, 'The master stat: happiness, minus pollution, plus surveillance, minus strikes and debt. Low stability stops growth.', F.stab],
    ['人口', 'Population', Math.round(pop).toLocaleString(), d24('p', v => Math.round(v)), 'p', false, 'Grows toward the jobs, within the housing the online districts provide, faster when stable.', F.pop],
    ['生活物資', 'Goods', Math.round(S.goods).toLocaleString(), d24('g', v => Math.round(v)), 'g', L.short > 0, 'Made by the workers and robots (and the Great Factory\'s shifts), eaten by the population; the surplus over 100 is sold.', F.goods],
    ['電力', 'Power', sgn(S.power, 0), null, 'w', S.power < 0, 'Supply minus demand. Below zero: brownouts cut production and mood. The power plant adds supply for a day.', ''],
    ['公害', 'Pollution', S.poll.toFixed(0), d24('o', v => v.toFixed(1), 0, true), 'o', S.poll > 60, 'Rises with production, falls with pollution control. Residents and stability suffer; over 60, lawsuits.', F.poll],
    ['幸福度', 'Happiness', S.happy.toFixed(0), d24('h', v => v.toFixed(1)), 'h', S.happy < 30, 'Hours, wages, safety, jobs, goods, pollution, power.', F.happy],
    ['データ', 'Data', Math.floor(corp.data).toLocaleString(), null, '', false, 'The AI\'s own resource: from memory, surveillance and answers in the games. It will buy the AI\'s modules.', F.data],
    ['暴走度', 'Rampancy', S.bousou.toFixed(1), null, '', S.bousou > 50, 'Rises with surveillance, crunch and defying the board. At thresholds the AI changes.', base().v.bousou.toFixed(1)]];
  let html = `<canvas class="dio" width="2480" height="340" style="cursor:pointer" title="現場 · open the live view"></canvas><span class="lb" style="position:absolute;right:10px;top:150px;background:#FFE600;color:#000;padding:2px 6px;pointer-events:none">現場 LIVE ▸ FULL VIEW</span>` + tiles.map((t, i) => kpi((i % 5) * 248, 180 + Math.floor(i / 5) * 100, ...t.slice(0, 4), h, t[4], t[5], t[6], t[7])).join('');
  const row = (j, en, v, cap, txt, red) => `<div class="row"><span><span class="kj">${j}</span> <span class="lb">${en}</span></span><span class="bar"><s class="${red ? 'r' : ''}" style="width:${Math.min(100, cap ? v / cap * 100 : 0)}%"></s></span><span style="text-align:right">${txt}</span></div>`;
  const Y0 = 382, PH = 252;
  html += `<div class="mgp" style="left:0;top:${Y0}px;width:404px;height:${PH}px"><div class="ph"><span><b>POP</b> 人口と雇用 · PEOPLE &amp; JOBS</span><span>ROBOTS ${Cp.robots}</span></div><div class="in">
    ${row('作業員', 'Workers', S.pop.w, Math.max(S.pop.w, Cp.jobsW), `${Math.round(Math.min(S.pop.w, Cp.jobsW))}/${Math.round(Cp.jobsW)}`)}
    ${row('事務員', 'Clerks', S.pop.c, Math.max(S.pop.c, Cp.jobsC), `${Math.round(S.pop.c)}/${Math.round(Cp.jobsC)}`)}
    ${X.tier >= 2 ? row('技術者', 'Engineers', S.pop.e, Math.max(1, Cp.jobsE), `${Math.round(S.pop.e)}/${Cp.jobsE}`) : '<div class="row"><span><span class="kj">技術者</span> <span class="lb">Engineers</span></span><span class="lb">OPENS AT N3</span><span></span></div>'}
    ${row('住宅', 'Housing', pop, Cp.housing, `${Math.round(pop)}/${Cp.housing}`, pop > Cp.housing * .95)}
    ${row('失業', 'Idle', L.idle || 0, Math.max(1, S.pop.w), ((L.u || 0) * 100).toFixed(0) + '%', (L.u || 0) > .1)}
    ${S.pol.train ? '<div class="st"><i class="g"></i><span>研修 Training: idle workers become clerks.</span></div>' : (L.u || 0) > .05 ? '<div class="st"><i class="r"></i><span>Robots leave workers idle. 研修 Training would retrain them.</span></div>' : '<div class="st"><i></i><span>Districts held give housing and offices; words in memory, robots.</span></div>'}
  </div></div>`;
  const R = L.rev || {}, K = L.cost || {}, NR = { sales: '販売 Sales', services: 'サービス Services' }, NK = { wages: '人件費 Wages', safety: '安全 Safety', eco: '公害対策 Pollution ctrl', watch: '監視 Surveillance', pr: '広報 PR', train: '研修 Training', upkeep: '維持費 Upkeep', interest: '利息 Interest' };
  html += `<div class="mgp" style="left:416px;top:${Y0}px;width:404px;height:${PH}px"><div class="ph"><span><b>P&amp;L</b> 時間収支 · THIS HOUR</span><span>Q${S.q.n} ${yen(S.q.rev - S.q.cost)}</span></div><div class="in" style="padding-top:6px">
    ${Object.entries(R).map(([k, v]) => `<div class="pl"><span>${NR[k]}</span><b class="up">+${yen(v)}</b></div>`).join('')}
    ${Object.entries(K).filter(([, v]) => v > .01).map(([k, v]) => `<div class="pl"><span>${NK[k]}</span><b class="dn">−${yen(v)}</b></div>`).join('')}
    <div class="tot"><span>NET / HOUR · OPERATING ESTIMATE 24H ${yen(base().v.net)}</span><span class="${hourly >= 0 ? 'up' : 'dn'}">${hourly >= 0 ? '+' : '−'}${yen(Math.abs(hourly))}</span></div>
    ${(() => { const K2 = contracted(save); return `<div class="pl" title="Signed agreements, apart from the operating estimate"><span>契約 Contracted · escrow ${yen(K2.escrow)}${K2.lots.length ? ` · ${K2.lots.length} lot${K2.lots.length > 1 ? 's' : ''} (${yen(K2.lots.reduce((n, l) => n + l.pay, 0))} on delivery)` : ''}</span><b>${K2.recurring ? '−' + yen(K2.recurring) + '/H' : '—'}</b></div><div class="pl"><span>予備 Reserve ${yen(reserve(save))} · spendable</span><b class="${spendable(save) < 0 ? 'dn' : ''}">${yen(spendable(save))}</b></div>`; })()}
  </div></div>`;
  const dp = dirProgress(S, corp, X), qEnd = S.q.start + 7 * 24 * 3600e3, left = Math.max(0, (qEnd - S.t) / 3600e3);
  const pct = dp ? Math.min(100, dp.D.k === 'poll' ? (dp.v <= dp.goal ? 100 : Math.max(0, 100 - (dp.v - dp.goal) * 2)) : dp.v / dp.goal * 100) : 0;
  const status = [
    S.breach && S.breach.open ? `<div class="st"><i class="r"></i><span>侵入警報 Breach: ${esc(S.breach.open.rival)} is attacking the memory · 保安部</span></div>` : '',
    S.strike > S.t ? `<div class="st"><i class="r"></i><span>ストライキ中 Strike: work and 70% of dispatch stopped for ${Math.ceil((S.strike - S.t) / 3600e3)} h (jobs kept)</span></div>` : '',
    S.shackle ? `<div class="st"><i class="r"></i><span>The board locked ${POL[S.shackle.k].j} for ${Math.ceil((S.shackle.until - S.t) / 3600e3)} h</span></div>` : '',
    S.debt > 0 ? `<div class="st"><i class="r"></i><span>融資 Loan: ${yen(S.debt)} (repaid above ¥5,000)${S.fcl === S.q.n ? ' · facility used this quarter' : ''}</span></div>` : '',
    S.power < 0 ? '<div class="st"><i class="r"></i><span>停電 Brownouts: demand is over supply</span></div>' : '',
    ...(() => { const I = inbox(save, X); return [I.major ? `<div class="st"><i class="y"></i><span>派閥 ${esc(I.major.m.title[0])} · ${esc(I.major.m.title[1])} (the counter)</span></div>` : '', S.ev.length ? `<div class="st"><i class="y"></i><span>${S.ev.length} decision${S.ev.length > 1 ? 's' : ''} waiting at the counter (派閥) or 本社</span></div>` : '', ...I.status.slice(0, 2).map(t => `<div class="st"><i></i><span>${esc(t)}</span></div>`)]; })(),
    S.hold && S.hold.until > S.t ? `<div class="st"><i class="r"></i><span>出荷停止 Dispatch hold: ${Math.round(S.hold.pct * 100)}% of outbound held for ${Math.ceil((S.hold.until - S.t) / 3600e3)} h</span></div>` : '',
    ...Object.entries(S.fac).filter(([k, v]) => v < 30 && (k !== 'eng' || X.tier >= 2)).map(([k, v]) => `<div class="st"><span class="fico" style="color:var(--red)">${ICON[k](16)}</span><span>${FAC[k][0]} ${FAC[k][1]} unhappy (${v.toFixed(0)})</span></div>`)].join('') || '<div class="st"><i class="g"></i><span>平常運転 Normal operation.</span></div>';
  html += `<div class="mgp" style="left:832px;top:${Y0}px;width:408px;height:${PH}px"><div class="ph"><span><b>DIR</b> 取締役会の指令 · DIRECTIVE</span><span>${left.toFixed(0)} H LEFT</span></div><div class="in">
    ${dp ? `<div class="kj" style="font-size:18px">${dp.D.j}</div><div style="margin:2px 0 6px">${esc(dp.txt)}</div><div class="bar"><s style="width:${pct}%"></s></div><div class="lb" style="margin-top:5px">${dp.ok ? 'ON TRACK · +¥500 AND THE BOARD\'S FAVOUR' : 'NOT YET · MISSING IT ANGERS THE BOARD'}</div>` : ''}
    <div class="lb" style="margin:10px 0 2px">STATUS</div>${status}
  </div></div>`;
  return html;
}
function pol() {
  const { save } = M.c, S = save.sim, F = base().v;
  return `<div class="mgp" style="left:0;top:0;right:0;bottom:0;width:auto;overflow:auto"><div class="ph"><span><b>POL</b> 社則 · COMPANY POLICY</span><span>HOVER AN OPTION: 24H FORECAST AGAINST THE CURRENT POLICY</span></div>
    <div class="proj">IF NOTHING CHANGES · IN 24H: FUNDS<b>${yen(F.s.funds)}</b>STABILITY<b>${F.s.stab}</b>HAPPINESS<b>${F.s.happy}</b>POLLUTION<b>${F.s.poll}</b>${Object.keys(FAC).map(k => `${FAC[k][1].toUpperCase()}<b>${Math.round(F.fac[k])}</b>`).join('')}</div>
    ${Object.entries(POL).map(([k, P]) => { const lock = S.shackle && S.shackle.k === k;
      return `<div class="pol"><div><div class="kj">${P.j}</div><span class="lb">${P.en}</span>${lock ? '<div class="lock">LOCKED BY THE BOARD</div>' : ''}</div><p>${esc(P.d)}</p>
      <div class="seg">${P.o.map(([j, e], v) => `<button type="button" data-p="${k}" data-v="${v}" class="${S.pol[k] === v ? 'on' : ''}" ${lock ? 'disabled' : ''}><b>${j}</b>${e}</button>`).join('')}</div><div class="fcast" id="fc-${k}"></div></div>`; }).join('')}
  </div>`;
}
function live() { return '<canvas class="live" width="2480" height="1268" style="position:absolute;left:0;top:0;width:1240px;height:634px;border:1px solid #383D46"></canvas>'; }
function polCast(k, v) {
  const S = M.c.save.sim, el = document.getElementById('fc-' + k); if (!el) return;
  document.querySelectorAll('#mg .fcast').forEach(x => { if (x !== el) x.innerHTML = ''; });
  if (S.pol[k] === v) { el.innerHTML = 'CURRENT POLICY'; return; }
  const B = base(), key = k + v, A = B.alt[key] || (B.alt[key] = forecast(M.c.save, M.c.ctx(), { [k]: v }, 24)), b = B.v;
  const d = (lab, x, y, f = n => n.toFixed(0), inv) => { const dd = x - y, good = inv ? dd < 0 : dd > 0; return `${lab}<b class="${Math.abs(dd) < .5 ? '' : good ? 'up' : 'dn'}">${dd >= 0 ? '+' : '−'}${f(Math.abs(dd))}</b>`; };
  el.innerHTML = `24H IF ${POL[k].o[v][1].toUpperCase()}: ` + d('FUNDS ', A.s.funds, b.s.funds, n => '¥' + Math.round(n).toLocaleString()) + d('STAB ', A.s.stab, b.s.stab) + d('HAPPY ', A.s.happy, b.s.happy) + d('POLL ', A.s.poll, b.s.poll, undefined, true) +
    Object.keys(FAC).map(f => d(FAC[f][1].toUpperCase() + ' ', A.fac[f], b.fac[f])).join('') + d('暴走 ', A.bousou, b.bousou, n => n.toFixed(1), true);
}
function rep() {
  const S = M.c.save.sim, R = S.reports.slice().reverse();
  return `<div class="mgp" style="left:0;top:0;width:1240px;height:634px"><div class="ph"><span><b>REP</b> 四半期決算 · QUARTERLY REPORTS</span><span>A QUARTER IS A REAL WEEK, FROM MONDAY 4:00</span></div><div class="in">
    <table><tr><th>QUARTER</th><th>OPERATING</th><th>SHIFT FEES</th><th>ORDERS</th><th>EVENTS</th><th>FINANCE</th><th>CAPITAL</th><th>DIVIDEND</th><th>SHIPPED</th><th>STABILITY</th><th>DIRECTIVE</th></tr>
    ${[{ n: S.q.n, cur: true, led: S.q.led || {}, ship: S.q.ship, stab: Math.round(S.stab), hrs: S.q.hrs }, ...R].map(r => { const L = r.led || { op: r.profit }; const c = v => `<td style="color:${(v || 0) < 0 ? 'var(--red)' : (v || 0) > 0 ? 'var(--ok)' : 'inherit'}">${v ? yen(v) : '—'}</td>`;
      return `<tr><td>Q${r.n} · ${r.cur ? 'in progress' : new Date(r.from).toLocaleDateString('ja-JP')}${r.susp ? ' · <span style="color:var(--mute)">suspended (away)</span>' : ''}</td>${c(L.op)}${c(L.shift)}${c(L.orders)}${c(L.ev)}${c(L.fin)}${c(L.cap)}<td>${r.cur ? '—' : yen(r.dividend || 0)}</td><td>${r.ship}</td><td>${r.stab}</td><td style="color:${r.dir ? (r.dir.neutral ? 'var(--mute)' : r.dir.ok ? 'var(--ok)' : 'var(--red)') : 'inherit'}">${r.cur ? '—' : r.dir ? (r.dir.neutral ? 'NOT JUDGED' : r.dir.ok ? 'MET' : 'MISSED') : '—'}</td></tr>`; }).join('')}
    </table><p class="lb" style="margin-top:14px">DIVIDENDS COME FROM THE OPERATING RESULT ONLY. A WEEK WITH FEWER THAN 120 SIMULATED HOURS IS BOOKED WITHOUT JUDGING THE DIRECTIVE.${R.length ? '' : ' THE FIRST QUARTER CLOSES NEXT MONDAY AT 4:00.'}</p></div></div>`;
}
function log() {
  const S = M.c.save.sim;
  return `<div class="mgp" style="left:0;top:0;width:1240px;height:634px;overflow:auto"><div class="ph"><span><b>LOG</b> 記録 · WHAT HAPPENED</span></div><div class="in">
    ${S.log.slice().reverse().map(l => `<div class="lg"><span>${new Date(l.t).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span><span>${esc(l.text)}</span></div>`).join('') || '<p class="lb">NOTHING YET</p>'}</div></div>`;
}

/* ================= the briefing after time away ================= */
export function briefing(sum, done, I) {
  css(); const r = el('mgm'), a = sum.before, b = sum.after;
  const dd = (j, en, k, f = v => v, inv) => { const d = b[k] - a[k]; return `<div><span class="lb">${j} ${en}</span><b>${f(b[k])}</b><span class="${(inv ? -d : d) > 0 ? 'up' : (inv ? -d : d) < 0 ? 'dn' : 'lb'}">${d >= 0 ? '▲' : '▼'} ${f(Math.abs(d))}</span></div>`; };
  r.innerHTML = `<div class="stg" style="display:flex;align-items:center;justify-content:center"><div class="card"><div class="bar"><span>BRIEFING // 留守中の報告</span><span>${sum.hours} H SIMULATED${sum.hours >= 72 ? ' (CAPPED)' : ''}</span></div>
    <div style="float:right;margin:4px 0 0 16px">${leafSVG(96, { N: 23 })}</div><h2>おかえりなさい。</h2><div style="color:#B8BCC6">While you were away, the corporation ran on your policies; the autopilot handled what couldn't wait.</div>
    <div class="dl">${dd('資金', 'FUNDS', 'funds', yen)}${dd('安定度', 'STABILITY', 'stab')}${dd('人口', 'POPULATION', 'pop')}${dd('生活物資', 'GOODS', 'goods')}${dd('株価', 'SHARE', 'share', yen)}${dd('公害', 'POLLUTION', 'poll', v => v, true)}${dd('幸福度', 'HAPPINESS', 'happy')}${dd('データ', 'DATA', 'data')}</div>
    ${sum.log.length ? `<div class="lb">WHAT HAPPENED</div><div class="ev">${sum.log.slice(-14).reverse().map(l => `<div>${esc(l.text)}</div>`).join('')}</div>` : ''}
    ${I && (I.major || I.routine.length) ? `<div class="lb" style="margin-top:12px">ON THE COUNTER · 経営 → 派閥</div><div class="ev" style="max-height:90px">${I.major ? `<div><b class="kj" style="color:var(--y)">${esc(I.major.m.title[0])}</b> ${esc(I.major.m.title[1])}</div>` : ''}${I.routine.map(e => `<div><span class="kj">${EVENTS[e.k].j}</span> ${esc(EVENTS[e.k].en)}</div>`).join('')}</div>` : ''}
    ${sum.reports && sum.reports.some(r => r.susp) ? '<div class="lb" style="margin-top:8px">THE WEEKS YOU MISSED ARE BOOKED AS ONE SUSPENDED PERIOD: NO DIRECTIVE JUDGED, NO PENALTY.</div>' : ''}
    <button class="go" type="button" id="mgm-ok">了解 · UNDERSTOOD <span class="key">Enter</span></button></div></div>`;
  open(r, () => { r.classList.remove('on'); done && done(); }, ['Enter', 'Escape']);
}
/* ================= a decision ================= */
export function decide(save, ev, persist, done) {
  css(); const r = el('mgm'), E = EVENTS[ev.k];
  r.innerHTML = `<div class="stg" style="display:flex;align-items:center;justify-content:center"><div class="card"><div class="bar r"><span>DECISION // 決裁 // ${E.en.toUpperCase()}</span><span>THE AUTOPILOT DECIDES IN ${Math.max(1, Math.ceil(24 - (save.sim.t - ev.t) / 3600e3))} H</span></div>
    <h2>${E.j}</h2><div style="color:#B8BCC6">${esc(E.d)}</div>
    <div class="opts">${E.o.map(([j, en, d], i) => `<button type="button" class="opt${i === E.def ? ' def' : ''}" data-i="${i}"><span class="key">${i + 1}</span><span><b>${j}</b><br>${en}</span><span class="m">${esc(d)}${i === E.def ? ' · the autopilot\'s choice' : ''}</span></button>`).join('')}</div></div></div>`;
  const pick = i => { resolve(save, ev.id, i); persist(); r.classList.remove('on'); removeEventListener('keydown', k, true); done && done(); };
  r.querySelectorAll('.opt').forEach(b => b.onclick = () => pick(+b.dataset.i));
  const k = e => { e.stopImmediatePropagation(); const n = +e.key - 1; if (n >= 0 && n < E.o.length) { e.preventDefault(); pick(n); } };
  r.classList.add('on'); fit(r); addEventListener('keydown', k, true);
}
function open(r, close, keys) {
  r.classList.add('on'); fit(r);
  const k = e => { e.stopImmediatePropagation(); if (keys.includes(e.key)) { e.preventDefault(); end(); } };
  const end = () => { removeEventListener('keydown', k, true); close(); };
  r.querySelector('#mgm-ok').onclick = end; addEventListener('keydown', k, true);
}

/* ================= the diorama (diorama.js): a crop on the overview, the whole of it on the LIVE tab ================= */
let DIO = null;
function dioStop() { if (DIO) { DIO.stop(); DIO = null; } }
function dioStart(cv, view) {
  dioStop(); if (!cv || !M) return;
  DIO = createDiorama(cv, () => { if (!M) return null; const S = M.c.save.sim, X = M.c.ctx(); return { S, corp: M.c.save.corp, X, C: capacity(S, X), G: govOf(M.c.save) }; }, view);
}
