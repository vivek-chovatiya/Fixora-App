/**
 * errorPresentation
 *
 * How each failure kind looks, in one place.
 *
 * ErrorState and Toast both dress an AppError, and they are the only two things
 * that may. A second copy of this map would let them drift, so that the same
 * failure arrives as a warning on one surface and a fault on the other — which
 * is worse than either choice made consistently.
 *
 * Nothing here touches `error.message`. The developer-facing string is not part
 * of a failure's presentation, because it is never shown.
 */

import type { ColorTokens, IconName } from '@/shared/theme';
import type { AppErrorKind } from '@/shared/types/error';

export interface ErrorPresentation {
  icon: IconName;
  tone: keyof ColorTokens;
  /** Used where a failure is given a heading. A toast shows the message alone. */
  title: string;
}

/**
 * Connection failures get their own treatment because they are the user's to
 * fix, unlike a server fault where retrying is all they can do.
 */
export const ERROR_PRESENTATION: Readonly<Record<AppErrorKind, ErrorPresentation>> = {
  network: { icon: 'offline', tone: 'warning', title: 'No connection' },
  timeout: { icon: 'offline', tone: 'warning', title: 'Taking too long' },
  unauthorized: { icon: 'warning', tone: 'warning', title: 'Session expired' },
  forbidden: { icon: 'warning', tone: 'danger', title: 'Not allowed' },
  notFound: { icon: 'empty', tone: 'neutral', title: 'Not found' },
  validation: { icon: 'warning', tone: 'warning', title: 'Check your details' },
  conflict: { icon: 'warning', tone: 'warning', title: 'Already changed' },
  permission: { icon: 'warning', tone: 'warning', title: 'Permission needed' },
  server: { icon: 'error', tone: 'danger', title: 'Something went wrong' },
  cancelled: { icon: 'info', tone: 'neutral', title: 'Cancelled' },
  unknown: { icon: 'error', tone: 'danger', title: 'Something went wrong' },
};
