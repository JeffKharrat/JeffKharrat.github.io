/* カラット: 放送局, the broadcast station. A clip plays through static: the word (or its example sentence) from the
   deck, in its own audio when Anki is open, the browser's Japanese voice otherwise. Pick the word you heard among four
   that sound close. Right: the clip airs. Wrong: a correction goes out. One replay per clip, at half the reward.
   Skill: listening. */
import { game, panel, keycaps, esc, clamp, Y, RED, OK, sfx, audio, $, furi } from './game.js?v=15';
import { ankiAvailable, ankiAudio } from './store.js?v=15';

let cur = null, phase = 'idle', K, aired = 0, pulled = 0, aud = 8, n = 0, gap = 0, env = 0, ANKI = false, noise = null, replayed = false, speaking = 0;
const PROG = ['天気 WEATHER', 'スポーツ SPORTS', '社内広報 COMPANY PR', 'ニュース NEWS', '交通 TRAFFIC', '経済 MARKETS', '地域 LOCAL', '文化 CULTURE'];

function staticOn(level) {
  const ac = audio(); if (!ac) return;
  if (!noise) { const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(); s.buffer = b; s.loop = true; const g = ac.createGain(); g.gain.value = 0; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; s.connect(f); f.connect(g); g.connect(ac.destination); s.start(); noise = g; }
  try { if (localStorage.getItem('karatto.mute') === '1') level = 0; } catch (e) {}
  noise.gain.setTargetAtTime(level * .12, ac.currentTime, .05);
}
async function play() {
  if (!cur) return; phase = 'play'; env = 1; speaking = 1.8; staticOn(cur.static);
  const done = () => { staticOn(cur.static * .25); if (phase === 'play') { phase = 'answer'; K.set(cur.opts, 'jp'); } };
  const s = cur.sent;
  if (ANKI && s && s.audio) { const src = await ankiAudio(s.audio); if (src) { const a = new Audio(src); a.onended = done; a.onerror = done; a.play().catch(done); speaking = 3; return; } }
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(cur.w.r); u.lang = 'ja-JP'; u.rate = .9;
    const v = speechSynthesis.getVoices().find(x => /ja/i.test(x.lang)); if (v) u.voice = v;
    u.onend = done; u.onerror = done; speechSynthesis.cancel(); speechSynthesis.speak(u); setTimeout(() => { if (phase === 'play') done(); }, 3500);
  } else setTimeout(done, 1600);
}
function load(api) {
  const w = api.pick('listen'); if (!w) { cur = null; phase = 'idle'; return; }
  const sent = w.sent && w.sent.find(s => s.audio) || null;
  cur = { w, sent, opts: api.opts(w, 'form', 'reading', 4), static: api.isMem(w) ? .5 : .18, prog: PROG[n % PROG.length] }; n++; replayed = false;
  K.off(); setTimeout(() => api.G.run && play(), 500); queue();
}
function answer(api, i) {
  if (phase !== 'answer' || !cur) return; const o = cur.opts[i]; if (!o) return; K.press(i);
  const ok = o.right; api.record(cur.w, 'listen', ok, 'pick');
  cur.opts.forEach((x, k) => x.right && K.mark(k, 'good')); if (!ok) K.mark(i, 'bad');
  if (ok) { aired++; const fee = api.pay(replayed ? 30 : 60); api.G.yen += fee; aud = clamp(aud + (replayed ? .6 : 1.2), 0, 40); sfx('ok'); api.log(cur.w.w, '聴解 ✓' + (replayed ? ' (replay)' : ''), '+¥' + fee, 'y'); }
  else { pulled++; aud = clamp(aud - 1.5, 0, 40); sfx('ng'); api.log(cur.w.w, '✗ heard ' + o.w, 'correction', 'r'); }
  phase = 'shown'; gap = ok ? 1.6 : 2.8; staticOn(0);
  $('#p-tr').innerHTML = `<div class="kj" style="font-size:26px">${esc(cur.w.w)}</div><div>${esc(cur.w.r)} · ${esc(cur.w.s)}</div>${cur.sent ? `<div class="kj" style="margin-top:8px;font-size:14px;color:#C9CDD6">${esc(furi(cur.sent.jp).replace(/⟦|⟧/g, ''))}</div>` : ''}`;
}
function replay(api) { if (!cur || replayed || (phase !== 'answer' && phase !== 'play')) return; replayed = true; phase = 'play'; K.off(); play(); api.toast('再生 replay · half the reward'); }
function queue() { $('#p-q').innerHTML = Array.from({ length: 6 }, (_, k) => `<div class="e"><span>${String(n + k).padStart(2, '0')} ${PROG[(n - 1 + k) % PROG.length]}</span><span class="${k ? 'm' : 'y'}">${k ? 'queued' : 'NOW'}</span></div>`).join(''); }

game({
  id: 'broadcast', site: 'broadcast', tier: 2, code: 'BRD-06', jp: '放送局', en: 'Broadcast station', sub: 'THE BOOTH · THE MONITOR WALL', title: '放送ブース', dur: 180,
  skills: ['listen'],
  lead: 'A clip plays through static: a word from your deck (its example sentence\'s own audio when Anki is open, the browser\'s Japanese voice otherwise). Pick the word you heard among four that sound close (<span class="key">1</span>–<span class="key">4</span>). Right: it airs. Wrong: a correction goes out. <span class="key">R</span> replays once, for half the reward. The transcript shows only after the answer.',
  how: [['LISTEN · 聴く', '雑音の中で', 'New words come through clean; words in memory come through more static.'], ['PICK · 選ぶ', '似た音', 'Four candidates that sound close, never two with the same reading.'], ['AIR · 放送', '視聴率', 'Aired clips raise the audience, the residents\' mood and the corporation\'s fame.']],
  stats: [['放送', 'AIRED', () => aired], ['訂正', 'PULLED', () => pulled], ['視聴率', 'AUD', () => aud.toFixed(1) + '%'], ['¥', '', a => a.G.yen.toLocaleString()]],
  init(api) {
    ankiAvailable().then(v => ANKI = v);
    panel('pq', { x: 1040, y: 62, w: 228, h: 200 }, '放送予定 · QUEUE', 'Q').id = 'p-q';
    const lg = panel('pg', { x: 1040, y: 272, w: 228, h: 270 }, '記録 · LOG', 'LOG'); lg.id = 'g-log'; lg.classList.add('log');
    panel('pt', { x: 12, y: 380, w: 300, h: 162 }, '原稿 · TRANSCRIPT', 'TXT').id = 'p-tr';
    K = keycaps({ x: 240, y: 560, w: 800, h: 140, cols: 2 }, 4, i => answer(api, i));
    queue();
  },
  start(api) { aired = 0; pulled = 0; aud = 8; n = 0; $('#g-log').innerHTML = ''; $('#p-tr').innerHTML = '<span class="m">shown after each answer</span>'; load(api); },
  tick(dt, api) {
    env = Math.max(0, env - dt * .4); speaking = Math.max(0, speaking - dt);
    if (!api.G.run) { staticOn(0); return; }
    if (phase === 'shown') { gap -= dt; if (gap <= 0) load(api); }
  },
  key(e, api) { if (/^[1-4]$/.test(e.key)) { answer(api, +e.key - 1); return true; } if (e.key === 'r' || e.key === 'R') { replay(api); return true; } },
  end(api) { phase = 'idle'; K.off(); staticOn(0); try { speechSynthesis.cancel(); } catch (e) {}
    return { title: '放送終了', rows: [['aired', aired, 'y'], ['corrections', pulled, pulled ? 'r' : ''], ['audience', aud.toFixed(1) + '%']], effect: { aired } }; },
  draw(cx, t, dt, api) {
    cx.fillStyle = '#060607'; cx.fillRect(0, 0, 1280, 720);
    /* the monitor wall */
    for (let k = 0; k < 8; k++) {
      const x = 330 + (k % 4) * 172, y = 66 + Math.floor(k / 4) * 104, w = 160, h = 92;
      cx.fillStyle = '#0B0C0E'; cx.fillRect(x, y, w, h); cx.strokeStyle = '#2A2E36'; cx.strokeRect(x + .5, y + .5, w, h);
      if (k === 1 && phase !== 'idle') { cx.fillStyle = '#1A190A'; cx.fillRect(x + 4, y + 4, w - 8, h - 8); cx.fillStyle = Y; cx.font = '700 11px "M PLUS 1 Code"'; cx.fillText(cur ? cur.prog : '', x + 10, y + 22); cx.fillStyle = '#ECEEF2'; cx.font = '700 22px Tektur'; cx.fillText(`CLIP ${String(n).padStart(2, '0')}`, x + 10, y + 56); continue; }
      for (let q = 0; q < 160; q++) { const g = Math.random() * 60 | 0; cx.fillStyle = `rgb(${g},${g},${g + 4})`; cx.fillRect(x + 4 + Math.random() * (w - 10), y + 4 + Math.random() * (h - 10), 4, 2); }
      if (k === 6) { const bars = ['#ECEEF2', '#FFE600', '#8A909C', '#3A3F48', '#1C1F25', '#5CFFA0']; bars.forEach((c, b) => { cx.fillStyle = c; cx.fillRect(x + 4 + b * 25, y + 4, 25, h - 8); }); }
    }
    /* ON AIR */
    const onair = phase === 'shown' && cur && aired && gap > 1;
    cx.fillStyle = onair ? Y : '#1C1F25'; cx.fillRect(40, 66, 260, 64); cx.fillStyle = onair ? '#000' : '#3A3F48'; cx.font = '700 34px Tektur'; cx.fillText('ON AIR', 92, 110);
    if (onair) { cx.shadowColor = Y; cx.shadowBlur = 30; cx.strokeStyle = Y; cx.strokeRect(40, 66, 260, 64); cx.shadowBlur = 0; }
    /* the waveform */
    const wy = 330, live = phase === 'play' || speaking > 0;
    cx.fillStyle = '#0A0B0D'; cx.fillRect(330, 290, 680, 130); cx.strokeStyle = '#2A2E36'; cx.strokeRect(330.5, 290.5, 680, 130);
    for (let i = 0; i < 136; i++) {
      const x = 334 + i * 5, sp = live ? (Math.sin(i * .35 + t * 9) * .5 + .5) * Math.exp(-Math.pow((i - 68) / 40, 2)) * (.6 + Math.random() * .5) : 0, st = (cur ? cur.static : .2) * (live ? 1 : .3) * Math.random();
      const h = 4 + sp * 90 + st * 30; cx.fillStyle = sp > .1 ? Y : '#3A3F48'; cx.fillRect(x, wy + 25 - h / 2, 3, h);
    }
    cx.fillStyle = '#8A909C'; cx.font = '700 9px "M PLUS 1 Code"'; cx.fillText(`WAVEFORM · ${ANKI ? 'DECK AUDIO WHEN AVAILABLE' : 'VOICE SYNTH ja-JP'} · STATIC ${Math.round((cur ? cur.static : 0) * 100)}%`, 334, 438);
    cx.fillStyle = phase === 'answer' ? Y : '#8A909C'; cx.font = '700 16px Tektur'; cx.textAlign = 'center'; cx.fillText(phase === 'play' ? '受信中 · RECEIVING' : phase === 'answer' ? 'WHICH WORD DID YOU HEAR? 1–4 · R REPLAY' : phase === 'shown' ? (onair ? '放送 · AIRED' : '訂正 · CORRECTION') : '', 670, 470); cx.textAlign = 'left';
    /* the desk: faders */
    for (let k = 0; k < 10; k++) { const x = 340 + k * 66, lv = live ? .3 + .6 * Math.abs(Math.sin(t * 3 + k)) : .2 + .05 * k % .3; cx.fillStyle = '#121418'; cx.fillRect(x, 486, 8, 60); cx.fillStyle = '#ECEEF2'; cx.fillRect(x - 8, 486 + (1 - lv) * 52, 24, 8); }
    /* the audience meter */
    cx.fillStyle = '#8A909C'; cx.font = '700 9px "M PLUS 1 Code"'; cx.fillText('視聴率 · AUDIENCE', 40, 160); cx.fillStyle = Y; cx.font = '700 54px Tektur'; cx.fillText(aud.toFixed(1) + '%', 40, 216);
    cx.fillStyle = '#16181C'; cx.fillRect(40, 230, 260, 8); cx.fillStyle = Y; cx.fillRect(40, 230, 260 * aud / 40, 8);
    cx.fillStyle = '#8A909C'; cx.font = '700 9px "M PLUS 1 Code"'; cx.fillText(`AIRED ${aired} · CORRECTIONS ${pulled}`, 40, 256);
  }
});
window.__cur = () => cur && cur.opts.findIndex(o => o.right);
