/**
 * The gate decides whether a launch shows the introduction, which makes it the
 * one piece of onboarding a user cannot opt out of meeting. Two failures matter:
 * showing it to someone who has already finished it, and — far worse — leaving
 * anyone stranded on a splash screen because the device would not answer.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import {
  setOnboardingStorage,
  type OnboardingStorage,
} from '@/core/storage/OnboardingStorage';
import {
  useOnboardingGate,
  type OnboardingGate,
} from '@/features/onboarding/hooks/useOnboardingGate';

/** Renders the hook alone and reports what it decided. */
async function renderGate(storage: OnboardingStorage) {
  setOnboardingStorage(storage);

  const seen: OnboardingGate[] = [];

  function Probe() {
    seen.push(useOnboardingGate());
    return null;
  }

  await act(async () => {
    ReactTestRenderer.create(<Probe />);
  });

  return { seen, settled: seen[seen.length - 1] };
}

function storageThat(answer: () => Promise<boolean>): OnboardingStorage {
  return {
    hasCompletedOnboarding: jest.fn(answer),
    setOnboardingCompleted: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  };
}

describe('useOnboardingGate', () => {
  it('starts by admitting it does not know yet', async () => {
    const { seen } = await renderGate(storageThat(async () => true));

    // The answer lives on the device, so there is a real moment where it is
    // unknown. Guessing during it is what makes sign in flash before the
    // introduction replaces it.
    expect(seen[0]).toBe('checking');
  });

  it('requires onboarding on a first launch', async () => {
    const { settled } = await renderGate(storageThat(async () => false));

    expect(settled).toBe('required');
  });

  it('skips onboarding once it has been completed', async () => {
    const { settled } = await renderGate(storageThat(async () => true));

    expect(settled).toBe('completed');
  });

  it('shows the introduction rather than stalling when storage fails', async () => {
    const { settled } = await renderGate(
      storageThat(async () => {
        throw new Error('storage unavailable');
      }),
    );

    // Showing it twice is a mild annoyance. Leaving the user on a splash screen
    // for ever is not recoverable without reinstalling.
    expect(settled).toBe('required');
  });
});
