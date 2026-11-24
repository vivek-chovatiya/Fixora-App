/**
 * API services — the only layer that talks to HttpClient.
 *
 * Screen → Hook → API service (here) → HttpClient → Backend
 *
 * Each service maps 1:1 onto a backend domain and returns domain models only.
 */

import { Platform } from 'react-native';

import { Http } from '@/core/http/HttpClient';
import type { UserRole } from '@/core/storage/SessionStorage';
import type { PageRequest, Page } from '@/shared/types/pagination';
import type {
  Address,
  AdminDashboard,
  AppMeta,
  AppNotification,
  Category,
  CustomerProfile,
  CustomerRequestView,
  Priority,
  PublicVendor,
  ReportPeriod,
  Review,
  ReviewSummary,
  ServiceRequest,
  Session,
  SubCategory,
  TeamMember,
  TeamMemberStatus,
  UploadedFile,
  UserProfile,
  VendorDashboard,
  VendorProfile,
  VendorReport,
  VendorRequestView,
  ApprovalStatus,
} from '@/shared/types/models';

import { unwrap, unwrapPage, type ApiEnvelope } from './apiEnvelope';

type E<T> = ApiEnvelope<T>;

const pageBody = (request: PageRequest) => ({ page: request.page, limit: request.pageSize });

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------
export const metaApi = {
  get: () => unwrap(Http.get<E<AppMeta>>('/meta')),
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export interface CustomerSignupPayload {
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  password: string;
}

export interface VendorSignupPayload {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  address: string;
  description?: string;
  workingAreas?: string[];
  workingHours?: string;
  categoryIds: string[];
}

export const authApi = {
  login: (identifier: string, password: string, role: UserRole) =>
    unwrap(Http.post<E<Session>>('/auth/login', { identifier, password, role })),
  registerCustomer: (payload: CustomerSignupPayload) =>
    unwrap(Http.post<E<Session>>('/auth/register/customer', payload)),
  registerVendor: (payload: VendorSignupPayload) =>
    unwrap(Http.post<E<Session>>('/auth/register/vendor', payload)),
  me: () => unwrap(Http.get<E<UserProfile>>('/auth/me')),
  logout: () => unwrap(Http.post<E<null>>('/auth/logout', {})),
  forgotPassword: (identifier: string, role: UserRole) =>
    unwrap(
      Http.post<E<{ message: string; devResetCode?: string }>>('/auth/forgot-password', {
        identifier,
        role,
      }),
    ),
  resetPassword: (payload: { identifier: string; role: UserRole; code: string; newPassword: string }) =>
    unwrap(Http.post<E<null>>('/auth/reset-password', payload)),
  changePassword: (currentPassword: string, newPassword: string) =>
    unwrap(Http.post<E<null>>('/auth/change-password', { currentPassword, newPassword })),
};

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
export const catalogApi = {
  categories: () => unwrap(Http.post<E<Category[]>>('/categories/list', { limit: 100 })),
  subCategories: (categoryId: string) =>
    unwrap(Http.post<E<SubCategory[]>>('/subcategories/list', { categoryId, limit: 100 })),
  adminCategories: () => unwrap(Http.post<E<Category[]>>('/categories/admin-list', { limit: 100 })),
  createCategory: (payload: { name: string; icon?: string; description?: string; isVisible?: boolean }) =>
    unwrap(Http.post<E<Category>>('/categories', payload)),
  updateCategory: (payload: { id: string; isVisible?: boolean; name?: string; icon?: string; description?: string }) =>
    unwrap(Http.post<E<Category>>('/categories/update', payload)),
  deleteCategory: (id: string) => unwrap(Http.delete<E<null>>('/categories/delete', { data: { id } })),
  adminSubCategories: (categoryId: string) =>
    unwrap(Http.post<E<SubCategory[]>>('/subcategories/admin-list', { categoryId, limit: 100 })),
  createSubCategory: (payload: SubCategoryPayload & { categoryId: string; name: string }) =>
    unwrap(Http.post<E<SubCategory>>('/subcategories', payload)),
  updateSubCategory: (payload: SubCategoryPayload & { id: string }) =>
    unwrap(Http.post<E<SubCategory>>('/subcategories/update', payload)),
  deleteSubCategory: (id: string) => unwrap(Http.delete<E<null>>('/subcategories/delete', { data: { id } })),
};

export interface SubCategoryPayload {
  name?: string;
  description?: string;
  estimatedPrice?: number;
  estimatedDuration?: number;
  isVisible?: boolean;
}

// ---------------------------------------------------------------------------
// Customer & addresses
// ---------------------------------------------------------------------------
export interface AddressPayload {
  title: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export const customerApi = {
  update: (payload: Partial<Pick<CustomerProfile, 'firstName' | 'lastName' | 'phone'>> & {
    profileImage?: string | null;
  }) => unwrap(Http.post<E<CustomerProfile>>('/customers/update', payload)),
};

export const addressApi = {
  list: () => unwrap(Http.get<E<Address[]>>('/addresses')),
  create: (payload: AddressPayload) => unwrap(Http.post<E<Address>>('/addresses', payload)),
  update: (id: string, payload: Partial<AddressPayload>) =>
    unwrap(Http.post<E<Address>>('/addresses/update', { id, ...payload })),
  setDefault: (id: string) => unwrap(Http.post<E<Address>>('/addresses/default', { id })),
  remove: (id: string) => unwrap(Http.delete<E<null>>('/addresses/delete', { data: { id } })),
};

// ---------------------------------------------------------------------------
// Service requests
// ---------------------------------------------------------------------------
export interface CreateRequestPayload {
  categoryId: string;
  subCategoryId: string;
  addressId: string;
  vendorId?: string | null;
  description: string;
  notes?: string;
  images?: string[];
  priority: Priority;
  preferredDate?: string | null;
  preferredTime?: string;
}

export interface CompleteWorkPayload {
  finalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  completionNotes?: string;
}

export const requestApi = {
  list: (view: CustomerRequestView | VendorRequestView, request: PageRequest): Promise<Page<ServiceRequest>> =>
    unwrapPage(Http.post<E<ServiceRequest[]>>('/requests/list', { view, ...pageBody(request) })),
  detail: (id: string) => unwrap(Http.post<E<ServiceRequest>>('/requests/detail', { id })),
  create: (payload: CreateRequestPayload) => unwrap(Http.post<E<ServiceRequest>>('/requests', payload)),
  cancel: (id: string, reason?: string) =>
    unwrap(Http.post<E<ServiceRequest>>('/requests/cancel', { id, reason })),
  accept: (id: string) => unwrap(Http.post<E<ServiceRequest>>('/requests/accept', { id })),
  reject: (id: string, reason?: string) =>
    unwrap(Http.post<E<ServiceRequest>>('/requests/reject', { id, reason })),
  start: (id: string) => unwrap(Http.post<E<ServiceRequest>>('/requests/start', { id })),
  complete: (id: string, payload: CompleteWorkPayload) =>
    unwrap(Http.post<E<ServiceRequest>>('/requests/complete', { id, ...payload })),
  assignTeamMember: (id: string, assignedTeamMemberId: string) =>
    unwrap(Http.post<E<ServiceRequest>>('/requests/assign', { id, assignedTeamMemberId })),
};

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------
export type VendorUpdatePayload = Partial<
  Pick<
    VendorProfile,
    | 'businessName'
    | 'ownerName'
    | 'phone'
    | 'address'
    | 'description'
    | 'workingAreas'
    | 'workingHours'
    | 'availability'
    | 'shopImages'
    | 'categoryIds'
  >
> & { profileImage?: string | null };

export const vendorApi = {
  recommended: (categoryId: string, subCategoryId?: string, addressId?: string) =>
    unwrap(
      Http.post<E<PublicVendor[]>>('/vendors/recommended', { categoryId, subCategoryId, addressId }),
    ),
  dashboard: () => unwrap(Http.get<E<VendorDashboard>>('/vendors/dashboard')),
  report: (period: ReportPeriod) => unwrap(Http.post<E<VendorReport>>('/vendors/reports', { period })),
  update: (payload: VendorUpdatePayload) => unwrap(Http.post<E<VendorProfile>>('/vendors/update', payload)),
  adminList: (approvalStatus: ApprovalStatus | undefined, request: PageRequest, search?: string) =>
    unwrapPage(
      Http.post<E<VendorProfile[]>>('/vendors/list', { approvalStatus, search: search?.trim() || undefined, ...pageBody(request) }),
    ),
  setApproval: (id: string, approvalStatus: ApprovalStatus, note?: string) =>
    unwrap(Http.post<E<VendorProfile>>('/vendors/approval-status', { id, approvalStatus, note })),
};

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export const reviewApi = {
  create: (payload: { serviceRequestId: string; rating: number; comment?: string; images?: string[] }) =>
    unwrap(Http.post<E<Review>>('/reviews', payload)),
  vendorReviews: (vendorId: string | undefined, request: PageRequest) =>
    unwrapPage(Http.post<E<Review[]>>('/reviews/vendor', { vendorId, ...pageBody(request) })),
  summary: (vendorId?: string) => unwrap(Http.post<E<ReviewSummary>>('/reviews/summary', { vendorId })),
};

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
export interface TeamMemberPayload {
  name: string;
  phone: string;
  designation?: string;
  status?: TeamMemberStatus;
}

export const teamApi = {
  list: () => unwrap(Http.get<E<TeamMember[]>>('/team')),
  create: (payload: TeamMemberPayload) => unwrap(Http.post<E<TeamMember>>('/team', payload)),
  update: (id: string, payload: Partial<TeamMemberPayload>) =>
    unwrap(Http.post<E<TeamMember>>('/team/update', { id, ...payload })),
  remove: (id: string) => unwrap(Http.delete<E<null>>('/team/delete', { data: { id } })),
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const notificationApi = {
  list: (request: PageRequest) =>
    unwrapPage(Http.post<E<AppNotification[]>>('/notifications/list', pageBody(request))),
  unreadCount: () => unwrap(Http.get<E<{ unreadCount: number }>>('/notifications/unread-count')),
  markRead: (id: string) => unwrap(Http.post<E<AppNotification>>('/notifications/read', { id })),
  markAllRead: () => unwrap(Http.post<E<{ updated: number }>>('/notifications/read-all', {})),
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const adminApi = {
  dashboard: () => unwrap(Http.get<E<AdminDashboard>>('/admin/dashboard')),
};

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------
export type UploadType = 'REQUEST' | 'PROFILE' | 'SHOP' | 'DOCUMENT' | 'REVIEW';

export interface LocalImage {
  uri: string;
  type?: string;
  fileName?: string;
}

async function appendFile(form: FormData, image: LocalImage, index: number) {
  const type = image.type || 'image/jpeg';
  const name = image.fileName || `image-${Date.now()}-${index}.${type.split('/')[1] || 'jpg'}`;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(image.uri)).blob();
    form.append('files', blob, name);
  } else {
    // React Native's FormData accepts a { uri, name, type } file descriptor.
    form.append('files', { uri: image.uri, name, type } as unknown as Blob);
  }
}

export const uploadApi = {
  upload: async (images: LocalImage[], type: UploadType): Promise<UploadedFile[]> => {
    const form = new FormData();
    form.append('type', type);
    for (const [index, image] of images.entries()) {
      await appendFile(form, image, index);
    }
    return unwrap(Http.upload<E<UploadedFile[]>>('/uploads', form));
  },
};
