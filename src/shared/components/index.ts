/**
 * Shared component barrel
 *
 * The single import path for the shared UI library:
 *
 *   import { Screen, Card, EmptyState } from '@/shared/components';
 *
 * Both role applications import from here. Duplicating any of these inside a
 * feature module is what CLAUDE.md section 8 forbids — search this barrel before
 * building anything new.
 */

export { Text, type TextProps } from './Text';
export { Icon, DynamicIcon, type IconProps, type DynamicIconProps } from './Icon';
export { Loader, type LoaderProps } from './Loader';

export {
  Button,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  type ButtonProps,
  type ButtonVariant,
} from './Button';

export {
  Input,
  EmailInput,
  PhoneInput,
  PasswordInput,
  SearchInput,
  type InputProps,
  type EmailInputProps,
  type PhoneInputProps,
  type PasswordInputProps,
  type SearchInputProps,
} from './Input';

export { Screen, type ScreenProps } from './Screen';
export { Card, type CardProps } from './Card';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { ErrorState, type ErrorStateProps } from './ErrorState';
export { StatusBadge, type StatusBadgeProps, type StatusTone } from './StatusBadge';
export { Avatar, getInitials, type AvatarProps, type AvatarSize } from './Avatar';
