import type { Pack } from '../pack.ts';

/**
 * Business Career College. Canadian licensing exam prep, published by WKT and
 * running on the ReadyEngine platform. Light-first in the product, navy-first
 * in film: the securities work is read on white pages and white screens, and
 * this pack keeps that as its default surface while declaring the studio navy
 * the films actually sit on as `.s-navy`.
 *
 * Every colour here is the live site's own, lifted from the two Next.js chunks
 * that define `--bcc-*` (businesscareercollege.com, 2026-09-15). The brief's
 * three named colours map exactly: navy `--bcc-dark` #0d1f3c, teal
 * `--bcc-navy` #004e74, orange `--bcc-red-dark` #d5410e. The site keeps a
 * second, brighter orange, `--bcc-red` #f15d2a, which is the one in the
 * logo, and that split is load-bearing rather than decorative: #d5410e
 * clears AA on white and fails it on navy, #f15d2a is the reverse. So the
 * brand token is contextual, the same case wkt's three reds made.
 *
 * Type is the site's own too: Inter for display, Jost for supporting copy,
 * both self-hosted by the site as variable faces and instanced here to the
 * five static weights the films set.
 */
const bcc: Pack = {
  slug: 'bcc',
  name: 'Business Career College',

  token: {
    ground: '#ffffff',
    onGround: '{extra.dark}',
    surface: '{extra.grey}',
    onSurface: '{extra.dark}',
    // 4.57:1 on white. On navy it drops to 3.59, see surface.navy.
    brand: '{extra.orange}',
    onBrand: '#ffffff',
    accent: '{extra.teal}',
    onAccent: '#ffffff',
    line: '#ccd6e0',
    muted: '#5c6b7f',
    display: 'Inter, ui-sans-serif, system-ui, sans-serif',
    text: 'Jost, ui-sans-serif, system-ui, sans-serif',
    // 88 BPM, which is the tempo the film's score is written to: 60/88 s.
    // Every hold in a bcc film is a whole number of these.
    beat: 682,
    unit: 8,
  },

  extra: {
    dark: '#0d1f3c',
    ink: '#051047',
    teal: '#004e74',
    tealBright: '#059c9e',
    tealDeep: '#0a7476',
    orange: '#d5410e',
    orangeLift: '#f15d2a',
    orangeDeep: '#b8380c',
    mint: '#d6fced',
    lime: '#b5db75',
    yellow: '#f2db4a',
    grey: '#f5f5f5',
  },

  surface: {
    // The studio ground. Product captures and paper both read as light objects
    // standing on it, and the brand orange has to lift to stay legible.
    navy: {
      ground: '{extra.dark}',
      onGround: '#ffffff',
      surface: '#1b3453',
      onSurface: '#ffffff',
      brand: '{extra.orangeLift}',
      onBrand: '{extra.dark}',
      accent: '{extra.mint}',
      onAccent: '{extra.dark}',
      line: '#33486a',
      muted: '#9fb0c4',
    },
  },

  craft: {
    strobeMinMs: 240,
    // One beat of the 88 BPM grid, near enough. Nothing in a film for this
    // brand may move continuously for longer than this without a rest.
    stillnessMinMs: 820,
    cascadeDecay: 0.76,
    // Measured, not springy. Regulatory copy does not bounce.
    overshoot: 0.03,
    minTypePx: 22,
    minCameraScale: 0.92,
  },

  face: [
    { family: 'Inter', weight: 400, file: 'font/Inter-400.woff2' },
    { family: 'Inter', weight: 600, file: 'font/Inter-600.woff2' },
    { family: 'Inter', weight: 700, file: 'font/Inter-700.woff2' },
    { family: 'Jost', weight: 400, file: 'font/Jost-400.woff2' },
    { family: 'Jost', weight: 500, file: 'font/Jost-500.woff2' },
  ],

  logo: { mark: 'logo/mark.svg', reversed: 'logo/reversed.svg' },

  defaults: { width: 1920, height: 1080, fps: 60 },
};

export default bcc;
