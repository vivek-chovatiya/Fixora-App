/**
 * Domain models
 *
 * Shapes returned by the Fixora API. These mirror backend mappers exactly; the
 * app never derives business state from them (no client-side status, ranking or
 * eligibility logic).
 */

export type UserRole = 'CUSTOMER' | 'VENDOR' | 'ADMIN';

export type RequestStatus =
  | 'CREATED'
  | 'PENDING_VENDOR'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ON_HOLD';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
export type DispatchMode = 'DIRECTED' | 'OPEN';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type RequestAction =
  | 'ACCEPT'
  | 'REJECT'
  | 'START'
  | 'COMPLETE'
  | 'ASSIGN_TEAM'
  | 'CANCEL'
  | 'REVIEW';

export type CustomerRequestView = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type VendorRequestView = 'NEW' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
export type ReportPeriod = 'TODAY' | 'WEEK' | 'MONTH';
export type TeamMemberStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

export interface AppMeta {
  priorities: Option<Priority>[];
  paymentMethods: Option[];
  paymentStatuses: Option[];
  requestStatuses: Option<RequestStatus>[];
  reportPeriods: ReportPeriod[];
}

export interface Address {
  id: string;
  title: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  fullAddress: string;
}

export interface CustomerProfile {
  id: string;
  role: 'CUSTOMER';
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  profileImage: string | null;
  defaultAddress: Address | null;
  status: string;
  createdAt: string;
}

export interface CategoryRef {
  id: string;
  name: string;
  icon?: string | null;
}

export interface VendorProfile {
  id: string;
  role: 'VENDOR';
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  categoryIds: string[];
  categories: CategoryRef[];
  address: string;
  description: string;
  workingAreas: string[];
  workingHours: string;
  profileImage: string | null;
  shopImages: string[];
  documents: string[];
  averageRating: number;
  totalReviews: number;
  approvalStatus: ApprovalStatus;
  approvalNote: string;
  availability: boolean;
  status: string;
  createdAt: string;
}

export interface AdminProfile {
  id: string;
  role: 'ADMIN';
  name: string;
  fullName: string;
  email: string;
  phone: string;
}

export type UserProfile = CustomerProfile | VendorProfile | AdminProfile;

export interface Session {
  token: string;
  role: UserRole;
  user: UserProfile;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  image: string | null;
  description: string;
  isVisible: boolean;
  status: string;
}

export interface SubCategory {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  icon: string | null;
  estimatedDuration: number;
  estimatedPrice: number;
  isVisible: boolean;
  status: string;
}

/** Public vendor card as returned by /vendors/recommended. Render as-is. */
export interface PublicVendor {
  id: string;
  businessName: string;
  ownerName: string;
  description: string;
  profileImage: string | null;
  areaLabel: string;
  workingHours: string;
  averageRating: number;
  totalReviews: number;
  isAvailable: boolean;
  categories: CategoryRef[];
}

export interface RequestParty {
  id: string;
  name?: string;
  businessName?: string;
  ownerName?: string;
  phone: string | null;
  profileImage: string | null;
  averageRating?: number;
  totalReviews?: number;
}

export interface TimelineEntry {
  id: string;
  status: RequestStatus;
  statusLabel: string;
  title: string;
  note: string;
  userRole: UserRole;
  createdAt: string;
}

export interface Review {
  id: string;
  serviceRequestId: string;
  vendorId: string;
  customer: { id: string; name: string; profileImage: string | null } | null;
  rating: number;
  comment: string;
  images: string[];
  createdAt: string;
}

export interface ServiceRequest {
  id: string;
  requestNumber: string;
  status: RequestStatus;
  statusLabel: string;
  priority: Priority;
  priorityLabel: string;
  dispatchMode: DispatchMode;
  isDirectedToMe: boolean;
  category: CategoryRef | null;
  subCategory: { id: string; name: string; estimatedPrice: number } | null;
  customer: RequestParty | null;
  vendor: RequestParty | null;
  requestedVendor: RequestParty | null;
  assignedTeamMember: { id: string; name: string; phone: string; designation: string } | null;
  address: { id: string; title: string; fullAddress: string } | null;
  serviceAddress: string;
  description: string;
  notes: string;
  images: string[];
  preferredDate: string | null;
  preferredTime: string;
  estimatedAmount: number;
  finalAmount: number | null;
  paymentMethod: string | null;
  paymentMethodLabel: string | null;
  paymentStatus: string;
  paymentStatusLabel: string;
  completionNotes: string;
  completionImages: string[];
  cancelReason: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  isReviewed: boolean;
  review: Review | null;
  timeline?: TimelineEntry[];
  allowedActions: RequestAction[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  phone: string;
  designation: string;
  profileImage: string | null;
  status: TeamMemberStatus;
}

export interface VendorDashboard {
  todayRequests: number;
  pendingRequests: number;
  acceptedRequests: number;
  inProgressRequests: number;
  completedRequests: number;
  averageRating: number;
  totalReviews: number;
  availability: boolean;
  approvalStatus: ApprovalStatus;
  activeJobs: ServiceRequest[];
}

export interface VendorReport {
  period: ReportPeriod;
  totalRequests: number;
  acceptedRequests: number;
  completedRequests: number;
  rejectedRequests: number;
  cancelledRequests: number;
  averageRating: number;
  totalReviews: number;
  periodAverageRating: number;
  periodReviews: number;
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  breakdown: { stars: number; count: number; percentage: number }[];
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AdminDashboard {
  totalCustomers: number;
  totalVendors: number;
  pendingVendors: number;
  approvedVendors: number;
  totalRequests: number;
  todayRequests: number;
  openRequests: number;
  activeRequests: number;
  completedRequests: number;
}

export interface UploadedFile {
  url: string;
  mimeType: string;
  size: number;
}
