/**
 * FeedbackProvider — toasts and dialogs.
 *
 * Cross-platform replacements for Alert (which is a no-op on web). Screens call
 * `useToast().show(...)` for non-blocking feedback and `useDialog().confirm(...)`
 * before destructive actions (App PROJECT_BIBLE §46 — "Forgiving").
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { strings } from '@/shared/i18n/strings';
import { useTheme, type ColorTone, type IconName } from '@/shared/theme';

type ToastTone = 'success' | 'info' | 'warning' | 'danger';

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

interface DialogState {
  title: string;
  message?: string;
  buttons: { label: string; value: string | boolean | null; variant: 'primary' | 'secondary' | 'destructive' | 'ghost'; icon?: IconName }[];
  /** Two-button confirmations sit side by side; choice lists stack. */
  layout: 'row' | 'stack';
  resolve: (value: string | boolean | null) => void;
}

interface FeedbackContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  choose: <T extends string>(title: string, options: ChoiceOption<T>[], message?: string) => Promise<T | null>;
}

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

const TOAST_ICON: Record<ToastTone, IconName> = {
  success: 'success',
  info: 'info',
  warning: 'warning',
  danger: 'error',
};

export function FeedbackProvider({ children }: PropsWithChildren) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    const id = Date.now();
    setToast({ id, message, tone });
    timer.current = setTimeout(() => setToast(current => (current?.id === id ? null : current)), 3500);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>(resolve => {
        setDialog({
          title: options.title,
          message: options.message,
          buttons: [
            { label: options.cancelLabel ?? strings.common.cancel, value: false, variant: 'secondary' },
            { label: options.confirmLabel ?? strings.common.confirm, value: true, variant: options.destructive ? 'destructive' : 'primary' },
          ],
          layout: 'row',
          resolve: value => resolve(value === true),
        });
      }),
    [],
  );

  const choose = useCallback(
    <T extends string>(title: string, options: ChoiceOption<T>[], message?: string) =>
      new Promise<T | null>(resolve => {
        setDialog({
          title,
          message,
          buttons: [
            ...options.map(o => ({ label: o.label, value: o.value, variant: 'secondary' as const, icon: o.icon })),
            { label: strings.common.cancel, value: null, variant: 'ghost' as const },
          ],
          layout: 'stack',
          resolve: value => resolve((value as T) ?? null),
        });
      }),
    [],
  );

  const close = (value: string | boolean | null) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  const value = useMemo(() => ({ showToast, confirm, choose }), [showToast, confirm, choose]);
  const toastTone: ColorTone = toast?.tone ?? 'success';

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {toast ? (
        // Non-interactive and pinned to the top, so it never covers or swallows taps on
        // the primary actions that live in screen footers.
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-start', zIndex: theme.zIndex.toast, pointerEvents: 'none' }]}>
          <View
            testID="toast"
            accessibilityLiveRegion="polite"
            style={{
              pointerEvents: 'none',
              margin: theme.spacing.lg,
              marginTop: insets.top + theme.spacing.huge + theme.spacing.lg,
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.textPrimary,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              ...theme.shadows.lg,
            }}>
            <Icon name={TOAST_ICON[toast.tone]} size="md" color={toastTone} />
            <Text variant="bodyStrong" color="background" style={{ flex: 1 }}>
              {toast.message}
            </Text>
          </View>
        </View>
      ) : null}

      <Modal visible={dialog !== null} transparent animationType="fade" onRequestClose={() => close(null)}>
        <Pressable style={[styles.scrim, { backgroundColor: theme.colors.overlay, padding: theme.spacing.xxl }]} onPress={() => close(null)}>
          <Pressable
            testID="dialog"
            onPress={() => undefined}
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              padding: theme.spacing.xl,
              gap: theme.spacing.md,
              ...theme.shadows.xl,
            }}>
            <Text variant="h3">{dialog?.title}</Text>
            {dialog?.message ? (
              <Text variant="body" color="textSecondary">
                {dialog.message}
              </Text>
            ) : null}
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm, flexDirection: dialog?.layout === 'row' ? 'row' : 'column' }}>
              {dialog?.buttons.map(button => (
                <Button
                  key={String(button.label)}
                  testID={`dialog-${String(button.label).toLowerCase().replace(/\s+/g, '-')}`}
                  label={button.label}
                  icon={button.icon}
                  variant={button.variant}
                  onPress={() => close(button.value)}
                  style={dialog?.layout === 'row' ? { flex: 1 } : undefined}
                />
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </FeedbackContext.Provider>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useToast/useDialog must be used within FeedbackProvider.');
  }
  return context;
}

export function useToast() {
  const { showToast } = useFeedback();
  return { show: showToast };
}

export function useDialog() {
  const { confirm, choose } = useFeedback();
  return { confirm, choose };
}
