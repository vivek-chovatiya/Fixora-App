import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useTheme } from '@/shared/theme';
import { fetchRequestDetails, rejectServiceRequest, submitReview } from '@/shared/services/api/FixoraApiClient';

interface RequestDetailModalProps {
  visible: boolean;
  requestId: string | null;
  currentUserRole: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
  onClose: () => void;
  onRefresh: () => void;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  visible,
  requestId,
  currentUserRole,
  onClose,
  onRefresh,
}) => {
  const theme = useTheme();

  const [request, setRequest] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Review Sub-Modal State
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Reject / Note State
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    if (visible && requestId) {
      loadDetails(requestId);
    } else {
      setRequest(null);
      setTimeline([]);
      setShowReviewForm(false);
      setShowRejectForm(false);
    }
  }, [visible, requestId]);

  const loadDetails = async (id: string) => {
    setLoading(true);
    try {
      const data = await fetchRequestDetails(id);
      setRequest(data);
      setTimeline(data?.timeline || []);
    } catch (err) {
      console.warn('Failed to load request details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async () => {
    if (!requestId) return;
    setReviewSubmitting(true);
    try {
      await submitReview({
        serviceRequestId: requestId,
        rating,
        comment: reviewComment,
      });
      setReviewSubmitting(false);
      setShowReviewForm(false);
      Alert.alert('Thank You!', 'Your rating & review have been posted.');
      onRefresh();
      loadDetails(requestId);
    } catch (err: any) {
      setReviewSubmitting(false);
      Alert.alert('Review Failed', err?.response?.data?.message || err.message || 'Could not post review.');
    }
  };

  const handleReject = async () => {
    if (!requestId) return;
    try {
      await rejectServiceRequest(requestId, rejectReason || 'Vendor unavailable/passed');
      setShowRejectForm(false);
      Alert.alert('Request Updated', 'Service request has been rejected/skipped.');
      onRefresh();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Action failed.');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                {request?.requestNumber || 'Service Request Details'}
              </Text>
              <Text style={[styles.subTitle, { color: theme.colors.textSecondary }]}>
                Category: {request?.categoryId?.name || 'Home Maintenance'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 18, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : request ? (
            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
              {/* Status and Priority Row */}
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        request.status === 'COMPLETED'
                          ? theme.colors.successSubtle
                          : request.status === 'IN_PROGRESS'
                          ? theme.colors.infoSubtle
                          : request.status === 'REJECTED'
                          ? '#FEE2E2'
                          : theme.colors.warningSubtle,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontWeight: '800',
                      fontSize: 12,
                      color:
                        request.status === 'COMPLETED'
                          ? theme.colors.success
                          : request.status === 'IN_PROGRESS'
                          ? theme.colors.info
                          : request.status === 'REJECTED'
                          ? '#DC2626'
                          : theme.colors.warning,
                    }}
                  >
                    STATUS: {request.status}
                  </Text>
                </View>

                <View style={[styles.priorityBadge, { backgroundColor: theme.colors.surfaceAlt }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textPrimary }}>
                    ⚡ {request.priority || 'MEDIUM'} PRIORITY
                  </Text>
                </View>

                <View style={{ marginLeft: 'auto' }}>
                  <Text style={[styles.amountText, { color: theme.colors.primary }]}>₹{request.amount || 499}</Text>
                </View>
              </View>

              {/* Description */}
              <View style={[styles.infoSection, { borderColor: theme.colors.border }]}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textSecondary }]}>DESCRIPTION OF WORK</Text>
                <Text style={[styles.descText, { color: theme.colors.textPrimary }]}>{request.description}</Text>
              </View>

              {/* Address */}
              <View style={[styles.infoSection, { borderColor: theme.colors.border }]}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textSecondary }]}>SERVICE LOCATION</Text>
                <Text style={[styles.descText, { color: theme.colors.textPrimary }]}>📍 {request.serviceAddress}</Text>
              </View>

              {/* Assigned Vendor / Technician */}
              <View style={[styles.infoSection, { borderColor: theme.colors.border }]}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textSecondary }]}>ASSIGNED PROVIDER</Text>
                <Text style={[styles.descText, { color: theme.colors.textPrimary }]}>
                  {request.vendorId?.businessName || (request.vendorId ? 'Assigned Verified Vendor' : 'Awaiting Vendor Claim (Open Broadcast)')}
                </Text>
                {request.assignedTeamMemberId ? (
                  <Text style={{ fontSize: 12, color: theme.colors.info, marginTop: 4, fontWeight: '600' }}>
                    👨‍🔧 Technician: {request.assignedTeamMemberId.name || 'Staff Member'} ({request.assignedTeamMemberId.designation || 'Specialist'})
                  </Text>
                ) : null}
              </View>

              {/* Visual Lifecycle Timeline */}
              <View style={[styles.infoSection, { borderColor: theme.colors.border }]}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textSecondary }]}>📜 AUDIT LIFECYCLE TIMELINE</Text>
                {timeline.length === 0 ? (
                  <Text style={{ color: theme.colors.textTertiary, fontSize: 12, fontStyle: 'italic' }}>
                    No recorded timeline events.
                  </Text>
                ) : (
                  <View style={styles.timelineList}>
                    {timeline.map((event, idx) => (
                      <View key={event._id || idx} style={styles.timelineItem}>
                        <View style={styles.timelineBullet}>
                          <View style={[styles.bulletDot, { backgroundColor: theme.colors.primary }]} />
                          {idx < timeline.length - 1 && <View style={[styles.bulletLine, { backgroundColor: theme.colors.border }]} />}
                        </View>
                        <View style={styles.timelineContent}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.timelineStatus, { color: theme.colors.textPrimary }]}>
                              {event.status}
                            </Text>
                            <Text style={[styles.timelineDate, { color: theme.colors.textTertiary }]}>
                              {new Date(event.createdAt || event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                          <Text style={[styles.timelineNote, { color: theme.colors.textSecondary }]}>
                            {event.note || `Status updated by ${event.userRole}`}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Customer Rating Section if completed */}
              {request.status === 'COMPLETED' && (
                <View style={[styles.reviewSection, { backgroundColor: theme.colors.surfaceAlt }]}>
                  {!showReviewForm ? (
                    <TouchableOpacity
                      style={[styles.reviewBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={() => setShowReviewForm(true)}
                    >
                      <Text style={styles.reviewBtnText}>★ Rate & Review Service</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.reviewForm}>
                      <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                        ⭐ Rate Your Service Experience
                      </Text>
                      {/* Star Rating Selector */}
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity key={star} onPress={() => setRating(star)} style={{ padding: 4 }}>
                            <Text style={{ fontSize: 26, color: star <= rating ? '#F59E0B' : '#CBD5E1' }}>★</Text>
                          </TouchableOpacity>
                        ))}
                        <Text style={{ marginLeft: 8, fontWeight: '700', color: '#F59E0B', fontSize: 16 }}>
                          {rating} / 5
                        </Text>
                      </View>

                      <TextInput
                        style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                        placeholder="Write a review about quality, punctuality and service..."
                        placeholderTextColor={theme.colors.textDisabled}
                        value={reviewComment}
                        onChangeText={setReviewComment}
                        multiline
                        numberOfLines={3}
                      />

                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                        <TouchableOpacity
                          style={[styles.reviewBtn, { flex: 1, backgroundColor: theme.colors.success }]}
                          onPress={handleReviewSubmit}
                          disabled={reviewSubmitting}
                        >
                          <Text style={styles.reviewBtnText}>{reviewSubmitting ? 'Submitting...' : 'Post Review'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.reviewBtn, { backgroundColor: theme.colors.border, paddingHorizontal: 16 }]}
                          onPress={() => setShowReviewForm(false)}
                        >
                          <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Reject / Skip prompt for vendor */}
              {currentUserRole === 'VENDOR' && request.status === 'PENDING' && (
                <View style={{ marginTop: 12 }}>
                  {!showRejectForm ? (
                    <TouchableOpacity
                      style={[styles.rejectBtn, { borderColor: '#EF4444' }]}
                      onPress={() => setShowRejectForm(true)}
                    >
                      <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>✕ Pass / Reject Request</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.rejectBox, { backgroundColor: '#FEE2E2' }]}>
                      <Text style={{ color: '#991B1B', fontWeight: '700', marginBottom: 6 }}>Reason for skipping:</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: '#FFFFFF', color: '#0F172A', borderColor: '#FCA5A5' }]}
                        placeholder="e.g. Beyond service radius, unavailable schedule"
                        value={rejectReason}
                        onChangeText={setRejectReason}
                      />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={[styles.confirmRejectBtn, { backgroundColor: '#DC2626' }]} onPress={handleReject}>
                          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Confirm Pass</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.confirmRejectBtn, { backgroundColor: '#94A3B8' }]} onPress={() => setShowRejectForm(false)}>
                          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.centerBox}>
              <Text style={{ color: theme.colors.textSecondary }}>Could not load request details.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subTitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  amountText: {
    fontSize: 20,
    fontWeight: '800',
  },
  infoSection: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  descText: {
    fontSize: 14,
    lineHeight: 20,
  },
  timelineList: {
    marginTop: 8,
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  timelineBullet: {
    width: 20,
    alignItems: 'center',
  },
  bulletDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  bulletLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 8,
  },
  timelineStatus: {
    fontWeight: '700',
    fontSize: 13,
  },
  timelineDate: {
    fontSize: 11,
  },
  timelineNote: {
    fontSize: 12,
    marginTop: 2,
  },
  reviewSection: {
    padding: 16,
    borderRadius: 12,
    marginTop: 14,
  },
  reviewBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  reviewForm: {
    gap: 8,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
  },
  rejectBtn: {
    borderWidth: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectBox: {
    padding: 12,
    borderRadius: 8,
  },
  confirmRejectBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
});
