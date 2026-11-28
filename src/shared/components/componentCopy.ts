/**
 * Shared component copy
 *
 * The words the shared components say for themselves — a default label, the
 * crash fallback, the offline banner, the heading each failure kind gets — in
 * one table, because they belong to no feature (phase5-contract.md section 7,
 * 28/11/2026).
 *
 * `COMPONENT_COPY_EN` is the source; `componentCopy.hi.ts` and `.gu.ts`
 * translate it; `COMPONENT_COPY` answers in the current language. Each
 * component keeps the export it always had (`APP_ERROR_FALLBACK_COPY`,
 * `OFFLINE_BANNER_COPY`, `ERROR_PRESENTATION`), now reading from here.
 *
 * ⚠️ A default prop reads it in the parameter list (`label = COMPONENT_COPY.x`),
 * which runs on every render. Never compute a label from it at module scope.
 */

import { localized } from '@/core/i18n';
import { COMPONENT_COPY_GU } from '@/shared/components/componentCopy.gu';
import { COMPONENT_COPY_HI } from '@/shared/components/componentCopy.hi';

export const COMPONENT_COPY_EN = Object.freeze({
  /**
   * The crash fallback (`AppErrorBoundary`). It tells the user what to do and
   * claims nothing it cannot know — not that their data is safe, not that
   * anyone has been told.
   */
  errorBoundary: Object.freeze({
    message:
      'Sorry — the app hit a problem. Try again, and if it keeps happening, restart the app.',
    retry: 'Try again',
  }),

  /**
   * The offline banner (`OfflineBanner`). It claims nothing it cannot know: not
   * that nothing works, not when the connection will return. "Some things" is
   * exact — whatever is already on screen stays usable.
   */
  offlineBanner: Object.freeze({
    title: "You're offline.",
    message: 'Some things may not load until you reconnect.',
  }),

  /** The heading each failure kind gets where it has one (`ERROR_PRESENTATION`). */
  errorTitles: Object.freeze({
    network: 'No connection',
    timeout: 'Taking too long',
    unauthorized: 'Session expired',
    forbidden: 'Not allowed',
    notFound: 'Not found',
    validation: 'Check your details',
    conflict: 'Already changed',
    permission: 'Permission needed',
    server: 'Something went wrong',
    cancelled: 'Cancelled',
    unknown: 'Something went wrong',
  }),

  /** `BackButton`'s defaults, for a caller that names nothing more specific. */
  backButton: Object.freeze({
    label: 'Back',
    hint: 'Returns to the previous screen',
  }),

  /** `ErrorState`'s retry button, unless the caller words it. */
  errorState: Object.freeze({
    retry: 'Try again',
  }),

  /** The reveal control on `PasswordInput`. */
  passwordInput: Object.freeze({
    reveal: 'Show',
    hide: 'Hide',
  }),

  /** `Loader`'s spoken name when it is given no label. */
  loader: Object.freeze({
    label: 'Loading',
  }),

  toast: Object.freeze({
    dismissHint: 'Dismisses this message',
  }),

  /** `Avatar`'s spoken name. `{name}` is the person's name. */
  avatar: Object.freeze({
    named: '{name} profile picture',
    unnamed: 'Profile picture',
  }),
});

export const COMPONENT_COPY = localized({
  en: COMPONENT_COPY_EN,
  hi: COMPONENT_COPY_HI,
  gu: COMPONENT_COPY_GU,
});
