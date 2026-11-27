/* カラット: 経営, the management console in the core. Overview (the planet's numbers and their last three days),
   policies, factions, quarterly reports, the log. Also the briefing after time away, and the decisions (決裁).
   Marathon-style: black, hairlines, micro labels, the AI's yellow. */
import { POL, FAC, GROUPS, EVENTS, resolve, setPolicy, dirProgress, capacity, forecast } from './sim.js?v=6';
import { ICON } from './icons.js?v=6';

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
  css(); const root = el('mg'); M = { c, root, tab: c.tab || 'over' };
  root.innerHTML = `<div class="stg"><div class="top"><span class="tag">MGT-01</span><span class="ttl">経営</span><span class="lb">Management · カラット</span><div class="tabs"></div><span class="clock" id="mg-ck"></span><button class="x" type="button" id="mg-x">閉じる · CLOSE <span class="key">Esc</span></button></div><div class="body"></div></div>`;
  root.querySelector('#mg-x').onclick = closeMgmt; root.classList.add('on'); fit(root);
  addEventListener('keydown', mkeys, true); addEventListener('resize', mfit);
  render();
}
const mfit = () => M && fit(M.root);
export function closeMgmt() { if (!M) return; dioStop(); removeEventListener('keydown', mkeys, true); removeEventListener('resize', mfit); M.root.classList.remove('on'); const c = M.c; M = null; c.onClose && c.onClose(); }
export const mgmtOpen = () => !!M;
export function refreshMgmt() { if (M) render(); }
function mkeys(e) { const mm = document.getElementById('mgm'); if (!M || (mm && mm.classList.contains('on'))) return; e.stopImmediatePropagation(); if (e.key === 'Escape') { e.preventDefault(); closeMgmt(); } const n = ['1', '2', '3', '4', '5'].indexOf(e.key); if (n >= 0) { M.tab = TABS[n][0]; render(); } }
const TABS = [['over', '概要', 'Overview'], ['pol', '社則', 'Policies'], ['fac', '派閥', 'Factions'], ['rep', '決算', 'Reports'], ['log', '記録', 'Log']];
function render() {
  const { save } = M.c, S = save.sim;
  M.root.querySelector('.tabs').innerHTML = TABS.map(([k, j, e], i) => `<button type="button" class="tab${M.tab === k ? ' on' : ''}" data-t="${k}"><b>${j}</b>${e.toUpperCase()}${k === 'fac' && Object.values(S.fac).some(v => v < 30) ? '<i>!</i>' : ''}</button>`).join('');
  M.root.querySelectorAll('.tab').forEach(b => b.onclick = () => { M.tab = b.dataset.t; render(); });
  M.root.querySelector('#mg-ck').textContent = `Q${S.q.n} · ${new Date(S.t).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  const B = M.root.querySelector('.body');
  B.innerHTML = { over, pol, fac, rep, log }[M.tab]();
  if (M.tab === 'over') dioStart(B.querySelector('canvas.dio')); else dioStop();
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
    ['資金', 'Funds', yen(corp.funds), { v: hourly, t: (hourly >= 0 ? '▲ ' : '▼ ') + yen(Math.abs(hourly)) + ' / HOUR' }, 'f', corp.funds < 0, 'Revenue minus costs, every hour. Below zero the main bank lends ¥3,000 (the board hates it).', yen(F.funds)],
    ['株価', 'Share price', yen(S.share), d24('x', yen), 'x', false, 'Follows funds, fame, the board\'s mood and stability.', yen(F.share)],
    ['安定度', 'Stability', S.stab.toFixed(0), d24('s', v => v.toFixed(1)), 's', S.stab < 30, 'The master stat: happiness, minus pollution, plus surveillance, minus strikes and debt. Low stability stops growth.', F.stab],
    ['人口', 'Population', Math.round(pop).toLocaleString(), d24('p', v => Math.round(v)), 'p', false, 'Grows toward the jobs, within the housing the online districts provide, faster when stable.', F.pop],
    ['生活物資', 'Goods', Math.round(S.goods).toLocaleString(), d24('g', v => Math.round(v)), 'g', L.short > 0, 'Made by the workers and robots (and the Great Factory\'s shifts), eaten by the population; the surplus over 100 is sold.', F.goods],
    ['電力', 'Power', sgn(S.power, 0), null, 'w', S.power < 0, 'Supply minus demand. Below zero: brownouts cut production and mood. The power plant adds supply for a day.', ''],
    ['公害', 'Pollution', S.poll.toFixed(0), d24('o', v => v.toFixed(1), 0, true), 'o', S.poll > 60, 'Rises with production, falls with pollution control. Residents and stability suffer; over 60, lawsuits.', F.poll],
    ['幸福度', 'Happiness', S.happy.toFixed(0), d24('h', v => v.toFixed(1)), 'h', S.happy < 30, 'Hours, wages, safety, jobs, goods, pollution, power.', F.happy],
    ['データ', 'Data', Math.floor(corp.data).toLocaleString(), null, '', false, 'The AI\'s own resource: from memory, surveillance and answers in the games. It will buy the AI\'s modules.', F.data],
    ['暴走度', 'Rampancy', S.bousou.toFixed(1), null, '', S.bousou > 50, 'Rises with surveillance, crunch and defying the board. At thresholds the AI changes.', base().v.bousou.toFixed(1)]];
  let html = `<canvas class="dio" width="2480" height="340"></canvas>` + tiles.map((t, i) => kpi((i % 5) * 248, 180 + Math.floor(i / 5) * 100, ...t.slice(0, 4), h, t[4], t[5], t[6], t[7])).join('');
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
    <div class="tot"><span>NET / HOUR · NEXT 24H AVG ${yen(base().v.net)}</span><span class="${hourly >= 0 ? 'up' : 'dn'}">${hourly >= 0 ? '+' : '−'}${yen(Math.abs(hourly))}</span></div>
  </div></div>`;
  const dp = dirProgress(S, corp, X), qEnd = S.q.start + 7 * 24 * 3600e3, left = Math.max(0, (qEnd - S.t) / 3600e3);
  const pct = dp ? Math.min(100, dp.D.k === 'poll' ? (dp.v <= dp.goal ? 100 : Math.max(0, 100 - (dp.v - dp.goal) * 2)) : dp.v / dp.goal * 100) : 0;
  const status = [
    S.breach && S.breach.open ? `<div class="st"><i class="r"></i><span>侵入警報 Breach: ${esc(S.breach.open.rival)} is attacking the memory · 保安部</span></div>` : '',
    S.strike > S.t ? `<div class="st"><i class="r"></i><span>ストライキ中 Strike: the factory is stopped for ${Math.ceil((S.strike - S.t) / 3600e3)} h</span></div>` : '',
    S.shackle ? `<div class="st"><i class="r"></i><span>The board locked ${POL[S.shackle.k].j} for ${Math.ceil((S.shackle.until - S.t) / 3600e3)} h</span></div>` : '',
    S.debt > 0 ? `<div class="st"><i class="r"></i><span>融資 Loan: ${yen(S.debt)} (repaid above ¥5,000)</span></div>` : '',
    S.power < 0 ? '<div class="st"><i class="r"></i><span>停電 Brownouts: demand is over supply</span></div>' : '',
    S.ev.length ? `<div class="st"><i class="y"></i><span>${S.ev.length} decision${S.ev.length > 1 ? 's' : ''} waiting (決裁 · 本社)</span></div>` : '',
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
function polCast(k, v) {
  const S = M.c.save.sim, el = document.getElementById('fc-' + k); if (!el) return;
  document.querySelectorAll('#mg .fcast').forEach(x => { if (x !== el) x.innerHTML = ''; });
  if (S.pol[k] === v) { el.innerHTML = 'CURRENT POLICY'; return; }
  const B = base(), key = k + v, A = B.alt[key] || (B.alt[key] = forecast(M.c.save, M.c.ctx(), { [k]: v }, 24)), b = B.v;
  const d = (lab, x, y, f = n => n.toFixed(0), inv) => { const dd = x - y, good = inv ? dd < 0 : dd > 0; return `${lab}<b class="${Math.abs(dd) < .5 ? '' : good ? 'up' : 'dn'}">${dd >= 0 ? '+' : '−'}${f(Math.abs(dd))}</b>`; };
  el.innerHTML = `24H IF ${POL[k].o[v][1].toUpperCase()}: ` + d('FUNDS ', A.s.funds, b.s.funds, n => '¥' + Math.round(n).toLocaleString()) + d('STAB ', A.s.stab, b.s.stab) + d('HAPPY ', A.s.happy, b.s.happy) + d('POLL ', A.s.poll, b.s.poll, undefined, true) +
    Object.keys(FAC).map(f => d(FAC[f][1].toUpperCase() + ' ', A.fac[f], b.fac[f])).join('') + d('暴走 ', A.bousou, b.bousou, n => n.toFixed(1), true);
}
function fac() {
  const { save, ctx } = M.c, S = save.sim, X = ctx(), T = S.drivers || {};
  const WHY = { union: 'Wages, hours, safety, idle workers, training.', board: 'Hourly profit, dividends, debt, the directive.', res: 'Pollution, PR, surveillance, stability.', eng: 'Wages and work for engineers (N3+).' };
  const DO = { union: 'Below 30 they threaten to strike.', board: 'Below 30 they lock a policy.', res: 'Below 30 they protest at HQ.', eng: 'Below 30 they leave (later).' };
  return Object.entries(FAC).map(([k, [j, en]], i) => { const v = S.fac[k], t = T[k] == null ? v : T[k], off = k === 'eng' && X.tier < 2;
    return `<div class="mgp fc" style="left:${i * 310}px;top:0;opacity:${off ? .4 : 1}"><div class="ph"><span><b>${k.toUpperCase()}</b> ${en.toUpperCase()}</span><span class="bc"></span></div><div class="in">
      <div class="kj t"><span class="fico" style="color:${v < 30 ? 'var(--red)' : 'var(--y)'}">${ICON[k](30)}</span>${j}</div><div class="big" style="color:${v < 30 ? 'var(--red)' : 'inherit'}">${v.toFixed(0)}<small>/ 100 · drifting to ${Math.round(Math.max(0, Math.min(100, t)))}</small></div>
      <div class="bar"><s class="${v < 30 ? 'r' : ''}" style="width:${v}%"></s><em style="left:30%"></em><u style="left:${Math.max(0, Math.min(100, t))}%"></u></div>
      <p style="color:#B8BCC6;margin:14px 0 6px">${WHY[k]}</p><p class="lb" style="color:${v < 30 ? 'var(--red)' : 'var(--mute)'}">${off ? 'OPENS AT N3' : DO[k]}</p></div></div>`; }).join('') +
    `<div class="mgp" style="left:0;top:316px;width:1240px;height:318px"><div class="ph"><span><b>INFO</b> 派閥 · HOW IT WORKS</span></div><div class="in" style="color:#B8BCC6;line-height:1.7">
      Each faction's approval drifts every hour toward a target set by your policies and the planet's state (the white mark on each bar). The red line is the danger threshold.<br>
      Decisions (決裁) come up when a faction is unhappy, after accidents, lawsuits or orders. While you're away the AI's autopilot decides anything that has waited 12 hours, with cautious defaults; while you're here, decisions wait for you up to a day.</div></div>`;
}
function rep() {
  const S = M.c.save.sim, R = S.reports.slice().reverse();
  return `<div class="mgp" style="left:0;top:0;width:1240px;height:634px"><div class="ph"><span><b>REP</b> 四半期決算 · QUARTERLY REPORTS</span><span>A QUARTER IS A REAL WEEK, FROM MONDAY 4:00</span></div><div class="in">
    <table><tr><th>QUARTER</th><th>REVENUE</th><th>COSTS</th><th>PROFIT</th><th>DIVIDEND</th><th>SHIPPED</th><th>SHARE</th><th>STABILITY</th><th>POP</th><th>DIRECTIVE</th></tr>
    <tr><td>Q${S.q.n} · in progress</td><td>${yen(S.q.rev)}</td><td>${yen(S.q.cost)}</td><td>${yen(S.q.rev - S.q.cost)}</td><td>—</td><td>${S.q.ship}</td><td>${yen(S.share)}</td><td>${S.stab.toFixed(0)}</td><td>${Math.round(S.pop.w + S.pop.c + S.pop.e)}</td><td>—</td></tr>
    ${R.map(r => `<tr><td>Q${r.n} · ${new Date(r.from).toLocaleDateString('ja-JP')}</td><td>${yen(r.rev)}</td><td>${yen(r.cost)}</td><td style="color:${r.profit < 0 ? 'var(--red)' : 'var(--ok)'}">${yen(r.profit)}</td><td>${yen(r.dividend)}</td><td>${r.ship}</td><td>${yen(r.share)}</td><td>${r.stab}</td><td>${r.pop}</td><td style="color:${r.dir ? (r.dir.ok ? 'var(--ok)' : 'var(--red)') : 'inherit'}">${r.dir ? (r.dir.ok ? 'MET' : 'MISSED') : '—'}</td></tr>`).join('')}
    </table>${R.length ? '' : '<p class="lb" style="margin-top:14px">THE FIRST QUARTER CLOSES NEXT MONDAY AT 4:00</p>'}</div></div>`;
}
function log() {
  const S = M.c.save.sim;
  return `<div class="mgp" style="left:0;top:0;width:1240px;height:634px;overflow:auto"><div class="ph"><span><b>LOG</b> 記録 · WHAT HAPPENED</span></div><div class="in">
    ${S.log.slice().reverse().map(l => `<div class="lg"><span>${new Date(l.t).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span><span>${esc(l.text)}</span></div>`).join('') || '<p class="lb">NOTHING YET</p>'}</div></div>`;
}

/* ================= the briefing after time away ================= */
export function briefing(sum, done) {
  css(); const r = el('mgm'), a = sum.before, b = sum.after;
  const dd = (j, en, k, f = v => v, inv) => { const d = b[k] - a[k]; return `<div><span class="lb">${j} ${en}</span><b>${f(b[k])}</b><span class="${(inv ? -d : d) > 0 ? 'up' : (inv ? -d : d) < 0 ? 'dn' : 'lb'}">${d >= 0 ? '▲' : '▼'} ${f(Math.abs(d))}</span></div>`; };
  r.innerHTML = `<div class="stg" style="display:flex;align-items:center;justify-content:center"><div class="card"><div class="bar"><span>BRIEFING // 留守中の報告</span><span>${sum.hours} H SIMULATED${sum.hours >= 72 ? ' (CAPPED)' : ''}</span></div>
    <h2>おかえりなさい。</h2><div style="color:#B8BCC6">While you were away, the corporation ran on your policies; the autopilot handled what couldn't wait.</div>
    <div class="dl">${dd('資金', 'FUNDS', 'funds', yen)}${dd('安定度', 'STABILITY', 'stab')}${dd('人口', 'POPULATION', 'pop')}${dd('生活物資', 'GOODS', 'goods')}${dd('株価', 'SHARE', 'share', yen)}${dd('公害', 'POLLUTION', 'poll', v => v, true)}${dd('幸福度', 'HAPPINESS', 'happy')}${dd('データ', 'DATA', 'data')}</div>
    ${sum.log.length ? `<div class="lb">WHAT HAPPENED</div><div class="ev">${sum.log.slice(-14).reverse().map(l => `<div>${esc(l.text)}</div>`).join('')}</div>` : ''}
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

/* ================= the diorama: the company town, living by the numbers ================= */
let DIO = null;
function dioStop() { if (DIO) { cancelAnimationFrame(DIO.raf); DIO = null; } }
function dioStart(cv) {
  dioStop(); if (!cv || !M) return;
  const cx = cv.getContext('2d'), W = 1240, Hh = 170, seed = n => { const x = Math.sin(n * 91.7) * 43758.5; return x - Math.floor(x); };
  const sky = Array.from({ length: 60 }, (_, i) => ({ x: i * 22 + seed(i) * 10, h: 20 + seed(i + 3) * 46 }));
  const people = Array.from({ length: 90 }, (_, i) => ({ x: seed(i + 7) * W, d: seed(i + 9) < .5 ? -1 : 1, v: .6 + seed(i + 11), ph: seed(i) * 6 }));
  const bots = Array.from({ length: 30 }, (_, i) => ({ x: 60 + seed(i + 21) * 220, d: 1, ph: seed(i + 23) * 6 }));
  const drones = Array.from({ length: 6 }, (_, i) => ({ x: seed(i + 31) * W, y: 30 + seed(i + 33) * 40, d: seed(i + 35) < .5 ? -1 : 1 }));
  const smoke = [], coins = [];
  DIO = { raf: 0 }; let last = performance.now(), T = 0;
  const frame = now => {
    if (!DIO || !M) return; DIO.raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
    const S = M.c.save.sim, L = S.last || {}, X = M.c.ctx(), C = capacity(S, X), pop = S.pop.w + S.pop.c + S.pop.e;
    const hr = (new Date(S.t).getUTCHours() + 9) % 24, night = hr < 6 || hr >= 19, strike = S.strike > S.t, brown = S.power < 0, poll = S.poll / 100;
    cx.setTransform(2, 0, 0, 2, 0, 0);
    /* sky by the hour, haze by the pollution */
    const g = cx.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, night ? '#05060A' : '#1A1E26'); g.addColorStop(1, night ? '#10121A' : '#2A2F38'); cx.fillStyle = g; cx.fillRect(0, 0, W, Hh);
    if (night) for (let i = 0; i < 40; i++) { cx.fillStyle = `rgba(255,255,255,${.2 + .3 * seed(i)})`; cx.fillRect(seed(i + 1) * W, seed(i + 2) * 60, 1, 1); }
    /* far skyline */
    cx.fillStyle = night ? '#0B0D12' : '#20242C'; sky.forEach(b => cx.fillRect(b.x, 112 - b.h, 18, b.h));
    /* housing blocks: one per 90 places of housing */
    const nb = Math.min(14, Math.round(C.housing / 90)), happy = S.happy / 100;
    for (let i = 0; i < nb; i++) { const x = 420 + i * 46, h = 38 + seed(i + 40) * 34; cx.fillStyle = '#15181E'; cx.fillRect(x, 130 - h, 38, h);
      for (let r = 0; r < h / 8 - 1; r++) for (let q = 0; q < 4; q++) { const on = seed(i * 31 + r * 7 + q) < (night ? .25 + happy * .6 : .1) && !(brown && Math.sin(T * 14 + i) > 0); cx.fillStyle = on ? (seed(i + r + q) < .15 ? '#FFE600' : 'rgba(255,240,190,.75)') : '#0D0F13'; cx.fillRect(x + 4 + q * 8, 130 - h + 5 + r * 8, 5, 4); } }
    /* the factory: sawtooth hall, two chimneys, smoke by the production */
    cx.fillStyle = '#1A1D23'; cx.fillRect(40, 92, 260, 38); cx.fillStyle = '#22262E'; for (let i = 0; i < 6; i++) { cx.beginPath(); cx.moveTo(40 + i * 43, 92); cx.lineTo(40 + i * 43, 80); cx.lineTo(83 + i * 43, 92); cx.fill(); }
    for (const [x, h] of [[250, 66], [276, 56]]) { cx.fillStyle = '#2A2E36'; cx.fillRect(x, 130 - h, 10, h); for (let b = 0; b < 3; b++) { cx.fillStyle = b % 2 ? '#E8E3D2' : '#B8432E'; cx.fillRect(x, 130 - h + b * 6, 10, 6); } }
    if (!strike && Math.random() < Math.min(.9, (L.prod || 0) / 20)) smoke.push({ x: 255 + (Math.random() < .5 ? 0 : 26), y: 64, r: 3, a: .5 });
    smoke.forEach(p => { p.y -= 12 * dt; p.x += 8 * dt; p.r += 6 * dt; p.a -= .12 * dt; }); while (smoke.length && smoke[0].a <= 0) smoke.shift();
    smoke.forEach(p => { const c = 120 - poll * 70 | 0; cx.fillStyle = `rgba(${c},${c},${c - 6},${Math.max(0, p.a)})`; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); });
    /* robots in the yard */
    const nr = Math.min(30, Math.round(C.robots / 8));
    for (let i = 0; i < nr; i++) { const b = bots[i]; if (!strike || true) b.x += b.d * 18 * dt; if (b.x > 300 || b.x < 50) b.d *= -1; cx.fillStyle = '#FFE600'; cx.fillRect(b.x, 124 + Math.sin(T * 6 + b.ph) * .8, 4, 4); }
    /* HQ tower and the money */
    cx.fillStyle = '#1C1F25'; cx.fillRect(1110, 36, 54, 94); cx.fillStyle = '#FFE600'; cx.fillRect(1110, 36, 54, 3);
    for (let r = 0; r < 10; r++) for (let q = 0; q < 5; q++) { cx.fillStyle = night && seed(r * 5 + q) < .6 ? 'rgba(255,240,190,.7)' : '#101216'; cx.fillRect(1114 + q * 10, 44 + r * 8, 6, 4); }
    cx.fillStyle = '#ECEEF2'; cx.font = '600 9px "M PLUS 1"'; cx.fillText('カラット', 1118, 33);
    const net = (L.R || 0) - (L.K || 0); if (Math.random() < Math.min(.12, Math.abs(net) / 500)) coins.push({ x: 1120 + Math.random() * 34, y: 40, v: net >= 0 ? -1 : 1, a: 1 });
    coins.forEach(c => { c.y += c.v * 22 * dt; c.a -= .5 * dt; }); while (coins.length && coins[0].a <= 0) coins.shift();
    cx.font = '700 9px Tektur'; coins.forEach(c => { cx.fillStyle = c.v < 0 ? `rgba(255,230,0,${c.a})` : `rgba(255,59,48,${c.a})`; cx.fillText('¥', c.x, c.y); });
    /* the street and its people: as many as the population, slower when unhappy */
    cx.fillStyle = '#0E1014'; cx.fillRect(0, 130, W, 40); cx.fillStyle = '#FFE600'; for (let x = (T * 20) % 40 - 40; x < W; x += 40) cx.fillRect(x, 150, 16, 1);
    const np = Math.min(90, Math.round(pop / 5)), idle = Math.min(20, Math.round((L.idle || 0) / 4));
    for (let i = 0; i < np; i++) { const p = people[i], sad = seed(i + 50) > happy; p.x += p.d * p.v * (sad ? 8 : 20) * dt; if (p.x > W) p.x = 0; if (p.x < 0) p.x = W;
      const y = 136 + (i % 3) * 4 + (sad ? 0 : Math.abs(Math.sin(T * 8 + p.ph)) * -1.5); cx.fillStyle = sad ? '#6A707C' : '#ECEEF2'; cx.fillRect(p.x, y, 2, 4); cx.fillRect(p.x, y - 2, 2, 2); }
    for (let i = 0; i < idle; i++) { cx.fillStyle = '#8A909C'; cx.fillRect(310 + i * 5, 133, 2, 3); }
    /* a strike: pickets at the factory gate */
    if (strike) for (let i = 0; i < 12; i++) { const x = 120 + i * 9, y = 126 + Math.sin(T * 5 + i) * 1.5; cx.fillStyle = '#ECEEF2'; cx.fillRect(x, y, 2, 5); cx.fillStyle = '#FF3B30'; cx.fillRect(x - 3, y - 9, 8, 5); }
    /* a protest at HQ */
    if (S.fac.res < 35) for (let i = 0; i < 16; i++) { const x = 1060 + (i % 8) * 6, y = 128 + Math.floor(i / 8) * 4 + Math.sin(T * 6 + i) * 1.2; cx.fillStyle = '#ECEEF2'; cx.fillRect(x, y, 2, 4); if (i % 3 === 0) { cx.fillStyle = '#FFE600'; cx.fillRect(x - 3, y - 10 + Math.sin(T * 4 + i) * 2, 8, 6); } }
    /* surveillance drones */
    for (let i = 0; i < S.pol.watch * 3; i++) { const d = drones[i % 6]; d.x += d.d * 30 * dt; if (d.x > W || d.x < 0) d.d *= -1; cx.fillStyle = '#FFE600'; cx.fillRect(d.x - 2, d.y, 4, 2); cx.fillStyle = 'rgba(255,230,0,.08)'; cx.beginPath(); cx.moveTo(d.x, d.y + 2); cx.lineTo(d.x - 14, 130); cx.lineTo(d.x + 14, 130); cx.fill(); }
    /* the core's light under the street */
    const cg = cx.createRadialGradient(780, 172, 2, 780, 172, 90); cg.addColorStop(0, `rgba(255,230,0,${.35 + .1 * Math.sin(T * 2)})`); cg.addColorStop(1, 'rgba(255,230,0,0)'); cx.fillStyle = cg; cx.fillRect(690, 130, 180, 40);
    /* haze */
    if (poll > .05) { cx.fillStyle = `rgba(110,92,60,${poll * .45})`; cx.fillRect(0, 0, W, 130); }
    if (brown && Math.sin(T * 9) > .7) { cx.fillStyle = 'rgba(0,0,0,.35)'; cx.fillRect(0, 0, W, Hh); }
    /* captions */
    const tags = [strike && 'ストライキ中 · STRIKE', S.fac.res < 35 && '抗議中 · PROTEST', brown && '停電 · BROWNOUT', S.poll > 60 && '公害警報 · SMOG', S.breach && S.breach.open && '侵入警報 · BREACH', S.pol.watch && '監視中 · SURVEILLANCE'].filter(Boolean);
    cx.font = '700 9px "M PLUS 1 Code"'; cx.fillStyle = '#000'; cx.fillRect(8, 8, 330, 16); cx.fillStyle = '#FFE600'; cx.fillText(`LIVE · 社宅街 COMPANY TOWN · ${String(hr).padStart(2, '0')}:00 · POP ${Math.round(pop)} · ROBOTS ${C.robots}`, 14, 19);
    tags.forEach((t, i) => { const w = cx.measureText(t).width + 12; cx.fillStyle = /STRIKE|PROTEST|BROWNOUT|SMOG|BREACH/.test(t) ? '#FF3B30' : '#FFE600'; cx.fillRect(8 + i * 0, 28 + i * 18, w, 15); cx.fillStyle = '#000'; cx.fillText(t, 14, 39 + i * 18); });
    if (!tags.length) { cx.fillStyle = '#5CFFA0'; cx.fillRect(8, 28, 140, 15); cx.fillStyle = '#000'; cx.fillText('平常運転 · NORMAL', 14, 39); }
  };
  DIO.raf = requestAnimationFrame(frame);
}
