/**
 * useOnboardingGate
 *
 * Answers one question: does this user still need the introduction?
 *
 * It reads storage once, on mount, and never again. Completion is written when
 * the user leaves onboarding and is not read back — by then the answer is
 * already known to the tree that asked, and re-reading would only invite a
 * second decision to disagree with the first.
 *
 * Deliberately not Redux. Exactly one consumer needs this, it is read once per
 * launch, and nothing else in the application ever branches on it — which is the
 * definition CLAUDE.md section 12 gives for state that should stay local.
 */

import { useEffect, useState } from 'react';

import { getOnboardingStorage } from '@/core/storage/OnboardingStorage';

/**
 * `checking` is a real state, not an implementation detail to be hidden. The
 * answer comes from the device, so there is a moment where it is genuinely
 * unknown — and guessing during it is what makes a first-time user see sign in
 * flash before the introduction replaces it.
 */
export type OnboardingGate = 'checking' | 'required' | 'completed';

export function useOnboardingGate(): OnboardingGate {
  const [gate, setGate] = useState<OnboardingGate>('checking');

  useEffect(() => {
    let isActive = true;

    getOnboardingStorage()
      .hasCompletedOnboarding()
      .then(completed => {
        if (isActive) {
          setGate(completed ? 'completed' : 'required');
        }
      })
      // The storage layer already handles its own failures and answers `false`.
      // This is the belt to that braces: an unreadable device must not leave the
      // user on a splash screen for ever.
      .catch(() => {
        if (isActive) {
          setGate('required');
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return gate;
}
