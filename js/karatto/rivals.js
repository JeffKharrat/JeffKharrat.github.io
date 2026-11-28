/* 紅葉重工 vs the rival megacorporations. Each rival has an AI, a treasury, a defense level, a grudge against you and
   what you know of it (intel). You attack them in 侵入 (the intrusion game, g-hack.js): money and Data buy the run and
   its tools, kanji are the exploits. They answer, bounded: on an attended visit only, at most one act per visit and
   two a week, never deleting a certified word (a breach only marks words compromised, as before).
   Pure logic, no DOM. Saved in save.riv. */
import { book, log, weekStart } from './sim.js?v=21';
import { govOf, price, refRate, visitHooks } from './gov.js?v=21';

const H = 3600e3, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const RIVALS = {
  kurogane: { corp: '黒鉄重工', en: 'KUROGANE HEAVY INDUSTRIES', ai: '玄武', air: 'げんぶ', aien: 'GENBU', col: '#FF3B30', def0: 3,
    style: 'Heavy iron: thick firewalls, a slow trace, hunters sent down your path.', trace: .8, hunt: 1.4, patch: .6 },
  shirasagi: { corp: '白鷺HD', en: 'SHIRASAGI HOLDINGS', ai: '白夜', air: 'びゃくや', aien: 'BYAKUYA', col: '#DDE6F0', def0: 2,
    style: 'White heron: few walls, a fast trace, nodes patched behind your back.', trace: 1.3, hunt: .6, patch: 1.4 } };
export const IDS = Object.keys(RIVALS);
export const byCorp = n => IDS.find(k => RIVALS[k].corp === n);

export function rivOf(save) {
  const R = save.riv || (save.riv = {});
  if ((R.v || 0) < 1) Object.assign(R, { v: 1, fw: 0, log: [], wk: { w: 0, n: 0 }, lastV: 0,
    r: Object.fromEntries(IDS.map(k => [k, { cash: 0, def: RIVALS[k].def0, grudge: 10, intel: 0, cores: 0, raids: 0, won: 0, last: null }])) });
  return R;
}
function note(R, t) { R.log.push(t); if (R.log.length > 40) R.log.splice(0, R.log.length - 40); }
/* what a rival is worth: its treasury follows your own scale (the reference rate), so the loot stays meaningful at every tier */
export function refOf(save, ctx) { return refRate(save.sim, ctx); }
export const defOf = (save, k, ctx) => { const r = rivOf(save).r[k]; return clamp(r.def + Math.max(0, ctx.tier) - Math.floor(r.intel / 34), 1, 9); };

/* ---------------- a run's price list ---------------- */
export function costs(save, k, ctx) {
  const p = price(refOf(save, ctx)), d = defOf(save, k, ctx);
  return { entry: p(1.5 + d * .5), proxy: p(2), zero: 40 + d * 15, decoy: 30, p };
}
export const TOOLS = { proxy: ['代理経路', 'Proxy chain', '¥', 'Trace −25% at once (F2).'], zero: ['ゼロデイ', 'Zero-day', 'DATA', 'Breach the selected node outright, no answer (F1). No evidence.'], decoy: ['囮', 'Decoy', 'DATA', 'Every hunter goes back to the core (F3).'] };
/* can the run start: entry fee and the bought tools, above the reserve (gov.js spendable) */
export function canStart(save, k, ctx, kit, spendable) {
  const c = costs(save, k, ctx), yen = c.entry + kit.proxy * c.proxy, data = kit.zero * c.zero + kit.decoy * c.decoy;
  return { yen, data, ok: spendable >= yen && save.corp.data >= data, why: spendable < yen ? `Needs ¥${yen.toLocaleString()} above the reserve.` : save.corp.data < data ? `Needs ${data} Data.` : '' };
}
export function pay(save, k, ctx, kit) {
  const c = costs(save, k, ctx), yen = c.entry + kit.proxy * c.proxy, data = kit.zero * c.zero + kit.decoy * c.decoy;
  book(save.sim, save.corp, 'ev', -yen, `侵入準備 Intrusion into ${RIVALS[k].corp}: ¥${yen.toLocaleString()} (entry and proxies), ${data} Data (tools).`);
  save.corp.data -= data; return { yen, data };
}

/* ---------------- the result of a run ---------------- */
/* res: { nodes, vaults: n opened, core: bool, traced: bool, out: bool (jacked out) } → loot, grudge, intel */
export function lootOf(save, k, ctx, res) {
  const r = rivOf(save).r[k], p = price(refOf(save, ctx)), cash = r.cash || refOf(save, ctx) * 60;
  const vy = Math.round(Math.min(cash * .03, p(3)) / 10) * 10, cy = Math.round(Math.min(cash * .08, p(14)) / 10) * 10;
  return { yen: res.vaults * vy + (res.core ? cy : 0), data: res.vaults * 25 + (res.core ? 150 : 0) + res.nodes * 4 };
}
export function settleRaid(save, k, ctx, res, bookYen = true) {
  const R = rivOf(save), r = R.r[k], S = save.sim; if (!r.cash) r.cash = refOf(save, ctx) * 60;
  const { yen, data } = lootOf(save, k, ctx, res);
  r.cash = Math.max(0, r.cash - yen); r.raids++; r.vaults = (r.vaults || 0) + (res.vaults || 0); r.last = { t: S.t, ...res, yen, data };
  r.intel = clamp(r.intel + res.nodes * 2 + (res.core ? 25 : 0), 0, 100);
  r.grudge = clamp(r.grudge + 8 + res.nodes + (res.core ? 25 : 0) + (res.traced ? 12 : 0), 0, 100);
  if (res.core) { r.cores++; r.won++; r.def = clamp(r.def + 1, 1, 9); }                  // they harden after a core breach
  save.corp.data += data; if (yen && bookYen) book(S, save.corp, 'ev', yen);
  if (res.traced) R.pending = { k, v: govOf(save).visit.n + 1 };                            // traced: they know where you live
  const t = res.core ? `中枢侵害 Core breach at ${RIVALS[k].corp}: ¥${yen.toLocaleString()} and ${data} Data taken.` : res.traced ? `逆探知 Traced by ${RIVALS[k].ai}: disconnected after ${res.nodes} nodes. Expect an answer.` : `侵入 ${res.nodes} nodes into ${RIVALS[k].corp}: ¥${yen.toLocaleString()}, ${data} Data.`;
  note(R, { t: S.t, k, txt: t }); log(S, 'rival', t);
  return { yen, data };
}

/* ---------------- between runs: the rivals live, and answer ---------------- */
export const ACTS = {
  breach: ['侵入', 'Breach', 'Their AI attacks your memory: defend it in 保安部 Security within two visits.'],
  sabotage: ['送電妨害', 'Grid sabotage', '−30 MW for 12 hours.'],
  pricewar: ['価格戦争', 'Price war', 'Your sale price −15% for 24 hours.'] };
/* on each attended visit (called from gov.visit's caller): treasuries grow, grudges cool, and maybe one answer */
export function rivalsVisit(save, ctx) {
  const R = rivOf(save), S = save.sim, G = govOf(save); if (!S || S.v !== 2 || R.lastV === G.visit.n) return null;
  R.lastV = G.visit.n; const ref = refOf(save, ctx), wk = weekStart(S.t); if (R.wk.w !== wk) R.wk = { w: wk, n: 0 };
  for (const k of IDS) { const r = R.r[k]; r.cash = Math.min(ref * 400, (r.cash || ref * 60) + ref * 18); r.grudge = clamp(r.grudge - 6, 0, 100); r.intel = clamp(r.intel - 3, 0, 100); }
  if (ctx.tier < 0 || R.wk.n >= 2) return null;
  /* the angriest rival, if any, answers: chance from its grudge, less behind your firewall; a trace makes it certain */
  const k = R.pending && R.pending.v <= G.visit.n ? R.pending.k : IDS.slice().sort((a, b) => R.r[b].grudge - R.r[a].grudge)[0];
  const r = R.r[k], roll = ((Math.sin(S.t / H * 3.7 + G.visit.n * 11.3) * 43758.5) % 1 + 1) % 1;
  const p = R.pending && R.pending.k === k ? 1 : (r.grudge / 100) * (1 - R.fw * .15);
  R.pending = null; if (roll > p) return null;
  const kind = r.grudge > 70 && !(S.breach && S.breach.open) && (S.breach ? S.breach.n : 0) < 2 ? 'breach' : roll < p / 2 ? 'sabotage' : 'pricewar';
  if (kind === 'breach') { S.breach = S.breach || { wk, n: 0 }; S.breach.open = { t: S.t, rival: RIVALS[k].corp, v0: G.visit.n }; S.breach.n++; }
  if (kind === 'sabotage') S.sab = { until: S.t + 12 * H, mw: 30, by: k };
  if (kind === 'pricewar') S.pw = { until: S.t + 24 * H, k: .85, by: k };
  R.wk.n++; r.grudge = clamp(r.grudge - 20, 0, 100);
  const t = `報復 ${RIVALS[k].corp} (${RIVALS[k].ai}): ${ACTS[kind][1]}. ${ACTS[kind][2]}`; note(R, { t: S.t, k, txt: t }); log(S, 'rival', t);
  return { k, kind };
}
/* your own firewall: the money sink. Each level costs more and makes their answers rarer */
export const fwCost = (save, ctx) => price(refOf(save, ctx))(12 * (rivOf(save).fw + 1));
export function buyFirewall(save, ctx, spendable) {
  const R = rivOf(save), c = fwCost(save, ctx); if (R.fw >= 5 || spendable < c) return false;
  book(save.sim, save.corp, 'cap', -c, `防壁 Firewall level ${R.fw + 1}: ¥${c.toLocaleString()}.`); R.fw++; return true;
}

visitHooks.push(rivalsVisit);

/* ---------------- the rivals inside the other buildings (Logistics, the Great Factory) ---------------- */
const L = (jp, en) => ({ jp, en });
export const LINES = {
  kurogane: { snatch: L('[遅|おそ]い。この[荷|に]は[黒鉄|くろがね]がもらう。', 'Too slow. Kurogane takes this load.'), lead: L('[鉄|てつ]の[速度|そくど]についてこられるか。', 'Can you keep up with iron?'),
    behind: L('…[今|いま]だけだ。', '…Only for now.'), undercut: L('[値段|ねだん]を[下|さ]げた。[客|きゃく]はこちらに[来|く]る。', 'I cut the price. The customers come to us.'),
    win: L('[契約|けいやく]は[黒鉄|くろがね]のものだ。', 'The contract belongs to Kurogane.'), lose: L('[今回|こんかい]は[譲|ゆず]ろう。', 'This time, I yield.'), hello: L('[同|おな]じ[客|きゃく]を[狙|ねら]っている。[覚悟|かくご]しろ。', 'We want the same customers. Be ready.') },
  shirasagi: { snatch: L('お[先|さき]に[失礼|しつれい]します。', 'Pardon me for going first.'), lead: L('[追|お]いつけますか。', 'Can you catch up?'),
    behind: L('[計算|けいさん]どおりです。まだ。', 'As calculated. For now.'), undercut: L('[白鷺|しらさぎ]は[一割|いちわり][安|やす]くしました。', 'Shirasagi went ten percent cheaper.'),
    win: L('[契約|けいやく]は[白鷺|しらさぎ]が[頂|いただ]きました。', 'Shirasagi has taken the contract.'), lose: L('[今回|こんかい]は[負|ま]けを[認|みと]めます。', 'This time I concede.'), hello: L('[同|おな]じ[配送先|はいそうさき]ですね。どうぞお[先|さき]に…[行|い]ければ。', 'The same destinations, I see. After you… if you can.') } };
export const rubyHTML = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/\[([^|\]]+)\|([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>');
/* which rival shows up in a building: they take turns */
export const pickRival = n => IDS[(n || 0) % IDS.length];
/* the result of a contest in a building: you learn about them (intel), they resent losing (grudge) */
export function matchResult(save, k, won, what) {
  const R = rivOf(save), r = R.r[k], S = save.sim; if (!S || S.v !== 2) return;
  r.intel = clamp(r.intel + 3, 0, 100); if (won) r.grudge = clamp(r.grudge + 3, 0, 100); else r.cash = (r.cash || 0) + 200;
  r.match = (r.match || 0) + 1; r.mwon = (r.mwon || 0) + (won ? 1 : 0);
  note(R, { t: S.t, k, txt: `${what}: ${won ? 'won against' : 'lost to'} ${RIVALS[k].corp}.` });
}
export const rivalDef = (save, k, ctx) => (save.sim && save.sim.v === 2 && ctx ? defOf(save, k, ctx) : 3);
