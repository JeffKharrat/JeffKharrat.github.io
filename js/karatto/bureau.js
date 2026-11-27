/* カラット: 派閥 · the live Factions bureau, inside 経営 (Management). A staffed negotiation counter: seven people
   along the rear lip of the counter (the bureau pack), the AI on this side of it. Talk to one, discuss terms, carry a
   draft from desk to desk, ask the chair for a hearing. The room is a picture with three layers (wall, people, the
   counter in front of them) and a gentle pointer parallax; everything said is Japanese first, with furigana and the
   English underneath. The logic is gov.js; this file only draws it and sends the player's actions there. */
import { EVENTS, resolve, POL, FAC, capacity, LEDGER } from './sim.js?v=10';
import * as gov from './gov.js?v=10';
import { AUTH, STANCE, REPLY, SAY, need, mood } from './gov-arc.js?v=10';
import { ICON } from './icons.js?v=10';
import { leafSVG } from './leaf.js?v=10';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const yen = v => (v < 0 ? '−¥' : '¥') + Math.abs(Math.round(v)).toLocaleString();
const rb = s => esc(s).replace(/\[([^|\]]+)\|([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>');
const IMG = k => `bureau/${gov.CAST[k].img === 'board' ? 'board' : gov.CAST[k].img}.webp`;
const VOTE = { yes: ['賛成', 'YES', 'y'], no: ['反対', 'NO', 'r'], abs: ['棄権', 'ABSTAIN', 'm'] };
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const CSS = `
#mg .bur { position:absolute; inset:0; overflow:hidden; background:#16181D; border:1px solid var(--line2); }
#mg .bur .lay { position:absolute; left:0; top:-30px; width:1240px; height:698px; pointer-events:none; transition:transform .25s ease-out; }
#mg .bur .lay img { width:100%; height:100%; display:block; image-rendering:pixelated; }
#mg .bur .desk { clip-path:polygon(0 66%,10% 66%,12% 58.6%,88% 58.6%,89% 66%,100% 66%,100% 100%,0 100%); }
#mg .bur .cast { position:absolute; left:161px; top:-30px; width:918px; height:698px; pointer-events:none; transition:transform .25s ease-out; }
#mg .bur .rep { position:absolute; bottom:${698 - 401}px; width:131px; height:164px; pointer-events:auto; cursor:pointer; background:none; border:0; padding:0; }
#mg .bur .rep img { width:131px; height:164px; object-fit:contain; object-position:bottom; image-rendering:pixelated; display:block; animation:bBr 5.2s ease-in-out infinite; filter:drop-shadow(0 3px 0 rgba(0,0,0,.35)); }
#mg .bur .rep:nth-child(2n) img { animation-delay:-1.7s; } #mg .bur .rep:nth-child(3n) img { animation-delay:-3.1s; }
@keyframes bBr { 0%,100% { transform:translateY(0); } 50% { transform:translateY(1px); } }
#mg .bur .rep:hover img, #mg .bur .rep.sel img, #mg .bur .rep:focus-visible img { filter:drop-shadow(0 0 0 #FFE600) drop-shadow(1px 0 0 #FFE600) drop-shadow(-1px 0 0 #FFE600) drop-shadow(0 -1px 0 #FFE600); }
#mg .bur .rep:focus-visible { outline:none; }
#mg .bur .chip { position:absolute; left:50%; top:-24px; transform:translateX(-50%); font:700 9.5px var(--mono); letter-spacing:.1em; padding:2px 6px; white-space:nowrap; background:#0A0B0D; border:1px solid var(--line2); color:var(--mute); }
#mg .bur .chip.y { background:var(--y); color:#000; border-color:var(--y); } #mg .bur .chip.r { background:var(--red); color:#fff; border-color:var(--red); }
#mg .bur .dot { position:absolute; right:14px; top:8px; width:9px; height:9px; background:var(--y); box-shadow:0 0 0 2px #000; animation:bDot 1.1s steps(2) infinite; }
@keyframes bDot { 50% { opacity:.2; } }
#mg .bur .plate { position:absolute; top:${401 - 30 + 4}px; width:131px; text-align:center; pointer-events:none; }
#mg .bur .plate span { display:inline-block; background:#0C0D10; border:1px solid #3A3F48; padding:1px 6px 2px; font:500 11px var(--kj); color:#ECEEF2; }
#mg .bur .plate small { display:table; margin-left:auto; margin-right:auto; font:700 7.5px var(--mono); letter-spacing:.1em; color:#C9CDD6; margin-top:2px; text-transform:uppercase; background:rgba(8,9,11,.85); padding:1px 4px; max-width:129px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#mg .bur .pn { position:absolute; background:rgba(5,6,8,.9); border:1px solid var(--line2); clip-path:polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%); }
#mg .bur .pn .ph { display:flex; justify-content:space-between; gap:8px; padding:5px 10px; border-bottom:1px solid var(--line); font:700 9px var(--mono); letter-spacing:.16em; color:var(--mute); }
#mg .bur .pn .ph b { color:#000; background:var(--y); padding:1px 5px; }
#mg .bur .pn .in { padding:7px 10px; font-size:11px; }
#mg .bur .case { display:block; width:100%; text-align:left; background:#0E0F0A; border:1px solid #5A5320; color:var(--ink); padding:6px 8px; cursor:pointer; font:500 11px var(--mono); margin-bottom:5px; }
#mg .bur .case:hover { border-color:var(--y); } #mg .bur .case b { font:600 14px var(--kj); margin-right:6px; }
#mg .bur .rt { display:flex; gap:6px; align-items:center; padding:3px 0; border-bottom:1px solid #121418; cursor:pointer; } #mg .bur .rt:hover { color:var(--y); }
#mg .bur .rt i { width:7px; height:7px; background:var(--y); flex:none; }
#mg .bur .ob { padding:3px 0; border-bottom:1px solid #121418; display:grid; grid-template-columns:1fr auto; gap:6px; }
#mg .bur .ob .kj { font-size:12px; } #mg .bur .ob .k { color:var(--ok); } #mg .bur .ob .x { color:var(--red); }
#mg .bur .roster { position:absolute; left:250px; right:250px; bottom:8px; display:flex; gap:4px; }
#mg .bur .roster button { flex:1; background:rgba(5,6,8,.88); border:1px solid var(--line2); color:var(--ink); padding:4px 2px; cursor:pointer; font:500 11px var(--kj); }
#mg .bur .roster button small { display:block; font:700 8px var(--mono); color:var(--mute); letter-spacing:.08em; }
#mg .bur .roster button.sel, #mg .bur .roster button:hover { border-color:var(--y); }
#mg .bur .hint { position:absolute; left:250px; right:250px; bottom:52px; text-align:center; font:700 9px var(--mono); letter-spacing:.14em; color:#B8BCC6; text-shadow:0 1px 0 #000; }
#mg .bur .lamp { position:absolute; width:10px; height:10px; border-radius:50%; background:var(--red); box-shadow:0 0 10px 3px rgba(255,59,48,.6); animation:bDot .8s steps(2) infinite; }
#mg .bur .stamp { position:absolute; transform:rotate(-12deg); border:2px solid var(--red); color:var(--red); font:700 13px var(--kj); padding:1px 6px; background:rgba(0,0,0,.15); }
#mg .bur .fr { position:absolute; display:flex; gap:3px; }
#mg .bur .fr s { width:16px; height:12px; background:#C9A400; border:1px solid #000; }
#mg .bur .flash { position:absolute; left:50%; top:14px; max-width:600px; overflow:hidden; text-overflow:ellipsis; transform:translateX(-50%); background:var(--y); color:#000; padding:7px 16px; font:700 11px var(--mono); letter-spacing:.1em; white-space:nowrap; animation:mgIn .3s both; }
#mg .bur .flash b { font:600 16px var(--kj); margin-right:10px; letter-spacing:0; } #mg .bur .flash.r { background:var(--red); color:#fff; }
/* the conversation */
#mg .bur .shade { position:absolute; inset:0; background:rgba(3,3,4,.82); }
#mg .bur .tk { position:absolute; inset:0; }
#mg .bur .por { position:absolute; left:12px; top:12px; width:330px; bottom:12px; }
#mg .bur .por .pic { position:absolute; left:15px; top:44px; width:300px; height:375px; background:linear-gradient(#20232A, #0B0C0F); border:1px solid var(--line2); }
#mg .bur .por .pic img { width:100%; height:100%; image-rendering:pixelated; object-fit:contain; object-position:bottom; }
#mg .bur .por .nm { position:absolute; left:15px; right:15px; top:428px; }
#mg .bur .por .nm .kj { font-size:22px; } #mg .bur .por .nm ruby rt { font-size:10px; }
#mg .bur .tr { position:absolute; left:354px; right:12px; top:12px; height:318px; }
#mg .bur .tr .in { height:286px; overflow:auto; }
#mg .bur .ln { padding:7px 4px 8px; border-bottom:1px solid #15171B; }
#mg .bur .ln .jp { font:500 18px/2 var(--kj); } #mg .bur ruby { ruby-align:center; } #mg .bur .ln ruby rt { font:500 9px/1 var(--kj); letter-spacing:-.06em; color:#B8BCC6; }
#mg .bur .ln .en { color:#9AA0AB; font-size:11.5px; margin-top:-2px; }
#mg .bur .ln.me .jp { color:var(--y); font-size:15px; line-height:1.9; } #mg .bur .ln.me .en { color:#B8A800; }
#mg .bur .ln.sys .jp { font:700 10px var(--mono); letter-spacing:.12em; color:var(--mute); line-height:1.4; }
#mg .bur .acts { position:absolute; left:354px; right:12px; top:340px; bottom:12px; }
#mg .bur .acts .in { display:grid; grid-template-columns:1fr 1fr; gap:5px; height:calc(100% - 27px); overflow:auto; align-content:start; }
#mg .bur .act { display:flex; gap:8px; align-items:center; text-align:left; background:#0B0C0E; border:1px solid var(--line2); color:var(--ink); padding:5px 9px; cursor:pointer; font:500 11px var(--mono); }
#mg .bur .act b { font:600 14px var(--kj); } #mg .bur .act small { color:var(--mute); display:block; }
#mg .bur .act:hover:not(:disabled) { border-color:var(--y); } #mg .bur .act:disabled { opacity:.35; cursor:not-allowed; }
#mg .bur .act.y { border-color:#5A5320; } #mg .bur .act.full { grid-column:1 / -1; }
#mg .bur .terms { grid-column:1 / -1; display:grid; grid-template-columns:120px 1fr; gap:6px 10px; align-items:center; padding:6px 4px; border:1px solid var(--line); }
#mg .bur .terms .seg button { padding:3px 8px; } #mg .bur .terms .seg button b { font-size:13px; }
/* the hearing */
#mg .bur .hr { position:absolute; inset:0; background:rgba(3,3,4,.94); }
#mg .bur .hl { position:absolute; left:12px; top:12px; width:600px; bottom:12px; overflow:auto; }
#mg .bur .hr .jpb { font:500 19px/2.1 var(--kj); } #mg .bur .hr ruby rt { font:500 9.5px/1 var(--kj); letter-spacing:-.06em; color:#B8BCC6; }
#mg .bur .chk { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:8px 0; }
#mg .bur .mot { display:block; width:100%; text-align:left; background:#0B0C0E; border:1px solid var(--line2); color:var(--ink); padding:7px 10px; cursor:pointer; font:500 11px var(--mono); margin-bottom:5px; }
#mg .bur .mot.on { border-color:var(--y); background:#141308; } #mg .bur .mot b { font:600 15px var(--kj); margin-right:8px; } #mg .bur .mot small { display:block; color:#B8BCC6; margin-top:3px; }
#mg .bur .cl { display:inline-flex; gap:6px; align-items:center; border:1px solid var(--line2); padding:3px 7px; margin:0 5px 5px 0; font:500 11px var(--mono); }
#mg .bur .cl b { font:600 13px var(--kj); } #mg .bur .cl.ok { border-color:var(--ok); } #mg .bur .cl.gr { border-color:#C9A400; } #mg .bur .cl.no { border-color:var(--red); opacity:.6; }
#mg .bur .hs { position:absolute; left:624px; right:12px; top:12px; bottom:12px; overflow:auto; }
#mg .bur .seat { display:grid; grid-template-columns:44px 1fr 92px; gap:8px; align-items:center; padding:5px 0; border-bottom:1px solid #15171B; }
#mg .bur .seat img { width:44px; height:55px; object-fit:contain; object-position:bottom; image-rendering:pixelated; background:#121418; }
#mg .bur .seat .v { text-align:center; font:700 11px var(--mono); padding:4px 0; letter-spacing:.1em; } #mg .bur .seat .v b { display:block; font:600 15px var(--kj); letter-spacing:0; }
#mg .bur .seat .v.y { background:var(--y); color:#000; } #mg .bur .seat .v.r { background:var(--red); color:#fff; } #mg .bur .seat .v.m { border:1px solid var(--line2); color:var(--mute); }
#mg .bur .seat .pt { font:500 10.5px var(--mono); color:#B8BCC6; } #mg .bur .seat .pt i { font-style:normal; color:var(--ink); }
#mg .bur .tally { display:flex; gap:10px; align-items:center; margin:8px 0; font:700 22px var(--num); } #mg .bur .tally span { font:700 9px var(--mono); letter-spacing:.14em; color:var(--mute); }
#mg .bur .fcr { display:grid; grid-template-columns:repeat(4, 1fr); gap:5px; margin:6px 0; } #mg .bur .fcr div { border:1px solid var(--line); padding:4px 6px; } #mg .bur .fcr b { display:block; font:700 13px var(--num); }
#mg .bur .blk { color:var(--red); font-size:11px; padding:2px 0; }
#mg .bur .go { background:var(--y); color:#000; border:0; padding:9px 14px; font:700 11px var(--mono); letter-spacing:.08em; cursor:pointer; margin:4px 6px 0 0; }
#mg .bur .go:disabled { opacity:.35; cursor:not-allowed; } #mg .bur .go.r { background:var(--red); color:#fff; } #mg .bur .go.g { background:transparent; color:var(--ink); border:1px solid var(--line2); }
#mg .bur .res { margin:8px 0; padding:8px 10px; border:1px solid var(--line2); }
#mg .bur .res.pass { border-color:var(--y); } #mg .bur .res.fail { border-color:var(--red); }
@media (prefers-reduced-motion: reduce) { #mg .bur .rep img, #mg .bur .dot, #mg .bur .lamp { animation:none; } #mg .bur .lay, #mg .bur .cast { transition:none; } }
`;
function css() { if (!document.getElementById('bur-css')) { const st = document.createElement('style'); st.id = 'bur-css'; st.textContent = CSS; document.head.appendChild(st); } }

/* ---------------- state (on screen only; what matters is saved by gov.js) ---------------- */
let B = null;
export function bureau(body, M) {
  css();
  if (!B || B.M !== M) B = { M, view: 'room', sel: 3, talk: null, hear: null, logs: {} };
  B.body = body; draw();
}
export const bureauClose = () => { B = null; };
const save = () => B.M.c.save, ctx = () => B.M.c.ctx(), persist = () => B.M.c.persist();
const G = () => gov.govOf(save());
const theCase = () => { const I = gov.inbox(save(), ctx()); return I.major ? I.major : null; };
function draw() {
  const b = B.body; if (!b) return;
  b.innerHTML = `<div class="bur" tabindex="-1">${room()}${B.view === 'talk' ? talkView() : ''}${B.view === 'hear' ? hearView() : ''}</div>`;
  wire();
}

/* ---------------- the room ---------------- */
function room() {
  const s = save(), S = s.sim, X = ctx(), g = G(), I = gov.inbox(s, X), maj = I.major, C = maj && maj.C;
  const draft = C && C.st === 'm1' ? C.draft : null, T = draft ? gov.tally(s, X, draft) : null;
  const reps = gov.ORDER.map((k, i) => {
    const P = gov.CAST[k], role = gov.roleOf(k, X.tier), v = T && T.seats[k], has = repNews(k, I);
    const chip = v ? `<span class="chip ${VOTE[v.vote][2] === 'y' ? 'y' : VOTE[v.vote][2] === 'r' ? 'r' : ''}">${VOTE[v.vote][0]} ${VOTE[v.vote][1]}</span>` : P.seat ? '' : '<span class="chip">顧問 ADVISOR</span>';
    return `<button type="button" class="rep${B.sel === i ? ' sel' : ''}" data-r="${i}" style="left:${i * 131}px" aria-label="${esc(P.j)} · ${esc(role[1])}">${chip}${has ? '<i class="dot"></i>' : ''}<img alt="" src="${IMG(k)}" draggable="false"></button>`;
  }).join('');
  const plates = gov.ORDER.map((k, i) => { const P = gov.CAST[k], role = gov.roleOf(k, X.tier); return `<div class="plate" style="left:${161 + i * 131}px"><span>${esc(P.j)}</span><small>${esc(role[1])}</small></div>`; }).join('');
  /* the counter's inbox: one major case, two routine decisions, the rest as status */
  const inb = `<div class="pn" style="left:8px;top:8px;width:300px;height:176px"><div class="ph"><span><b>窓口</b> COUNTER · VISIT ${g.visit.n}</span><span>${I.routine.length + (maj ? 1 : 0)} OPEN</span></div><div class="in" style="height:146px;overflow:auto">
    ${maj ? `<button type="button" class="case" data-hear="1"><b>${esc(maj.m.title[0])}</b>${esc(maj.m.title[1])}<br><span class="lb">${maj.m.kind === 'vote' ? 'A VOTE · ASK THE CHAIR FOR A HEARING' : 'A MEETING · DECIDE AT THE HEARING'} · H</span></button>` : ''}
    ${I.routine.map(e => `<div class="rt" data-ev="${esc(e.id)}"><i></i><span class="kj">${EVENTS[e.k].j}</span><span class="lb">${esc(EVENTS[e.k].en)} · ${esc(gov.CAST[EVENTS[e.k].who].j)}</span></div>`).join('')}
    ${I.status.map(t => `<div class="lb" style="padding:3px 0;line-height:1.4;text-transform:none;letter-spacing:.04em">${esc(t)}</div>`).join('')}
    ${!maj && !I.routine.length && !I.status.length ? '<div class="lb" style="padding:6px 0">NOTHING ON THE COUNTER · TALK TO ANYONE</div>' : ''}</div></div>`;
  const obl = g.pledges.filter(p => p.st === 'open' || p.v >= g.visit.n - 3).slice(-6), esc0 = gov.escrowed(s), lots = (S.lots || []).filter(l => !l.done && !l.off);
  const ob = `<div class="pn" style="right:8px;top:8px;width:300px;height:176px"><div class="ph"><span><b>約束</b> OBLIGATIONS</span><span>ESCROW ${yen(esc0)}</span></div><div class="in" style="height:146px;overflow:auto">
    ${obl.map(p => `<div class="ob"><span><span class="kj">${esc(gov.CLAUSES[p.clause].j)}</span> <span class="lb">→ ${esc(gov.CAST[p.to].j)}</span></span><span class="${p.st === 'kept' ? 'k' : p.st === 'broken' ? 'x' : 'lb'}">${p.st === 'open' ? `DUE V${p.dueV}` : p.st === 'kept' ? '履行 KEPT' : p.cured ? '是正 CURED' : '違反 BROKEN'}</span></div>`).join('')}
    ${lots.map(l => `<div class="ob"><span><span class="kj">${esc(l.j || l.id)}</span> <span class="lb">${l.sent}/${l.qty} goods · ${esc(l.kind)}</span></span><span class="lb">HELD ${l.held}</span></div>`).join('')}
    ${(S.proj || []).map(p => `<div class="ob"><span class="kj">${esc(p.label)}</span><span class="lb">+${Math.round(p.robot * 100)}% · ¥${p.upkeep}/H</span></div>`).join('')}
    ${!obl.length && !lots.length && !(S.proj || []).length ? '<div class="lb" style="padding:6px 0">NO PROMISES ON RECORD YET</div>' : ''}
    <div class="lb" style="margin-top:6px">TRUST ${gov.SEATS.map(k => `${gov.CAST[k].j.split(' ')[0]} ${fmtT(g.trust[k])}`).join(' · ')}</div></div></div>`;
  /* the room's game-state signals: a stamped folder after a signature, the switchboard lamp in a grid emergency, freight queued in a hold */
  const stamp = g.sig.stamp === g.visit.n ? '<div class="stamp" style="left:92px;top:570px">承認済</div>' : g.sig.audit >= g.visit.n ? '<div class="stamp" style="left:92px;top:570px">監査中</div>' : '';
  const lamp = S.power < 0 || (S.hold && S.hold.until > S.t) ? '<div class="lamp" style="left:157px;top:476px" title="switchboard"></div>' : '';
  const fr = S.hold && S.hold.until > S.t ? `<div class="fr" style="left:1128px;top:452px" title="freight queued by the hold">${'<s></s>'.repeat(5)}</div>` : '';
  return `<div class="lay far"><img alt="The negotiations bureau: a records wall, the counter, a glass meeting room" src="bureau/room.webp" draggable="false"></div>
    ${B.flash ? `<div class="flash${B.flash.r ? ' r' : ''}"><b>${esc(B.flash.j)}</b>${esc(B.flash.en)}</div>` : ''}<div class="cast">${reps}</div><div class="lay desk near"><img alt="" src="bureau/room.webp" draggable="false"></div>${plates}${stamp}${lamp}${fr}${inb}${ob}
    <div class="hint">← → CHOOSE · ENTER TALK · H HEARING · 1–7 TABS</div>
    <div class="roster" role="list">${gov.ORDER.map((k, i) => `<button type="button" role="listitem" class="${B.sel === i ? 'sel' : ''}" data-r="${i}">${esc(gov.CAST[k].j)}<small>${esc(gov.roleOf(k, X.tier)[1].split(' ')[0])}</small></button>`).join('')}</div>`;
}
const fmtT = t => (t > 0 ? '+' : '') + Math.round(t || 0);
function repNews(k, I) { return I.routine.some(e => EVENTS[e.k].who === k) || (I.major && I.major.C.st === 'm1' && gov.CAST[k].seat && !I.major.C.said[k] && !(B.logs[k] || []).length); }

/* ---------------- a conversation ---------------- */
function talkView() {
  const k = B.talk.seat, P = gov.CAST[k], X = ctx(), g = G(), S = save().sim, role = gov.roleOf(k, X.tier);
  const fac = P.fac && S.fac[P.fac], lines = B.logs[k] || [];
  return `<div class="shade"></div><div class="tk">
    <div class="pn por"><div class="ph"><span><b>${k.toUpperCase()}</b> ${esc(role[1].toUpperCase())}</span><span>${P.seat ? 'VOTING SEAT' : 'NO VOTE'}</span></div>
      <div class="pic"><img alt="${esc(P.j)}" src="${IMG(k)}"></div>
      <div class="nm"><div class="kj"><ruby>${esc(P.j)}<rt>${esc(P.r)}</rt></ruby></div><div class="lb" style="margin:2px 0 8px">${esc(role[0])} · ${esc(role[1])}</div>
        <div class="lb">TRUST · 信頼 <b style="color:var(--ink);font:700 13px var(--num)">${fmtT(g.trust[k])}</b> / ±50${fac != null ? ` · APPROVAL <b style="color:${fac < 30 ? 'var(--red)' : 'var(--ink)'};font:700 13px var(--num)">${Math.round(fac)}</b>` : ''}</div>
        <div class="lb" style="margin-top:8px">BACKSPACE · ESC BACK TO THE ROOM</div></div></div>
    <div class="pn tr"><div class="ph"><span><b>記録</b> TRANSCRIPT</span><span>${esc(P.j)} · カラット</span></div><div class="in" id="bur-tr">${lines.map(lineHTML).join('') || '<div class="lb" style="padding:10px 4px">CHOOSE WHAT TO ASK BELOW</div>'}</div></div>
    <div class="pn acts"><div class="ph"><span><b>対話</b> ACTIONS</span><span>1–9</span></div><div class="in">${actsHTML(k)}</div></div></div>`;
}
const lineHTML = l => `<div class="ln ${l.who || ''}"><div class="jp${l.who === 'sys' ? '' : ' kj'}">${l.who === 'sys' ? esc(l.jp) : rb(l.jp)}</div>${l.en ? `<div class="en">${esc(l.en)}</div>` : ''}</div>`;
function say(k, L, who = 'them') { (B.logs[k] = B.logs[k] || []).push({ ...L, who }); }
function acts(k) {
  const s = save(), X = ctx(), S = s.sim, g = G(), I = gov.inbox(s, X), maj = I.major, C = maj && maj.C, out = [];
  const draft = C && C.st === 'm1' ? C.draft : null, M = draft && gov.MOTIONS[draft.motion];
  out.push({ j: '近況', en: 'What\'s happened?', fn: () => { say(k, { jp: '最近どうですか。', en: 'How have things been?' }, 'me'); say(k, mood(k, gov.CAST[k].fac ? S.fac[gov.CAST[k].fac] : null)); say(k, need(k, S, X, gov.spendable(s))); } });
  out.push({ j: '権限', en: 'What can you do?', fn: () => { say(k, { jp: 'あなたの権限は何ですか。', en: 'What is your authority?' }, 'me'); say(k, AUTH[k]); } });
  if (draft) {
    const st = STANCE[draft.motion] && STANCE[draft.motion][k];
    out.push({ j: '立場', en: `Your view on ${M.en.toLowerCase()}?`, fn: () => { say(k, { jp: `「${M.j}」についてどう思いますか。`, en: `What do you think of "${M.en}"?` }, 'me'); if (st) say(k, st[0]); const v = gov.seatScore(s, X, draft, k); if (gov.CAST[k].seat) say(k, SAY.vote[v.vote]); } });
    if (st) out.push({ j: '異議', en: 'What would change your mind?', fn: () => { gov.ask(s, C.id, k); say(k, { jp: '何があれば賛成できますか。', en: 'What would it take for you to vote yes?' }, 'me'); say(k, st[1]); persist(); } });
    for (const id of M.clauses) { const K = gov.CLAUSES[id]; if (K.by !== k) continue;
      const c = draft.cl[id]; out.push({ j: '条件', en: `Discuss terms: ${K.en}${c ? ' · ' + ({ agreed: 'agreed', grudging: 'signed grudgingly', refused: 'refused', countered: 'a counter on the table' }[c.st]) : ''}`, full: true, fn: () => { B.talk.sub = { clause: id, terms: c ? { ...c.terms } : { ...(K.terms0 || {}) } }; } }); }
  }
  if (k === 'chair' && maj) out.push({ j: maj.m.kind === 'vote' ? '公聴会' : '会議', en: maj.m.kind === 'vote' ? 'Call the hearing (the vote)' : `Open ${maj.m.title[1]}`, y: true, full: true, fn: () => openHear() });
  if (k === 'legal' && draft) out.push({ j: '条文', en: 'Read the draft\'s terms', full: true, fn: () => legalRead(draft) });
  if (k === 'audit') out.push({ j: '進捗', en: 'How are the promises going?', full: true, fn: () => auditRead() });
  if (k === 'audit' && g.review && g.review.v <= g.visit.n) out.push({ j: '監督審査', en: 'Close the oversight review (show the override\'s record)', y: true, full: true, fn: () => { gov.closeReview(s, true); say(k, { jp: '[記録|きろく]を[確認|かくにん]しました。[審査|しんさ]を[終|お]わります。', en: 'I have checked the record. The review is closed.' }); persist(); } });
  for (const e of (s.sim.ev || []).filter(e => EVENTS[e.k].who === k)) {
    const E = EVENTS[e.k];
    out.push({ j: '決裁', en: `${E.j} · ${E.en}`, y: true, full: true, fn: () => { say(k, SAY.routine); say(k, { jp: E.d.split('。')[0] + '。', en: E.d.split('。').slice(1).join('。').trim() }); B.talk.sub = { ev: e.id }; } });
  }
  if (gov.CAST[k].fac) out.push({ j: '資料', en: 'The dossier (approval and its drivers)', fn: () => dossier(k) });
  return out;
}
function actsHTML(k) {
  const sub = B.talk.sub;
  if (sub && sub.ev) { const e = save().sim.ev.find(x => x.id === sub.ev); if (!e) { B.talk.sub = null; return actsHTML(k); } const E = EVENTS[e.k];
    return E.o.map(([j, en, d], i) => `<button type="button" class="act full" data-evo="${i}"><span class="key">${i + 1}</span><span><b>${j}</b> ${esc(en)}<small>${esc(d)}${i === E.def ? ' · the autopilot\'s choice' : ''}</small></span></button>`).join('') + `<button type="button" class="act full" data-back="1"><span class="key">0</span><span>Not now</span></button>`; }
  if (sub && sub.clause) return termsHTML(k, sub);
  return acts(k).map((a, i) => `<button type="button" class="act${a.full ? ' full' : ''}${a.y ? ' y' : ''}" data-a="${i}" ${a.dis ? 'disabled' : ''}><span class="key">${i + 1}</span><span><b>${a.j}</b><small>${esc(a.en)}</small></span></button>`).join('');
}
function termsHTML(k, sub) {
  const K = gov.CLAUSES[sub.clause], C = theCase().C, c = C.draft.cl[sub.clause], t = sub.terms, P = gov.price(C.ref);
  let ed = '';
  if (sub.clause === 'retrain') ed = `<span class="lb">TRAINING PLACES</span><div class="seg">${[4, 6].map(n => `<button type="button" data-tp="places" data-tv="${n}" class="${t.places === n ? 'on' : ''}"><b>${n}人</b>¥${(n * P(1.65)).toLocaleString()}</button>`).join('')}</div>
      <span class="lb">SAFETY</span><div class="seg">${[['shift', '整備当番', 'protected maintenance shift'], ['wage', '手当', 'wage supplement']].map(([v, j, e]) => `<button type="button" data-tp="safety" data-tv="${v}" class="${t.safety === v ? 'on' : ''}"><b>${j}</b>${e}</button>`).join('')}</div>
      <span class="lb">FIRST REFUSAL</span><span>${t.refusal ? 'on the next two openings (their counter)' : '—'}</span>`;
  const cost = K.cost(t, P);
  return `<div class="terms"><span class="lb">CLAUSE</span><span><b class="kj" style="font-size:15px">${K.j}</b> ${esc(K.en)} · ${cost ? yen(cost) + ' escrow' : 'no cost'}</span>${ed}<span class="lb">TERMS</span><span style="color:#B8BCC6">${esc(K.desc(t, P))}</span></div>
    ${c && c.st === 'countered' ? `<button type="button" class="act y" data-ctr="1"><span class="key">1</span><span><b>受け入れる</b><small>Accept their counter</small></span></button><button type="button" class="act" data-ctr="0"><span class="key">2</span><span><b>断る</b><small>Decline: they sign grudgingly (+1, not +2)</small></span></button>`
      : `<button type="button" class="act y" data-offer="1"><span class="key">1</span><span><b>提示する</b><small>Offer these terms</small></span></button>${c ? `<button type="button" class="act" data-drop="1"><span class="key">2</span><span><b>取り下げ</b><small>Withdraw the clause</small></span></button>` : '<span></span>'}`}
    <button type="button" class="act full" data-back="1"><span class="key">0</span><span>Back</span></button>`;
}
function offerNow(k) {
  const sub = B.talk.sub, K = gov.CLAUSES[sub.clause], C = theCase().C;
  say(k, { jp: `${K.j}を[提案|ていあん]します。`, en: `I propose: ${K.desc(sub.terms, gov.price(C.ref))}` }, 'me');
  const r = gov.offer(save(), ctx(), C.id, sub.clause, sub.terms);
  if (!r.ok) { say(k, { jp: r.why === 'two-clauses' ? '[条件|じょうけん]は二つまでです。' : r.why === 'one-per-sponsor' ? '[一人|ひとり]一つまでです。' : 'その[条件|じょうけん]はこの[議案|ぎあん]には[付|つ]けられません。', en: r.why === 'two-clauses' ? 'At most two clauses per proposal: withdraw one first.' : r.why === 'one-per-sponsor' ? 'One clause per sponsor.' : 'That clause can\'t go on this motion.' }); }
  else { const R = REPLY[sub.clause] || {}; const L = r.st === 'refused' ? R[r.why] : R[r.st] || R.agreed; if (L) say(k, L);
    if (r.st === 'refused' && r.why === 'capacity') say('ops', { jp: '[研修|けんしゅう]の[枠|わく]は四[人分|にんぶん]しかない。', en: 'There are only four training places.' });
    if (r.st === 'agreed') sub.done = true; }
  persist();
}

/* the dossier and the advisors' readings */
function dossier(k) {
  const S = save().sim, f = gov.CAST[k].fac, v = S.fac[f], t = (S.drivers || {})[f];
  const WHY = { union: 'wages, hours, safety, idle workers, training', board: 'hourly profit, dividends, debt, the directive', res: 'pollution, PR, surveillance, stability', eng: 'wages and work for engineers (N3+)' };
  say(k, { jp: `${FAC[f][0]} · ${Math.round(v)} → ${Math.round(t == null ? v : Math.max(0, Math.min(100, t)))}`, en: `${FAC[f][1]} approval ${Math.round(v)}, drifting toward ${Math.round(t == null ? v : t)}. Driven by ${WHY[f]}. Below 30: ${{ union: 'a strike notice', board: 'a locked policy', res: 'a protest', eng: 'they leave (later)' }[f]}.` }, 'sys');
}
function legalRead(draft) {
  const ids = Object.keys(draft.cl).filter(id => ['agreed', 'grudging'].includes(draft.cl[id].st));
  say('legal', { jp: ids.length ? '[条文|じょうぶん]を[読|よ]み[上|あ]げます。' : 'まだ[条件|じょうけん]は[付|つ]いていません。', en: ids.length ? 'I\'ll read the terms out.' : 'No clauses are attached yet.' });
  const P = gov.price((gov.caseOf(save(), gov.MOTIONS[draft.motion].arc) || {}).ref);
  for (const id of ids) { const K = gov.CLAUSES[id], c = K.contract(draft.cl[id].terms, P);
    say('legal', { jp: `${K.j} · ${K.en}`, en: `Metric: ${c.metric}. Quantity: ${c.qty}. Funding: ${c.funding}. Beneficiary: ${c.to}. Deadline: ${c.deadline}. Remedy: ${c.remedy}.` }, 'sys'); }
  const M = gov.MOTIONS[draft.motion]; say('legal', { jp: M.j, en: gov.describe(save(), draft.motion) }, 'sys');
}
function auditRead() {
  const g = G(), S = save().sim, open = g.pledges.filter(p => p.st === 'open');
  if (!open.length) say('audit', { jp: '[確認|かくにん]する[約束|やくそく]はありません。', en: 'There are no open promises to check.' });
  for (const p of open) { const b = p.base, K = gov.CLAUSES[p.clause], prog = p.clause === 'inspect' ? `${Math.min(6, S.runs - b.runs)}/6 shipment runs` : p.clause === 'retrain' ? `${Math.floor(S.retr - b.retr)}/${p.terms.places} placements` : p.clause === 'report' ? `${S.aired - b.aired} clips aired` : 'automatic';
    say('audit', { jp: `${K.j} · ${gov.CAST[p.to].j}`, en: `${prog}. Due by attended visit ${p.dueV} (now ${g.visit.n}).` }, 'sys'); }
  for (const p of g.pledges.filter(p => p.st !== 'open').slice(-3)) say('audit', p.st === 'kept' ? SAY.kept : SAY.broken);
}

/* ---------------- the hearing ---------------- */
function openHear() { const m = theCase(); if (!m) return; B.flash = null; B.view = 'hear'; B.hear = { hid: `${m.C.id}:${G().visit.n}:${Date.now().toString(36)}`, chk: (B.hear && B.hear.case === m.C.id + m.C.st) ? B.hear.chk : null, case: m.C.id + m.C.st, order: shuffle4(), res: null }; draw(); }
const shuffle4 = () => [0, 1, 2, 3].sort(() => Math.random() - .5);
function hearView() {
  const s = save(), X = ctx(), m = theCase(); if (!m) { B.view = 'room'; return ''; }
  const { C, m: mt } = m, H0 = B.hear, br = mt.brief;
  const check = H0.chk == null ? `<div class="q lb" style="margin-top:6px;text-transform:none;letter-spacing:.04em;font-size:12px;color:#C9CDD6"><b style="color:var(--y)">確認 · CHECK</b> ${esc(br.q)}</div><div class="chk">${H0.order.map((i, n) => `<button type="button" class="act" data-chk="${n}"><span class="key">${'QWER'[n]}</span><span>${esc(br.a[i])}</span></button>`).join('')}</div>`
    : `<div class="res ${H0.chk ? 'pass' : 'fail'}"><b class="lb" style="color:${H0.chk ? 'var(--y)' : 'var(--red)'}">${H0.chk ? '理解 · UNDERSTOOD' : '誤解 · MISREAD'}</b><div style="margin-top:4px;color:#C9CDD6">${esc(H0.chk ? br.hint : 'Translation: ' + br.en)}</div></div>`;
  let left = `<div class="pn" style="position:relative;clip-path:none"><div class="ph"><span><b>${mt.kind === 'vote' ? '公聴会' : '会議'}</b> ${esc(mt.title[1].toUpperCase())}</span><span>VISIT ${G().visit.n}</span></div><div class="in">
    <div class="jpb kj">${rb(br.jp)}</div>${check}`;
  let right = '';
  if (mt.kind === 'vote') {
    const draft = C.draft, T = gov.tally(s, X, draft), need = gov.commitments(s, draft), sp = gov.spendable(s), bl = gov.blockers(s, X, draft), F = gov.previewOf(s, X, draft), F0 = baseF();
    left += `<div class="lb" style="margin:10px 0 5px">議案 · THE PROPOSAL (1–${mt.motions.length})</div>${mt.motions.map((id, i) => { const Mo = gov.MOTIONS[id]; return `<button type="button" class="mot${draft.motion === id ? ' on' : ''}" data-mot="${id}"><span class="key">${i + 1}</span> <b>${Mo.j}</b>${esc(Mo.en)}<small>${esc(gov.describe(s, id))}</small></button>`; }).join('')}
      <div class="lb" style="margin:8px 0 5px">条件 · CLAUSES (AT MOST TWO, NEGOTIATED AT THE DESKS)</div>${gov.MOTIONS[draft.motion].clauses.map(id => { const c = draft.cl[id], K = gov.CLAUSES[id]; return `<span class="cl ${!c ? '' : c.st === 'agreed' ? 'ok' : c.st === 'grudging' ? 'gr' : 'no'}"><b>${K.j}</b>${esc(gov.CAST[K.by].j)} · ${!c ? 'not discussed' : { agreed: 'agreed', grudging: 'grudging', refused: 'refused', countered: 'counter waiting' }[c.st]}</span>`; }).join('') || '<span class="lb">NONE ALLOWED ON THIS MOTION</span>'}`;
    const ov = gov.overrideOK(s, X, draft);
    right = `<div class="pn" style="position:relative;clip-path:none"><div class="ph"><span><b>採決</b> THE VOTE · THREE YES TO PASS</span><span>${H0.res && H0.res.pass ? 'PASSED' : ''}</span></div><div class="in">
      ${gov.SEATS.map(k => { const v = T.seats[k]; return `<div class="seat"><img alt="" src="${IMG(k)}"><div><div class="kj" style="font-size:13px">${esc(gov.CAST[k].j)} <span class="lb">${esc(gov.roleOf(k, X.tier)[1])}</span></div><div class="pt">${v.parts.map(p => `<i>${p.v > 0 ? '+' : ''}${p.v}</i> ${esc(p.why[1])}`).join(' · ')} = <i>${v.v > 0 ? '+' : ''}${v.v}</i></div></div><div class="v ${VOTE[v.vote][2]}"><b>${VOTE[v.vote][0]}</b>${VOTE[v.vote][1]}</div></div>`; }).join('')}
      <div class="tally"><span>YES</span>${T.yes}<span>NO</span>${T.no}<span>ABSTAIN</span>${T.abs}<span style="margin-left:auto;color:${T.pass ? 'var(--y)' : 'var(--red)'}">${T.pass ? 'WOULD PASS' : 'WOULD FAIL'}</span></div>
      <div class="lb">24H OPERATING ESTIMATE IF SIGNED (EVENTS AND QUARTER CLOSE NOT INCLUDED)</div>
      <div class="fcr"><div><span class="lb">NET / H</span><b>${yen(F.net)}</b><span class="lb">${dlt(F.net - F0.net, yen)}</span></div><div><span class="lb">POWER</span><b>${Math.round(F.power)} MW</b><span class="lb">${dlt(F.power - F0.power, v => Math.round(v) + ' MW')}</span></div><div><span class="lb">UNION</span><b>${Math.round(F.fac.union)}</b><span class="lb">${dlt(F.fac.union - F0.fac.union, v => v.toFixed(0))}</span></div><div><span class="lb">STABILITY</span><b>${F.s.stab}</b><span class="lb">${dlt(F.s.stab - F0.s.stab, v => v.toFixed(0))}</span></div></div>
      <div class="lb">COMMITTED ON SIGNING ${yen(need)} · SPENDABLE ${yen(sp)} (FUNDS ${yen(s.corp.funds)} − RESERVE ${yen(gov.reserve(s))})</div>
      ${bl.map(b => `<div class="blk">■ ${esc(b[0])} · ${esc(b[1])}</div>`).join('')}
      ${H0.res ? resultHTML(H0.res, C) : C.failV === G().visit.n ? resultHTML({ ok: true, pass: false, T: { yes: '·', no: '·', abs: '·' }, again: true }, C) : ''}
      <div style="margin-top:6px"><button type="button" class="go" data-submit="1" ${bl.length || (H0.res && H0.res.pass) ? 'disabled' : ''}>採決 · SUBMIT <span class="key" style="border-color:#000;color:#000">Enter</span></button>${gov.MOTIONS[draft.motion].override ? `<button type="button" class="go r" data-over="1" ${ov.ok && !(H0.res && H0.res.pass) && !T.pass ? '' : 'disabled'} title="${esc(ov.ok ? `Costs ${yen(ov.cost)} now, +12 暴走度, chair trust −10 and −5 from each dissenting seat; an oversight review at your next visit.` : ov.why)}">緊急権限 · OVERRIDE${ov.ok ? ' ' + yen(ov.cost) : ''}</button>` : ''}<button type="button" class="go g" data-room="1">戻る · BACK <span class="key">Esc</span></button>
      ${C.fails ? `<button type="button" class="go g" data-defer="1">延期 · DEFER THE CASE</button>` : ''}</div>
      ${gov.MOTIONS[draft.motion].override && ov.ok ? '<div class="lb" style="margin-top:6px;text-transform:none;letter-spacing:.04em">緊急権限: once a quarter the AI may force this motion through. It cannot spend the reserve or install without power.</div>' : ''}</div></div>`;
  } else {
    right = `<div class="pn" style="position:relative;clip-path:none"><div class="ph"><span><b>決定</b> ${esc(mt.title[1].toUpperCase())}</span><span>1–${mt.opts.length}</span></div><div class="in">
      ${(mt.lines || []).map(l => `<div class="ob"><span><span class="kj">${esc(l[0])}</span> <span class="lb" style="text-transform:none;letter-spacing:.02em">${esc(l[1])}</span></span><span class="${l[2] ? 'k' : 'x'}">${l[2] ? '✓' : '✗'}</span></div>`).join('')}
      ${mt.opts.map((o, i) => `<button type="button" class="mot" data-opt="${o.id}" ${o.ok ? '' : 'disabled style="opacity:.4;cursor:not-allowed"'}><span class="key">${i + 1}</span> <b>${o.j}</b>${esc(o.en)}<small>${esc(o.d)}${o.ok ? '' : ' · ' + esc(o.why || '')}</small></button>`).join('')}
      ${H0.res && !H0.res.ok ? `<div class="blk">■ ${esc(H0.res.why || 'Not possible now.')}</div>` : ''}
      <button type="button" class="go g" data-room="1">戻る · BACK <span class="key">Esc</span></button></div></div>`;
  }
  left += '</div></div>';
  return `<div class="hr"><div class="hl">${left}</div><div class="hs">${right}</div></div>`;
}
const dlt = (v, f) => (Math.abs(v) < .5 ? '±0' : (v > 0 ? '▲ ' : '▼ ') + f(Math.abs(v)));
function baseF() { const s = save(), t = s.sim.t; if (!B.f0 || B.f0.t !== t) B.f0 = { t, v: (B.M.fc && B.M.fc.t === t && B.M.fc.v) || null }; if (!B.f0.v) { const M = B.M; B.f0.v = M.base ? M.base().v : null; } return B.f0.v || { net: 0, power: 0, fac: { union: 0 }, s: { stab: 0 } }; }
function resultHTML(r, C) {
  if (!r.ok) return `<div class="res fail"><b class="lb" style="color:var(--red)">REFUSED</b> ${esc(r.why || '')}</div>`;
  if (r.pass) return `<div class="res pass"><b class="lb" style="color:var(--y)">${r.override ? '緊急権限 · FORCED' : '可決 · PASSED'}</b> ${r.T ? `${r.T.yes}–${r.T.no}–${r.T.abs}` : ''}. ${rb(SAY.signed.jp)} <span class="lb">${esc(SAY.signed.en)}</span></div>`;
  return `<div class="res fail"><b class="lb" style="color:var(--red)">否決 · FAILED</b> ${r.again ? 'Earlier today.' : `${r.T.yes}–${r.T.no}–${r.T.abs}.`} One failed submission per motion per visit. Change the proposal, or:
    <div style="margin-top:6px"><button type="button" class="go g" data-fb="keep">現状維持 · KEEP THE LINE AS IT IS</button>${C.draft.motion !== 'pilot' ? '<button type="button" class="go g" data-fb="pilot">共同試験 · SWITCH TO THE JOINT PILOT</button>' : ''}<button type="button" class="go g" data-fb="withdraw">撤回 · WITHDRAW</button></div></div>`;
}

/* ---------------- wiring and keys ---------------- */
function wire() {
  const b = B.body, q = s => b.querySelectorAll(s);
  q('[data-r]').forEach(x => { x.onclick = () => { const i = +x.dataset.r; if (B.sel === i && B.view === 'room') openTalk(i); else { B.sel = i; draw(); } }; x.ondblclick = () => openTalk(+x.dataset.r); });
  q('[data-hear]').forEach(x => x.onclick = () => { B.sel = gov.ORDER.indexOf('chair'); openHear(); });
  q('[data-ev]').forEach(x => x.onclick = () => { const e = save().sim.ev.find(y => y.id === x.dataset.ev); if (!e) return; const k = EVENTS[e.k].who; openTalk(gov.ORDER.indexOf(k)); B.talk.sub = { ev: e.id }; say(k, SAY.routine); draw(); });
  q('[data-a]').forEach(x => x.onclick = () => runAct(+x.dataset.a));
  q('[data-evo]').forEach(x => x.onclick = () => pickEv(+x.dataset.evo));
  q('[data-back]').forEach(x => x.onclick = () => { B.talk.sub = null; draw(); });
  q('[data-tp]').forEach(x => x.onclick = () => { const v = x.dataset.tv; B.talk.sub.terms[x.dataset.tp] = /^\d+$/.test(v) ? +v : v; draw(); });
  q('[data-offer]').forEach(x => x.onclick = () => { offerNow(B.talk.seat); draw(); });
  q('[data-ctr]').forEach(x => x.onclick = () => { const a = x.dataset.ctr === '1', k = B.talk.seat; gov.answerCounter(save(), theCase().C.id, B.talk.sub.clause, a); say(k, { jp: a ? 'わかりました。[受|う]け[入|い]れます。' : 'それは[約束|やくそく]できません。', en: a ? 'Understood. I accept.' : 'I can\'t promise that.' }, 'me'); say(k, REPLY[B.talk.sub.clause][a ? 'agreed' : 'grudging'] || REPLY[B.talk.sub.clause].agreed); B.talk.sub.terms = { ...theCase().C.draft.cl[B.talk.sub.clause].terms }; persist(); draw(); });
  q('[data-drop]').forEach(x => x.onclick = () => { gov.dropClause(save(), theCase().C.id, B.talk.sub.clause); B.talk.sub = null; persist(); draw(); });
  q('[data-chk]').forEach(x => x.onclick = () => check(+x.dataset.chk));
  q('[data-mot]').forEach(x => x.onclick = () => { gov.setMotion(save(), theCase().C.id, x.dataset.mot); B.hear.res = null; persist(); draw(); });
  q('[data-submit]').forEach(x => x.onclick = () => submit(false));
  q('[data-over]').forEach(x => x.onclick = () => { if (confirm('Force the motion through with the emergency mandate? +12 暴走度, the chair\'s trust −10, an oversight review at your next visit.')) submit(true); });
  q('[data-fb]').forEach(x => x.onclick = () => { gov.fallback(save(), ctx(), theCase().C.id, x.dataset.fb); B.hear.res = null; persist(); if (!theCase() || theCase().C.st !== 'm1') { B.view = 'room'; } draw(); B.M.refresh && B.M.refresh(); });
  q('[data-defer]').forEach(x => x.onclick = () => { gov.deferCase(save(), theCase().C.id); persist(); B.view = 'room'; draw(); });
  q('[data-opt]').forEach(x => x.onclick = () => choose(x.dataset.opt));
  q('[data-room]').forEach(x => x.onclick = () => { B.view = 'room'; draw(); });
  /* the parallax: three layers, a few pixels each */
  const R = b.querySelector('.bur');
  if (R && B.view === 'room' && !RM()) {
    R.onpointermove = e => { if (e.pointerType === 'touch') return; const r = R.getBoundingClientRect(), x = Math.max(-1, Math.min(1, 2 * (e.clientX - r.left) / r.width - 1));
      R.querySelector('.far').style.transform = `scale(1.025) translateX(${x * -2}px)`; R.querySelector('.cast').style.transform = `translateX(${x * -5}px)`; R.querySelector('.near').style.transform = `scale(1.025) translateX(${x * -9}px)`; };
    R.onpointerleave = () => { ['.far', '.near'].forEach(s => R.querySelector(s).style.transform = 'scale(1.025)'); R.querySelector('.cast').style.transform = ''; };
    ['.far', '.near'].forEach(s => R.querySelector(s).style.transform = 'scale(1.025)');
  }
  const tr = b.querySelector('#bur-tr'); if (tr) tr.scrollTop = tr.scrollHeight;
}
function openTalk(i) {
  B.flash = null;
  const k = gov.ORDER[i]; B.sel = i; B.view = 'talk'; B.talk = { seat: k, sub: null };
  if (!(B.logs[k] || []).length) { say(k, { jp: `${gov.CAST[k].j.split(' ')[0]}さん、お[時間|じかん]いいですか。`, en: `${gov.CAST[k].j.split(' ')[0]}-san, do you have a moment?` }, 'me'); say(k, mood(k, gov.CAST[k].fac ? save().sim.fac[gov.CAST[k].fac] : null)); }
  draw();
}
function runAct(i) { const a = acts(B.talk.seat)[i]; if (!a || a.dis) return; a.fn(); draw(); }
function pickEv(i) {
  const k = B.talk.seat, id = B.talk.sub.ev, e = save().sim.ev.find(x => x.id === id); if (!e) return;
  const E = EVENTS[e.k]; if (!E.o[i]) return;
  say(k, { jp: E.o[i][0] + '。', en: E.o[i][1] + '.' }, 'me');
  resolve(save(), id, i); persist(); say(k, { jp: '[了解|りょうかい]しました。', en: E.o[i][2] }); B.talk.sub = null; draw(); B.M.refresh && B.M.refresh();
}
function check(n) { const m = theCase(); if (!m || B.hear.chk != null) return; B.hear.chk = B.hear.order[n] === 0; draw(); }
function submit(override) {
  const m = theCase(); if (!m) return;
  const r = gov.submit(save(), ctx(), m.C.id, B.hear.hid + (override ? ':o' : '') + ':' + (m.C.fails || 0) + ':' + m.C.draft.motion + ':' + Object.keys(m.C.draft.cl).join(','), { override });
  B.hear.res = r.dup ? { ok: true, pass: m.C.st !== 'm1' } : r; persist(); B.M.fc = null;
  if (r.pass) { B.flash = { j: r.override ? '緊急権限' : '可決', en: `${gov.MOTIONS[gov.caseOf(save(), m.C.id).acc.motion].en.toUpperCase()} · ${r.override ? 'FORCED BY THE AI' : `PASSED ${r.T.yes}–${r.T.no}–${r.T.abs}`} · SIGNED, ON THE RECORD` }; B.view = 'room'; }
  draw(); B.M.refresh && B.M.refresh();
}
function choose(opt) {
  const m = theCase(); if (!m) return;
  const r = gov.choose(save(), ctx(), m.C.id, opt, `${m.C.id}:${m.C.st}:${G().visit.n}:${opt}`); persist(); B.M.fc = null;
  if (r.ok) { B.view = 'room'; B.hear = null; B.flash = { j: '決定', en: `${m.m.title[1].toUpperCase()} · ${(m.m.opts.find(o => o.id === opt) || {}).en || opt}`.toUpperCase() }; } else B.hear.res = r;
  draw(); B.M.refresh && B.M.refresh();
}
/* keys: the bureau gets them first while the Factions tab is open; returns true if it used the key */
export function bureauKey(e) {
  if (!B || !B.body || !B.body.isConnected) return false;
  const k = e.key;
  if (B.view === 'room') {
    if (k === 'ArrowRight' || k === 'ArrowLeft') { B.sel = (B.sel + (k === 'ArrowRight' ? 1 : 6)) % 7; draw(); return true; }
    if (k === 'Enter') { openTalk(B.sel); return true; }
    if (k === 'h' || k === 'H') { if (theCase()) { openHear(); return true; } }
    return false;
  }
  if (k === 'Escape' || k === 'Backspace') { if (B.view === 'talk' && B.talk.sub) B.talk.sub = null; else B.view = 'room'; draw(); return true; }
  if (B.view === 'talk') {
    const sub = B.talk.sub;
    if (sub && sub.ev) { if (k === '0') { B.talk.sub = null; draw(); return true; } if (/^[1-9]$/.test(k)) { pickEv(+k - 1); return true; } return true; }
    if (sub && sub.clause) { const c = theCase().C.draft.cl[sub.clause];
      if (k === '0') { B.talk.sub = null; draw(); return true; }
      if (c && c.st === 'countered' && (k === '1' || k === '2')) { B.body.querySelector(`[data-ctr="${k === '1' ? 1 : 0}"]`).click(); return true; }
      if (k === '1') { offerNow(B.talk.seat); draw(); return true; } if (k === '2' && c) { B.body.querySelector('[data-drop]').click(); return true; } return true; }
    if (/^[1-9]$/.test(k)) { runAct(+k - 1); return true; }
    return true;
  }
  if (B.view === 'hear') {
    const m = theCase(); if (!m) return true;
    const qi = 'qwer'.indexOf(k.toLowerCase()); if (qi >= 0 && B.hear.chk == null) { check(qi); return true; }
    if (m.m.kind === 'vote') { if (/^[1-3]$/.test(k) && m.m.motions[+k - 1]) { gov.setMotion(save(), m.C.id, m.m.motions[+k - 1]); B.hear.res = null; persist(); draw(); return true; } if (k === 'Enter') { const b = B.body.querySelector('[data-submit]'); if (b && !b.disabled) submit(false); return true; } }
    else if (/^[1-9]$/.test(k)) { const o = m.m.opts[+k - 1]; if (o && o.ok) choose(o.id); return true; }
    return true;
  }
  return false;
}

/* ---------------- QA: a seeded demo planet for each branch of the first arc (core ?demo&arc=…) ---------------- */
export function demoArc(save, ctx, branch) {
  const S = save.sim, g = gov.govOf(save); save.corp.factory = Object.assign(save.corp.factory || {}, { shifts: Math.max(1, (save.corp.factory || {}).shifts || 0) });
  save.corp.funds = Math.max(save.corp.funds, 6000); gov.visit(save, ctx, Date.now()); gov.progress(save, ctx);
  const C = gov.caseOf(save, 'line'); if (!C) return;
  const next = () => { g.visit.day = null; gov.visit(save, ctx, Date.now()); };
  if (branch === 'm1') return;
  if (branch === 'rescue') { gov.submit(save, ctx, 'line', 'demo:fail'); return; }
  if (branch === 'defer') { gov.setMotion(save, 'line', 'defer'); gov.submit(save, ctx, 'line', 'demo:defer'); next(); return; }
  if (branch === 'hold') { gov.offer(save, ctx, 'line', 'inspect', {}); gov.submit(save, ctx, 'line', 'demo:full'); next(); return; }
  gov.offer(save, ctx, 'line', 'inspect', {}); gov.offer(save, ctx, 'line', 'retrain', { places: 4, safety: 'shift', refusal: false }); gov.answerCounter(save, 'line', 'retrain', true);
  gov.submit(save, ctx, 'line', 'demo:deal');
  if (branch === 'kept') { S.runs += 6; S.retr += 5; }
  next(); next(); next();
}
