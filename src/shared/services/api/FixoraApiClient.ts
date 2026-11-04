import axios from 'axios';
import { AppConfig } from '@/core/config/AppConfig';

export const apiClient = axios.create({
  baseURL: AppConfig.api.baseUrl,
  timeout: AppConfig.api.timeoutMs,
  headers: {
    'Content-Type': 'application/json',
  },
});

export let authToken: string | null = null;
export let currentUserRole: 'CUSTOMER' | 'VENDOR' | 'ADMIN' = 'CUSTOMER';

export const setAuthToken = (token: string | null, role: 'CUSTOMER' | 'VENDOR' | 'ADMIN' = 'CUSTOMER') => {
  authToken = token;
  currentUserRole = role;
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

/** Ensure an active token exists, defaulting to demo customer if unauthenticated. */
export const ensureAuthToken = async (requiredRole: 'CUSTOMER' | 'VENDOR' | 'ADMIN' = 'CUSTOMER') => {
  if (!authToken || (requiredRole && currentUserRole !== requiredRole)) {
    try {
      const email = requiredRole === 'VENDOR' ? 'vendor@fixora.com' : requiredRole === 'ADMIN' ? 'admin@fixora.com' : 'customer@fixora.com';
      const res = await apiClient.post('/auth/login', {
        email,
        password: 'Password123!',
        role: requiredRole,
      });
      if (res.data?.data?.token) {
        setAuthToken(res.data.data.token, requiredRole);
      }
    } catch (err) {
      console.warn('Auto auth initialization failed:', err);
    }
  }
};

// ==========================================
// 1. AUTHENTICATION & PROFILE APIS
// ==========================================

export const loginUser = async (credentials: { email: string; password: string; role?: 'CUSTOMER' | 'VENDOR' | 'ADMIN' }) => {
  const role = credentials.role || (credentials.email.includes('vendor') ? 'VENDOR' : credentials.email.includes('admin') ? 'ADMIN' : 'CUSTOMER');
  const res = await apiClient.post('/auth/login', {
    email: credentials.email,
    password: credentials.password,
    role,
  });

  if (res.data?.data?.token) {
    setAuthToken(res.data.data.token, role);
  }
  return res.data;
};

export const registerCustomer = async (payload: {
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  password: string;
}) => {
  const res = await apiClient.post('/auth/register/customer', payload);
  if (res.data?.data?.token) {
    setAuthToken(res.data.data.token, 'CUSTOMER');
  }
  return res.data;
};

export const registerVendor = async (payload: {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  address: string;
  description?: string;
  categoryIds?: string[];
}) => {
  const res = await apiClient.post('/auth/register/vendor', payload);
  if (res.data?.data?.token) {
    setAuthToken(res.data.data.token, 'VENDOR');
  }
  return res.data;
};

export const logoutUser = async () => {
  try {
    if (authToken) {
      await apiClient.post('/auth/logout', {});
    }
  } catch (err) {
    console.warn('Logout API warning:', err);
  } finally {
    setAuthToken(null, 'CUSTOMER');
  }
};

export const fetchCurrentUserProfile = async () => {
  try {
    await ensureAuthToken(currentUserRole);
    const res = await apiClient.get('/auth/me');
    return res.data?.data || null;
  } catch (err) {
    console.warn('fetchCurrentUserProfile error:', err);
    return null;
  }
};

export const updateCustomerProfile = async (payload: {
  firstName?: string;
  lastName?: string;
  phone?: string;
}) => {
  await ensureAuthToken('CUSTOMER');
  const res = await apiClient.post('/customers/update', payload);
  return res.data?.data;
};

// ==========================================
// 2. CATEGORIES & CATALOG APIS
// ==========================================

export const fetchCategories = async () => {
  try {
    const res = await apiClient.get('/categories');
    return res.data?.data || [];
  } catch (err) {
    console.warn('API fetchCategories failed:', err);
    return [];
  }
};

export const fetchSubCategories = async () => {
  try {
    const res = await apiClient.get('/subcategories');
    return res.data?.data || [];
  } catch (err) {
    console.warn('API fetchSubCategories failed:', err);
    return [];
  }
};

export const createCategory = async (payload: {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
}) => {
  await ensureAuthToken('ADMIN');
  const res = await apiClient.post('/categories', payload);
  return res.data?.data;
};

// ==========================================
// 3. VENDOR & TEAM MANAGEMENT APIS
// ==========================================

export const fetchVendors = async () => {
  try {
    const res = await apiClient.post('/vendors/list', {});
    return res.data?.data || [];
  } catch (err) {
    console.warn('API fetchVendors failed:', err);
    return [];
  }
};

export const updateVendorApprovalStatus = async (id: string, approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED') => {
  await ensureAuthToken('ADMIN');
  const res = await apiClient.post('/vendors/approval-status', { id, approvalStatus });
  return res.data?.data;
};

export const updateVendorAvailability = async (id: string, availability: boolean) => {
  await ensureAuthToken('VENDOR');
  const res = await apiClient.post('/vendors/update', { id, availability });
  return res.data?.data;
};

export const fetchVendorTeam = async () => {
  try {
    await ensureAuthToken('VENDOR');
    const res = await apiClient.get('/team');
    return res.data?.data || [];
  } catch (err) {
    console.warn('fetchVendorTeam error:', err);
    return [];
  }
};

export const createTeamMember = async (payload: {
  name: string;
  phone: string;
  designation?: string;
}) => {
  await ensureAuthToken('VENDOR');
  const res = await apiClient.post('/team', payload);
  return res.data?.data;
};

export const updateTeamMember = async (payload: {
  id: string;
  name?: string;
  phone?: string;
  designation?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
}) => {
  await ensureAuthToken('VENDOR');
  const res = await apiClient.post('/team/update', payload);
  return res.data?.data;
};

export const deleteTeamMember = async (id: string) => {
  await ensureAuthToken('VENDOR');
  const res = await apiClient.delete('/team/delete', { data: { id } });
  return res.data;
};

export const assignTeamMemberToRequest = async (requestId: string, assignedTeamMemberId: string) => {
  await ensureAuthToken('VENDOR');
  const res = await apiClient.post('/requests/assign', {
    id: requestId,
    assignedTeamMemberId,
  });
  return res.data?.data;
};

// ==========================================
// 4. SERVICE REQUESTS & LIFECYCLE APIS
// ==========================================

export const fetchServiceRequests = async () => {
  try {
    await ensureAuthToken(currentUserRole);
    const res = await apiClient.post('/requests/list', {});
    return res.data?.data || [];
  } catch (err) {
    console.warn('API fetchServiceRequests failed:', err);
    return [];
  }
};

export const fetchRequestDetails = async (id: string) => {
  await ensureAuthToken(currentUserRole);
  const res = await apiClient.post('/requests/detail', { id });
  return res.data?.data;
};

export const createServiceRequest = async (payload: {
  categoryId: string;
  subCategoryId?: string;
  vendorId?: string | null;
  description: string;
  serviceAddress?: string;
  priority?: string;
}) => {
  await ensureAuthToken('CUSTOMER');
  const res = await apiClient.post('/requests', payload);
  return res.data?.data;
};

export const acceptServiceRequest = async (id: string) => {
  await ensureAuthToken('VENDOR');
  const res = await apiClient.post('/requests/accept', { id });
  return res.data?.data;
};

export const rejectServiceRequest = async (id: string, note?: string) => {
  await ensureAuthToken(currentUserRole);
  const res = await apiClient.post('/requests/reject', { id, note });
  return res.data?.data;
};

export const updateServiceRequestStatus = async (id: string, status: string, note?: string) => {
  await ensureAuthToken('VENDOR');
  let endpoint = '/requests/start';
  if (status === 'COMPLETED') {
    endpoint = '/requests/complete';
  } else if (status === 'REJECTED') {
    endpoint = '/requests/reject';
  }

  const res = await apiClient.post(endpoint, { id, note });
  return res.data?.data;
};

// ==========================================
// 5. REVIEWS & RATINGS APIS
// ==========================================

export const submitReview = async (payload: {
  serviceRequestId: string;
  rating: number;
  comment?: string;
}) => {
  await ensureAuthToken('CUSTOMER');
  const res = await apiClient.post('/reviews', payload);
  return res.data?.data;
};

export const fetchVendorReviews = async (vendorId: string) => {
  try {
    const res = await apiClient.post('/reviews/vendor', { vendorId });
    return res.data?.data || [];
  } catch (err) {
    console.warn('fetchVendorReviews error:', err);
    return [];
  }
};

// ==========================================
// 6. CUSTOMER ADDRESSES APIS
// ==========================================

export const fetchCustomerAddresses = async () => {
  try {
    await ensureAuthToken('CUSTOMER');
    const res = await apiClient.get('/addresses');
    return res.data?.data || [];
  } catch (err) {
    console.warn('fetchCustomerAddresses error:', err);
    return [];
  }
};

export const createCustomerAddress = async (payload: {
  title?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}) => {
  await ensureAuthToken('CUSTOMER');
  const res = await apiClient.post('/addresses', payload);
  return res.data?.data;
};

export const setDefaultAddress = async (id: string) => {
  await ensureAuthToken('CUSTOMER');
  const res = await apiClient.post('/addresses/default', { id });
  return res.data?.data;
};

// ==========================================
// 7. ADMIN DASHBOARD & CUSTOMER APIS
// ==========================================

export const fetchAdminDashboard = async () => {
  try {
    await ensureAuthToken('ADMIN');
    const res = await apiClient.get('/admin/dashboard');
    return res.data?.data || null;
  } catch (err) {
    console.warn('fetchAdminDashboard error:', err);
    return null;
  }
};

export const fetchAdminCustomers = async () => {
  try {
    await ensureAuthToken('ADMIN');
    const res = await apiClient.post('/customers/list', {});
    return res.data?.data || [];
  } catch (err) {
    console.warn('fetchAdminCustomers error:', err);
    return [];
  }
};

// ==========================================
// 8. NOTIFICATIONS APIS
// ==========================================

export const fetchNotifications = async () => {
  try {
    await ensureAuthToken(currentUserRole);
    const res = await apiClient.get('/notifications');
    return res.data?.data || [];
  } catch (err) {
    console.warn('fetchNotifications error:', err);
    return [];
  }
};

export const markNotificationAsRead = async (id: string) => {
  try {
    await ensureAuthToken(currentUserRole);
    const res = await apiClient.post('/notifications/read', { id });
    return res.data?.data;
  } catch (err) {
    console.warn('markNotificationAsRead error:', err);
    return null;
  }
};
