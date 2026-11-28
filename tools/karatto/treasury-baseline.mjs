/* The economy brief, section 9: measure before changing. One simulated quarter (a week) after a two-week warm-up, per
   tier and play pattern, with no treasury purchase: gross inflows, true cash expenses, one-time purchases, end funds,
   reserve, spendable cash and hours of essential coverage. Deterministic: same seeds, same inputs every run. */
const R = new URL('../../js/karatto/', import.meta.url).href;
const sim = await import(R + 'sim.js?v=21'), gov = await import(R + 'gov.js?v=21'), tr = await import(R + 'treasury.js?v=21');
const H = 3600e3, D = 24 * H, MON = Date.UTC(2026, 10, 23) - 5 * H;
const TIERS = { N5: { mem: 150, tier: 0, div: 2, fame: 1900 }, N4: { mem: 450, tier: 1, div: 6, fame: 5000 }, N3: { mem: 900, tier: 2, div: 10, fame: 11600 }, N2: { mem: 1800, tier: 3, div: 16, fame: 30000 } };
const PAT = { active: { visit: () => true, fac: 2, log: 1 }, daily: { visit: () => true, fac: 0, log: 0 }, weekly: { visit: d => d % 7 === 0, fac: 1, log: 0 }, 'active+tr': { visit: () => true, fac: 2, log: 1, tr: true } };
function run(tier, pat) {
  const ctx = { ...TIERS[tier], acq: 0, up: 0, fu: {}, tech: {} }, P = PAT[pat], save = { words: {}, corp: { funds: 1000, data: 0, research: 0, factory: { shifts: 1 } } };
  sim.advance(save, ctx, MON); let led0 = null, f0 = 0, R0 = 0, K0 = 0;
  for (let d = 1; d <= 21; d++) {
    const t = MON + d * D + 10 * H; sim.advance(save, ctx, t, false);
    if (d === 15) { const S = save.sim; f0 = save.corp.funds; R0 = sumQ(S, 'rev'); K0 = sumQ(S, 'cost'); led0 = ledger(S); }
    if (P.visit(d)) { gov.visit(save, ctx, t);
      for (let i = 0; i < P.fac; i++) gov.once(save, `f${d}:${i}`, () => sim.addShift(save, 8, 18, 260));
      for (let i = 0; i < P.log; i++) gov.once(save, `l${d}:${i}`, () => sim.addGame(save, 'log', { freight: 6, training: 4, right: 14, yen: 900 }));
      if (P.tr && d >= 15) { tr.sign(save, ctx, d % 2 ? 'standby' : 'community', {}, 'tr' + d); const L = save.sim.lots.find(l => l.com && !l.done && !l.off); if (L) for (let i = 0; i < P.log; i++) gov.sendLot(save, L.id, 9, `tl${d}:${i}`); }
      for (const e of save.sim.ev.slice()) sim.resolve(save, e.id, sim.EVENTS[e.k].def); }
  }
  const S = save.sim, L = ledger(S), dl = k => Math.round((L[k] || 0) - (led0[k] || 0));
  const gross = Math.round(sumQ(S, 'rev') - R0) + Math.max(0, dl('shift')) + Math.max(0, dl('orders')), opCost = Math.round(sumQ(S, 'cost') - K0);
  const ess = sim.essentials(S), res = gov.reserve(save);
  return { tier, pat, grossIn: gross, opCost, netOp: Math.round(sumQ(S, 'rev') - R0 - opCost), shiftFees: dl('shift'), orders: dl('orders'), events: dl('ev'), capital: dl('cap'),
    funds0: Math.round(f0), funds1: Math.round(save.corp.funds), freeCash: Math.round(save.corp.funds - f0), reserve: Math.round(res), spendable: Math.round(save.corp.funds - res), coverH: Math.round(save.corp.funds / Math.max(1, ess)) };
}
/* revenue and cost over every closed quarter plus the open one */
function sumQ(S, k) { return S.reports.reduce((n, r) => n + (r[k] || 0), 0) + (S.q[k] || 0); }
function ledger(S) { return S.reports.reduce((a, r) => (Object.entries(r.led || {}).forEach(([k, v]) => a[k] = (a[k] || 0) + v), a), { ...S.q.led }); }
const rows = []; for (const t of Object.keys(TIERS)) for (const p of Object.keys(PAT)) rows.push(run(t, p));
const cols = Object.keys(rows[0]); console.log(cols.join('\t')); rows.forEach(r => console.log(cols.map(c => r[c]).join('\t')));
