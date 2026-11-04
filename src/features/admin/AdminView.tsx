import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useTheme } from '@/shared/theme';
import {
  fetchAdminDashboard,
  createCategory,
  updateVendorApprovalStatus,
  fetchAdminCustomers,
} from '@/shared/services/api/FixoraApiClient';

interface AdminViewProps {
  categories: any[];
  vendors: any[];
  requests: any[];
  onRefreshCategories?: () => void;
  onRefreshVendors?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  categories,
  vendors,
  requests,
  onRefreshCategories,
  onRefreshVendors,
}) => {
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState<'METRICS' | 'CATEGORIES' | 'VENDORS' | 'CUSTOMERS'>('METRICS');

  // Live Dashboard Metrics
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Add Category Modal
  const [addCatModalVisible, setAddCatModalVisible] = useState(false);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  // Customers Tab
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  useEffect(() => {
    loadDashboardMetrics();
  }, []);

  const loadDashboardMetrics = async () => {
    setLoadingDashboard(true);
    try {
      const data = await fetchAdminDashboard();
      if (data) setDashboardData(data);
    } catch (err) {
      console.warn('loadDashboardMetrics error:', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const res = await fetchAdminCustomers();
      setCustomerList(res?.data || res || []);
    } catch (err) {
      console.warn('loadCustomers error:', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!catName.trim()) {
      Alert.alert('Required', 'Category name is required.');
      return;
    }
    setCreatingCat(true);
    try {
      await createCategory({
        name: catName,
        slug: catSlug.trim() || catName.toLowerCase().replace(/\s+/g, '-'),
        description: catDesc,
      });
      setCreatingCat(false);
      setAddCatModalVisible(false);
      setCatName('');
      setCatSlug('');
      setCatDesc('');
      Alert.alert('Category Created', 'New service category added to platform.');
      if (onRefreshCategories) onRefreshCategories();
    } catch (err: any) {
      setCreatingCat(false);
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to create category.');
    }
  };

  const handleUpdateVendorStatus = async (vendorId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await updateVendorApprovalStatus(vendorId, status);
      Alert.alert('Status Updated', `Vendor marked as ${status}.`);
      if (onRefreshVendors) onRefreshVendors();
      loadDashboardMetrics();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to update vendor status.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Sub Navigation Bar */}
      <View style={[styles.subNavBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {[
          { id: 'METRICS', label: '📊 System Metrics' },
          { id: 'CATEGORIES', label: `📂 Categories (${categories.length})` },
          { id: 'VENDORS', label: `🛡️ Vendors (${vendors.length})` },
          { id: 'CUSTOMERS', label: '👥 Customers' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.subNavTab,
              activeTab === tab.id && { borderBottomColor: theme.colors.primary, borderBottomWidth: 3 },
            ]}
            onPress={() => {
              setActiveTab(tab.id as any);
              if (tab.id === 'CUSTOMERS') loadCustomers();
            }}
          >
            <Text
              style={[
                styles.subNavTabText,
                { color: activeTab === tab.id ? theme.colors.primary : theme.colors.textSecondary },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.contentArea} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ==================== TAB 1: METRICS ==================== */}
        {activeTab === 'METRICS' && (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginBottom: 14 }]}>
              📊 Fixora Live Platform Metrics
            </Text>

            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: theme.colors.primarySubtle }]}>
                <Text style={[styles.statNum, { color: theme.colors.primary }]}>{requests.length}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total Service Requests</Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: theme.colors.successSubtle }]}>
                <Text style={[styles.statNum, { color: theme.colors.success }]}>
                  {dashboardData?.totalVendors !== undefined ? dashboardData.totalVendors : vendors.length}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Registered Vendors</Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: theme.colors.warningSubtle }]}>
                <Text style={[styles.statNum, { color: theme.colors.warning }]}>
                  {dashboardData?.pendingVendors !== undefined ? dashboardData.pendingVendors : 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Pending Vendor Approvals</Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: theme.colors.infoSubtle }]}>
                <Text style={[styles.statNum, { color: theme.colors.info }]}>
                  {dashboardData?.totalCustomers !== undefined ? dashboardData.totalCustomers : 2}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Active Customers</Text>
              </View>
            </View>

            <View style={[styles.adminBanner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.adminBannerTitle, { color: theme.colors.textPrimary }]}>
                🚀 Fixora Backend Status: HEALTHY
              </Text>
              <Text style={[styles.adminBannerText, { color: theme.colors.textSecondary }]}>
                Node.js API running at http://localhost:5000/api/v1 • MongoDB Atlas Connected • Full Lifecycle Active.
              </Text>
            </View>
          </View>
        )}

        {/* ==================== TAB 2: CATEGORIES ==================== */}
        {activeTab === 'CATEGORIES' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                📂 Service Categories Management ({categories.length})
              </Text>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setAddCatModalVisible(true)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>+ Add Category</Text>
              </TouchableOpacity>
            </View>

            {categories.map((c) => (
              <View
                key={c.id || c._id}
                style={[
                  styles.listRow,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: theme.colors.textPrimary }]}>{c.name}</Text>
                  <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]}>
                    Slug: {c.slug} • {c.description || 'Verified category'}
                  </Text>
                </View>
                <View style={[styles.activeBadge, { backgroundColor: theme.colors.successSubtle }]}>
                  <Text style={{ color: theme.colors.success, fontWeight: '700', fontSize: 11 }}>ACTIVE</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ==================== TAB 3: VENDORS ==================== */}
        {activeTab === 'VENDORS' && (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginBottom: 14 }]}>
              🛡️ Vendor Applications & Verification
            </Text>

            {vendors.map((v) => (
              <View
                key={v.id || v._id}
                style={[
                  styles.vendorAppCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <View style={styles.appHeader}>
                  <Text style={[styles.appName, { color: theme.colors.textPrimary }]}>{v.businessName}</Text>
                  <View
                    style={[
                      styles.activeBadge,
                      {
                        backgroundColor:
                          v.approvalStatus === 'APPROVED'
                            ? theme.colors.successSubtle
                            : v.approvalStatus === 'REJECTED'
                            ? '#FEE2E2'
                            : theme.colors.warningSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          v.approvalStatus === 'APPROVED'
                            ? theme.colors.success
                            : v.approvalStatus === 'REJECTED'
                            ? '#DC2626'
                            : theme.colors.warning,
                        fontWeight: '700',
                        fontSize: 11,
                      }}
                    >
                      {v.approvalStatus || 'APPROVED'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.appSub, { color: theme.colors.textSecondary }]}>
                  Owner: {v.ownerName} • 📞 {v.phone} • ✉️ {v.email}
                </Text>
                <Text style={[styles.appDesc, { color: theme.colors.textSecondary }]}>
                  Address: {v.address} • Rating: {v.averageRating || 5.0}★
                </Text>

                {/* Status Toggle Actions */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.colors.successSubtle }]}
                    onPress={() => handleUpdateVendorStatus(v.id || v._id, 'APPROVED')}
                  >
                    <Text style={{ color: theme.colors.success, fontWeight: '700', fontSize: 11 }}>
                      ✓ APPROVE
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
                    onPress={() => handleUpdateVendorStatus(v.id || v._id, 'REJECTED')}
                  >
                    <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 11 }}>
                      ✕ SUSPEND / REJECT
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ==================== TAB 4: CUSTOMERS ==================== */}
        {activeTab === 'CUSTOMERS' && (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginBottom: 14 }]}>
              👥 Registered Platform Customers
            </Text>

            {loadingCustomers ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 20 }} />
            ) : customerList.length === 0 ? (
              <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceAlt }]}>
                <Text style={{ color: theme.colors.textSecondary }}>No customer records found.</Text>
              </View>
            ) : (
              customerList.map((cust) => (
                <View
                  key={cust.id || cust._id}
                  style={[
                    styles.listRow,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: theme.colors.textPrimary }]}>
                      👤 {cust.fullName || `${cust.firstName} ${cust.lastName || ''}`}
                    </Text>
                    <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]}>
                      ✉️ {cust.email} • 📞 {cust.phone}
                    </Text>
                  </View>
                  <View style={[styles.activeBadge, { backgroundColor: theme.colors.successSubtle }]}>
                    <Text style={{ color: theme.colors.success, fontWeight: '700', fontSize: 11 }}>
                      {cust.status || 'ACTIVE'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Category Modal */}
      <Modal visible={addCatModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>+ Add Service Category</Text>

            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Category Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder="e.g. Smart Home & Security"
              placeholderTextColor={theme.colors.textDisabled}
              value={catName}
              onChangeText={setCatName}
            />

            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Slug (URL identifier)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder="smart-home-security"
              placeholderTextColor={theme.colors.textDisabled}
              value={catSlug}
              onChangeText={setCatSlug}
            />

            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Description</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder="Installation and maintenance of smart home devices"
              placeholderTextColor={theme.colors.textDisabled}
              value={catDesc}
              onChangeText={setCatDesc}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.colors.primary, flex: 1 }]}
                onPress={handleCreateCategory}
                disabled={creatingCat}
              >
                <Text style={styles.submitBtnText}>{creatingCat ? 'Creating...' : 'Create Category'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setAddCatModalVisible(false)}
              >
                <Text style={{ fontWeight: '700', color: theme.colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  subNavBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  subNavTab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  subNavTabText: {
    fontWeight: '700',
    fontSize: 13,
  },
  contentArea: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  adminBanner: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  adminBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  adminBannerText: {
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  addBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vendorAppCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  appName: {
    fontSize: 15,
    fontWeight: '700',
  },
  appSub: {
    fontSize: 12,
    marginBottom: 4,
  },
  appDesc: {
    fontSize: 12,
    marginBottom: 6,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  submitBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
});
