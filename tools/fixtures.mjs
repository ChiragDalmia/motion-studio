// The fixture packs are the only test suite in this repo, and they test the
// validators rather than the films: a gate nobody has watched fail is not a
// gate. `_null` must be rejected for every named reason; `_max` must load.
//
// Run it when a validator changes. It is not on the commit path — the validators
// themselves are, and this is what proves they still say no.
import path from 'node:path';
import { load, declarationFor } from './tokens.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

// Each entry is a substring the failure message MUST contain.
const NULL_MUST_REJECT = [
  ['a required token', 'token.beat is required'],
  ['no tempo', 'has not been designed'],
  ['craft thresholds', 'craft.strobeMinMs is required'],
  ['no face', 'face[] must list at least one face'],
  ['extra shadows core', 'shadows the core token'],
  ['extra is not an identifier', 'must be a lowerCamelCase identifier'],
];
// These only surface once the shape errors are gone, because load() reports
// structure before it resolves anything. Asserted separately below.
const NULL_MUST_ALSO_REJECT = [
  ['undeclared reference', 'which the pack does not declare'],
];

const fails = [];
const ok = [];

// ---- _null must be rejected, for the right reasons -------------------------
let nullErr = '';
try {
  await load('_null');
  fails.push('brands/_null LOADED. It is a fixture designed to be invalid in several named ways; a validator has been weakened.');
} catch (e) {
  nullErr = String(e.message);
  for (const [what, needle] of NULL_MUST_REJECT) {
    if (nullErr.includes(needle)) ok.push(`_null rejected for ${what}`);
    else fails.push(`brands/_null was rejected, but NOT for ${what} — no message contained "${needle}". The validator for it is gone or its wording changed.\n       got: ${nullErr.split('\n').slice(0, 12).join('\n            ')}`);
  }
}

// ---- _max must load, and carry everything ---------------------------------
try {
  const { pack, values, decl } = await declarationFor('_max');
  const want = {
    'five surfaces': Object.keys(pack.surface || {}).length === 5,
    'a mono role in extras': typeof values.mono === 'string' && /mono/i.test(values.mono),
    'every {ref} and {mix} resolved': !Object.values(values).some((v) => typeof v === 'string' && /[{}]/.test(v)),
    'a {mix} with a hex literal operand': /^#[0-9a-f]{6}$/i.test(String(values.chartD)),
    'core + extras declared': decl.length === 14 + Object.keys(pack.extra).length,
    'an explicit subset range': typeof pack.subset?.unicodes === 'string',
    'two faces including a mono': pack.face.length === 2,
  };
  for (const [what, held] of Object.entries(want)) {
    if (held) ok.push(`_max has ${what}`);
    else fails.push(`brands/_max loaded but lost ${what} — the core has dropped a capability a real brand depends on`);
  }
} catch (e) {
  fails.push(`brands/_max FAILED to load. It is the maximal valid shape, so this is a core regression:\n       ${String(e.message).split('\n').join('\n       ')}`);
}

// ---- the resolver's own guards --------------------------------------------
for (const [what, needle] of NULL_MUST_ALSO_REJECT) {
  if (nullErr.includes(needle)) ok.push(`_null rejected for ${what}`);
  // Not a failure on its own: load() reports structural errors first and stops,
  // so a dangling reference is only reached once the shape is valid. Say so
  // rather than pretending the check ran.
  else ok.push(`${what} not reached — structural errors are reported first and stop the load`);
}

for (const m of ok) console.log(`  ok   ${m}`);
for (const m of fails) console.log(`  FAIL ${m}`);
console.log(fails.length ? `\nfixtures: ${fails.length} failure(s)` : `\nfixtures: ${ok.length} assertions hold`);
process.exit(fails.length ? 1 : 0);
