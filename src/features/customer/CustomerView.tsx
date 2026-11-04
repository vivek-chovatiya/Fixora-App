import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '@/shared/theme';
import {
  fetchCurrentUserProfile,
  updateCustomerProfile,
  fetchCustomerAddresses,
  createCustomerAddress,
  setDefaultAddress,
  fetchVendorReviews,
} from '@/shared/services/api/FixoraApiClient';

interface CustomerViewProps {
  categories: any[];
  subCategories: any[];
  vendors: any[];
  requests: any[];
  onOpenCreateRequest: (vendorId?: string | null) => void;
  onUpdateRequestStatus?: (reqId: string, status: string) => void;
  onOpenRequestDetail?: (reqId: string) => void;
}

export const CustomerView: React.FC<CustomerViewProps> = ({
  categories,
  vendors,
  requests,
  onOpenCreateRequest,
  onOpenRequestDetail,
}) => {
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState<'HOME' | 'REQUESTS' | 'VENDORS' | 'PROFILE'>('HOME');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  // Profile & Address State
  const [profile, setProfile] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Edit Profile Form
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Add Address Modal
  const [addAddressModalVisible, setAddAddressModalVisible] = useState(false);
  const [addrTitle, setAddrTitle] = useState('Home');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPincode, setAddrPincode] = useState('');
  const [savingAddr, setSavingAddr] = useState(false);

  // Vendor Reviews Modal
  const [vendorReviewsModalVisible, setVendorReviewsModalVisible] = useState(false);
  const [selectedVendorForReviews, setSelectedVendorForReviews] = useState<any>(null);
  const [vendorReviews, setVendorReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  useEffect(() => {
    loadProfileAndAddresses();
  }, []);

  const loadProfileAndAddresses = async () => {
    setLoadingProfile(true);
    try {
      const [prof, addrs] = await Promise.all([
        fetchCurrentUserProfile(),
        fetchCustomerAddresses(),
      ]);
      if (prof) {
        setProfile(prof);
        setEditFirstName(prof.firstName || '');
        setEditLastName(prof.lastName || '');
        setEditPhone(prof.phone || '');
      }
      setAddresses(addrs || []);
    } catch (err) {
      console.warn('loadProfile error:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const updated = await updateCustomerProfile({
        firstName: editFirstName,
        lastName: editLastName,
        phone: editPhone,
      });
      setProfile(updated);
      setIsEditingProfile(false);
      Alert.alert('Profile Saved', 'Your account details have been updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Update failed.');
    }
  };

  const handleCreateAddress = async () => {
    if (!addrLine1 || !addrCity || !addrState || !addrPincode) {
      Alert.alert('Required Fields', 'Please fill in address, city, state, and pincode.');
      return;
    }

    setSavingAddr(true);
    try {
      await createCustomerAddress({
        title: addrTitle,
        addressLine1: addrLine1,
        city: addrCity,
        state: addrState,
        pincode: addrPincode,
        isDefault: addresses.length === 0,
      });
      setSavingAddr(false);
      setAddAddressModalVisible(false);
      setAddrLine1('');
      setAddrCity('');
      setAddrState('');
      setAddrPincode('');
      Alert.alert('Address Added', 'Saved location added.');
      const addrs = await fetchCustomerAddresses();
      setAddresses(addrs || []);
    } catch (err: any) {
      setSavingAddr(false);
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to save address.');
    }
  };

  const handleSetDefaultAddress = async (id: string) => {
    try {
      await setDefaultAddress(id);
      Alert.alert('Default Updated', 'Primary service address updated.');
      const addrs = await fetchCustomerAddresses();
      setAddresses(addrs || []);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed.');
    }
  };

  const handleViewVendorReviews = async (vendor: any) => {
    setSelectedVendorForReviews(vendor);
    setVendorReviewsModalVisible(true);
    setLoadingReviews(true);
    try {
      const reviews = await fetchVendorReviews(vendor.id || vendor._id);
      setVendorReviews(reviews);
    } catch (err) {
      console.warn('fetchVendorReviews error:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRequests = requests.filter((r) => {
    if (selectedFilter === 'ALL') return true;
    return r.status === selectedFilter;
  });

  return (
    <View style={styles.container}>
      {/* Sub Navigation Bar */}
      <View style={[styles.subNavBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {[
          { id: 'HOME', label: '🏠 Home Services' },
          { id: 'REQUESTS', label: `📋 My Requests (${requests.length})` },
          { id: 'VENDORS', label: `👨‍🔧 Top Vendors (${vendors.length})` },
          { id: 'PROFILE', label: '👤 Account & Addresses' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.subNavTab,
              activeTab === tab.id && { borderBottomColor: theme.colors.primary, borderBottomWidth: 3 },
            ]}
            onPress={() => setActiveTab(tab.id as any)}
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
        {/* ==================== TAB 1: HOME ==================== */}
        {activeTab === 'HOME' && (
          <View>
            {/* Hero Banner */}
            <View style={[styles.heroBanner, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.heroTitle}>Need a Quick Repair or Maintenance?</Text>
              <Text style={styles.heroSub}>Connect with verified local electricians, plumbers & technicians.</Text>

              <View style={styles.searchBoxContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search services (e.g. Electrical, Plumbing, AC)..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={() => onOpenCreateRequest()}>
                  <Text style={styles.searchBtnText}>Book Now</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Service Categories Grid */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                ⚡ Browse Categories ({filteredCategories.length})
              </Text>
              <TouchableOpacity onPress={() => onOpenCreateRequest()}>
                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>+ Custom Request</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.categoryGrid}>
              {filteredCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id || cat._id}
                  style={[
                    styles.categoryCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                  onPress={() => onOpenCreateRequest()}
                >
                  <View style={[styles.catIconCircle, { backgroundColor: theme.colors.primarySubtle }]}>
                    <Text style={{ fontSize: 24 }}>
                      {cat.slug === 'electrical'
                        ? '⚡'
                        : cat.slug === 'plumbing'
                        ? '🚰'
                        : cat.slug === 'ac-appliance'
                        ? '❄️'
                        : cat.slug === 'carpentry'
                        ? '🔨'
                        : cat.slug === 'cleaning'
                        ? '🧹'
                        : cat.slug === 'painting'
                        ? '🎨'
                        : '🛠️'}
                    </Text>
                  </View>
                  <Text style={[styles.catTitle, { color: theme.colors.textPrimary }]}>{cat.name}</Text>
                  <Text style={[styles.catDesc, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                    {cat.description || 'Professional home service'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.catBookBtn, { backgroundColor: theme.colors.primarySubtle }]}
                    onPress={() => onOpenCreateRequest()}
                  >
                    <Text style={[styles.catBookBtnText, { color: theme.colors.primary }]}>Select Service →</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>

            {/* Featured Vendors */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                ⭐ Top Rated Verified Experts
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {vendors.map((v) => (
                <View
                  key={v.id || v._id}
                  style={[
                    styles.vendorCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  <View style={styles.vendorHeader}>
                    <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.avatarText}>{v.businessName ? v.businessName[0] : 'V'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.vendorName, { color: theme.colors.textPrimary }]}>{v.businessName}</Text>
                      <Text style={[styles.vendorSub, { color: theme.colors.textSecondary }]}>
                        {v.ownerName} • {v.address}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.vendorDesc, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                    {v.description}
                  </Text>
                  <View style={styles.vendorFooter}>
                    <TouchableOpacity onPress={() => handleViewVendorReviews(v)}>
                      <Text style={{ fontWeight: '700', color: '#D97706' }}>
                        ★ {v.averageRating || 5.0} ({v.totalReviews || 0} reviews)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.bookMiniBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={() => onOpenCreateRequest(v.id || v._id)}
                    >
                      <Text style={styles.bookMiniBtnText}>Hire Expert</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ==================== TAB 2: REQUESTS ==================== */}
        {activeTab === 'REQUESTS' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                📋 Service Request Bookings
              </Text>
              <TouchableOpacity
                style={[styles.smallAddBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => onOpenCreateRequest()}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>+ New Request</Text>
              </TouchableOpacity>
            </View>

            {/* Request Filter Tabs */}
            <View style={styles.filterRow}>
              {['ALL', 'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        selectedFilter === f ? theme.colors.primary : theme.colors.surfaceAlt,
                    },
                  ]}
                  onPress={() => setSelectedFilter(f)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: selectedFilter === f ? '#FFFFFF' : theme.colors.textSecondary },
                    ]}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Requests List */}
            {filteredRequests.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.colors.surfaceAlt }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📭</Text>
                <Text style={[styles.emptyText, { color: theme.colors.textPrimary }]}>
                  No service requests found for this filter.
                </Text>
                <TouchableOpacity
                  style={[styles.btnPrimary, { backgroundColor: theme.colors.primary, marginTop: 12 }]}
                  onPress={() => onOpenCreateRequest()}
                >
                  <Text style={styles.btnPrimaryText}>Create a Service Booking</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredRequests.map((req) => (
                <View
                  key={req._id || req.id}
                  style={[
                    styles.requestCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => onOpenRequestDetail && onOpenRequestDetail(req._id || req.id)}
                  >
                    <View style={styles.reqHeader}>
                      <View>
                        <Text style={[styles.reqNumber, { color: theme.colors.textPrimary }]}>
                          {req.requestNumber}
                        </Text>
                        <Text style={[styles.reqDate, { color: theme.colors.textTertiary }]}>
                          {new Date(req.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              req.status === 'COMPLETED'
                                ? theme.colors.successSubtle
                                : req.status === 'IN_PROGRESS'
                                ? theme.colors.infoSubtle
                                : theme.colors.warningSubtle,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontWeight: '700',
                            fontSize: 12,
                            color:
                              req.status === 'COMPLETED'
                                ? theme.colors.success
                                : req.status === 'IN_PROGRESS'
                                ? theme.colors.info
                                : theme.colors.warning,
                          }}
                        >
                          {req.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.reqDesc, { color: theme.colors.textPrimary }]}>{req.description}</Text>

                    <View style={styles.reqFooter}>
                      <Text style={[styles.reqAddress, { color: theme.colors.textSecondary }]}>
                        📍 {req.serviceAddress}
                      </Text>
                      <Text style={[styles.reqAmount, { color: theme.colors.primary }]}>₹{req.amount || 499}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Actions Bar on Card */}
                  <View style={styles.reqActionRow}>
                    <TouchableOpacity
                      style={[styles.outlineBtn, { borderColor: theme.colors.border }]}
                      onPress={() => onOpenRequestDetail && onOpenRequestDetail(req._id || req.id)}
                    >
                      <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 12 }}>
                        📜 View Timeline & Details
                      </Text>
                    </TouchableOpacity>

                    {req.status === 'COMPLETED' && (
                      <TouchableOpacity
                        style={[styles.rateBtn, { backgroundColor: theme.colors.primary }]}
                        onPress={() => onOpenRequestDetail && onOpenRequestDetail(req._id || req.id)}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>★ Leave Review</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ==================== TAB 3: VENDORS ==================== */}
        {activeTab === 'VENDORS' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                👨‍🔧 Directory of Service Providers
              </Text>
            </View>

            {vendors.map((v) => (
              <View
                key={v.id || v._id}
                style={[
                  styles.fullVendorCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <View style={styles.vendorHeader}>
                  <View style={[styles.largeAvatar, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.largeAvatarText}>{v.businessName ? v.businessName[0] : 'V'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fullVendorName, { color: theme.colors.textPrimary }]}>
                      {v.businessName}
                    </Text>
                    <Text style={[styles.vendorSub, { color: theme.colors.textSecondary }]}>
                      Owner: {v.ownerName} • 📞 {v.phone}
                    </Text>
                    <TouchableOpacity onPress={() => handleViewVendorReviews(v)}>
                      <Text style={{ fontWeight: '700', color: '#D97706', marginTop: 4 }}>
                        ★ {v.averageRating || 5.0} ({v.totalReviews || 0} Ratings & Reviews) - Click to view
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[styles.fullVendorDesc, { color: theme.colors.textSecondary }]}>
                  {v.description}
                </Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.fullBookBtn, { backgroundColor: theme.colors.primary, flex: 1 }]}
                    onPress={() => onOpenCreateRequest(v.id || v._id)}
                  >
                    <Text style={styles.fullBookBtnText}>Book Service with {v.businessName}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.fullBookBtn, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border, borderWidth: 1 }]}
                    onPress={() => handleViewVendorReviews(v)}
                  >
                    <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
                      ⭐ Reviews
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ==================== TAB 4: PROFILE & ADDRESSES ==================== */}
        {activeTab === 'PROFILE' && (
          <View>
            {/* Customer Profile Card */}
            <View style={[styles.profileCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={[styles.profileAvatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.profileAvatarText}>
                  {profile?.firstName ? profile.firstName[0] : 'C'}
                </Text>
              </View>

              {!isEditingProfile ? (
                <>
                  <Text style={[styles.profileName, { color: theme.colors.textPrimary }]}>
                    {profile ? `${profile.firstName} ${profile.lastName || ''}`.trim() : 'Alex Morgan'}
                  </Text>
                  <Text style={[styles.profileEmail, { color: theme.colors.textSecondary }]}>
                    {profile?.email || 'customer@fixora.com'}
                  </Text>

                  <View style={[styles.infoRow, { borderColor: theme.colors.border }]}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Phone Number:</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
                      {profile?.phone || '+1 (800) 555-0100'}
                    </Text>
                  </View>

                  <View style={[styles.infoRow, { borderColor: theme.colors.border }]}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Account Status:</Text>
                    <Text style={{ color: theme.colors.success, fontWeight: '700' }}>Active & Verified</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.editProfileBtn, { backgroundColor: theme.colors.primarySubtle }]}
                    onPress={() => setIsEditingProfile(true)}
                  >
                    <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>✏️ Edit Profile Info</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={{ width: '100%', marginTop: 10 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>First Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                    value={editFirstName}
                    onChangeText={setEditFirstName}
                  />

                  <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Last Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                    value={editLastName}
                    onChangeText={setEditLastName}
                  />

                  <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Phone Number</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                    value={editPhone}
                    onChangeText={setEditPhone}
                  />

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: theme.colors.primary, flex: 1 }]}
                      onPress={handleUpdateProfile}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Save Changes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, { borderColor: theme.colors.border, borderWidth: 1 }]}
                      onPress={() => setIsEditingProfile(false)}
                    >
                      <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Saved Addresses Section */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                📍 Saved Addresses ({addresses.length})
              </Text>
              <TouchableOpacity
                style={[styles.smallAddBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setAddAddressModalVisible(true)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>+ Add Address</Text>
              </TouchableOpacity>
            </View>

            {addresses.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.colors.surfaceAlt }]}>
                <Text style={[styles.emptyText, { color: theme.colors.textPrimary }]}>No saved addresses yet.</Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                  Add a home or office address for fast 1-click booking!
                </Text>
              </View>
            ) : (
              addresses.map((addr) => (
                <View
                  key={addr.id || addr._id}
                  style={[
                    styles.addressCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.addrTitle, { color: theme.colors.textPrimary }]}>
                        🏠 {addr.title || 'Home'}
                      </Text>
                      {addr.isDefault && (
                        <View style={[styles.defaultBadge, { backgroundColor: theme.colors.successSubtle }]}>
                          <Text style={{ color: theme.colors.success, fontSize: 10, fontWeight: '800' }}>
                            DEFAULT
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.addrLine, { color: theme.colors.textSecondary }]}>
                      {addr.addressLine1} {addr.addressLine2 ? ', ' + addr.addressLine2 : ''}
                    </Text>
                    <Text style={[styles.addrLine, { color: theme.colors.textTertiary }]}>
                      {addr.city}, {addr.state} - {addr.pincode}
                    </Text>
                  </View>

                  {!addr.isDefault && (
                    <TouchableOpacity
                      style={[styles.setDefaultBtn, { borderColor: theme.colors.border }]}
                      onPress={() => handleSetDefaultAddress(addr.id || addr._id)}
                    >
                      <Text style={{ color: theme.colors.primary, fontSize: 11, fontWeight: '700' }}>
                        Set Default
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Address Modal */}
      <Modal visible={addAddressModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>📍 Add New Service Address</Text>

            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Label / Title</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder="e.g. Home, Office, Vacation House"
              placeholderTextColor={theme.colors.textDisabled}
              value={addrTitle}
              onChangeText={setAddrTitle}
            />

            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Address Line 1 *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder="House/Apt, Street name"
              placeholderTextColor={theme.colors.textDisabled}
              value={addrLine1}
              onChangeText={setAddrLine1}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>City *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                  placeholder="City"
                  placeholderTextColor={theme.colors.textDisabled}
                  value={addrCity}
                  onChangeText={setAddrCity}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>State *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                  placeholder="State"
                  placeholderTextColor={theme.colors.textDisabled}
                  value={addrState}
                  onChangeText={setAddrState}
                />
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Pincode / ZIP *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder="62704"
              placeholderTextColor={theme.colors.textDisabled}
              value={addrPincode}
              onChangeText={setAddrPincode}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary, flex: 1 }]}
                onPress={handleCreateAddress}
                disabled={savingAddr}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{savingAddr ? 'Saving...' : 'Save Address'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { borderColor: theme.colors.border, borderWidth: 1 }]}
                onPress={() => setAddAddressModalVisible(false)}
              >
                <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Vendor Reviews Viewer Modal */}
      <Modal visible={vendorReviewsModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                ⭐ Reviews for {selectedVendorForReviews?.businessName}
              </Text>
              <TouchableOpacity onPress={() => setVendorReviewsModalVisible(false)}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.textSecondary }}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingReviews ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 20 }} />
            ) : vendorReviews.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                  No customer reviews submitted yet for this provider.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {vendorReviews.map((rev) => (
                  <View
                    key={rev.id || rev._id}
                    style={[styles.reviewCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: '700', color: '#F59E0B' }}>{'★'.repeat(rev.rating)}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>
                        {new Date(rev.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: theme.colors.textPrimary, marginTop: 4 }}>
                      {rev.comment || 'Verified customer review.'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
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
  heroBanner: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroSub: {
    color: '#E2E8F0',
    fontSize: 14,
    marginBottom: 16,
  },
  searchBoxContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 4,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  searchBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '31%',
    minWidth: 140,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  catIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  catTitle: {
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  catDesc: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 10,
  },
  catBookBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  catBookBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  vendorCard: {
    width: 280,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 12,
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  vendorSub: {
    fontSize: 11,
  },
  vendorDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  vendorFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookMiniBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  bookMiniBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  smallAddBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyBox: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
  },
  btnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  requestCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  reqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reqNumber: {
    fontSize: 14,
    fontWeight: '800',
  },
  reqDate: {
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reqDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  reqFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reqAddress: {
    fontSize: 12,
  },
  reqAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  reqActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  outlineBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  rateBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  fullVendorCard: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  largeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 20,
  },
  fullVendorName: {
    fontSize: 16,
    fontWeight: '800',
  },
  fullVendorDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginVertical: 10,
  },
  fullBookBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  fullBookBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  profileCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileEmail: {
    fontSize: 13,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  editProfileBtn: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
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
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addressCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  addrTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  addrLine: {
    fontSize: 12,
    marginTop: 2,
  },
  setDefaultBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
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
    maxWidth: 460,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  reviewCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
});
