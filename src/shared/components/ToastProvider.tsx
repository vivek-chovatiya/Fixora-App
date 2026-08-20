/**
 * ToastProvider
 *
 * Owns the one toast slot and the timer that closes it.
 *
 * Mounted once, above the navigators, so a message raised on any screen floats
 * over the whole application rather than inside whatever container happened to
 * raise it. That is the point of the layer: `zIndex.toast` was reserved for
 * something that outranks every surface, and a toast rendered inside a form
 * cannot outrank the form.
 *
 * There is exactly one slot. A queue would hold a failure back until an earlier
 * one had finished being read, and by then it describes an attempt the user has
 * forgotten making — so a new message replaces the current one outright.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { Toast } from '@/shared/components/Toast';
import { useTheme, type ColorTokens, type IconName } from '@/shared/theme';

export interface ToastOptions {
  /** Shown verbatim. Callers pass copy that is already safe to display. */
  message: string;
  tone?: keyof ColorTokens;
  icon?: IconName;
}

export interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/** What a toast becomes once the defaults have been filled in. */
interface ToastContent {
  message: string;
  tone: keyof ColorTokens;
  icon: IconName;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const theme = useTheme();

  /**
   * Kept separate from `isVisible` on purpose.
   *
   * `content` is what is mounted; `isVisible` is what it is doing. Clearing the
   * content on dismiss would unmount the toast mid-exit and make it vanish
   * rather than withdraw, so the content outlives the hide by one animation.
   */
  const [content, setContent] = useState<ToastContent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDwell = useCallback(() => {
    if (dwellTimer.current !== null) {
      clearTimeout(dwellTimer.current);
      dwellTimer.current = null;
    }
  }, []);

  const dwellMs = theme.animation.duration.toast;

  const showToast = useCallback(
    ({ message, tone = 'neutral', icon = 'info' }: ToastOptions) => {
      clearDwell();
      setContent({ message, tone, icon });
      setIsVisible(true);

      dwellTimer.current = setTimeout(() => setIsVisible(false), dwellMs);
    },
    [clearDwell, dwellMs],
  );

  const hideToast = useCallback(() => {
    clearDwell();
    setIsVisible(false);
  }, [clearDwell]);

  /** The exit has finished, so there is nothing left worth keeping mounted. */
  const handleHidden = useCallback(() => {
    setContent(null);
  }, []);

  // A timer that outlives the tree would call setState on an unmounted provider.
  useEffect(() => clearDwell, [clearDwell]);

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, hideToast }),
    [showToast, hideToast],
  );

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.root}>
        {children}

        {content === null ? null : (
          <Toast
            message={content.message}
            tone={content.tone}
            icon={content.icon}
            isVisible={isVisible}
            onDismiss={hideToast}
            onHidden={handleHidden}
            testID="toast"
          />
        )}
      </View>
    </ToastContext.Provider>
  );
}

/**
 * Raises and dismisses toasts.
 *
 * Screens showing a failure should reach for `useErrorToast` instead, which maps
 * an AppError onto this and keeps the developer-facing message out of the UI.
 */
export function useToast(): ToastContextValue {
  const toast = useContext(ToastContext);

  if (!toast) {
    throw new Error('useToast must be used within a ToastProvider.');
  }

  return toast;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
