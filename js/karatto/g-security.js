/* カラット: 保安部, security. A rival AI is encrypting keys of the memory wall. Each targeted key brings up a word
   you committed to memory (weighted toward old ones you rarely see): type its reading before the encryption bar
   fills. A word lost in a real breach becomes compromised until you prove it again in any game. Without a breach
   on the planet, the room runs drills (nothing is lost). Skill: reading, typed. */
import { game, panel, typer, sameReading, esc, clamp, Y, RED, OK, sfx, $ } from './game.js?v=7';

let TG = [], k = 0, enc = 0, fw = 100, T, real = false, rival = '', done = false, FX = [], RACK = [];
const ENC = api => 7 * (api.tech.fire ? 1.3 : 1);
function targets(api) {
  const mem = api.MEM.slice().sort((a, b) => { const A = api.SAVE.words[a.id] || {}, B = api.SAVE.words[b.id] || {}; return ((A.seen || A.cert || 0) - (B.seen || B.cert || 0)) + (Math.random() - .5) * 864e5 * 6; });
  let list = mem.slice(0, real ? 12 : 10);
  if (list.length < (real ? 12 : 10)) list = list.concat(api.LEARN.sort(() => Math.random() - .5).slice(0, (real ? 12 : 10) - list.length));
  return list.map(w => ({ w, st: 'wait' }));
}
function next(api) {
  while (k < TG.length && TG[k].st !== 'wait') k++;
  if (k >= TG.length || fw <= 0) { if (!done) { done = true; if (fw <= 0) TG.forEach(t => { if (t.st === 'wait' || t.st === 'cur') lose(api, t, true); }); setTimeout(() => api.end(), 900); } return; }
  TG[k].st = 'cur'; enc = 0; T.set(`<span class="kj">${esc(TG[k].w.w)}</span>`); T.clear(); sfx('alarm');
}
function lose(api, t, quiet) {
  t.st = 'lost'; FX.push({ i: TG.indexOf(t), t: 0 });
  if (real && api.isMem(t.w)) { api.SAVE.words[t.w.id].comp = Date.now(); }
  if (!quiet) { api.log(t.w.w, '✗ ' + t.w.r, real ? 'compromised' : 'lost', 'r'); sfx('ng'); }
}
function submit(api, v) {
  const t = TG[k]; if (!t || t.st !== 'cur' || done) return;
  const ok = sameReading(v, [t.w.r]); api.record(t.w, 'reading', ok, 'typed'); T.flash(ok);
  if (ok) { t.st = 'held'; api.G.yen += real ? 60 : 20; sfx('ok'); api.log(t.w.w, t.w.r, 'held', 'y'); k++; next(api); }
  else { fw = Math.max(0, fw - 6); T.clear(); sfx('buzz'); if (fw <= 0) next(api); }
}

game({
  id: 'security', site: 'security', tier: 2, code: 'SEC-08', jp: '保安部', en: 'Security', sub: 'THE SECURITY OPERATIONS ROOM', title: '侵入防衛', dur: 0,
  skills: ['reading'],
  lead: 'The memory wall is under attack. Each targeted key brings up a word you have committed to memory, weighted toward old ones you rarely see. Type its <b>reading</b> before the encryption bar fills. A wrong reading costs 6% of the firewall; at 0% the breach takes everything left. In a real breach, a lost word becomes <b>compromised</b>: proved again in any game, it comes back.',
  how: [['TARGET · 標的', '古い記憶から', 'Words you committed long ago and rarely see are attacked first.'], ['TYPE · 入力', '暗号化の前に', 'Romaji → kana. Seven seconds a key (Firewall tech: nine).'], ['FIREWALL · 防壁', '残り %', 'Each miss −6%. At zero the rest of the keys are lost.']],
  stats: [['防壁', 'FIREWALL', () => fw + '%'], ['防衛', 'HELD', () => TG.filter(t => t.st === 'held').length], ['喪失', 'LOST', () => TG.filter(t => t.st === 'lost').length]],
  goLabel: '防衛開始 · Defend',
  notes(api) { const b = api.SAVE.sim && api.SAVE.sim.breach && api.SAVE.sim.breach.open; real = !!b && !api.preview; rival = b ? b.rival : '';
    return real ? `<div class="note r"><b class="r">侵入警報 BREACH IN PROGRESS</b> · ${esc(rival)}'s AI is encrypting your memory. Words lost here become compromised.</div>` : '<div class="note">演習 DRILL · no breach on the planet right now. Nothing can be lost; the evidence still counts.</div>'; },
  clock: () => real ? 'BREACH' : 'DRILL',
  init(api) {
    const lg = panel('pg', { x: 1032, y: 300, w: 236, h: 244 }, '記録 · LOG', 'LOG'); lg.id = 'g-log'; lg.classList.add('log');
    panel('pa', { x: 12, y: 300, w: 236, h: 244 }, '攻撃 · WAVE', 'ATK').id = 'p-atk';
    T = typer({ x: 12, y: 560, w: 1256, h: 148, skip: '—' }, v => submit(api, v), () => {});
    for (let i = 0; i < 2; i++) for (let j = 0; j < 30; j++) RACK.push({ x: i ? 1050 + (j % 3) * 70 : 30 + (j % 3) * 70, y: 66 + Math.floor(j / 3) * 22, p: Math.random() * 6 });
  },
  start(api) {
    const b = api.SAVE.sim && api.SAVE.sim.breach && api.SAVE.sim.breach.open; real = !!b && !api.preview; rival = b ? b.rival : 'TRAINING AI';
    if (!api.MEM.length && !api.LEARN.length) return;
    TG = targets(api); k = 0; fw = 100; done = false; FX = []; $('#g-log').innerHTML = ''; T.focus(); next(api);
    $('#p-atk').innerHTML = `<div class="lb">SOURCE</div><div class="kj" style="font-size:20px;color:${real ? 'var(--red)' : 'var(--y)'}">${esc(rival)}</div><div class="lb" style="margin-top:8px">${real ? 'REAL BREACH · LOSSES COMPROMISE WORDS' : 'DRILL · NOTHING CAN BE LOST'}</div><div class="lb" style="margin-top:8px">${TG.length} KEYS TARGETED</div>`;
  },
  tick(dt, api) {
    RACK.forEach(r => r.p += dt * (real ? 6 : 2));
    if (!api.G.run || done) return;
    const t = TG[k]; if (t && t.st === 'cur') { enc += dt / ENC(api); if (enc >= 1) { fw = Math.max(0, fw - 10); lose(api, t); k++; next(api); } }
    FX = FX.filter(f => (f.t += dt) < 1.2);
  },
  end(api) {
    const held = TG.filter(t => t.st === 'held').length, lost = TG.filter(t => t.st === 'lost').length;
    return { title: lost ? (real ? '侵入 · 一部喪失' : '演習終了') : '防衛成功', rows: [['held', held, 'y'], ['lost', lost, lost ? 'r' : ''], ['firewall', fw + '%']],
      effect: { real, held, lost }, extra: real && lost ? `<div class="note r">${lost} word${lost > 1 ? 's are' : ' is'} compromised: <span class="kj">${TG.filter(t => t.st === 'lost').map(t => esc(t.w.w)).join('、')}</span>. Answer them right in any game to restore them.</div>` : '' };
  },
  draw(cx, t, dt, api) {
    const red = real ? RED : Y;
    cx.fillStyle = real ? '#0B0405' : '#060607'; cx.fillRect(0, 0, 1280, 720);
    if (real) { const a = .05 + .05 * Math.sin(t * 4); cx.fillStyle = `rgba(255,59,48,${a})`; cx.fillRect(0, 0, 1280, 720); }
    /* racks with blinking lights */
    RACK.forEach(r => { cx.fillStyle = '#101114'; cx.fillRect(r.x, r.y, 62, 18); for (let q = 0; q < 6; q++) { cx.fillStyle = Math.sin(r.p + q * 1.7) > .6 ? red : '#26282D'; cx.fillRect(r.x + 6 + q * 9, r.y + 7, 4, 4); } });
    /* the wall map: the targeted keys */
    const n = TG.length, kw = 62, gap = 10, x0 = 640 - (n * (kw + gap) - gap) / 2;
    cx.fillStyle = '#8A909C'; cx.font = '700 9px "M PLUS 1 Code"'; cx.fillText(`記憶の壁 · THE MEMORY WALL UNDER ATTACK · ${n} KEYS TARGETED`, x0, 74);
    TG.forEach((g, i) => {
      const x = x0 + i * (kw + gap), y = 84, st = g.st;
      cx.fillStyle = st === 'held' ? '#1A190A' : st === 'lost' ? '#2A0A08' : '#0E0F12'; cx.fillRect(x, y, kw, kw);
      cx.strokeStyle = st === 'held' ? Y : st === 'lost' ? RED : st === 'cur' ? red : `rgba(255,59,48,${.3 + .3 * Math.sin(t * 5 + i)})`; cx.lineWidth = st === 'cur' ? 2 : 1; cx.strokeRect(x + .5, y + .5, kw, kw); cx.lineWidth = 1;
      const ch = g.w.ks[0] || g.w.w[0]; cx.fillStyle = st === 'lost' ? '#7A2A24' : st === 'held' ? Y : '#ECEEF2'; cx.font = '500 30px "M PLUS 1"'; cx.textAlign = 'center';
      cx.fillText(st === 'lost' && Math.random() < .3 ? '▒' : ch, x + kw / 2 + (st === 'lost' ? (Math.random() - .5) * 3 : 0), y + 42); cx.textAlign = 'left';
    });
    /* the current target: a ring of encryption round it */
    const cur = TG[k];
    if (cur && cur.st === 'cur') {
      const cxp = 640, cyp = 330, R = 120;
      cx.strokeStyle = '#1C1F25'; cx.lineWidth = 10; cx.beginPath(); cx.arc(cxp, cyp, R, 0, 7); cx.stroke();
      cx.strokeStyle = red; cx.shadowColor = red; cx.shadowBlur = 14; cx.beginPath(); cx.arc(cxp, cyp, R, -Math.PI / 2, -Math.PI / 2 + enc * Math.PI * 2); cx.stroke(); cx.shadowBlur = 0; cx.lineWidth = 1;
      for (let q = 0; q < 24; q++) { const a = q / 24 * Math.PI * 2 + t * .4; cx.fillStyle = q / 24 < enc ? red : '#2A2E36'; cx.fillRect(cxp + Math.cos(a) * (R + 18) - 2, cyp + Math.sin(a) * (R + 18) - 2, 4, 4); }
      cx.fillStyle = '#ECEEF2'; cx.font = '500 84px "M PLUS 1"'; cx.textAlign = 'center'; cx.fillText(cur.w.w, cxp, cyp + 28);
      cx.fillStyle = red; cx.font = '700 12px "M PLUS 1 Code"'; cx.fillText(`暗号化中 ENCRYPTING · ${Math.round(enc * 100)}% · ${(ENC(api) * (1 - enc)).toFixed(1)}s`, cxp, cyp + R + 48);
      cx.fillStyle = '#8A909C'; cx.font = '700 10px "M PLUS 1 Code"'; const sw = api.SAVE.words[cur.w.id] || {}; cx.fillText(api.isMem(cur.w) ? `KEY ${cur.w.ks[0] || ''} · IN MEMORY SINCE ${new Date(sw.cert).toLocaleDateString('ja-JP')}` : 'TRAINING WORD (NOT IN MEMORY)', cxp, cyp - R - 22); cx.textAlign = 'left';
    }
    /* the firewall */
    cx.fillStyle = '#8A909C'; cx.font = '700 9px "M PLUS 1 Code"'; cx.fillText('防壁 · FIREWALL', 1050, 290 - 0); cx.fillStyle = '#16181C'; cx.fillRect(268, 520, 744, 10); cx.fillStyle = fw > 40 ? Y : RED; cx.fillRect(268, 520, 744 * fw / 100, 10);
    cx.fillStyle = '#8A909C'; cx.fillText(`防壁 FIREWALL ${fw}% · EACH MISS −6% · EACH LOST KEY −10%`, 268, 546);
    for (const f of FX) { const x = x0 + f.i * (kw + gap); cx.globalAlpha = 1 - f.t / 1.2; cx.fillStyle = RED; cx.fillRect(x - 6, 78, kw + 12, kw + 12); cx.globalAlpha = 1; }
  }
});
window.__front = () => TG[k] && TG[k].w.r;
