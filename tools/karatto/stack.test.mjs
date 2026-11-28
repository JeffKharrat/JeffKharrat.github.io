const R = new URL('../../js/karatto/', import.meta.url).href;
const sim = await import(R + 'sim.js?v=21'), gov = await import(R + 'gov.js?v=21');
const H = 3600e3, MON = Date.UTC(2026, 10, 23) - 5 * H, day = d => MON + d * 24 * H + 2 * H;
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL') + ' ' + m); if (!c) fails++; };
const N4 = { mem: 450, acq: 0, tier: 1, div: 6, up: 0, fu: {}, fame: 6000, tech: {} };
function mk() { const s = { words: {}, corp: { funds: 20000, data: 0, research: 0, factory: { shifts: 0 } } }; sim.advance(s, N4, MON); sim.advance(s, N4, day(1) - 3 * H); s.sim.poll = 70; s.sim.pHi = 0; return s; }
console.log('1 · The trigger: 12 hours of smog');
{ const s = mk(); gov.visit(s, N4, day(1)); ok(!gov.caseOf(s, 'stack'), 'not yet: the smog has to last'); s.sim.pHi = 12; gov.progress(s, N4); ok(gov.caseOf(s, 'stack') && gov.caseOf(s, 'stack').st === 'm1', 'after 12 hours the hearing opens');
  const s2 = mk(); sim.advance(s2, N4, day(1) + 14 * H); ok(s2.sim.pHi > 0 || s2.sim.poll < 55, `the sim counts sustained smog (pHi ${s2.sim.pHi}, poll ${s2.sim.poll.toFixed(0)})`); }
const open = () => { const s = mk(); s.sim.pHi = 12; gov.visit(s, N4, day(1)); return s; };
console.log('2 · The three proposals');
{ const s = open(), C = gov.caseOf(s, 'stack');
  let t = gov.tally(s, N4, { motion: 'retrofit', cl: {} }); ok(t.pass, `retrofit passes with the smog on the union's lungs ${t.yes}-${t.no}-${t.abs}`);
  t = gov.tally(s, N4, { motion: 'cap', cl: {} }); ok(!t.pass, `a bare cap fails ${t.yes}-${t.no}-${t.abs}`);
  gov.setMotion(s, 'stack', 'cap'); gov.offer(s, N4, 'stack', 'premium', {}); t = gov.tally(s, N4, C.draft); ok(t.pass, `with finance's clean-label premium it passes ${t.yes}-${t.no}-${t.abs}`);
  t = gov.tally(s, N4, { motion: 'delay', cl: {} }); ok(t.pass && t.seats.civic.vote === 'no', `delay passes over the residents' no ${t.yes}-${t.no}-${t.abs}`); }
console.log('3 · Retrofit: commissioning, the review, kept');
{ const s = open(); gov.offer(s, N4, 'stack', 'grid', {}); const r = gov.submit(s, N4, 'stack', 'v'); ok(r.pass, 'disclose and retrofit, with a Power window');
  const p = s.sim.proj.find(x => x.id === 'scrubber'); ok(p && p.prodX === .9, 'production −10% while commissioning');
  for (let i = 0; i < 2; i++) gov.once(s, 'f' + i, () => sim.addShift(s, 8, 20, 100)); sim.addGame(s, 'power', { grid: 80 }); gov.progress(s, N4);
  ok(p.pollX === .35 && p.prodX === 1, 'commissioned after two runs and a Power shift: pollution −65%');
  for (let d = 2; d <= 4; d++) { sim.advance(s, N4, day(d)); gov.visit(s, N4, day(d)); }
  const C = gov.caseOf(s, 'stack'); ok(C.st === 'm2', 'the hearing reconvenes after three visits');
  gov.choose(s, N4, 'stack', 'keep', 'k'); ok(C.st === 'done' && s.gov.trust.civic === 8 && s.gov.unlock.siting, 'kept: residents +8, a later grid siting vote is easier'); }
console.log('4 · Delay: the cap broken, the paper, a supervised clean run');
{ const s = open(); gov.setMotion(s, 'stack', 'delay'); ok(gov.submit(s, N4, 'stack', 'v').pass, 'delay disclosure passes'); ok(s.sim.shipCap === 6, 'a published cap: six per shift');
  gov.once(s, 'a', () => sim.addShift(s, 9, 20, 100)); gov.progress(s, N4); const C = gov.caseOf(s, 'stack');
  ok(C.st === 'm2' && C.leak && s.gov.news.some(n => n.id === 'stack:leak'), 'one shift over the cap: the paper prints, the hearing reconvenes');
  const m = gov.inbox(s, N4).major.m; ok(m.opts.map(o => o.id).join() === 'clean,inspect,ignore', 'remedies offered: clean run, inspection, ignore');
  gov.choose(s, N4, 'stack', 'clean', 'c'); ok(C.st === 'obj', 'a supervised clean run is under way');
  gov.once(s, 'b', () => sim.addShift(s, 5, 20, 100)); gov.progress(s, N4); ok(C.st === 'm2' && C.cleaned, 'a five-shipment shift: the clean run is done');
  gov.choose(s, N4, 'stack', 'cured', 'd'); ok(C.st === 'done' && s.gov.pledges.find(p => p.id === 'stack:clean').cured && !s.sim.shipCap, 'cured; the cap is lifted'); }
console.log('5 · Cap with the premium');
{ const s = open(); gov.setMotion(s, 'stack', 'cap'); gov.offer(s, N4, 'stack', 'premium', {}); gov.submit(s, N4, 'stack', 'v'); const p = s.sim.proj.find(x => x.id === 'cap');
  ok(p && p.prodX === .8 && p.priceX === 1.1, 'production −20%, the clean label +10% on price'); sim.advance(s, N4, day(1) + 6 * H); ok(Math.abs(s.sim.last.price - 6.6) < .01, 'the market pays ¥' + s.sim.last.price.toFixed(2)); }
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
