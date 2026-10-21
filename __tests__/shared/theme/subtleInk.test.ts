/**
 * One rule, held centrally: text or an icon drawn on a subtle tint uses that
 * tint's own ink (owner's rule, 21/10/2026, Phase 3G-4).
 *
 * `SUBTLE_INK` names the ink for every `…Subtle` tint. This suite holds every
 * pair to 4.5:1 — what 12–16sp words need, and more than a glyph's 3:1 — in
 * both themes, computed from the theme objects. A token changed later is
 * caught here, whichever screen draws it.
 *
 * It also pins why the table exists: each coloured tone's base colour is
 * under 4.5:1 on its own tint in at least one theme, so "draw it in the
 * tone's colour" is never the answer.
 */

import { SUBTLE_INK, darkTheme, lightTheme, type ColorTone, type SubtleTint } from '@/shared/theme';

/** WCAG 2 relative luminance of a `#RRGGBB` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(at => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two `#RRGGBB` colours. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const WORDS = 4.5;

const TONES: readonly ColorTone[] = ['primary', 'info', 'success', 'warning', 'danger', 'neutral'];

const PAIRS = Object.entries(SUBTLE_INK) as [SubtleTint, keyof typeof lightTheme.colors][];

describe('subtle tints and their inks', () => {
  it('names an ink for every tone’s tint', () => {
    expect(Object.keys(SUBTLE_INK).sort()).toEqual(TONES.map(tone => `${tone}Subtle`).sort());
  });

  describe.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('in %s mode', (_scheme, theme) => {
    it.each(PAIRS)('%s is read in %s at 4.5:1 or more', (tint, ink) => {
      expect(contrast(theme.colors[ink], theme.colors[tint])).toBeGreaterThanOrEqual(WORDS);
    });
  });

  it.each(TONES.filter(tone => tone !== 'neutral'))(
    'never inks the %s tint in the tone’s own colour — too faint there in at least one theme',
    tone => {
      const tint = `${tone}Subtle` as const;
      expect(SUBTLE_INK[tint]).not.toBe(tone);
      const worst = Math.min(
        contrast(lightTheme.colors[tone], lightTheme.colors[tint]),
        contrast(darkTheme.colors[tone], darkTheme.colors[tint]),
      );
      expect(worst).toBeLessThan(WORDS);
    },
  );
});
