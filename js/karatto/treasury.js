/* 紅葉重工: the treasury (the economy brief, Nov 28 · first slice). Three horizons on one screen: today's operation
   (one discretionary commission at a time), this quarter's project (unlocks after the first night-line review or N3;
   the projects themselves come in the next slice), and money already promised (escrow, lots, earmarks).
   Prices are reference hours at a rate frozen when the quote is generated (once per quarter): P(h) = h × rate, to ¥10.
   A rich player and a poor player at the same rate see the same price. No decay, no renewal, nothing automatic. */
import { forecast, migrate, log, book, available, refRate, FLOOR, reserved } from './sim.js?v=21';
import { govOf, once, price, spendable, reserve, openLot, releaseLot, lotHooks, escrowed, visitHooks } from './gov.js?v=21';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function trOf(save) { const S = save.sim; S.tr = S.tr || { com: null, quote: null, bonus: {}, done: [] }; return S.tr; }
export const unlocked = save => ((save.corp.factory || {}).shifts || 0) >= 1;
export function quote(save, ctx) {
  const S = save.sim, T = trOf(save);
  if (!T.quote || T.quote.q !== S.q.n) T.quote = { q: S.q.n, ref: refRate(S, ctx), at: S.t };
  return price(T.quote.ref);
}
/* the quarter's project horizon: open after the first night-line review, or at N3 */
export function projectsOpen(save, ctx) { const C = govOf(save).cases.line; return ctx.tier >= 2 || !!(C && (C.st === 'done' || (C.m3 && C.m3.pick))); }

/* ---------------- operating commissions ---------------- */
export const COM = {
  standby: { j: '系統予備', en: 'Grid standby', hours: 8,
    d: (P, o) => `Adds ${o.calib ? 12 : 8} MW of supply for the next 24 simulated hours${o.calib ? ' (calibrated: 20 research)' : ''}. Useful only while the grid is short; unused MW buys nothing.` },
  community: { j: '地域配送', en: 'Community delivery', hours: 4,
    d: (P, o) => `Handling ${P.y(4)}; the next 40 free goods are earmarked (after households and older commitments, before market sales). Each paid Logistics shift delivers up to 20. At 40 delivered: residents +6, once${o.manifest ? '; the audited manifest (30 Data) files one clip toward the open public-report pledge' : ''}. No cash or fame.` } };
const reportPledge = save => govOf(save).pledges.find(p => p.clause === 'report' && p.st === 'open');
export function options(save, ctx) {
  tickTreasury(save);
  const S = save.sim, T = trOf(save), P = quote(save, ctx), sp = spendable(save), busy = T.com && !T.com.closed;
  const why = (cost, extra) => busy ? 'One commission at a time: retire or finish the current one.' : !unlocked(save) ? 'Unlocks with your first paid Factory shift.' : sp < cost ? `Needs ${'¥' + cost.toLocaleString()} above the reserve (¥${Math.max(0, sp).toLocaleString()} spendable).` : extra || '';
  const day = govOf(save).visit.day, bonusUsed = k => T.bonus[k] === day;
  return {
    standby: { cost: P(8), ok: !busy && unlocked(save) && sp >= P(8), why: why(P(8)), calibOK: (save.corp.research || 0) >= 20 },
    community: { cost: P(4), ok: !busy && unlocked(save) && sp >= P(4), why: why(P(4)), manifestOK: !!reportPledge(save) && (save.corp.data || 0) >= 30, bonusUsed: bonusUsed('community') } };
}
/* what a commission would do, from copies: 24h net and power with it, and the sales a delivery gives up */
export function preview(save, ctx, k, o = {}) {
  const base = forecast(JSON.parse(JSON.stringify({ sim: save.sim, corp: save.corp })), ctx, null, 24);
  const c = JSON.parse(JSON.stringify({ sim: save.sim, corp: save.corp })), S = migrate(c.sim), P = quote(save, ctx);
  if (k === 'standby') S.standby = { mw: o.calib ? 12 : 8, left: 24 };
  const w = forecast(c, ctx, null, 24), net = save.sim.last ? save.sim.last.price || 6 : 6;
  const demand = save.sim.last ? save.sim.last.sold || 40 : 40;
  const after = k === 'standby' ? (() => { const c2 = JSON.parse(JSON.stringify(c)); return forecast(c2, ctx, null, 48).power; })() : null;
  return { net24: (w.net - base.net) * 24, power: w.power, power0: base.power, after,
    forgone: k === 'community' ? Math.round(Math.min(40, demand * 24) * net) : 0, cost: P(COM[k].hours) };
}
export function sign(save, ctx, k, o = {}, hid) {
  const r = once(save, 'com:' + hid, () => {
    const S = save.sim, T = trOf(save), O = options(save, ctx)[k], P = quote(save, ctx); if (!O) return { ok: false, why: 'Unknown commission.' };
    if (!O.ok) return { ok: false, why: O.why };
    if (k === 'standby' && o.calib && !O.calibOK) return { ok: false, why: 'Calibration needs 20 research.' };
    if (k === 'community' && o.manifest && !O.manifestOK) return { ok: false, why: 'The manifest needs 30 Data and an open public-report pledge.' };
    const id = k + ':' + S.t;
    book(S, save.corp, 'cap', -O.cost, `委託 ${COM[k].en} signed: ${'¥' + O.cost.toLocaleString()}.`);
    if (k === 'standby') { if (o.calib) save.corp.research -= 20; S.standby = { mw: o.calib ? 12 : 8, left: 24, id }; }
    if (k === 'community') { if (o.manifest) save.corp.data -= 30; const pl = o.manifest ? reportPledge(save) : null;
      openLot(save, { id, qty: 40, kind: 'community', units: 4, perShift: 20, pay: 0, by: 'civic', j: '地域配送', en: 'Community delivery', com: true, pledge: pl ? pl.id : null }); }
    T.com = { k, id, t: S.t, cost: O.cost, o };
    return { ok: true, id };
  });
  return r.dup ? { ok: true, dup: true } : r;
}
/* retire early: unconsumed benefits are forfeited; for a delivery, held goods are released, delivered goods and handling stay paid */
export function retire(save) {
  const S = save.sim, T = trOf(save), c = T.com; if (!c || c.closed) return false;
  if (c.k === 'standby') { S.standby = null; }
  if (c.k === 'community') releaseLot(save, c.id);
  close(save, 'retired'); return true;
}
function close(save, how) { const T = trOf(save), c = T.com; c.closed = how; c.end = save.sim.t; T.done.push({ k: c.k, id: c.id, how, t: c.end }); if (T.done.length > 20) T.done.shift(); T.com = null; }
/* each hour or visit: an expired standby closes */
export function tickTreasury(save) { const S = save.sim, T = trOf(save), c = T.com; if (c && c.k === 'standby' && !(S.standby && S.standby.left > 0)) close(save, 'expired'); }
lotHooks.push((save, l) => {
  if (!l.com) return; const S = save.sim, T = trOf(save), G = govOf(save), day = G.visit.day;
  if (T.bonus.community !== day) { T.bonus.community = day; S.fac.res = clamp(S.fac.res + 6, 0, 100); log(S, 'gov', '地域配送 Community delivery complete: residents +6.'); }
  else log(S, 'gov', '地域配送 Community delivery complete (the residents\' bonus was already given today).');
  if (l.pledge) { const p = G.pledges.find(x => x.id === l.pledge); if (p && p.st === 'open') { p.clip = (p.clip || 0) + 1; log(S, 'gov', '公開報告 The audited manifest files one clip toward the public report.'); } else log(S, 'gov', '公開報告 The manifest\'s pledge had already closed: no clip credit.'); }
  if (T.com && T.com.id === l.id) close(save, 'delivered');
});

/* money already promised: escrow, lots and earmarks, recurring project upkeep */
export function promised(save) {
  const S = save.sim, G = govOf(save);
  return { escrow: escrowed(save), lines: G.escrow.filter(e => e.st === 'held').map(e => ({ why: e.why, amt: e.amt, dueV: e.dueV })),
    lots: (S.lots || []).filter(l => !l.done && !l.off).map(l => ({ id: l.id, j: l.j, en: l.en, need: l.qty, held: l.held || 0, sent: l.sent })),
    upkeep: (S.proj || []).reduce((n, p) => n + (p.upkeep || 0), 0), reserve: reserve(save), funds: save.corp.funds, spend: spendable(save), free: available(S), floor: FLOOR, res: reserved(S) };
}
visitHooks.push(save => tickTreasury(save));
