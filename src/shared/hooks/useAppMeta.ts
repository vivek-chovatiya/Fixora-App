/**
 * useAppMeta — backend-owned enumerations (priorities, payment methods).
 * Cached for the app session; the frontend never invents these values.
 */

import { metaApi } from '@/shared/services/api';
import type { AppMeta } from '@/shared/types/models';

import { useServiceQuery } from './useServiceQuery';

let cached: AppMeta | null = null;

async function loadMeta(): Promise<AppMeta> {
  if (!cached) {
    cached = await metaApi.get();
  }
  return cached;
}

export function useAppMeta() {
  return useServiceQuery(loadMeta, []);
}
