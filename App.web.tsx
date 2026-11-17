/**
 * App (web)
 *
 * The browser build's root: the customer, vendor and admin views, which talk to
 * the backend through FixoraApiClient. It was App.tsx on the vivek-code
 * branch; on merging the phone app in (17/11/2026) it became App.web.tsx so
 * both apps keep their own entry point. Vite resolves `.web.tsx` first, so
 * index.web.tsx still imports it as './App'; Metro never picks a `.web` file,
 * so the phone app keeps App.tsx.
 *
 * ⚠️ Rename it back and the phone app loses its navigation and every screen.
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/shared/theme';

import { Navbar, UserRole } from '@/features/common/Navbar';
import { AuthModal } from '@/features/common/AuthModal';
import { CreateRequestModal } from '@/features/common/CreateRequestModal';
import { RequestDetailModal } from '@/features/common/RequestDetailModal';
import { NotificationModal } from '@/features/common/NotificationModal';

import { CustomerView } from '@/features/customer/CustomerView';
import { VendorView } from '@/features/vendor/VendorView';
import { AdminView } from '@/features/admin/AdminView';

import {
  fetchCategories,
  fetchSubCategories,
  fetchVendors,
  fetchServiceRequests,
  createServiceRequest,
  acceptServiceRequest,
  updateServiceRequestStatus,
  fetchNotifications,
  logoutUser,
  setAuthToken,
  ensureAuthToken,
} from '@/shared/services/api/FixoraApiClient';

function MainApp() {
  const theme = useTheme();

  const [currentRole, setCurrentRole] = useState<UserRole>('CUSTOMER');
  const [currentUser, setCurrentUser] = useState<any>({
    email: 'customer@fixora.com',
    name: 'Alex Morgan',
  });

  const [categories, setCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [createRequestModalVisible, setCreateRequestModalVisible] = useState(false);
  const [selectedVendorForBooking, setSelectedVendorForBooking] = useState<string | null>(null);

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const [notificationModalVisible, setNotificationModalVisible] = useState(false);

  const refreshRequests = async () => {
    try {
      const reqs = await fetchServiceRequests();
      setRequests(reqs);
      refreshNotifications();
    } catch (err) {
      console.warn('Failed to refresh requests:', err);
    }
  };

  const refreshNotifications = async () => {
    try {
      const notifs = await fetchNotifications();
      const unread = notifs.filter((n: any) => !n.isRead).length;
      setUnreadNotifCount(unread);
    } catch (err) {
      console.warn('refreshNotifications error:', err);
    }
  };

  const refreshCategories = async () => {
    try {
      const cats = await fetchCategories();
      setCategories(cats);
    } catch (err) {
      console.warn('refreshCategories error:', err);
    }
  };

  const refreshVendors = async () => {
    try {
      const vends = await fetchVendors();
      setVendors(vends);
    } catch (err) {
      console.warn('refreshVendors error:', err);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        await ensureAuthToken('CUSTOMER');
        const [cats, subs, vends, reqs, notifs] = await Promise.all([
          fetchCategories(),
          fetchSubCategories(),
          fetchVendors(),
          fetchServiceRequests(),
          fetchNotifications(),
        ]);

        setCategories(cats);
        setSubCategories(subs);
        setVendors(vends);
        setRequests(reqs);
        setUnreadNotifCount(notifs.filter((n: any) => !n.isRead).length);
      } catch (err) {
        console.error('Data loading error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const handleRoleChange = async (newRole: UserRole) => {
    setCurrentRole(newRole);
    await ensureAuthToken(newRole);
    if (newRole === 'VENDOR') {
      setCurrentUser({ email: 'vendor@fixora.com', name: 'SparkFix Electricals', role: 'VENDOR' });
    } else if (newRole === 'ADMIN') {
      setCurrentUser({ email: 'admin@fixora.com', name: 'Platform Admin', role: 'ADMIN' });
    } else {
      setCurrentUser({ email: 'customer@fixora.com', name: 'Alex Morgan', role: 'CUSTOMER' });
    }
    await refreshRequests();
  };

  const handleCreateRequest = async (requestPayload: any) => {
    try {
      await createServiceRequest(requestPayload);
      await refreshRequests();
    } catch (err) {
      console.error('Failed to create service request on backend:', err);
      await refreshRequests();
    }
  };

  const handleAcceptRequest = async (reqId: string) => {
    setRequests((prev) =>
      prev.map((r) => (r._id === reqId || r.id === reqId ? { ...r, status: 'ACCEPTED' } : r))
    );
    try {
      await acceptServiceRequest(reqId);
      await refreshRequests();
    } catch (err) {
      console.warn('Backend accept failed:', err);
    }
  };

  const handleUpdateStatus = async (reqId: string, status: string, note?: string) => {
    setRequests((prev) =>
      prev.map((r) => (r._id === reqId || r.id === reqId ? { ...r, status } : r))
    );
    try {
      await updateServiceRequestStatus(reqId, status, note);
      await refreshRequests();
    } catch (err) {
      console.warn('Backend update status failed:', err);
    }
  };

  const handleLoginSuccess = async (user: any) => {
    setCurrentUser(user);
    const role = user?.role || (user?.email?.includes('vendor') ? 'VENDOR' : user?.email?.includes('admin') ? 'ADMIN' : 'CUSTOMER');
    setCurrentRole(role);
    await refreshRequests();
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setCurrentRole('CUSTOMER');
    setRequests([]);
    setUnreadNotifCount(0);
  };

  const handleOpenCreateBooking = (vendorId?: string | null) => {
    setSelectedVendorForBooking(vendorId || null);
    setCreateRequestModalVisible(true);
  };

  const handleOpenRequestDetail = (reqId: string) => {
    setSelectedRequestId(reqId);
    setDetailModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Navbar
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        currentUser={currentUser}
        onOpenAuth={() => setAuthModalVisible(true)}
        onOpenCreateRequest={() => handleOpenCreateBooking(null)}
        onOpenNotifications={() => setNotificationModalVisible(true)}
        unreadNotifCount={unreadNotifCount}
        onLogout={handleLogout}
      />

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <View style={styles.viewBody}>
          {currentRole === 'CUSTOMER' && (
            <CustomerView
              categories={categories}
              subCategories={subCategories}
              vendors={vendors}
              requests={requests}
              onOpenCreateRequest={handleOpenCreateBooking}
              onUpdateRequestStatus={handleUpdateStatus}
              onOpenRequestDetail={handleOpenRequestDetail}
            />
          )}

          {currentRole === 'VENDOR' && (
            <VendorView
              requests={requests}
              onAcceptRequest={handleAcceptRequest}
              onUpdateStatus={handleUpdateStatus}
              onOpenRequestDetail={handleOpenRequestDetail}
            />
          )}

          {currentRole === 'ADMIN' && (
            <AdminView
              categories={categories}
              vendors={vendors}
              requests={requests}
              onRefreshCategories={refreshCategories}
              onRefreshVendors={refreshVendors}
            />
          )}
        </View>
      )}

      {/* Modals */}
      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <CreateRequestModal
        visible={createRequestModalVisible}
        onClose={() => setCreateRequestModalVisible(false)}
        categories={categories}
        subCategories={subCategories}
        vendors={vendors}
        initialVendorId={selectedVendorForBooking}
        onSubmit={handleCreateRequest}
      />

      <RequestDetailModal
        visible={detailModalVisible}
        requestId={selectedRequestId}
        currentUserRole={currentRole}
        onClose={() => setDetailModalVisible(false)}
        onRefresh={refreshRequests}
      />

      <NotificationModal
        visible={notificationModalVisible}
        onClose={() => {
          setNotificationModalVisible(false);
          refreshNotifications();
        }}
        onSelectRequest={(reqId) => {
          handleOpenRequestDetail(reqId);
        }}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {/* No `initialPreference`: the phone app's ThemeProvider takes none —
          system appearance is the only theme authority (CLAUDE.md §4). */}
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: '100vh' as any,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  viewBody: {
    flex: 1,
  },
});
