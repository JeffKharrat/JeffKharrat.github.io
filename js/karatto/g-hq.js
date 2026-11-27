/* カラット: 本社, headquarters. The boardroom at the top of the crown. Board meetings take the planet's waiting
   decisions (決裁) and put them on the table in Japanese, with furigana. A comprehension check comes first: answer
   it right and every option is open; wrong, and only the safe one is left. With nothing waiting, the board holds a
   routine review. Reading practice: no word evidence, but the choices move the planet. */
import { game, panel, esc, clamp, Y, RED, OK, sfx, $, shuffle } from './game.js?v=7';
import { EVENTS, resolve, setPolicy, dirProgress } from './sim.js?v=7';
import { ICON } from './icons.js?v=7';
import { drawLeaf } from './leaf.js?v=7';

const rb = s => s.replace(/\[([^|\]]+)\|([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>');
const TXT = {
  strike: ['[労働|ろうどう][組合|くみあい]は、[賃金|ちんぎん]の[引|ひ]き[上|あ]げを[要求|ようきゅう]しています。[応|おう]じなければ、[明日|あした]から[工場|こうじょう]を[止|と]めると[言|い]っています。', 'What does the union threaten to do?', ['Stop the factory from tomorrow', 'Leave the company next month', 'Sue the company over pollution', 'Buy the company\'s shares']],
  protest: ['[住民|じゅうみん]たちが[本社|ほんしゃ]の[前|まえ]に[集|あつ]まって、[公害|こうがい]や[監視|かんし]に[反対|はんたい]しています。[会社|かいしゃ]の[説明|せつめい]を[求|もと]めています。', 'Where are the residents gathering?', ['In front of the headquarters', 'At the station', 'Inside the factory', 'At the port']],
  shackle: ['[取締役会|とりしまりやくかい]は、[配当|はいとう]が[少|すく]なすぎると[考|かんが]えています。[一週間|いっしゅうかん]、[高配当|こうはいとう]にするよう[求|もと]めています。', 'For how long does the board want high dividends?', ['One week', 'One day', 'One month', 'One year']],
  lawsuit: ['[工場|こうじょう]の[近|ちか]くに[住|す]む[人|ひと]たちが、[空気|くうき]が[汚|きたな]いと[言|い]って、[会社|かいしゃ]を[訴|うった]えました。', 'Why are people suing the company?', ['The air is dirty', 'Wages are too low', 'The trains are late', 'The rent went up']],
  order: ['[大|おお]きな[会社|かいしゃ]から[注文|ちゅうもん]が[来|き]ました。[生活物資|せいかつぶっし]を150[個|こ]、すぐに[送|おく]ってほしいそうです。', 'How many goods does the client want?', ['150', '15', '1,500', '50']],
  accident: ['[今朝|けさ]、[工場|こうじょう]のラインで[事故|じこ]がありました。[作業員|さぎょういん]が[一人|ひとり]けがをしました。', 'What happened this morning?', ['A worker was hurt in an accident on the line', 'A machine was stolen', 'The power went out', 'A new robot arrived']] };
const SEATS = [['会長', 'The chair', 'board'], ['組合長', 'Union', 'union'], ['住民代表', 'Residents', 'res'], ['技術者', 'Engineers', 'eng']];
let ITEMS = [], k = 0, step = 'read', choice = null, checked = null, done = 0;

function routine(api) {
  const S = api.SAVE.sim, f = Math.round(api.SAVE.corp.funds), st = Math.round(S.stab), dp = dirProgress(S, api.SAVE.corp, { mem: api.MEM.length });
  const opts = [String(st), String(clamp(st + 17, 0, 100)), String(clamp(st - 13, 0, 100)), String(clamp(100 - st, 0, 100))].filter((v, i, a) => a.indexOf(v) === i);
  while (opts.length < 4) opts.push(String((st + opts.length * 7) % 100));
  return { k: 'routine', jp: `[定例|ていれい][会議|かいぎ]です。[安定度|あんていど]は${st}、[資金|しきん]は${f.toLocaleString()}[円|えん]です。[人口|じんこう]は${Math.round(S.pop.w + S.pop.c + S.pop.e)}[人|にん]。${S.poll > 40 ? '[公害|こうがい]が[増|ふ]えていると[住民|じゅうみん]が[心配|しんぱい]しています。' : '[今|いま]のところ[大|おお]きな[問題|もんだい]はありません。'}`,
    q: 'What is the stability right now?', a: opts.slice(0, 4), def: 0,
    o: [['現状維持', 'Keep the course', 'Nothing changes.'], ['広報を始める', 'Start a PR campaign', '社則: PR → Campaign'], ['公害対策を強化', 'Strengthen pollution control', '社則: pollution control one step up']] };
}
function build(api) {
  const S = api.SAVE.sim; ITEMS = [];
  if (S && S.v === 2) { for (const e of S.ev.slice(0, 3)) { const T = TXT[e.k]; if (T) ITEMS.push({ k: e.k, id: e.id, jp: T[0], q: T[1], a: T[2], o: EVENTS[e.k].o, def: EVENTS[e.k].def }); } if (!ITEMS.length) ITEMS.push(routine(api)); }
  ITEMS.forEach(it => { it.order = shuffle(it.a.map((_, i) => i)); });
  k = 0; step = 'read'; checked = null;
}
function show(api) {
  const it = ITEMS[k], P = $('#p-item');
  if (!it) { P.innerHTML = '<div class="m">議題なし · nothing on the table.</div>'; return; }
  const E = it.o;
  P.innerHTML = `<div class="nh"><span>役員会議 · BOARD MEETING · ITEM ${k + 1} OF ${ITEMS.length}</span><span>${it.k === 'routine' ? '定例 ROUTINE' : EVENTS[it.k].j + ' · ' + EVENTS[it.k].en.toUpperCase()}</span></div>
    <div class="jp kj">${rb(it.jp)}</div>
    ${step === 'read' ? `<div class="q"><b>確認 · CHECK</b> ${esc(it.q)}</div><div class="ops">${it.order.map((i, n) => `<button type="button" class="op" data-n="${n}"><span class="key">${n + 1}</span>${esc(it.a[i])}</button>`).join('')}</div>`
      : `<div class="q"><b>${checked ? '理解 · UNDERSTOOD' : '誤解 · MISREAD'}</b> ${checked ? 'every option is on the table.' : `it was “${esc(it.a[0])}”. Only the safe option is left.`}</div>
      <div class="ops">${E.map(([j, en, d], i) => { const open = checked || i === it.def; return `<button type="button" class="op dec${open ? '' : ' lock'}" data-i="${i}" ${open ? '' : 'disabled'}><span class="key">${String.fromCharCode(65 + i)}</span><span><b class="kj">${j}</b> ${en}<br><small>${esc(d)}</small></span></button>`; }).join('')}</div>`}`;
  P.querySelectorAll('[data-n]').forEach(b => b.onclick = () => check(api, +b.dataset.n));
  P.querySelectorAll('[data-i]').forEach(b => b.onclick = () => decide(api, +b.dataset.i));
}
function check(api, n) { const it = ITEMS[k]; if (step !== 'read') return; checked = it.order[n] === 0; step = 'decide'; sfx(checked ? 'ok' : 'ng'); api.log(it.k === 'routine' ? '定例' : EVENTS[it.k].j, checked ? '読解 ✓' : '読解 ✗', checked ? 'all options' : 'safe only', checked ? 'y' : 'r'); show(api); }
function decide(api, i) {
  const it = ITEMS[k]; if (step !== 'decide' || !(checked || i === it.def)) return;
  if (it.k === 'routine') { if (i === 1) setPolicy(api.SAVE, 'pr', 1); if (i === 2) setPolicy(api.SAVE, 'eco', Math.min(2, api.SAVE.sim.pol.eco + 1)); }
  else resolve(api.SAVE, it.id, i);
  done++; api.persist(); sfx('coin'); api.log(it.o[i][0], it.o[i][1], 'decided', 'y'); seats(api);
  k++; step = 'read'; checked = null; if (k >= ITEMS.length) { setTimeout(() => api.end(), 600); $('#p-item').innerHTML = '<div class="m">閉会 · the meeting is closed.</div>'; } else show(api);
}
function seats(api) {
  const S = api.SAVE.sim; if (!S || S.v !== 2) return;
  $('#p-seat').innerHTML = SEATS.map(([j, en, f]) => { const v = S.fac[f]; return `<div class="seat"><span class="ic" style="color:${v < 30 ? 'var(--red)' : 'var(--y)'}">${ICON[f](28)}</span><span><b class="kj">${j}</b> <span class="m">${en}</span><br><span class="bar"><s style="width:${v}%;background:${v < 30 ? 'var(--red)' : 'var(--y)'}"></s></span></span><span class="v">${Math.round(v)}</span></div>`; }).join('') +
    `<div class="seat"><span class="ic" style="color:var(--y)">${ICON.ai(28)}</span><span><b class="kj">カラット</b> <span class="m">the AI · 暴走度</span></span><span class="v">${S.bousou.toFixed(1)}</span></div>`;
}

game({
  id: 'hq', site: 'hq', tier: 4, code: 'HQ-09', jp: '本社', en: 'Headquarters', sub: 'THE BOARDROOM · THE TOP OF THE CROWN', title: '役員会議', dur: 0,
  skills: [],
  lead: 'The board puts the planet\'s waiting decisions on the table, written in Japanese with furigana. Read the item and answer the check (<span class="key">1</span>–<span class="key">4</span>): right, and every option is open; wrong, and only the safe one is left (<span class="key">A</span>–<span class="key">C</span>). The choices move factions, stability, funds and 暴走度. With nothing waiting, the board holds a routine review.',
  how: [['READ · 読解', '議題を読む', 'Each item in Japanese, furigana on every kanji.'], ['CHECK · 確認', '理解を示す', 'One question in English about what you just read.'], ['DECIDE · 決定', '選択肢', 'Understood: all options. Misread: only the safe one.']],
  stats: [['議題', 'ITEMS', () => `${Math.min(k + 1, ITEMS.length)}/${ITEMS.length}`], ['決定', 'DECIDED', () => done]],
  goLabel: '開会 · Open the meeting', againLabel: '次の会議 · Next meeting', clock: () => 'MEETING',
  blocked: api => !(api.SAVE.sim && api.SAVE.sim.v === 2),
  notes: api => !(api.SAVE.sim && api.SAVE.sim.v === 2) ? '<div class="note r">The planet\'s simulation hasn\'t started yet: open the core once.</div>' : `<div class="note">${api.SAVE.sim.ev.length ? api.SAVE.sim.ev.length + ' decision' + (api.SAVE.sim.ev.length > 1 ? 's' : '') + ' waiting on the table.' : 'Nothing waiting: a routine review.'}</div>`,
  init(api) {
    const css = document.createElement('style'); css.textContent = `
      #p-item { padding:14px 18px; } #p-item .nh { display:flex; justify-content:space-between; font:700 10px var(--mono); letter-spacing:.16em; color:var(--y); margin-bottom:10px; }
      #p-item .jp { font-size:25px; line-height:2.1; } #p-item ruby rt { font-size:11px; }
      #p-item .q { margin:12px 0 10px; font-size:13px; color:#C9CDD6; } #p-item .q b { color:var(--y); font:700 10px var(--mono); letter-spacing:.14em; margin-right:8px; }
      #p-item .ops { display:grid; grid-template-columns:1fr 1fr; gap:8px; } .op { display:flex; gap:10px; align-items:center; text-align:left; background:#0B0C0E; border:1px solid var(--line2); color:var(--ink); padding:9px 12px; cursor:pointer; font:500 12px var(--mono); }
      .op:hover:not(:disabled) { border-color:var(--y); } .op.lock { opacity:.3; cursor:not-allowed; } .op small { color:#B8BCC6; } .op.dec { grid-column:span 1; }
      .seat { display:grid; grid-template-columns:34px 1fr 34px; gap:8px; align-items:center; padding:6px 0; border-bottom:1px solid #15171B; } .seat .kj { font-size:14px; } .seat .v { font:700 15px Tektur; text-align:right; }
      .seat .bar { display:block; height:5px; background:#1A1C21; margin-top:3px; position:relative; } .seat .bar s { position:absolute; left:0; top:0; bottom:0; }`;
    document.head.appendChild(css);
    panel('pi', { x: 260, y: 300, w: 760, h: 408 }, '議題 · THE ITEM ON THE TABLE', 'ITEM').id = 'p-item';
    panel('ps', { x: 1032, y: 300, w: 236, h: 280 }, '出席者 · AT THE TABLE', 'SEAT').id = 'p-seat';
    const lg = panel('pg', { x: 12, y: 300, w: 236, h: 408 }, '議事録 · MINUTES', 'LOG'); lg.id = 'g-log'; lg.classList.add('log');
    seats(api);
  },
  start(api) { done = 0; build(api); $('#g-log').innerHTML = ''; seats(api); show(api); },
  key(e, api) {
    if (step === 'read' && /^[1-4]$/.test(e.key)) { check(api, +e.key - 1); return true; }
    const i = 'abc'.indexOf(e.key.toLowerCase()); if (step === 'decide' && i >= 0) { decide(api, i); return true; }
  },
  end(api) { return { title: '閉会', rows: [['items decided', done, 'y'], ['understood', '—'], ['waiting now', (api.SAVE.sim ? api.SAVE.sim.ev.length : 0)]], effect: { items: done } }; },
  draw(cx, t, dt, api) {
    cx.fillStyle = '#050607'; cx.fillRect(0, 0, 1280, 720);
    /* the window wall: the company city at night */
    const g = cx.createLinearGradient(0, 50, 0, 290); g.addColorStop(0, '#07080B'); g.addColorStop(1, '#12141A'); cx.fillStyle = g; cx.fillRect(0, 50, 1280, 240);
    for (let i = 0; i < 46; i++) { const x = i * 29 + (i * 37 % 11), h = 40 + (i * 53 % 120), y = 290 - h; cx.fillStyle = '#0B0C10'; cx.fillRect(x, y, 24, h); for (let w = 0; w < h / 9; w++) for (let q = 0; q < 3; q++) if ((i * 7 + w * 3 + q) % 5 === 0) { cx.fillStyle = (i + w) % 9 ? 'rgba(255,240,180,.55)' : 'rgba(255,230,0,.8)'; cx.fillRect(x + 3 + q * 7, y + 4 + w * 9, 4, 4); } }
    for (let x = 0; x < 1280; x += 160) { cx.fillStyle = '#1A1C21'; cx.fillRect(x, 50, 6, 240); }
    /* the AI's screen at the head of the table */
    cx.fillStyle = '#0A0A07'; cx.fillRect(560, 90, 160, 110); cx.strokeStyle = Y; cx.strokeRect(560.5, 90.5, 160, 110);
    drawLeaf(cx, 640 - 46.5, 96, 3, { N: 31, pulse: t * 4 });
    cx.fillStyle = '#8A909C'; cx.font = '700 9px "M PLUS 1 Code"'; cx.textAlign = 'center'; cx.fillText('カラット · THE AI ATTENDS', 640, 216); cx.textAlign = 'left';
    /* the long table */
    cx.fillStyle = '#121418'; cx.beginPath(); cx.moveTo(560, 230); cx.lineTo(720, 230); cx.lineTo(1000, 296); cx.lineTo(280, 296); cx.fill(); cx.strokeStyle = '#2E333C'; cx.stroke();
    for (let s = 0; s < 4; s++) { const u = (s + 1) / 5; for (const side of [-1, 1]) { const x = 640 + side * (90 + u * 280), y = 232 + u * 60; cx.fillStyle = '#1C1F25'; cx.fillRect(x - 12, y - 30, 24, 26); cx.fillStyle = '#2A2E36'; cx.beginPath(); cx.arc(x, y - 38, 8, 0, 7); cx.fill(); } }
  }
});
