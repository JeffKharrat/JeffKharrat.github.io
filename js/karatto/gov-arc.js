/* カラット: the authored politics. Motions, the clauses (pledges) that can be attached to them, the arcs and their
   meetings, and what each representative says. Japanese first: [漢字|かな] marks furigana; bureau.js renders it.
   Every number here is a first-pass tuning value (politics brief, §3). No imports: gov.js passes its operations in. */
const H = 3600e3;

/* ---------------- motions ----------------
   Prices are in reference hours (politics brief §5): p(h) turns hours into yen at the reference rate snapshotted when
   the case opened (the tier's floor, or the median positive operating hour of the last day, within the tier's band).
   At a typical N5 company (~¥90/h) the first arc lands on the brief's figures: ¥900 installation, ¥300 inspection. */
export const MOTIONS = {
  full: { arc: 'line', j: '夜間無人ライン・全面導入', en: 'Full automation of the night line', auto: true, power: true, override: true, costH: 10,
    proj: { id: 'line', robot: .2, mw: 4, upkeep: 8, jobs: -6, label: '夜間無人ライン · full' }, clauses: ['inspect', 'retrain', 'report', 'stage'], next: 'live',
    d: p => `Commission +20% robot output on the existing line; the six-worker night crew goes. ${p.y(10)} for the installation, paid on signing; +4 MW demand and ¥8/h maintenance.`,
    base: {
      chair: () => ({ v: 0, why: ['監督の確認待ち', 'wants oversight first'] }),
      fin: st => st.spend >= st.need ? { v: 1, why: ['予備資金で足りる', 'the reserve covers it'] } : { v: -1, why: ['予備資金を割る', 'it breaks the reserve'] },
      union: () => ({ v: -2, why: ['雇用が失われる', 'jobs displaced'] }),
      civic: () => ({ v: -1, why: ['住民の監視がない', 'no resident oversight'] }),
      ops: () => ({ v: 2, why: ['今すぐの生産能力', 'capacity now'] }) } },
  pilot: { arc: 'line', j: '共同試験運転', en: 'Joint pilot', auto: true, power: true, holdH: 6.5, train: 4, holdWhy: 'Joint pilot · training places',
    proj: { id: 'line', robot: .1, mw: 2, upkeep: 4, jobs: -3, label: '夜間無人ライン · pilot' }, lock: { train: 1 }, clauses: ['inspect', 'report', 'stage'], next: 'live',
    d: p => `Commission +10% robot output for three attended visits; three night posts become four funded training places. ${p.y(6.5)} held for training; Training locked on until the review; six shipment runs required (each run trains one worker).`,
    base: {
      chair: () => ({ v: 1, why: ['段階的で妥当', 'a measured trial'] }),
      fin: st => st.spend >= st.need ? { v: 1, why: ['予備資金で足りる', 'the reserve covers it'] } : { v: -1, why: ['予備資金を割る', 'it breaks the reserve'] },
      union: () => ({ v: 1, why: ['研修付き', 'training built in'] }),
      civic: () => ({ v: 0, why: ['様子を見る', 'waiting to see'] }),
      ops: () => ({ v: 1, why: ['半分でも前進', 'half a step is a step'] }) } },
  defer: { arc: 'line', j: '試験の延期', en: 'Deferred trial', auto: false, clauses: [], next: 'deferred',
    d: () => 'Nothing is installed. Next visit, a four-shipment pilot objective is offered; the stronger installation stays locked until then.',
    base: {
      chair: () => ({ v: 1, why: ['慎重な判断', 'cautious'] }),
      fin: () => ({ v: 2, why: ['現金が残る', 'the cash stays'] }),
      union: () => ({ v: 0, why: ['急がないなら', 'no rush, no fight'] }),
      civic: () => ({ v: 1, why: ['急がない方がいい', 'better slow'] }),
      ops: () => ({ v: -1, why: ['機会の損失', 'a lost season'] }) } } };

/* the second arc: 公害公聴会 · the stack hearing */
Object.assign(MOTIONS, {
  retrofit: { arc: 'stack', j: '公開と改修', en: 'Disclose and retrofit', auto: false, power: true, costH: 8, clauses: ['report', 'grid'], next: 'live',
    proj: { id: 'scrubber', prodX: .9, pollX: .8, mw: 3, upkeep: 6, label: '集塵機 · commissioning' },
    d: p => `Publish the ledger and rent a scrubber: ${p.y(8)} on signing, ¥6/h, 3 MW. Production −10% until it is commissioned (two shipment runs, plus a Power shift with the grid clause); then pollution from output −65% for good.`,
    base: {
      chair: () => ({ v: 1, why: ['公開は株主に好印象', 'disclosure reassures shareholders'] }),
      fin: st => st.spend >= st.need ? { v: 0, why: ['費用が重い', 'a heavy cost'] } : { v: -1, why: ['予備資金を割る', 'it breaks the reserve'] },
      union: st => st.S.poll >= 55 ? { v: 1, why: ['煙は現場も吸う', 'the floor breathes the smoke'] } : { v: 0, why: ['仕事が減らなければ', 'if no jobs are lost'] },
      civic: () => ({ v: 2, why: ['公開と改修', 'disclosure and a retrofit'] }),
      ops: () => ({ v: -1, why: ['効率が落ちる', 'efficiency drops'] }) } },
  cap: { arc: 'stack', j: '生産上限', en: 'Cap production', auto: false, clauses: ['premium', 'report'], next: 'live',
    proj: { id: 'cap', prodX: .8, label: '生産上限 · clean output limit' },
    d: () => 'A clean output limit: production −20% (and its pollution with it) until the review, no capital spent. Delivery capacity and sales fall.',
    base: {
      chair: () => ({ v: 1, why: ['慎重で妥当', 'careful and reasonable'] }),
      fin: () => ({ v: -1, why: ['売上が減る', 'sales fall'] }),
      union: () => ({ v: 0, why: ['賃金次第', 'depends on wages'] }),
      civic: () => ({ v: 2, why: ['分かりやすい上限', 'a cap anyone can check'] }),
      ops: () => ({ v: -1, why: ['能力を捨てる', 'capacity thrown away'] }) } },
  delay: { arc: 'stack', j: '公表延期', en: 'Delay disclosure', auto: false, clauses: [], next: 'live',
    d: () => 'Keep the throughput and publish only a cap: for three attended visits a Factory shift may ship six at most. One shift over it and the paper prints the ledger: a review.',
    base: {
      chair: () => ({ v: -1, why: ['危険な賭け', 'a risky bet'] }),
      fin: () => ({ v: 2, why: ['費用なし', 'costs nothing'] }),
      union: () => ({ v: 1, why: ['仕事が減らない', 'no jobs lost'] }),
      civic: () => ({ v: -2, why: ['隠蔽', 'a cover-up'] }),
      ops: () => ({ v: 2, why: ['生産を止めない', 'production keeps going'] }) } } });

/* ---------------- clauses: at most two per proposal, one per sponsor ---------------- */
export const CLAUSES = {
  inspect: { by: 'chair', j: '独立検査', en: 'Independent inspection', why: ['独立検査', 'independent inspection'], due: 3,
    cost: (t, p) => p(3.3), judge: () => ({ ok: true }),
    terms0: {}, desc: (t, p) => `An independent inspection after six shipment runs, published. Capped expense ${p.y(3.3)}, refunded if it never happens.`,
    contract: (t, p) => ({ metric: 'shipment runs (paid Factory shifts, 5+ shipped)', qty: 6, funding: `${p.y(3.3)} escrow`, to: 'the board', deadline: '3 attended visits', remedy: 'refund; automation frozen one review; corrective inspection' }) },
  retrain: { by: 'union', j: '再訓練保証', en: 'Retraining guarantee', why: ['再訓練保証', 'retraining guarantee'], due: 3,
    cost: (t, p) => t.places * p(1.65), lock: () => ({ train: 1 }), train: t => t.places,
    terms0: { places: 6, safety: 'wage', refusal: false },
    judge: t => t.places > 4 ? { ok: false, why: 'capacity' } : t.safety !== 'shift' ? { ok: false, why: 'safety' } : { ok: true },
    counter: t => (t.refusal ? null : { ...t, refusal: true }),
    desc: (t, p) => `${t.places} funded training places (¥${(t.places * p(1.65)).toLocaleString()}: each Factory shipment run trains one displaced worker); ${t.safety === 'shift' ? 'a protected two-worker maintenance shift (+2 jobs, ¥2/h)' : 'a wage supplement instead of a maintenance shift'}${t.refusal ? '; first refusal on the next two openings' : ''}. Training locked on until the review.`,
    contract: (t, p) => ({ metric: 'workers moved into funded roles (one per shipment run while places are open)', qty: t.places, funding: `¥${(t.places * p(1.65)).toLocaleString()} escrow`, to: 'the union', deadline: '3 attended visits', remedy: 'partial credit and one corrective visit; then broken' }) },
  report: { by: 'civic', j: '公開報告', en: 'Public operating report', why: ['公開報告', 'a public report'], due: 3,
    cost: (t, p) => p(1.65), judge: () => ({ ok: true }), terms0: {},
    desc: (t, p) => `The night line's operating ledger published through the Broadcast station (filed by legal while Broadcast is closed). ${p.y(1.65)}.`,
    contract: (t, p) => ({ metric: 'a Broadcast shift aired after signing', qty: 1, funding: `${p.y(1.65)} escrow`, to: 'the residents', deadline: '3 attended visits', remedy: 'the paper prints the ledger instead' }) },
  stage: { by: 'fin', j: '段階的導入', en: 'Staged installation', why: ['段階的導入', 'staged installation'], due: 3,
    cost: () => 0, judge: () => ({ ok: true }), terms0: {},
    desc: () => 'Half the robot uplift at first; the full output after three shipment runs. No cost.',
    contract: () => ({ metric: 'shipment runs before full output', qty: 3, funding: 'none', to: 'finance', deadline: 'automatic', remedy: '—' }) },
  grid: { by: 'ops', j: '電力枠', en: 'A Power window', why: ['電力枠', 'a power window'], due: 3, cost: () => 0, judge: () => ({ ok: true }), terms0: {},
    desc: () => 'Commission the scrubber during a Power plant shift (one is needed, from N4; before that, a third shipment run instead). No cost.',
    contract: () => ({ metric: 'a Power plant shift after signing (N4+), or a third shipment run', qty: 1, funding: 'none', to: 'operations', deadline: '3 attended visits', remedy: 'commissioning slips to the review' }) },
  premium: { by: 'fin', j: '環境表示', en: 'Clean-label premium', why: ['環境表示', 'a clean-label premium'], due: 3, cost: () => 0, judge: () => ({ ok: true }), terms0: {},
    desc: () => 'The capped output sells under a clean label: +10% on the sale price while the cap holds. No cost.',
    contract: () => ({ metric: 'the sale price while the cap holds', qty: 1.1, funding: 'none', to: 'finance', deadline: 'the cap\'s term', remedy: 'ends with the cap' }) },
  scrub: { by: 'civic', j: '集塵機', en: 'Scrubber commissioned', why: ['集塵機', 'the scrubber'], due: 3, cost: () => 0, judge: () => ({ ok: true }), terms0: {}, desc: () => 'The scrubber runs by the review.', contract: () => ({ metric: 'commissioned', qty: 1, funding: 'escrowed on signing', to: 'the residents', deadline: '3 attended visits', remedy: 'one corrective visit, then broken' }) },
  capheld: { by: 'civic', j: '上限遵守', en: 'Cap held', why: ['上限', 'the cap'], due: 3, cost: () => 0, judge: () => ({ ok: true }), terms0: {}, desc: () => 'The output limit holds until the review.', contract: () => ({ metric: 'production −20%', qty: 1, funding: 'lost sales', to: 'the residents', deadline: '3 attended visits', remedy: '—' }) },
  clean: { by: 'civic', j: '公表上限', en: 'Published cap', why: ['公表上限', 'the published cap'], due: 3, cost: () => 0, judge: () => ({ ok: true }), terms0: {}, desc: () => 'No Factory shift ships more than six until the review.', contract: () => ({ metric: 'Factory shifts shipping more than six', qty: 0, funding: 'none', to: 'the residents', deadline: '3 attended visits', remedy: 'the paper prints the ledger; a supervised clean run or an inspection' }) } };

/* ---------------- the first arc: 誰のライン? Who owns the line? ---------------- */
const robotsOf = ctx => Math.floor(ctx.mem * .6);
const since = (S, C, k) => (S[k] || 0) - ((C.acc && C.acc.base[k]) || 0);
const runsNeed = C => (C.acc && C.acc.motion === 'defer' ? 4 : 6);
export const ARCS = {
  line: {
    id: 'line', j: '誰のライン', en: 'Who owns the line?', first: 'full', rescue: 'pilot',
    entry(save, ctx) {
      const fs = (save.corp.factory || {}).shifts || 0;
      if (ctx.tier < 0) return { ok: false, why: null };
      if (!fs) return { ok: false, why: '夜間ライン · the unattended line is proposed after your first paid Factory shift' };
      if (robotsOf(ctx) < 30) return { ok: false, why: `夜間ライン · the first powered fleet needs 30 robots (${robotsOf(ctx)} now: words in memory × 0.6)` };
      return { ok: true };
    },
    signed(save, ctx, C, api) {
      const G = api.govOf(save);
      if (C.acc.motion === 'defer') return;
      C.need = runsNeed(C);
      if (C.acc.clauses.includes('retrain')) G.sig.annex = 'building';
    },
    /* moves on visits and after games */
    step(save, ctx, C, api) {
      const S = save.sim, G = api.govOf(save), v = G.visit.n;
      if (C.st === 'live' && C.acc) {
        const p = S.proj.find(x => x.id === 'line');
        if (p && p.staged && since(S, C, 'runs') >= 3) { p.robot = MOTIONS[C.acc.motion].proj.robot; p.staged = false; api.log(S, 'gov', '段階的導入 Stage two: the night line runs at full output.'); }
        if (!C.m2 && C.acc.motion === 'full' && !C.acc.clauses.includes('retrain') && C.acc.disp >= 2 && v >= C.acc.v + 1) {
          C.m2 = { kind: 'hold', v }; C.st = 'm2';
          S.hold = { pct: .3, until: S.t + 24 * H, by: 'union' };
          api.log(S, 'union', `出荷停止 The union withholds 30% of outbound dispatch for 24 hours: ${C.acc.disp} jobs were displaced with no labour deal.`);
          api.news(G, { v, k: 'hold', id: 'line' });
        }
        if (v >= C.acc.v + 3) C.st = 'm3';
      }
      if (C.st === 'deferred' && v >= C.acc.v + 1) { C.st = 'm2'; C.m2 = { kind: 'objective', v }; }
      if (C.st === 'obj' && since(S, C, 'runs') >= 4) { C.st = 'm1'; C.draft = { motion: 'pilot', cl: {} }; C.noDefer = true; C.v0 = v; api.log(S, 'gov', '試験目標達成 The four-run pilot objective is met: the board reopens the night line, pilot first.'); }
      if (C.st === 'cure' && v >= C.cureV) C.st = 'm3';
    },
    /* the major item on the counter, if any */
    meeting(save, ctx, C, api) {
      const S = save.sim, G = api.govOf(save);
      if (C.st === 'm1') return { kind: 'vote', n: 1, title: ['夜間無人ライン', 'Meeting 1 · The unattended line'], brief: BRIEF.m1, motions: C.noDefer ? ['full', 'pilot'] : ['full', 'pilot', 'defer'] };
      const p = api.price(C.ref);
      if (C.st === 'm2' && C.m2.kind === 'hold') return { kind: 'choice', n: 2, title: ['出荷停止', 'Meeting 2 · Dispatch hold'], brief: BRIEF.m2,
        opts: [
          { id: 'redeploy', j: '配置転換計画', en: 'Book a redeployment programme', d: `${p.y(5.5)} held for four funded redeployments (one per shipment run), checked at the review. The hold lifts now; Training locks on.`, ok: api.spendable(save) >= p(5.5), why: `Needs ${p.y(5.5)} above the reserve.` },
          { id: 'partial', j: '一部出荷', en: 'Accept partial delivery', d: `Pay the capped contract shortfall now (${p.y(shortH(S, C))}); the hold runs its 24 hours.`, ok: true },
          { id: 'extend', j: '延長交渉', en: 'Defer under an extension', d: `The hold runs its 24 hours; the union lets a protected recovery lot through: 16 goods in four Logistics deliveries, ${p.y(2.7)} on completion.`, ok: true }] };
      if (C.st === 'm2' && C.m2.kind === 'objective') return { kind: 'choice', n: 2, title: ['試験目標', 'Meeting 2 · A pilot objective'], brief: BRIEF.m2d,
        opts: [{ id: 'objective', j: '四便の試験', en: 'Take the four-run objective', d: 'Complete four shipment runs; the board then reopens the line with a joint pilot. Reversible: nothing is installed.', ok: true },
          { id: 'decline', j: '見送る', en: 'Decline', d: 'The line stays as it is. The case closes.', ok: true }] };
      if (C.st === 'm3') return review(save, ctx, C, api);
      return null;
    },
    status(save, ctx, C, api) {
      const S = save.sim, G = api.govOf(save);
      if (C.st === 'live') { const left = Math.max(0, C.acc.v + 3 - G.visit.n); return `夜間ライン · ${MOTIONS[C.acc.motion].en.toLowerCase()} · ${Math.min(since(S, C, 'runs'), C.need)}/${C.need} shipment runs · review in ${left} visit${left === 1 ? '' : 's'}`; }
      if (C.st === 'obj') return `夜間ライン · pilot objective · ${Math.min(4, since(S, C, 'runs'))}/4 shipment runs`;
      if (C.st === 'later') return `夜間ライン · deferred: back on the counter in ${Math.max(0, C.reV - G.visit.n)} visits`;
      if (C.st === 'done') return null;
      return null;
    },
    choose(save, ctx, C, opt, api) {
      const S = save.sim, G = api.govOf(save), v = G.visit.n;
      if (C.st === 'm2' && C.m2.kind === 'hold') {
        const p = api.price(C.ref);
        if (opt === 'redeploy') { if (api.spendable(save) < p(5.5)) return { ok: false, why: `Needs ${p.y(5.5)} above the reserve.` };
          api.escrowIn(save, 'line:redeploy', p(5.5), 'Redeployment programme'); S.trainSlots = (S.trainSlots || 0) + 4; S.hold = null; S.locks = Object.assign(S.locks || {}, { train: 1 }); S.pol.train = 1;
          G.pledges.push({ id: 'line:redeploy', clause: 'retrain', case: 'line', to: 'union', terms: { places: 4, safety: 'shift', refusal: false }, st: 'open', v, dueV: C.acc.v + 3, base: { runs: S.runs, retr: S.retr, aired: S.aired, dlv: S.dlv } });
          api.trustAdd(G, 'union', 4); G.sig.annex = 'building'; api.log(S, 'gov', '配置転換 Redeployment booked: the union reopens the gates.'); }
        if (opt === 'partial') { api.book(S, save.corp, 'orders', -p(shortH(S, C)), `一部出荷 Partial delivery: ${p.y(shortH(S, C))} contract shortfall paid.`); api.trustAdd(G, 'union', -3); }
        if (opt === 'extend') { api.openLot(save, { id: 'recovery', qty: 16, kind: 'protected', by: 'union', pay: p(2.7), due: v + 2, j: '復旧便', en: 'Recovery lot' }); api.trustAdd(G, 'union', 2); api.log(S, 'gov', '延長 Extension: a protected recovery lot of 16 goods may pass the picket through Logistics.'); }
        C.m2.pick = opt; C.st = 'live'; api.remember(G, { v, k: 'meet', id: 'line', n: 2, opt }); return { ok: true };
      }
      if (C.st === 'm2' && C.m2.kind === 'objective') {
        C.m2.pick = opt; api.remember(G, { v, k: 'meet', id: 'line', n: 2, opt });
        if (opt === 'objective') { C.st = 'obj'; C.acc.base.runs = S.runs; } else { C.st = 'done'; C.outcome = 'declined'; }
        return { ok: true };
      }
      if (C.st === 'm3') {
        const R = review(save, ctx, C, api), o = R.opts.find(x => x.id === opt); if (!o || !o.ok) return { ok: false, why: o ? o.why : 'unknown' };
        if (opt === 'cure') { const p3 = api.price(C.ref); api.book(S, save.corp, 'ev', -p3(3.3), '是正 Corrective action: an independent inspection is booked.'); C.st = 'cure'; C.cureV = v + 1; C.cured = true;
          for (const p of G.pledges.filter(p => p.case === 'line' && p.st === 'open' && !pledgeOK(save, ctx, p) && !partial(S, p))) { api.settle(save, ctx, p, false, 0); p.cured = true; api.trustAdd(G, p.to, 5); }
          G.freeze = null; api.remember(G, { v, k: 'meet', id: 'line', n: 3, opt }); return { ok: true }; }
        settleAll(save, ctx, C, api);
        const p = S.proj.find(x => x.id === 'line');
        if (opt === 'hold') { if (p) { p.robot = MOTIONS[C.acc.motion].proj.robot; p.staged = false; } }
        if (opt === 'curtail') { if (p) { const sh = p.jobs > -3 || p.shift; p.robot = .1; p.upkeep = 4 + (sh ? 2 : 0); p.mw = 2; p.jobs = -3 + (sh ? 2 : 0); p.label = '夜間無人ライン · trial output'; } }
        if (opt === 'retire') S.proj = S.proj.filter(x => x.id !== 'line');
        if (S.locks) { delete S.locks.train; }
        C.outcome = opt; C.st = 'done'; C.end = v;
        const kept = G.pledges.filter(x => x.case === 'line' && x.st === 'kept');
        if (kept.some(x => x.clause === 'retrain')) G.sig.annex = 'lit';
        if (!G.pledges.some(x => x.case === 'line' && x.st === 'broken' && !x.cured)) G.unlock = Object.assign(G.unlock || {}, { line2: true });
        api.remember(G, { v, k: 'meet', id: 'line', n: 3, opt });
        api.log(S, 'gov', `検査 Review closed: the night line is ${opt === 'hold' ? 'held as an installed project' : opt === 'curtail' ? 'curtailed to trial output' : 'retired'}.`);
        return { ok: true };
      }
      return { ok: false };
    } } };

/* ---------------- the second arc: 公害公聴会 · the stack hearing ----------------
   Opens when the smog stays: pollution ≥ 55 for 12 simulated hours (it re-arms only under 45). The residents' envoy
   calls a public hearing; the reporter is in the room. Three ways out, each with a promise to the residents. */
ARCS.stack = {
  id: 'stack', j: '公害公聴会', en: 'The stack hearing', first: 'retrofit', rescue: 'cap',
  entry(save, ctx) {
    const S = save.sim; if (ctx.tier < 0) return { ok: false, why: null };
    if ((S.pHi || 0) >= 12) return { ok: true };
    return { ok: false, why: S.poll >= 45 ? `公害 · a public hearing opens if pollution stays at 55+ for 12 hours (now ${Math.round(S.poll)}, ${S.pHi || 0} h)` : null };
  },
  signed(save, ctx, C, api) {
    const S = save.sim, G = api.govOf(save), v = G.visit.n, m = C.acc.motion, base = { runs: S.runs, retr: S.retr, aired: S.aired, dlv: S.dlv, pwr: S.pwr || 0, capBr: S.capBr || 0 };
    const pl = clause => G.pledges.push({ id: 'stack:' + clause, clause, case: 'stack', to: 'civic', terms: {}, st: 'open', v, dueV: v + 3, base });
    if (m === 'retrofit') { pl('scrub'); C.grid = C.acc.clauses.includes('grid'); }
    if (m === 'cap') { pl('capheld'); const p = S.proj.find(x => x.id === 'cap'); if (p && C.acc.clauses.includes('premium')) p.priceX = 1.1; }
    if (m === 'delay') { pl('clean'); S.shipCap = 6; }
    C.acc.base = { ...C.acc.base, ...base };
  },
  step(save, ctx, C, api) {
    const S = save.sim, G = api.govOf(save), v = G.visit.n;
    if (C.st !== 'live' || !C.acc) { if (C.st === 'cure' && v >= C.cureV) C.st = 'm2'; if (C.st === 'obj' && (S.cleanRun || 0) > (C.cleanBase || 0)) { C.st = 'm2'; C.cleaned = true; } return; }
    const m = C.acc.motion;
    if (m === 'retrofit' && !C.on) { const runs = since(S, C, 'runs'), pw = (S.pwr || 0) - (C.acc.base.pwr || 0);
      if (runs >= 2 && (!C.grid || ctx.tier < 1 ? runs >= 3 || (C.grid && pw >= 1) : pw >= 1)) { const p = S.proj.find(x => x.id === 'scrubber'); if (p) Object.assign(p, { prodX: 1, pollX: .35, label: '集塵機 · commissioned' }); C.on = v; G.sig.scrub = 'on'; api.log(S, 'gov', '試運転完了 The scrubber is commissioned: pollution from output −65%.'); } }
    if (m === 'delay' && (S.capBr || 0) > (C.acc.base.capBr || 0) && !C.leak) { C.leak = v; C.st = 'm2'; api.news(G, { v, k: 'paper', id: 'stack:leak' }); G.sig.audit = v + 2; api.trustAdd(G, 'civic', -5); api.log(S, 'gov', '新聞 The paper prints the operating ledger: a shift broke the published cap.'); return; }
    if (v >= C.acc.v + 3) C.st = 'm2';
  },
  meeting(save, ctx, C, api) {
    const S = save.sim, p = api.price(C.ref);
    if (C.st === 'm1') return { kind: 'vote', n: 1, title: ['公害公聴会', 'The stack hearing'], brief: BRIEF.s1, motions: ['retrofit', 'cap', 'delay'] };
    if (C.st !== 'm2') return null;
    const m = C.acc.motion, lines = [], opts = [];
    if (m === 'retrofit') { lines.push(['集塵機', C.on ? 'Commissioned' : `Not commissioned: ${since(S, C, 'runs')} shipment runs${C.grid ? `, ${(S.pwr || 0) - (C.acc.base.pwr || 0)} Power shifts` : ''}`, !!C.on]);
      if (C.on) opts.push({ id: 'keep', j: '継続', en: 'Keep the scrubber', d: 'It stays, with its upkeep. The residents remember the promise kept.', ok: true });
      else opts.push({ id: 'extend', j: '是正延長', en: 'A corrective visit', d: 'One more attended visit to commission it. The promise is not yet broken.', ok: !C.ext, why: 'Already extended once.' },
        { id: 'abandon', j: '断念', en: 'Abandon it', d: 'Remove the scrubber. The promise to the residents is broken; the paper prints it.', ok: true }); }
    if (m === 'cap') { lines.push(['上限', 'The output limit held the whole term', true]);
      opts.push({ id: 'keep', j: '上限継続', en: 'Keep the cap', d: 'Production stays −20% (premium kept if signed).', ok: true }, { id: 'lift', j: '上限解除', en: 'Lift the cap', d: 'Full output again; the residents are not pleased (−8 trust).', ok: true },
        { id: 'retrofit', j: '改修へ', en: 'Move to a retrofit', d: 'Lift the cap and open a new vote on disclosing and retrofitting.', ok: true }); }
    if (m === 'delay') {
      if (!C.leak) { lines.push(['公表上限', 'No shift broke the cap', true]); opts.push({ id: 'disclose', j: '公表する', en: 'Disclose now', d: 'Publish the ledger at last: residents +4 trust, the cap ends.', ok: true }, { id: 'quiet', j: '沈黙', en: 'Stay quiet', d: 'The cap ends; nothing is published. The promise counts as kept.', ok: true }); }
      else { lines.push(['公表上限', 'A shift broke the published cap; the paper printed the ledger', false]);
        if (C.cleaned) opts.push({ id: 'cured', j: '監督運転済', en: 'Close it: the clean run is done', d: 'The supervised shift stayed under the cap. The breach is cured.', ok: true });
        else opts.push({ id: 'clean', j: '監督運転', en: 'A supervised clean run', d: 'Your next Factory shift must ship six or fewer, under the commissioner\'s eye. It cures the breach.', ok: !C.obj, why: 'Already under way.' },
          { id: 'inspect', j: '独立検査', en: 'An independent inspection', d: `Pay ${p.y(3.3)} now. It cures the breach.`, ok: api.spendable(save) >= p(3.3), why: `Needs ${p.y(3.3)} above the reserve.` },
          { id: 'ignore', j: '無視', en: 'Ignore it', d: 'The promise is broken: residents −15 trust, and a pollution lawsuit lands on the table.', ok: true }); } }
    return { kind: 'choice', n: 2, title: ['公聴会 · 再審', 'The hearing, reconvened'], brief: BRIEF.s2, lines, opts, broken: false };
  },
  status(save, ctx, C, api) {
    const S = save.sim, G = api.govOf(save);
    if (C.st === 'live') { const left = Math.max(0, C.acc.v + 3 - G.visit.n), m = C.acc.motion;
      return `公聴会 · ${MOTIONS[m].en.toLowerCase()}${m === 'retrofit' ? (C.on ? ' · scrubber running' : ` · commissioning ${Math.min(since(S, C, 'runs'), 2)}/2 runs`) : m === 'delay' ? ' · Factory shifts: six at most' : ''} · review in ${left} visit${left === 1 ? '' : 's'}`; }
    if (C.st === 'obj') return '公聴会 · supervised clean run: your next Factory shift must ship six or fewer';
    return null;
  },
  choose(save, ctx, C, opt, api) {
    const S = save.sim, G = api.govOf(save), v = G.visit.n, p = api.price(C.ref), mt = this.meeting(save, ctx, C, api), o = mt && mt.opts.find(x => x.id === opt);
    if (!o || !o.ok) return { ok: false, why: o ? o.why : 'unknown' };
    const pl = id => G.pledges.find(x => x.id === 'stack:' + id && x.st === 'open'), done = out => { C.st = 'done'; C.outcome = out; C.end = v; delete S.shipCap; api.remember(G, { v, k: 'meet', id: 'stack', n: 2, opt }); return { ok: true }; };
    if (opt === 'keep' && C.acc.motion === 'retrofit') { api.settle(save, ctx, pl('scrub'), true, 1); G.unlock = Object.assign(G.unlock || {}, { siting: true }); return done('kept'); }
    if (opt === 'extend') { C.ext = true; C.st = 'live'; C.acc.v += 1; const q = pl('scrub'); if (q) q.dueV++; return { ok: true }; }
    if (opt === 'abandon') { api.settle(save, ctx, pl('scrub'), false, 0); S.proj = S.proj.filter(x => x.id !== 'scrubber'); delete G.sig.scrub; return done('abandoned'); }
    if (C.acc.motion === 'cap') { api.settle(save, ctx, pl('capheld'), true, 1);
      if (opt === 'lift' || opt === 'retrofit') S.proj = S.proj.filter(x => x.id !== 'cap');
      if (opt === 'lift') api.trustAdd(G, 'civic', -8);
      if (opt === 'retrofit') { done('to-retrofit'); C.st = 'm1'; C.draft = { motion: 'retrofit', cl: {} }; C.v0 = v; C.acc = null; delete C.failV; return { ok: true }; }
      return done(opt); }
    if (opt === 'disclose') { api.settle(save, ctx, pl('clean'), true, 1); api.trustAdd(G, 'civic', 4); return done('disclosed'); }
    if (opt === 'quiet') { api.settle(save, ctx, pl('clean'), true, 1); return done('quiet'); }
    if (opt === 'clean') { C.obj = true; C.st = 'obj'; C.cleanBase = S.cleanRun || 0; S.cleanWatch = 6; return { ok: true }; }
    if (opt === 'inspect' || opt === 'cured') { if (opt === 'inspect') api.book(S, save.corp, 'ev', -p(3.3), '独立検査 An independent inspection of the emissions ledger.'); const q = pl('clean'); api.settle(save, ctx, q, false, 0); if (q) { q.cured = true; api.trustAdd(G, 'civic', 5); } return done('cured'); }
    if (opt === 'ignore') { api.settle(save, ctx, pl('clean'), false, 0); if (!S.ev.some(e => e.k === 'lawsuit')) S.ev.push({ id: S.t + ':lawsuit', k: 'lawsuit', t: S.t }); return done('ignored'); }
    return { ok: false };
  } };

/* meeting 3: the inspection. Results first, then the programme's outcome */
function review(save, ctx, C, api) {
  const S = save.sim, G = api.govOf(save), runs = since(S, C, 'runs'), need = C.need || 6, retr = Math.floor(since(S, C, 'retr'));
  const open = G.pledges.filter(p => p.case === 'line'), lines = [];
  lines.push([`出荷便 ${Math.min(runs, need)}/${need}`, `Shipment runs since signing: ${runs} of ${need} required`, runs >= need]);
  for (const p of open) lines.push([CLAUSES[p.clause].j, pledgeLine(S, p), pledgeOK(save, ctx, p)]);
  if (C.acc.motion === 'pilot') lines.push(['研修', `Training placements: ${retr} of 4 (${api.price(C.ref).y(6.5)} held)`, retr >= 4]);
  const broken = open.some(p => p.st === 'open' && !pledgeOK(save, ctx, p) && !partial(S, p)) && !C.cured;
  const proven = runs >= need;
  return { kind: 'choice', n: 3, title: ['検査', 'Meeting 3 · Inspection'], brief: BRIEF.m3, lines, broken,
    opts: [
      { id: 'hold', j: '継続', en: 'Hold the programme', d: 'Keep it installed, with its upkeep and power draw.', ok: proven && !broken, why: !proven ? `Needs ${need} shipment runs.` : 'A broken promise blocks it: take corrective action first.' },
      { id: 'curtail', j: '縮小', en: 'Curtail to trial output', d: 'Keep +10% robot output, at the pilot\'s cost.', ok: true },
      { id: 'retire', j: '撤去', en: 'Retire it', d: 'Remove the line\'s uplift and its upkeep.', ok: true },
      ...(broken && !C.cured ? [{ id: 'cure', j: '是正措置', en: 'Corrective action', d: `An independent inspection now (${api.price(C.ref).y(3.3)}) and one more attended visit to make good. Cures the broken promise's vote penalty.`, ok: api.spendable(save) >= api.price(C.ref)(3.3), why: `Needs ${api.price(C.ref).y(3.3)} above the reserve.` }] : [])] };
}
function pledgeOK(save, ctx, p) {
  const S = save.sim, b = p.base;
  if (p.clause === 'inspect') return S.runs - b.runs >= 6;
  if (p.clause === 'retrain') return S.retr - b.retr >= p.terms.places;
  if (p.clause === 'report') return S.aired - b.aired >= 1 || ctx.tier < 2;
  return true;
}
const partial = (S, p) => p.clause === 'retrain' && S.retr - p.base.retr >= p.terms.places / 2;
function pledgeLine(S, p) {
  const b = p.base;
  if (p.clause === 'inspect') return `Inspection after six runs: ${Math.min(6, S.runs - b.runs)}/6`;
  if (p.clause === 'retrain') return `Workers moved into funded roles: ${Math.floor(S.retr - b.retr)}/${p.terms.places}`;
  if (p.clause === 'report') return `Public report: ${S.aired - b.aired >= 1 ? 'aired' : 'not aired yet (Broadcast)'}`;
  return 'Staged: automatic';
}
function settleAll(save, ctx, C, api) {
  const S = save.sim, G = api.govOf(save);
  for (const p of G.pledges.filter(p => p.case === 'line' && p.st === 'open')) {
    if (pledgeOK(save, ctx, p)) api.settle(save, ctx, p, true, 1);
    else if (p.clause === 'retrain' && partial(S, p)) api.settle(save, ctx, p, true, (S.retr - p.base.retr) / p.terms.places, 'Partial credit: fewer placements than promised.');
    else { api.settle(save, ctx, p, false, 0); if (C.acc.motion !== 'defer') G.freeze = { untilV: G.visit.n + 1, why: 'line' }; }
  }
  if (C.acc.motion === 'pilot') { const k = Math.min(1, Math.floor(S.retr - C.acc.base.retr) / 4); api.escrowOut(save, 'line:hold', 'pay', k); }
}
/* the contract shortfall during a hold: half of 30% of a day's sales, capped at 4.5 reference hours */
const shortH = (S, C) => Math.min(4.5, ((S.last && S.last.rev.sales) || 20) * 24 * .3 * .5 / (C.ref || 90));

/* ---------------- what they say ---------------- */
const L = (jp, en) => ({ jp, en });
export const BRIEF = {
  m1: { jp: '[夜間|やかん]の[生産|せいさん]を[自動化|じどうか]します。[組合|くみあい]は、仕事を失う[作業員|さぎょういん]に[研修|けんしゅう]を行うよう求めています。[取締役会|とりしまりやくかい]は、その[費用|ひよう]を確認してから[採決|さいけつ]します。',
    en: 'We plan to automate overnight production. The union wants training for workers who lose their jobs. The board will vote after reviewing the cost.',
    q: 'What does the union want for workers who lose their jobs?', a: ['Training', 'A wage rise', 'Early retirement', 'A public hearing'],
    hint: 'Sponsor hint: the chair votes yes with an independent inspection; the union needs a protected maintenance shift, not money.' },
  m2: { jp: '[組合|くみあい]は[出荷|しゅっか]の三[割|わり]を止めています。[研修|けんしゅう]の[約束|やくそく]がないまま、[自動化|じどうか]が進んだからです。',
    en: 'The union is holding 30% of outbound dispatch, because automation went ahead without a training promise.',
    q: 'How much of the dispatch is the union holding?', a: ['30%', 'All of it', 'Half', '10%'],
    hint: 'Sponsor hint: a redeployment programme reopens the gates now; an extension lets a small protected lot through.' },
  m2d: { jp: '[試験|しけん]は[延期|えんき]されました。四[便|びん]の[出荷|しゅっか]ができれば、[取締役会|とりしまりやくかい]はもう一度[話|はな]し[合|あ]います。',
    en: 'The trial was postponed. If four shipment runs go out, the board will discuss it again.',
    q: 'How many shipment runs does the board want to see?', a: ['Four', 'Six', 'Two', 'Ten'],
    hint: 'Sponsor hint: the objective is reversible; nothing is installed.' },
  s1: { jp: '[工場|こうじょう]の[煙|けむり]について、[公聴会|こうちょうかい]が[開|ひら]かれます。[住民|じゅうみん]は[空気|くうき]の[汚|よご]れを[数字|すうじ]で[示|しめ]すよう[求|もと]めています。[記者|きしゃ]も[来|き]ています。',
    en: 'A public hearing is being held about the factory smoke. The residents demand that the air pollution be shown in numbers. A reporter has come too.',
    q: 'What do the residents want?', a: ['The pollution shown in numbers', 'A new park', 'Lower rent', 'A night curfew'],
    hint: 'Sponsor hint: the envoy backs a retrofit outright; operations comes round with a Power window; finance needs a clean-label premium to accept a cap.' },
  s2: { jp: '[約束|やくそく]から[時間|じかん]が[経|た]ちました。[住民|じゅうみん]は[空|そら]がきれいになったか[確|たし]かめに[来|き]ます。',
    en: 'Time has passed since the promise. The residents are coming to check whether the sky got cleaner.',
    q: 'What are the residents coming to check?', a: ['Whether the sky got cleaner', 'Whether wages rose', 'Whether the trains run on time', 'Whether the shops opened'],
    hint: 'Sponsor hint: a broken cap can still be cured by a supervised clean run.' },
  m3: { jp: '[検査|けんさ]の日です。[監査委員|かんさいいん]が[約束|やくそく]の[記録|きろく]を[確|たし]かめます。[守|まも]られていなければ、[新聞|しんぶん]が書くでしょう。',
    en: 'It is inspection day. The audit commissioner checks the record of the promises. If they were not kept, the paper will write about it.',
    q: 'Who checks the record of the promises?', a: ['The audit commissioner', 'The union', 'The newspaper', 'The residents'],
    hint: 'Sponsor hint: a broken promise can still be cured with corrective action before you decide.' } };

export const AUTH = {
  union: L('[組合|くみあい]は[出荷|しゅっか]の[許可|きょか]を止められる。[整備|せいび]も[俺|おれ]たちの仕事だ。', 'The union can stop outbound clearance. Maintenance is our work too.'),
  civic: L('[公聴会|こうちょうかい]を求めることができます。[住民|じゅうみん]の声は[記録|きろく]に[残|のこ]ります。', 'I can demand a public hearing. The residents\' voice goes on the record.'),
  ops: L('[電力|でんりょく]と[設備|せつび]の[判断|はんだん]は私がする。[危|あぶ]ない[計画|けいかく]には[反対|はんたい]する。', 'I rule on power and equipment. I oppose unsafe plans.'),
  chair: L('[採決|さいけつ]の[日程|にってい]は私が決めます。[全社|ぜんしゃ]の[方針|ほうしん]には、[取締役会|とりしまりやくかい]の[承認|しょうにん]が[必要|ひつよう]です。', 'I set the vote. Company-wide policy needs the board\'s approval.'),
  fin: L('[予備資金|よびしきん]を[割|わ]る[計画|けいかく]には[賛成|さんせい]できません。[数字|すうじ]を見せてください。', 'I can\'t back a plan that breaks the reserve. Show me the numbers.'),
  legal: L('私は[投票|とうひょう]しません。[約束|やくそく]が守れる[形|かたち]で書かれているかを[確|たし]かめます。', 'I don\'t vote. I check that a promise is written in a form that can be kept.'),
  audit: L('私も[投票|とうひょう]しません。[約束|やくそく]が[実際|じっさい]に[果|は]たされたかを[数|かぞ]えます。', 'I don\'t vote either. I count whether promises were actually kept.') };

/* the constituency's need right now, from the planet's state */
export function need(seat, S, X, spend) {
  const P = S.pol, L0 = S.last || {};
  if (seat === 'union') return (L0.u || 0) > .08 ? L('ロボットのせいで[仕事|しごと]がない[仲間|なかま]がいる。[研修|けんしゅう]をやってくれ。', 'Robots left some of our people idle. Run training.')
    : P.hours > 0 ? L('[残業|ざんぎょう]が[続|つづ]いて、みんな[疲|つか]れている。', 'The overtime goes on and everyone is tired.')
    : P.wage < 1 ? L('この[賃金|ちんぎん]では[暮|く]らせない。', 'Nobody can live on these wages.') : L('[今|いま]は[安全|あんぜん]が[一番|いちばん]の[問題|もんだい]だ。', 'Right now, safety is the main issue.');
  if (seat === 'civic') return S.poll > 45 ? L('[空気|くうき]が[汚|よご]れています。[子供|こども]たちが[咳|せき]をしています。', 'The air is dirty. The children are coughing.')
    : P.watch > 0 ? L('[街|まち]のカメラが[増|ふ]えて、みんな[不安|ふあん]です。', 'There are more cameras in the streets, and people are uneasy.')
    : L0.short > 0 ? L('[店|みせ]に[品物|しなもの]が[足|た]りません。', 'The shops are short of goods.') : L('[今|いま]は[落|お]ち[着|つ]いています。[情報|じょうほう]を[公開|こうかい]し[続|つづ]けてください。', 'It\'s calm for now. Keep publishing information.');
  if (seat === 'ops') return S.power < 0 ? L('[電力|でんりょく]が[足|た]りない。[停電|ていでん]で[生産|せいさん]が[落|お]ちている。', 'We are short of power. Brownouts are cutting production.')
    : X.tier < 2 ? L('[設備|せつび]はまだ[余|よ]っている。もっと[動|うご]かせる。', 'The equipment has room. We can run more.') : L('[技術者|ぎじゅつしゃ]には[研究|けんきゅう]の[時間|じかん]が[要|い]る。', 'The engineers need time for research.');
  if (seat === 'chair') return S.debt > 0 ? L('[借入|かりいれ]が[残|のこ]っています。[返済|へんさい]を[優先|ゆうせん]してください。', 'There is still debt. Repay it first.')
    : S.stab < 40 ? L('[安定度|あんていど]が[低|ひく]すぎます。[株主|かぶぬし]が[心配|しんぱい]しています。', 'Stability is too low. The shareholders are worried.') : L('[取締役会|とりしまりやくかい]の[監督|かんとく]を[忘|わす]れないでください。', 'Don\'t forget the board\'s oversight.');
  if (seat === 'fin') return spend < 300 ? L('[使|つか]える[現金|げんきん]がほとんどありません。', 'There is almost no spendable cash.') : L('[納期|のうき]を守ることが[信用|しんよう]になります。', 'Meeting delivery dates is what builds credit.');
  if (seat === 'legal') return L('[署名|しょめい]の[前|まえ]に、[期限|きげん]と[救済|きゅうさい]を[確認|かくにん]してください。', 'Before signing, check the deadline and the remedy.');
  return L('[記録|きろく]は[全部|ぜんぶ]見ています。[数字|すうじ]は[嘘|うそ]をつきません。', 'I see every record. Numbers don\'t lie.');
}
/* the mood since the last visit, from the faction's approval */
export function mood(seat, v) {
  const band = v == null ? 1 : v < 30 ? 0 : v < 60 ? 1 : 2;
  const T = {
    union: [L('[現場|げんば]はかなり[怒|おこ]っている。[次|つぎ]は[止|と]めるぞ。', 'The floor is angry. Next time we stop it.'), L('まあ、[普通|ふつう]だ。[油断|ゆだん]はするな。', 'So-so. Don\'t get comfortable.'), L('[最近|さいきん]は[悪|わる]くない。この[調子|ちょうし]で[頼|たの]む。', 'Not bad lately. Keep it up.')],
    civic: [L('[住民|じゅうみん]の[怒|いか]りが[限界|げんかい]に[近|ちか]いです。', 'The residents\' anger is close to the limit.'), L('[住民|じゅうみん]は[様子|ようす]を見ています。', 'The residents are watching.'), L('[街|まち]の[雰囲気|ふんいき]はいいです。', 'The mood in town is good.')],
    ops: [L('[現場|げんば]が[回|まわ]らない。[人|ひと]が[辞|や]めていく。', 'The floor can\'t keep up. People are quitting.'), L('[問題|もんだい]はない。[改善|かいぜん]の[余地|よち]はある。', 'No problems. Room to improve.'), L('[設備|せつび]は[好調|こうちょう]だ。', 'The equipment is running well.')],
    chair: [L('[取締役会|とりしまりやくかい]は[不満|ふまん]です。[説明|せつめい]を求めます。', 'The board is unhappy. We want an explanation.'), L('[取締役会|とりしまりやくかい]は[静観|せいかん]しています。', 'The board is watching quietly.'), L('[取締役会|とりしまりやくかい]は[満足|まんぞく]しています。', 'The board is satisfied.')],
    fin: [L('[帳簿|ちょうぼ]は[赤|あか]です。', 'The books are in the red.'), L('[収支|しゅうし]は[安定|あんてい]しています。', 'Income and spending are steady.'), L('[利益|りえき]は[順調|じゅんちょう]です。', 'Profit is on track.')],
    legal: [L('[訴訟|そしょう]の[準備|じゅんび]をしています。', 'I\'m preparing for litigation.'), L('[契約|けいやく]に[問題|もんだい]はありません。', 'No problems in the contracts.'), L('[全|すべ]て[法律|ほうりつ]の[範囲内|はんいない]です。', 'Everything is within the law.')],
    audit: [L('[記録|きろく]に[矛盾|むじゅん]があります。', 'There are contradictions in the records.'), L('[記録|きろく]を[確認|かくにん]しています。', 'I am checking the records.'), L('[記録|きろく]はきれいです。', 'The records are clean.')] };
  return T[seat][band];
}
/* each seat's stance on the motion on the table, and the binding condition it reveals when asked */
export const STANCE = {
  full: {
    union: [L('[研修|けんしゅう]なしの[自動化|じどうか]は[認|みと]めない。', 'No automation without training.'), L('[最低|さいてい]でも、[整備|せいび]の[当番|とうばん]を[組合員|くみあいいん]に[残|のこ]せ。[金|かね]じゃない、[安全|あんぜん]の[問題|もんだい]だ。', 'At the very least, leave the maintenance shift to our members. It\'s not about money; it\'s about safety.')],
    civic: [L('[夜|よる]も[工場|こうじょう]が[動|うご]くなら、[住民|じゅうみん]は[知|し]る[権利|けんり]があります。', 'If the factory runs at night too, the residents have a right to know.'), L('[住民|じゅうみん]が[確|たし]かめられる[公開報告|こうかいほうこく]を[付|つ]けてください。', 'Attach a public report the residents can check.')],
    ops: [L('[今|いま]すぐ[全面|ぜんめん]で[行|い]くべきだ。[電力|でんりょく]は[足|た]りる。', 'We should go full, now. The power is there.'), L('[一|ひと]つ[言|い]っておく。[研修|けんしゅう]の[枠|わく]は四[人分|にんぶん]しかない。', 'One thing: there are only four training places.')],
    chair: [L('[賛成|さんせい]も[反対|はんたい]もしません。まだ。', 'I am neither for nor against. Not yet.'), L('[独立|どくりつ]した[検査|けんさ]があれば[賛成|さんせい]します。[結果|けっか]は[公開|こうかい]で。', 'With an independent inspection I will vote yes. Results made public.')],
    fin: [L('[予備資金|よびしきん]が[残|のこ]るなら[賛成|さんせい]です。', 'Yes, as long as the reserve survives.'), L('[費用|ひよう]が[重|おも]くなるなら、[段階的|だんかいてき]な[導入|どうにゅう]にしてください。', 'If the costs pile up, make the installation staged.')],
    legal: [L('[全面導入|ぜんめんどうにゅう]は[組合|くみあい]との[合意|ごうい]なしでも[合法|ごうほう]です。ただ、[出荷|しゅっか]を止められる[危険|きけん]があります。', 'Full automation is lawful without a union deal. But they can hold the dispatch.'), L('[約束|やくそく]には[数字|すうじ]と[期限|きげん]を書いてください。', 'Write numbers and a deadline into every promise.')],
    audit: [L('[検査|けんさ]は六[便|びん]の[出荷|しゅっか]の[後|あと]にできます。', 'An inspection can be held after six shipment runs.'), L('[数|かぞ]えられない[約束|やくそく]は、[守|まも]れません。', 'A promise that can\'t be counted can\'t be kept.')] },
  pilot: {
    union: [L('[研修|けんしゅう]が[付|つ]いているなら、[話|はなし]は[別|べつ]だ。', 'If training comes with it, that\'s another story.'), L('[研修|けんしゅう]を[本当|ほんとう]にやるなら、[文句|もんく]はない。', 'If the training really happens, no complaints.')],
    civic: [L('[試験|しけん]なら[様子|ようす]を見ます。', 'A trial: I\'ll watch.'), L('[公開報告|こうかいほうこく]があれば[賛成|さんせい]できます。', 'With a public report I could vote yes.')],
    ops: [L('[半分|はんぶん]でも[前進|ぜんしん]だ。', 'Half a step is still a step.'), L('六[便|びん]の[出荷|しゅっか]が[条件|じょうけん]だ。[工場|こうじょう]を[回|まわ]してくれ。', 'Six shipment runs are the condition. Keep the factory running.')],
    chair: [L('[段階的|だんかいてき]で[妥当|だとう]です。', 'Measured and reasonable.'), L('[検査|けんさ]を[付|つ]けてもいいですよ。', 'You may attach an inspection.')],
    fin: [L('[研修費|けんしゅうひ]は[預|あず]かります。', 'I\'ll hold the training money in escrow.'), L('[予備資金|よびしきん]が[残|のこ]れば[賛成|さんせい]です。', 'If the reserve survives, yes.')],
    legal: [L('[研修|けんしゅう]の[方針|ほうしん]は[検査|けんさ]まで[固定|こてい]されます。', 'The Training policy is locked until the review.'), L('[期限|きげん]は三[回|かい]の[訪問|ほうもん]です。', 'The deadline is three attended visits.')],
    audit: [L('[研修|けんしゅう]の[実績|じっせき]を[数|かぞ]えます。', 'I will count the training placements.'), L('四[人|にん]が[新|あたら]しい[仕事|しごと]に[就|つ]けば[合格|ごうかく]です。', 'Four people in new roles is a pass.')] },
  retrofit: {
    union: [L('[煙|けむり]が[減|へ]るなら[現場|げんば]も[助|たす]かる。', 'Less smoke helps the floor too.'), L('[工事|こうじ]で[仕事|しごと]が[減|へ]らないなら[賛成|さんせい]だ。', 'If the works don\'t cost jobs, I\'m for it.')],
    civic: [L('[公開|こうかい]と[改修|かいしゅう]、それが[私|わたし]たちの[要求|ようきゅう]です。', 'Disclosure and a retrofit: that is our demand.'), L('[報告|ほうこく]を[付|つ]けてくだされば、なお[良|よ]いです。', 'With a public report attached, even better.')],
    ops: [L('[集塵機|しゅうじんき]は[効率|こうりつ]を[落|お]とす。[試運転|しうんてん]まで[一割|いちわり][減|へ]る。', 'The scrubber costs efficiency: ten percent less until it\'s commissioned.'), L('[発電所|はつでんしょ]で[安定|あんてい]した[電力|でんりょく]をくれ。それなら[賛成|さんせい]する。', 'Give me a steady Power window and I\'ll vote for it.')],
    chair: [L('[公開|こうかい]は[株主|かぶぬし]にも[良|よ]い[印象|いんしょう]です。', 'Disclosure looks good to the shareholders.'), L('[私|わたし]は[賛成|さんせい]です。[財務|ざいむ]を[説得|せっとく]してください。', 'I\'m for it. Convince finance.')],
    fin: [L('[費用|ひよう]は[重|おも]いですね。', 'The cost is heavy.'), L('[予備資金|よびしきん]が[残|のこ]るなら[反対|はんたい]しません。', 'If the reserve survives, I won\'t oppose it.')],
    legal: [L('[公開|こうかい]すれば[訴訟|そしょう]の[危険|きけん]は[下|さ]がります。', 'Disclosing lowers the risk of lawsuits.'), L('[数字|すうじ]は[正直|しょうじき]に[出|だ]してください。', 'Publish honest numbers.')],
    audit: [L('[試運転|しうんてん]の[記録|きろく]を[確認|かくにん]します。', 'I\'ll check the commissioning records.'), L('[出荷便|しゅっかびん]二つと[発電|はつでん]の[記録|きろく]が[要|い]ります。', 'I need two shipment runs and a power record.')] },
  cap: {
    union: [L('[生産|せいさん]を[減|へ]らすと[残業|ざんぎょう]も[減|へ]る。[悪|わる]くない。', 'Less output, less overtime. Not bad.'), L('[賃金|ちんぎん]が[下|さ]がらないなら、[文句|もんく]はない。', 'As long as wages don\'t drop, no complaints.')],
    civic: [L('[上限|じょうげん]は[分|わ]かりやすいです。', 'A cap is easy to understand.'), L('[守|まも]られているか、[毎回|まいかい][確|たし]かめます。', 'We\'ll check every time that it holds.')],
    ops: [L('[能力|のうりょく]を[捨|す]てるのか。[反対|はんたい]だ。', 'Throwing capacity away? I\'m against it.'), L('[一時的|いちじてき]なら[我慢|がまん]する。', 'If it\'s temporary, I can live with it.')],
    chair: [L('[慎重|しんちょう]で[妥当|だとう]です。', 'Careful and reasonable.'), L('[財務|ざいむ]が[納得|なっとく]すれば[通|とお]ります。', 'It passes if finance is convinced.')],
    fin: [L('[売上|うりあげ]が[減|へ]ります。[反対|はんたい]です。', 'Sales fall. I\'m against.'), L('[環境|かんきょう][表示|ひょうじ]で[高|たか]く[売|う]れるなら[話|はなし]は[別|べつ]です。', 'If a clean label lets us sell higher, that changes things.')],
    legal: [L('[上限|じょうげん]は[契約|けいやく]に[書|か]けます。', 'A cap can be written into a contract.'), L('[期限|きげん]は三[回|かい]の[訪問|ほうもん]です。', 'The term is three attended visits.')],
    audit: [L('[生産量|せいさんりょう]を[毎時|まいじ][記録|きろく]します。', 'I\'ll log the output every hour.'), L('[上限|じょうげん]は[自動|じどう]で[守|まも]られます。', 'The cap enforces itself.')] },
  delay: {
    union: [L('[仕事|しごと]が[減|へ]らないなら、それでいい。', 'If no jobs are lost, fine.'), L('…でも[煙|けむり]は[俺|おれ]たちも[吸|す]う。', '…but we breathe the smoke too.')],
    civic: [L('[隠|かく]すのですか。[反対|はんたい]です。', 'You\'re hiding it? I\'m against.'), L('[公表|こうひょう]した[上限|じょうげん]を一[度|ど]でも[破|やぶ]れば、[記者|きしゃ]が[書|か]きます。', 'Break the published cap once and the reporter writes.')],
    ops: [L('[生産|せいさん]を[止|と]めずに[済|す]む。[賛成|さんせい]だ。', 'We keep producing. I\'m for it.'), L('[工場|こうじょう]の[出荷|しゅっか]は一[回|かい]六[個|こ]までだ。', 'Factory shifts ship six at most.')],
    chair: [L('[危|あぶ]ない[賭|か]けです。', 'A risky bet.'), L('[違反|いはん]があれば[審査|しんさ]になります。', 'A breach means a review.')],
    fin: [L('[現金|げんきん]は[守|まも]れます。[賛成|さんせい]です。', 'The cash is safe. Yes.'), L('[費用|ひよう]はかかりません。[今|いま]は。', 'It costs nothing. For now.')],
    legal: [L('[公表|こうひょう]を[遅|おく]らせても[違法|いほう]ではありません。', 'Delaying disclosure isn\'t illegal.'), L('ただし[公表|こうひょう]した[上限|じょうげん]は[約束|やくそく]です。', 'But the published cap is a promise.')],
    audit: [L('[出荷|しゅっか]を一[便|びん]ずつ[数|かぞ]えます。', 'I\'ll count every shipment.'), L('六[個|こ]を[超|こ]えた[瞬間|しゅんかん]に[記録|きろく]します。', 'The moment one goes over six, I record it.')] },
  defer: {
    union: [L('[急|いそ]がないなら、[文句|もんく]はない。', 'If you\'re not rushing, no complaints.'), L('[延期|えんき]なら[俺|おれ]たちは[動|うご]かない。', 'If it\'s postponed, we don\'t move.')],
    civic: [L('[急|いそ]がない[方|ほう]がいいです。', 'Better not to rush.'), L('[延期|えんき]に[賛成|さんせい]します。', 'I support postponing.')],
    ops: [L('一[季節|きせつ]を[失|うしな]う。[反対|はんたい]だ。', 'We lose a season. I\'m against.'), L('四[便|びん]の[試験|しけん]なら[我慢|がまん]する。', 'A four-run test, I can live with.')],
    chair: [L('[慎重|しんちょう]な[判断|はんだん]です。', 'A cautious call.'), L('[次|つぎ]の[訪問|ほうもん]で[試験目標|しけんもくひょう]を[出|だ]します。', 'I\'ll set a pilot objective at your next visit.')],
    fin: [L('[現金|げんきん]が[残|のこ]ります。[賛成|さんせい]です。', 'The cash stays. Yes.'), L('[何|なに]も[払|はら]いません。', 'Nothing gets paid.')],
    legal: [L('[延期|えんき]には[義務|ぎむ]がありません。', 'Postponing creates no obligation.'), L('いつでも[戻|もど]れます。', 'You can always come back.')],
    audit: [L('[確認|かくにん]するものはありません。', 'There\'s nothing for me to check.'), L('[試験|しけん]が[始|はじ]まれば[数|かぞ]えます。', 'Once the trial starts, I\'ll count.')] } };
/* answers at the desk when terms are offered */
export const REPLY = {
  retrain: {
    capacity: L('六[人|にん]は[無理|むり]だ、と[黒田|くろだ]が[言|い]っている。[研修|けんしゅう]の[枠|わく]は四[人分|にんぶん]だ。', 'Kuroda says six can\'t be done. There are four training places.'),
    safety: L('[金|かね]で[安全|あんぜん]は[買|か]えない。[整備|せいび]の[当番|とうばん]を[組合|くみあい]に[残|のこ]せ。', 'Money doesn\'t buy safety. Leave the maintenance shift to the union.'),
    countered: L('いいだろう。ただし、[次|つぎ]の[欠員|けついん]二つは[組合員|くみあいいん]を[優先|ゆうせん]しろ。', 'Fine. But our members get first refusal on the next two openings.'),
    agreed: L('これなら[署名|しょめい]できる。', 'This I can sign.'), grudging: L('…[仕方|しかた]ない。[覚|おぼ]えておくぞ。', '…Fine. I\'ll remember this.') },
  inspect: { agreed: L('[結構|けっこう]です。[検査|けんさ]は六[便|びん]の[後|あと]に[行|おこな]います。', 'Good. The inspection will follow six shipment runs.') },
  report: { agreed: L('ありがとうございます。[報告|ほうこく]は[放送局|ほうそうきょく]で[流|なが]してください。', 'Thank you. Put the report out through the broadcast station.') },
  grid: { agreed: L('[発電所|はつでんしょ]の[枠|わく]で[試運転|しうんてん]する。それなら[乗|の]る。', 'We commission in a Power window. Then I\'m in.') },
  premium: { agreed: L('[環境|かんきょう][表示|ひょうじ]で一[割|わり][高|たか]く[売|う]れます。[賛成|さんせい]しましょう。', 'A clean label sells ten percent higher. I\'ll vote yes.') },
  stage: { agreed: L('二[段階|だんかい]にしましょう。三[便|びん]の[後|あと]に[全出力|ぜんしゅつりょく]です。', 'Two stages, then. Full output after three runs.') } };
export const SAY = {
  noCase: L('[今|いま]は[議題|ぎだい]がありません。', 'Nothing on the agenda right now.'),
  vote: { yes: L('[賛成|さんせい]します。', 'I vote yes.'), no: L('[反対|はんたい]です。', 'I vote no.'), abs: L('[棄権|きけん]します。', 'I abstain.') },
  signed: L('[署名|しょめい]しました。[約束|やくそく]は[記録|きろく]されます。', 'Signed. The promise goes on the record.'),
  broken: L('[約束|やくそく]が[守|まも]られていない。[忘|わす]れないぞ。', 'The promise wasn\'t kept. We won\'t forget.'),
  kept: L('[約束|やくそく]は[守|まも]られた。[次|つぎ]も[話|はな]そう。', 'The promise was kept. Let\'s talk again.'),
  routine: L('[決裁|けっさい]をお[願|ねが]いします。', 'A decision, please.') };
