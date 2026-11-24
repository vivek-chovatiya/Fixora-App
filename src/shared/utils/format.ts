/**
 * Formatting helpers. Presentation only — never business logic.
 */

import { AppConfig } from '@/core/config/AppConfig';

const LOCALE = `${AppConfig.app.defaultLocale}-${AppConfig.app.defaultCountry}`;

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '—';
  }
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${Math.round(amount)}`;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '—';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(value: string | Date): string {
  const d = new Date(value);
  const hours = d.getHours();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${pad(d.getMinutes())} ${suffix}`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return '—';
  }
  return `${formatDate(value)}, ${formatTime(value)}`;
}

export function formatDayLabel(d: Date): string {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatRelative(value: string | Date): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  return formatDate(value);
}

/** Groups an Indian mobile number for reading: "+919876543210" -> "+91 98765 43210". Other formats pass through. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const match = /^\+91(\d{5})(\d{5})$/.exec(value);
  return match ? `+91 ${match[1]} ${match[2]}` : value;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) {
    return '?';
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? '?';
  return letters.toUpperCase();
}

/** Uploaded files come back as server paths; resolve them against the API host. */
export function resolveFileUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }
  if (/^(https?:|data:|blob:|file:|content:)/.test(path)) {
    return path;
  }
  return `${AppConfig.api.fileBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * A preferred service day is a calendar day, not an instant. It is sent as that
 * day at 23:59 UTC (so "today" is never rejected as past) and must be read back
 * with `formatPreferredDate`, never `formatDate`.
 */
export function toPreferredDateIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T23:59:00.000Z`;
}

/** Reads a preferred day in UTC so a local timezone ahead of UTC never shifts it to the next day. */
export function formatPreferredDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
