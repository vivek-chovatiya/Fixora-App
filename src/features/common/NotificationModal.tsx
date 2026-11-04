import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '@/shared/theme';
import { fetchNotifications, markNotificationAsRead } from '@/shared/services/api/FixoraApiClient';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectRequest?: (requestId: string) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
  onSelectRequest,
}) => {
  const theme = useTheme();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const items = await fetchNotifications();
      setNotifications(items);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible]);

  const handleMarkRead = async (id: string, refId?: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id || n._id === id ? { ...n, isRead: true } : n))
      );
      if (refId && onSelectRequest) {
        onClose();
        onSelectRequest(refId);
      }
    } catch (err) {
      console.warn('markRead error:', err);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>🔔</Text>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Notifications</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 18, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🔕</Text>
              <Text style={[styles.emptyText, { color: theme.colors.textPrimary }]}>No notifications yet.</Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                You will receive alerts here when bookings are created, accepted, or completed.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {notifications.map((item) => (
                <TouchableOpacity
                  key={item.id || item._id}
                  style={[
                    styles.notifItem,
                    {
                      backgroundColor: item.isRead ? theme.colors.surfaceAlt : theme.colors.primarySubtle,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => handleMarkRead(item.id || item._id, item.referenceId)}
                >
                  <View style={styles.notifRow}>
                    <Text style={[styles.notifTitle, { color: theme.colors.textPrimary }]}>{item.title}</Text>
                    {!item.isRead && (
                      <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />
                    )}
                  </View>
                  <Text style={[styles.notifMsg, { color: theme.colors.textSecondary }]}>{item.message}</Text>
                  <Text style={[styles.notifTime, { color: theme.colors.textTertiary }]}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
    maxWidth: 440,
    maxHeight: 520,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontWeight: '700',
    fontSize: 15,
  },
  list: {
    maxHeight: 400,
  },
  notifItem: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  notifRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifTitle: {
    fontWeight: '700',
    fontSize: 13,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notifMsg: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  notifTime: {
    fontSize: 10,
  },
});
