// Level architecture for the da-xiao-yan (打小人) prototype.
// Flow: main menu -> cutscene -> [L1..L5] -> S/A/B/C grade -> retry. All in-game copy is Cantonese; code identifiers English.

const LEVEL_TIME = 30; // one independent 30s countdown per level; resets on advance

// Enemy stat table. speed = px/s, dmg = [min,max] HP lost per hit, size = 3 for boss else 1,
// hp = roll range, body/accent hex, trait drives art/AI, boss = L5-only flag.
const ENEMY_TYPES = {
  tongue: {display:"口舌小人",   dmg:[1,1], speed:10.7016, size:1, hp:[3,10],  body:"#6ee7a8", accent:"#8a6fa8", trait:"tongue"},
  office: {display:"職場小人",   dmg:[2,2], speed:21.4032, size:1, hp:[3,10],  body:"#5b8dbe", accent:"#dfe6ee", trait:"briefcase"},
  rotten: {display:"爛桃花小人", dmg:[3,3], speed:18.7278, size:1, hp:[3,10],  body:"#ff7eb6", accent:"#c8321f", trait:"drift"},
  luck:   {display:"財運細路仔", dmg:[3,4], speed:31.213, size:1, hp:[3,10],  body:"#ffd166", accent:"#e63946", trait:"duck"},
  boss:   {display:"大豬公",     dmg:[3,5], speed:11.77176, size:3, hp:[15,25], body:"#e04a2f", accent:"#ffcc66", trait:"boss", boss:true},
  // ponytail plan: new types reserved for L6+; not in any current LEVELS pool, so they only run once that ladder is added.
  bitter: {display:"酸民／惡鄰居",     dmg:[2,3], speed:19.5,    size:1, hp:[3,9],  body:"#f77f00", accent:"#8b0000", trait:"bitter"},
  illness:{display:"病痛",           dmg:[2,2], speed:15.0,    size:1, hp:[5,12], body:"#b0bec5", accent:"#3f51b5", trait:"illness"},
  badluck:{display:"霉運",           dmg:[1,3], speed:24.0,    size:1, hp:[4,10], body:"#606c76", accent:"#c77fb3", trait:"badluck"},
  betrayal:{display:"陰險同事／二五仔", dmg:[3,5], speed:13.5,   size:3, hp:[20,28],body:"#7b1f2b", accent:"#ffd166", trait:"betrayal", boss:true},
  mistress:{display:"狐狸精",         dmg:[4,6], speed:16.0,    size:3, hp:[22,30],body:"#ff4757", accent:"#2b0213", trait:"mistress", boss:true},
};

// 20 levels. pool = normal enemy ids, count = [min,max] normal spawns.
// must = guaranteed spawns that are PART of count. speedMul multiplies enemy speed.
// boss = a single type or [a,b] random-pick; appended last. Bosses only on L5, L10, L15, L20.
const LEVELS = [
  {pool:["tongue","office","luck"],              count:[3,3],   must:[{type:"luck",n:1}]},
  {pool:["tongue","office","rotten"],            count:[4,4]},
  {pool:["office","rotten"],                     count:[3,4]},
  {pool:["luck","rotten","office"],              count:[3,4]},
  {pool:["luck","rotten","office","tongue"],     count:[3,5],   boss:"boss"},
  {pool:["luck","rotten","office","tongue","bitter"],                        count:[5,8],   speedMul:1.1},
  {pool:["luck","rotten","office","tongue","bitter","badluck"],              count:[6,10],  must:[{type:"bitter",n:1},{type:"badluck",n:1}], speedMul:1.1},
  {pool:["luck","rotten","office","tongue","bitter","badluck","illness"],   count:[8,10],  must:[{type:"illness",n:1}], speedMul:1.1},
  {pool:["luck","rotten","office","tongue","bitter","badluck","illness"],   count:[8,10],  must:[{type:"illness",n:2}], speedMul:1.1},
  {pool:["luck","rotten","office","tongue","bitter","badluck","illness"],   count:[8,10],  must:[{type:"illness",n:3}], boss:["boss","betrayal"], speedMul:1.1},
  {pool:["luck","rotten","office","tongue","bitter","badluck","illness"],   count:[10,15], must:[{type:"illness",n:2},{type:"badluck",n:1}], speedMul:1.3},
  {pool:["luck","rotten","office","tongue","bitter","badluck","illness"],   count:[10,15], must:[{type:"illness",n:2}], speedMul:1.3},
  {pool:["luck","rotten","office","tongue","bitter","badluck","illness"],   count:[10,15], must:[{type:"illness",n:2}], speedMul:1.3},
  {pool:["luck","rotten","office","tongue","bitter","badluck","illness"],   count:[10,15], must:[{type:"illness",n:2}], speedMul:1.3},
  {pool:["luck","rotten","office","tongue","bitter","badluck","illness"],   count:[12,15], must:[{type:"illness",n:2}], boss:"betrayal", speedMul:1.3},
  {pool:["luck","rotten","office","tongue","bitter","badluck","illness"],   count:[15,20], must:[{type:"illness",n:3}], speedMul:1.5},
  {pool:["luck","rotten","office","tongue","bitter","badluck","illness"],   count:[15,20], must:[{type:"illness",n:3}], speedMul:1.5},
  {pool:["luck","rotten","office","tongue","bitter","badluck","illness"],   count:[15,20], must:[{type:"illness",n:3}], speedMul:1.5},
  {pool:["luck","rotten","office","tongue","bitter","badluck","illness"],   count:[15,20], must:[{type:"illness",n:3}], speedMul:1.5},
  {pool:["luck","rotten","office","tongue","bitter","badluck","illness"],   count:[15,20], must:[{type:"illness",n:3}], boss:"mistress", speedMul:1.5},
];

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

// Roll one level's enemy list. must spawns first (part of count), rest from pool, then boss appended last.
function buildSpawns(levelIdx) {
  const def = LEVELS[levelIdx];
  const must = def.must || [];
  let mustTotal = 0;
  for (const m of must) mustTotal += m.n;
  const n = Math.max(randInt(def.count[0], def.count[1]), mustTotal);
  const spawns = [];
  for (const m of must) for (let i = 0; i < m.n; i++) spawns.push({type: m.type});
  for (let i = spawns.length; i < n; i++) spawns.push({type: def.pool[randInt(0, def.pool.length - 1)]});
  if (def.boss) {
    const pick = Array.isArray(def.boss) ? def.boss[randInt(0, def.boss.length - 1)] : def.boss;
    spawns.push({type: pick});
  }
  return spawns;
}

// Per-level run state. The game loop decrements levelTimer; advanceLevel resets it to 30 on advance.
let levelIndex = 0;
let levelTimer = LEVEL_TIME;
function advanceLevel() { levelIndex++; levelTimer = LEVEL_TIME; }

// shortcut: trusts enemy.js owns the live global `enemies`; upgrade to take the list as an arg if that moves.
function levelCleared() { return enemies.length === 0; }

// assert self-check (silent on pass), runs on page load.
const BOSS_LEVELS = [4, 9, 14, 19];
for (let L = 0; L < LEVELS.length; L++) {
  const def = LEVELS[L];
  const must = def.must || [];
  let mustTotal = 0;
  for (const m of must) {
    mustTotal += m.n;
    console.assert(def.pool.indexOf(m.type) !== -1, "L" + L + " must type " + m.type + " must be in pool");
  }
  console.assert(def.count[0] >= mustTotal, "L" + L + " count[0] must cover mustTotal");
  if (def.speedMul) console.assert(def.speedMul >= 1 && def.speedMul <= 2, "L" + L + " speedMul out of band");
  const hasBoss = BOSS_LEVELS.indexOf(L) !== -1;
  console.assert((hasBoss ? true : false) === (def.boss ? true : false), "L" + L + " boss must match the BOSS_LEVELS schedule");
  for (let r = 0; r < 200; r++) {
    const s = buildSpawns(L);
    const normal = s.filter((e) => ENEMY_TYPES[e.type].boss !== true);
    console.assert(normal.length >= def.count[0] && normal.length <= def.count[1], "L" + L + " normal count out of range");
    const bossIdx = s.findIndex((e) => ENEMY_TYPES[e.type].boss === true);
    console.assert((bossIdx !== -1) === hasBoss, "L" + L + " boss presence wrong");
    if (bossIdx !== -1) console.assert(bossIdx === s.length - 1, "L" + L + " boss must be last");
  }
}
console.assert(LEVEL_TIME === 30, "LEVEL_TIME must be 30");
