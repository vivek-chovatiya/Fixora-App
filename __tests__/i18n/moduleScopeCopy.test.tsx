/**
 * Copy that used to be read when its module loaded, and so stayed in that
 * language after the app switched (core/i18n/index.ts, "What must never be
 * captured at module scope").
 *
 * Each module below is imported while the app speaks English — exactly the
 * situation that froze them — and then asked for its words in Hindi or
 * Gujarati:
 * - the offline banner's spoken sentence pair (a module-scope template);
 * - zod messages in schemas built at import (`reviewSchema`, `profileSchema`,
 *   the shared `phoneSchema`, the auth `otpSchema`);
 * - the payment status table, and the error headings;
 * - the vendor's request filters, group headings and empty states (a table of
 *   labels built at import), and the team member form's zod messages.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { resetLocaleState, updateLocaleState } from '@/core/i18n';
import { otpSchema } from '@/features/auth/validation/authSchemas';
import { profileSchema } from '@/features/customer/validation/profileSchemas';
import { reviewSchema } from '@/features/customer/validation/reviewSchemas';
import {
  VENDOR_REQUEST_EMPTY,
  VENDOR_REQUEST_FILTERS,
  vendorRequestLinesFor,
} from '@/features/vendor/constants/requestFilters';
import { VENDOR_COPY_EN } from '@/features/vendor/constants/vendorCopy';
import { VENDOR_COPY_HI } from '@/features/vendor/constants/vendorCopy.hi';
import { teamMemberSchema } from '@/features/vendor/validation/teamMemberSchema';
import { ERROR_PRESENTATION, OfflineBanner } from '@/shared/components';
import { presentPaymentStatus } from '@/shared/presentation/payment';
import { MockNetworkStatusService } from '@/shared/services/mock/MockNetworkStatusService';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import { TEAM_MEMBER_NAME_MAX_LENGTH } from '@/shared/services/types/VendorTeamService';
import { ThemeProvider } from '@/shared/theme';
import { phoneSchema } from '@/shared/validation/phone';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  resetServices();
  resetLocaleState();
  updateLocaleState({ isChosen: true, isRestored: true });
});

/** The first message a schema refuses `value` with. */
function messageOf(schema: { safeParse(value: unknown): { success: boolean; error?: { issues: { message: string }[] } } }, value: unknown) {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
  return result.error!.issues[0].message;
}

describe('read when shown, not when loaded', () => {
  it('the offline banner announces itself in the current language', async () => {
    registerService('networkStatus', new MockNetworkStatusService({ isOffline: true }));
    updateLocaleState({ locale: 'hi' });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <OfflineBanner />
        </ThemeProvider>,
      );
    });
    mounted.push(renderer);

    const [alert] = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props.accessibilityRole === 'alert',
    );
    expect(alert.props.accessibilityLabel).toBe(
      'आप ऑफ़लाइन हैं। दोबारा कनेक्ट होने तक कुछ चीज़ें लोड नहीं हो सकतीं।',
    );
  });

  it('a schema built at import refuses in the language of the moment it checks', () => {
    expect(messageOf(reviewSchema, { rating: 0, comment: '' })).toBe(
      'Choose a rating from 1 to 5 stars.',
    );

    updateLocaleState({ locale: 'gu' });
    const gujarati = messageOf(reviewSchema, { rating: 0, comment: '' });
    expect(gujarati).not.toBe('Choose a rating from 1 to 5 stars.');
    expect(gujarati).toMatch(/[઀-૿]/);

    updateLocaleState({ locale: 'hi' });
    expect(messageOf(phoneSchema, '')).toBe('अपना फ़ोन नंबर डालें।');
    expect(messageOf(otpSchema, { code: '12' })).toBe('सभी 6 अंक डालें।');
    expect(messageOf(profileSchema, { firstName: ' ', lastName: '', email: '' })).toMatch(
      /[ऀ-ॿ]/,
    );
  });

  it('a status table and the error headings answer in the current language', () => {
    updateLocaleState({ locale: 'hi' });

    expect(presentPaymentStatus('PAID')).toBe('भुगतान हो गया');
    expect(presentPaymentStatus('SOMETHING_NEW')).toBe('भुगतान की स्थिति उपलब्ध नहीं');
    expect(ERROR_PRESENTATION.network.title).toBe('कनेक्शन नहीं है');
    // Not words, so the same in every language.
    expect(ERROR_PRESENTATION.network.icon).toBe('offline');
  });

  it('the vendor’s request filters, headings and empty states follow the language', () => {
    const EN = VENDOR_COPY_EN.requests;
    const HI = VENDOR_COPY_HI.requests!;
    const chips = VENDOR_REQUEST_FILTERS;
    const list = {
      pending: [{ id: 'req-1' } as VendorJobSummary],
      active: [],
      completed: [],
      rejected: [],
    };
    const heading = () => vendorRequestLinesFor(list, 'all')[0];

    expect(chips.map(chip => chip.label)).toEqual([
      EN.filterAll,
      EN.filterPending,
      EN.filterActive,
      EN.filterCompleted,
      EN.filterRejected,
    ]);

    updateLocaleState({ locale: 'hi' });

    // The same array the rail was given, now speaking Hindi.
    expect(VENDOR_REQUEST_FILTERS).toBe(chips);
    expect(chips.map(chip => chip.label)).toEqual([
      HI.filterAll,
      HI.filterPending,
      HI.filterActive,
      HI.filterCompleted,
      HI.filterRejected,
    ]);
    expect(heading()).toMatchObject({ kind: 'heading', title: HI.groupPending });
    expect(VENDOR_REQUEST_EMPTY.rejected).toEqual({
      title: HI.emptyRejectedTitle,
      message: HI.emptyRejectedMessage,
    });
    expect(HI.filterAll).not.toBe(EN.filterAll);
  });

  it('the team member form refuses in the language of the moment it checks', () => {
    const EN = VENDOR_COPY_EN.validation;
    const HI = VENDOR_COPY_HI.validation!;
    const blankName = { name: ' ', role: '', phone: '' };
    const longName = { name: 'a'.repeat(TEAM_MEMBER_NAME_MAX_LENGTH + 1), role: '', phone: '' };

    expect(messageOf(teamMemberSchema, blankName)).toBe(EN.memberNameRequired);

    updateLocaleState({ locale: 'hi' });

    expect(messageOf(teamMemberSchema, blankName)).toBe(HI.memberNameRequired);
    expect(messageOf(teamMemberSchema, longName)).toBe(
      HI.memberNameTooLong!(TEAM_MEMBER_NAME_MAX_LENGTH),
    );
    expect(messageOf(teamMemberSchema, blankName)).toMatch(/[ऀ-ॿ]/);
  });
});
