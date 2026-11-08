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
};

// 5 levels. pool = normal enemy ids, count = [min,max] normal spawns. L5 adds boss (extra, always last).
const LEVELS = [
  {pool:["tongue","office","luck"],          count:[3,3]},
  {pool:["tongue","office","rotten"],        count:[4,4]},
  {pool:["office","rotten"],                 count:[3,4]},
  {pool:["luck","rotten","office"],          count:[3,4]},
  {pool:["luck","rotten","office","tongue"], count:[3,5], boss:"boss"},
];

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

// Roll one level's enemy list. One spawn burst, no mid-level respawn; clear = kill all.
function buildSpawns(levelIdx) {
  const def = LEVELS[levelIdx];
  const n = randInt(def.count[0], def.count[1]);
  const spawns = [];
  for (let i = 0; i < n; i++) spawns.push({type: def.pool[randInt(0, def.pool.length - 1)]});
  if (def.boss) spawns.push({type: def.boss}); // boss appended LAST, on top of the normal count
  return spawns;
}

// Per-level run state. The game loop decrements levelTimer; advanceLevel resets it to 30 on advance.
let levelIndex = 0;
let levelTimer = LEVEL_TIME;
function advanceLevel() { levelIndex++; levelTimer = LEVEL_TIME; }

// shortcut: trusts enemy.js owns the live global `enemies`; upgrade to take the list as an arg if that moves.
function levelCleared() { return enemies.length === 0; }

// assert self-check (silent on pass), runs on page load.
for (let L = 0; L < LEVELS.length; L++) {
  for (let r = 0; r < 200; r++) {
    const s = buildSpawns(L);
    const bossAt = s.findIndex((e) => ENEMY_TYPES[e.type].boss === true);
    const normal = s.filter((e) => ENEMY_TYPES[e.type].boss !== true);
    console.assert(normal.length >= LEVELS[L].count[0] && normal.length <= LEVELS[L].count[1], "L" + L + " normal count out of range");
    console.assert((bossAt !== -1) === (L === LEVELS.length - 1), "boss must appear only on L5");
    if (bossAt !== -1) console.assert(bossAt === s.length - 1, "boss must be the last spawn on L5");
  }
}
console.assert(LEVEL_TIME === 30, "LEVEL_TIME must be 30");
