// Shoot-mode weapons. Blank cells in the sheet keep the previous level's value.
// Durability drops by 1 each time any mode starts. Attack is body damage; a head hit is double.

const WEAPON_ORDER = ["slipper", "heel", "spike", "ballet"];

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
      {atk: 3, cd: 0.75, dur: 3, cost: {tickets: 8}},
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
      {atk: 4, cd: 0.5, dur: 3, cost: {tickets: 7}},
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
};

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

// Rhythm and blitz pay 20 only when the round runs to the end and the player clicked at least once.
function grantPlayReward(kind, clicked) {
  if (kind === "quit") return "";
  const pay = clicked ? 20 : 0;
  if (pay) weaponState.coins += pay;
  saveWeapons();
  renderArmory();
  return " · +" + pay + " 小人幣";
}

function grantShootReward(kind, grade) {
  if (kind === "quit") return "";
  const pay = SHOOT_PAY[grade] || SHOOT_PAY.C;
  weaponState.coins += pay;
  let extra = " · +" + pay + " 小人幣";
  if (kind === "win") {
    weaponState.tickets += 1;
    extra += " · +1 突破券";
  }
  saveWeapons();
  renderArmory();
  return extra;
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
    const fix = document.createElement("button");
    fix.type = "button";
    fix.dataset.act = "fix";
    fix.dataset.id = id;
    fix.textContent = "修復 " + spec.fix;
    fix.disabled = !owned || owned.dur >= shown.dur - 0.001 || weaponState.coins < spec.fix;
    acts.appendChild(equip);
    acts.appendChild(shop);
    acts.appendChild(fix);
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
    weaponState.equipped = id;
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
    if (owned.dur >= cap - 0.001) return;
    if (weaponState.coins < spec.fix) { armoryNote("小人幣唔夠修復。"); return; }
    weaponState.coins -= spec.fix;
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
