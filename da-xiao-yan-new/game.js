// Playable loop for the 打小人 prototype. Rules live in level.js / enemy.js.
// States: menu -> cutscene -> play x5 -> grade. R restarts, M mutes.

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");
const overlay = document.getElementById("overlay");
const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const markEl = document.getElementById("mark");
const lineEl = document.getElementById("line");
const metaEl = document.getElementById("meta");
const goBtn = document.getElementById("go");
const chantBtn = document.getElementById("chantbtn");
const blitzBtn = document.getElementById("blitzbtn");
const vignette = document.getElementById("vignette");
const stick = document.getElementById("stick");
const officeSheet = new Image();
officeSheet.src = "office-walk.png?v=kpi5";
const oleander = new Image();
oleander.src = "oleander.png?v=2";
const censer = new Image();
censer.src = "censer.png?v=3";
const fog = new Image();
fog.src = "fog.png?v=1";
const backdrop = new Image();
backdrop.src = "bg.jpg?v=1";
const OFFICE_COLS = 6;
const OFFICE_FRAMES = 12;
const rottenSheet = new Image();
rottenSheet.src = "rotten-walk.png?v=flower3";
const ROTTEN_COLS = 6;
const ROTTEN_FRAMES = 12;
const tongueSheet = new Image();
tongueSheet.src = "tongue-walk.png?v=3";
const TONGUE_COLS = 4;
const TONGUE_FRAMES = 12;
const luckSheet = new Image();
luckSheet.src = "luck-walk.png?v=1";
const LUCK_COLS = 8;
const LUCK_FRAMES = 32;

const PLAYER_MAX = 10;
const COPY = {
  S: ["順順利利！", "小人走晒，運程爆燈。"],
  A: ["打得幾爽。", "口舌是非散咗一大截。"],
  B: ["總算打完。", "仲有少少霉氣黏住。"],
  hp: ["頂唔住。", "被小人圍攻，師傅收工。"],
  time: ["支香燒完。", "小人仲未散，霉氣返嚟。"],
  quit: ["收工。", "打到呢度，結算如下。"],
};
const BLITZ_COPY = {
  S: ["打到手上癮。", "三十秒打低一大堆，霉氣散晒。"],
  A: ["手快眼快。", "小人企唔穩，打到佢哋散。"],
  B: ["打完一輪。", "正前方嗰排走咗唔少。"],
  C: ["打完場。", "再快手啲，三十秒可以打更多。"],
  quit: ["收工。", "打到呢度，結算如下。"],
};

let state = "menu";
let mode = "shoot";
let hp = PLAYER_MAX;
let shots = 0;
let hits = 0;
let crits = 0;
let elapsed = 0;
let cutT = 0;
let bannerT = 0;
let muted = false;
let paused = false;
let shake = 0;
let hurtFlash = 0;
let swing = 0;
let hitStop = 0;
let aim = {x: FIELD.w / 2, y: 180};
let floaters = [];
let particles = [];
let endKind = "";
let grade = "";
let audioCtx = null;
let last = performance.now();
let bossGong = false;
let blitzKills = 0;
let modeClicks = 0;

let appliedPortrait = null;

function wantPortrait() {
  const vv = window.visualViewport;
  const vw = vv ? vv.width : window.innerWidth;
  const vh = vv ? vv.height : window.innerHeight;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const shortSide = Math.min(vw, vh);
  if (vw <= 700) return true;
  if (coarse && shortSide <= 820 && vw < 1100) return true;
  return false;
}

function fit() {
  const vv = window.visualViewport;
  const vw = vv ? vv.width : window.innerWidth;
  const vh = vv ? vv.height : window.innerHeight;
  const portrait = wantPortrait();
  if (portrait !== appliedPortrait) {
    appliedPortrait = portrait;
    layoutField(portrait);
    canvas.width = FIELD.w;
    canvas.height = FIELD.h;
    if (typeof doll !== "undefined" && doll) doll = makeDoll(chantDoll);
    aim.x = FIELD.w / 2;
    aim.y = Math.min(aim.y, FIELD.h - 40);
  }
  document.body.classList.toggle("portrait", portrait);
  const scale = Math.min(vw / FIELD.w, vh / FIELD.h);
  const w = Math.floor(FIELD.w * scale);
  const h = Math.floor(FIELD.h * scale);
  stage.style.width = w + "px";
  stage.style.height = h + "px";
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
}
window.addEventListener("resize", fit);
if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
fit();

function ac() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq, dur, type, gain) {
  if (muted) return;
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

function noise(dur, gain, freq) {
  if (muted) return;
  const c = ac();
  const n = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = n.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = n;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start();
}

function shoeGear() {
  return typeof equippedWeapon === "function" ? equippedWeapon() : null;
}

function sfxShoeSlap() { noise(0.06, 0.26, 700); tone(140, 0.05, "triangle", 0.06); }
function sfxShoeDing() { tone(880, 0.08, "sine", 0.07); tone(1320, 0.05, "triangle", 0.04); }
function sfxShoeNail() { noise(0.05, 0.32, 380); tone(90, 0.07, "square", 0.05); }
function sfxShoeTap() { noise(0.03, 0.14, 2200); tone(660, 0.04, "sine", 0.04); }
function sfxUpgradeCoin() { noise(0.05, 0.22, 600); tone(180, 0.07, "triangle", 0.08); }
function sfxUpgradeTicket() { sfxUpgradeCoin(); tone(392, 0.16, "sine", 0.1); tone(523, 0.2, "triangle", 0.08); }
function sfxStitch() { noise(0.04, 0.12, 1600); setTimeout(() => noise(0.03, 0.1, 1900), 70); }
function sfxSwing() {
  const id = shoeGear() && shoeGear().id;
  if (id === "heel") sfxShoeDing();
  else if (id === "spike") sfxShoeNail();
  else if (id === "ballet") sfxShoeTap();
  else sfxShoeSlap();
}
function sfxHit() { noise(0.06, 0.35, 2400); tone(220, 0.07, "triangle", 0.08); }
function sfxCrit() { noise(0.08, 0.3, 1200); tone(180, 0.22, "sine", 0.16); tone(90, 0.35, "triangle", 0.12); }
function sfxHurt() { tone(110, 0.14, "square", 0.06); noise(0.08, 0.2, 400); }
function sfxBoss() { tone(70, 0.55, "sine", 0.2); tone(140, 0.3, "triangle", 0.08); }
function sfxClear() { tone(523, 0.12, "triangle", 0.08); tone(659, 0.16, "triangle", 0.08); }
function sfxWin() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.2, "triangle", 0.09), i * 110)); }
function sfxFail() { [440, 349, 262].forEach((f, i) => setTimeout(() => tone(f, 0.16, "square", 0.05), i * 90)); }

function resetRun() {
  hp = PLAYER_MAX;
  shots = hits = crits = 0;
  elapsed = 0;
  shake = hurtFlash = swing = hitStop = 0;
  floaters = [];
  particles = [];
  endKind = "";
  grade = "";
  bossGong = false;
  paused = false;
  blitzKills = 0;
  modeClicks = 0;
  weaponCd = 0;
  weaponCdMax = 0;
  levelIndex = 0;
  levelTimer = LEVEL_TIME;
  clearEnemies();
  document.querySelectorAll(".hp-pop").forEach((el) => el.remove());
}

function hpPop(amount) {
  const stat = document.getElementById("hpstat");
  const el = document.createElement("b");
  el.className = "hp-pop";
  el.textContent = "-" + amount;
  const stacked = stat.querySelectorAll(".hp-pop").length;
  el.style.marginLeft = (stacked * 28) + "px";
  stat.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function beginRun() {
  if (!spendDurability()) return;
  stopRhythm();
  resetRun();
  mode = "shoot";
  goBtn.dataset.action = "shoot";
  blitzBtn.textContent = "無限打";
  chantBtn.textContent = "跟beat打";
  state = "cutscene";
  cutT = 2.2;
  showOverlay(false);
}

function beginRhythm() {
  if (!spendDurability()) return;
  stopRhythm();
  resetRun();
  mode = "rhythm";
  goBtn.dataset.action = "rhythm";
  blitzBtn.textContent = "無限打";
  chantBtn.textContent = "跟beat打";
  selectChant(randInt(0, 1) === 0 ? "zh" : "en");
  initRhythm();
  state = "play";
  showOverlay(false);
}

function beginBlitz() {
  if (!spendDurability()) return;
  stopRhythm();
  resetRun();
  mode = "blitz";
  goBtn.dataset.action = "blitz";
  blitzBtn.textContent = "無限打";
  chantBtn.textContent = "跟beat打";
  state = "play";
  clearEnemies();
  spawnFrontDoll();
  showOverlay(false);
}

function blitzGrade() {
  if (blitzKills >= 40) return "S";
  if (blitzKills >= 25) return "A";
  if (blitzKills >= 12) return "B";
  return "C";
}

function canvasPos(ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (ev.clientX - r.left) * (canvas.width / r.width),
    y: (ev.clientY - r.top) * (canvas.height / r.height),
  };
}

function puff(x, y, color, n, reach, life, kind) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = reach * (0.35 + Math.random() * 0.65);
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - reach * 0.15,
      life: life * (0.7 + Math.random() * 0.4),
      max: life,
      color: color,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 8,
      w: kind === "spark" ? 2 + Math.random() * 2 : 3 + Math.random() * 4,
      h: kind === "spark" ? 5 : 3 + Math.random() * 3,
      kind: kind,
    });
  }
}

function weaponImpact(x, y) {
  const gear = shoeGear();
  const id = gear ? gear.id : "slipper";
  const level = gear ? gear.owned.level : 1;
  const atk = gear ? gear.stats.atk : 1;
  if (id === "heel") {
    puff(x, y, "#ffd166", 4, 70, 0.28, "spark");
  } else if (id === "spike") {
    const n = Math.max(3, Math.round(atk + 1));
    puff(x, y, "#fff6c8", n, 90, 0.22, "spark");
    puff(x, y, "#c8321f", 2, 40, 0.18, "spark");
    if (level >= 5) shake = Math.max(shake, 6);
  } else if (id === "ballet") {
    puff(x, y, "#f4f1e8", 2 + level, 36, 0.24, "bit");
  } else {
    puff(x, y, "#c4b8a4", 3 + level, 24 + level * 10, 0.4, "dust");
    if (level >= 5) {
      particles.push({
        x, y, vx: 0, vy: 0, life: 0.32, max: 0.32,
        color: "rgba(244,241,232,0.85)", rot: 0, vr: 0,
        w: 8, h: 8, kind: "ring", grow: 80,
      });
    }
  }
}

function paperBurst(x, y, tint, n) {
  const colors = ["#f4f1e8", "#fff6d8", "#ffe08a", tint];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 130;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60,
      life: 0.55 + Math.random() * 0.35,
      max: 0.9,
      color: colors[i % colors.length],
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 16,
      w: 11 + Math.random() * 7,
      h: 6 + Math.random() * 4,
      paper: true,
    });
  }
}

function floater(x, y, text, color, big) {
  floaters.push({x, y, text, color, big, life: 0.7});
}

function shoot(x, y) {
  if (state !== "play" || paused) return;
  if (mode !== "blitz" && weaponCd > 0) return;
  shots++;
  swing = 1;
  hitStop = 0.035;
  sfxSwing();
  if (mode !== "blitz") {
    weaponCdMax = weaponCooldown();
    weaponCd = weaponCdMax;
  }
  if (mode === "blitz") {
    const live = enemies.slice().sort((a, b) => b.y - a.y);
    for (let i = 0; i < live.length; i++) {
      const enemy = live[i];
      if (!inBox(enemyBox(enemy), x, y)) continue;
      const burstX = enemy.x;
      const burstY = enemy.y;
      smackEnemy(enemy);
      hits++;
      blitzKills++;
      weaponImpact(burstX, burstY);
      floater(burstX, burstY - 36, "打", "#ffd166", true);
      return;
    }
    return;
  }
  const order = enemies.slice().sort((a, b) => b.y - a.y);
  for (let i = 0; i < order.length; i++) {
    const enemy = order[i];
    const before = enemy.hp;
    const attack = weaponAttack();
    const dmg = hitEnemy(enemy, x, y, attack);
    if (!dmg) continue;
    hits++;
    const gold = Math.abs(dmg - attack * 2) < 0.001;
    if (gold) crits++;
    const color = gold ? "#ffd166" : "#ff5a3c";
    weaponImpact(enemy.x, enemy.y);
    if (gold) paperBurst(enemy.x, enemy.y - 8, "#ffd166", 5);
    floater(enemy.x, enemy.y - 36, "-" + fmtNum(dmg), color, gold);
    if (gold) floater(enemy.x + 18, enemy.y - 58, "哎呀", "#fff3c4", false);
    if (before - dmg <= 0) paperBurst(enemy.x, enemy.y, "#f4f1e8", 4);
    if (gold) sfxCrit();
    return;
  }
}

function computeGrade() {
  if (endKind !== "win") return "C";
  const acc = shots ? hits / shots : 0;
  if (acc >= 0.7 && hp >= 6) return "S";
  if (acc >= 0.5 || hp >= 4) return "A";
  return "B";
}

function finish(kind) {
  if (state === "win" || state === "lose") return;
  if (mode === "blitz") {
    endKind = kind;
    grade = blitzGrade();
    state = kind === "win" ? "win" : "lose";
    const pair = kind === "quit" ? BLITZ_COPY.quit : BLITZ_COPY[grade];
    titleEl.textContent = kind === "win" ? "打完場" : "收工";
    subtitleEl.textContent = pair[0];
    markEl.style.display = "block";
    markEl.textContent = grade;
    lineEl.textContent = pair[1];
    metaEl.textContent = `三十秒 · 打低 ${blitzKills}` + grantPlayReward(kind, modeClicks > 0);
    goBtn.textContent = "射擊";
    goBtn.dataset.action = "shoot";
    chantBtn.textContent = "跟beat打";
    blitzBtn.textContent = "再打一次";
    showOverlay(true);
    paused = false;
    if (kind === "win") sfxWin();
    return;
  }
  if (mode === "rhythm") {
    endKind = kind;
    const stats = rhythmStats();
    const acc = stats.shots ? stats.hits / stats.shots : 0;
    grade = acc >= 0.9 ? "S" : acc >= 0.75 ? "A" : acc >= 0.5 ? "B" : "C";
    state = kind === "win" ? "win" : "lose";
    const pair = kind === "quit" ? RHYTHM_COPY.quit : RHYTHM_COPY[grade];
    titleEl.textContent = kind === "win" ? "打完場" : "收工";
    subtitleEl.textContent = pair[0];
    markEl.style.display = "block";
    markEl.textContent = grade;
    lineEl.textContent = pair[1];
    const pct = stats.shots ? Math.round(acc * 100) : 0;
    metaEl.textContent = `命中 ${pct}% · 最高連擊 ${stats.best} · 正中 ${stats.perfects}` + grantPlayReward(kind, modeClicks > 0);
    goBtn.textContent = "射擊";
    goBtn.dataset.action = "shoot";
    chantBtn.textContent = "再跟一次";
    showOverlay(true);
    paused = false;
    stopRhythm();
    if (kind === "win") sfxWin();
    return;
  }
  endKind = kind;
  grade = computeGrade();
  state = kind === "win" ? "win" : "lose";
  const pair = kind === "win" ? COPY[grade] : COPY[kind];
  titleEl.textContent = kind === "win" ? "打完場" : kind === "quit" ? "收工" : "打輸了";
  subtitleEl.textContent = pair[0];
  markEl.style.display = "block";
  markEl.textContent = grade;
  lineEl.textContent = pair[1];
  const acc = shots ? Math.round((hits / shots) * 100) : 0;
  metaEl.textContent = `用時 ${elapsed.toFixed(1)} 秒 · 命中 ${acc}% · 爆頭 ${crits} · 餘血 ${hp}` + grantShootReward(kind, grade);
  goBtn.textContent = "再打一場";
  goBtn.dataset.action = "shoot";
  chantBtn.textContent = "跟beat打";
  blitzBtn.textContent = "無限打";
  showOverlay(true);
  paused = false;
  if (kind === "win") sfxWin();
  else if (kind !== "quit") sfxFail();
}

function onClear() {
  if (levelIndex >= LEVELS.length - 1) {
    finish("win");
    return;
  }
  state = "banner";
  bannerT = 1.15;
  sfxClear();
}

function showOverlay(on) {
  overlay.classList.toggle("show", on);
}

function updateHud() {
  const hpText = document.getElementById("hptext");
  const pips = document.getElementById("pips");
  const hpStat = document.getElementById("hpstat");
  hpText.textContent = String(Math.max(0, hp));
  hpStat.hidden = mode === "rhythm" || mode === "blitz";
  hpStat.classList.toggle("danger", hp <= 3 && state === "play");
  if (pips.childElementCount !== PLAYER_MAX) {
    pips.innerHTML = "";
    for (let i = 0; i < PLAYER_MAX; i++) {
      const pip = document.createElement("i");
      pip.className = "pip";
      pips.appendChild(pip);
    }
  }
  for (let i = 0; i < PLAYER_MAX; i++) pips.children[i].classList.toggle("on", i < hp);
  const rhythmOn = mode === "rhythm" && state !== "menu";
  const blitzOn = mode === "blitz" && state !== "menu";
  document.getElementById("leveltext").textContent = rhythmOn ? "跟beat打" : blitzOn ? "無限打" : (levelIndex + 1) + "/5";
  document.getElementById("leftlabel").textContent = rhythmOn ? "連擊" : blitzOn ? "打低" : "剩餘小人";
  document.getElementById("lefttext").textContent = rhythmOn ? String(chantCombo) : blitzOn ? String(blitzKills) : String(enemies.length);
  const hint = document.querySelector(".hint");
  if (hint) {
    if (rhythmOn) hint.textContent = "反應圈縮到先撳";
    else if (blitzOn) hint.textContent = "點擊小人就打";
    else {
      const gear = equippedWeapon();
      const wait = weaponCd > 0 ? " · 冷卻 " + weaponCd.toFixed(1) + "秒" : "";
      hint.textContent = gear.spec.name + " Lv" + gear.owned.level
        + " · 打頭 −" + fmtNum(gear.stats.atk * 2)
        + " · 打身 −" + fmtNum(gear.stats.atk)
        + " · 耐用 " + fmtNum(gear.owned.dur) + wait;
    }
  }
  if (rhythmOn) {
    const stats = rhythmStats();
    document.getElementById("acctext").textContent = stats.shots ? Math.round((stats.hits / stats.shots) * 100) + "%" : "—";
    document.getElementById("shottext").textContent = String(stats.shots);
  } else {
    const acc = shots ? Math.round((hits / shots) * 100) + "%" : "—";
    document.getElementById("acctext").textContent = acc;
    document.getElementById("shottext").textContent = String(shots);
  }
  document.getElementById("mutetext").textContent = muted ? "靜" : "開";
  document.getElementById("mutebtn").textContent = muted ? "開聲" : "靜音";
  document.getElementById("pausebtn").textContent = paused ? "繼續" : "暫停";
  let burned = 0;
  if (mode === "rhythm" && state !== "menu") burned = state === "play" ? rhythmBurn() : 1;
  else if (mode === "blitz" && state !== "menu") burned = 1 - Math.max(0, levelTimer) / LEVEL_TIME;
  else if (state === "play" || state === "banner") burned = 1 - Math.max(0, levelTimer) / LEVEL_TIME;
  else if (endKind === "time") burned = 1;
  stick.style.setProperty("--burn", (burned * 100).toFixed(1) + "%");
  stick.classList.toggle("still", state !== "play" || paused || burned >= 0.999);
  let vig = hurtFlash > 0 ? Math.min(1, hurtFlash * 2.2) : 0;
  if (hp <= 3 && state === "play") vig = Math.max(vig, 0.35 + 0.25 * Math.sin(performance.now() / 120));
  vignette.style.opacity = String(Math.max(0, vig));
}

function update(dt) {
  if (paused) return;
  if (hitStop > 0) hitStop -= dt;
  const sim = hitStop > 0 ? 0 : dt;
  if (shake > 0) shake = Math.max(0, shake - dt * 18);
  if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - dt);
  if (swing > 0) swing = Math.max(0, swing - dt * 4.5);
  if (weaponCd > 0) weaponCd = Math.max(0, weaponCd - dt);

  if (state === "cutscene") {
    cutT -= dt;
    if (cutT <= 0) {
      clearEnemies();
      spawnWave(0);
      bossGong = false;
      state = "play";
    }
  } else if (state === "play" && mode === "rhythm") {
    elapsed += dt;
    if (updateRhythm(dt)) finish("win");
  } else if (state === "play" && mode === "blitz") {
    levelTimer -= dt;
    elapsed += dt;
    if (levelTimer <= 0) finish("win");
    else if (enemies.length === 0) spawnFrontDoll();
  } else if (state === "play") {
    levelTimer -= dt;
    elapsed += dt;
    const dmg = updateEnemies(sim);
    if (dmg > 0) {
      const lost = Math.min(dmg, hp);
      hp = Math.max(0, hp - dmg);
      if (lost > 0) hpPop(lost);
      hurtFlash = 0.45;
      shake = 8;
      sfxHurt();
    }
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.flash > 0) enemy.flash -= dt;
      if ((enemy.type === "office" || enemy.type === "rotten" || enemy.type === "tongue" || enemy.type === "luck") && enemy.y < stopCenter(enemy)) {
        const rate = enemy.type === "rotten" ? 10 : enemy.type === "luck" ? 16 : 12;
        enemy.walk = (enemy.walk || 0) + dt * rate;
      }
      if (!enemy.seen && enemy.y >= FIELD.y) {
        enemy.seen = true;
        if (ENEMY_TYPES[enemy.type].boss && !bossGong) {
          bossGong = true;
          sfxBoss();
          floater(enemy.x, 80, "大豬公", "#ffcc66", true);
        }
      }
    }
    if (hp <= 0) finish("hp");
    else if (levelCleared()) onClear();
    else if (levelTimer <= 0) finish("time");
  } else if (state === "banner") {
    bannerT -= dt;
    if (bannerT <= 0) {
      advanceLevel();
      clearEnemies();
      spawnWave(levelIndex);
      if (!LEVELS[levelIndex].boss) bossGong = false;
      state = "play";
    }
  }

  if (state !== "menu") updateFlying(dt);
  if (state !== "menu") updateMists(dt);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === "spark") p.vy += 40 * dt;
    else if (p.kind !== "ring") p.vy += 320 * dt;
    if (p.grow) p.w += p.grow * dt;
    if (p.paper) p.vx += Math.sin(p.rot * 4) * 50 * dt;
    p.rot += p.vr * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= dt;
    f.y -= 36 * dt;
    if (f.life <= 0) floaters.splice(i, 1);
  }
}

function roundRect(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawBackground(now) {
  const w = FIELD.w;
  const h = FIELD.h;
  ctx.fillStyle = "#151019";
  ctx.fillRect(0, 0, w, h);
  if (backdrop.complete && backdrop.naturalWidth) {
    const scale = Math.max(w / backdrop.naturalWidth, h / backdrop.naturalHeight);
    const dw = backdrop.naturalWidth * scale;
    const dh = backdrop.naturalHeight * scale;
    ctx.drawImage(backdrop, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  if (mode !== "rhythm" && censer.complete && censer.naturalWidth) {
    const dw = 200;
    const dh = dw * (censer.naturalHeight / censer.naturalWidth);
    ctx.drawImage(censer, (w - dw) / 2, h - dh + 10, dw, dh);
  }
}

let mists = [];

function mistOrigin(start, width) {
  if (start === "center") return (FIELD.w - width) / 2;
  if (start === "right") return FIELD.w - width * 0.72;
  return -width * 0.12;
}

function makeMist(start, y) {
  const width = 200 + Math.random() * 480;
  return {
    start: start,
    x: mistOrigin(start, width),
    y: y,
    w: width,
    speed: 8 + Math.random() * 16,
    alpha: 0.24 + Math.random() * 0.2,
  };
}

function ensureMists() {
  if (mists.length) return;
  mists = [
    makeMist("left", 78),
    makeMist("right", 150),
    makeMist("center", 220),
  ];
}

function updateMists(dt) {
  ensureMists();
  for (let i = 0; i < mists.length; i++) {
    const mist = mists[i];
    mist.x += mist.speed * dt;
    if (mist.x <= FIELD.w) continue;
    const next = makeMist(mist.start, 60 + Math.random() * 190);
    mists[i] = next;
  }
}

function drawMist() {
  if (!fog.complete || !fog.naturalWidth) return;
  ensureMists();
  const flat = (fog.naturalHeight / fog.naturalWidth) * 0.55;
  for (let i = 0; i < mists.length; i++) {
    const mist = mists[i];
    ctx.globalAlpha = mist.alpha;
    ctx.drawImage(fog, mist.x, mist.y, mist.w, mist.w * flat);
  }
  ctx.globalAlpha = 1;
}

function drawSheetSprite(e, sheet, cols, frames, b) {
  if (!sheet.complete || !sheet.naturalWidth) return false;
  const sw = sheet.naturalWidth / cols;
  const sh = sheet.naturalHeight / (frames / cols);
  const frame = Math.floor(e.walk || 0) % frames;
  ctx.save();
  if (e.flash > 0) ctx.filter = "brightness(2.4)";
  ctx.drawImage(sheet, (frame % cols) * sw, Math.floor(frame / cols) * sh, sw, sh, b.x, b.y, b.w, b.h);
  ctx.restore();
  return true;
}

function drawOfficeSprite(e, b) {
  if (e.type !== "office") return false;
  return drawSheetSprite(e, officeSheet, OFFICE_COLS, OFFICE_FRAMES, b);
}

function drawRottenSprite(e, b) {
  if (e.type !== "rotten") return false;
  return drawSheetSprite(e, rottenSheet, ROTTEN_COLS, ROTTEN_FRAMES, b);
}

function drawTongueSprite(e, b) {
  if (e.type !== "tongue") return false;
  return drawSheetSprite(e, tongueSheet, TONGUE_COLS, TONGUE_FRAMES, b);
}

function drawLuckSprite(e, b) {
  if (e.type !== "luck") return false;
  return drawSheetSprite(e, luckSheet, LUCK_COLS, LUCK_FRAMES, b);
}

function drawEnemy(e) {
  const b = enemyBox(e);
  const head = headBox(e);
  const t = ENEMY_TYPES[e.type];
  ctx.save();
  if (e.rot) {
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot);
    ctx.translate(-e.x, -e.y);
  }
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(b.x + b.w / 2, b.y + b.h - 2, b.w * 0.34, Math.max(3, b.h * 0.07), 0, 0, Math.PI * 2);
  ctx.fill();

  if (!drawOfficeSprite(e, b) && !drawRottenSprite(e, b) && !drawTongueSprite(e, b) && !drawLuckSprite(e, b)) {
  ctx.fillStyle = e.flash > 0 ? "#fff3c4" : t.body;
  ctx.strokeStyle = "#151019";
  ctx.lineWidth = Math.max(2, b.w * 0.035);
  roundRect(b.x + b.w * 0.2, head.y + head.h, b.w * 0.6, b.h - head.h - 2, b.w * 0.14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = e.flash > 0 ? "#ffffff" : t.body;
  ctx.beginPath();
  ctx.ellipse(head.x + head.w / 2, head.y + head.h * 0.58, head.w * 0.46, head.h * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255,243,196,0.7)";
  ctx.beginPath();
  ctx.ellipse(head.x + head.w / 2, head.y + head.h * 0.38, head.w * 0.22, head.h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#151019";
  ctx.lineWidth = Math.max(2, b.w * 0.04);
  ctx.beginPath();
  ctx.moveTo(b.x + b.w * 0.38, b.y + b.h * 0.78);
  ctx.lineTo(b.x + b.w * 0.3, b.y + b.h);
  ctx.moveTo(b.x + b.w * 0.62, b.y + b.h * 0.78);
  ctx.lineTo(b.x + b.w * 0.7, b.y + b.h);
  ctx.stroke();

  if (t.trait !== "drift") {
    ctx.fillStyle = "#151019";
    const eye = Math.max(1.6, head.w * 0.055);
    ctx.beginPath();
    ctx.arc(head.x + head.w * 0.38, head.y + head.h * 0.62, eye, 0, Math.PI * 2);
    ctx.arc(head.x + head.w * 0.62, head.y + head.h * 0.62, eye, 0, Math.PI * 2);
    ctx.fill();
  }

  if (t.trait === "tongue") {
    ctx.fillStyle = t.accent;
    ctx.beginPath();
    ctx.ellipse(b.x + b.w * 0.72, head.y + head.h, b.w * 0.28, b.h * 0.08, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (t.trait === "briefcase") {
    ctx.fillStyle = t.accent;
    roundRect(b.x + b.w * 0.62, b.y + b.h * 0.48, b.w * 0.28, b.h * 0.22, 3);
    ctx.fill();
    ctx.stroke();
  } else if (t.trait === "drift") {
    ctx.fillStyle = t.accent;
    ctx.beginPath();
    ctx.arc(b.x + b.w * 0.38, head.y + head.h * 0.7, Math.max(2, b.w * 0.06), 0, Math.PI * 2);
    ctx.arc(b.x + b.w * 0.62, head.y + head.h * 0.7, Math.max(2, b.w * 0.06), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb3d1";
    ctx.beginPath();
    ctx.arc(b.x + b.w * 0.78, head.y + 2, Math.max(3, b.w * 0.1), 0, Math.PI * 2);
    ctx.fill();
  } else if (t.trait === "duck") {
    ctx.fillStyle = t.accent;
    ctx.beginPath();
    ctx.moveTo(head.x + head.w * 0.2, head.y + head.h * 0.45);
    ctx.lineTo(head.x + head.w * 0.5, head.y - head.h * 0.15);
    ctx.lineTo(head.x + head.w * 0.8, head.y + head.h * 0.45);
    ctx.fill();
    ctx.fillStyle = "#fff3c4";
    ctx.beginPath();
    ctx.arc(b.x + b.w * 0.78, b.y + b.h * 0.62, Math.max(3, b.w * 0.1), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (t.trait === "boss") {
    ctx.fillStyle = "#ffb3a4";
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, head.y + head.h * 1.15, b.w * 0.16, b.h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#151019";
    ctx.beginPath();
    ctx.arc(b.x + b.w * 0.46, head.y + head.h * 1.15, Math.max(2, b.w * 0.025), 0, Math.PI * 2);
    ctx.arc(b.x + b.w * 0.54, head.y + head.h * 1.15, Math.max(2, b.w * 0.025), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = Math.max(2, b.w * 0.03);
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + b.h * 0.62, b.w * 0.28, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  }

  if (!e.dead && mode !== "rhythm") {
  const bw = b.w;
  const bx = b.x;
  const by = b.y - Math.max(8, b.h * 0.12);
  ctx.fillStyle = "#151019";
  ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(bx, by, bw, 5);
  ctx.fillStyle = "#c8321f";
  ctx.fillRect(bx, by, Math.max(0, bw * (e.hp / e.maxHp)), 5);
  }

  if (!e.dead && e.nextAttack < 1.15) {
    ctx.strokeStyle = "rgba(255,77,77,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.62, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function weaponGhosts() {
  const gear = shoeGear();
  if (!gear || swing <= 0) return 0;
  if (gear.id === "heel" && gear.stats.cd < 1) return 2;
  if (gear.id === "ballet") return gear.owned.level >= 4 ? 3 : 2;
  return 0;
}

function drawWeapon() {
  const ox = FIELD.w / 2;
  const oy = FIELD.h - 18;
  const ang = Math.atan2(aim.y - oy, aim.x - ox);
  const flick = Math.sin(swing * Math.PI) * 0.7;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(ang + flick);
  const ghosts = weaponGhosts();
  for (let i = ghosts; i >= 1; i--) {
    ctx.save();
    ctx.rotate(-0.2 * i * swing);
    ctx.globalAlpha = 0.16;
    if (oleander.complete && oleander.naturalWidth) {
      const len = 90;
      const dh = len * (oleander.naturalHeight / oleander.naturalWidth);
      ctx.drawImage(oleander, -13, -dh * 0.8, len, dh);
    }
    ctx.restore();
  }
  ctx.strokeStyle = "#6ee7a8";
  ctx.globalAlpha = 0.35 * swing;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(0, 0, 78, -0.8, 0.5);
  ctx.stroke();
  ctx.globalAlpha = mode === "shoot" && weaponCdMax > 0 ? 0.35 + 0.65 * (1 - weaponCd / weaponCdMax) : 1;
  if (oleander.complete && oleander.naturalWidth) {
    const len = 90;
    const dh = len * (oleander.naturalHeight / oleander.naturalWidth);
    ctx.drawImage(oleander, -13, -dh * 0.8, len, dh);
  } else {
    ctx.fillStyle = "#2b1a17";
    roundRect(8, -5, 118, 10, 4);
    ctx.fill();
    ctx.fillStyle = "#3e8f4a";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(36 + i * 16, (i % 2 ? -10 : 10), 12, 5, i % 2 ? -0.6 : 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "#f4d7b0";
  ctx.beginPath();
  ctx.ellipse(-6, 16, 16, 11, 0, 0, Math.PI * 2);
  ctx.ellipse(10, 18, 16, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFx() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    if (p.kind === "dust") {
      ctx.beginPath();
      ctx.arc(0, 0, p.w, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "ring") {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.w, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === "bit") {
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    } else {
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      if (p.paper) {
        ctx.strokeStyle = "#151019";
        ctx.lineWidth = 1;
        ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  for (let i = 0; i < floaters.length; i++) {
    const f = floaters[i];
    ctx.font = (f.big ? "700 32px " : "700 20px ") + '"Noto Sans TC", "Microsoft JhengHei", sans-serif';
    ctx.strokeStyle = "#151019";
    ctx.fillStyle = f.color;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  }
}

function drawBanner() {
  ctx.textAlign = "center";
  if (state === "cutscene") {
    ctx.fillStyle = "rgba(21,16,25,0.45)";
    ctx.fillRect(0, 180, FIELD.w, 120);
    ctx.fillStyle = "#ffd166";
    ctx.font = '700 36px "Noto Serif TC", "PMingLiU", serif';
    ctx.fillText("今日打吓小人，轉個運。", FIELD.w / 2, 236);
    ctx.fillStyle = "#f4f1e8";
    ctx.font = '500 16px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
    ctx.fillText("十字路口 · 夾竹桃備好", FIELD.w / 2, 270);
  } else if (state === "banner") {
    ctx.fillStyle = "rgba(21,16,25,0.4)";
    ctx.fillRect(0, 190, FIELD.w, 100);
    ctx.fillStyle = "#ffd166";
    ctx.font = '900 40px "Noto Serif TC", "PMingLiU", serif';
    ctx.fillText("過關", FIELD.w / 2, 236);
    ctx.fillStyle = "#f4f1e8";
    ctx.font = '500 16px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
    ctx.fillText("第 " + (levelIndex + 2) + " 關", FIELD.w / 2, 268);
  }
}

function drawCrosshair() {
  if (paused || state === "menu" || state === "win" || state === "lose") return;
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(aim.x, aim.y, 9, 0, Math.PI * 2);
  ctx.moveTo(aim.x - 14, aim.y);
  ctx.lineTo(aim.x - 4, aim.y);
  ctx.moveTo(aim.x + 4, aim.y);
  ctx.lineTo(aim.x + 14, aim.y);
  ctx.moveTo(aim.x, aim.y - 14);
  ctx.lineTo(aim.x, aim.y - 4);
  ctx.moveTo(aim.x, aim.y + 4);
  ctx.lineTo(aim.x, aim.y + 14);
  ctx.stroke();
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  updateHud();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, FIELD.w, FIELD.h);
  const sx = (Math.random() - 0.5) * shake;
  const sy = (Math.random() - 0.5) * shake;
  ctx.setTransform(1, 0, 0, 1, sx, sy);
  drawBackground(now);
  if (mode !== "rhythm") {
    const drawn = enemies.concat(flying).sort((a, b) => a.y - b.y);
    for (let i = 0; i < drawn.length; i++) drawEnemy(drawn[i]);
    drawFx();
    drawMist();
  } else {
    drawMist();
    drawRhythm();
    drawFx();
  }
  if (state !== "menu" && mode !== "rhythm") drawWeapon();
  drawBanner();
  if (paused) {
    ctx.fillStyle = "rgba(21,16,25,0.45)";
    ctx.fillRect(0, 0, FIELD.w, FIELD.h);
    ctx.fillStyle = "#ffd166";
    ctx.textAlign = "center";
    ctx.font = '900 48px "Noto Serif TC", "PMingLiU", serif';
    ctx.fillText("暫停", FIELD.w / 2, FIELD.h / 2);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawCrosshair();
  requestAnimationFrame(frame);
}

function aimFromEvent(ev) {
  aim = canvasPos(ev);
}
canvas.addEventListener("pointermove", aimFromEvent);
canvas.addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  ac();
  aimFromEvent(ev);
  if (state === "menu") return;
  if (state === "play" && !paused && (mode === "rhythm" || mode === "blitz")) modeClicks++;
  if (mode === "rhythm") {
    rhythmPointer(aim.x, aim.y);
    return;
  }
  shoot(aim.x, aim.y);
}, {passive: false});
window.addEventListener("keydown", (ev) => {
  if (ev.key === "r" || ev.key === "R") {
    if (mode === "rhythm") beginRhythm();
    else if (mode === "blitz") beginBlitz();
    else beginRun();
  }
  if (ev.key === "m" || ev.key === "M") {
    muted = !muted;
    rhythmOnMute();
  }
  if (mode === "rhythm" && (ev.key === " " || ev.key === "j" || ev.key === "J")) {
    ev.preventDefault();
    rhythmKey();
  }
});
goBtn.addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  ac();
  if (goBtn.dataset.action === "rhythm") beginRhythm();
  else if (goBtn.dataset.action === "blitz") beginBlitz();
  else beginRun();
});
document.getElementById("blitzbtn").addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  ac();
  beginBlitz();
});
document.getElementById("chantbtn").addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  ac();
  beginRhythm();
});
document.getElementById("retry").addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  if (mode === "rhythm") beginRhythm();
  else if (mode === "blitz") beginBlitz();
  else beginRun();
});
document.getElementById("mutebtn").addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  muted = !muted;
  rhythmOnMute();
});
document.getElementById("pausebtn").addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  if (state !== "cutscene" && state !== "play" && state !== "banner") return;
  paused = !paused;
  if (mode === "rhythm") rhythmHold(paused);
});
document.getElementById("endbtn").addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  if (state !== "cutscene" && state !== "play" && state !== "banner") return;
  finish("quit");
});

titleEl.textContent = "打小人";
subtitleEl.textContent = "打飛小人，洩黴氣！";
lineEl.textContent = "夜黑十字路口。夾竹桃一揮，紙紮小人就散。";
metaEl.textContent = "五關 · 每關三十秒 · 師傅十血，唔會自動回";
goBtn.dataset.action = "shoot";
goBtn.textContent = "射擊";
chantBtn.textContent = "跟beat打";
blitzBtn.textContent = "無限打";
requestAnimationFrame(frame);

const toast=document.getElementById("toast");
function showToast(msg){
  const item=document.createElement("div");
  item.className="toast-item";
  item.textContent=msg;
  toast.prepend(item);
  setTimeout(()=>{
    item.classList.add("toast-hide");
    setTimeout(()=>item.remove(),150);
  },4000);
}