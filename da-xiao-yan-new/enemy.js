// enemy.js — the horde: spawn, walk, attack timer, hitscan click damage.
// stats / randInt / LEVELS / ENEMY_TYPES all live in level.js; this file only hydrates them.
// shortcut: FIELD + SPRITE are hardcoded play-area pixels, upgrade to the renderer canvas size when it exposes one.
const FIELD = {x: 0, y: 0, w: 960, h: 540};
const SPRITE = 64;
const HEAD_H = 0.35; // big-head art: the head hitbox is the top band of the sprite
// Authored for the 960x540 landscape frame. layoutField() scales these onto a portrait phone.
const BASE_W = 960;
const BASE_H = 540;
const BASE_ROAD_FAR_Y = 190;
const BASE_ROAD_LEFT = [[190, 420], [280, 340], [340, 300], [400, 300], [460, 255], [530, 210]];
const BASE_ROAD_RIGHT = [[190, 540], [280, 670], [340, 700], [400, 740], [460, 780], [530, 810]];
const BASE_GATES = [
  {x: 376, y: 321},
  {x: 483, y: 273},
  {x: 643, y: 325},
];
// The player stands at the bottom center. Enemy feet stop on the line just in front of them.
let PLAYER_X = FIELD.w / 2;
let FOOT_Y = FIELD.h - 100;
let NEAR_SCALE = 0.72 + 0.48 * ((FIELD.h - SPRITE * 3) / FIELD.h);
// The alley is a one-point street. These are the cobblestone edges (canvas x),
// inside the shop walls, narrow under the far fog and wide on the near stones.
let ROAD_FAR_Y = BASE_ROAD_FAR_Y;
let ROAD_LEFT = BASE_ROAD_LEFT.map((pair) => pair.slice());
let ROAD_RIGHT = BASE_ROAD_RIGHT.map((pair) => pair.slice());
// The three red circles on the stones: left, center (farther up the street), right.
let SPAWN_GATES = BASE_GATES.map((gate) => ({x: gate.x, y: gate.y}));

function layoutField(portrait) {
  const prevW = FIELD.w;
  const prevH = FIELD.h;
  FIELD.w = portrait ? 540 : BASE_W;
  FIELD.h = portrait ? 960 : BASE_H;
  const sx = FIELD.w / BASE_W;
  const sy = FIELD.h / BASE_H;
  PLAYER_X = FIELD.w / 2;
  FOOT_Y = FIELD.h - (portrait ? 170 : 100);
  NEAR_SCALE = 0.72 + 0.48 * ((FIELD.h - SPRITE * 3) / FIELD.h);
  ROAD_FAR_Y = BASE_ROAD_FAR_Y * sy;
  ROAD_LEFT = BASE_ROAD_LEFT.map(([y, x]) => [y * sy, x * sx]);
  ROAD_RIGHT = BASE_ROAD_RIGHT.map(([y, x]) => [y * sy, x * sx]);
  SPAWN_GATES = BASE_GATES.map((gate) => ({x: gate.x * sx, y: gate.y * sy}));
  const mx = FIELD.w / prevW;
  const my = FIELD.h / prevH;
  if (mx === 1 && my === 1) return;
  for (const list of [enemies, flying]) {
    for (let i = 0; i < list.length; i++) {
      list[i].x *= mx;
      list[i].y *= my;
      if (list[i].homeX != null) list[i].homeX *= mx;
    }
  }
}

// levelCleared() in level.js reads THIS array: kills splice it, clearEnemies() empties it in place, never reassign.
let enemies = [];
// Corpses leave the live list immediately, then tumble off the screen.
let flying = [];

function spawnEnemy(type, x, y) {
  const t = ENEMY_TYPES[type];
  const hp = randInt(t.hp[0], t.hp[1]);
  const spMul = LEVELS[levelIndex].speedMul || 1;
  const enemy = {
    type: type, x: x, y: y, homeX: x, hp: hp, maxHp: hp, size: t.size, speed: t.speed * spMul,
    nextAttack: randInt(5, 10), phase: Math.random() * Math.PI * 2,
    hide: 1, stun: 0, flash: 0, seen: false,
  };
  enemies.push(enemy);
  // fox queues a biter on the very first frame of the fight; the update loop does the rest.
  if (t.trait === "mistress") {
    enemy.summonTimer = 0;
  }
  return enemy;
}

// Center y where this enemy's feet land on FOOT_Y at full near scale.
function stopCenter(enemy) {
  return FOOT_Y - SPRITE * enemy.size * NEAR_SCALE / 2;
}

function depthScale(enemy) {
  const span = stopCenter(enemy) - FIELD.y;
  const t = Math.max(0, Math.min(1, (enemy.y - FIELD.y) / span));
  const duck = enemy.hide == null ? 1 : enemy.hide;
  return NEAR_SCALE * (0.5 + 0.5 * t) * duck;
}

function roadEdge(samples, y) {
  if (y <= samples[0][0]) return samples[0][1];
  const last = samples[samples.length - 1];
  if (y >= last[0]) return last[1];
  for (let i = 1; i < samples.length; i++) {
    if (y <= samples[i][0]) {
      const y0 = samples[i - 1][0];
      const x0 = samples[i - 1][1];
      const y1 = samples[i][0];
      const x1 = samples[i][1];
      const t = (y - y0) / (y1 - y0);
      return x0 + (x1 - x0) * t;
    }
  }
  return last[1];
}

function roadHalf(y) {
  const left = roadEdge(ROAD_LEFT, y);
  const right = roadEdge(ROAD_RIGHT, y);
  return Math.max(8, Math.min(PLAYER_X - left, right - PLAYER_X));
}

// lane is -1..1 across the cobblestones at this depth.
function roadX(lane, y) {
  return PLAYER_X + Math.max(-1, Math.min(1, lane)) * roadHalf(y);
}

function spriteHalf(enemy) {
  return SPRITE * enemy.size * depthScale(enemy) / 2;
}

// Keep the whole sprite on the stones. The alley is narrower at the shoulders than at the feet.
function clampToStreet(enemy, x) {
  const half = spriteHalf(enemy);
  const left = roadEdge(ROAD_LEFT, enemy.y - half) + half;
  const right = roadEdge(ROAD_RIGHT, enemy.y - half) - half;
  if (left >= right) return PLAYER_X;
  return Math.max(left, Math.min(right, x));
}

// buildSpawns() only carries a type, so this hydrates HP/pos. callers must clear the previous wave first.
function spawnWave(levelIdx) {
  const spawns = buildSpawns(levelIdx);
  const groups = [[], [], []];
  for (let i = 0; i < spawns.length; i++) {
    // The boss is three times wide, so only the center circle can hold him.
    const gate = ENEMY_TYPES[spawns[i].type].boss ? 1 : randInt(0, SPAWN_GATES.length - 1);
    groups[gate].push(i);
  }
  const placed = new Array(spawns.length);
  for (let g = 0; g < groups.length; g++) {
    const ids = groups[g];
    ids.sort((a, b) => (ENEMY_TYPES[spawns[a].type].boss ? 0 : 1) - (ENEMY_TYPES[spawns[b].type].boss ? 0 : 1));
    const spot = SPAWN_GATES[g];
    const step = ids.length <= 1 ? 0 : (spot.y - ROAD_FAR_Y) / (ids.length - 1);
    const lane = (spot.x - PLAYER_X) / roadHalf(spot.y);
    for (let k = 0; k < ids.length; k++) placed[ids[k]] = {y: spot.y - k * step, lane: lane};
  }
  for (let i = 0; i < spawns.length; i++) {
    const spot = placed[i];
    const enemy = spawnEnemy(spawns[i].type, roadX(spot.lane, spot.y), spot.y);
    enemy.lane = spot.lane;
    enemy.x = clampToStreet(enemy, roadX(spot.lane, spot.y));
  }
}

// dt in seconds; returns one entry per enemy attack that landed (caller owns player HP)
function updateEnemies(dt) {
  const hits = [];
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (enemy.stun > 0) {
      enemy.stun -= dt;
      continue;
    }
    const trait = ENEMY_TYPES[enemy.type].trait;
    if (trait === "duck") {
      enemy.phase += dt * 2.2;
      enemy.hide = (enemy.phase % 1.5) < 0.42 ? 0.62 : 1;
    }
    if (trait === "mistress" && enemy.summonTimer != null) {
      enemy.summonTimer -= dt;
      if (enemy.summonTimer <= 0 && enemies.length < 20) {
        enemy.summonTimer = 8;
        spawnEnemy("bitter", enemy.x, enemy.y);
      }
    }
    const prevY = enemy.y;
    const stop = stopCenter(enemy);
    // each trait owns one gait: drift=wide sine, duck=zigzag step, bitter=one sidestep taunt,
    // illness=stutter (pause 1s of each 3s), badluck=lane jitter, betrayal=feint step back,
    // mistress=sine that grows closer. roadX/clampToStreet keep every gait on the stones.
    let walk = 1;
    if (trait === "illness") {
      enemy.phase += dt;
      if (enemy.phase % 3 < 1) walk = 0;
    }
    enemy.y = Math.min(enemy.y + enemy.speed * walk * dt, stop);
    if (trait === "betrayal") {
      const midway = (SPAWN_GATES[1].y + stop) / 2;
      if (enemy.back == null && enemy.y >= midway) enemy.back = 1;
      if (enemy.back > 0) {
        enemy.back -= dt;
        enemy.y = Math.max(enemy.y - enemy.speed * 2 * dt, midway);
      }
    }
    if (enemy.lane == null) {
      enemy.lane = Math.max(-1, Math.min(1, (enemy.homeX - PLAYER_X) / roadHalf(enemy.y)));
    }
    if (trait === "badluck") enemy.lane += (Math.random() - 0.5) * 0.02;
    let x = roadX(enemy.lane, enemy.y);
    if (trait === "drift") {
      enemy.phase += dt * 2.4;
      x += Math.sin(enemy.phase) * roadHalf(enemy.y) * 0.25;
    }
    if (trait === "duck") {
      x += (Math.floor(enemy.phase / 1.76) % 2 ? 1 : -1) * 0.22 * roadHalf(enemy.y);
    }
    if (trait === "bitter") {
      if (enemy.step == null && enemy.y >= (SPAWN_GATES[1].y + stop) / 2) {
        enemy.step = (Math.random() < 0.5 ? -1 : 1) * 0.3;
      }
      if (enemy.step) x += enemy.step * roadHalf(enemy.y);
    }
    if (trait === "mistress") {
      enemy.phase += dt * 2;
      const nearT = Math.max(0, Math.min(1, (enemy.y - ROAD_FAR_Y) / (stop - ROAD_FAR_Y)));
      x += Math.sin(enemy.phase) * roadHalf(enemy.y) * (0.08 + 0.15 * nearT);
    }
    enemy.x = clampToStreet(enemy, x);
    const t = ENEMY_TYPES[enemy.type];
    // Condition 2: the frame an enemy first reaches the player, it hits immediately.
    if (prevY < stop && enemy.y >= stop) hits.push(randInt(t.dmg[0], t.dmg[1]));
    // Condition 1: the 5–10s swing timer starts at spawn and keeps running while walking.
    enemy.nextAttack -= dt;
    if (enemy.nextAttack > 0) continue;
    enemy.nextAttack = randInt(5, 10);
    hits.push(randInt(t.dmg[0], t.dmg[1]));
  }
  return hits;
}


function enemyBox(enemy) {
  const s = SPRITE * enemy.size * depthScale(enemy);
  return {x: enemy.x - s / 2, y: enemy.y - s / 2, w: s, h: s};
}

function headBox(enemy) {
  const box = enemyBox(enemy);
  return {x: box.x, y: box.y, w: box.w, h: box.h * HEAD_H};
}

function inBox(box, x, y) {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

// Head is double the body hit. Omit attack and the body hit stays 1, so the self-check still sees 2 and 1.
// Returns {dmg, used, reason}: used=false means out-of-box (caller tries next enemy). used=true means
// the swing landed on this enemy; dmg is what actually hit HP. reason labels a blocked/dodged swing.
function hitEnemy(enemy, x, y, attack) {
  if (enemy.dead) return {dmg: 0, used: false};
  const t = ENEMY_TYPES[enemy.type];
  // badluck: 30% jinx on the player — swing consumed, no shot, no hit.
  if (t.trait === "badluck" && Math.random() < 0.3) return {dmg: 0, used: true, reason: "dodge"};
  // fox shield: cannot take HP while any of her summoned biters still stand.
  if (t.trait === "mistress" && enemies.some((o) => ENEMY_TYPES[o.type].trait === "bitter" && !o.dead)) return {dmg: 0, used: true, reason: "shield"};
  const atk = attack == null ? 1 : attack;
  const dmg = inBox(headBox(enemy), x, y) ? atk * 2 : inBox(enemyBox(enemy), x, y) ? atk : 0;
  if (dmg === 0) return {dmg: 0, used: false};
  enemy.hp -= dmg;
  enemy.stun = 0.12;
  enemy.flash = 0.1;
  if (enemy.hp <= 0) {
    // bitter chain-taunt: on death, one nearby normal enemy takes dmg[0]. direct hp apply, no recursion.
    if (t.trait === "bitter") {
      const half = spriteHalf(enemy) * 2;
      for (const other of enemies) {
        if (other === enemy || other.dead) continue;
        if (ENEMY_TYPES[other.type].size === 3) continue;
        if (Math.abs(other.x - enemy.x) > half || Math.abs(other.y - enemy.y) > half) continue;
        other.hp -= t.dmg[0];
        if (other.hp <= 0) { launchEnemy(other); removeEnemy(other); }
        break;
      }
    }
    launchEnemy(enemy);
    removeEnemy(enemy);
  }
  return {dmg, used: true};
}

// Knock the doll up and away from the player until it leaves the screen.
function launchEnemy(enemy) {
  let dir = Math.sign(enemy.x - PLAYER_X);
  if (dir === 0) dir = Math.random() < 0.5 ? -1 : 1;
  enemy.dead = true;
  enemy.vx = dir * (520 + Math.random() * 160);
  enemy.vy = -(680 + Math.random() * 180);
  enemy.spin = dir * (8 + Math.random() * 6);
  enemy.rot = dir * 0.25;
  flying.push(enemy);
}

function updateFlying(dt) {
  for (let i = flying.length - 1; i >= 0; i--) {
    const enemy = flying[i];
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    enemy.vy += 180 * dt;
    enemy.rot += enemy.spin * dt;
    if (enemy.flash > 0) enemy.flash -= dt;
    const pad = SPRITE * enemy.size * 1.4;
    const off = enemy.y < FIELD.y - pad || enemy.y > FIELD.h + pad
      || enemy.x < FIELD.x - pad || enemy.x > FIELD.x + FIELD.w + pad;
    if (off) flying.splice(i, 1);
  }
}

function removeEnemy(enemy) {
  const i = enemies.indexOf(enemy);
  if (i >= 0) enemies.splice(i, 1);
}

function clearEnemies() {
  enemies.length = 0;
  flying.length = 0;
}

const FRONT_TYPES = ["tongue", "office", "rotten", "luck"];

// One small doll already standing on the near stones. Never the boss.
function spawnFrontDoll() {
  const type = FRONT_TYPES[randInt(0, FRONT_TYPES.length - 1)];
  const lane = Math.random() * 1.5 - 0.75;
  const y = stopCenter({size: 1});
  const enemy = spawnEnemy(type, PLAYER_X, y);
  enemy.lane = lane;
  enemy.y = y;
  enemy.x = clampToStreet(enemy, roadX(lane, y));
  enemy.homeX = enemy.x;
  return enemy;
}

// Any point on the sprite is one hit: the doll leaves immediately.
function smackEnemy(enemy) {
  if (!enemy || enemy.dead) return false;
  enemy.hp = 0;
  enemy.flash = 0.1;
  launchEnemy(enemy);
  removeEnemy(enemy);
  return true;
}

// assert self-check (silent on pass), runs on page load.
{
  for (const type in ENEMY_TYPES) {
    const t = ENEMY_TYPES[type];
    for (let i = 0; i < 200; i++) {
      const enemy = spawnEnemy(type, FIELD.x + FIELD.w / 2, FIELD.y);
      console.assert(enemy.hp >= t.hp[0] && enemy.hp <= t.hp[1] && enemy.maxHp === enemy.hp, `${type} hp roll out of band`);
      console.assert(enemy.size === (t.boss ? 3 : 1), `${type} size must follow the boss flag`);
    }
    clearEnemies();
  }

  for (let lv = 0; lv < LEVELS.length; lv++) {
    clearEnemies();
    spawnWave(lv);
    const count = LEVELS[lv].count;
    const extra = LEVELS[lv].boss ? 1 : 0;
    console.assert(enemies.length >= count[0] + extra && enemies.length <= count[1] + extra, `level ${lv} spawned the wrong count`);
    if (LEVELS[lv].boss) {
      const last = enemies[enemies.length - 1];
      const expected = LEVELS[lv].boss;
      const ok = Array.isArray(expected) ? expected.indexOf(last.type) !== -1 : last.type === expected;
      console.assert(ok, "boss must spawn last");
    }
    for (const enemy of enemies) {
      console.assert(enemy.x > FIELD.x && enemy.x < FIELD.x + FIELD.w, "spawn x inside the play area");
      const top = enemy.y - (SPRITE * enemy.size * depthScale(enemy)) / 2;
      console.assert(top >= FIELD.y - 0.5 && enemy.y >= ROAD_FAR_Y - 0.5 && enemy.y <= SPAWN_GATES[2].y + 1, "spawn on one of the three road gates");
      console.assert(Math.abs(enemy.x - PLAYER_X) <= roadHalf(enemy.y) + 1, "spawn on the cobblestones");
    }
  }

  clearEnemies();
  const far = spawnEnemy("tongue", FIELD.x + 40, FIELD.y);
  const close = spawnEnemy("tongue", FIELD.x + 80, stopCenter({size: 1}));
  console.assert(Math.abs(depthScale(close) / depthScale(far) - 2) < 0.001, "a far enemy is half the size it is in front of the player");
  console.assert(Math.abs(depthScale(close) - NEAR_SCALE) < 0.001, "arrival size stays the previous near scale");
  clearEnemies();
  const walker = spawnEnemy("office", FIELD.x + 10, FIELD.y - SPRITE);
  const walked = updateEnemies(1);
  console.assert(walker.y === FIELD.y - SPRITE + ENEMY_TYPES.office.speed, "1s of walking = speed px");
  console.assert(walked.length === 0, "1s is still inside the opening 5–10s swing window");
  walker.nextAttack = 0;
  const whileWalking = updateEnemies(0);
  console.assert(whileWalking.length === 1 && whileWalking[0] >= ENEMY_TYPES.office.dmg[0] && whileWalking[0] <= ENEMY_TYPES.office.dmg[1], "a walking enemy swings once its timer elapses");
  walker.y = stopCenter(walker);
  walker.nextAttack = 0;
  const dealt = updateEnemies(0);
  console.assert(dealt.length === 1 && dealt[0] >= ENEMY_TYPES.office.dmg[0] && dealt[0] <= ENEMY_TYPES.office.dmg[1], "a stopped enemy swings its own dmg band");

  clearEnemies();
  const line = stopCenter({size: 1});
  const arriver = spawnEnemy("tongue", FIELD.x + 30, line - 10);
  arriver.nextAttack = 100;
  const onArrival = updateEnemies(1);
  console.assert(arriver.y === line, "arrival walks onto the player line");
  console.assert(Math.abs(arriver.x - PLAYER_X) <= roadHalf(arriver.y) + 1, "arrival stays on the near cobblestones");
  console.assert(Math.abs(roadX(-0.8, line) - PLAYER_X) > Math.abs(roadX(-0.8, ROAD_FAR_Y) - PLAYER_X), "the street widens as enemies come closer");
  console.assert(onArrival.length === 1 && onArrival[0] === ENEMY_TYPES.tongue.dmg[0], "reaching the player hits immediately");
  const standing = updateEnemies(1);
  console.assert(standing.length === 0, "standing in front does not hit again until the timer");

  clearEnemies();
  const target = spawnEnemy("tongue", FIELD.x + 100, stopCenter({size: 1}));
  target.hp = 3; // pin hp so the 2+1 kill below is deterministic
  const box = enemyBox(target);
  const head = headBox(target);
  console.assert(hitEnemy(target, head.x + 1, head.y + 1).dmg === 2, "head band = -2");
  console.assert(hitEnemy(target, box.x + 1, box.y + box.h - 1).dmg === 1, "body band = -1");
  console.assert(hitEnemy(target, box.x - 1, box.y - 1).used === false, "outside the sprite = no damage");
  console.assert(enemies.length === 0, "kills splice the live list, so levelCleared() can see it");
  console.assert(flying.length === 1 && flying[0].dead, "a kill launches the doll off the live list");
  updateFlying(1.2);
  console.assert(flying.length === 0, "a launched doll leaves the screen");
  clearEnemies();
  const front = spawnFrontDoll();
  console.assert(FRONT_TYPES.indexOf(front.type) !== -1 && ENEMY_TYPES[front.type].boss !== true, "front doll is a small type, never the boss");
  console.assert(enemies.length === 1, "one front doll at a time");
  console.assert(Math.abs(front.y - stopCenter(front)) < 1, "front doll stands on the near line");
  console.assert(Math.abs(front.x - PLAYER_X) <= roadHalf(front.y) + 1, "front doll stands on the near cobblestones");
  const frontBox = enemyBox(front);
  console.assert(smackEnemy(front) === true, "a smack launches the doll");
  console.assert(enemies.length === 0 && flying.length === 1, "smack leaves the live list");
  console.assert(inBox(frontBox, frontBox.x + frontBox.w / 2, frontBox.y + frontBox.h - 2), "the whole sprite is the hit");
  // gaits: the stateful ones only (sine/jitter math stays visual, no assertion).
  clearEnemies();
  const stum = spawnEnemy("illness", PLAYER_X, ROAD_FAR_Y + 10);
  stum.phase = 0;
  const yBefore = stum.y;
  updateEnemies(0.5);
  console.assert(stum.y === yBefore, "illness stands still inside its pause");
  for (let s = 0; s < 5; s++) updateEnemies(0.5); // real dt steps, so the pause window can end
  console.assert(stum.y > yBefore, "illness walks once the pause ends");
  const neight = spawnEnemy("bitter", PLAYER_X, (SPAWN_GATES[1].y + stopCenter({ size: 1 })) / 2 + 1);
  updateEnemies(0.1);
  console.assert(neight.step != null, "bitter taunts a sidestep past halfway");
  console.assert(Math.abs(neight.x - clampToStreet(neight, PLAYER_X + neight.step * roadHalf(neight.y))) < 1, "the sidestep lands on the stones");
  const snake = spawnEnemy("betrayal", PLAYER_X, 300);
  const bStop = stopCenter(snake);
  snake.y = (SPAWN_GATES[1].y + bStop) / 2 + 1;
  const beforeBack = snake.y;
  updateEnemies(0.2);
  console.assert(snake.back != null && snake.y < beforeBack, "betrayal winds up, then steps back");

  clearEnemies();
  console.assert(enemies.length === 0, "self-check leaves a clean start state");
}
