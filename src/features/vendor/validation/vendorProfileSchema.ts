/**
 * Vendor profile form schema (Phase 3E-1).
 *
 * The form's rules are the service's rules said to a person: the business name
 * is required, at least one service is required — registration already asks for
 * both, so setup never accepts less than registration did — and everything else
 * is optional and only bounded against absurd input. No format is imposed on a
 * description or an area; the vendor knows how to describe their business.
 *
 * Values are trimmed here, so what is validated is what is sent.
 */

import { z } from 'zod';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import {
  VENDOR_BUSINESS_NAME_MAX_LENGTH,
  VENDOR_DESCRIPTION_MAX_LENGTH,
  VENDOR_SERVICE_AREA_MAX_LENGTH,
  type VendorProfileUpdate,
} from '@/shared/services/types/VendorProfileService';

const COPY = VENDOR_COPY.validation;

export const vendorProfileSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, COPY.businessNameRequired)
    .max(VENDOR_BUSINESS_NAME_MAX_LENGTH, COPY.businessNameTooLong(VENDOR_BUSINESS_NAME_MAX_LENGTH)),
  description: z
    .string()
    .trim()
    .max(VENDOR_DESCRIPTION_MAX_LENGTH, COPY.descriptionTooLong(VENDOR_DESCRIPTION_MAX_LENGTH)),
  serviceCategoryIds: z.array(z.string()).min(1, COPY.categoriesRequired),
  serviceArea: z
    .string()
    .trim()
    .max(VENDOR_SERVICE_AREA_MAX_LENGTH, COPY.areaTooLong(VENDOR_SERVICE_AREA_MAX_LENGTH)),
});

export type VendorProfileForm = z.infer<typeof vendorProfileSchema>;

/**
 * The form's values as the service's update.
 *
 * A blank optional field is sent as absent — the vendor cleared it — rather than
 * as an empty string the backend would have to interpret. The image is not a
 * form field: it is uploaded on its own and arrives here as a URL.
 */
export function buildVendorProfileUpdate(
  values: VendorProfileForm,
  imageUrl: string | undefined,
): VendorProfileUpdate {
  return {
    businessName: values.businessName,
    serviceCategoryIds: values.serviceCategoryIds,
    ...(values.description ? { description: values.description } : {}),
    ...(values.serviceArea ? { serviceArea: { description: values.serviceArea } } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}
