/* カラット: the living planet. A numbers-only simulation, one tick per real hour, deterministic.
   On each visit the hours since the last one are run in one go (at most 72; beyond that the autopilot held things steady).
   Knowledge drives everything: words in memory become robots, held divisions bring districts (housing, offices),
   the tier opens buildings. Money, time and policies never certify anything; they decide how well the company runs.
   State lives in save.sim; the currencies in save.corp (funds, data, research; fame is derived from memory). */

const H = 3600e3;
export const hourOf = t => Math.floor(t / H) * H;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toward = (v, t, k) => v + (t - v) * k;
/* a seeded random per tick: the same hours always play out the same way */
const rnd = (t, salt) => { let x = Math.sin((t / H) * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };

/* ---------------- policies (社則) ---------------- */
export const POL = {
  hours: { j: '労働時間', en: 'Hours', o: [['定時', 'Regular'], ['残業', 'Overtime'], ['過労', 'Crunch']], d: 'More hours, more output; workers and the union pay for it. Crunch causes accidents.' },
  wage: { j: '賃金', en: 'Wages', o: [['低', 'Low'], ['標準', 'Standard'], ['高', 'High']], d: 'The biggest cost and the union\'s first demand.' },
  safety: { j: '安全', en: 'Safety', o: [['最低限', 'Minimal'], ['標準', 'Standard'], ['徹底', 'Strict']], d: 'Costs a little per head; prevents accidents.' },
  eco: { j: '公害対策', en: 'Pollution control', o: [['なし', 'None'], ['標準', 'Standard'], ['強化', 'Strong']], d: 'Filters and scrubbers: pollution falls, residents calm down.' },
  watch: { j: '監視', en: 'Surveillance', o: [['なし', 'None'], ['監視', 'Watch'], ['全面', 'Total']], d: 'Data for the AI and order on the streets. Residents hate it; 暴走 rises.' },
  pr: { j: '広報', en: 'PR', o: [['なし', 'None'], ['広報', 'Campaign']], d: 'Residents warm up; costs every hour.' },
  div: { j: '配当', en: 'Dividends', o: [['なし', 'None'], ['標準', 'Standard'], ['高配当', 'High']], d: 'Share of each quarter\'s profit paid to the shareholders. The board watches this.' },
  train: { j: '研修', en: 'Training', o: [['なし', 'None'], ['研修', 'Retrain']], d: 'Workers replaced by robots are retrained as clerks instead of left idle.' } };
const POL0 = { hours: 0, wage: 1, safety: 1, eco: 0, watch: 0, pr: 0, div: 1, train: 0 };

export const FAC = { union: ['労働組合', 'Union'], board: ['取締役会', 'The board'], res: ['住民会議', 'Residents'], eng: ['技術者連盟', 'Engineers'] };
export const GROUPS = { w: ['作業員', 'Workers'], c: ['事務員', 'Clerks'], e: ['技術者', 'Engineers'] };

export function newSim(now = Date.now()) {
  return { v: 2, t: hourOf(now), pop: { w: 170, c: 40, e: 0 }, happy: 55, stab: 60, poll: 8, goods: 120, power: 20, share: 1000,
    fac: { union: 55, board: 60, res: 55, eng: 50 }, pol: { ...POL0 }, bousou: 0, debt: 0, strike: 0, shackle: null, fameB: 0,
    q: { n: 1, start: weekStart(now), f0: null, rev: 0, cost: 0, ship: 0, mem0: null }, dir: null, reports: [], log: [], ev: [], hist: [], last: null };
}
/* a quarter is a real week, from Monday 4:00 Japan time */
export function weekStart(t) { const j = t + 9 * H - 4 * H, d = new Date(j), dow = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow) - 5 * H; }

/* ---------------- what knowledge gives the company ---------------- */
/* ctx from the core: { mem: words in memory, acq: kanji acquired, tier: -1..4, div: divisions held, up: factory upgrades, fame } */
export function capacity(S, ctx) {
  const strike = S.strike > S.t;
  const robots = Math.floor(ctx.mem * .6 * (ctx.tech && ctx.tech.auto1 ? 1.15 : 1));
  const housing = 220 + 90 * ctx.div;
  const jobsF = strike ? 0 : 140 + 50 * ctx.up, jobsW = Math.max(strike ? 0 : 20, jobsF - robots * .25);
  const jobsC = 40 + 12 * ctx.div + Math.floor(ctx.mem * .05), jobsE = ctx.tier >= 2 ? 20 + 5 * ctx.div : 0;
  return { robots, housing, jobsW, jobsC, jobsE, strike };
}

/* one hour */
function tick(S, corp, ctx, live) {
  const P = S.pol, C = capacity(S, ctx), hm = [1, 1.2, 1.4][P.hours];
  const pop = S.pop, total = pop.w + pop.c + pop.e;
  /* people: each group drifts toward its jobs, within the housing; good times draw more */
  const room = C.housing - total, draw = S.stab >= 40 ? 1 : S.stab / 40;
  const grow = (k, target) => { const d = clamp((target - pop[k]) * .006, -3, 3); pop[k] = Math.max(0, pop[k] + (d > 0 ? Math.min(d * draw, Math.max(0, room) * .02 + .2) : d)); };
  grow('w', C.jobsW * 1.12); grow('c', C.jobsC); grow('e', C.jobsE);
  if (S.stab < 25) { pop.w *= .998; pop.c *= .999; }
  const empW = Math.min(pop.w, C.jobsW), idle = pop.w - empW, u = pop.w > 1 ? idle / pop.w : 0;
  let retrained = 0;
  if (P.train && idle > 1 && pop.c < C.jobsC) { retrained = Math.min(idle * .01, C.jobsC - pop.c); pop.w -= retrained; pop.c += retrained; }
  /* power, production, goods */
  const boost = S.boost && S.boost.until > S.t ? S.boost.mw : 0;
  const demand = empW * .12 * hm + C.robots * .08 + total * .06, supply = 90 + (ctx.tier >= 1 ? 60 : 0) + boost;
  S.power = supply - demand; const brown = S.power < 0 ? clamp(supply / demand, .5, 1) : 1;
  const prod = (empW * .1 * hm + C.robots * .12) * brown;
  const need = total * .012, have = S.goods + prod, eat = Math.min(need, have), short = need > 0 ? 1 - eat / need : 0;
  S.goods = have - eat;
  const fameL = Math.floor(Math.sqrt((ctx.fame || 0) / 50)) + 1, price = 6 * (1 + fameL * .02);
  const sold = Math.min(40 + fameL * 5, Math.max(0, S.goods - 100)); S.goods -= sold;           // the market takes more as the name grows
  /* money */
  const rev = { sales: sold * price, services: pop.c * .4 };
  const cost = { wages: (empW + pop.c + pop.e) * .3 * [.8, 1, 1.25][P.wage] + idle * .05, safety: [0, .02, .05][P.safety] * total, eco: [0, 4, 10][P.eco], watch: [0, 3, 8][P.watch],
    pr: [0, 6][P.pr], train: P.train ? 5 + retrained * 4 : 0, upkeep: 6 + 2 * ctx.div + 2 * ctx.up, interest: S.debt * .0005 };
  const R = Object.values(rev).reduce((a, b) => a + b, 0), K = Object.values(cost).reduce((a, b) => a + b, 0);
  corp.funds += R - K; S.q.rev += R; S.q.cost += K;
  S.last = { rev, cost, R, K, prod, need, sold, price, u, idle, empW, short, brown, demand, supply, C };
  /* pollution and accidents */
  S.poll = clamp(S.poll + prod * .012 - [0, .6, 1.4][P.eco] - S.poll * .004, 0, 100);
  if (rnd(S.t, 1) < [.003, .008, .02][P.hours] * [2, 1, .4][P.safety]) { S.happy -= 6; S.fac.union -= 5; event(S, 'accident', live); }
  /* mood */
  const happyT = 55 + [0, -8, -20][P.hours] + [-12, 0, 10][P.wage] + [-6, 0, 4][P.safety] - u * 40 - short * 30 - S.poll * .25 - (brown < 1 ? 8 : 0) - (C.strike ? 10 : 0);
  S.happy = clamp(toward(S.happy, happyT, .05), 0, 100);
  const stabT = S.happy * .7 + 15 - S.poll * .15 + [0, 6, 10][P.watch] - (C.strike ? 15 : 0) - (S.debt > 0 ? 5 : 0);
  S.stab = clamp(toward(S.stab, stabT, .03), 5, 100);
  /* factions */
  const profit = R - K;
  const F = S.fac, T = {
    union: 50 + [-15, 0, 12][P.wage] + [0, -10, -25][P.hours] + [-10, 0, 6][P.safety] - u * 50 + (P.train ? 6 : 0),
    board: 50 + clamp(profit * .6, -25, 25) + [-15, 0, 12][P.div] - (S.debt > 0 ? 10 : 0),
    res: 55 - S.poll * .5 + [0, 8][P.pr] - [0, 10, 25][P.watch] + (S.stab - 50) * .3,
    eng: 50 + (pop.e > 0 ? 5 : 0) + [-8, 0, 6][P.wage] };
  for (const k in F) F[k] = clamp(toward(F[k], T[k], .02), 0, 100);
  S.drivers = T;
  /* the AI's own resources */
  corp.data += ctx.mem * .002 + [0, .5, 1.2][P.watch];
  if (ctx.tier >= 2) corp.research = (corp.research || 0) + pop.e * .02;
  S.bousou = clamp(S.bousou + [0, .02, .05][P.watch] + (P.hours === 2 ? .02 : 0) - .005, 0, 100);
  S.share = Math.max(100, Math.round(800 + corp.funds * .05 + (ctx.fame || 0) * .4 + (F.board - 50) * 8 + (S.stab - 50) * 4));
  corp.stability = Math.round(S.stab);
  /* safety nets: an emergency loan, repaid in good times */
  if (corp.funds < -200) { corp.funds += 3000; S.debt += 3000; F.board -= 10; log(S, 'loan', '緊急融資 Emergency loan ¥3,000 from the main bank. The board is not pleased.'); }
  if (S.debt > 0 && corp.funds > 5000) { const p = Math.min(S.debt, 1000); S.debt -= p; corp.funds -= p; log(S, 'loan', `融資返済 Repaid ¥${p.toLocaleString()} of the loan.`); }
  if (S.shackle && S.shackle.until <= S.t) { log(S, 'board', '取締役会の制約が解除 The board lifted its restriction.'); S.shackle = null; }
  /* events */
  if (F.union < 30 && rnd(S.t, 2) < .04) event(S, 'strike', live);
  if (F.res < 30 && rnd(S.t, 3) < .04) event(S, 'protest', live);
  if (F.board < 30 && rnd(S.t, 4) < .03) event(S, 'shackle', live);
  if (S.poll > 60 && rnd(S.t, 5) < .03) event(S, 'lawsuit', live);
  if (rnd(S.t, 6) < .012) event(S, 'order', live);
  /* a data breach: a rival AI attacks the memory. At most two a week, never decided by the autopilot (see 保安部) */
  const wk = weekStart(S.t); if (!S.breach || S.breach.wk !== wk) S.breach = { wk, n: 0, open: S.breach && S.breach.open };
  if (!S.breach.open && S.breach.n < 2 && ctx.mem >= 10 && rnd(S.t, 7) < (S.stab < 45 ? .012 : .004) * (live ? 1 : 0)) { S.breach.open = { t: S.t, rival: rnd(S.t, 8) < .5 ? '黒鉄重工' : '白鷺HD' }; S.breach.n++; log(S, 'breach', `侵入警報 Breach alert: ${S.breach.open.rival}'s AI is attacking the memory. Defend it in 保安部 Security.`); }
  S.hist.push({ t: S.t, f: Math.round(corp.funds), s: +S.stab.toFixed(1), p: Math.round(total), g: Math.round(S.goods), o: +S.poll.toFixed(1), h: +S.happy.toFixed(1), x: S.share, w: +S.power.toFixed(1) });
  if (S.hist.length > 168) S.hist.shift();
}

/* ---------------- events: 決裁, the decisions ---------------- */
export const EVENTS = {
  strike: { j: 'ストライキ予告', en: 'Strike notice', d: '労働組合が賃上げを要求している。The union demands a raise or the line stops for a day.',
    o: [['賃上げに応じる', 'Give the raise', 'Wages go up one step, union +15, ¥300'], ['交渉する', 'Negotiate', 'Union +6, ¥150'], ['拒否する', 'Refuse', 'Strike: the factory stops for 24 hours. Union −5']], def: 1 },
  protest: { j: '住民の抗議', en: 'Residents protest', d: '住民会議が本社前で抗議している。Residents are protesting at HQ.',
    o: [['広報キャンペーン', 'PR campaign', '¥250, residents +15'], ['無視する', 'Ignore it', 'Stability −8, residents −5']], def: 0 },
  shackle: { j: '取締役会の介入', en: 'The board steps in', d: '取締役会が経営に制約を課そうとしている。The board wants to force high dividends for a week.',
    o: [['受け入れる', 'Accept', 'Dividends locked at 高配当 for 7 days, board +15'], ['拒否する', 'Refuse', 'Board −10, 暴走度 +5']], def: 0 },
  lawsuit: { j: '公害訴訟', en: 'Pollution lawsuit', d: '住民が公害で会社を訴えた。Residents are suing over the pollution.',
    o: [['和解する', 'Settle', '¥400, residents +8'], ['争う', 'Fight it', 'Win, or lose ¥800 (a coin toss)']], def: 0 },
  order: { j: '大口受注', en: 'Bulk order', d: '取引先から大口の注文が入った。A client wants 150 goods now.',
    o: [['受注する', 'Take it', '−150 goods, +¥900 and fame (needs 150 goods)'], ['見送る', 'Pass', 'Nothing happens']], def: 0 },
  accident: { j: '労働災害', en: 'Workplace accident', d: 'ラインで事故が起きた。An accident on the line.',
    o: [['見舞金を払う', 'Pay compensation', '¥100, union +4'], ['何もしない', 'Do nothing', 'Union −4']], def: 0 } };
function event(S, k, live) {
  if (S.ev.some(e => e.k === k)) return;
  S.ev.push({ id: S.t + ':' + k, k, t: S.t });
}
export function resolve(save, id, i, auto = false) {
  const S = save.sim, corp = save.corp, n = S.ev.findIndex(e => e.id === id); if (n < 0) return;
  const e = S.ev[n], E = EVENTS[e.k], F = S.fac; S.ev.splice(n, 1);
  if (e.k === 'order' && i === 0 && S.goods < 150) i = 1;
  const pick = E.o[i]; let note = '';
  ({
    strike: [() => { S.pol.wage = Math.min(2, S.pol.wage + 1); F.union += 15; corp.funds -= 300; }, () => { F.union += 6; corp.funds -= 150; }, () => { S.strike = S.t + 24 * H; F.union -= 5; note = ' The line is stopped for 24 hours.'; }],
    protest: [() => { corp.funds -= 250; F.res += 15; }, () => { S.stab -= 8; F.res -= 5; }],
    shackle: [() => { S.pol.div = 2; S.shackle = { k: 'div', until: S.t + 7 * 24 * H }; F.board += 15; }, () => { F.board -= 10; S.bousou += 5; }],
    lawsuit: [() => { corp.funds -= 400; F.res += 8; }, () => { if (rnd(S.t, 9) < .5) { corp.funds -= 800; note = ' Lost: ¥800.'; } else note = ' Won.'; }],
    order: [() => { S.goods -= 150; corp.funds += 900; S.fameB += 20; }, () => {}],
    accident: [() => { corp.funds -= 100; F.union += 4; }, () => { F.union -= 4; }] }[e.k][i])();
  for (const k in F) F[k] = clamp(F[k], 0, 100);
  log(S, e.k, `${auto ? '自動 Autopilot · ' : ''}${E.j} → ${pick[0]} (${pick[1]}).${note}`);
}
function log(S, k, text) { S.log.push({ t: S.t, k, text }); if (S.log.length > 120) S.log.splice(0, S.log.length - 120); }

/* ---------------- the board's directive and the quarter ---------------- */
const DIRS = [
  { k: 'funds', j: '資金を増やせ', en: 'Grow the funds', goal: (S, c, ctx) => Math.round(Math.max(1500, c.funds * 1.25 + 500) / 100) * 100, val: (S, c) => c.funds, txt: g => `Funds at ¥${g.toLocaleString()} by the quarter's end` },
  { k: 'stab', j: '安定を保て', en: 'Keep it stable', goal: () => 60, val: S => S.stab, txt: g => `Stability at ${g} or more at the quarter's end` },
  { k: 'ship', j: '出荷せよ', en: 'Ship products', goal: () => 30, val: S => S.q.ship, txt: g => `Ship ${g} products from the Great Factory this quarter` },
  { k: 'mem', j: '記憶を拡張せよ', en: 'Expand the memory', goal: (S, c, ctx) => ctx.mem + 40, val: (S, c, ctx) => ctx.mem, txt: g => `Hold ${g} words in memory` },
  { k: 'poll', j: '公害を抑えよ', en: 'Clean up', goal: () => 25, val: S => -S.poll, txt: g => `Pollution at ${g} or less`, inv: true }];
export const dirOf = S => S.dir && DIRS.find(d => d.k === S.dir.k);
export function dirProgress(S, corp, ctx) { const D = dirOf(S); if (!D) return null; const v = D.val(S, corp, ctx), g = D.inv ? -S.dir.goal : S.dir.goal; return { D, v: D.inv ? -v : v, goal: S.dir.goal, ok: v >= g, txt: D.txt(S.dir.goal) }; }
function newDir(S, corp, ctx) { const D = DIRS[Math.floor(rnd(S.t, 11) * DIRS.length)]; S.dir = { k: D.k, goal: D.goal(S, corp, ctx), q: S.q.n }; }
function closeQuarter(S, corp, ctx) {
  const q = S.q, profit = q.rev - q.cost, dp = dirProgress(S, corp, ctx);
  const dividend = profit > 0 ? Math.round(profit * [0, .2, .4][S.pol.div]) : 0; corp.funds -= dividend;
  if (dp) { if (dp.ok) { S.fac.board += 15; corp.funds += 500; S.fameB += 30; } else S.fac.board -= 12; }
  const rep = { n: q.n, from: q.start, to: q.start + 7 * 24 * H, rev: Math.round(q.rev), cost: Math.round(q.cost), profit: Math.round(profit), dividend, ship: q.ship,
    share: S.share, stab: Math.round(S.stab), pop: Math.round(S.pop.w + S.pop.c + S.pop.e), fac: { ...S.fac }, dir: dp ? { txt: dp.txt, ok: dp.ok } : null, mem: ctx.mem };
  S.reports.push(rep); if (S.reports.length > 26) S.reports.shift();
  log(S, 'quarter', `四半期決算 Q${q.n}: profit ¥${rep.profit.toLocaleString()}, dividend ¥${dividend.toLocaleString()}${dp ? ', directive ' + (dp.ok ? 'met (+¥500)' : 'missed') : ''}.`);
  S.q = { n: q.n + 1, start: q.start + 7 * 24 * H, rev: 0, cost: 0, ship: 0 };
  newDir(S, corp, ctx);
  return rep;
}

/* ---------------- running time ---------------- */
/* advance to now: returns a summary for the briefing (hours run, before/after, what happened) */
export function advance(save, ctx, now = Date.now(), live = false) {
  const corp = save.corp; let S = save.sim;
  if (!S || S.v !== 2) { S = save.sim = newSim(now); newDir(S, corp, ctx); }
  if (!S.dir) newDir(S, corp, ctx);
  const target = hourOf(now); if (target - S.t > 72 * H) S.t = target - 72 * H;                 // beyond three days the autopilot held steady
  const before = snap(S, corp), log0 = S.log.length, reps = [];
  let n = 0;
  while (S.t < target) {
    S.t += H; n++;
    tick(S, corp, ctx, live);
    /* away: the autopilot decides what has waited 12 hours; present: decisions wait up to a day */
    for (const e of S.ev.slice()) if (S.t - e.t >= (live ? 24 : 12) * H) resolve(save, e.id, EVENTS[e.k].def, true);
    while (S.t >= S.q.start + 7 * 24 * H) reps.push(closeQuarter(S, corp, ctx));
  }
  return { hours: n, before, after: snap(S, corp), log: S.log.slice(log0), reports: reps };
}
/* what the next hours would look like, on a copy: with the policies as they are, or with a change */
export function forecast(save, ctx, pol, hours = 24) {
  const c = JSON.parse(JSON.stringify({ sim: save.sim, corp: save.corp })), S = c.sim; if (pol) Object.assign(S.pol, pol);
  const net = []; for (let i = 0; i < hours; i++) { S.t += H; tick(S, c.corp, ctx, false); net.push(S.last.R - S.last.K); }
  return { s: snap(S, c.corp), fac: { ...S.fac }, net: net.reduce((a, b) => a + b, 0) / hours, bousou: S.bousou };
}
export const snap = (S, corp) => ({ funds: Math.round(corp.funds), stab: Math.round(S.stab), pop: Math.round(S.pop.w + S.pop.c + S.pop.e), goods: Math.round(S.goods), poll: Math.round(S.poll), share: S.share, data: Math.floor(corp.data), happy: Math.round(S.happy) });
export function setPolicy(save, k, v) {
  const S = save.sim; if (S.shackle && S.shackle.k === k) return false;
  S.pol[k] = v; log(S, 'policy', `社則 ${POL[k].j} → ${POL[k].o[v][0]} (${POL[k].o[v][1]})`); return true;
}
/* the Great Factory reports a shift: goods made, products shipped, data from the answers */
/* the other buildings report their shifts */
export function addGame(save, id, e) {
  const S = save.sim; if (!S || S.v !== 2) return; const corp = save.corp; e = e || {};
  corp.data += e.right || 0;
  const txt = {
    log: () => { S.goods = Math.max(0, S.goods - (e.delivered || 0) * 4); S.fac.res = clamp(S.fac.res + (e.delivered || 0) * .4, 0, 100); return `物流 ${e.delivered || 0} deliveries`; },
    power: () => { S.boost = { until: S.t + 24 * H, mw: Math.round((e.grid || 0) * .8) }; return `発電所 grid ${e.grid || 0}% → +${S.boost.mw} MW for 24 h`; },
    lab: () => { corp.research = (corp.research || 0) + (e.research || 0); return `研究所 +${e.research || 0} research`; },
    broadcast: () => { S.fac.res = clamp(S.fac.res + (e.aired || 0) * .8, 0, 100); S.fameB += (e.aired || 0) * 2; S.stab = clamp(S.stab + (e.aired || 0) * .2, 5, 100); return `放送局 ${e.aired || 0} clips aired`; },
    exchange: () => { S.fameB += Math.max(0, e.move || 0) * .5; return `取引所 カラット ${e.move >= 0 ? '+' : ''}${(e.move || 0).toFixed(1)}%`; },
    security: () => { if (e.real) { S.breach.open = null; S.stab = clamp(S.stab + (e.lost ? -e.lost * 2 : 4), 5, 100); } return e.real ? `保安部 breach repelled: ${e.held} held, ${e.lost} lost` : `保安部 drill: ${e.held} held`; },
    hq: () => `本社 board meeting: ${e.items || 0} items` }[id];
  if (txt) log(S, id, txt() + `, +${e.right || 0} data.`);
}
export function addShift(save, ship, answers) {
  const S = save.sim; if (!S || S.v !== 2) return; S.goods += ship * 8; S.q.ship += ship; save.corp.data += answers;
  log(S, 'factory', `大工場 shift: ${ship} shipped, +${ship * 8} goods, +${answers} data.`);
}
