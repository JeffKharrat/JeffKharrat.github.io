/* カラット: 派閥 · the Factions room. Seven people along the rear lip of the counter; pick one and talk. Conversation
   practice only: everything is Japanese first, with furigana, and the English underneath. No votes, no economy. */
import { CAST, ORDER, roleOf, AUTH, CHAT } from './cast.js?v=23';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rb = s => esc(s).replace(/\[([^|\]]+)\|([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>');
const IMG = k => `bureau/${CAST[k].img}.webp`;

const CSS = `
#mg .bur { position:absolute; inset:0; overflow:hidden; background:#16181D; border:1px solid var(--line2); }
#mg .bur .lay { position:absolute; left:0; top:-30px; width:1240px; height:698px; pointer-events:none; }
#mg .bur .lay img { width:100%; height:100%; display:block; image-rendering:pixelated; }
#mg .bur .desk { clip-path:polygon(0 66%,10% 66%,12% 58.6%,88% 58.6%,89% 66%,100% 66%,100% 100%,0 100%); }
#mg .bur .cast { position:absolute; left:161px; top:-30px; width:918px; height:698px; pointer-events:none; }
#mg .bur .rep { position:absolute; bottom:${698 - 401}px; width:131px; height:164px; pointer-events:auto; cursor:pointer; background:none; border:0; padding:0; }
#mg .bur .rep img { width:131px; height:164px; object-fit:contain; object-position:bottom; image-rendering:pixelated; display:block; animation:bBr 5.2s ease-in-out infinite; filter:drop-shadow(0 3px 0 rgba(0,0,0,.35)); }
#mg .bur .rep:nth-child(2n) img { animation-delay:-1.7s; } #mg .bur .rep:nth-child(3n) img { animation-delay:-3.1s; }
@keyframes bBr { 0%,100% { transform:translateY(0); } 50% { transform:translateY(1px); } }
#mg .bur .rep:hover img, #mg .bur .rep.sel img, #mg .bur .rep:focus-visible img { filter:drop-shadow(0 0 0 #FFE600) drop-shadow(1px 0 0 #FFE600) drop-shadow(-1px 0 0 #FFE600) drop-shadow(0 -1px 0 #FFE600); }
#mg .bur .rep:focus-visible { outline:none; }
#mg .bur .rep img.h { position:absolute; left:0; bottom:0; opacity:0; }   /* the hover pose: swapped in while the pointer is over the rep */
#mg .bur .rep:hover img.h { opacity:1; } #mg .bur .rep:hover img:not(.h) { opacity:0; }
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
#mg .bur .next { position:absolute; left:318px; right:318px; top:8px; display:flex; gap:10px; align-items:center; padding:7px 10px; background:rgba(5,6,8,.92); border:1px solid var(--y); font:12px var(--mono); color:#E6E8EC; cursor:pointer; text-align:left; }
#mg .bur .next b { color:#000; background:var(--y); padding:1px 6px; font:700 11px var(--jp, sans-serif); white-space:nowrap; } #mg .bur .next small { margin-left:auto; color:var(--mute); font:700 9px var(--mono); letter-spacing:.14em; white-space:nowrap; }
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
@media (prefers-reduced-motion: reduce) { #mg .bur .rep img, #mg .bur .dot, #mg .bur .lamp { animation:none; } }
`;
function css() { if (!document.getElementById('bur-css')) { const st = document.createElement('style'); st.id = 'bur-css'; st.textContent = CSS; document.head.appendChild(st); } }

let B = null;
export function bureau(body, M) { css(); if (!B || B.M !== M) B = { M, view: 'room', sel: 3, talk: null, logs: {}, seen: {} }; B.body = body; draw(); }
export const bureauClose = () => { B = null; };
function draw() { const b = B.body; if (!b) return; b.innerHTML = `<div class="bur" tabindex="-1">${room()}${B.view === 'talk' ? talkView() : ''}</div>`; wire(); }
function room() {
  const reps = ORDER.map((k, i) => { const P = CAST[k], role = roleOf(k);
    return `<button type="button" class="rep${B.sel === i ? ' sel' : ''}" data-r="${i}" style="left:${i * 131}px" aria-label="${esc(P.j)} · ${esc(role[1])}"><img alt="" src="${IMG(k)}" draggable="false"><img class="h" alt="" src="${IMG(k).replace('.webp', '-h.webp')}" draggable="false"></button>`; }).join('');
  const plates = ORDER.map((k, i) => `<div class="plate" style="left:${161 + i * 131}px"><span>${esc(CAST[k].j)}</span><small>${esc(roleOf(k)[1])}</small></div>`).join('');
  return `<div class="lay far"><img alt="The bureau: a records wall, the counter, a glass meeting room" src="bureau/room.webp" draggable="false"></div>
    <div class="cast">${reps}</div><div class="lay desk near"><img alt="" src="bureau/room.webp" draggable="false"></div>${plates}
    <div class="hint">← → CHOOSE · ENTER TALK · 会話の練習 CONVERSATION PRACTICE</div>
    <div class="roster" role="list">${ORDER.map((k, i) => `<button type="button" role="listitem" class="${B.sel === i ? 'sel' : ''}" data-r="${i}">${esc(CAST[k].j)}<small>${esc(roleOf(k)[1].split(' ')[0])}</small></button>`).join('')}</div>`;
}
function talkView() {
  const k = B.talk, P = CAST[k], role = roleOf(k), lines = B.logs[k] || [];
  return `<div class="shade"></div><div class="tk">
    <div class="pn por"><div class="ph"><span><b>${k.toUpperCase()}</b> ${esc(role[1].toUpperCase())}</span></div>
      <div class="pic"><img alt="${esc(P.j)}" src="${IMG(k)}"></div>
      <div class="nm"><div class="kj"><ruby>${esc(P.j)}<rt>${esc(P.r)}</rt></ruby></div><div class="lb" style="margin:2px 0 8px">${esc(role[0])} · ${esc(role[1])}</div>
        <div class="lb" style="margin-top:8px">BACKSPACE · ESC BACK TO THE ROOM</div></div></div>
    <div class="pn tr"><div class="ph"><span><b>記録</b> TRANSCRIPT</span><span>${esc(P.j)} · カラット</span></div><div class="in" id="bur-tr">${lines.map(lineHTML).join('') || '<div class="lb" style="padding:10px 4px">CHOOSE WHAT TO ASK BELOW</div>'}</div></div>
    <div class="pn acts"><div class="ph"><span><b>対話</b> ACTIONS</span><span>1–3</span></div><div class="in">${acts(k).map((a, i) => `<button type="button" class="act" data-a="${i}"><span class="key">${i + 1}</span><span><b>${a.j}</b><small>${esc(a.en)}</small></span></button>`).join('')}</div></div></div>`;
}
const lineHTML = l => `<div class="ln ${l.who || ''}"><div class="jp kj">${rb(l.jp)}</div>${l.en ? `<div class="en">${esc(l.en)}</div>` : ''}</div>`;
function say(k, L, who = 'them') { (B.logs[k] = B.logs[k] || []).push({ ...L, who }); }
/* small talk: the next line of the person's own pool, in a shuffled order, so the whole pool comes up before a repeat */
function chat(k) { const pool = CHAT[k]; let q = B.seen[k]; if (!q || !q.length) q = B.seen[k] = pool.map((_, i) => i).sort(() => Math.random() - .5); return pool[q.shift()]; }
function acts(k) {
  return [
    { j: '近況', en: 'How are things?', fn: () => { say(k, { jp: '[最近|さいきん]どうですか。', en: 'How have things been?' }, 'me'); say(k, chat(k)); } },
    { j: '自己紹介', en: 'What do you do?', fn: () => { say(k, { jp: 'あなたの[仕事|しごと]は[何|なん]ですか。', en: 'What is your job?' }, 'me'); say(k, AUTH[k]); } },
    { j: '挨拶', en: 'Say goodbye', fn: () => { say(k, { jp: 'では、また。', en: 'Well then, see you.' }, 'me'); say(k, { jp: 'はい、また[今度|こんど]。', en: 'Yes, until next time.' }); } }];
}
function openTalk(i) { const k = ORDER[i]; B.sel = i; B.view = 'talk'; B.talk = k;
  if (!(B.logs[k] || []).length) { say(k, { jp: `${CAST[k].j.split(' ')[0]}さん、お[時間|じかん]いいですか。`, en: `${CAST[k].j.split(' ')[0]}-san, do you have a moment?` }, 'me'); say(k, { jp: 'はい、どうぞ。', en: 'Yes, go ahead.' }); }
  draw(); }
function wire() {
  const b = B.body;
  b.querySelectorAll('[data-r]').forEach(x => { x.onclick = () => { const i = +x.dataset.r; if (B.sel === i && B.view === 'room') openTalk(i); else { B.sel = i; draw(); } }; x.ondblclick = () => openTalk(+x.dataset.r); });
  b.querySelectorAll('[data-a]').forEach(x => x.onclick = () => { acts(B.talk)[+x.dataset.a].fn(); draw(); });
  const tr = b.querySelector('#bur-tr'); if (tr) tr.scrollTop = tr.scrollHeight;
}
export function bureauKey(e) {
  if (!B || !B.body || !B.body.isConnected) return false;
  const k = e.key;
  if (B.view === 'room') {
    if (k === 'ArrowRight' || k === 'ArrowLeft') { B.sel = (B.sel + (k === 'ArrowRight' ? 1 : 6)) % 7; draw(); return true; }
    if (k === 'Enter') { openTalk(B.sel); return true; }
    return false;
  }
  if (k === 'Escape' || k === 'Backspace') { B.view = 'room'; draw(); return true; }
  if (/^[1-3]$/.test(k)) { acts(B.talk)[+k - 1].fn(); draw(); return true; }
  return true;
}
