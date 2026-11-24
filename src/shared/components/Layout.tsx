/**
 * Small layout building blocks used across features.
 */

import React, { memo, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme, type ColorTone, type IconName } from '@/shared/theme';

export const SectionHeader = memo(function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm }}>
      <Text variant="h3">{title}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
          <Text variant="label" color="primary">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

export const InfoRow = memo(function InfoRow({
  icon,
  label,
  value,
  testID,
}: {
  icon?: IconName;
  label: string;
  value?: ReactNode;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
      {icon ? (
        <View style={{ paddingTop: 2 }}>
          <Icon name={icon} size="sm" color="textTertiary" />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="caption" color="textTertiary">
          {label}
        </Text>
        {typeof value === 'string' || typeof value === 'number' ? <Text variant="body">{value}</Text> : value}
      </View>
    </View>
  );
});

/**
 * Metric tile. Numbers stay neutral so a dashboard reads calmly; `attention`
 * (e.g. approvals waiting) is the only state that adds colour.
 */
export const StatTile = memo(function StatTile({
  label,
  value,
  icon,
  attention = false,
  basis = '45%',
  onPress,
  testID,
}: {
  label: string;
  value: string | number;
  icon?: IconName;
  attention?: boolean;
  /** Share of the row, e.g. '45%' for two columns or '22%' for four. */
  basis?: `${number}%`;
  onPress?: () => void;
  testID?: string;
}) {
  const theme = useTheme();
  const content = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {icon ? (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: theme.radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: attention ? theme.colors.warningSubtle : theme.colors.surfaceAlt,
            }}>
            <Icon name={icon} size="sm" color={attention ? 'warning' : 'textSecondary'} />
          </View>
        ) : null}
        {onPress ? <Icon name="forward" size="sm" color="textTertiary" /> : null}
      </View>
      <Text variant="h1" color={attention ? 'warning' : 'textPrimary'} style={{ marginTop: theme.spacing.sm }}>
        {value}
      </Text>
      <Text variant="caption" color="textSecondary" numberOfLines={2}>
        {label}
      </Text>
    </>
  );
  const style: ViewStyle = {
    flexGrow: 1,
    flexBasis: basis,
    minWidth: 140,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: attention ? theme.colors.warning : theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.xxs,
  };

  // Only interactive tiles are exposed as buttons, so screen readers never announce dead controls.
  if (!onPress) {
    return (
      <View testID={testID} style={style} accessible accessibilityLabel={`${value} ${label}`}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={({ pressed }) => [style, pressed ? { backgroundColor: theme.colors.surfaceAlt } : null]}>
      {content}
    </Pressable>
  );
});

/** Dense, tappable row for people/business lists: leading visual, two lines of text, trailing slot. */
export const ListItem = memo(function ListItem({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  onPress,
  testID,
  accessibilityLabel,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const body = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="caption" color="textTertiary" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );
  const style: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    minHeight: 64,
  };
  if (!onPress) {
    return (
      <View testID={testID} style={style}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [style, pressed ? { backgroundColor: theme.colors.surfaceAlt } : null]}>
      {body}
    </Pressable>
  );
});

/** Groups rows on one bordered surface with hairline separators. */
export const ListGroup = memo(function ListGroup({ children, testID }: PropsWithChildren<{ testID?: string }>) {
  const theme = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View
      testID={testID}
      style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' }}>
      {items.map((child, index) => (
        <View key={index}>
          {index > 0 ? <View style={{ height: 1, backgroundColor: theme.colors.border, marginLeft: theme.spacing.lg }} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
});

const BANNER_BG = {
  primary: 'primarySubtle',
  success: 'successSubtle',
  warning: 'warningSubtle',
  danger: 'dangerSubtle',
  info: 'infoSubtle',
  neutral: 'neutralSubtle',
} as const;

/** Inline message. Use `info`/`warning` for business outcomes, `danger` only for real faults. */
export const Banner = memo(function Banner({
  tone = 'info',
  icon = 'info',
  title,
  message,
  children,
  testID,
}: PropsWithChildren<{ tone?: ColorTone; icon?: IconName; title?: string; message?: string; testID?: string }>) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors[BANNER_BG[tone]],
      }}>
      <Icon name={icon} size="md" color={tone} />
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        {title ? <Text variant="bodyStrong">{title}</Text> : null}
        {message ? (
          <Text variant="caption" color="textSecondary">
            {message}
          </Text>
        ) : null}
        {children}
      </View>
    </View>
  );
});

export const Divider = memo(function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[{ height: 1, backgroundColor: theme.colors.border }, style]} />;
});

export const Row = memo(function Row({
  children,
  gap = 'sm',
  style,
  justify = 'flex-start',
}: PropsWithChildren<{ gap?: 'xs' | 'sm' | 'md' | 'lg'; style?: StyleProp<ViewStyle>; justify?: ViewStyle['justifyContent'] }>) {
  const theme = useTheme();
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[gap], justifyContent: justify }, style]}>{children}</View>;
});

/** Tappable list row with chevron, for profile/menu style lists. */
export const MenuRow = memo(function MenuRow({
  icon,
  label,
  onPress,
  tone = 'textPrimary',
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'textPrimary' | 'danger';
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: theme.hitSlop.minTarget + 8,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
      })}>
      <Icon name={icon} size="md" color={tone} />
      <Text variant="body" color={tone} style={{ flex: 1 }}>
        {label}
      </Text>
      <Icon name="forward" size="md" color="textTertiary" />
    </Pressable>
  );
});
