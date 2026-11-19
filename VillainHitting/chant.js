// One-pass chants. 咒1 is the Cantonese recording. 咒2 is the English recording.
// Timed tokens are hits only for Beat/打 and the named body part.

const CHANT_LEAD = 1.2;
const CHANT_APPROACH = 1.0;
const CHANT_PERFECT = 0.07 * 1.3;
const CHANT_GOOD = 0.14 * 1.3;
const CHANT_DOLLS = ["tongue", "office", "rotten", "luck"];
const CHANT_MELODY = [262, 294, 330, 392, 440, 392, 330, 349, 330, 294, 262, 294, 247, 262];

const CHANT_PACKS = {
  zh: {
    id: "zh",
    words: false,
    audio: "chibi/37s.mp3",
    duration: 37.392,
    spans: [
      [[0.22, 1.46], [2.26, 3.87]],
      [[4.92, 6.10], [6.96, 8.49]],
      [[9.65, 10.88], [11.69, 13.44]],
      [[14.46, 15.80], [16.47, 18.20]],
      [[19.24, 20.62], [21.24, 22.66]],
      [[23.84, 25.07], [25.84, 27.17]],
      [[28.33, 29.70], [30.34, 31.85]],
      [[33.02, 34.23], [34.98, 36.43]],
    ],
    parts: {
      "頭": "head",
      "透": "head",
      "面": "face",
      "眼": "eye",
      "望": "eye",
      "耳": "ear",
      "嘴": "mouth",
      "講": "mouth",
      "肚": "belly",
      "手": "hand",
      "攞": "hand",
      "腳": "foot",
      "走": "foot",
      "打": "body",
    },
    labels: {
      head: "打頭",
      face: "打面",
      eye: "打眼",
      ear: "打耳",
      mouth: "打嘴",
      belly: "打肚",
      hand: "打手",
      foot: "打腳",
      body: "打身",
    },
    lines: [
      {text: "打你個小人頭，等你有氣冇掟抖。"},
      {text: "打你個小人面，等你成世都犯賤。"},
      {text: "打你個小人眼，等你考試零雞蛋。"},
      {text: "打你個小人耳，等你銀紙當草紙。"},
      {text: "打你個小人嘴，等你有女冇得追。"},
      {text: "打你個小人肚，等你日日比人告。"},
      {text: "打你個小人手，等你有錢唔識收。"},
      {text: "打你個小人腳，等你有鞋冇得著。"},
    ],
  },
  en: {
    id: "en",
    words: true,
    audio: "chibi/28s_EN.mp3",
    duration: 28.152,
    spans: [
      [[0.22, 1.58], [1.96, 3.84]],
      [[5.20, 6.46], [6.72, 8.14]],
      [[9.44, 10.66], [10.98, 12.56]],
      [[13.92, 15.10], [15.52, 17.34]],
      [[18.78, 20.06], [20.50, 22.26]],
      [[23.64, 24.98], [25.32, 26.98]],
    ],
    parts: {
      beat: "body",
      hand: "hand",
      eye: "eye",
      foot: "foot",
      mouth: "mouth",
      head: "head",
      ear: "ear",
    },
    labels: {
      head: "HEAD",
      face: "FACE",
      eye: "EYE",
      ear: "EAR",
      mouth: "MOUTH",
      belly: "BELLY",
      hand: "HAND",
      foot: "FOOT",
      body: "BEAT",
    },
    lines: [
      {text: "Beat your little hand, Your good luck come to the end;"},
      {text: "Beat your little eye, very soon you die;"},
      {text: "Beat your little foot, everything is no good;"},
      {text: "Beat your little mouth, you always have bad results;"},
      {text: "Beat your little head, your work never go ahead;"},
      {text: "Beat your little ear, you will not listen clear."},
    ],
  },
};

let chantId = "zh";
let chantWords = false;
let CHANT_AUDIO = CHANT_PACKS.zh.audio;
let CHANT_AUDIO_DURATION = CHANT_PACKS.zh.duration;
let CHANT_SPANS = CHANT_PACKS.zh.spans;
let CHANT_PARTS = CHANT_PACKS.zh.parts;
let CHANT_PART_LABEL = CHANT_PACKS.zh.labels;
let CHANT_LINES = CHANT_PACKS.zh.lines;

function selectChant(id) {
  const pack = CHANT_PACKS[id] || CHANT_PACKS.zh;
  chantId = pack.id;
  chantWords = pack.words;
  CHANT_AUDIO = pack.audio;
  CHANT_AUDIO_DURATION = pack.duration;
  CHANT_SPANS = pack.spans;
  CHANT_PARTS = pack.parts;
  CHANT_PART_LABEL = pack.labels;
  CHANT_LINES = pack.lines;
}

function chantSpread(start, end, count) {
  if (count <= 1) return [start];
  const step = (end - start) / (count - 1);
  const times = [];
  for (let i = 0; i < count; i++) times.push(start + step * i);
  return times;
}

function chantHalves(text) {
  if (!chantWords) return text.split("，");
  const cut = text.indexOf(",");
  if (cut < 0) return [text];
  return [text.slice(0, cut), text.slice(cut + 1)];
}

function chantTokens(text) {
  if (!chantWords) return Array.from(text).filter((ch) => ch !== "。" && ch !== "、" && ch !== " ");
  return text.trim().split(/\s+/).filter(Boolean).map((word) => word.replace(/[.,;]/g, ""));
}

function buildChantChart() {
  const notes = [];
  let melody = 0;
  for (let line = 0; line < CHANT_LINES.length; line++) {
    const halves = chantHalves(CHANT_LINES[line].text);
    for (let half = 0; half < halves.length; half++) {
      const tokens = chantTokens(halves[half]);
      const span = CHANT_SPANS[line][half];
      const times = chantSpread(span[0], span[1], tokens.length);
      for (let i = 0; i < tokens.length; i++) {
        const ch = tokens[i];
        const key = chantWords ? ch.toLowerCase() : ch;
        const part = CHANT_PARTS[key] || null;
        notes.push({
          char: ch,
          time: CHANT_LEAD + times[i],
          line: line,
          part: part,
          hit: !!part,
          freq: CHANT_MELODY[melody % CHANT_MELODY.length],
          judged: null,
        });
        melody++;
      }
    }
  }
  return {notes: notes, duration: CHANT_LEAD + CHANT_AUDIO_DURATION};
}

selectChant("zh");
{
  const chart = buildChantChart();
  console.assert(chart.notes.length === 104, "eight lines, thirteen characters each");
  console.assert(chart.notes.filter((n) => n.hit).map((n) => n.char).join("") === "打頭打面打眼打耳打嘴打肚打手打腳", "every 打 and every named body part is a hit");
  console.assert(chart.notes.every((n) => n.hit === !!n.part), "a hit is always a body part");
  console.assert(Math.abs(chart.notes[0].time - (CHANT_LEAD + 0.22)) < 0.001, "the first character starts with the recording");
  console.assert(chart.notes[5].char === "頭" && Math.abs(chart.notes[5].time - (CHANT_LEAD + 1.46)) < 0.001, "頭 lands on its syllable");
  console.assert(chart.notes[96].char === "腳" && Math.abs(chart.notes[96].time - (CHANT_LEAD + 34.23)) < 0.001, "腳 lands on the last line");
  for (let i = 1; i < chart.notes.length; i++) console.assert(chart.notes[i].time > chart.notes[i - 1].time, "characters stay in order");
  console.assert(CHANT_DOLLS.indexOf("boss") === -1, "the boss never stands in the chant");
  console.assert(chart.duration === CHANT_LEAD + 37.392, "the Cantonese round lasts the whole recording");
}
selectChant("en");
{
  const chart = buildChantChart();
  const hits = chart.notes.filter((n) => n.hit).map((n) => n.char).join(" ");
  console.assert(chart.notes.length === 54, "six English lines keep every word");
  console.assert(hits === "Beat hand Beat eye Beat foot Beat mouth Beat head Beat ear", "Beat and each body part are hits");
  console.assert(chart.notes[0].char === "Beat" && Math.abs(chart.notes[0].time - (CHANT_LEAD + 0.22)) < 0.001, "Beat starts with the recording");
  console.assert(chart.notes[3].char === "hand" && chart.notes[3].part === "hand", "hand is the first body hit");
  console.assert(chart.notes[chart.notes.length - 6].char === "ear" && chart.notes[chart.notes.length - 6].part === "ear", "ear is the last body hit");
  for (let i = 1; i < chart.notes.length; i++) console.assert(chart.notes[i].time > chart.notes[i - 1].time, "English words stay in order");
  console.assert(chart.duration === CHANT_LEAD + 28.152, "the English round lasts the whole recording");
}
selectChant("zh");
