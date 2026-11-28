/**
 * The language chooser (phase5-contract.md section 7).
 *
 * Pinned here:
 * - a first launch — nothing saved — shows "Choose your language" before the
 *   introduction or sign in, with the current language selected and each
 *   language as a radio in its own script; a later launch never shows it;
 * - tapping a language only selects it: nothing is saved or applied until
 *   Continue / Save, and Back leaves the language as it was;
 * - Continue saves through the storage seam and applies it, and the stack then
 *   opens on the introduction, in the chosen language;
 * - from a profile, Save goes back first and applies second, so the user lands
 *   on the profile, whose Language row then names the new language.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  NavigationContainer,
  type NavigationContainerRef,
  type ParamListBase,
} from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { getLocaleState, resetLocaleState, updateLocaleState, type AppLocale } from '@/core/i18n';
import { setLocaleStorage, type LocaleStorage } from '@/core/storage/LocaleStorage';
import { setOnboardingStorage } from '@/core/storage/OnboardingStorage';
import { authReducer } from '@/features/auth/state/authSlice';
import { LanguageRow } from '@/features/language/components/LanguageRow';
import { ChangeLanguageScreen } from '@/features/language/screens/LanguageScreen';
import {
  resetLocaleChoiceForTests,
  restoreSavedLocale,
} from '@/features/language/state/localeChoice';
import { AuthNavigator } from '@/navigation/AuthNavigator';
import { ToastProvider } from '@/shared/components';
import { configureServices, resetServices } from '@/shared/services/ServiceRegistry';
import { ThemeProvider } from '@/shared/theme';

/** A device's saved language, in memory, surviving "relaunches" within a test. */
function deviceStorage(initial: AppLocale | null = null) {
  let saved = initial;
  const storage: LocaleStorage = {
    read: jest.fn(async () => saved),
    write: jest.fn(async (locale: AppLocale) => {
      saved = locale;
    }),
    clear: jest.fn(async () => {
      saved = null;
    }),
  };
  return storage;
}

/** A fresh start of the JavaScript: nothing in memory, the device as it was. */
async function launch(storage: LocaleStorage) {
  resetLocaleState();
  resetLocaleChoiceForTests();
  setLocaleStorage(storage);
  await restoreSavedLocale();
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  // The registry logs what it configured; that is not what is under test.
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  resetServices();
  jest.restoreAllMocks();
  resetLocaleState();
  updateLocaleState({ isChosen: true, isRestored: true });
  resetLocaleChoiceForTests();
});

function queries(renderer: ReactTestRenderer.ReactTestRenderer) {
  const byTestID = (testID: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props.testID === testID);
  const shows = (testID: string) => byTestID(testID).length > 0;
  const pressable = (match: (props: Record<string, unknown>) => boolean) => {
    const found = renderer.root.findAll(
      node => typeof node.props?.onPress === 'function' && match(node.props),
    );
    if (found.length === 0) {
      throw new Error('No such control');
    }
    return found[0];
  };
  const press = async (match: (props: Record<string, unknown>) => boolean) => {
    const target = pressable(match);
    await act(async () => {
      (target.props.onPress as () => void)();
    });
  };
  const option = (locale: AppLocale) => pressable(props => props.testID === `language-option-${locale}`);
  const checked = () =>
    (['en', 'hi', 'gu'] as const).filter(locale => option(locale).props.accessibilityState?.checked);
  const text = () => JSON.stringify(renderer.toJSON());

  return { byTestID, shows, pressable, press, option, checked, text };
}

async function renderAuth(hasCompletedOnboarding: boolean) {
  setOnboardingStorage({
    hasCompletedOnboarding: jest.fn(async () => hasCompletedOnboarding),
    setOnboardingCompleted: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  });
  configureServices();

  const store = configureStore({ reducer: { auth: authReducer } });
  const navigation = React.createRef<NavigationContainerRef<ParamListBase>>();

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <NavigationContainer ref={navigation}>
              <AuthNavigator />
            </NavigationContainer>
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);

  return { renderer, navigation, ...queries(renderer) };
}

describe('the first launch', () => {
  it('shows the chooser before the introduction, with English selected and each language in its own script', async () => {
    await launch(deviceStorage(null));
    const { shows, option, checked, byTestID, navigation, text } = await renderAuth(false);

    expect(shows('language-first-launch')).toBe(true);
    expect(shows('onboarding-screen')).toBe(false);
    // Drawn in place of the stack, so there is no route to go back to it by.
    expect(navigation.current?.isReady()).toBe(false);

    expect(text()).toContain('Choose your language');
    expect(checked()).toEqual(['en']);
    expect(option('en').props.accessibilityRole).toBe('radio');
    expect(option('en').props.accessibilityLabel).toBe('English');
    expect(option('hi').props.accessibilityLabel).toBe('हिन्दी, Hindi');
    expect(option('gu').props.accessibilityLabel).toBe('ગુજરાતી, Gujarati');
    const [group] = byTestID('language-options');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toBe('Languages');
  });

  it('only selects on a tap: nothing is saved or applied until Continue', async () => {
    const storage = deviceStorage(null);
    await launch(storage);
    const { press, checked } = await renderAuth(false);

    await press(props => props.testID === 'language-option-hi');

    expect(checked()).toEqual(['hi']);
    expect(getLocaleState().locale).toBe('en');
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('saves the choice on Continue, applies it, and opens the introduction in it', async () => {
    const storage = deviceStorage(null);
    await launch(storage);
    const { press, shows, text } = await renderAuth(false);

    await press(props => props.testID === 'language-option-hi');
    await press(props => props.accessibilityLabel === 'Continue');

    expect(storage.write).toHaveBeenCalledWith('hi');
    expect(getLocaleState()).toEqual({ locale: 'hi', isChosen: true, isRestored: true });
    expect(shows('language-first-launch')).toBe(false);
    expect(shows('onboarding-screen')).toBe(true);
    // In Hindi: its Skip, and its step label — a translated function — read at render.
    expect(text()).toContain('छोड़ें');
    expect(text()).toContain('3 में से चरण 1');
  });

  it('keeping English is a choice too: saved, and sign in opens', async () => {
    const storage = deviceStorage(null);
    await launch(storage);
    const { press, shows } = await renderAuth(true);

    await press(props => props.accessibilityLabel === 'Continue');

    expect(storage.write).toHaveBeenCalledWith('en');
    expect(getLocaleState().isChosen).toBe(true);
    expect(shows('auth-entry-screen')).toBe(true);
  });
});

describe('a later launch', () => {
  it('never shows the chooser again once a language is saved', async () => {
    const storage = deviceStorage(null);

    await launch(storage);
    const first = await renderAuth(true);
    expect(first.shows('language-first-launch')).toBe(true);
    await first.press(props => props.testID === 'language-option-gu');
    await first.press(props => props.accessibilityLabel === 'આગળ વધો' || props.accessibilityLabel === 'Continue');
    act(() => {
      mounted.pop()!.unmount();
    });

    // The next start of the app: the saved Gujarati is read before anything renders.
    await launch(storage);
    expect(getLocaleState()).toEqual({ locale: 'gu', isChosen: true, isRestored: true });
    const second = await renderAuth(true);

    expect(second.shows('language-first-launch')).toBe(false);
    expect(second.shows('auth-entry-screen')).toBe(true);
    expect(second.text()).toContain('માં તમારું સ્વાગત છે');
  });
});

describe('changing it from a profile', () => {
  type Routes = { Profile: undefined; Language: undefined };
  const Stack = createNativeStackNavigator<Routes>();

  function Profile({ navigation }: NativeStackScreenProps<Routes, 'Profile'>) {
    return <LanguageRow onPress={() => navigation.navigate('Language')} />;
  }

  async function renderProfile() {
    const navigation = React.createRef<NavigationContainerRef<Routes>>();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <NavigationContainer ref={navigation}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Profile" component={Profile} />
              <Stack.Screen name="Language" component={ChangeLanguageScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </ThemeProvider>,
      );
    });
    mounted.push(renderer);
    const current = () => navigation.current?.getCurrentRoute()?.name;
    return { renderer, current, ...queries(renderer) };
  }

  it('opens the same chooser from the Language row, which names the current language', async () => {
    const storage = deviceStorage('en');
    await launch(storage);
    const { press, current, checked, text } = await renderProfile();

    await press(props => props.accessibilityLabel === 'Language: English');

    expect(current()).toBe('Language');
    expect(text()).toContain('Choose the language the app uses on this phone.');
    expect(checked()).toEqual(['en']);
  });

  it('goes back without changing anything on Back', async () => {
    const storage = deviceStorage('en');
    await launch(storage);
    const { press, current } = await renderProfile();

    await press(props => props.accessibilityLabel === 'Language: English');
    await press(props => props.testID === 'language-option-hi');
    await press(props => props.accessibilityLabel === 'Back');

    expect(current()).toBe('Profile');
    expect(getLocaleState().locale).toBe('en');
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('goes back first and applies second on Save, so the profile shows the new language', async () => {
    const storage = deviceStorage('en');
    await launch(storage);
    const { press, current, pressable } = await renderProfile();

    await press(props => props.accessibilityLabel === 'Language: English');
    await press(props => props.testID === 'language-option-gu');
    await press(props => props.accessibilityLabel === 'Save');

    expect(current()).toBe('Profile');
    expect(storage.write).toHaveBeenCalledWith('gu');
    expect(getLocaleState().locale).toBe('gu');
    expect(pressable(props => props.accessibilityLabel === 'ભાષા: ગુજરાતી')).toBeTruthy();
  });
});
