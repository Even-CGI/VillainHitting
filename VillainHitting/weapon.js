// Shoot-mode weapons. Blank cells in the sheet keep the previous level's value.
// Durability drops by 1 each time any mode starts. Attack is body damage; a head hit is double.

const WEAPON_ORDER = ["slipper", "heel", "spike", "ballet", "shield", "regen"];

const WEAPONS = {
  slipper: {
    name: "拖鞋",
    fix: 30,
    levels: [
      {atk: 1, cd: 1.25, dur: 3, cost: {free: true}},
      {atk: 1.5, cd: 1.25, dur: 3, cost: {coins: 30}},
      {atk: 2, cd: 1, dur: 3, cost: {coins: 50}},
      {atk: 2.5, cd: 1, dur: 3, cost: {tickets: 3}},
      {atk: 3, cd: 1, dur: 3, cost: {tickets: 5}},
    ],
  },
  heel: {
    name: "高跟鞋",
    fix: 50,
    levels: [
      {atk: 1, cd: 1, dur: 2, cost: {free: true}},
      {atk: 1.5, cd: 1, dur: 2, cost: {coins: 65}},
      {atk: 2, cd: 1, dur: 3, cost: {coins: 80}},
      {atk: 2.5, cd: 1, dur: 3, cost: {coins: 95}},
      {atk: 3, cd: 0.75, dur: 3, cost: {tickets: 6}},
    ],
  },
  spike: {
    name: "釘鞋",
    fix: 65,
    levels: [
      {atk: 2, cd: 1.75, dur: 2, cost: {free: true}},
      {atk: 2.5, cd: 1.5, dur: 2, cost: {coins: 110}},
      {atk: 3, cd: 1, dur: 2, cost: {coins: 125}},
      {atk: 3.5, cd: 1, dur: 3, cost: {tickets: 5}},
      {atk: 4, cd: 0.5, dur: 3, cost: {tickets: 8}},
    ],
  },
  ballet: {
    name: "芭蕾舞鞋",
    fix: 45,
    levels: [
      {atk: 0.5, cd: 0.75, dur: 2, cost: {free: true}},
      {atk: 1, cd: 0.75, dur: 2, cost: {coins: 60}},
      {atk: 1.5, cd: 0.75, dur: 3, cost: {coins: 75}},
      {atk: 2, cd: 0.75, dur: 4, cost: {coins: 90}},
      {atk: 2, cd: 0.5, dur: 5, cost: {coins: 105}},
    ],
  },
  shield: {
    name: "防護盾",
    passive: true, // shoot & unlimited only: blocks N damage per enemy hit, 1 durability per run
    fix: [50, 50, 50, 70, 150],
    levels: [
      {atk: 0, cd: 0, dur: 2, blk: 1, cost: {free: true}},
      {atk: 0, cd: 0, dur: 2, blk: 2, cost: {coins: 100}},
      {atk: 0, cd: 0, dur: 2, blk: 3, cost: {coins: 200}},
      {atk: 0, cd: 0, dur: 3, blk: 4, cost: {tickets: 4}},
      {atk: 0, cd: 0, dur: 4, blk: 5, cost: {tickets: 6}},
    ],
  },
  regen: {
    name: "回血",
    passive: true, // heal per level clear in shoot & unlimited; no durability
    fix: null,
    levels: [
      {atk: 0, cd: 0, dur: null, heal: 0.5, cost: {coins: 100}},
      {atk: 0, cd: 0, dur: null, heal: 1, cost: {coins: 160}},
      {atk: 0, cd: 0, dur: null, heal: 1.5, cost: {coins: 220}},
      {atk: 0, cd: 0, dur: null, heal: 2, cost: {tickets: 5}},
      {atk: 0, cd: 0, dur: null, heal: 2.5, cost: {tickets: 7}},
    ],
  },
};

{ // self-check: shield & regen ladders match the sheet
  console.assert(WEAPONS.shield.levels[0].blk === 1 && WEAPONS.shield.levels[3].cost.tickets === 4 && WEAPONS.shield.fix[4] === 150, "shield ladder");
  console.assert(WEAPONS.regen.levels[0].cost.coins === 100 && WEAPONS.regen.levels[4].heal === 2.5 && WEAPONS.regen.levels[4].cost.tickets === 7, "regen ladder");
}

(function fillWeaponLevels() {
  for (const id in WEAPONS) {
    const levels = WEAPONS[id].levels;
    for (let i = 1; i < levels.length; i++) {
      if (levels[i].cd == null) levels[i].cd = levels[i - 1].cd;
      if (levels[i].dur == null) levels[i].dur = levels[i - 1].dur;
    }
  }
})();

const WEAPON_STORE = "daxiao-weapons-v1";
const SHOOT_PAY = {C: 8, B: 12, A: 18, S: 26};

let weaponState = null;
let armoryFx = null;
let weaponCd = 0;
let weaponCdMax = 0;

function fmtNum(n) {
  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) return String(Math.round(rounded));
  return String(rounded);
}

function loadWeapons() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(WEAPON_STORE) || "null"); } catch (e) { saved = null; }
  weaponState = {
    coins: saved && saved.coins > 0 ? saved.coins : 0,
    tickets: saved && saved.tickets > 0 ? saved.tickets : 0,
    firstBeat: saved && saved.firstBeat ? 1 : 0,
    firstBlitz: saved && saved.firstBlitz ? 1 : 0,
    firstUnlimited: saved && saved.firstUnlimited ? 1 : 0,
    equipped: "slipper",
    owned: {},
  };
  for (const id of WEAPON_ORDER) {
    const row = saved && saved.owned ? saved.owned[id] : null;
    const maxLevel = WEAPONS[id].levels.length;
    const level = row ? Math.max(1, Math.min(maxLevel, row.level || 1)) : 1;
    const cap = WEAPONS[id].levels[level - 1].dur;
    const dur = row && row.dur != null ? Math.max(0, Math.min(cap, row.dur)) : cap;
    weaponState.owned[id] = {level: level, dur: dur};
  }
  if (saved && weaponState.owned[saved.equipped]) weaponState.equipped = saved.equipped;
  saveWeapons();
}

function saveWeapons() {
  try { localStorage.setItem(WEAPON_STORE, JSON.stringify(weaponState)); } catch (e) { /* private mode */ }
}

function weaponLevel(id) {
  const owned = weaponState.owned[id];
  return owned ? WEAPONS[id].levels[owned.level - 1] : WEAPONS[id].levels[0];
}

function equippedWeapon() {
  const id = weaponState.equipped;
  const owned = weaponState.owned[id];
  return {id: id, spec: WEAPONS[id], owned: owned, stats: WEAPONS[id].levels[owned.level - 1]};
}

function weaponAttack() {
  return equippedWeapon().stats.atk;
}

function weaponCooldown() {
  return equippedWeapon().stats.cd;
}

function costLabel(cost) {
  if (!cost || cost.free) return "免費";
  if (cost.tickets) return cost.tickets + "突破券";
  return cost.coins + "小人幣";
}

function canPay(cost) {
  if (!cost || cost.free) return true;
  if (cost.tickets) return weaponState.tickets >= cost.tickets;
  return weaponState.coins >= (cost.coins || 0);
}

function pay(cost) {
  if (!canPay(cost)) return false;
  if (cost && cost.tickets) weaponState.tickets -= cost.tickets;
  else if (cost && cost.coins) weaponState.coins -= cost.coins;
  saveWeapons();
  return true;
}

function armoryNote(text) {
  const note = document.getElementById("wepnote");
  if (note) note.textContent = text || "";
  if (text != "")
	showToast(text);
}

// Returns false when the equipped pair is too worn to start a round.
function spendDurability() {
  const gear = equippedWeapon();
  if (gear.owned.dur < 1) {
    armoryNote(gear.spec.name + "壞咗。修復或者換一對先再開波。");
    showOverlay(true);
    return false;
  }
  gear.owned.dur = Math.round((gear.owned.dur - 1) * 10) / 10;
  saveWeapons();
  renderArmory();
  armoryNote("");
  return true;
}

// Shield & regen apply to shoot & unlimited modes only.
function shieldGuard() {
  const o = weaponState.owned.shield;
  if (!o || (o.dur || 0) <= 0) return 0;
  return WEAPONS.shield.levels[o.level - 1].blk;
}
function regenPerClear() {
  const o = weaponState.owned.regen;
  return o ? WEAPONS.regen.levels[o.level - 1].heal : 0;
}
function useGearOnRunStart() {
  const o = weaponState.owned.shield;
  if (o && (o.dur || 0) > 0) o.dur = Math.round((o.dur - 1) * 10) / 10;
  saveWeapons();
  renderArmory();
}

// Rhythm and blitz pay 20 only when the round runs to the end and the player clicked at least once.
// The very first clean clear of each of those modes also pays one breakthrough ticket, once per save.
function grantPlayReward(kind, clicked) {
  if (kind === "quit") return "";
  const pay = clicked ? 20 : 0;
  if (pay) weaponState.coins += pay;
  let extra = pay ? " · +" + pay + " 小人幣" : "";
  if (kind === "win" && clicked) {
    if (mode === "rhythm" && !weaponState.firstBeat) {
      weaponState.firstBeat = 1;
      weaponState.tickets += 1;
      extra += " · +1 突破券（跟beat打首次）";
    } else if (mode === "blitz" && !weaponState.firstBlitz) {
      weaponState.firstBlitz = 1;
      weaponState.tickets += 1;
      extra += " · +1 突破券（無限打首次）";
    }
  }
  if (extra) { saveWeapons(); renderArmory(); }
  return extra;
}

function grantShootReward(kind, grade) {
  if (kind === "quit") return "";
  const pay = SHOOT_PAY[grade] || SHOOT_PAY.C;
  weaponState.coins += pay;
  const extra = " · +" + pay + " 小人幣";
  saveWeapons();
  renderArmory();
  return extra;
}

// Levels mode: every 5 levels cleared pays one breakthrough ticket.
function grantLevelReward(clearedCount) {
  if (clearedCount % 5 !== 0) return;
  weaponState.tickets += 1;
  saveWeapons();
  renderArmory();
  showToast("每5關完成 +1 突破券");
}

// Practice ladder: the very first full 20-level clear pays one ticket, once per save.
function grantUnlimitedFirst(kind) {
  if (kind !== "win" || weaponState.firstUnlimited) return "";
  weaponState.firstUnlimited = 1;
  weaponState.tickets += 1;
  saveWeapons();
  renderArmory();
  return " · +1 突破券（無CD首次通場）";
}

const AD_COINS = 10;
let adPlaying = false;

// Reserved ad slot. A real ad SDK should call finishAd() when the ad actually ends.
function finishAd() {
  weaponState.coins += AD_COINS;
  saveWeapons();
  renderArmory();
  armoryNote("睇完廣告，+" + AD_COINS + " 小人幣。");
}

function watchAd() {
  if (adPlaying) return;
  adPlaying = true;
  const btn = document.getElementById("adbtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "睇緊廣告…";
  }
  armoryNote("");
  setTimeout(() => {
    adPlaying = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = "睇廣告";
    }
    finishAd();
  }, 1200);
}

function renderArmory() {
  const wallet = document.getElementById("wallet");
  const list = document.getElementById("weaponlist");
  if (!wallet || !list || !weaponState) return;
  const flash = armoryFx;
  armoryFx = null;
  wallet.textContent = "小人幣 " + weaponState.coins + " · 突破券 " + weaponState.tickets;
  list.innerHTML = "";
  for (const id of WEAPON_ORDER) {
    const spec = WEAPONS[id];
    const owned = weaponState.owned[id];
    const shown = owned ? spec.levels[owned.level - 1] : spec.levels[0];
    const row = document.createElement("div");
    row.className = "wep" + (owned && weaponState.equipped === id ? " on" : "");
    if (flash && flash.id === id && flash.ticket) row.classList.add("wep-break");
    const info = document.createElement("div");
    const title = document.createElement("b");
    title.textContent = spec.name + (owned ? " Lv" + owned.level : " · 未買");
    if (flash && flash.id === id) title.classList.add("wep-flash");
    const line = document.createElement("div");
    line.className = "statline";
    const durText = owned ? fmtNum(owned.dur) + "/" + fmtNum(shown.dur) : "0/" + fmtNum(shown.dur);
    line.textContent = "攻擊 " + fmtNum(shown.atk) + " · 冷卻 " + fmtNum(shown.cd) + "秒 · 耐用 " + durText;
    if (spec.passive) { // overwrite the weapon statline for passive gear
      line.textContent = shown.blk !== undefined
        ? "可擋 " + shown.blk + " 次攻擊 · 耐用 " + (owned ? fmtNum(owned.dur) : "0") + "/" + fmtNum(shown.dur)
        : "每次過關自動回 +" + fmtNum(shown.heal) + " 生命";
    }
    if (flash && flash.id === id && !flash.fix) line.classList.add("wep-jump");
    info.appendChild(title);
    info.appendChild(line);
    const acts = document.createElement("div");
    acts.className = "acts";
    const equip = document.createElement("button");
    equip.type = "button";
    equip.dataset.act = "equip";
    equip.dataset.id = id;
    equip.textContent = owned && weaponState.equipped === id ? "裝備中" : "裝備";
    equip.disabled = !owned || weaponState.equipped === id;
    const next = owned && owned.level < spec.levels.length ? spec.levels[owned.level] : null;
    const buyCost = owned ? (next ? next.cost : null) : spec.levels[0].cost;
    const shop = document.createElement("button");
    shop.type = "button";
    shop.dataset.act = owned ? "upgrade" : "buy";
    shop.dataset.id = id;
    shop.textContent = !owned ? "買入 " + costLabel(buyCost) : next ? "升級 " + costLabel(next.cost) : "滿級";
    shop.disabled = owned ? !next || !canPay(next.cost) : !canPay(buyCost);
    const fixCost = spec.fix ? (Array.isArray(spec.fix) ? spec.fix[(owned ? owned.level : 1) - 1] : spec.fix) : 0;
    const fix = document.createElement("button");
    fix.type = "button";
    fix.dataset.act = "fix";
    fix.dataset.id = id;
    fix.textContent = "修復 " + fixCost;
    fix.disabled = !owned || shown.dur == null || owned.dur >= shown.dur - 0.001 || weaponState.coins < fixCost;
    if (!spec.passive) acts.appendChild(equip);
    acts.appendChild(shop);
    if (shown.dur != null) acts.appendChild(fix);
    row.appendChild(info);
    row.appendChild(acts);
    list.appendChild(row);
  }
}

function armoryAction(act, id) {
  const spec = WEAPONS[id];
  const owned = weaponState.owned[id];
  if (act === "equip") {
    if (!owned) return;
    weaponState.equipped = id;
    armoryNote("");
  } else if (act === "buy") {
    if (owned) return;
    if (!pay(spec.levels[0].cost)) { armoryNote("小人幣或者突破券唔夠。"); return; }
    weaponState.owned[id] = {level: 1, dur: spec.levels[0].dur};
    if (!spec.passive) weaponState.equipped = id;
    armoryNote("買咗" + spec.name + "。");
  } else if (act === "upgrade") {
    if (!owned || owned.level >= spec.levels.length) return;
    const next = spec.levels[owned.level];
    if (!pay(next.cost)) { armoryNote("小人幣或者突破券唔夠。"); return; }
    const ticket = !!(next.cost && next.cost.tickets);
    owned.level += 1;
    owned.dur = next.dur;
    armoryFx = {id: id, ticket: ticket};
    if (ticket) sfxUpgradeTicket();
    else sfxUpgradeCoin();
    armoryNote(spec.name + "升到 Lv" + owned.level + "，耐用度補滿。");
  } else if (act === "fix") {
    if (!owned) return;
    const cap = spec.levels[owned.level - 1].dur;
    if (cap == null || owned.dur >= cap - 0.001) return;
    const fixCost = spec.fix ? (Array.isArray(spec.fix) ? spec.fix[owned.level - 1] : spec.fix) : 0;
    if (!fixCost || weaponState.coins < fixCost) { armoryNote("小人幣唔夠修復。"); return; }
    weaponState.coins -= fixCost;
    owned.dur = cap;
    armoryFx = {id: id, fix: true};
    sfxStitch();
    armoryNote(spec.name + "耐用度補滿。");
  }
  saveWeapons();
  renderArmory();
}

loadWeapons();
renderArmory();
document.getElementById("weaponlist").addEventListener("pointerdown", (ev) => {
  const btn = ev.target.closest("button");
  if (!btn || btn.disabled) return;
  ev.preventDefault();
  ev.stopPropagation();
  armoryAction(btn.dataset.act, btn.dataset.id);
});
document.getElementById("adbtn").addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  watchAd();
});
