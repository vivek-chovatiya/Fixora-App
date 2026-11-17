/**
 * Mock service utilities
 *
 * Shared behaviour for every Mock*Service.
 *
 * Mocks deliberately take time and can fail. A mock that always resolves
 * instantly makes the loading, error and retry states required by the
 * Definition of Done unreachable, so they could never be verified before the
 * backend exists.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { AppError } from '@/shared/types/error';

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * How long a mock call pretends to take. Field names match `AppConfig.mock` so
 * there is one vocabulary for latency across the app.
 */
export interface MockLatency {
  minLatencyMs: number;
  maxLatencyMs: number;
}

/**
 * Latency-free, for tests only.
 *
 * ⚠️ Never pass this to a service the app actually runs. Simulated latency is
 * what makes the loading and retry states reachable before the backend exists;
 * removing it from the running app would hide exactly the states the Definition
 * of Done requires. Tests assert behaviour, not waiting, so they opt out.
 */
export const NO_LATENCY: MockLatency = Object.freeze({ minLatencyMs: 0, maxLatencyMs: 0 });

/**
 * Wraps a mock result in realistic latency and an optional simulated failure.
 *
 * Latency defaults to `AppConfig.mock`, so every caller keeps its runtime
 * behaviour unless it deliberately overrides it.
 *
 * Raise `AppConfig.mock.failureRate` to exercise error and retry paths across
 * the whole app without touching a single screen.
 */
export async function simulateNetwork<T>(
  produce: () => T | Promise<T>,
  latency: MockLatency = AppConfig.mock,
): Promise<T> {
  const { failureRate } = AppConfig.mock;

  // Skipped rather than awaited at zero: a timer per call is the cost this
  // override exists to remove.
  if (latency.maxLatencyMs > 0) {
    await delay(randomBetween(latency.minLatencyMs, latency.maxLatencyMs));
  }

  if (failureRate > 0 && Math.random() < failureRate) {
    throw new AppError({
      kind: 'network',
      message: 'Simulated mock failure',
    });
  }

  return produce();
}

let idCounter = 0;

/** Deterministic-enough identifiers for mock records. */
export function mockId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

/** ISO timestamp offset from now, for seeding believable mock data. */
export function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}
