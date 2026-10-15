// One-off build script: fetch a short definition for every WORDLOCK answer word.
//
// Run: node scripts/build-definitions.mjs
//
// Source: Wiktionary's REST API. Definitions are CC BY-SA 4.0, so the generated
// file carries an attribution notice and the in-game hint credits Wiktionary.
// Getting this right at build time means the hint works offline, instantly, with
// no third-party call in the hot path — a runtime API lookup would add latency to
// every single game start and break entirely if that service is down.
//
// Why only the ANSWER pool: a player only ever needs the definition of the word
// they are trying to guess, which is always drawn from ANSWERS. Guesses need no
// definitions, so the 8636-word GUESSES list is untouched.

import fs from 'node:fs';

const ANSWERS = fs.readFileSync('src/games/word-lock/words.js', 'utf8');
// The generated list has a trailing comma before the closing bracket, which
// JSON.parse rejects but JS accepts. Add the missing import instead.
const WORDS = (await import('../src/games/word-lock/words.js')).ANSWERS;

// Resume rather than restart. The first full pass already baked most answers,
// so a second complete serial walk would needlessly hit the API another thousand
// times. Fetch only words that still lack a definition, then merge them with
// what is already on disk.
let existing = {};
try {
  existing = (await import('../src/games/word-lock/definitions.js')).DEFINITIONS || {};
} catch {
  existing = {};
}
const TARGETS = WORDS.filter((word) => !existing[word]);

const ENDPOINT = (w) => `https://en.wiktionary.org/api/rest_v1/page/definition/${w}`;

// Wiktionary's REST API rate-limits aggressively and answers 429 rather than
// queueing. The first run of this script silently lost 97% of the words to 429s
// because the failure was swallowed — hence the serial walk, the delay, and the
// explicit retry. Being a good citizen here is the difference between a
// complete definition file and a useless one.
const DELAY_MS = 160;
const RETRIES = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const UA = 'WhiteBox/1.0 (build script; contact via site footer)';

// Wiktionary returns HTML with links and italics. Stripping to plain text keeps
// the hint readable at a glance, which is the whole point of a 5-second flash.
function toPlain(html) {
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// A definition is only useful in a 5-second flash if it is short and concrete.
// Long or qualified definitions get skipped in favour of the next sense.
function cleanDefinitionText(html) {
  const text = toPlain(html);
  // The API sometimes leaks stylesheet text after the prose (notably fragments
  // beginning `.mw-parser-output`). Tags are already gone, so remove the
  // selector-shaped remainder; it was never part of the definition.
  return text
    .replace(/\s*\.mw-parser-output[^{}]*(\{[^{}]*\})?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(defs) {
  for (const d of defs) {
    const text = cleanDefinitionText(d.definition || '');
    if (text.length >= 12 && text.length <= 140) return text;
  }
  for (const d of defs) {
    const text = cleanDefinitionText(d.definition || '');
    if (text.length >= 8) return text.slice(0, 140);
  }
  return null;
}

async function fetchOne(word) {
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const res = await fetch(ENDPOINT(word), { headers: { 'User-Agent': UA } });

      if (res.status === 429) {
        // Back off hard: these limits are per-IP and recover in seconds, not
        // milliseconds, so a short retry just burns another attempt.
        const wait = 2000 * (attempt + 1);
        await sleep(wait);
        continue;
      }
      if (!res.ok) return null;

      const data = await res.json();
      const en = data.en || data;
      if (!Array.isArray(en)) return null;
      for (const entry of en) {
        const found = pick(entry.definitions || []);
        if (found) return found;
      }
      return null;
    } catch {
      await sleep(500);
    }
  }
  return null;
}

const out = { ...existing };
let done = Object.keys(existing).length;
let missing = 0;

// Strictly serial. Concurrency is what got us rate-limited in the first place.
for (const word of TARGETS) {
  const def = await fetchOne(word);
  if (def) out[word] = def;
  else missing += 1;

  done += 1;
  if (done % 25 === 0 || done === WORDS.length) {
    process.stdout.write(`  ${done}/${WORDS.length} fetched, ${Object.keys(out).length} usable, ${missing} missing this pass\n`);
  }
  await sleep(DELAY_MS);
}

// Old passes kept stylesheet fragments. Clean the previously saved entries too,
// so one resumed run leaves the whole baked file in the same readable shape.
for (const [word, definition] of Object.entries(out)) {
  const cleaned = cleanDefinitionText(definition);
  if (cleaned) out[word] = cleaned;
  else delete out[word];
}

const header = `// Short definitions for WORDLOCK answer words.
//
// GENERATED by scripts/build-definitions.mjs — do not edit by hand.
//
// Source: Wiktionary (https://en.wiktionary.org), CC BY-SA 4.0. The in-game
// hint credits Wiktionary for these.
//
// Baked at build time rather than fetched at runtime: the hint flashes for five
// seconds at the start of a game, so it has to be instant and available offline.
// A live API call would put a third party in the hot path of every game start.
//
// ${Object.keys(out).length} of ${WORDS.length} answer words have a definition; the rest
// fall back to a structural hint at runtime.
`;

fs.writeFileSync(
  'src/games/word-lock/definitions.js',
  `${header}\nexport const DEFINITIONS = ${JSON.stringify(out, null, 0)};\n`,
);

console.log(`\nwrote ${Object.keys(out).length} definitions (${missing} words had none)`);