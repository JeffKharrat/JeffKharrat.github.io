const R = new URL('../..', import.meta.url).href.replace(/\/$/, '');
const sim = await import(R + '/js/karatto/sim.js?v=8');
const H = 3600e3, MON = Date.UTC(2026, 10, 23) - 5 * H; // Mon 23 Nov 04:00 JST
const cases = { founding: { mem: 0, acq: 0, tier: -1, div: 0, up: 0, fame: 0, tech: {} }, N5: { mem: 150, acq: 0, tier: 0, div: 2, up: 0, fame: 1900, tech: {} }, N3: { mem: 900, acq: 0, tier: 2, div: 10, up: 0, fame: 11600, tech: {} } };
for (const [name, ctx] of Object.entries(cases)) for (const eco of [0, 2]) {
  const save = { corp: { funds: 1000, data: 0, research: 0 }, sim: undefined };
  sim.advance(save, ctx, MON); save.sim.pol.eco = eco;
  for (let d = 1; d <= 14; d++) sim.advance(save, ctx, MON + d * 24 * H);
  const S = save.sim, L = S.last;
  console.log(name, eco ? 'strong' : 'default', 'net/h', (L.R - L.K).toFixed(0), 'funds', Math.round(save.corp.funds), 'poll', S.poll.toFixed(0), 'stab', S.stab.toFixed(0), 'union', S.fac.union.toFixed(0), 'reports', S.reports.length);
}
// strike hour
for (const [name, ctx] of Object.entries(cases)) {
  const save = { corp: { funds: 1000, data: 0, research: 0 } }; sim.advance(save, ctx, MON); sim.advance(save, ctx, MON + 48 * H);
  const c = JSON.parse(JSON.stringify(save)); sim.advance(save, ctx, MON + 49 * H); const a = save.sim.last; c.sim.strike = c.sim.t + 24 * H; sim.advance(c, ctx, MON + 49 * H); const b = c.sim.last;
  console.log('strike', name, (a.R - a.K).toFixed(0), '->', (b.R - b.K).toFixed(0));
}
// 28-day absence at N5
{ const ctx = cases.N5, save = { corp: { funds: 1000, data: 0, research: 0 } }; sim.advance(save, ctx, MON); sim.advance(save, ctx, MON + 24 * H);
  const r = sim.advance(save, ctx, MON + 29 * 24 * H); console.log('absence hours', r.hours, 'reports', r.reports.map(x => `Q${x.n} rev ${x.rev} dir ${x.dir && x.dir.ok}`).join(' | ')); }
