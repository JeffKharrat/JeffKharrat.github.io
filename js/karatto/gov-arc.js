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
    contract: () => ({ metric: 'shipment runs before full output', qty: 3, funding: 'none', to: 'finance', deadline: 'automatic', remedy: '—' }) } };

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
  stage: { agreed: L('二[段階|だんかい]にしましょう。三[便|びん]の[後|あと]に[全出力|ぜんしゅつりょく]です。', 'Two stages, then. Full output after three runs.') } };
export const SAY = {
  noCase: L('[今|いま]は[議題|ぎだい]がありません。', 'Nothing on the agenda right now.'),
  vote: { yes: L('[賛成|さんせい]します。', 'I vote yes.'), no: L('[反対|はんたい]です。', 'I vote no.'), abs: L('[棄権|きけん]します。', 'I abstain.') },
  signed: L('[署名|しょめい]しました。[約束|やくそく]は[記録|きろく]されます。', 'Signed. The promise goes on the record.'),
  broken: L('[約束|やくそく]が[守|まも]られていない。[忘|わす]れないぞ。', 'The promise wasn\'t kept. We won\'t forget.'),
  kept: L('[約束|やくそく]は[守|まも]られた。[次|つぎ]も[話|はな]そう。', 'The promise was kept. Let\'s talk again.'),
  routine: L('[決裁|けっさい]をお[願|ねが]いします。', 'A decision, please.') };
