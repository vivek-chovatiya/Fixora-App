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
 *
 * The titles are the shared components' words (`componentCopy.ts`), read each
 * time `title` is: a getter, not a stored string, so a heading follows the
 * app's language rather than the one this module loaded in (Phase 5,
 * 28/11/2026). `icon` and `tone` are not words and never change.
 */

import { COMPONENT_COPY } from '@/shared/components/componentCopy';
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
const VISUALS: Readonly<Record<AppErrorKind, Omit<ErrorPresentation, 'title'>>> = {
  network: { icon: 'offline', tone: 'warning' },
  timeout: { icon: 'offline', tone: 'warning' },
  unauthorized: { icon: 'warning', tone: 'warning' },
  forbidden: { icon: 'warning', tone: 'danger' },
  notFound: { icon: 'empty', tone: 'neutral' },
  validation: { icon: 'warning', tone: 'warning' },
  conflict: { icon: 'warning', tone: 'warning' },
  permission: { icon: 'warning', tone: 'warning' },
  server: { icon: 'error', tone: 'danger' },
  cancelled: { icon: 'info', tone: 'neutral' },
  unknown: { icon: 'error', tone: 'danger' },
};

/** A kind's look, with its heading read in the current language on every access. */
function presentationOf(kind: AppErrorKind): ErrorPresentation {
  const { icon, tone } = VISUALS[kind];
  return Object.freeze({
    icon,
    tone,
    get title() {
      return COMPONENT_COPY.errorTitles[kind];
    },
  });
}

export const ERROR_PRESENTATION: Readonly<Record<AppErrorKind, ErrorPresentation>> = Object.freeze(
  {
    network: presentationOf('network'),
    timeout: presentationOf('timeout'),
    unauthorized: presentationOf('unauthorized'),
    forbidden: presentationOf('forbidden'),
    notFound: presentationOf('notFound'),
    validation: presentationOf('validation'),
    conflict: presentationOf('conflict'),
    permission: presentationOf('permission'),
    server: presentationOf('server'),
    cancelled: presentationOf('cancelled'),
    unknown: presentationOf('unknown'),
  },
);
