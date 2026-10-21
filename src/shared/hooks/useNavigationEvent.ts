/**
 * useNavigationEvent
 *
 * Calls back when the caller's screen gains or loses focus, and does nothing at
 * all where there is no navigator.
 *
 * Written once for what had been written three times: the unread count and the
 * saved addresses read again when their screen comes back into focus, and
 * Service Address notes when it has been left. Each carried its own copy of the
 * listener and of the guard below, and three copies of a guard are three places
 * for it to be wrong.
 *
 * ⚠️ Focus is taken from the navigation context, never from `useFocusEffect` or
 * `useNavigation`, which throw when there is no navigator. In the app every
 * screen is inside one; a screen's own suite usually renders it alone, and a
 * hook asking about focus is not a reason for that screen to stop rendering.
 * With no navigator nothing is listened to and the callback is never called —
 * whatever the caller read on mount is the only read.
 *
 * ⚠️ `onlyOnReturn` asks whether the screen was out of focus, never counts
 * events. The focus event can also fire as an already-focused screen mounts,
 * which would repeat the read its hook has just made, so a focus is passed on
 * only after a blur — or for a screen that mounted out of focus (restored under
 * another) and is now being shown. The same guard `useFocusEffect` keeps, for
 * the same reason. Ignored for `blur`, which has no arrival to skip.
 *
 * The newest callback is the one called, so a caller may pass an inline
 * function without the listener being taken down and put back every render.
 *
 * Screens that read focus from their own `navigation` prop (the two request
 * details screens) do not need this: a navigator always supplies the prop, and
 * so does every test that renders them.
 */

import { useContext, useEffect, useRef } from 'react';
import { NavigationContext } from '@react-navigation/native';

export interface NavigationEventOptions {
  /** `focus` only: called when the screen comes back, not as it arrives. */
  onlyOnReturn?: boolean;
}

export function useNavigationEvent(
  event: 'focus' | 'blur',
  listener: () => void,
  options: NavigationEventOptions = {},
): void {
  const onlyOnReturn = event === 'focus' && options.onlyOnReturn === true;
  const navigation = useContext(NavigationContext);

  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    if (!navigation) {
      return undefined;
    }

    if (!onlyOnReturn) {
      return navigation.addListener(event, () => listenerRef.current());
    }

    // Tracked rather than assumed: a screen can mount already in focus or not.
    let focused = navigation.isFocused();
    const stopFocus = navigation.addListener('focus', () => {
      if (!focused) {
        focused = true;
        listenerRef.current();
      }
    });
    const stopBlur = navigation.addListener('blur', () => {
      focused = false;
    });

    return () => {
      stopFocus();
      stopBlur();
    };
  }, [navigation, event, onlyOnReturn]);
}
