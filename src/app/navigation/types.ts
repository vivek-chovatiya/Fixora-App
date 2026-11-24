/**
 * Navigation contracts. Role-based: each role has its own stack and the other
 * roles' screens are simply not registered (App PROJECT_BIBLE §3).
 */

import type {
  Address,
  ApprovalStatus,
  Category,
  Priority,
  PublicVendor,
  SubCategory,
  TeamMember,
} from '@/shared/types/models';
import type { UserRole } from '@/core/storage/SessionStorage';

/** Everything captured before vendor selection. Serializable by design. */
export interface RequestDraft {
  category: Pick<Category, 'id' | 'name' | 'icon'>;
  subCategory: Pick<SubCategory, 'id' | 'name' | 'estimatedPrice'>;
  description: string;
  priority: Priority;
  priorityLabel: string;
  notes: string;
  images: string[];
  address: Pick<Address, 'id' | 'title' | 'fullAddress'>;
  preferredDate: string | null;
  preferredDateLabel: string | null;
  preferredTime: string;
}

export type AuthStackParamList = {
  Login: { role?: UserRole } | undefined;
  CustomerSignup: undefined;
  VendorSignup: undefined;
  ForgotPassword: { role: UserRole; identifier?: string };
};

export type CustomerTabParamList = {
  Home: undefined;
  Requests: undefined;
  Profile: undefined;
};

export type CustomerStackParamList = {
  CustomerTabs: undefined;
  Categories: undefined;
  SubCategories: { category: Pick<Category, 'id' | 'name' | 'icon' | 'description'> };
  CreateRequest: { category: Pick<Category, 'id' | 'name' | 'icon'>; subCategory: Pick<SubCategory, 'id' | 'name' | 'estimatedPrice'> };
  SelectVendor: { draft: RequestDraft };
  ConfirmRequest: { draft: RequestDraft; vendor: PublicVendor | null };
  RequestDetail: { id: string; justCreated?: boolean };
  Review: { requestId: string; vendorName: string; requestNumber: string };
  EditProfile: undefined;
  Addresses: undefined;
  AddressForm: { address?: Address } | undefined;
  Notifications: undefined;
  ChangePassword: undefined;
};

export type VendorTabParamList = {
  Dashboard: undefined;
  VendorRequests: { view?: 'NEW' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' } | undefined;
  Team: undefined;
  VendorProfile: undefined;
};

export type VendorStackParamList = {
  VendorTabs: undefined;
  VendorRequestDetail: { id: string };
  CompleteWork: { id: string; requestNumber: string; estimatedAmount: number };
  TeamMemberForm: { member?: TeamMember } | undefined;
  EditVendorProfile: undefined;
  VendorReviews: undefined;
  VendorReports: undefined;
  Notifications: undefined;
  ChangePassword: undefined;
};

export type AdminStackParamList = {
  AdminTabs: undefined;
  AdminSubCategories: { category: Pick<Category, 'id' | 'name'> };
  Notifications: undefined;
};

export type AdminTabParamList = {
  AdminDashboard: undefined;
  AdminVendors: { status?: ApprovalStatus } | undefined;
  AdminCategories: undefined;
};
