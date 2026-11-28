/**
 * The team member form's rules (Phase 3E-7): what a vendor is told, and what
 * is sent.
 *
 * Pinned here: the name is required and bounded; the role is optional but
 * bounded (phase5-contract.md section 4, T137, 28/11/2026 — it was required by
 * the owner's decision of 2026-10-08); the phone is optional and, when typed,
 * held to the app's one phone rule with that rule's own words; values are
 * trimmed; the input sent carries exactly the name and — only when given — the
 * role and the phone as digits.
 */

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import {
  buildTeamMemberInput,
  teamMemberFormValues,
  teamMemberSchema,
} from '@/features/vendor/validation/teamMemberSchema';
import { phoneSchema } from '@/shared/validation/phone';

const COPY = VENDOR_COPY.validation;

/** The message for each field that failed, by field. */
function messages(values: { name: string; role: string; phone: string }) {
  const result = teamMemberSchema.safeParse(values);
  if (result.success) {
    return {};
  }
  return Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message]));
}

/** What the shared phone rule says about a value. */
const phoneMessage = (value: string) => {
  const result = phoneSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
};

describe('teamMemberSchema', () => {
  it('accepts a name and a role, with or without a phone', () => {
    expect(messages({ name: 'Kiran Rao', role: 'Apprentice', phone: '' })).toEqual({});
    expect(messages({ name: 'Kiran Rao', role: 'Apprentice', phone: '90000 00104' })).toEqual({});
  });

  it('asks for a name, blank or only spaces', () => {
    expect(messages({ name: '', role: 'Apprentice', phone: '' })).toEqual({
      name: COPY.memberNameRequired,
    });
    expect(messages({ name: '   ', role: 'Apprentice', phone: '' })).toEqual({
      name: COPY.memberNameRequired,
    });
  });

  it('takes no role at all — blank or only spaces — as an answer (T137)', () => {
    expect(messages({ name: 'Kiran Rao', role: '', phone: '' })).toEqual({});
    expect(messages({ name: 'Kiran Rao', role: '   ', phone: '' })).toEqual({});
    expect(teamMemberSchema.parse({ name: 'Kiran Rao', role: '   ', phone: '' }).role).toBe('');
  });

  it('bounds the name at 80 characters and the role at 60', () => {
    expect(messages({ name: 'N'.repeat(80), role: 'R'.repeat(60), phone: '' })).toEqual({});
    expect(messages({ name: 'N'.repeat(81), role: 'R'.repeat(61), phone: '' })).toEqual({
      name: COPY.memberNameTooLong(80),
      role: COPY.memberRoleTooLong(60),
    });
  });

  it('holds a typed phone to the shared rule, in that rule’s own words', () => {
    for (const phone of ['12345', 'call me', '1'.repeat(16)]) {
      expect(messages({ name: 'Kiran Rao', role: 'Apprentice', phone })).toEqual({
        phone: phoneMessage(phone),
      });
    }
  });

  it('treats a phone of only spaces as no phone', () => {
    expect(messages({ name: 'Kiran Rao', role: 'Apprentice', phone: '   ' })).toEqual({});
  });

  it('trims what it validates', () => {
    const parsed = teamMemberSchema.parse({ name: ' Kiran Rao ', role: ' Apprentice ', phone: ' 9000000104 ' });

    expect(parsed).toEqual({ name: 'Kiran Rao', role: 'Apprentice', phone: '9000000104' });
  });
});

describe('buildTeamMemberInput', () => {
  it('sends a phone as digits', () => {
    expect(buildTeamMemberInput({ name: 'Kiran Rao', role: 'Apprentice', phone: '+91 90000-00104' })).toEqual({
      name: 'Kiran Rao',
      role: 'Apprentice',
      phone: '919000000104',
    });
  });

  it('leaves the phone off entirely when there is none — not an empty string', () => {
    const input = buildTeamMemberInput({ name: 'Kiran Rao', role: 'Apprentice', phone: '' });

    expect(Object.keys(input).sort()).toEqual(['name', 'role']);
  });

  it('sends the photo the form holds, as one more field (2026-10-21)', () => {
    const photoUrl = 'https://cdn.example.com/team/kiran.jpg';

    expect(buildTeamMemberInput({ name: 'Kiran Rao', role: 'Apprentice', phone: '' }, photoUrl)).toEqual({
      name: 'Kiran Rao',
      role: 'Apprentice',
      photoUrl,
    });
  });

  it('leaves the role off entirely when there is none — not an empty string (T137)', () => {
    const input = buildTeamMemberInput(teamMemberSchema.parse({ name: 'Kiran Rao', role: '  ', phone: '' }));

    expect(input).toEqual({ name: 'Kiran Rao' });
    expect('role' in input).toBe(false);
  });

  it('leaves the photo off entirely when there is none — not an empty string', () => {
    for (const photoUrl of [undefined, '']) {
      const input = buildTeamMemberInput({ name: 'Kiran Rao', role: 'Apprentice', phone: '' }, photoUrl);

      expect(Object.keys(input).sort()).toEqual(['name', 'role']);
    }
  });
});

describe('teamMemberFormValues', () => {
  it('opens blank for a new member', () => {
    expect(teamMemberFormValues()).toEqual({ name: '', role: '', phone: '' });
  });

  it('opens on a member’s details, an absent phone as blank', () => {
    expect(
      teamMemberFormValues({ id: 'tm_3', name: 'Farhan Ali', role: 'Helper', status: 'ACTIVE' }),
    ).toEqual({
      name: 'Farhan Ali',
      role: 'Helper',
      phone: '',
    });
  });

  it('opens a member with no role on a blank role', () => {
    expect(teamMemberFormValues({ id: 'tm_9', name: 'Leela Das', status: 'ACTIVE' })).toEqual({
      name: 'Leela Das',
      role: '',
      phone: '',
    });
  });

  it('never puts the status in the form — it is changed on its own, not on Save', () => {
    const values = teamMemberFormValues({
      id: 'tm_3',
      name: 'Farhan Ali',
      role: 'Helper',
      status: 'DISABLED',
    });

    expect(Object.keys(values).sort()).toEqual(['name', 'phone', 'role']);
    expect(Object.keys(buildTeamMemberInput(values)).sort()).toEqual(['name', 'role']);
  });
});
