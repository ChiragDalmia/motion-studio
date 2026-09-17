import type { Pack } from '../pack.ts';

/**
 * We Know Training. Safety training. Dark-first: the brand's real ground is
 * navy, and white is the exception. Its red exists in three contextual
 * values: `red` for fills, `red-ink` for text on white, `red-lift` for text
 * on navy. That is the case that killed the idea of a fixed colour-slot
 * schema. Here it is a surface, not a mode and not a second palette.
 *
 * Palette and type taken from the live site's globals.css and layout.tsx:
 * Montserrat display, Roboto body, Roboto Mono for codes and clause numbers.
 * A mono role at small sizes, four sub-brand chips and a slower tempo make this
 * the least similar pack to relo that a real brand supplies.
 */
const wkt: Pack = {
  slug: 'wkt',
  name: 'We Know Training',

  token: {
    ground: '#ffffff',
    onGround: '{extra.navy}',
    surface: '{extra.off}',
    onSurface: '{extra.navy}',
    brand: '{extra.redInk}',
    onBrand: '#ffffff',
    accent: '{extra.slate}',
    onAccent: '#ffffff',
    line: '{extra.grey}',
    muted: '{mix extra.slate ground 88%}',
    display: 'Montserrat, ui-sans-serif, system-ui, sans-serif',
    text: 'Roboto, ui-sans-serif, system-ui, sans-serif',
    // Deliberately slow against relo's 520. Safety copy is read, not scanned.
    beat: 880,
    unit: 6,
  },

  extra: {
    navy: '#05192d',
    // The fill red. Fails AA as text on white, which is exactly why red-ink exists.
    red: '#ff004d',
    redInk: '#d40040',
    redLift: '#ff3371',
    slate: '#374757',
    grey: '#c2ccce',
    off: '#eaefef',
    mono: 'ui-monospace, "Roboto Mono", SFMono-Regular, Menlo, monospace',
    sbOrange: '#f7941e',
    sbBlue: '#00a6e5',
    sbGreen: '#80c342',
    sbPurple: '#ad71db',
  },

  surface: {
    // The primary surface, despite being the second one declared. On navy the
    // red must lift or it disappears into the ground.
    navy: {
      ground: '{extra.navy}',
      onGround: '#ffffff',
      surface: '{mix extra.slate extra.navy 42%}',
      onSurface: '#ffffff',
      brand: '{extra.redLift}',
      onBrand: '{extra.navy}',
      accent: '{extra.grey}',
      onAccent: '{extra.navy}',
      line: '{mix extra.grey extra.navy 26%}',
      muted: '{mix extra.grey extra.navy 72%}',
    },
    // A full-bleed red alert band. Only white clears it.
    alert: {
      ground: '{extra.redInk}',
      onGround: '#ffffff',
      surface: '{mix extra.navy extra.redInk 30%}',
      onSurface: '#ffffff',
      brand: '#ffffff',
      onBrand: '{extra.redInk}',
      line: '{mix #ffffff extra.redInk 34%}',
      muted: '{mix #ffffff extra.redInk 84%}',
    },
  },

  craft: {
    strobeMinMs: 240,
    stillnessMinMs: 1040,
    cascadeDecay: 0.74,
    overshoot: 0.04,
    // A mono role at clause-number sizes raises the floor.
    minTypePx: 24,
    minCameraScale: 0.9,
  },

  // Montserrat 600 came off this list because gate2 measured that nothing
  // paints with it: 18.3 KB of dead weight in every artifact of this brand.
  face: [
    { family: 'Montserrat', weight: 700, file: 'font/Montserrat-700.woff2' },
    { family: 'Roboto', weight: 400, file: 'font/Roboto-400.woff2' },
    { family: 'Roboto', weight: 500, file: 'font/Roboto-500.woff2' },
    { family: 'Roboto Mono', weight: 500, file: 'font/RobotoMono-500.woff2' },
  ],

  logo: { mark: 'logo/mark.svg' },

  defaults: { width: 1920, height: 1080, fps: 30 },
};

export default wkt;
