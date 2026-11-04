import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { useTheme } from '@/shared/theme';
import { loginUser, registerCustomer, registerVendor } from '@/shared/services/api/FixoraApiClient';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess: (userData: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onLoginSuccess }) => {
  const theme = useTheme();

  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [registerRole, setRegisterRole] = useState<'CUSTOMER' | 'VENDOR'>('CUSTOMER');

  // Login inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register inputs (Customer)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regPhone, setRegPhone] = useState('');

  // Register inputs (Vendor)
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regDescription, setRegDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (customEmail?: string, customPass?: string) => {
    setErrorMessage('');
    const targetEmail = customEmail || email;
    const targetPass = customPass || password;

    if (!targetEmail || !targetPass) {
      setErrorMessage('Please enter email and password.');
      return;
    }

    const role: 'CUSTOMER' | 'VENDOR' | 'ADMIN' = targetEmail.includes('vendor')
      ? 'VENDOR'
      : targetEmail.includes('admin')
      ? 'ADMIN'
      : 'CUSTOMER';

    setLoading(true);
    try {
      const res = await loginUser({ email: targetEmail, password: targetPass, role });
      setLoading(false);
      const user = res?.data?.user || { email: targetEmail, name: targetEmail.split('@')[0] };
      onLoginSuccess({ ...user, role });
      onClose();
    } catch (err: any) {
      setLoading(false);
      const msg = err?.response?.data?.message || err.message || 'Login failed.';
      setErrorMessage(msg);
    }
  };

  const handleRegister = async () => {
    setErrorMessage('');
    if (!email || !password || !regPhone) {
      setErrorMessage('Please fill in required fields (Email, Password, Phone).');
      return;
    }

    setLoading(true);
    try {
      if (registerRole === 'CUSTOMER') {
        if (!firstName) {
          setErrorMessage('First name is required.');
          setLoading(false);
          return;
        }
        const res = await registerCustomer({
          firstName,
          lastName,
          email,
          phone: regPhone,
          password,
        });
        setLoading(false);
        const user = res?.data?.user || { email, name: firstName };
        Alert.alert('Registration Successful', `Welcome to Fixora, ${firstName}!`);
        onLoginSuccess({ ...user, role: 'CUSTOMER' });
        onClose();
      } else {
        if (!businessName || !ownerName || !regAddress) {
          setErrorMessage('Business name, owner name, and address are required.');
          setLoading(false);
          return;
        }
        const res = await registerVendor({
          businessName,
          ownerName,
          email,
          phone: regPhone,
          password,
          address: regAddress,
          description: regDescription,
        });
        setLoading(false);
        const user = res?.data?.user || { email, name: businessName };
        Alert.alert('Vendor Registered', 'Your provider account is ready!');
        onLoginSuccess({ ...user, role: 'VENDOR' });
        onClose();
      }
    } catch (err: any) {
      setLoading(false);
      const msg = err?.response?.data?.message || err.message || 'Registration failed.';
      setErrorMessage(msg);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              {authMode === 'LOGIN' ? 'Sign In to Fixora' : 'Create New Account'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 18, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Mode Switcher Tabs */}
          <View style={[styles.modeTabs, { backgroundColor: theme.colors.surfaceAlt }]}>
            <TouchableOpacity
              style={[styles.modeTab, authMode === 'LOGIN' && { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                setAuthMode('LOGIN');
                setErrorMessage('');
              }}
            >
              <Text style={[styles.modeTabText, { color: authMode === 'LOGIN' ? '#FFFFFF' : theme.colors.textSecondary }]}>
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, authMode === 'REGISTER' && { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                setAuthMode('REGISTER');
                setErrorMessage('');
              }}
            >
              <Text style={[styles.modeTabText, { color: authMode === 'REGISTER' ? '#FFFFFF' : theme.colors.textSecondary }]}>
                Register (Sign Up)
              </Text>
            </TouchableOpacity>
          </View>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          ) : null}

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {authMode === 'LOGIN' ? (
              <>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                  Select a Quick Demo Account or enter custom credentials below.
                </Text>

                {/* Demo Quick Logins */}
                <View style={styles.demoSection}>
                  <Text style={[styles.demoTitle, { color: theme.colors.textPrimary }]}>⚡ One-Click Demo Accounts:</Text>
                  <View style={styles.demoGrid}>
                    <TouchableOpacity
                      style={[styles.demoBtn, { backgroundColor: theme.colors.primarySubtle }]}
                      onPress={() => handleLogin('customer@fixora.com', 'Password123!')}
                    >
                      <Text style={[styles.demoBtnText, { color: theme.colors.primary }]}>👤 Customer Demo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.demoBtn, { backgroundColor: theme.colors.successSubtle }]}
                      onPress={() => handleLogin('vendor@fixora.com', 'Password123!')}
                    >
                      <Text style={[styles.demoBtnText, { color: theme.colors.success }]}>👨‍🔧 Vendor Demo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.demoBtn, { backgroundColor: theme.colors.warningSubtle }]}
                      onPress={() => handleLogin('admin@fixora.com', 'Password123!')}
                    >
                      <Text style={[styles.demoBtnText, { color: theme.colors.warning }]}>🛡️ Admin Demo</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.divider}>
                  <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
                  <Text style={[styles.dividerText, { color: theme.colors.textTertiary }]}>OR</Text>
                  <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
                </View>

                {/* Form */}
                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Email Address</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                  placeholder="e.g. user@example.com"
                  placeholderTextColor={theme.colors.textDisabled}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />

                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Password</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textDisabled}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => handleLogin()}
                  disabled={loading}
                >
                  <Text style={styles.submitBtnText}>{loading ? 'Signing In...' : 'Sign In'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Registration Role Selector */}
                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>I want to register as:</Text>
                <View style={styles.rolePickerRow}>
                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      registerRole === 'CUSTOMER' && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySubtle },
                      { borderColor: theme.colors.border },
                    ]}
                    onPress={() => setRegisterRole('CUSTOMER')}
                  >
                    <Text style={{ fontSize: 18, marginBottom: 4 }}>👤</Text>
                    <Text style={[styles.roleOptionTitle, { color: theme.colors.textPrimary }]}>Customer</Text>
                    <Text style={[styles.roleOptionSub, { color: theme.colors.textSecondary }]}>Book home services</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      registerRole === 'VENDOR' && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySubtle },
                      { borderColor: theme.colors.border },
                    ]}
                    onPress={() => setRegisterRole('VENDOR')}
                  >
                    <Text style={{ fontSize: 18, marginBottom: 4 }}>👨‍🔧</Text>
                    <Text style={[styles.roleOptionTitle, { color: theme.colors.textPrimary }]}>Service Provider</Text>
                    <Text style={[styles.roleOptionSub, { color: theme.colors.textSecondary }]}>Offer expert repairs</Text>
                  </TouchableOpacity>
                </View>

                {registerRole === 'CUSTOMER' ? (
                  <>
                    <View style={styles.nameRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>First Name *</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                          placeholder="John"
                          placeholderTextColor={theme.colors.textDisabled}
                          value={firstName}
                          onChangeText={setFirstName}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Last Name</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                          placeholder="Doe"
                          placeholderTextColor={theme.colors.textDisabled}
                          value={lastName}
                          onChangeText={setLastName}
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Business / Company Name *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                      placeholder="e.g. Apex Electrical Services"
                      placeholderTextColor={theme.colors.textDisabled}
                      value={businessName}
                      onChangeText={setBusinessName}
                    />

                    <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Owner / Contact Name *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                      placeholder="e.g. Robert Smith"
                      placeholderTextColor={theme.colors.textDisabled}
                      value={ownerName}
                      onChangeText={setOwnerName}
                    />

                    <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Business Address *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                      placeholder="e.g. 102 Market St, Suite 4"
                      placeholderTextColor={theme.colors.textDisabled}
                      value={regAddress}
                      onChangeText={setRegAddress}
                    />

                    <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Short Description / Specialties</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                      placeholder="e.g. Commercial & residential electrical works"
                      placeholderTextColor={theme.colors.textDisabled}
                      value={regDescription}
                      onChangeText={setRegDescription}
                    />
                  </>
                )}

                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Email Address *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                  placeholder="user@example.com"
                  placeholderTextColor={theme.colors.textDisabled}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />

                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Phone Number *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={theme.colors.textDisabled}
                  value={regPhone}
                  onChangeText={setRegPhone}
                />

                <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Password (min 6 chars) *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textDisabled}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  <Text style={styles.submitBtnText}>
                    {loading ? 'Creating Account...' : `Register as ${registerRole === 'CUSTOMER' ? 'Customer' : 'Provider'}`}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
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
    maxWidth: 480,
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
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  modeTabs: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeTabText: {
    fontWeight: '700',
    fontSize: 13,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  demoSection: {
    marginBottom: 12,
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  demoGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  demoBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  demoBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  line: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 5,
    marginTop: 6,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginBottom: 8,
  },
  submitBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  roleOption: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  roleOptionTitle: {
    fontWeight: '700',
    fontSize: 13,
  },
  roleOptionSub: {
    fontSize: 10,
    marginTop: 2,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
