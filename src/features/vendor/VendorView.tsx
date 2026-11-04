import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useTheme } from '@/shared/theme';
import {
  fetchVendorTeam,
  createTeamMember,
  deleteTeamMember,
  assignTeamMemberToRequest,
  updateVendorAvailability,
  fetchCurrentUserProfile,
  rejectServiceRequest,
} from '@/shared/services/api/FixoraApiClient';

interface VendorViewProps {
  requests: any[];
  onAcceptRequest: (reqId: string) => void;
  onUpdateStatus: (reqId: string, status: string) => void;
  onOpenRequestDetail?: (reqId: string) => void;
}

export const VendorView: React.FC<VendorViewProps> = ({
  requests,
  onAcceptRequest,
  onUpdateStatus,
  onOpenRequestDetail,
}) => {
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState<'BROADCAST' | 'MY_JOBS' | 'TEAM' | 'PROFILE'>('BROADCAST');
  const [onlineStatus, setOnlineStatus] = useState(true);

  // Real Team State
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberDesignation, setNewMemberDesignation] = useState('Technician');
  const [addingMember, setAddingMember] = useState(false);

  // Vendor Profile State
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Assign Technician Sub-modal State
  const [assigningReqId, setAssigningReqId] = useState<string | null>(null);

  useEffect(() => {
    loadTeam();
    loadProfile();
  }, []);

  const loadTeam = async () => {
    setLoadingTeam(true);
    try {
      const list = await fetchVendorTeam();
      setTeamMembers(list);
    } catch (err) {
      console.warn('Failed to load team:', err);
    } finally {
      setLoadingTeam(false);
    }
  };

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const prof = await fetchCurrentUserProfile();
      if (prof) {
        setVendorProfile(prof);
        if (prof.availability !== undefined) {
          setOnlineStatus(prof.availability);
        }
      }
    } catch (err) {
      console.warn('Failed to load vendor profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleToggleOnline = async () => {
    const nextStatus = !onlineStatus;
    setOnlineStatus(nextStatus);
    try {
      if (vendorProfile?.id || vendorProfile?._id) {
        await updateVendorAvailability(vendorProfile.id || vendorProfile._id, nextStatus);
      }
    } catch (err) {
      console.warn('Failed to update availability on server:', err);
    }
  };

  const handleCreateTeamMember = async () => {
    if (!newMemberName.trim() || !newMemberPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter technician name and phone number.');
      return;
    }

    setAddingMember(true);
    try {
      await createTeamMember({
        name: newMemberName,
        phone: newMemberPhone,
        designation: newMemberDesignation,
      });
      setAddingMember(false);
      setAddMemberModalVisible(false);
      setNewMemberName('');
      setNewMemberPhone('');
      Alert.alert('Technician Added', 'Team member registered successfully.');
      loadTeam();
    } catch (err: any) {
      setAddingMember(false);
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Could not add team member.');
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    try {
      await deleteTeamMember(id);
      Alert.alert('Removed', `${name} removed from team.`);
      loadTeam();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Could not delete member.');
    }
  };

  const handleAssignMember = async (reqId: string, memberId: string) => {
    try {
      await assignTeamMemberToRequest(reqId, memberId);
      setAssigningReqId(null);
      Alert.alert('Assigned', 'Technician dispatched to service request.');
      onUpdateStatus(reqId, 'ASSIGNED');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Assignment failed.');
    }
  };

  const handleSkipRequest = async (reqId: string) => {
    try {
      await rejectServiceRequest(reqId, 'Vendor passed on open broadcast');
      Alert.alert('Passed', 'Request passed.');
      onUpdateStatus(reqId, 'REJECTED');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to skip request.');
    }
  };

  // Open Broadcast Jobs (requests pending)
  const openBroadcastRequests = requests.filter((r) => r.status === 'PENDING');
  // Vendor Active / In Progress Jobs
  const myActiveJobs = requests.filter(
    (r) => r.status === 'ACCEPTED' || r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS'
  );
  // Completed Jobs
  const completedJobs = requests.filter((r) => r.status === 'COMPLETED');

  return (
    <View style={styles.container}>
      {/* Vendor Status Header */}
      <View style={[styles.vendorStatusBanner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.statusDot, { backgroundColor: onlineStatus ? theme.colors.success : theme.colors.neutral }]} />
          <View>
            <Text style={[styles.vendorTitle, { color: theme.colors.textPrimary }]}>
              ⚡ {vendorProfile?.businessName || 'SparkFix Electricals'}
            </Text>
            <Text style={[styles.vendorSubText, { color: theme.colors.textSecondary }]}>
              {onlineStatus ? 'Online • Accepting New Service Requests' : 'Offline • Not Accepting Requests'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.toggleBtn,
            { backgroundColor: onlineStatus ? theme.colors.successSubtle : theme.colors.neutralSubtle },
          ]}
          onPress={handleToggleOnline}
        >
          <Text style={{ fontWeight: '700', fontSize: 12, color: onlineStatus ? theme.colors.success : theme.colors.neutral }}>
            {onlineStatus ? 'GO OFFLINE' : 'GO ONLINE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sub Navigation Bar */}
      <View style={[styles.subNavBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {[
          { id: 'BROADCAST', label: `📡 Open Job Feed (${openBroadcastRequests.length})` },
          { id: 'MY_JOBS', label: `🛠️ Active Jobs (${myActiveJobs.length})` },
          { id: 'TEAM', label: `👥 Team (${teamMembers.length})` },
          { id: 'PROFILE', label: '⚙️ Business Profile' },
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
        {/* ==================== TAB 1: OPEN JOB BROADCAST ==================== */}
        {activeTab === 'BROADCAST' && (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginBottom: 12 }]}>
              📡 Live Nearby Service Requests (First Accept Wins)
            </Text>

            {openBroadcastRequests.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.colors.surfaceAlt }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🎉</Text>
                <Text style={[styles.emptyText, { color: theme.colors.textPrimary }]}>
                  All available jobs in your area have been claimed!
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                  Stay online to receive instant notifications when new customers book.
                </Text>
              </View>
            ) : (
              openBroadcastRequests.map((req) => (
                <View
                  key={req._id || req.id}
                  style={[
                    styles.jobCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => onOpenRequestDetail && onOpenRequestDetail(req._id || req.id)}
                  >
                    <View style={styles.jobHeader}>
                      <View>
                        <Text style={[styles.reqNumber, { color: theme.colors.textPrimary }]}>
                          {req.requestNumber} • {req.categoryId?.name || req.categoryName || 'Service Repair'}
                        </Text>
                        <View style={styles.priorityBadge}>
                          <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 11 }}>
                            ⚡ {req.priority || 'MEDIUM'} PRIORITY
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.jobAmount, { color: theme.colors.primary }]}>₹{req.amount || 499}</Text>
                    </View>

                    <Text style={[styles.jobDesc, { color: theme.colors.textPrimary }]}>{req.description}</Text>
                    <Text style={[styles.jobAddress, { color: theme.colors.textSecondary }]}>
                      📍 {req.serviceAddress}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.acceptBtn, { backgroundColor: theme.colors.success }]}
                      onPress={() => {
                        onAcceptRequest(req._id || req.id);
                        Alert.alert('Job Claimed!', `You have accepted job ${req.requestNumber}`);
                      }}
                    >
                      <Text style={styles.acceptBtnText}>ACCEPT JOB & CLAIM</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.rejectBtn, { backgroundColor: theme.colors.surfaceAlt }]}
                      onPress={() => handleSkipRequest(req._id || req.id)}
                    >
                      <Text style={{ color: theme.colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                        SKIP
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.detailBtn, { borderColor: theme.colors.border }]}
                      onPress={() => onOpenRequestDetail && onOpenRequestDetail(req._id || req.id)}
                    >
                      <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 12 }}>
                        Details & Timeline
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ==================== TAB 2: MY ACTIVE JOBS ==================== */}
        {activeTab === 'MY_JOBS' && (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginBottom: 12 }]}>
              🛠️ Ongoing Work & Dispatched Orders
            </Text>

            {myActiveJobs.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.colors.surfaceAlt }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>☕</Text>
                <Text style={[styles.emptyText, { color: theme.colors.textPrimary }]}>
                  You have no active ongoing jobs.
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                  Check the Open Job Feed tab to accept new customer requests!
                </Text>
              </View>
            ) : (
              myActiveJobs.map((req) => (
                <View
                  key={req._id || req.id}
                  style={[
                    styles.jobCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => onOpenRequestDetail && onOpenRequestDetail(req._id || req.id)}
                  >
                    <View style={styles.jobHeader}>
                      <View>
                        <Text style={[styles.reqNumber, { color: theme.colors.textPrimary }]}>
                          {req.requestNumber} • {req.categoryId?.name || req.categoryName || 'Service Request'}
                        </Text>
                        <View style={[styles.statusChip, { backgroundColor: theme.colors.primarySubtle }]}>
                          <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 11 }}>
                            {req.status}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.jobAmount, { color: theme.colors.primary }]}>₹{req.amount || 499}</Text>
                    </View>

                    <Text style={[styles.jobDesc, { color: theme.colors.textPrimary }]}>{req.description}</Text>
                    <Text style={[styles.jobAddress, { color: theme.colors.textSecondary }]}>
                      📍 {req.serviceAddress}
                    </Text>
                  </TouchableOpacity>

                  {/* Technician Assignment Sub-Selector */}
                  {assigningReqId === (req._id || req.id) && (
                    <View style={[styles.assignBox, { backgroundColor: theme.colors.surfaceAlt }]}>
                      <Text style={{ fontWeight: '700', fontSize: 12, marginBottom: 6, color: theme.colors.textPrimary }}>
                        Select Team Technician to Dispatch:
                      </Text>
                      {teamMembers.length === 0 ? (
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 6 }}>
                          No team members registered yet. Add one in the "Team" tab!
                        </Text>
                      ) : (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {teamMembers.map((m) => (
                            <TouchableOpacity
                              key={m.id || m._id}
                              style={[styles.memberChip, { backgroundColor: theme.colors.primarySubtle }]}
                              onPress={() => handleAssignMember(req._id || req.id, m.id || m._id)}
                            >
                              <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 12 }}>
                                👨‍🔧 {m.name} ({m.designation})
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      <TouchableOpacity
                        style={{ marginTop: 8 }}
                        onPress={() => setAssigningReqId(null)}
                      >
                        <Text style={{ color: theme.colors.textTertiary, fontSize: 11, fontWeight: '700' }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.actionRow}>
                    {(req.status === 'ACCEPTED' || req.status === 'ASSIGNED') && (
                      <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: theme.colors.info }]}
                        onPress={() => onUpdateStatus(req._id || req.id, 'IN_PROGRESS')}
                      >
                        <Text style={styles.statusBtnText}>▶ START WORK (On Site)</Text>
                      </TouchableOpacity>
                    )}

                    {req.status === 'IN_PROGRESS' && (
                      <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: theme.colors.success }]}
                        onPress={() => onUpdateStatus(req._id || req.id, 'COMPLETED')}
                      >
                        <Text style={styles.statusBtnText}>✓ MARK COMPLETED</Text>
                      </TouchableOpacity>
                    )}

                    {req.status === 'ACCEPTED' && (
                      <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border, borderWidth: 1 }]}
                        onPress={() => setAssigningReqId(req._id || req.id)}
                      >
                        <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 12 }}>
                          👥 Assign Technician
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.detailBtn, { borderColor: theme.colors.border }]}
                      onPress={() => onOpenRequestDetail && onOpenRequestDetail(req._id || req.id)}
                    >
                      <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 12 }}>Timeline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ==================== TAB 3: TEAM ==================== */}
        {activeTab === 'TEAM' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                👥 Team Technicians & Dispatch ({teamMembers.length})
              </Text>
              <TouchableOpacity
                style={[styles.addTeamBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setAddMemberModalVisible(true)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>+ Add Technician</Text>
              </TouchableOpacity>
            </View>

            {loadingTeam ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 20 }} />
            ) : teamMembers.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.colors.surfaceAlt }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
                <Text style={[styles.emptyText, { color: theme.colors.textPrimary }]}>No technicians added yet.</Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                  Add your technicians so you can assign jobs directly to your staff.
                </Text>
              </View>
            ) : (
              teamMembers.map((m) => (
                <View
                  key={m.id || m._id}
                  style={[
                    styles.teamCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.avatarText}>{m.name ? m.name[0] : 'T'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.teamName, { color: theme.colors.textPrimary }]}>{m.name}</Text>
                    <Text style={[styles.teamRole, { color: theme.colors.textSecondary }]}>
                      {m.designation || 'Technician'} • 📞 {m.phone}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: theme.colors.successSubtle }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.success }}>
                      {m.status || 'ACTIVE'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{ marginLeft: 10, padding: 6 }}
                    onPress={() => handleDeleteMember(m.id || m._id, m.name)}
                  >
                    <Text style={{ color: '#EF4444', fontSize: 14 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* ==================== TAB 4: PROFILE ==================== */}
        {activeTab === 'PROFILE' && (
          <View>
            <View style={[styles.profileCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={[styles.largeAvatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.largeAvatarText}>
                  {vendorProfile?.businessName ? vendorProfile.businessName[0] : 'V'}
                </Text>
              </View>

              <Text style={[styles.profileName, { color: theme.colors.textPrimary }]}>
                {vendorProfile?.businessName || 'SparkFix Electricals'}
              </Text>
              <Text style={[styles.profileEmail, { color: theme.colors.textSecondary }]}>
                {vendorProfile?.email || 'vendor@fixora.com'}
              </Text>

              <View style={styles.approvalBadge}>
                <Text style={{ color: '#16A34A', fontWeight: '800', fontSize: 12 }}>
                  {vendorProfile?.approvalStatus === 'APPROVED' ? 'VERIFIED & APPROVED PROVIDER' : 'APPROVAL: ' + (vendorProfile?.approvalStatus || 'APPROVED')}
                </Text>
              </View>

              <View style={[styles.infoRow, { borderColor: theme.colors.border }]}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Owner / Contact:</Text>
                <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
                  {vendorProfile?.ownerName || 'David Miller'}
                </Text>
              </View>

              <View style={[styles.infoRow, { borderColor: theme.colors.border }]}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Phone Number:</Text>
                <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
                  {vendorProfile?.phone || '+1 (800) 555-0199'}
                </Text>
              </View>

              <View style={[styles.infoRow, { borderColor: theme.colors.border }]}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Address:</Text>
                <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
                  {vendorProfile?.address || '102 Industrial Way'}
                </Text>
              </View>

              <View style={[styles.infoRow, { borderColor: theme.colors.border }]}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Service Rating:</Text>
                <Text style={{ fontWeight: '800', color: '#D97706' }}>
                  {vendorProfile?.averageRating || 4.9} ★ ({vendorProfile?.totalReviews || 42} Reviews)
                </Text>
              </View>

              <View style={[styles.infoRow, { borderColor: theme.colors.border }]}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Availability Status:</Text>
                <Text style={{ color: onlineStatus ? theme.colors.success : theme.colors.neutral, fontWeight: '700' }}>
                  {onlineStatus ? 'Online (Accepting Jobs)' : 'Offline (Paused)'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Technician Modal */}
      <Modal visible={addMemberModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>+ Add Team Technician</Text>

            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Technician Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder="e.g. Alex Johnson"
              placeholderTextColor={theme.colors.textDisabled}
              value={newMemberName}
              onChangeText={setNewMemberName}
            />

            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Phone Number *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder="+1 (555) 345-6789"
              placeholderTextColor={theme.colors.textDisabled}
              value={newMemberPhone}
              onChangeText={setNewMemberPhone}
            />

            <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Role / Designation</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder="e.g. Master Electrician / Junior Tech"
              placeholderTextColor={theme.colors.textDisabled}
              value={newMemberDesignation}
              onChangeText={setNewMemberDesignation}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.colors.primary, flex: 1 }]}
                onPress={handleCreateTeamMember}
                disabled={addingMember}
              >
                <Text style={styles.submitBtnText}>{addingMember ? 'Adding...' : 'Add Technician'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setAddMemberModalVisible(false)}
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
  vendorStatusBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  vendorTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  vendorSubText: {
    fontSize: 12,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
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
  jobCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reqNumber: {
    fontSize: 14,
    fontWeight: '800',
  },
  priorityBadge: {
    marginTop: 4,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  jobAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  jobDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  jobAddress: {
    fontSize: 12,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  acceptBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  rejectBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  detailBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  statusBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  assignBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  memberChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  addTeamBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '700',
  },
  teamRole: {
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  profileCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  largeAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  largeAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    marginBottom: 10,
  },
  approvalBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
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
