// Follow-the-chant mode. One pass, no level break. The doll is drawn only;
// it is never pushed into `enemies`, so it does not walk or attack.

const RHYTHM_COPY = {
  S: ["成首打完。", "口齒清楚，部位都打中。"],
  A: ["跟得幾齊。", "大半隻咒都打中。"],
  B: ["總算跟完。", "有幾隻字走咗雞。"],
  C: ["打完場。", "再跟多次會順啲。"],
  quit: ["收工。", "跟到呢度，結算如下。"],
};

let chant = null;
let chantT = 0;
let chantHits = 0;
let chantShots = 0;
let chantCombo = 0;
let chantBest = 0;
let chantPerfects = 0;
let chantSpoken = 0;
let chantEnded = false;
let chantVoice = null;
let chantSpeech = false;
let chantBoundary = false;
let speakToken = 0;
let doll = null;
let chantDoll = "tongue";
let chantAudio = null;
let chantAudioStarted = false;
let chantUseAudio = false;

function pickChantVoice() {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => /zh-HK|yue|zh-TW/i.test(v.lang))
    || voices.find((v) => /^zh/i.test(v.lang))
    || null;
}

function refreshChantVoice() {
  chantVoice = pickChantVoice();
  chantSpeech = !!chantVoice;
}

function bindChantVoice() {
  if (!window.speechSynthesis) return;
  refreshChantVoice();
  window.speechSynthesis.addEventListener("voiceschanged", refreshChantVoice);
}

function ensureChantAudio() {
  if (chantAudio && chantAudio.getAttribute("data-chant") === CHANT_AUDIO) return;
  if (chantAudio) {
    chantAudio.pause();
    chantAudio.removeAttribute("src");
  }
  chantAudio = new Audio(CHANT_AUDIO);
  chantAudio.setAttribute("data-chant", CHANT_AUDIO);
  chantAudio.preload = "auto";
}

function stopRhythm() {
  speakToken++;
  chantEnded = true;
  chantAudioStarted = false;
  chantUseAudio = false;
  if (chantAudio) {
    chantAudio.pause();
    chantAudio.currentTime = 0;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

function makeDoll(type) {
  const size = Math.max(2, ENEMY_TYPES[type].size) * 2 * 1.3;
  const y = stopCenter({size: size});
  return {
    type: type,
    x: PLAYER_X,
    y: y,
    homeX: PLAYER_X,
    hp: 1,
    maxHp: 1,
    size: size,
    speed: 0,
    nextAttack: 99,
    phase: 0,
    hide: 1,
    stun: 0,
    flash: 0,
    seen: true,
    walk: 0,
    rot: 0,
    dead: false,
    lane: 0,
  };
}

function initRhythm() {
  refreshChantVoice();
  chant = buildChantChart();
  chantT = 0;
  chantHits = chantShots = chantCombo = chantBest = chantPerfects = chantSpoken = 0;
  chantEnded = false;
  chantBoundary = false;
  speakToken++;
  chantAudioStarted = false;
  chantUseAudio = false;
  chantDoll = CHANT_DOLLS[randInt(0, CHANT_DOLLS.length - 1)];
  doll = makeDoll(chantDoll);
  ensureChantAudio();
  chantAudio.pause();
  chantAudio.currentTime = 0;
  chantAudio.muted = !!muted;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

function rhythmHold(pausedNow) {
  if (!chantAudio) return;
  if (pausedNow) {
    chantAudio.pause();
    return;
  }
  if (chantAudioStarted) chantAudio.play();
}

function rhythmOnMute() {
  if (chantAudio) chantAudio.muted = !!muted;
}

function beginChantAudio() {
  if (chantAudioStarted || !chantAudio || paused) return;
  chantAudioStarted = true;
  chantAudio.muted = !!muted;
  try { chantAudio.currentTime = Math.max(0, chantT - CHANT_LEAD); } catch (err) { /* metadata may still be loading */ }
  const pending = chantAudio.play();
  if (!pending) {
    chantUseAudio = true;
    return;
  }
  pending.then(() => { chantUseAudio = true; }).catch(() => { chantUseAudio = false; });
}

function speakChantChar(ch) {
  if (!chantSpeech || muted || paused || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  const token = ++speakToken;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(ch);
  utter.lang = "zh-HK";
  if (chantVoice) utter.voice = chantVoice;
  utter.rate = 1.15;
  utter.onboundary = () => { chantBoundary = true; };
  window.setTimeout(() => {
    if (token !== speakToken || muted || paused || chantEnded || mode !== "rhythm") return;
    if (synth.paused) synth.resume();
    synth.speak(utter);
  }, 40);
}

function playChantBed(note) {
  if (chantSpeech) speakChantChar(note.char);
  else tone(note.freq, 0.16, "triangle", 0.07);
}

function upcomingLine() {
  let line = 0;
  for (let i = 0; i < chant.notes.length; i++) {
    if (chant.notes[i].time > chantT + 0.05) break;
    line = chant.notes[i].line;
  }
  return line;
}

function syncDoll() {
  if (doll && doll.type === chantDoll) return;
  doll = makeDoll(chantDoll);
}

function noteInWindow() {
  let best = null;
  let bestAbs = CHANT_GOOD + 1;
  for (let i = 0; i < chant.notes.length; i++) {
    const note = chant.notes[i];
    if (note.judged || !note.hit) continue;
    const dist = Math.abs(chantT - note.time);
    if (dist <= CHANT_GOOD && dist < bestAbs) {
      best = note;
      bestAbs = dist;
    }
  }
  return best;
}

function nextVisibleNote() {
  for (let i = 0; i < chant.notes.length; i++) {
    const note = chant.notes[i];
    if (note.judged) continue;
    if (chantT < note.time - CHANT_APPROACH) break;
    if (chantT > note.time + CHANT_GOOD) continue;
    return note;
  }
  return null;
}

function visiblePrompt() {
  for (let i = 0; i < chant.notes.length; i++) {
    const note = chant.notes[i];
    if (note.judged || !note.part) continue;
    if (chantT < note.time - CHANT_APPROACH) break;
    if (chantT > note.time + CHANT_GOOD) continue;
    return note;
  }
  return null;
}

// Fractions of the drawn sprite frame, measured from each picture.
const PART_LAYOUT = {
  tongue: {
    head: [[0.20, 0.10, 0.60, 0.30]],
    face: [[0.24, 0.18, 0.52, 0.22]],
    eye: [[0.28, 0.20, 0.44, 0.10]],
    ear: [[0.14, 0.24, 0.16, 0.14], [0.70, 0.24, 0.16, 0.14]],
    mouth: [[0.40, 0.32, 0.30, 0.36]],
    belly: [[0.30, 0.58, 0.40, 0.20]],
    hand: [[0.12, 0.50, 0.20, 0.20], [0.68, 0.50, 0.18, 0.20]],
    foot: [[0.30, 0.84, 0.42, 0.12]],
    body: [[0.26, 0.48, 0.48, 0.32]],
  },
  office: {
    head: [[0.08, 0.06, 0.84, 0.46]],
    face: [[0.12, 0.16, 0.76, 0.34]],
    eye: [[0.20, 0.18, 0.60, 0.14]],
    ear: [[0.06, 0.20, 0.16, 0.16], [0.78, 0.20, 0.16, 0.16]],
    mouth: [[0.24, 0.34, 0.52, 0.16]],
    belly: [[0.34, 0.58, 0.34, 0.18]],
    hand: [[0.16, 0.64, 0.24, 0.22], [0.64, 0.62, 0.16, 0.16]],
    foot: [[0.22, 0.84, 0.46, 0.12]],
    body: [[0.28, 0.52, 0.44, 0.28]],
  },
  rotten: {
    head: [[0.34, 0.40, 0.42, 0.20]],
    face: [[0.38, 0.43, 0.36, 0.15]],
    eye: [[0.40, 0.44, 0.32, 0.08]],
    ear: [[0.33, 0.43, 0.10, 0.10], [0.64, 0.43, 0.10, 0.10]],
    mouth: [[0.46, 0.51, 0.18, 0.07]],
    belly: [[0.42, 0.80, 0.24, 0.10]],
    hand: [[0.20, 0.76, 0.16, 0.12], [0.74, 0.76, 0.16, 0.12]],
    foot: [[0.43, 0.935, 0.22, 0.055]],
    body: [[0.36, 0.66, 0.34, 0.22]],
  },
  luck: {
    head: [[0.08, 0.02, 0.84, 0.36]],
    face: [[0.16, 0.10, 0.68, 0.28]],
    eye: [[0.30, 0.16, 0.40, 0.12]],
    ear: [[0.06, 0.14, 0.16, 0.18], [0.78, 0.14, 0.16, 0.18]],
    mouth: [[0.36, 0.26, 0.28, 0.12]],
    belly: [[0.30, 0.42, 0.40, 0.28]],
    hand: [[0.18, 0.48, 0.18, 0.22], [0.66, 0.50, 0.24, 0.22]],
    foot: [[0.26, 0.78, 0.48, 0.20]],
    body: [[0.28, 0.40, 0.44, 0.34]],
  },
};

function partBoxes(enemy, part) {
  const body = enemyBox(enemy);
  const layout = PART_LAYOUT[enemy.type] || PART_LAYOUT.luck;
  const rects = layout[part] || layout.head;
  const boxes = [];
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    boxes.push({
      x: body.x + body.w * r[0],
      y: body.y + body.h * r[1],
      w: body.w * r[2],
      h: body.h * r[3],
    });
  }
  return boxes;
}

function qteSpots(enemy, part) {
  const boxes = partBoxes(enemy, part);
  const spots = [];
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    spots.push({
      x: box.x + box.w / 2,
      y: box.y + box.h / 2,
      r: Math.max(22, Math.min(box.w, box.h) * 0.62),
    });
  }
  return spots;
}

function hitsPart(note, x, y) {
  const spots = qteSpots(doll, note.part);
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    const dx = x - spot.x;
    const dy = y - spot.y;
    if (dx * dx + dy * dy <= spot.r * spot.r) return true;
  }
  return false;
}

function judgeNote(note, ok) {
  const dist = Math.abs(chantT - note.time);
  note.judged = ok ? (dist <= CHANT_PERFECT ? "perfect" : "good") : "miss";
  chantShots++;
  swing = 1;
  sfxSwing();
  if (!ok) {
    chantCombo = 0;
    floater(doll.x, doll.y - 70, "MISS", "#ff8a8a", true);
    return;
  }
  chantHits++;
  chantCombo++;
  if (chantCombo > chantBest) chantBest = chantCombo;
  if (note.judged === "perfect") chantPerfects++;
  doll.flash = 0.12;
  paperBurst(doll.x, doll.y - 10, "#f4f1e8", note.part ? 8 : 5);
  floater(doll.x, doll.y - 78, note.char, "#ffd166", true);
  if (note.judged === "perfect") sfxCrit();
  else sfxHit();
}

function rhythmPointer(x, y) {
  if (!chant || chantEnded) return;
  const note = noteInWindow();
  if (note) {
    judgeNote(note, hitsPart(note, x, y));
    return;
  }
  const cue = visiblePrompt();
  if (!cue || !cue.hit || hitsPart(cue, x, y)) return;
  judgeNote(cue, false);
}

function rhythmKey() {
  if (!chant || chantEnded) return;
}

function updateRhythm(dt) {
  if (!chant || chantEnded) return false;
  if (chantT >= CHANT_LEAD) beginChantAudio();
  if (chantUseAudio && chantAudio && !chantAudio.paused && !chantAudio.ended) {
    chantT = CHANT_LEAD + chantAudio.currentTime;
  } else {
    chantT += dt;
  }
  if (doll) {
    doll.walk += dt * 8;
    if (doll.flash > 0) doll.flash = Math.max(0, doll.flash - dt);
  }
  for (let i = 0; i < chant.notes.length; i++) {
    const note = chant.notes[i];
    if (note.judged) continue;
    if (!note.hit) {
      if (chantT > note.time) note.judged = "read";
      continue;
    }
    if (chantT <= note.time + CHANT_GOOD) continue;
    note.judged = "miss";
    chantShots++;
    chantCombo = 0;
    floater(doll ? doll.x : PLAYER_X, doll ? doll.y - 70 : 200, "MISS", "#ff8a8a", true);
  }
  syncDoll();
  const audioOver = chantUseAudio && chantAudio && chantAudio.ended;
  if (audioOver || chantT >= chant.duration) {
    stopRhythm();
    return true;
  }
  return false;
}

function rhythmStats() {
  return {
    hits: chantHits,
    shots: chantShots,
    combo: chantCombo,
    best: chantBest,
    perfects: chantPerfects,
  };
}

function rhythmBurn() {
  if (!chant || !chant.duration) return 0;
  return Math.max(0, Math.min(1, chantT / chant.duration));
}

function drawPartCue(note) {
  const spots = qteSpots(doll, note.part);
  const remain = Math.max(0, note.time - chantT);
  const close = 1 - Math.min(1, remain / CHANT_APPROACH);
  const scale = 2.8 - 1.8 * close;
  ctx.save();
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,209,102,0.22)";
    ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = "#fff6d8";
    ctx.lineWidth = 3;
    ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = close > 0.82 ? "#ffd166" : "#c8321f";
    ctx.lineWidth = 5;
    ctx.arc(spot.x, spot.y, spot.r * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  const label = CHANT_PART_LABEL[note.part];
  const top = spots[0];
  ctx.font = '900 32px "Noto Serif TC", "PMingLiU", serif';
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#151019";
  ctx.fillStyle = "#ffd166";
  ctx.strokeText(label, top.x, top.y - top.r - 10);
  ctx.fillText(label, top.x, top.y - top.r - 10);
  ctx.restore();
}

function canvasFromStage(el, edge) {
  const stage = document.getElementById("stage");
  if (!el || !stage) return 0;
  const stageBox = stage.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  const scale = stageBox.height / FIELD.h || 1;
  const y = edge === "top" ? box.top : box.bottom;
  return (y - stageBox.top) / scale;
}

function portraitLyricRows(text) {
  let cut = text.indexOf("，");
  if (cut >= 0) return [text.slice(0, cut + 1), text.slice(cut + 1)];
  cut = text.indexOf(",");
  if (cut >= 0) return [text.slice(0, cut + 1), text.slice(cut + 1).replace(/^\s+/, "")];
  return [text];
}

function lyricPieces(text) {
  if (!chantWords) {
    return Array.from(text).map((ch) => ({
      text: ch,
      note: ch !== "，" && ch !== " " && ch !== "、" && ch !== "。",
      gap: 4,
    }));
  }
  const pieces = [];
  const re = /[A-Za-z']+|[,;.]|\s+/g;
  let match;
  while ((match = re.exec(text))) {
    const token = match[0];
    const note = /^[A-Za-z']+$/.test(token);
    pieces.push({text: token, note: note, gap: note ? 6 : 0});
  }
  return pieces;
}

function cueCeiling() {
  let top = doll ? doll.y - spriteHalf(doll) : FIELD.h * 0.55;
  if (!doll) return top;
  const parts = ["head", "face", "eye", "ear", "mouth", "belly", "hand", "foot", "body"];
  for (let i = 0; i < parts.length; i++) {
    const spots = qteSpots(doll, parts[i]);
    for (let s = 0; s < spots.length; s++) {
      top = Math.min(top, spots[s].y - spots[s].r * 2.8);
    }
  }
  const incense = document.querySelector(".incense");
  if (incense) top = Math.min(top, canvasFromStage(incense, "top"));
  return top - 12;
}

function lyricLayout(text) {
  const portrait = FIELD.h > FIELD.w;
  const rows = portrait ? portraitLyricRows(text) : [text];
  ctx.font = '700 28px "Noto Serif TC", "PMingLiU", serif';
  const widths = rows.map((row) => {
    let total = 0;
    const pieces = lyricPieces(row);
    for (let i = 0; i < pieces.length; i++) total += ctx.measureText(pieces[i].text).width + pieces[i].gap;
    return total;
  });
  const blockH = portrait ? rows.length * 40 : 46;
  let top = 96;
  if (portrait) {
    const hud = canvasFromStage(document.querySelector("#hud .statrow"), "bottom") + 16;
    const half = blockH / 2;
    let center = FIELD.h / 2;
    const minCenter = hud + half;
    const maxCenter = cueCeiling() - half;
    if (maxCenter > minCenter) center = Math.min(Math.max(center, minCenter), maxCenter);
    else center = minCenter;
    top = center - half;
  }
  return {portrait, rows, widths, top, blockH, textW: Math.max.apply(null, widths)};
}

function drawKaraoke() {
  const lineIndex = upcomingLine();
  const line = CHANT_LINES[lineIndex].text;
  const notes = [];
  for (let i = 0; i < chant.notes.length; i++) {
    if (chant.notes[i].line === lineIndex) notes.push(chant.notes[i]);
  }
  const layout = lyricLayout(line);
  ctx.fillStyle = "rgba(21,16,25,0.62)";
  if (layout.portrait) {
    const barX = (FIELD.w - layout.textW) / 2 - 16;
    ctx.fillRect(barX, layout.top, layout.textW + 32, layout.blockH + 8);
  } else {
    ctx.fillRect(0, layout.top, FIELD.w, layout.blockH);
  }
  ctx.font = '700 28px "Noto Serif TC", "PMingLiU", serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const next = nextVisibleNote();
  let seen = 0;
  const baseline = layout.portrait ? 30 : 32;
  for (let r = 0; r < layout.rows.length; r++) {
    const pieces = lyricPieces(layout.rows[r]);
    let x = (FIELD.w - layout.widths[r]) / 2;
    const y = layout.top + baseline + r * 40;
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      let color = "#9aa4b5";
      if (piece.note) {
        const note = notes[seen++];
        if (!note) color = "#9aa4b5";
        else if (note.judged === "perfect" || note.judged === "good") color = "#ffd166";
        else if (note.judged === "miss") color = "#ff5a3c";
        else if (note.judged === "read") color = "#f4f1e8";
        else if (note === next) color = "#fff6d8";
      }
      ctx.fillStyle = color;
      ctx.fillText(piece.text, x, y);
      x += ctx.measureText(piece.text).width + piece.gap;
    }
  }
}

function drawRhythm() {
  if (!chant || !doll) return;
  drawKaraoke();
  drawEnemy(doll);
  const cue = visiblePrompt();
  if (cue) drawPartCue(cue);
}

bindChantVoice();
