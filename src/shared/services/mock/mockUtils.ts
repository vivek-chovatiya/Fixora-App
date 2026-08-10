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
 * Wraps a mock result in realistic latency and an optional simulated failure.
 *
 * Raise `AppConfig.mock.failureRate` to exercise error and retry paths across
 * the whole app without touching a single screen.
 */
export async function simulateNetwork<T>(produce: () => T | Promise<T>): Promise<T> {
  const { minLatencyMs, maxLatencyMs, failureRate } = AppConfig.mock;

  await delay(randomBetween(minLatencyMs, maxLatencyMs));

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
