const R = new URL('../../js/karatto/', import.meta.url).href;
const sim = await import(R + 'sim.js?v=21'), gov = await import(R + 'gov.js?v=21');
const H = 3600e3, MON = Date.UTC(2026, 10, 23) - 5 * H;
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL') + ' ' + m); if (!c) fails++; };
const N5 = { mem: 150, acq: 0, tier: 0, div: 2, up: 0, fu: {}, fame: 1900, tech: {} };
function mk(funds = 5000) { const save = { words: {}, corp: { funds, data: 0, research: 0, factory: { shifts: 1 } } }; sim.advance(save, N5, MON); sim.advance(save, N5, MON + 24 * H); save.corp.funds = funds; return save; }
let T = MON + 24 * H; const day = d => MON + d * 24 * H + 2 * H;

console.log('1 · New N5 AI, first major vote, neutral trust');
{ const s = mk(); gov.visit(s, N5, day(1)); const C = gov.caseOf(s, 'line'); ok(C && C.st === 'm1', 'case opened at m1');
  let t = gov.tally(s, N5, C.draft); ok(t.yes === 2 && t.no === 2 && t.abs === 1 && !t.pass, `full automation 2–2–1 fails (${t.yes}-${t.no}-${t.abs})`);
  console.log('     ', Object.entries(t.seats).map(([k, v]) => `${k}:${v.vote}·${v.main.why[1]}`).join('  '));
  gov.offer(s, N5, 'line', 'inspect', {}); t = gov.tally(s, N5, C.draft); ok(t.yes === 3 && t.pass, 'independent inspection → 3 yes, passes');
  const P = gov.price(C.ref), need = P(10) + P(3.3); ok(gov.commitments(s, C.draft) === need, `commitments: installation ${P.y(10)} + inspection ${P.y(3.3)} at a reference of ¥${C.ref}/h`);
  const f0 = s.corp.funds, r = gov.submit(s, N5, 'line', 'h1'); ok(r.pass, 'submitted and passed');
  ok(Math.round(f0 - s.corp.funds) === need, 'cash out exactly the commitments: ' + Math.round(f0 - s.corp.funds));
  const r2 = gov.submit(s, N5, 'line', 'h1'); ok(r2.dup || r2.stale, 'double submit is a no-op');
  ok(Math.round(f0 - s.corp.funds) === need && s.sim.proj.length === 1 && s.gov.pledges.length === 1, 'effects applied once (proj ' + s.sim.proj.length + ', pledges ' + s.gov.pledges.length + ')');
  const reload = JSON.parse(JSON.stringify(s)); const r3 = gov.submit(reload, N5, 'line', 'h1'); ok(r3.dup || r3.stale, 'after reload, still a no-op');
}
console.log('2 · Reject, then accept later; stale and unaffordable');
{ const s = mk(); gov.visit(s, N5, day(1)); const C = gov.caseOf(s, 'line'), f0 = s.corp.funds;
  const r = gov.submit(s, N5, 'line', 'a'); ok(r.ok && !r.pass, 'plain full automation rejected');
  ok(s.corp.funds === f0 && !s.sim.proj.length && C.st === 'm1', 'rejection leaves cash and project intact');
  gov.offer(s, N5, 'line', 'inspect', {}); const r2 = gov.submit(s, N5, 'line', 'b'); ok(!r2.ok && /failed today/.test(r2.why), 'same motion again the same visit: blocked with cause');
  gov.visit(s, N5, day(2)); const r3 = gov.submit(s, N5, 'line', 'c'); ok(r3.pass, 'next visit with the inspection pledge: passes');
  const poor = mk(600); gov.visit(poor, N5, day(1)); gov.offer(poor, N5, 'line', 'inspect', {}); const rp = gov.submit(poor, N5, 'line', 'p'); ok(!rp.ok && /reserve/.test(rp.why), 'unaffordable: refused with cause · ' + rp.why);
  const st = gov.submit(s, N5, 'line', 'zz'); ok(!st.ok && st.stale, 'stale submission after signing returns the current state');
}
console.log('3 · The retraining negotiation (worked example)');
{ const s = mk(); gov.visit(s, N5, day(1));
  let r = gov.offer(s, N5, 'line', 'retrain', { places: 6, safety: 'wage', refusal: false }); ok(r.st === 'refused' && r.why === 'capacity', 'six places: refused, only four exist');
  r = gov.offer(s, N5, 'line', 'retrain', { places: 4, safety: 'wage', refusal: false }); ok(r.st === 'refused' && r.why === 'safety', 'wage supplement: refused, safety condition');
  r = gov.offer(s, N5, 'line', 'retrain', { places: 4, safety: 'shift', refusal: false }); ok(r.st === 'countered' && r.ctr.refusal, 'four places + protected shift: union counters with first refusal');
  gov.answerCounter(s, 'line', 'retrain', true); const C = gov.caseOf(s, 'line'); ok(C.draft.cl.retrain.st === 'agreed', 'counter accepted');
  const t = gov.tally(s, N5, C.draft); ok(t.seats.union.vote === 'abs', 'union reaches abstain on full automation (−2+2)');
  r = gov.offer(s, N5, 'line', 'inspect', {}); const t2 = gov.tally(s, N5, C.draft); ok(t2.pass, 'retrain + inspection: passes ' + t2.yes + '-' + t2.no + '-' + t2.abs);
  r = gov.offer(s, N5, 'line', 'stage', {}); ok(!r.ok && r.why === 'two-clauses', 'a third clause is refused (two-clause limit)');
  { const P = gov.price(C.ref); ok(gov.commitments(s, C.draft) === P(10) + 4 * P(1.65) + P(3.3), 'commitments: installation + 4 places + inspection = ¥' + gov.commitments(s, C.draft)); }
}
console.log('4 · Six shipment runs, review, pledges kept');
{ const s = mk(8000); gov.visit(s, N5, day(1)); gov.offer(s, N5, 'line', 'inspect', {}); gov.submit(s, N5, 'line', 'v');
  for (let i = 0; i < 3; i++) sim.addShift(s, 8, 20, 100);
  sim.addShift(s, 3, 5, 30); ok(s.sim.runs === 3, 'a 3-product shift is not a run (runs ' + s.sim.runs + ')');
  const g0 = s.sim.goods; ['r1', 'r1'].forEach(id => gov.once(s, 'game:' + id, () => sim.addShift(s, 8, 20, 100))); ok(s.sim.runs === 4, 'a duplicate result adds nothing');
  for (let d = 2; d <= 4; d++) { sim.advance(s, N5, day(d)); gov.visit(s, N5, day(d)); if (gov.caseOf(s, 'line').st === 'm2') { ok(true, 'meeting 2 (dispatch hold) on visit ' + d + ': partial delivery'); gov.choose(s, N5, 'line', 'partial', 'p' + d); } if (d < 4) { sim.addShift(s, 9, 20, 100); } }
  const C = gov.caseOf(s, 'line'); ok(C.st === 'm3', 'review opens on the third visit after signing (' + C.st + ')');
  const m = gov.inbox(s, N5).major; ok(m && m.m.n === 3, 'the inbox shows meeting 3');
  const o = m.m.opts.find(x => x.id === 'hold'); ok(o.ok, 'hold available: runs proven, no broken promise');
  const tr0 = s.gov.trust.chair; gov.choose(s, N5, 'line', 'hold', 'm3a'); ok(C.st === 'done' && C.outcome === 'hold', 'held as an installed project');
  ok(s.gov.trust.chair === tr0 + 8, 'chair trust +8 for the kept inspection'); ok(s.gov.unlock && s.gov.unlock.line2, 'next project option unlocked');
  const esc = s.gov.escrow.find(e => e.id === 'line:inspect'); ok(esc.st === 'paid' && esc.paid === gov.price(C.ref)(3.3), 'inspection escrow paid out ' + esc.paid);
}
console.log('5 · Break the inspection pledge, recover');
{ const s = mk(8000); gov.visit(s, N5, day(1)); gov.offer(s, N5, 'line', 'inspect', {}); gov.submit(s, N5, 'line', 'v');
  for (let d = 2; d <= 4; d++) { sim.advance(s, N5, day(d)); gov.visit(s, N5, day(d)); if (gov.caseOf(s, 'line').st === 'm2') gov.choose(s, N5, 'line', 'partial', 'p' + d); }
  const C = gov.caseOf(s, 'line'), m = gov.inbox(s, N5).major.m; ok(m.broken && !m.opts.find(o => o.id === 'hold').ok, 'no runs: hold blocked, broken');
  ok(m.opts.some(o => o.id === 'cure'), 'corrective action offered');
  const f0 = s.corp.funds; gov.choose(s, N5, 'line', 'cure', 'c1'); ok(C.st === 'cure', 'corrective visit booked');
  ok(s.gov.pledges[0].st === 'broken' && s.gov.pledges[0].cured, 'promise recorded broken, then cured');
  ok(s.gov.news.some(n => n.k === 'paper'), 'the paper published it'); ok(s.gov.trust.chair === -10, 'chair trust −15 +5 = ' + s.gov.trust.chair);
  const ref = s.gov.escrow.find(e => e.id === 'line:inspect'); ok(ref.st === 'paid' && ref.paid === 0, 'the unspent inspection escrow came back');
  for (let i = 0; i < 6; i++) sim.addShift(s, 8, 20, 100);
  sim.advance(s, N5, day(5)); gov.visit(s, N5, day(5)); ok(C.st === 'm3', 'back to the review');
  const m2 = gov.inbox(s, N5).major.m; ok(m2.opts.find(o => o.id === 'hold').ok, 'after recovery, hold is available again');
  ok(gov.tally(s, N5, { motion: 'full', cl: {} }).seats.chair.parts.every(p => p.v !== -2), 'the cured promise no longer costs the chair\'s vote');
}
console.log('6 · Full automation without a labour deal: dispatch hold, recovery lot');
{ const N3 = { mem: 900, acq: 0, tier: 2, div: 10, up: 0, fu: {}, fame: 11600, tech: {} };
  const s = { words: {}, corp: { funds: 20000, data: 0, research: 0, factory: { shifts: 3 } } }; sim.advance(s, N3, MON); sim.advance(s, N3, day(1) - 2 * H);
  gov.visit(s, N3, day(1)); const o = sim.forecast(s, N3).net;
  const r = gov.submit(s, N3, 'line', 'f', { override: true }); ok(r.pass && r.override, 'emergency override forces it');
  ok(s.sim.bousou >= 12 && s.gov.trust.chair === -10, `暴走度 +12 (${s.sim.bousou.toFixed(1)}), chair −10`);
  const r2 = gov.submit(s, N3, 'line', 'f2', { override: true }); ok(r2.stale || !r2.ok, 'no second override');
  const C = gov.caseOf(s, 'line'); ok(C.acc.disp >= 2, 'displacement measured: ' + C.acc.disp + ' jobs');
  sim.advance(s, N3, day(2)); gov.visit(s, N3, day(2)); ok(C.st === 'm2' && s.sim.hold && s.sim.hold.pct === .3, 'meeting 2: the union holds 30% of dispatch');
  const pre = s.sim.last.sold; sim.advance(s, N3, day(2) + 3 * H); ok(s.sim.last.hold > 0 && s.sim.last.sold < pre + 1, `dispatch reduced (sold/h ${s.sim.last.sold.toFixed(1)}), jobs intact (${Math.round(s.sim.last.C.jobsW)})`);
  gov.choose(s, N3, 'line', 'extend', 'e'); const L = s.sim.lots.find(l => l.id === 'recovery'); ok(L && L.kind === 'protected', 'protected recovery lot opened'); sim.advance(s, N3, day(2) + 6 * H); ok(L.held === 16, 'it fills from production before the market sells (held ' + L.held + ')');
  const a = gov.sendLot(s, 'recovery', 2, 'g1'), b = gov.sendLot(s, 'recovery', 2, 'g1'); ok(a.sent === 2 && b.dup, 'two deliveries; the duplicate pays nothing');
  const f0 = s.corp.funds; gov.sendLot(s, 'recovery', 2, 'g2'); ok(L.done && Math.round(s.corp.funds - f0) === L.pay, `lot complete: ¥${L.pay} once (reference ¥${C.ref}/h)`);
}
console.log('7 · The consignment interaction test (lots)');
{ const s = mk(); s.sim.goods = 140; s.sim.lots = [];
  gov.openLot(s, { id: 'civic', qty: 16, kind: 'civic', pay: 0 }); gov.openLot(s, { id: 'com', qty: 24, kind: 'commercial', pay: 600 });
  ok(sim.available(s.sim) === 0, '40 unreserved goods split 16/24: zero available for a rival (' + sim.available(s.sim) + ')');
  const rival = gov.openLot(s, { id: 'rival', qty: 30, kind: 'commercial' }); ok(rival.held === 0, 'the rival bid for 30 gets nothing reserved');
  for (let i = 0; i < 4; i++) gov.sendLot(s, 'civic', 1, 'c' + i);
  const re = JSON.parse(JSON.stringify(s)); const c = re.sim.lots.find(l => l.id === 'civic'), m = re.sim.lots.find(l => l.id === 'com');
  ok(c.done && m.held === 24 && re.sim.lots.find(l => l.id === 'rival').held === 0, 'after reload: civic done, 24 still reserved, rival still empty');
  ok(gov.sendLot(re, 'civic', 1, 'c0').dup, 'a duplicate completion pays nothing');
  const freed = gov.releaseLot(re, 'com'); ok(freed === 24, 'withdrawn with consent: exactly 24 freed');
}
console.log('8 · 28-day gap, quarter crossing, determinism');
{ const a = mk(), b = mk(); sim.advance(a, N5, MON + 30 * 24 * H); sim.advance(b, N5, MON + 30 * 24 * H);
  ok(a.corp.funds === b.corp.funds && a.sim.stab === b.sim.stab, 'identical inputs, identical results');
  const r = a.sim.reports; ok(r.length <= 2 && r.some(x => x.susp), `one suspended period instead of a string of failed weeks (${r.map(x => 'Q' + x.n + (x.susp ? 's' : '') + (x.dir ? (x.dir.neutral ? 'n' : x.dir.ok ? '+' : '−') : '')).join(' ')})`);
  ok(!r.some(x => x.dir && !x.dir.ok && !x.dir.neutral), 'no directive failed for discarded hours');
  ok(!r.some(x => x.rev === 0), 'no empty zero-revenue reports');
  const s = mk(8000); gov.visit(s, N5, day(1)); gov.offer(s, N5, 'line', 'inspect', {}); gov.submit(s, N5, 'line', 'v'); const C = gov.caseOf(s, 'line');
  sim.advance(s, N5, day(29)); ok(C.st === 'live' && s.gov.pledges[0].st === 'open', 'no attended-promise deadline passed while away');
}
console.log('9 · Import a pre-politics v2 save');
{ const s = mk(); delete s.gov; delete s.sim.fx; delete s.sim.lots; delete s.sim.proj; delete s.sim.q.led; s.sim.debt = 3000; s.sim.ev.push({ id: 'x:strike', k: 'strike', t: s.sim.t });
  s.words = { 1: { cert: 1, manual: 1 } }; const f = s.corp.funds;
  sim.advance(s, N5, day(1)); gov.visit(s, N5, day(1)); ok(s.sim.fx === 1 && s.gov.v === 1 && s.sim.debt > 0 && s.words[1].cert, 'migrated in place; debt, words kept');
  ok(sim.resolve(s, 'x:strike', 1) || !s.sim.ev.length, 'the legacy strike still resolves');
}
console.log('10 · Low funds, low stability, negative votes');
{ const s = mk(100); s.sim.stab = 15; s.gov = undefined; gov.visit(s, N5, day(1));
  const m = gov.inbox(s, N5).major; ok(m, 'the case is still on the counter');
  const t = gov.tally(s, N5, { motion: 'defer', cl: {} }); ok(t.pass && gov.blockers(s, N5, { motion: 'defer', cl: {} }).length === 0, 'the deferred trial (a safe, free action) is always reachable');
  s.corp.funds = -500; s.sim.fcl = s.sim.q.n; sim.advance(s, N5, day(1) + 5 * H, true); ok(s.sim.wind === s.sim.q.n && s.sim.pol.eco === 0 && s.sim.pol.div === 0, 'facility spent: no-cost wind-down instead of another injection');
}
console.log('11 · Retraining placements come from shipment runs');
{ const s = mk(8000); gov.visit(s, N5, day(1)); gov.offer(s, N5, 'line', 'retrain', { places: 4, safety: 'shift', refusal: true }); gov.offer(s, N5, 'line', 'inspect', {}); const r = gov.submit(s, N5, 'line', 'v'); ok(r.pass, 'full + retrain + inspection passes');
  ok(s.sim.trainSlots === 4, 'four funded places open');
  for (let d = 2; d <= 4; d++) { sim.advance(s, N5, day(d)); for (let i = 0; i < 2; i++) gov.once(s, `f${d}${i}`, () => sim.addShift(s, 8, 20, 100)); gov.visit(s, N5, day(d)); }
  const C = gov.caseOf(s, 'line'); ok(C.st === 'm3' && !C.m2, 'no dispatch hold: the labour deal was signed');
  ok(s.sim.trainSlots === 0 && s.sim.retr - C.acc.base.retr >= 4, 'six runs filled the four places (' + Math.floor(s.sim.retr - C.acc.base.retr) + ' placed)');
  gov.choose(s, N5, 'line', 'hold', 'h'); ok(s.gov.pledges.every(p => p.st === 'kept'), 'both pledges kept'); ok(s.gov.sig.annex === 'lit', 'the training annex lights up');
}
console.log('12 · Prices follow the tier, not the wallet');
{ const N3 = { mem: 900, acq: 0, tier: 2, div: 10, up: 0, fu: {}, fame: 11600, tech: {} };
  const a = mk(5000), b = { words: {}, corp: { funds: 5000, data: 0, research: 0, factory: { shifts: 1 } } }; sim.advance(b, N3, MON); sim.advance(b, N3, MON + 24 * H);
  gov.visit(a, N5, day(1)); gov.visit(b, N3, day(1)); const ra = gov.caseOf(a, 'line').ref, rb = gov.caseOf(b, 'line').ref;
  ok(ra >= 60 && ra <= 150 && rb >= 250 && rb <= 600, `reference rates in their bands: N5 ¥${ra}/h, N3 ¥${rb}/h`);
  const c = JSON.parse(JSON.stringify(a)); c.corp.funds = 900000; ok(gov.commitments(c, gov.caseOf(c, 'line').draft) === gov.commitments(a, gov.caseOf(a, 'line').draft), 'a richer wallet does not raise the price');
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
