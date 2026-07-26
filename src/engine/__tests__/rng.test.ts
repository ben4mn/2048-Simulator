/**
 * SeededRNG determinism and distribution tests.
 * Golden values below were captured by executing src/engine/rng.ts directly
 * (node --experimental type stripping / vitest) — not hand-computed.
 */
import { describe, expect, it } from 'vitest';
import { SeededRNG, generateSeed } from '../rng';

describe('SeededRNG golden values', () => {
  // Captured by running: new SeededRNG('GOLDEN-SEED'), 10x next()
  const GOLDEN_NEXT = [
    0.7102424234617501, 0.7359231093432754, 0.513843611581251,
    0.34504901757463813, 0.5747436187230051, 0.4567492678761482,
    0.35256102168932557, 0.38499539205804467, 0.8706735270097852,
    0.20669474988244474,
  ];

  // Captured by running: new SeededRNG('A7X9K2M1'), 10x nextInt(0, 100)
  const GOLDEN_INTS = [91, 41, 0, 85, 79, 74, 59, 69, 46, 47];

  it('produces the locked next() sequence for seed GOLDEN-SEED', () => {
    const rng = new SeededRNG('GOLDEN-SEED');
    const vals = Array.from({ length: 10 }, () => rng.next());
    expect(vals).toEqual(GOLDEN_NEXT);
  });

  it('produces the locked nextInt(0,100) sequence for seed A7X9K2M1', () => {
    const rng = new SeededRNG('A7X9K2M1');
    const vals = Array.from({ length: 10 }, () => rng.nextInt(0, 100));
    expect(vals).toEqual(GOLDEN_INTS);
  });

  it('two instances with the same seed produce identical sequences', () => {
    const a = new SeededRNG('SAME-SEED');
    const b = new SeededRNG('SAME-SEED');
    for (let i = 0; i < 1000; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different seeds produce different sequences', () => {
    const a = new SeededRNG('SEED-A');
    const b = new SeededRNG('SEED-B');
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('reset() replays the sequence from the start', () => {
    const rng = new SeededRNG('RESET-SEED');
    const first = Array.from({ length: 20 }, () => rng.next());
    rng.reset();
    const second = Array.from({ length: 20 }, () => rng.next());
    expect(second).toEqual(first);
  });
});

describe('SeededRNG bounds and distribution', () => {
  it('next() stays in [0, 1) over many draws', () => {
    const rng = new SeededRNG('BOUNDS-SEED');
    for (let i = 0; i < 100000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt(min, max) returns integers in [min, max) and hits every value', () => {
    const rng = new SeededRNG('INT-SEED');
    const seen = new Set<number>();
    for (let i = 0; i < 10000; i++) {
      const v = rng.nextInt(3, 8);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(8);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('choice() never returns undefined for non-empty arrays', () => {
    const rng = new SeededRNG('CHOICE-SEED');
    const arr = ['a', 'b', 'c', 'd', 'e'];
    for (let i = 0; i < 10000; i++) {
      const v = rng.choice(arr);
      expect(v).not.toBeUndefined();
      expect(arr).toContain(v);
    }
  });

  it('choice() on a single-element array always returns that element', () => {
    const rng = new SeededRNG('ONE-SEED');
    for (let i = 0; i < 100; i++) {
      expect(rng.choice([42])).toBe(42);
    }
  });

  it('nextBool(0.9) is true about 90% of the time over 100k draws (±2%)', () => {
    const rng = new SeededRNG('BOOL-SEED');
    let trues = 0;
    const N = 100000;
    for (let i = 0; i < N; i++) {
      if (rng.nextBool(0.9)) trues++;
    }
    const ratio = trues / N;
    expect(ratio).toBeGreaterThan(0.88);
    expect(ratio).toBeLessThan(0.92);
  });

  it('nextBool() defaults to roughly 50/50', () => {
    const rng = new SeededRNG('BOOL-DEFAULT');
    let trues = 0;
    const N = 100000;
    for (let i = 0; i < N; i++) {
      if (rng.nextBool()) trues++;
    }
    expect(trues / N).toBeGreaterThan(0.48);
    expect(trues / N).toBeLessThan(0.52);
  });
});

describe('generateSeed', () => {
  it('returns 8 uppercase alphanumeric characters', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateSeed()).toMatch(/^[A-Z0-9]{8}$/);
    }
  });
});
