/* The faction brief (Nov 28): mandate, handover, retention, entrance line. Section 8's acceptance fixtures. */
const R = new URL('../../js/karatto/', import.meta.url).href;
const sim = await import(R + 'sim.js?v=21'), gov = await import(R + 'gov.js?v=21'), arc = await import(R + 'gov-arc.js?v=21');
const H = 3600e3, MON = Date.UTC(2026, 10, 23) - 5 * H;
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL') + ' ' + m); if (!c) fails++; };
const N5 = { mem: 150, acq: 0, tier: 0, div: 2, up: 0, fu: {}, fame: 1900, tech: {} };
const N3 = { ...N5, tier: 2 };
const day = d => MON + d * 24 * H + 2 * H;
function mk(funds = 5000, fac = { union: 50, board: 50, res: 50, eng: 50 }, ctx = N5) {
  const save = { words: {}, corp: { funds, data: 0, research: 0, factory: { shifts: 1 } } };
  sim.advance(save, ctx, MON); sim.advance(save, ctx, MON + 24 * H); save.corp.funds = funds; Object.assign(save.sim.fac, fac); return save;
}
const score = (s, seat, ctx = N5) => gov.seatScore(s, ctx, gov.caseOf(s, 'line').draft, seat);
const retrainStrong = s => { gov.offer(s, N5, 'line', 'retrain', { places: 4, safety: 'shift', refusal: false }); gov.answerCounter(s, 'line', 'retrain', true); };

console.log('1 · Fresh first hearing, approval 50, trust 0, funded');
{ const s = mk(); gov.visit(s, N5, day(1)); const C = gov.caseOf(s, 'line'), t = gov.tally(s, N5, C.draft);
  ok(t.yes === 2 && t.abs === 1 && t.no === 2, `baseline 2 yes · 1 abstain · 2 no (${t.yes}-${t.abs}-${t.no})`);
  const a = JSON.parse(JSON.stringify(s)); gov.offer(a, N5, 'line', 'inspect', {}); ok(gov.tally(a, N5, gov.caseOf(a, 'line').draft).pass, 'inspection alone supplies the third vote');
  const b = JSON.parse(JSON.stringify(s)); gov.offer(b, N5, 'line', 'report', {}); const tb = gov.tally(b, N5, gov.caseOf(b, 'line').draft); ok(tb.pass && tb.seats.civic.vote === 'yes', 'public reporting alone supplies the third vote (residents −1 → +1)');
  const L = gov.seatScore(s, N5, C.draft, 'legal'), A = gov.seatScore(s, N5, C.draft, 'audit'); ok(L === null && A === null, 'legal and audit: no ballot, no throw');
}
console.log('2 · Union mandate at 64 then 65; grudging; snapshot kept');
{ for (const [ap, want] of [[64, 0], [65, 1]]) { const s = mk(5000, { union: ap, board: 50, res: 50, eng: 50 }); gov.visit(s, N5, day(1)); retrainStrong(s); const v = score(s, 'union'); ok(v.v === want, `approval ${ap} + agreed retraining → union ${v.v > 0 ? '+' : ''}${v.v} (${v.vote})`); }
  const s = mk(5000, { union: 65, board: 50, res: 50, eng: 50 }); gov.visit(s, N5, day(1)); retrainStrong(s);
  gov.caseOf(s, 'line').draft.cl.retrain.st = 'grudging'; ok(score(s, 'union').v === -1, 'a grudging offer at 65: −2 + 1 = −1 (no mandate)');
  gov.caseOf(s, 'line').draft.cl.retrain.st = 'agreed'; s.sim.fac.union = 20; ok(score(s, 'union').v === 1, 'approval falls to 20 mid-meeting: the snapshot (65) still speaks');
  const re = JSON.parse(JSON.stringify(s)); gov.visit(re, N5, day(2)); ok(gov.caseOf(re, 'line').snap.union === 65 && score(re, 'union').v === 1, 'reopening the same case on a later day preserves the snapshot');
}
console.log('3 · Popular administration, broken promise, low trust');
{ const s = mk(5000, { union: 70, board: 50, res: 50, eng: 50 }); gov.visit(s, N5, day(1)); retrainStrong(s);
  s.gov.trust.union = -30; s.gov.pledges.push({ id: 'x', clause: 'retrain', case: 'old', to: 'union', st: 'broken', v: 0, dueV: 0 });
  const v = score(s, 'union'); ok(v.v === -2, `−2 + 2 + 1 − 2 − 1 = ${v.v} (${v.parts.map(p => p.v).join(' ')})`);
}
console.log('4 · One board meter, two seats: Finance carries the mandate');
{ arc.MOTIONS.tfix = { arc: 'line', j: 'T', en: 'Test', clauses: [], base: { chair: () => ({ v: 0, why: ['', ''] }), fin: () => ({ v: 0, why: ['', ''] }), union: () => ({ v: 0, why: ['', ''] }), civic: () => ({ v: 0, why: ['', ''] }), ops: () => ({ v: 1, why: ['', ''] }) }, d: () => '' };
  arc.ISSUES.tfix = () => ({ board: 'p' });
  const s = mk(5000, { union: 50, board: 80, res: 50, eng: 50 }); gov.visit(s, N5, day(1)); const d = { motion: 'tfix', cl: {} }, t = gov.tally(s, N5, d);
  ok(t.seats.fin.v === 1 && t.seats.chair.v === 0, `finance +${t.seats.fin.v}, chair ${t.seats.chair.v}`);
  ok(t.yes === 2 && t.abs === 3 && !t.pass, `two yes, three abstentions: fails (${t.yes}-${t.abs}-${t.no})`);
  delete arc.MOTIONS.tfix; delete arc.ISSUES.tfix;
}
console.log('5 · Staged full line, supervised handover');
{ const s = mk(9000); gov.visit(s, N5, day(1)); gov.offer(s, N5, 'line', 'stage', {}); gov.offer(s, N5, 'line', 'inspect', {});
  const d = gov.caseOf(s, 'line').draft; ok(gov.handoverOf(s, N5, d) === 'sup', 'union not yes → supervised start by default');
  for (let i = 0; i < 3; i++) gov.previewOf(s, N5, d);
  const r = gov.submit(s, N5, 'line', 'h5'); ok(r.pass, 'passes');
  const p = s.sim.proj.find(x => x.id === 'line'), eff = () => Math.round(sim.projBonus(p) * 1000) / 10;
  ok(eff() === 7.5, `effective bonus +${eff()}% (75% of the staged +10%)`);
  const shift = id => gov.once(s, 'game:' + id, () => sim.addShift(s, 6, 3, 200));
  shift('a'); shift('a'); ok(p.sup === 1 && eff() === 7.5, 'a duplicate settlement counts once (1 shift left)');
  sim.addShift(s, 6, 3, 0); ok(p.sup === 1, 'an unpaid (practice) shift does not count');
  shift('b'); ok(p.sup === 0 && eff() === 10, `after two distinct paid shifts: +${eff()}%`);
  const re = JSON.parse(JSON.stringify(s)); gov.once(re, 'game:b', () => sim.addShift(re, 6, 3, 200)); ok(re.sim.proj.find(x => x.id === 'line').sup === 0, 'reload + retry: unchanged');
}
console.log('6 · Crew: fee counted against the reserve; supervised stays selectable');
{ const s = mk(5000); gov.visit(s, N5, day(1)); gov.offer(s, N5, 'line', 'inspect', {}); const C = gov.caseOf(s, 'line'), P = gov.price(C.ref);
  const need = gov.commitments(s, C.draft); s.corp.funds = Math.round(gov.reserve(s) + need + P(2) - 1);
  gov.setHandover(s, 'line', 'crew'); ok(gov.blockers(s, N5, C.draft).some(b => /reserve/.test(b[1])), `crew ¥1 short: blocked (${P.y(2)} fee)`);
  gov.setHandover(s, 'line', 'sup'); ok(!gov.blockers(s, N5, C.draft).length, 'supervised start: still selectable');
  s.corp.funds += 1; gov.setHandover(s, 'line', 'crew'); ok(!gov.blockers(s, N5, C.draft).length, 'exact spendable cash: crew allowed');
  const f0 = s.corp.funds, r = gov.submit(s, N5, 'line', 'h6'); ok(r.pass && Math.round(f0 - s.corp.funds) === need + P(2), `paid commitments + crew = ¥${Math.round(f0 - s.corp.funds)}`);
  ok(sim.projBonus(s.sim.proj[0]) === .2, 'crew: full +20% at once');
  const poor = mk(600); gov.visit(poor, N5, day(1)); gov.offer(poor, N5, 'line', 'inspect', {}); ok(gov.blockers(poor, N5, gov.caseOf(poor, 'line').draft).length > 0, 'a majority without spendable cash is still blocked');
}
console.log('7 · Union yes: the stewards staff it');
{ const s = mk(9000, { union: 70, board: 50, res: 50, eng: 50 }); gov.visit(s, N5, day(1)); retrainStrong(s); gov.offer(s, N5, 'line', 'inspect', {});
  const d = gov.caseOf(s, 'line').draft; ok(gov.handoverOf(s, N5, d) === 'staff', 'labour coalition: handover staffed by the union');
  gov.submit(s, N5, 'line', 'h7'); ok(sim.projBonus(s.sim.proj[0]) === .2 && !s.sim.proj[0].sup, 'full output from signing');
}
console.log('8 · Engineer retention: 11 then 12 hours; reload; away');
{ const s = mk(5000, { union: 50, board: 50, res: 50, eng: 20 }, N3); s.sim.pop.e = 10; Object.assign(s.sim.pol, { wage: 0, hours: 2 });
  let t = s.sim.t; const hr = () => { t += H; sim.advance(s, N3, t); };
  s.sim.engLow = 0; for (let i = 0; i < 11; i++) { s.sim.fac.eng = 20; hr(); }
  ok(!s.sim.pet && s.sim.engLow === 11, `no petition at 11 hours (${s.sim.engLow})`);
  s.sim.fac.eng = 20; hr(); ok(s.sim.pet && s.sim.pet.st === 'open', 'exactly one at 12');
  const id = s.sim.pet.id; for (let i = 0; i < 30; i++) { s.sim.fac.eng = 20; hr(); } ok(s.sim.pet.id === id, 'more distress: still the same petition');
  const away = JSON.parse(JSON.stringify(s)); sim.advance(away, N3, t + 7 * 24 * H); ok(away.sim.pet.id === id && away.sim.pet.st === 'open', 'seven days away: the petition waits, not dismissed or duplicated');
  s.corp.funds = gov.reserve(s); const o = gov.petitionOpts(s); ok(!o.find(x => x.id === 'fund').ok && o.find(x => x.id === 'window').ok, 'zero spendable: the maintenance window stays selectable');
  const r = gov.answerPetition(s, N3, 'window', 'w1'), r2 = gov.answerPetition(s, N3, 'window', 'w1'); ok(r.ok && (r2.stale || r2.dup), 'answered once');
  const e0 = s.sim.fac.eng, f0 = s.corp.funds; sim.addShift(s, 6, 0, 200); ok(Math.round(s.corp.funds - f0) === 170, `first paid shift pays 85% (¥${Math.round(s.corp.funds - f0)})`);
  sim.addShift(s, 6, 0, 200); ok(Math.round(s.sim.fac.eng - e0) === 12 && s.sim.maint.left === 0, 'second: engineers +12, once');
  for (let i = 0; i < 20; i++) { s.sim.fac.eng = 20; hr(); } ok(s.sim.pet.st === 'done', 'no rearm before 48 h and six hours ≥45');
}
console.log('9 · Release: one engineer, one post closed for a day');
{ const s = mk(5000, { union: 50, board: 50, res: 50, eng: 20 }, N3); s.sim.pop.e = 10; s.sim.pet = { st: 'open', t: s.sim.t, ref: 300, id: 'p9' };
  const c0 = sim.capacity(s.sim, N3).jobsE; gov.answerPetition(s, N3, 'release', 'r'); ok(s.sim.pop.e === 9 && sim.capacity(s.sim, N3).jobsE === c0 - 1, `9 engineers, ${c0 - 1} posts`);
  s.sim.t += 25 * H; ok(sim.capacity(s.sim, N3).jobsE === c0, 'the post reopens after 24 hours');
}
console.log('10 · The entrance line');
{ const s = mk(); s.corp.factory.shifts = 0; gov.visit(s, N5, day(1)); ok(/paid Factory shift/.test(gov.nextAction(s, N5).en), 'before any shift: play a paid Factory shift now');
  const c = { ...N5, mem: 40 }, s2 = mk(5000, undefined, c); gov.visit(s2, c, day(1)); const n2 = gov.nextAction(s2, c).en; ok(/24\/30 robots\. 6 more robots require 10 more words/.test(n2), n2);
  const s3 = mk(); gov.visit(s3, N5, day(1)); const n3 = gov.nextAction(s3, N5); ok(/2\/3 yes/.test(n3.en) && /Chair wants independent inspection.*Residents want a public report/.test(n3.en) && n3.go === 'chair', n3.en);
  gov.offer(s3, N5, 'line', 'inspect', {}); const n4 = gov.nextAction(s3, N5).en; ok(/3\/5 yes · Union opposes · \+15% robot output until two paid Factory shifts, then \+20%/.test(n4), n4);
  gov.submit(s3, N5, 'line', 'h10'); const n5 = gov.nextAction(s3, N5).en; ok(/0\/6 shipment runs · review in 3 attended days/.test(n5), n5);
}
console.log(fails ? `${fails} FAILED` : 'all passed'); if (fails) process.exitCode = 1;
