/* カラット: 派閥 · the politics. A board that can refuse the AI's plans, and people who remember what it promised.
   Pure logic, no DOM (bureau.js draws it). Saved in save.gov: instances, outcomes, trust and commitments only; the
   authored cases live in gov-arc.js.
   - Five voting seats (chair, finance, union, civic, operations) and two advisors (legal, audit) who never vote.
   - A motion passes with three yes. Each seat: the authored baseline (−2…+2) + 1 if trust ≥ 25, −1 if ≤ −25, +2 for a
     named pledge it sponsors and agreed to, −2 while a promise to it stands broken. Yes ≥ 1, abstain 0, no ≤ −1.
   - At most two pledges per proposal, one per sponsor. A pledge reserves cash (escrow) or locks a real condition.
   - Clocks: governance deadlines count ATTENDED visits (one per Japan-time day, when Management opens or a shift ends).
     Absence never burns a deadline, never breaks a promise that needed the player.
   - Everything that changes money or state goes through once(): a stable id, applied at most once (reloads, retries). */
import { migrate, book, log, available, reserved, FLOOR, capacity, forecast, essentials, newDir, projX, RUN, refRate, PET } from './sim.js?v=21';
import { day } from './evidence.js?v=21';
import { ARCS, MOTIONS, CLAUSES, ISSUES, ISSUE_NAME } from './gov-arc.js?v=21';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export { MOTIONS, CLAUSES, ARCS };

/* ---------------- the cast (bureau-pack: cast.json) ---------------- */
export const CAST = {
  union: { j: '赤城 剛', r: 'あかぎ つよし', role: ['労働組合 委員長', 'Union negotiator'], fac: 'union', img: 'union', eye: '#FFB000', seat: true },
  civic: { j: '緑川 透', r: 'みどりかわ とおる', role: ['住民会議 代表', 'Residents envoy'], fac: 'res', img: 'res', eye: '#C6FF1A', seat: true },
  ops: { j: '黒田 迅', r: 'くろだ じん', role: ['運営部長', 'Operations director'], role3: ['運営・技術部長', 'Operations & engineering director'], fac: 'eng', img: 'eng', eye: '#FF3B30', seat: true },
  chair: { j: '九条 澪', r: 'くじょう みお', role: ['取締役会 議長', 'Board chair'], fac: 'board', img: 'board', eye: '#FFE600', seat: true },
  fin: { j: '銅島 恭介', r: 'どうじま きょうすけ', role: ['財務担当役員', 'Finance delegate'], fac: 'board', img: 'finance', eye: '#E08A3C', seat: true },
  legal: { j: '紫藤 綾', r: 'しどう あや', role: ['法務顧問', 'Legal counsel'], img: 'legal', eye: '#B48CFF' },
  audit: { j: '白銀 聡', r: 'しろがね さとし', role: ['監査委員', 'Audit commissioner'], img: 'audit', eye: '#DDE6F0' } };
export const ORDER = ['union', 'civic', 'ops', 'chair', 'fin', 'legal', 'audit'];
export const SEATS = ['chair', 'fin', 'union', 'civic', 'ops'];
export const roleOf = (k, tier) => (k === 'ops' && tier >= 2 ? CAST.ops.role3 : CAST[k].role);

/* ---------------- state ---------------- */
export function govOf(save) {
  const G = save.gov || (save.gov = {});
  if ((G.v || 0) < 1) Object.assign(G, { v: 1, trust: Object.fromEntries(ORDER.map(k => [k, 0])), visit: { n: 0, day: null }, cases: {}, pledges: [], escrow: [], hist: [], news: [], over: { q: null }, path: { coop: 0, dom: 0, trans: 0 }, freeze: null, review: null, seen: {}, sig: {} });
  return G;
}
/* the journal: an id is applied at most once (game results, votes, instalments, refunds) */
export function once(save, id, fn) {
  const J = save.jr || (save.jr = []);
  if (J.includes(id)) return { dup: true };
  const r = fn(); J.push(id); if (J.length > 500) J.splice(0, J.length - 500); return r === undefined ? { ok: true } : r;
}
const txid = (G, k) => `${k}:${G.visit.n}:${(G.hist.length + G.pledges.length + G.escrow.length)}`;
function remember(G, e) { G.hist.push(e); if (G.hist.length > 120) G.hist.splice(0, G.hist.length - 120); }
function news(G, item) { G.news.push(item); if (G.news.length > 30) G.news.splice(0, G.news.length - 30); }
export const trustAdd = (G, k, d) => { G.trust[k] = clamp((G.trust[k] || 0) + d, -50, 50); };
/* prices in reference hours: the rate is snapshotted when a case opens, inside the tier's band; never the wallet */
export { refRate };
export function price(ref = 90) { const p = h => Math.round(h * ref / 10) * 10; p.y = h => '¥' + p(h).toLocaleString(); return p; }
const priceOf = (save, draft) => price((caseOf(save, MOTIONS[draft.motion].arc) || {}).ref);
export const describe = (save, id) => MOTIONS[id].d(price((caseOf(save, MOTIONS[id].arc) || {}).ref));

/* ---------------- visits: the governance clock ---------------- */
export function visit(save, ctx, now = Date.now()) {
  const G = govOf(save), S = save.sim, d = day(now); if (!S || S.v !== 2) return false;
  migrate(S);
  if (G.visit.day === d) return false;
  G.visit = { n: G.visit.n + 1, day: d }; S.amb = 0;
  if (!S.dir) newDir(S, save.corp, ctx);                                  // a fresh, achievable directive after time away
  /* a breach has a firm window: two attended visits. Undefended, the rival copies two old keys (still certified, now compromised) */
  const b = S.breach && S.breach.open;
  if (b) { if (b.v0 == null) b.v0 = G.visit.n; else if (G.visit.n - b.v0 >= 2) {
    const old = Object.entries(save.words).filter(([, w]) => w.cert && !w.comp).sort((a, c) => (a[1].seen || a[1].cert) - (c[1].seen || c[1].cert)).slice(0, 2);
    old.forEach(([, w]) => { w.comp = Date.now(); }); S.breach.open = null;
    log(S, 'breach', `侵入 The breach window closed undefended: ${b.rival} copied ${old.length} old keys. They stay certified, marked compromised until reverified.`); } }
  progress(save, ctx);
  for (const f of visitHooks) f(save, ctx);
  return true;
}
export const visitHooks = [];

/* ---------------- money: the reserve, what's spendable, escrow ---------------- */
export function reserve(save) {
  const S = save.sim, G = govOf(save), dueSoon = G.escrow.filter(e => e.st === 'held' && e.dueV != null && e.dueV <= G.visit.n + 1 && e.out).reduce((n, e) => n + e.amt, 0);
  return Math.round(Math.max(500, 12 * essentials(S)) + dueSoon);
}
export const escrowed = save => govOf(save).escrow.filter(e => e.st === 'held').reduce((n, e) => n + e.amt, 0);
export const spendable = save => Math.round(save.corp.funds - reserve(save));
/* escrow leaves the treasury when signed and comes back (refund) or is consumed (paid) later: each a journalled transaction */
function escrowIn(save, id, amt, why, extra = {}) {
  return once(save, 'esc:' + id, () => { const G = govOf(save); book(save.sim, save.corp, 'cap', -amt); G.escrow.push({ id, amt, why, st: 'held', v: G.visit.n, ...extra }); });
}
function escrowOut(save, id, how, part = 1) {
  return once(save, 'esc-' + how + ':' + id, () => {
    const G = govOf(save), e = G.escrow.find(x => x.id === id && x.st === 'held'); if (!e) return { none: true };
    const back = how === 'refund' ? e.amt : Math.round(e.amt * (1 - part));
    if (back > 0) book(save.sim, save.corp, 'cap', back);
    e.st = how === 'refund' ? 'refunded' : 'paid'; e.paid = e.amt - back; e.at = G.visit.n;
  });
}

/* ---------------- contract lots: goods promised once, reserved above the household floor ---------------- */
export function openLot(save, l) {
  const S = save.sim; migrate(S); if (S.lots.some(x => x.id === l.id)) return S.lots.find(x => x.id === l.id);
  const lot = { units: 4, cap: Infinity, held: 0, sent: 0, done: false, off: false, ...l }; S.lots.push(lot);
  const take = Math.min(lot.qty, Math.max(0, S.goods - FLOOR - reserved(S))); lot.held = take; return lot;
}
export const lotFree = (S, l) => Math.max(0, l.qty - l.sent);
/* a delivery against a lot: n deliveries × units goods, only what is held; pays once on completion */
export function sendLot(save, lotId, n, rid) {
  return once(save, 'lot:' + lotId + ':' + rid, () => {
    const S = save.sim, l = S.lots.find(x => x.id === lotId); if (!l || l.done || l.off) return { sent: 0 };
    if (S.hold && S.hold.until > S.t && l.kind === 'commercial') return { sent: 0, held: true };
    const k = Math.min(n, Math.floor(l.held / l.units), Math.ceil((l.qty - l.sent) / l.units), l.perShift ? Math.floor(l.perShift / l.units) : Infinity), g = Math.min(k * l.units, l.qty - l.sent);
    l.held -= g; l.sent += g; S.goods -= g;
    if (l.sent >= l.qty) { l.done = true; l.held = 0; if (l.pay) once(save, 'lotpay:' + l.id, () => book(S, save.corp, 'orders', l.pay, `契約完了 Lot ${l.id} delivered in full: +¥${l.pay.toLocaleString()}.`)); for (const f of lotHooks) f(save, l); }
    return { sent: k, goods: g };
  });
}
export const lotHooks = [];                                                   // the treasury listens for completed deliveries
export function releaseLot(save, lotId) { const S = save.sim, l = S.lots.find(x => x.id === lotId); if (!l || l.done) return 0; const g = l.held; l.held = 0; l.off = true; return g; }
export const activeLot = S => (S.lots || []).find(l => !l.done && !l.off && (!S.hold || S.hold.until <= S.t || l.kind !== 'commercial'));

/* ---------------- the vote ---------------- */
/* a draft: { motion, cl: { clauseId: { terms, st: 'agreed'|'grudging'|'refused'|'countered', ctr } } } */
export function commitments(save, draft) {
  const M = MOTIONS[draft.motion], p = priceOf(save, draft); let cash = (M.costH ? p(M.costH) : 0) + (M.holdH ? p(M.holdH) : 0);
  for (const [id, c] of Object.entries(draft.cl || {})) if (c.st === 'agreed' || c.st === 'grudging') cash += CLAUSES[id].cost(c.terms, p);
  return cash;
}
/* the mandate: at most one point per voter, from the group's approval as frozen when the meeting opened.
   High (≥65) and the motion or an AGREED clause protects the group's tagged interest: +1. Low (<35) and the motion
   exposes it unprotected: −1. Otherwise 0. The board's mandate is Finance's alone (the chair votes on oversight, trust
   and promises); the engineers' is Operations', and only once engineers are employed (N3). */
export const SEAT_FAC = { union: 'union', civic: 'res', ops: 'eng', fin: 'board' };
export const engActive = (save, ctx) => ctx.tier >= 2 && ((save.sim && save.sim.pop.e) || 0) >= 1;
export function approvalSnap(save, draft) {
  const C = draft && caseOf(save, MOTIONS[draft.motion].arc);
  return (C && C.st === 'm1' && C.snap) || { ...save.sim.fac };
}
export function mandateOf(save, ctx, draft, seat) {
  const f = SEAT_FAC[seat]; if (!f) return { v: 0 };
  if (f === 'eng' && !engActive(save, ctx)) return { v: 0, fac: f, off: true };
  const has = id => !!(draft.cl && draft.cl[id] && draft.cl[id].st === 'agreed'), tags = (ISSUES[draft.motion] || (() => ({})))(has), tag = tags[f];
  const a = approvalSnap(save, draft)[f], name = (ISSUE_NAME[MOTIONS[draft.motion].arc] || {})[f] || ['—', '—'];
  const v = tag === 'p' && a >= 65 ? 1 : tag === 'x' && a < 35 ? -1 : 0;
  return { v, fac: f, appr: a, now: save.sim.fac[f], tag, name, why: v > 0 ? ['支持基盤', `mandate: ${name[1]} protected, approval ${(Math.floor(a * 10) / 10)}`] : ['反発', `mandate: ${name[1]} exposed, approval ${(Math.floor(a * 10) / 10)}`] };
}
export function seatScore(save, ctx, draft, seat) {
  if (!SEATS.includes(seat)) return null;                                    // legal and audit advise; they hold no ballot
  const G = govOf(save), M = MOTIONS[draft.motion], st = { save, ctx, S: save.sim, G, spend: spendable(save), need: commitments(save, draft) };
  const b = M.base[seat](st), parts = [{ v: b.v, why: b.why }];
  const t = G.trust[seat] || 0; if (t >= 25) parts.push({ v: 1, why: ['信頼', 'trust'] }); if (t <= -25) parts.push({ v: -1, why: ['不信', 'distrust'] });
  for (const [id, c] of Object.entries(draft.cl || {})) {
    const C = CLAUSES[id]; if (C.by !== seat) continue;
    if (c.st === 'agreed') parts.push({ v: 2, why: C.why }); else if (c.st === 'grudging') parts.push({ v: 1, why: C.why });
  }
  const broken = G.pledges.filter(p => p.to === seat && p.st === 'broken' && !p.cured).length; if (broken) parts.push({ v: -2, why: ['約束違反', 'a broken promise'] });
  const md = mandateOf(save, ctx, draft, seat); if (md.v) parts.push({ v: md.v, why: md.why, mandate: true });
  const v = parts.reduce((n, p) => n + p.v, 0);
  return { v, vote: v >= 1 ? 'yes' : v <= -1 ? 'no' : 'abs', parts, main: parts.slice().sort((a, c) => Math.abs(c.v) - Math.abs(a.v))[0] };
}
export function tally(save, ctx, draft) {
  const s = Object.fromEntries(SEATS.map(k => [k, seatScore(save, ctx, draft, k)])), n = k => SEATS.filter(x => s[x].vote === k).length;
  return { seats: s, yes: n('yes'), no: n('no'), abs: n('abs'), pass: n('yes') >= 3 };
}
/* what blocks a submission: cash, power, a freeze, a vote already failed this visit */
export function blockers(save, ctx, draft) {
  const G = govOf(save), M = MOTIONS[draft.motion], out = [], need = commitments(save, draft) + crewFee(save, ctx, draft), sp = spendable(save);
  if (need > 0 && sp < need) out.push(['資金不足', `Needs ¥${need.toLocaleString()} above the reserve; ¥${Math.max(0, sp).toLocaleString()} is spendable.`]);
  if (M.auto && G.freeze && G.freeze.untilV >= G.visit.n) out.push(['凍結', 'The chair froze new automation proposals until the next review.']);
  if (M.power) { const f = previewOf(save, ctx, draft); if (f.power < 0) out.push(['電力不足', `The line would run the grid ${Math.round(-f.power)} MW short. A Power plant shift adds supply for a day.`]); }
  const C = caseOf(save, M.arc); if (C && C.failV === G.visit.n && C.failM === draft.motion) out.push(['再採決不可', 'This motion already failed today. Change the proposal, or come back on your next visit.']);
  return out;
}
/* the 24-hour operating projection with the proposal installed, from a copy that includes what is already signed */
export function previewOf(save, ctx, draft) {
  const c = JSON.parse(JSON.stringify({ sim: save.sim, corp: save.corp })), M = MOTIONS[draft.motion], S = migrate(c.sim);
  if (M.proj) S.proj = S.proj.filter(p => p.id !== M.proj.id).concat([projFor(draft, handoverOf(save, ctx, draft))]);
  c.corp.funds -= commitments(save, draft) + crewFee(save, ctx, draft);
  return forecast(c, ctx, null, 24);
}
/* the handover of a full night line: who implements it. Union yes: its stewards staff it (full bonus). Otherwise the
   player picks, before submitting: a supervised start (75% of the signed robot bonus until two paid Factory shifts) or a
   hired commissioning crew (two reference hours on signing, full bonus at once). Only the full line has one. */
export function handoverOf(save, ctx, draft) {
  if (draft.motion !== 'full') return null;
  if (seatScore(save, ctx, draft, 'union').vote === 'yes') return 'staff';
  return draft.handover === 'crew' ? 'crew' : 'sup';
}
export function crewFee(save, ctx, draft) { if (handoverOf(save, ctx, draft) !== 'crew') return 0; return price((caseOf(save, MOTIONS[draft.motion].arc) || {}).ref)(2); }
export function setHandover(save, caseId, hv) { const C = caseOf(save, caseId); if (!C || C.st !== 'm1' || !['sup', 'crew'].includes(hv)) return false; C.draft.handover = hv; return true; }
export const SUP_X = .75, SUP_SHIFTS = 2;
function projFor(draft, hv) {
  const M = MOTIONS[draft.motion], p = { ...M.proj }, r = draft.cl && draft.cl.retrain;
  if (hv === 'sup') { p.sup = SUP_SHIFTS; p.supX = SUP_X; }
  if (draft.cl && draft.cl.stage && (draft.cl.stage.st === 'agreed' || draft.cl.stage.st === 'grudging')) { p.robot = p.robot / 2; p.staged = true; }
  if (r && (r.st === 'agreed' || r.st === 'grudging') && r.terms.safety === 'shift') { p.jobs = (p.jobs || 0) + 2; p.upkeep += 2; p.shift = true; }
  return p;
}

/* ---------------- cases (the arcs) ---------------- */
export const caseOf = (save, id) => govOf(save).cases[id] || null;
/* run on each visit and after each game: opens cases whose entry is met, moves live cases to their next meeting */
export function progress(save, ctx) {
  const G = govOf(save); if (!save.sim || save.sim.v !== 2) return;
  for (const A of Object.values(ARCS)) {
    let C = G.cases[A.id];
    if (!C) { if (A.entry(save, ctx).ok) { C = G.cases[A.id] = { id: A.id, st: 'm1', v0: G.visit.n, ref: refRate(save.sim, ctx), draft: { motion: A.first, cl: {} }, asked: {}, said: {} }; A.open && A.open(save, C); news(G, { v: G.visit.n, k: 'case', id: A.id }); C.snap = { ...save.sim.fac }; } continue; }
    if (C.st === 'later' && G.visit.n >= C.reV) { C.st = 'm1'; C.v0 = G.visit.n; }
    if (C.ref == null) C.ref = refRate(save.sim, ctx);
    A.step && A.step(save, ctx, C, api);
    if (C.st === 'm1' && !C.snap) C.snap = { ...save.sim.fac };             // the delegation's approval, frozen as the meeting opens (and once, for a case open before the upgrade)
    if (C.st !== 'm1' && C.snap) delete C.snap;
  }
}
export function deferCase(save, id) { const G = govOf(save), C = G.cases[id]; if (!C || C.st !== 'm1') return false; C.st = 'later'; C.reV = G.visit.n + 2; remember(G, { v: G.visit.n, k: 'defer', id }); return true; }

/* at the counter: talk terms over a clause with its sponsor. One counter per changed material term */
export function offer(save, ctx, caseId, clauseId, terms) {
  const G = govOf(save), C = G.cases[caseId], K = CLAUSES[clauseId]; if (!C || C.st !== 'm1') return { ok: false };
  const M = MOTIONS[C.draft.motion]; if (!M.clauses.includes(clauseId)) return { ok: false, why: 'not-allowed' };
  const others = Object.keys(C.draft.cl).filter(id => id !== clauseId && C.draft.cl[id].st !== 'refused');
  if (others.length >= 2) return { ok: false, why: 'two-clauses' };
  if (others.some(id => CLAUSES[id].by === K.by)) return { ok: false, why: 'one-per-sponsor' };
  const key = JSON.stringify(terms), prev = C.draft.cl[clauseId], r = K.judge(terms, { save, ctx, G });
  let st, ctr = null;
  if (!r.ok) st = 'refused';
  else if (K.counter && !(prev && prev.ctrOn === key)) { const c = K.counter(terms); if (c) { st = 'countered'; ctr = c; } else st = 'agreed'; }
  else st = 'agreed';
  C.draft.cl[clauseId] = { terms, st, ctr, ctrOn: ctr ? key : prev && prev.ctrOn, why: r.why };
  C.said[K.by] = st;
  return { ok: true, st, ctr, why: r.why };
}
export function answerCounter(save, caseId, clauseId, accept) {
  const C = caseOf(save, caseId), c = C && C.draft.cl[clauseId]; if (!c || c.st !== 'countered') return false;
  if (accept) { c.terms = c.ctr; c.st = 'agreed'; } else c.st = 'grudging';
  c.ctrOn = JSON.stringify(c.terms); c.ctr = null; return true;
}
export function dropClause(save, caseId, clauseId) { const C = caseOf(save, caseId); if (!C || C.st !== 'm1') return false; delete C.draft.cl[clauseId]; return true; }
export function setMotion(save, caseId, motion) {
  const C = caseOf(save, caseId); if (!C || C.st !== 'm1' || MOTIONS[motion].arc !== caseId) return false;
  C.draft.motion = motion; for (const id of Object.keys(C.draft.cl)) if (!MOTIONS[motion].clauses.includes(id)) delete C.draft.cl[id]; return true;
}
export function ask(save, caseId, seat) { const C = caseOf(save, caseId); if (!C) return false; C.asked[seat] = true; return true; }

/* the hearing: validate, vote, and on a pass sign everything at once. hid: a stable id for this submission */
export function submit(save, ctx, caseId, hid, { override = false } = {}) {
  const G = govOf(save), C = caseOf(save, caseId);
  if (!C || C.st !== 'm1') return { ok: false, stale: true, why: 'This case is no longer open for a vote.' };
  const r = once(save, 'vote:' + hid, () => {
    const draft = C.draft, M = MOTIONS[draft.motion], b = blockers(save, ctx, draft);
    if (b.length) return { ok: false, why: b.map(x => x[1]).join(' ') };
    const T = tally(save, ctx, draft);
    if (!T.pass && !override) {
      C.failV = G.visit.n; C.failM = draft.motion; C.fails = (C.fails || 0) + 1;
      remember(G, { v: G.visit.n, k: 'vote', id: caseId, motion: draft.motion, yes: T.yes, no: T.no, abs: T.abs, pass: false });
      return { ok: true, pass: false, T };
    }
    if (override) {
      const o = overrideOK(save, ctx, draft); if (!o.ok) return { ok: false, why: o.why };
      G.over.q = save.sim.q.n; book(save.sim, save.corp, 'ev', -o.cost, `緊急権限 Emergency override filed: ¥${o.cost.toLocaleString()}.`);
      save.sim.bousou = clamp(save.sim.bousou + 12, 0, 100); trustAdd(G, 'chair', -10);
      for (const k of SEATS) if (k !== 'chair' && T.seats[k].vote === 'no') trustAdd(G, k, -5);
      G.review = { v: G.visit.n + 1, kind: 'override', id: caseId }; G.path.dom += 2;
    }
    sign(save, ctx, C, T, override);
    return { ok: true, pass: true, T, override };
  });
  if (r.dup) return { ok: true, dup: true, st: C.st };
  return r;
}
export function overrideOK(save, ctx, draft) {
  const G = govOf(save), M = MOTIONS[draft.motion], cost = Math.max(200, Math.round(4 * essentials(save.sim)));
  if (!M.override) return { ok: false, why: 'This motion cannot be forced.' };
  if (G.over.q === save.sim.q.n) return { ok: false, why: 'The override was already used this quarter.' };
  if (spendable(save) < commitments(save, draft) + crewFee(save, ctx, draft) + cost) return { ok: false, why: 'Not even an override can spend the reserve.' };
  return { ok: true, cost };
}
function sign(save, ctx, C, T, override) {
  const G = govOf(save), S = save.sim, draft = C.draft, M = MOTIONS[draft.motion], A = ARCS[C.id], p = price(C.ref);
  const cap0 = capacity(S, ctx);
  if (M.costH) escrowIn(save, C.id + ':' + draft.motion, p(M.costH), M.en + ' · installation', { out: true, dueV: G.visit.n });
  if (M.holdH) escrowIn(save, C.id + ':hold', p(M.holdH), M.holdWhy || M.en, { dueV: G.visit.n + 3 });
  if (M.train) S.trainSlots = (S.trainSlots || 0) + M.train;
  for (const [id, c] of Object.entries(draft.cl)) {
    if (c.st !== 'agreed' && c.st !== 'grudging') continue;
    const K = CLAUSES[id], amt = K.cost(c.terms, p), pid = C.id + ':' + id;
    if (amt) escrowIn(save, pid, amt, K.en);
    if (K.train) S.trainSlots = (S.trainSlots || 0) + K.train(c.terms);
    G.pledges.push({ id: pid, clause: id, case: C.id, to: K.by, terms: c.terms, st: 'open', v: G.visit.n, dueV: G.visit.n + (K.due || 3), base: { runs: S.runs, retr: S.retr, aired: S.aired, dlv: S.dlv } });
    if (K.lock) S.locks = Object.assign(S.locks || {}, K.lock(c.terms));
  }
  if (M.lock) { S.locks = Object.assign(S.locks || {}, M.lock); Object.assign(S.pol, M.lock); }
  const hv = draft.motion === 'full' ? (T.seats.union.vote === 'yes' ? 'staff' : draft.handover === 'crew' ? 'crew' : 'sup') : null;   // the union's actual vote, before any trust moves
  if (hv === 'crew') book(S, save.corp, 'cap', -p(2), `試運転班 Commissioning crew hired for the night line: ${p.y(2)}.`);
  if (M.proj) { S.proj = S.proj.filter(x => x.id !== M.proj.id).concat([projFor(draft, hv)]); if (M.costH) escrowOut(save, C.id + ':' + draft.motion, 'pay'); }
  if (hv === 'staff') log(S, 'gov', '引継ぎ The union\'s stewards staff the handover: the line starts at full output.');
  if (hv === 'sup') log(S, 'gov', `監督運転 Supervised start: ${Math.round(SUP_X * 100)}% of the robot bonus until two paid Factory shifts are done.`);
  const cap1 = capacity(S, ctx);
  C.acc = { motion: draft.motion, v: G.visit.n, t: S.t, override, base: { runs: S.runs, retr: S.retr, aired: S.aired, dlv: S.dlv, ships: S.ships }, disp: Math.max(0, Math.round(cap0.jobsW - cap1.jobsW)), clauses: Object.keys(draft.cl).filter(id => ['agreed', 'grudging'].includes(draft.cl[id].st)), yes: T.yes, hv, unionVote: T.seats.union.vote };
  C.st = M.next || 'live';
  remember(G, { v: G.visit.n, k: 'vote', id: C.id, motion: draft.motion, yes: T.yes, no: T.no, abs: T.abs, pass: true, override });
  log(S, 'gov', `採決 ${M.j} (${M.en}) ${override ? 'FORCED by the AI\'s emergency mandate' : `passed ${T.yes}–${T.no}–${T.abs}`}.`);
  G.sig.stamp = G.visit.n;
  A.signed && A.signed(save, ctx, C, api);
}
/* fallbacks after a failed vote: keep the current policy, switch to the scaled pilot, or withdraw */
export function fallback(save, ctx, caseId, how) {
  const G = govOf(save), C = caseOf(save, caseId); if (!C || C.st !== 'm1') return false;
  if (how === 'pilot' && MOTIONS[ARCS[caseId].rescue]) return setMotion(save, caseId, ARCS[caseId].rescue);
  C.st = how === 'keep' ? 'kept' : 'withdrawn'; C.end = G.visit.n; remember(G, { v: G.visit.n, k: 'fallback', id: caseId, how });
  log(save.sim, 'gov', how === 'keep' ? '現状維持 The proposal is shelved; the line stays as it is.' : '撤回 The AI withdrew its proposal.');
  return true;
}
/* a meeting's choice (meetings 2 and 3): the arc decides what each option does */
export function choose(save, ctx, caseId, opt, hid) {
  const C = caseOf(save, caseId), A = ARCS[caseId]; if (!C) return { ok: false };
  const r = once(save, 'meet:' + hid, () => A.choose(save, ctx, C, opt, api));
  return r.dup ? { ok: true, dup: true } : r;
}

/* pledges: checked at the review; fulfilled +8 trust, broken −15 and a remedy */
function settle(save, ctx, p, ok, part = 1, note = '') {
  const G = govOf(save); if (p.st !== 'open') return;
  p.st = ok ? 'kept' : 'broken'; p.at = G.visit.n; p.note = note;
  if (ok) { trustAdd(G, p.to, 8); escrowOut(save, p.id, 'pay', part); if (['union', 'civic'].includes(p.to)) G.path.coop++; }
  else { trustAdd(G, p.to, -15); escrowOut(save, p.id, 'pay', part); news(G, { v: G.visit.n, k: 'paper', id: p.id }); G.sig.audit = G.visit.n + 2; }
  remember(G, { v: G.visit.n, k: ok ? 'kept' : 'broken', id: p.id, to: p.to });
  log(save.sim, 'gov', `${ok ? '履行 Kept' : '違反 Broken'}: ${CLAUSES[p.clause].en} (${CAST[p.to].j}).${note ? ' ' + note : ''}`);
}

/* the operations the arcs use (passed as `api` so gov-arc.js needs no imports from here) */
const api = { govOf, once, escrowIn, escrowOut, openLot, sendLot, releaseLot, settle, trustAdd, remember, news, spendable, reserve, capacity, book, log, RUN, projFor, price };

/* ---------------- what's on the counter: the inbox ---------------- */
/* one major case and two routine decisions at most; everything else is a status line */
export function inbox(save, ctx) {
  const G = govOf(save), S = save.sim, out = { major: null, routine: [], status: [] };
  for (const A of Object.values(ARCS)) { const C = G.cases[A.id]; if (!C) { const e = A.entry(save, ctx); if (!e.ok && e.why) out.status.push(e.why); continue; }
    const m = A.meeting(save, ctx, C, api); if (m && !out.major) out.major = { arc: A, C, m }; else if (m) out.status.push(m.title[1] + ' — waiting'); else { const s = A.status && A.status(save, ctx, C, api); if (s) out.status.push(s); } }
  out.routine = (S.ev || []).slice(0, 2);
  if (S.ev.length > 2) out.status.push(`${S.ev.length - 2} more routine decisions wait behind these`);
  if (G.review && G.review.v <= G.visit.n) out.status.push('Oversight review open: the commissioner wants to see the override\'s record');
  if (S.pet && S.pet.st === 'open') out.status.push('技術者の請願 · the engineers ask Operations for retention');
  if (S.maint && S.maint.left > 0) out.status.push(`整備時間 · maintenance window: ${S.maint.left} paid Factory shift${S.maint.left === 1 ? '' : 's'} left`);
  return out;
}
/* contracted cash flows, shown apart from the operating forecast */
export function contracted(save) {
  const G = govOf(save), S = save.sim;
  return { escrow: escrowed(save), lines: G.escrow.filter(e => e.st === 'held').map(e => ({ why: e.why, amt: e.amt, dueV: e.dueV })), lots: (S.lots || []).filter(l => !l.done && !l.off).map(l => ({ id: l.id, pay: l.pay || 0, left: l.qty - l.sent, held: l.held })),
    recurring: (S.proj || []).reduce((n, p) => n + (p.upkeep || 0), 0) };
}
/* close the oversight review after an override: the commissioner reads the record */
export function closeReview(save, ok) {
  const G = govOf(save); if (!G.review) return false;
  once(save, 'review:' + G.review.v + ':' + G.review.id, () => { trustAdd(G, 'audit', ok ? 3 : -5); remember(G, { v: G.visit.n, k: 'review', id: G.review.id, ok }); G.review = null; });
  return true;
}

/* ---------------- the entrance line: one actionable sentence from live state ----------------
   Priority: a due review, an actionable hearing, a pending petition, an attainable case prerequisite, the earliest
   future review. Returns { jp, en, go } where go names a seat to select ('chair', 'ops', …), 'hear', or a room id. */
const wordsFor = robots => { let m = 0; while (Math.floor(m * .6) < robots) m++; return m; };
export function nextAction(save, ctx) {
  const G = govOf(save), S = save.sim, I = inbox(save, ctx), maj = I.major;
  if (G.review && G.review.v <= G.visit.n) return { jp: '監督審査', en: 'Oversight review due: show the commissioner the override\'s record.', go: 'audit' };
  if (maj && maj.m.kind !== 'vote') return { jp: '審査', en: `${maj.m.title[1]} is due today: open it with the chair.`, go: 'hear' };
  if (maj) {
    const d = maj.C.draft, M = MOTIONS[d.motion], T = tally(save, ctx, d), bl = blockers(save, ctx, d);
    if (T.pass) {
      const hv = handoverOf(save, ctx, d), st = d.cl.stage && ['agreed', 'grudging'].includes(d.cl.stage.st), b = M.proj ? (M.proj.robot || 0) * (st ? .5 : 1) : 0, pc = v => Math.round(v * 1000) / 10 + '%';
      const u = T.seats.union.vote, hand = hv === 'sup' ? ` · +${pc(b * SUP_X)} robot output until two paid Factory shifts, then +${pc(b)}` : hv === 'crew' ? ` · crew hired: +${pc(b)} at once` : hv === 'staff' ? ` · the union staffs it: +${pc(b)}` : '';
      return { jp: '採決可能', en: `${T.yes}/5 yes${u !== 'yes' && M.proj ? ` · Union ${u === 'no' ? 'opposes' : 'abstains'}` : ''}${hand}.${bl.length ? ' Blocked: ' + bl[0][1] : ' Ready for the hearing.'}`, go: 'hear' };
    }
    const wants = SEATS.filter(k => T.seats[k].vote !== 'yes').map(k => { const id = M.clauses.find(c => CLAUSES[c].by === k && !(d.cl[c] && d.cl[c].st === 'agreed')); return id ? { k, id } : null; }).filter(Boolean);
    const SH = { chair: 'Chair wants', fin: 'Finance wants', union: 'Union wants', civic: 'Residents want', ops: 'Operations wants' };
    return { jp: '交渉中', en: `${T.yes}/3 yes.${wants.map(w => ` ${SH[w.k]} ${CLAUSES[w.id].why[1]}.`).join('')}${wants.length ? '' : ' No clause left to offer: try the other motion.'}`, go: wants.length ? wants[0].k : 'chair', all: wants.map(w => w.k) };
  }
  if (S.pet && S.pet.st === 'open') return { jp: '技術者の請願', en: 'The engineers have petitioned for retention: answer them with Operations.', go: 'ops' };
  const line = G.cases.line;
  if (!line && ctx.tier >= 0) {
    if (!((save.corp.factory || {}).shifts)) return { jp: '夜間ライン', en: 'Play a paid Factory shift now: the night-line proposal opens after the first one.', go: 'factory' };
    const r = Math.floor(ctx.mem * .6); if (r < 30) { const w = wordsFor(30) - ctx.mem; return { jp: '夜間ライン', en: `Night-line proposal · ${r}/30 robots. ${30 - r} more robot${30 - r === 1 ? '' : 's'} require ${w} more word${w === 1 ? '' : 's'} in memory.`, go: 'study' }; }
  }
  if (I.status.length) return { jp: '次の審査', en: I.status[0].replace(/ · review in (\d+) visits?/, (m, n) => ` · review in ${n} attended day${n === '1' ? '' : 's'}`) + '.', go: null };
  return { jp: '案件なし', en: 'Nothing pending. The Policies tab forecasts any change before you make it.', go: 'policy' };
}

/* ---------------- the engineers' retention petition (answered with Operations) ---------------- */
export function petitionOpts(save) {
  const S = save.sim, p = S.pet; if (!p || p.st !== 'open') return [];
  const P = price(p.ref), sp = spendable(save), lost = Math.min(1, S.pop.e) * .02;
  return [
    { id: 'fund', j: '定着手当', en: `Fund a retention allowance · ${P.y(3)}`, d: `Paid now, above the reserve: engineers +10 at once. Worth it if the grid problem will soon clear.`, ok: sp >= P(3), why: `Needs ${P.y(3)} above the reserve (¥${Math.max(0, sp).toLocaleString()} spendable).` },
    { id: 'window', j: '整備時間', en: 'Give the crew a maintenance window', d: 'The next two paid Factory shifts pay 15% less in fees; then engineers +12, once. Partial progress persists. No cash needed now.', ok: true },
    { id: 'release', j: '異動承認', en: 'Release the engineers who asked to transfer', d: `One engineer leaves now and the post stays closed for 24 simulated hours. About ${lost.toFixed(2)} research an hour lost while the post is empty. Research already earned stays.`, ok: S.pop.e >= 1, why: 'No engineer is employed.' }];
}
export function answerPetition(save, ctx, opt, hid) {
  const S = save.sim, p = S.pet; if (!p || p.st !== 'open') return { ok: false, stale: true, why: 'There is no open petition.' };
  const r = once(save, 'pet:' + p.id + ':' + hid, () => {
    const o = petitionOpts(save).find(x => x.id === opt); if (!o) return { ok: false, why: 'Unknown answer.' }; if (!o.ok) return { ok: false, why: o.why };
    const P = price(p.ref);
    if (opt === 'fund') { book(S, save.corp, 'ev', -P(3), `定着手当 Retention allowance paid: ${P.y(3)}. Engineers +10.`); S.fac.eng = clamp(S.fac.eng + 10, 0, 100); }
    if (opt === 'window') { S.maint = { left: 2, cut: .15, id: p.id }; log(S, 'eng', '整備時間 Maintenance window agreed: the next two paid Factory shifts pay 15% less in fees.'); }
    if (opt === 'release') { const n = Math.min(1, Math.floor(S.pop.e)); S.pop.e -= n; S.engCut = { n: 1, until: S.t + 24 * 3600e3 }; log(S, 'eng', `異動 ${n} engineer released; the post stays closed for 24 hours.`); }
    p.st = 'done'; p.at = S.t; p.pick = opt; S.engLow = 0; trustAdd(govOf(save), 'ops', opt === 'release' ? -3 : 2);
    return { ok: true };
  });
  return r.dup ? { ok: true, dup: true } : r;
}
export function engDossier(save, ctx) {
  const S = save.sim, D = S.engD || {}, el = ctx.tier >= 2 && S.pop.e >= 1, NAMES = { employed: 'engineers employed', wage: 'wages', train: 'paid training', safety: 'high safety', hours: 'crunch hours', grid: 'repeated power deficits' };
  const top = Object.entries(D).filter(([, v]) => v).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2).map(([k, v]) => `${NAMES[k]} ${v > 0 ? '+' : ''}${v}`);
  return { el, appr: S.fac.eng, target: (S.drivers || {}).eng, streak: S.engLow || 0, top, warn: el && S.fac.eng < PET.warn, pet: S.pet, maint: S.maint };
}
