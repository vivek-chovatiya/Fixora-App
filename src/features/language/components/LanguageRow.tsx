/**
 * LanguageRow
 *
 * The "Language: हिन्दी" row in the customer and vendor profiles — the way back
 * to the chooser after the first launch (phase5-contract.md section 7). One
 * component for both profiles, so the two cannot word or draw it differently.
 *
 * Drawn as the profiles' other rows are (a full-width `SecondaryButton`), with
 * the current language named in its own script, so it can be found by someone
 * who cannot read the language the app is in.
 *
 * The glyph is the theme's `language` token (MaterialCommunityIcons
 * `translate`), added for this row with the owner's lead's approval on
 * 28/11/2026; it was `settings` until then, which read as app settings.
 */

import React from 'react';

import { LANGUAGE_COPY, LANGUAGE_NAMES } from '@/features/language/constants/languageCopy';
import { useLocaleState } from '@/features/language/hooks/useLanguage';
import { SecondaryButton } from '@/shared/components';

export interface LanguageRowProps {
  onPress: () => void;
  disabled?: boolean;
}

export function LanguageRow({ onPress, disabled }: LanguageRowProps) {
  const { locale } = useLocaleState();

  return (
    <SecondaryButton
      label={LANGUAGE_COPY.profileRow.label.replace('{language}', LANGUAGE_NAMES[locale])}
      icon="language"
      onPress={onPress}
      disabled={disabled}
      fullWidth
      accessibilityHint={LANGUAGE_COPY.profileRow.hint}
    />
  );
}
