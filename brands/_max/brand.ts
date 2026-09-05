import type { Pack } from '../pack.ts';

/**
 * FIXTURE — this pack MUST build. It is the maximal shape: every optional field
 * present, a mono role, five surfaces including one that inverts every partner,
 * a dozen extras, and every value form ({ref}, {mix} with a token operand and
 * with a hex literal, and plain literals). If this pack stops building, the
 * core has lost a capability a real brand depends on.
 */
const max: Pack = {
  slug: 'maxfixture',
  name: 'Max fixture',

  token: {
    ground: '{extra.paper}',
    onGround: '{extra.ink}',
    surface: '{mix extra.ink extra.paper 6%}',
    onSurface: '{extra.ink}',
    brand: '{extra.pine}',
    onBrand: '#ffffff',
    accent: '{extra.rust}',
    onAccent: '#ffffff',
    line: '{mix extra.ink extra.paper 12%}',
    muted: '{mix extra.ink extra.paper 86%}',
    display: 'Sans, ui-sans-serif, system-ui, sans-serif',
    text: 'Sans, ui-sans-serif, system-ui, sans-serif',
    beat: 640,
    unit: 4,
  },

  extra: {
    paper: '#f3f3f1',
    ink: '#15171b',
    pine: '#0f6e5c',
    rust: '#a63a20',
    upstream: '#2f4b8c',
    mono: 'Mono, ui-monospace, monospace',
    chartA: '{extra.pine}',
    chartB: '{extra.rust}',
    chartC: '{extra.upstream}',
    chartD: '{mix #ffffff extra.ink 40%}',
    hairOnDark: '{mix extra.paper extra.ink 24%}',
    deep: '{mix extra.ink #000000 60%}',
  },

  surface: {
    dark: {
      ground: '{extra.ink}', onGround: '{extra.paper}',
      surface: '{mix extra.paper extra.ink 12%}', onSurface: '{extra.paper}',
      brand: '{mix extra.pine extra.paper 62%}', onBrand: '{extra.ink}',
      accent: '{mix extra.rust extra.paper 66%}', onAccent: '{extra.ink}',
      line: '{extra.hairOnDark}', muted: '{mix extra.paper extra.ink 72%}',
    },
    deep: {
      ground: '{extra.deep}', onGround: '#ffffff',
      surface: '{mix extra.paper extra.deep 10%}', onSurface: '#ffffff',
      brand: '{mix extra.pine extra.paper 70%}', onBrand: '{extra.deep}',
      line: '{mix extra.paper extra.deep 22%}', muted: '{mix extra.paper extra.deep 74%}',
    },
    signal: {
      ground: '{extra.rust}', onGround: '#ffffff',
      surface: '{mix extra.ink extra.rust 26%}', onSurface: '#ffffff',
      brand: '#ffffff', onBrand: '{extra.rust}',
      line: '{mix #ffffff extra.rust 30%}', muted: '{mix #ffffff extra.rust 82%}',
    },
    quiet: {
      surface: '{mix extra.ink extra.paper 3%}',
      muted: '{mix extra.ink extra.paper 88%}',
    },
    brandOnBrand: {
      ground: '{extra.pine}', onGround: '#ffffff',
      brand: '#ffffff', onBrand: '{extra.pine}',
      line: '{mix #ffffff extra.pine 28%}', muted: '{mix #ffffff extra.pine 80%}',
    },
  },

  craft: {
    strobeMinMs: 220, stillnessMinMs: 760, cascadeDecay: 0.66,
    overshoot: 0.07, minTypePx: 22, minCameraScale: 0.86,
  },

  subset: { unicodes: 'U+0020-007E,U+00A0,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026' },

  face: [
    { family: 'Sans', weight: 500, file: 'font/Sans-500.woff2' },
    { family: 'Mono', weight: 500, style: 'normal', file: 'font/Mono-500.woff2' },
  ],

  defaults: { width: 1920, height: 1080, fps: 30 },
};

export default max;
