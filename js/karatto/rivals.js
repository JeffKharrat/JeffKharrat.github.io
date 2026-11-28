/* 紅葉重工 vs the rival megacorporations: opponents in the minigames. Their AIs race you in Logistics and the Great
   Factory, and you break into their networks in 侵入 (the intrusion game, g-hack.js), where kanji are the exploits.
   No money: a run is free; a core breach makes them harder next time. Pure logic, no DOM. Saved in save.riv. */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const RIVALS = {
  kurogane: { corp: '黒鉄重工', en: 'KUROGANE HEAVY INDUSTRIES', ai: '玄武', air: 'げんぶ', aien: 'GENBU', col: '#FF3B30', def0: 3,
    style: 'Heavy iron: thick firewalls, a slow trace, hunters sent down your path.', trace: .8, hunt: 1.4, patch: .6 },
  shirasagi: { corp: '白鷺HD', en: 'SHIRASAGI HOLDINGS', ai: '白夜', air: 'びゃくや', aien: 'BYAKUYA', col: '#DDE6F0', def0: 2,
    style: 'White heron: few walls, a fast trace, nodes patched behind your back.', trace: 1.3, hunt: .6, patch: 1.4 } };
export const IDS = Object.keys(RIVALS);
export function rivOf(save) {
  const R = save.riv || (save.riv = {});
  if ((R.v || 0) < 1) Object.assign(R, { v: 1, log: [], r: {} });
  for (const k of IDS) R.r[k] = Object.assign({ def: RIVALS[k].def0, intel: 0, cores: 0, raids: 0, won: 0, last: null, match: 0, mwon: 0 }, R.r[k] || {});
  return R;
}
function note(R, t) { R.log.push(t); if (R.log.length > 40) R.log.splice(0, R.log.length - 40); }
/* how hard a rival is: its own level, your tier, less what you have learned about it */
export const defOf = (save, k, ctx) => { const r = rivOf(save).r[k]; return clamp(r.def + Math.max(0, (ctx && ctx.tier) || 0) - Math.floor(r.intel / 34), 1, 9); };
export const TOOLS = { proxy: ['代理経路', 'Proxy chain', '', 'Trace −25% at once (F2).'], zero: ['ゼロデイ', 'Zero-day', '', 'Breach the selected node outright, no answer (F1). No evidence.'], decoy: ['囮', 'Decoy', '', 'Every hunter goes back to the core (F3).'] };
/* a run's result: you learn their network (intel); a core breach hardens them */
export function settleRaid(save, k, ctx, res) {
  const R = rivOf(save), r = R.r[k];
  r.raids++; r.last = { t: Date.now(), ...res };
  r.intel = clamp(r.intel + res.nodes * 2 + (res.core ? 25 : 0), 0, 100);
  if (res.core) { r.cores++; r.won++; r.def = clamp(r.def + 1, 1, 9); }
  note(R, { t: Date.now(), k, txt: res.core ? `中枢侵害 Core breach at ${RIVALS[k].corp}.` : res.traced ? `逆探知 Traced by ${RIVALS[k].ai} after ${res.nodes} nodes.` : `侵入 ${res.nodes} nodes into ${RIVALS[k].corp}.` });
}
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
  const R = rivOf(save), r = R.r[k];
  r.intel = clamp(r.intel + 3, 0, 100); r.match++; r.mwon += won ? 1 : 0;
  note(R, { t: Date.now(), k, txt: `${what}: ${won ? 'won against' : 'lost to'} ${RIVALS[k].corp}.` });
}
export const rivalDef = (save, k, ctx) => defOf(save, k, ctx);
