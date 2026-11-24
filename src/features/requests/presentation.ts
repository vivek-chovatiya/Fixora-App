/**
 * Request presentation mapping.
 *
 * Status and priority VALUES and LABELS come from the backend. This module only
 * maps them onto visual tones — it never invents or derives a status.
 */

import type { ColorTone, IconName } from '@/shared/theme';
import type { Priority, RequestStatus, ServiceRequest } from '@/shared/types/models';
import { strings } from '@/shared/i18n/strings';

export const STATUS_TONE: Record<RequestStatus, ColorTone> = {
  CREATED: 'neutral',
  PENDING_VENDOR: 'warning',
  ACCEPTED: 'info',
  IN_PROGRESS: 'primary',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CLOSED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

export const PRIORITY_TONE: Record<Priority, ColorTone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  EMERGENCY: 'danger',
};

export const isUrgent = (priority: Priority) => priority === 'EMERGENCY' || priority === 'HIGH';

/** Customer-facing vendor line, per dispatch mode and assignment (App PROJECT_BIBLE §20). */
export function vendorLine(request: ServiceRequest): { text: string; icon: IconName; waiting: boolean } {
  if (request.vendor) {
    return { text: request.vendor.businessName ?? '', icon: 'verified', waiting: false };
  }
  if (request.status === 'CANCELLED' || request.status === 'REJECTED') {
    return { text: 'No vendor assigned', icon: 'info', waiting: false };
  }
  if (request.dispatchMode === 'DIRECTED' && request.requestedVendor) {
    return { text: strings.dispatch.waitingFor(request.requestedVendor.businessName ?? 'vendor'), icon: 'pending', waiting: true };
  }
  return { text: strings.dispatch.findingVendor, icon: 'search', waiting: true };
}
