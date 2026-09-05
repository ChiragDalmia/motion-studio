import type { Pack } from '../pack.ts';

/**
 * FIXTURE — this pack MUST NOT build. Every field below is wrong in a specific,
 * named way, and tools/fixtures.mjs asserts the validator says so. If this pack
 * ever loads cleanly, a validator has been weakened.
 *
 * Fixture packs are `_`-prefixed and are skipped by every normal command.
 */
const nul = {
  slug: '_null',                 // 1. leading underscore, so the slug regex rejects it
  name: 'Null fixture',

  token: {
    ground: '#ffffff',
    onGround: '#e8e8e8',         // 2. 1.19:1 — an on- partner that fails AA
    surface: '#ffffff',
    onSurface: '#111111',
    brand: '#34bde8',
    onBrand: '#ffffff',          // 3. 2.19:1 — the mistake of putting white on a mid tone
    accent: '#ffde17',
    onAccent: '#ffffff',         // 4. also fails
    line: '#000000',             // 5. that is ink, not a hairline
    muted: '#f2f2f2',            // 6. fails the muted floor
    display: 'Nope',
    text: 'Nope',
    // 7. no beat: there is no house tempo and no fallback
    unit: 8,
  },

  extra: {
    ground: '#123456',           // 8. shadows a core token
    'not-camel': '#123456',      // 9. not a valid custom-property identifier
    dangling: '{color.doesNotExist}',   // 10. references something undeclared
  },

  // 11. craft is absent entirely
  face: [],                      // 12. no face to inline
  defaults: { width: 1920, height: 1080, fps: 30 },
} as unknown as Pack;

export default nul;
