// Craft predicates. Every threshold arrives as an argument from the brand pack,
// so this file names no number and no token. HyperFrames owns correctness; this
// owns craft, and there is no upstream rule for anything below.
//
// Each predicate returns an array of complaints. Empty means it holds.

/** No two high-contrast state changes on one element closer than minMs apart.
 *  There is no photosensitivity rule anywhere upstream — zero hits for strobe,
 *  flash or photosensitive in the whole lint bundle. This is the only one. */
export function strobe(eventsMs, minMs) {
  const out = [];
  const t = [...eventsMs].sort((a, b) => a - b);
  for (let i = 1; i < t.length; i++) {
    const gap = t[i] - t[i - 1];
    if (gap < minMs) out.push(`two hits ${gap}ms apart at ${t[i - 1]}ms; the pack allows no closer than ${minMs}ms`);
  }
  return out;
}

/** Every beat must contain at least minMs of held stillness. A film with no
 *  rest reads as cheap however good each individual move is. */
export function stillness(beats, minMs) {
  const out = [];
  for (const b of beats) {
    const held = b.spans.reduce((a, s) => a + Math.max(0, s.end - s.start), 0);
    if (held < minMs) out.push(`beat "${b.name}" holds still for ${held}ms; the pack requires ${minMs}ms`);
  }
  return out;
}

/** A cascade decays: each step's amplitude is at most `decay` times the last.
 *  A flat cascade is a list, not a movement. */
export function cascade(amplitudes, decay) {
  const out = [];
  for (let i = 1; i < amplitudes.length; i++) {
    const want = amplitudes[i - 1] * decay;
    if (amplitudes[i] > want) {
      out.push(`cascade step ${i} is ${amplitudes[i]}, above ${want} (step ${i - 1} x ${decay})`);
    }
  }
  return out;
}

/** Overshoot is inverse to mass: the lightest element gets the pack's full
 *  overshoot, the heaviest gets none. `mass` is 0..1. */
export function overshootFor(mass, packOvershoot) {
  const m = Math.min(1, Math.max(0, mass));
  return packOvershoot * (1 - m);
}

/** Verify an authored overshoot against the mass it was authored for. */
export function overshoot(moves, packOvershoot, tolerance) {
  const out = [];
  for (const m of moves) {
    const want = overshootFor(m.mass, packOvershoot);
    if (Math.abs(m.overshoot - want) > tolerance) {
      out.push(`"${m.name}" overshoots ${m.overshoot} at mass ${m.mass}; expected ${want.toFixed(2)} +/- ${tolerance}`);
    }
  }
  return out;
}

/** Display type must still be legible at the smallest camera scale the film
 *  reaches. This is the law with no upstream equivalent, because check audits
 *  contrast and size at 1:1 composition pixels and never sees the camera. */
export function typeFloor(runs, minPx, minCameraScale) {
  const out = [];
  for (const r of runs) {
    const rendered = r.px * (r.scaled ? minCameraScale : 1);
    if (rendered < minPx) {
      out.push(`"${r.name}" renders at ${rendered.toFixed(1)}px (${r.px}px x ${r.scaled ? minCameraScale : 1}); the pack floor is ${minPx}px`);
    }
  }
  return out;
}

/** No single entrance verb may carry more than `share` of a film's reveals.
 *  This is the only mechanical defence against every film looking the same. */
export function diversity(verbs, share) {
  const out = [];
  const n = verbs.length;
  if (!n) return out;
  const count = new Map();
  for (const v of verbs) count.set(v, (count.get(v) || 0) + 1);
  for (const [v, c] of count) {
    if (c / n > share) out.push(`"${v}" is ${c} of ${n} reveals (${(c / n * 100).toFixed(0)}%); the ceiling is ${(share * 100).toFixed(0)}%`);
  }
  return out;
}

/** Utilisation of a brand's declared vocabulary. Warn before a brand runs out
 *  of ideas, not after. */
export function utilisation(used, available, warnAt) {
  const u = available ? used / available : 0;
  return u >= warnAt
    ? [`${used} of ${available} vocabulary entries used (${(u * 100).toFixed(0)}%); at ${(warnAt * 100).toFixed(0)}% the brand needs new material, not another recombination`]
    : [];
}
