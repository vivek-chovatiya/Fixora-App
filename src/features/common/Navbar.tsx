import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/shared/theme';

export type UserRole = 'CUSTOMER' | 'VENDOR' | 'ADMIN';

interface NavbarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  currentUser: any;
  onOpenAuth: () => void;
  onOpenCreateRequest: () => void;
  onOpenNotifications?: () => void;
  unreadNotifCount?: number;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  currentUser,
  onOpenAuth,
  onOpenCreateRequest,
  onOpenNotifications,
  unreadNotifCount = 0,
  onLogout,
}) => {
  const theme = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      {/* Brand Logo & Name */}
      <View style={styles.brandContainer}>
        <View style={[styles.logoBadge, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.logoText}>F</Text>
        </View>
        <View>
          <Text style={[styles.brandName, { color: theme.colors.textPrimary }]}>Fixora</Text>
          <Text style={[styles.brandTag, { color: theme.colors.textSecondary }]}>Marketplace Platform</Text>
        </View>
      </View>

      {/* Role Switcher Pill */}
      <View style={[styles.rolePillContainer, { backgroundColor: theme.colors.surfaceAlt }]}>
        <TouchableOpacity
          style={[
            styles.roleTab,
            currentRole === 'CUSTOMER' && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => onRoleChange('CUSTOMER')}
        >
          <Text
            style={[
              styles.roleTabText,
              { color: currentRole === 'CUSTOMER' ? '#FFFFFF' : theme.colors.textSecondary },
            ]}
          >
            Customer View
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.roleTab,
            currentRole === 'VENDOR' && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => onRoleChange('VENDOR')}
        >
          <Text
            style={[
              styles.roleTabText,
              { color: currentRole === 'VENDOR' ? '#FFFFFF' : theme.colors.textSecondary },
            ]}
          >
            Vendor View
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.roleTab,
            currentRole === 'ADMIN' && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => onRoleChange('ADMIN')}
        >
          <Text
            style={[
              styles.roleTabText,
              { color: currentRole === 'ADMIN' ? '#FFFFFF' : theme.colors.textSecondary },
            ]}
          >
            Admin View
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Notification Bell */}
        {onOpenNotifications && (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
            onPress={onOpenNotifications}
          >
            <Text style={{ fontSize: 16 }}>🔔</Text>
            {unreadNotifCount > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.colors.danger }]}>
                <Text style={styles.badgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {currentRole === 'CUSTOMER' && (
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: theme.colors.primary }]}
            onPress={onOpenCreateRequest}
          >
            <Text style={styles.btnPrimaryText}>+ Book Service</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.btnOutline, { borderColor: theme.colors.border }]}
          onPress={onOpenAuth}
        >
          <Text style={[styles.btnOutlineText, { color: theme.colors.textPrimary }]}>
            {currentUser ? `👤 ${currentUser.name || currentUser.email || 'Account'}` : '🔑 Sign In'}
          </Text>
        </TouchableOpacity>

        {currentUser && onLogout && (
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
            onPress={onLogout}
          >
            <Text style={{ color: theme.colors.textSecondary, fontWeight: '700', fontSize: 12 }}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
    gap: 12,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 22,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brandTag: {
    fontSize: 11,
    fontWeight: '500',
  },
  rolePillContainer: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    gap: 2,
  },
  roleTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  roleTabText: {
    fontWeight: '700',
    fontSize: 13,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  btnPrimary: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnOutline: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnOutlineText: {
    fontWeight: '700',
    fontSize: 13,
  },
  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
