/**
 * Mulberry32 - A simple, fast pseudo-random number generator
 * Provides deterministic random numbers from a seed
 */

export class SeededRNG {
  private state: number;
  private readonly originalSeed: string;

  constructor(seed: string) {
    this.originalSeed = seed;
    this.state = this.hashSeed(seed);
  }

  /**
   * Convert alphanumeric seed string to 32-bit number
   */
  private hashSeed(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) || 1; // Ensure non-zero
  }

  /**
   * Generate next random number (0 to 1)
   * Uses mulberry32 algorithm
   */
  next(): number {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer between min (inclusive) and max (exclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Return true with given probability (0-1)
   */
  nextBool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Get a random element from an array
   */
  choice<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length)];
  }

  /**
   * Reset to original seed
   */
  reset(): void {
    this.state = this.hashSeed(this.originalSeed);
  }

  /**
   * Get current seed
   */
  getSeed(): string {
    return this.originalSeed;
  }
}

/**
 * Generate a random 8-character alphanumeric seed
 */
export function generateSeed(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
