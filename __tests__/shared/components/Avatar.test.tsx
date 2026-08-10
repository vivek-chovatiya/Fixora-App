/**
 * getInitials is pure branching over messy real-world names, which is exactly
 * the kind of logic that breaks quietly. The rendering paths around it are
 * covered by type-checking, so only the logic is tested here.
 */

import { getInitials } from '@/shared/components/Avatar';

describe('getInitials', () => {
  it('takes the first letter of the first and last word', () => {
    expect(getInitials('Asha Patel')).toBe('AP');
  });

  it('uses a single letter for a single-word name', () => {
    expect(getInitials('Asha')).toBe('A');
  });

  it('skips middle names rather than returning three letters', () => {
    expect(getInitials('Asha Rani Patel')).toBe('AP');
  });

  it('uppercases lowercase input', () => {
    expect(getInitials('asha patel')).toBe('AP');
  });

  it('collapses irregular whitespace instead of producing blanks', () => {
    expect(getInitials('  Asha   Patel  ')).toBe('AP');
  });

  it('returns empty string for missing names so the icon fallback is used', () => {
    expect(getInitials(undefined)).toBe('');
    expect(getInitials(null)).toBe('');
    expect(getInitials('')).toBe('');
    expect(getInitials('   ')).toBe('');
  });
});
