/**
 * The brand pack schema. One file per brand at brands/<slug>/brand.ts.
 *
 * Every type here is erased at runtime. Node strips it, nothing compiles it.
 * The authority on what is *valid* is tools/tokens.mjs, which validates the
 * loaded object and prints the rule it broke. Types are for the editor; the
 * validator is for correctness.
 *
 * Two classes of value, and the split is load-bearing:
 *
 *   Class A is `token` and `surface`: colours, lengths, font stacks, durations.
 *     These become composition variables and `--custom-properties`. A film
 *     reads them as `var(--brand)`. They can be overridden per render.
 *
 *   Class B is `craft`, `face`, `defaults` and `legal`: anything the *build*
 *     computes with, and anything GSAP interpolates. These never become CSS
 *     variables, because there is no variable type that can express a curve and
 *     Node has no CSS cascade to resolve one with.
 */

/** A literal, a `{ref}` to another token, or `{mix <a> <b> <pct>%}` in linear sRGB. */
export type Value = string | number;

export type Pack = {
  /** Must equal the directory name and match /^[a-z][a-z0-9]{2,11}$/, no hyphen. */
  slug: string;
  /** Display name, as written in copy. */
  name: string;

  /**
   * The 14-token required core. Every film may assume exactly these exist and
   * nothing more. A pack that omits one does not build.
   *
   * Each of ground/surface/brand/accent has an `on-` partner, and the partner
   * must clear WCAG AA against its base. tools/tokens.mjs computes it and
   * fails the pack, not the film.
   */
  token: {
    ground: Value; onGround: Value;
    surface: Value; onSurface: Value;
    brand: Value; onBrand: Value;
    accent: Value; onAccent: Value;
    /** Hairlines and dividers. */
    line: Value;
    /** De-emphasised ink. Still needs 3:1 against ground. */
    muted: Value;
    /** Display family stack. */
    display: Value;
    /** Body family stack. */
    text: Value;
    /** The tempo unit, ms. There is no house default and no fallback: a pack
     *  that does not declare its own tempo has not been designed. */
    beat: number;
    /** The spatial unit, px. */
    unit: number;
  };

  /**
   * Brand chips the core does not name: a third red, a sub-brand accent, a
   * chart ramp. Open by design: a fixed slot list cannot survive a brand whose
   * primary exists in three contextual values. Films reference these through a
   * surface or a brand shape, never directly.
   */
  extra?: Record<string, Value>;

  /**
   * Surfaces, not modes. A surface re-points core tokens for a region of the
   * frame; it is emitted as one `.s-<name>` class. This is how a contextual
   * token (a red that must lift on navy) is expressed without a second palette
   * or a dark-mode fork.
   */
  surface?: Record<string, Partial<Record<keyof Pack['token'], Value>>>;

  /** Class B. Craft thresholds. lib/craft.mjs holds the predicates and no numbers. */
  craft: {
    /** Minimum ms between two high-contrast state changes on one element. */
    strobeMinMs: number;
    /** Minimum ms of held stillness required per beat. */
    stillnessMinMs: number;
    /** Per-step amplitude decay in a cascade, 0..1. */
    cascadeDecay: number;
    /** Overshoot fraction for the lightest element; heavier masses get less. */
    overshoot: number;
    /** Smallest rendered type, px, at the smallest camera scale the film uses. */
    minTypePx: number;
    /** The smallest camera scale any film in this brand may push to. */
    minCameraScale: number;
  };

  /** Faces to inline. Every file must live under brands/<slug>/font/. */
  face: Array<{
    family: string;
    weight: number | string;
    style?: 'normal' | 'italic';
    /** Pack-relative path, e.g. "font/Oswald-700.woff2". */
    file: string;
  }>;

  /**
   * Optional. The codepoints tools/font.mjs keeps when it subsets this brand's
   * faces, as a CSS unicode-range list. Defaults to printable ASCII plus the
   * punctuation a film actually sets. Override it for a brand whose copy needs
   * more: accents, a currency symbol, a second script.
   *
   * font/master/ holds the untouched originals; font/ holds what ships; and
   * font/coverage.json records what survived, so tools/guard.mjs can fail a
   * film that sets a character the subset dropped rather than let it render as
   * tofu on a client's page.
   */
  subset?: { unicodes: string };

  /** Pack-relative SVG paths. Materialized into a film by tools/prepare.mjs. */
  logo?: Record<string, string>;

  defaults: {
    width: number;
    height: number;
    /** Only used by MP4 render. The web build has no frame rate. */
    fps: number;
  };
};
