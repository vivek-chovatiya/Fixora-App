/**
 * LanguageScreen
 *
 * "Choose your language" — English, हिन्दी, ગુજરાતી (phase5-contract.md
 * section 7, approved by the owner 28/11/2026; PROJECT_BIBLE.md section 75).
 *
 * One screen, two ways in:
 * - `first` — shown once, on a first launch, before the introduction or sign in
 *   (`AuthNavigator` renders it while no language has been chosen on this
 *   device). Continue saves the choice; the navigator then opens on onboarding
 *   or sign in, in the chosen language.
 * - `change` — `ChangeLanguageScreen`, pushed from the Language row in the
 *   customer or vendor profile. Save goes back to the profile and applies the
 *   language there.
 *
 * Tapping a language only selects it; nothing changes until the button is
 * pressed, so Back always leaves the language as it was. The current language
 * is selected when the screen opens.
 *
 * ⚠️ Applying a new language re-mounts the whole tree below the providers
 * (AppRoot), this screen included. So `change` leaves first and applies
 * second: the re-mount then lands on the profile, already in the new language,
 * rather than re-opening this screen with nowhere obvious to go.
 *
 * Loading, empty and error do not arise: the options are the app's own three,
 * and a save that fails is logged and survived by the storage (the choice
 * applies now; the chooser simply returns on the next start). The button locks
 * while the save is in flight.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { LanguageOption } from '@/features/language/components/LanguageOption';
import { LANGUAGE_COPY } from '@/features/language/constants/languageCopy';
import { useLanguageChoice } from '@/features/language/hooks/useLanguage';
import { BackButton, BrandMark, Button, Screen, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = LANGUAGE_COPY.chooser;

export type LanguageScreenMode = 'first' | 'change';

export interface LanguageScreenProps {
  mode: LanguageScreenMode;
  /**
   * `change` only: leaves the screen. Called by Back, and by Save before the
   * language is applied.
   */
  onLeave?: () => void;
}

export function LanguageScreen({ mode, onLeave }: LanguageScreenProps) {
  const theme = useTheme();
  const { options, selected, select, confirm, isSaving } = useLanguageChoice();
  const isFirst = mode === 'first';

  const submit = useCallback(() => {
    if (isSaving) {
      return;
    }
    if (!isFirst) {
      onLeave?.();
    }
    confirm();
  }, [confirm, isFirst, isSaving, onLeave]);

  const leave = useCallback(() => onLeave?.(), [onLeave]);

  return (
    <Screen
      scrollable
      padded
      header={
        isFirst ? undefined : (
          <View
            style={[
              styles.bar,
              { paddingHorizontal: theme.spacing.sm, height: theme.hitSlop.minTarget },
            ]}>
            <BackButton
              onPress={leave}
              accessibilityLabel={COPY.back}
              accessibilityHint={COPY.backHint}
              testID="language-back"
            />
          </View>
        )
      }
      contentContainerStyle={[
        styles.content,
        {
          gap: theme.spacing.xl,
          paddingTop: isFirst ? theme.spacing.xxl : theme.spacing.lg,
          paddingBottom: theme.spacing.xl,
        },
      ]}
      testID={isFirst ? 'language-first-launch' : 'language-change'}>
      <View style={{ gap: theme.spacing.sm }}>
        {isFirst ? <BrandMark size="md" testID="language-brand-mark" /> : null}
        <Text variant="hero" accessibilityRole="header" testID="language-heading">
          {isFirst ? COPY.title : COPY.changeTitle}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {isFirst ? COPY.subtitle : COPY.changeSubtitle}
        </Text>
      </View>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={COPY.listLabel}
        style={{ gap: theme.spacing.md }}
        testID="language-options">
        {options.map(option => (
          <LanguageOption
            key={option.locale}
            locale={option.locale}
            name={option.name}
            localName={option.localName}
            selected={option.locale === selected}
            onSelect={select}
            accessibilityHint={COPY.optionHint}
            testID={`language-option-${option.locale}`}
          />
        ))}
      </View>

      {/* Pushes the button to the foot of a tall screen; collapses on a short one. */}
      <View style={styles.spacer} />

      <Button
        label={isFirst ? COPY.continue : COPY.save}
        onPress={submit}
        isLoading={isSaving}
        disabled={isSaving}
        fullWidth
        accessibilityHint={isFirst ? COPY.continueHint : COPY.saveHint}
      />
    </Screen>
  );
}

/**
 * The chooser as a stack route, for both profiles' stacks (`Language`). Takes
 * no params: the only thing it needs, the current language, is the app's own.
 */
export function ChangeLanguageScreen() {
  const navigation = useNavigation();
  const leave = useCallback(() => navigation.goBack(), [navigation]);

  return <LanguageScreen mode="change" onLeave={leave} />;
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
  },
  spacer: {
    flexGrow: 1,
  },
});
