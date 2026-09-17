import type { Pack } from '../pack.ts';

/**
 * RELO. Exam prep. Cyan on white, navy ink, a yellow that is a signal and never
 * a surface. Palette and type taken from the live site's globals.css and
 * layout.tsx: Poppins body, Oswald 700 display only.
 */
const relo: Pack = {
  slug: 'relo',
  name: 'RELO',

  token: {
    ground: '#ffffff',
    onGround: '{extra.navy}',
    surface: '{mix extra.cyan ground 8%}',
    onSurface: '{extra.navy}',
    brand: '{extra.cyan}',
    // The cyan is a mid tone: white on it fails AA, navy clears it comfortably.
    onBrand: '{extra.navy}',
    accent: '{extra.yellow}',
    onAccent: '{extra.navy}',
    line: '{mix extra.navy ground 14%}',
    muted: '{mix extra.navy ground 86%}',
    display: 'Oswald, Haettenschweiler, Impact, sans-serif',
    text: 'Poppins, ui-sans-serif, system-ui, sans-serif',
    beat: 520,
    unit: 8,
  },

  extra: {
    navy: '#051047',
    navyLift: '#081b77',
    cyan: '#34bde8',
    cyanInk: '#2ba8ce',
    yellow: '#ffde17',
    yellowWash: '#fffce4',
  },

  surface: {
    // The navy panel. Cyan is legible on navy where navy ink obviously is not,
    // so the on- partners invert and `brand` re-points to the darker cyan's
    // opposite. This is the contextual case, expressed as a surface.
    navy: {
      ground: '{extra.navy}',
      onGround: '#ffffff',
      surface: '{extra.navyLift}',
      onSurface: '#ffffff',
      brand: '{extra.cyan}',
      onBrand: '{extra.navy}',
      line: '{mix extra.cyan extra.navy 28%}',
      muted: '{mix extra.cyan extra.navy 58%}',
    },
    // The yellow footer band. Nothing but navy survives on it.
    signal: {
      ground: '{extra.yellow}',
      onGround: '{extra.navy}',
      surface: '{extra.yellowWash}',
      onSurface: '{extra.navy}',
      brand: '{extra.navy}',
      onBrand: '{extra.yellow}',
      line: '{mix extra.navy extra.yellow 22%}',
      muted: '{mix extra.navy extra.yellow 88%}',
    },
  },

  craft: {
    strobeMinMs: 200,
    stillnessMinMs: 640,
    cascadeDecay: 0.62,
    overshoot: 0.09,
    minTypePx: 20,
    minCameraScale: 0.82,
  },

  // Only faces that are actually painted with belong here: every one is inlined
  // into every artifact of this brand. gate2 measures per-face status and
  // reports the byte cost of any that nothing references, which is how
  // Poppins 400 and 700 came off this list, 15.3 KB of dead weight in each
  // film. Their .woff2 files stay in font/ because the brand owns those
  // weights; adding one back is a single line here.
  face: [
    { family: 'Oswald', weight: 700, file: 'font/Oswald-700.woff2' },
    { family: 'Poppins', weight: 500, file: 'font/Poppins-500.woff2' },
    { family: 'Poppins', weight: 600, file: 'font/Poppins-600.woff2' },
  ],

  logo: { mark: 'logo/mark.svg' },

  defaults: { width: 1920, height: 1080, fps: 30 },
};

export default relo;
