const R = new URL('../../js/karatto/', import.meta.url).href;
const sim = await import(R + 'sim.js?v=15'), gov = await import(R + 'gov.js?v=15'), riv = await import(R + 'rivals.js?v=15');
const H = 3600e3, MON = Date.UTC(2026, 10, 23) - 5 * H, day = d => MON + d * 24 * H + 2 * H;
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL') + ' ' + m); if (!c) fails++; };
const N3 = { mem: 900, acq: 0, tier: 2, div: 10, up: 0, fu: {}, fame: 11600, tech: {} };
function mk() { const s = { words: {}, corp: { funds: 60000, data: 500, research: 0, factory: { shifts: 0 } } }; sim.advance(s, N3, MON); sim.advance(s, N3, day(1) - 3 * H); s.sim.pol.eco = 2; riv.rivOf(s); s.gov = undefined; return s; }
console.log('1 · Entry: you opted in by breaching a core');
{ const s = mk(); gov.visit(s, N3, day(1)); ok(!gov.caseOf(s, 'proxy'), 'no contest without a core breach at N3');
  riv.settleRaid(s, 'kurogane', N3, { nodes: 10, vaults: 2, core: true, traced: false }); s.riv.r.kurogane.grudge = 60; gov.progress(s, N3); const C = gov.caseOf(s, 'proxy');
  ok(C && C.st === 'm1' && C.bidder === 'kurogane' && C.lender === 'shirasagi', 'Kurogane bids, Shirasagi lends');
  ok(gov.tally(s, N3, { motion: 'refuse', cl: {} }).pass && !gov.tally(s, N3, { motion: 'sell', cl: {} }).pass && !gov.tally(s, N3, { motion: 'finance', cl: {} }).pass, 'refuse passes; sell and a bare loan fail');
  gov.setMotion(s, 'proxy', 'finance'); gov.offer(s, N3, 'proxy', 'covenant', {}); ok(gov.tally(s, N3, C.draft).pass, 'the loan passes with the chair\'s covenant'); }
const open = () => { const s = mk(); gov.visit(s, N3, day(1)); riv.settleRaid(s, 'kurogane', N3, { nodes: 10, vaults: 2, core: true, traced: false }); s.riv.r.kurogane.grudge = 60; gov.progress(s, N3); return s; };
console.log('2 · Refuse and fight: raids and the Exchange win proxies');
{ const s = open(), C = gov.caseOf(s, 'proxy'); gov.submit(s, N3, 'proxy', 'v'); ok(C.st === 'contest', 'the contest begins at ' + C.sup + '%');
  const a = JSON.parse(JSON.stringify(s));
  for (let d = 2; d <= 4; d++) { sim.advance(s, N3, day(d)); riv.settleRaid(s, 'kurogane', N3, { nodes: 10, vaults: 3, core: true, traced: false }); sim.addGame(s, 'exchange', { move: 3 }); gov.visit(s, N3, day(d)); }
  ok(C.st === 'count' && C.sup >= 50, `fighting: ${C.trail.join(' → ')}%`);
  const g = gov.inbox(s, N3).major; ok(g && g.m.n === 2, 'the shareholders\' meeting is on the counter'); gov.choose(s, N3, 'proxy', 'count', 'c'); ok(C.outcome === 'won' && !s.sim.conc, 'the bid fails, the port stays');
  const C2 = gov.caseOf(a, 'proxy'); for (let d = 2; d <= 4; d++) { sim.advance(a, N3, day(d)); gov.visit(a, N3, day(d)); }
  ok(C2.sup < 50, `doing nothing: ${C2.trail.join(' → ')}%`); gov.choose(a, N3, 'proxy', 'count', 'c'); ok(C2.st === 'lost' && a.sim.conc && a.sim.conc.by === 'kurogane', 'lost: Kurogane holds the port');
  const n0 = (sim.advance(a, N3, day(4) + 3 * H), a.sim.last); ok(Math.abs(n0.rev.sales / (n0.sold * n0.price) - .75) < .01, 'they keep 25% of every sale');
  const m = gov.inbox(a, N3).major.m; ok(m.opts.find(o => o.id === 'buyback').ok && !m.opts.find(o => o.id === 'tender').ok, 'buyback open; the tender needs a new core breach');
  riv.settleRaid(a, 'kurogane', N3, { nodes: 10, vaults: 0, core: true, traced: false }); ok(gov.inbox(a, N3).major.m.opts.find(o => o.id === 'tender').ok, 'after a breach, the cheap tender opens');
  const f = a.corp.funds; gov.choose(a, N3, 'proxy', 'tender', 't'); ok(!a.sim.conc && C2.outcome === 'tender' && f > a.corp.funds, 'tender won: the port returns'); }
console.log('3 · The loan: a broken condition, the port seized');
{ const s = open(), C = gov.caseOf(s, 'proxy'); gov.setMotion(s, 'proxy', 'finance'); gov.offer(s, N3, 'proxy', 'covenant', {}); const f = s.corp.funds; gov.submit(s, N3, 'proxy', 'v');
  ok(C.st === 'loan' && s.corp.funds > f, 'the loan comes in'); s.sim.pol.eco = 0; s.sim.poll = 60; sim.advance(s, N3, day(2)); s.sim.poll = 60; gov.visit(s, N3, day(2));
  ok(C.st === 'lost' && s.sim.conc && s.sim.conc.by === 'shirasagi', 'pollution over 40: Shirasagi seizes the port'); ok(s.gov.pledges.find(p => p.id === 'proxy:loan').st === 'broken', 'the covenant is broken on the record'); }
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
