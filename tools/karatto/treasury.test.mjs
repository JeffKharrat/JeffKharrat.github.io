/* The economy brief (Nov 28), first slice: commissions, earmarks, conservation. */
const R = new URL('../../js/karatto/', import.meta.url).href;
const sim = await import(R + 'sim.js?v=21'), gov = await import(R + 'gov.js?v=21'), tr = await import(R + 'treasury.js?v=21');
const H = 3600e3, MON = Date.UTC(2026, 10, 23) - 5 * H, day = d => MON + d * 24 * H + 2 * H;
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL') + ' ' + m); if (!c) fails++; };
const N5 = { mem: 150, acq: 0, tier: 0, div: 2, up: 0, fu: {}, fame: 1900, tech: {} };
function mk(funds = 5000) { const s = { words: {}, corp: { funds, data: 100, research: 40, factory: { shifts: 1 } } }; sim.advance(s, N5, MON); sim.advance(s, N5, MON + 24 * H); s.corp.funds = funds; gov.visit(s, N5, day(1)); return s; }
const deliver = (s, id, rid) => gov.sendLot(s, id, 9, rid);

console.log('1 · Protected inputs: ¥1 short, exact cash');
{ const s = mk(), P = tr.quote(s, N5), need = P(8); s.corp.funds = gov.reserve(s) + need - 1;
  ok(!tr.options(s, N5).standby.ok && !tr.sign(s, N5, 'standby', {}, 'a').ok, `¥1 short of ${P.y(8)}: blocked`);
  s.corp.funds += 1; const f0 = s.corp.funds, r = tr.sign(s, N5, 'standby', {}, 'b'); ok(r.ok && Math.round(f0 - s.corp.funds) === need, 'exact spendable cash: signs, pays exactly the quote');
  ok(tr.sign(s, N5, 'standby', {}, 'b').dup, 'the same signing again: a no-op');
  ok(!tr.options(s, N5).community.ok, 'one commission at a time');
}
console.log('2 · Grid standby counts simulated hours');
{ const s = mk(); tr.sign(s, N5, 'standby', { calib: true }, 'c'); ok(s.sim.standby.mw === 12 && s.corp.research === 20, 'calibrated: 12 MW, 20 research spent');
  let t = s.sim.t; for (let i = 0; i < 23; i++) { t += H; sim.advance(s, N5, t); } ok(s.sim.standby.left === 1 && tr.trOf(s).com, '23 ticks: one hour left, still running');
  t += H; sim.advance(s, N5, t); tr.tickTreasury(s); ok(!tr.trOf(s).com && tr.trOf(s).done.slice(-1)[0].how === 'expired', 'after 24 ticks: expired, slot free');
  const v = tr.preview(mk(), N5, 'standby', {}); ok(v.power - v.power0 >= 7.9, `the preview shows the supply (${Math.round(v.power0)} → ${Math.round(v.power)} MW)`);
}
console.log('3 · Two consumers, one stock: signing order, the floor survives');
{ const s = mk(); const S = s.sim; S.lots = []; S.ev = []; S.goods = sim.FLOOR + 50;
  gov.openLot(s, { id: 'old', qty: 80, kind: 'protected', pay: 0 });              // an older commitment, signed first
  tr.sign(s, N5, 'community', {}, 'd'); const com = S.lots.find(l => l.com);
  const old = S.lots.find(l => l.id === 'old'); ok(old.held === 50 && com.held === 0, `older 80-good reservation holds all 50 free first (${old.held}/${com.held})`);
  gov.releaseLot(s, 'old'); S.goods = sim.FLOOR + 50; S.lots = [com]; com.held = 0; gov.openLot(s, { id: 'cap', qty: 80, kind: 'protected', pay: 0 });
  S.lots.forEach(l => { if (l.id === 'cap') l.held = 0; }); S.lots.sort((a, b) => (a.com ? 0 : 1) - (b.com ? 0 : 1));
  sim.advance(s, N5, S.t + H); const c2 = S.lots.find(l => l.com), cap = S.lots.find(l => l.id === 'cap');
  ok(c2.held + cap.held <= Math.max(0, S.goods - sim.FLOOR) + 1e-6 && S.goods >= sim.FLOOR - 1e-6, `held never eats the household floor (goods ${S.goods.toFixed(0)}, held ${c2.held.toFixed(0)}+${cap.held.toFixed(0)})`);
  ok(c2.held >= Math.min(40, cap.held + c2.held) - 1e-6, 'the earlier community lot fills before the later one');
}
console.log('3b · The brief\'s case: community 40 then capital 80, 50 free');
{ const s = mk(); const S = s.sim; S.lots = []; S.ev = []; S.goods = sim.FLOOR + 50;
  tr.sign(s, N5, 'community', {}, 'd2'); gov.openLot(s, { id: 'cap', qty: 80, kind: 'protected', pay: 0 });
  const c = S.lots.find(l => l.com), k = S.lots.find(l => l.id === 'cap'); ok(c.held === 40 && k.held === 10, `40 then 10 (${c.held}/${k.held})`);
  ok(sim.available(S) === 0, 'nothing left for the market or a second award'); }
console.log('4 · Community delivery: 20 per shift, bonus once, manifest one clip');
{ const s = mk(); const S = s.sim, G = gov.govOf(s); S.lots = []; S.goods = sim.FLOOR + 200;
  G.pledges.push({ id: 'rp', clause: 'report', case: 'line', to: 'civic', st: 'open', v: 1, dueV: 4, base: { aired: S.aired } });
  const d0 = s.corp.data; tr.sign(s, N5, 'community', { manifest: true }, 'e'); ok(s.corp.data === d0 - 30, 'manifest: 30 Data');
  const id = tr.trOf(s).com.id, r0 = S.fac.res; const a = deliver(s, id, 'x1'); ok(a.goods === 20, `a Logistics shift delivers ${a.goods} (cap 20)`);
  ok(!(G.pledges[0].clip), 'no clip before full delivery'); deliver(s, id, 'x1'); ok(S.lots.find(l => l.id === id).sent === 20, 'a retried settlement delivers nothing more');
  deliver(s, id, 'x2'); ok(Math.round(S.fac.res - r0) === 6 && G.pledges[0].clip === 1 && !tr.trOf(s).com, 'at 40: residents +6, one clip, commission closed');
  const S2 = mk(); S2.sim.lots = []; S2.sim.goods = sim.FLOOR + 200; tr.sign(S2, N5, 'community', {}, 'f'); let i2 = tr.trOf(S2).com.id; deliver(S2, i2, 'a'); deliver(S2, i2, 'b');
  const r1 = S2.sim.fac.res; tr.sign(S2, N5, 'community', {}, 'g'); i2 = tr.trOf(S2).com.id; deliver(S2, i2, 'c'); deliver(S2, i2, 'd'); ok(S2.sim.fac.res === r1, 'a second completion the same attended day: no second bonus');
}
console.log('5 · Pledge closes first; retire releases goods');
{ const s = mk(); const S = s.sim, G = gov.govOf(s); S.lots = []; S.goods = sim.FLOOR + 200;
  G.pledges.push({ id: 'rp', clause: 'report', case: 'line', to: 'civic', st: 'open', v: 1, dueV: 4, base: { aired: S.aired } });
  tr.sign(s, N5, 'community', { manifest: true }, 'h'); const id = tr.trOf(s).com.id; G.pledges[0].st = 'broken'; const r0 = S.fac.res;
  deliver(s, id, 'a'); deliver(s, id, 'b'); ok(!G.pledges[0].clip && Math.round(S.fac.res - r0) === 6, 'the pledge closed first: no clip, the normal approval still given');
  const s2 = mk(); s2.sim.lots = []; s2.sim.goods = sim.FLOOR + 200; tr.sign(s2, N5, 'community', {}, 'i'); const id2 = tr.trOf(s2).com.id; deliver(s2, id2, 'a');
  const L = s2.sim.lots.find(l => l.id === id2), g0 = s2.sim.goods, f0 = s2.corp.funds; tr.retire(s2);
  ok(L.off && L.held === 0 && L.sent === 20 && s2.sim.goods === g0 && s2.corp.funds === f0 && !tr.trOf(s2).com, 'retired: held goods released, delivered kept, handling not refunded, no bonus');
}
console.log('6 · A save that never opts in is untouched');
{ const a = mk(), b = mk(); tr.options(b, N5); tr.preview(b, N5, 'standby', {}); tr.preview(b, N5, 'community', {});
  let t = a.sim.t; for (let i = 0; i < 72; i++) { t += H; sim.advance(a, N5, t); sim.advance(b, N5, t); }
  ok(Math.round(a.corp.funds) === Math.round(b.corp.funds) && Math.round(a.sim.goods) === Math.round(b.sim.goods), `72h: identical funds and goods (¥${Math.round(a.corp.funds)})`);
}
console.log(fails ? `${fails} FAILED` : 'all passed'); if (fails) process.exitCode = 1;
