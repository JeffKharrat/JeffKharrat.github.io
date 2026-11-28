const R = new URL('../../js/karatto/', import.meta.url).href;
const sim = await import(R + 'sim.js?v=21'), gov = await import(R + 'gov.js?v=21');
const H = 3600e3, D = 24 * H, MON = Date.UTC(2026, 10, 23) - 5 * H;
const TIERS = { founding: { mem: 0, tier: -1, div: 0, fame: 0 }, N5: { mem: 150, tier: 0, div: 2, fame: 1900 }, N3: { mem: 900, tier: 2, div: 10, fame: 11600 }, N2: { mem: 1800, tier: 3, div: 16, fame: 30000 } };
const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
/* a player model: when they visit, what they play, how they bargain */
const PAT = { active: { visit: d => true, fac: 2, log: 1 }, twice: { visit: d => d % 7 === 0 || d % 7 === 3, fac: 2, log: 1 }, absent: { visit: d => d % 28 === 0, fac: 0, log: 0 } };
function run(tier, pat, days) {
  const ctx = { ...TIERS[tier], acq: 0, up: 0, fu: {}, tech: {} }, P = PAT[pat];
  const save = { words: {}, corp: { funds: 1000, data: 0, research: 0, factory: { shifts: 1 } } };
  sim.advance(save, ctx, MON); let shiftYen = 0, votes = 0, strikes = 0; const runway = [], stab = [];
  for (let d = 1; d <= days; d++) {
    const t = MON + d * D + 10 * H;
    sim.advance(save, ctx, t, false);
    if (P.visit(d)) {
      gov.visit(save, ctx, t);
      for (let i = 0; i < P.fac; i++) { const y = 260; gov.once(save, `f${d}:${i}`, () => sim.addShift(save, 8, 18, y)); shiftYen += y; }
      for (let i = 0; i < P.log; i++) { const y = 900; gov.once(save, `l${d}:${i}`, () => sim.addGame(save, 'log', { freight: 6, training: 4, delivered: 10, right: 14, yen: y })); shiftYen += y; }
      for (const e of save.sim.ev.slice()) sim.resolve(save, e.id, sim.EVENTS[e.k].def);
      const C = gov.caseOf(save, 'line');
      if (C && C.st === 'm1') { const s = pat === 'active' ? 'full' : 'pilot'; gov.setMotion(save, 'line', s);
        if (s === 'full') { gov.offer(save, ctx, 'line', 'retrain', { places: 4, safety: 'shift', refusal: true }); gov.offer(save, ctx, 'line', 'inspect', {}); } else gov.offer(save, ctx, 'line', 'inspect', {});
        const r = gov.submit(save, ctx, 'line', `v${d}`); if (r.ok) votes++; if (!r.ok && pat === 'twice' && C.fails > 1) gov.fallback(save, ctx, 'line', 'keep'); }
      if (C && C.st === 'm2') gov.choose(save, ctx, 'line', C.m2.kind === 'hold' ? 'redeploy' : 'objective', `m2${d}`);
      if (C && C.st === 'm3') { const m = gov.inbox(save, ctx).major.m; const o = ['hold', 'cure', 'curtail'].find(id => (m.opts.find(x => x.id === id) || {}).ok); gov.choose(save, ctx, 'line', o, `m3${d}`); }
    }
    const S = save.sim; runway.push(save.corp.funds / Math.max(1, sim.essentials(S))); stab.push(S.stab);
  }
  const S = save.sim, g = gov.govOf(save), ops = S.hist.map(h => h.n).filter(v => v > 0), ref = Math.max(20, med(ops));
  strikes = S.log.filter(l => /Work and outbound dispatch stop|withholds 30%/.test(l.text)).length;
  const L = S.last || { cost: {} }, week = days / 7, rep = S.reports.reduce((a, r) => (Object.entries(r.led || {}).forEach(([k, v]) => a[k] = (a[k] || 0) + v), a), { ...S.q.led });
  return { tier, pat, days, funds: Math.round(save.corp.funds), runwayH: Math.round(med(runway)), escrow: gov.escrowed(save), wagesUpkeepH: Math.round(L.cost.wages + L.cost.upkeep + (L.cost.proj || 0)),
    passiveWk: Math.round((rep.op || 0) / (S.reports.length + S.q.hrs / 168)), activeWk: Math.round(shiftYen / week), ref: (gov.caseOf(save, 'line') || {}).ref || '—', installH: (gov.caseOf(save, 'line') || {}).ref ? +(gov.price(gov.caseOf(save, 'line').ref)(10) / ref).toFixed(1) : '—', votes, strikes, kept: g.pledges.filter(p => p.st === 'kept').length, broken: g.pledges.filter(p => p.st === 'broken').length,
    line: (gov.caseOf(save, 'line') || {}).st || '—', stabMed: Math.round(med(stab)), bousou: +S.bousou.toFixed(1), debt: S.debt };
}
const rows = [];
for (const days of [14, 90, 364]) for (const tier of Object.keys(TIERS)) for (const pat of Object.keys(PAT)) rows.push(run(tier, pat, days));
const cols = Object.keys(rows[0]); console.log(cols.join('\t')); rows.forEach(r => console.log(cols.map(c => r[c]).join('\t')));
