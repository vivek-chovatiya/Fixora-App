import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { useTheme } from '@/shared/theme';
import { fetchCustomerAddresses } from '@/shared/services/api/FixoraApiClient';

interface CreateRequestModalProps {
  visible: boolean;
  onClose: () => void;
  categories: any[];
  subCategories: any[];
  vendors: any[];
  initialVendorId?: string | null;
  onSubmit: (requestData: any) => void;
}

export const CreateRequestModal: React.FC<CreateRequestModalProps> = ({
  visible,
  onClose,
  categories,
  subCategories,
  vendors,
  initialVendorId = null,
  onSubmit,
}) => {
  const theme = useTheme();

  const [selectedCategory, setSelectedCategory] = useState<any>(categories[0] || null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<any>(null);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('742 Evergreen Terrace, Springfield');
  const [priority, setPriority] = useState('MEDIUM');
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      if (initialVendorId) {
        const found = vendors.find((v) => (v.id || v._id) === initialVendorId);
        if (found) setSelectedVendor(found);
      }
      loadSavedAddresses();
    }
  }, [visible, initialVendorId]);

  const loadSavedAddresses = async () => {
    try {
      const addrs = await fetchCustomerAddresses();
      setSavedAddresses(addrs);
      if (addrs.length > 0) {
        const defaultAddr = addrs.find((a: any) => a.isDefault) || addrs[0];
        const formatted = `${defaultAddr.addressLine1}${defaultAddr.addressLine2 ? ', ' + defaultAddr.addressLine2 : ''}, ${defaultAddr.city}, ${defaultAddr.state} - ${defaultAddr.pincode}`;
        setAddress(formatted);
      }
    } catch (err) {
      console.warn('loadSavedAddresses error:', err);
    }
  };

  const activeSubCategories = subCategories.filter(
    (sub) => !selectedCategory || sub.categoryId === (selectedCategory._id || selectedCategory.id)
  );

  const handleSubmit = () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description of the issue.');
      return;
    }

    setLoading(true);

    const payload = {
      categoryId: selectedCategory?.id || selectedCategory?._id || categories[0]?.id || categories[0]?._id,
      subCategoryId: selectedSubCategory?.id || selectedSubCategory?._id || undefined,
      vendorId: selectedVendor?.id || selectedVendor?._id || null,
      description,
      serviceAddress: address,
      priority,
    };

    setTimeout(() => {
      setLoading(false);
      onSubmit(payload);
      onClose();
    }, 400);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>✨ Book a Service Request</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 18, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Category Selector */}
            <Text style={[styles.label, { color: theme.colors.textPrimary }]}>1. Select Service Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat._id || cat.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        (selectedCategory?._id || selectedCategory?.id) === (cat._id || cat.id)
                          ? theme.colors.primary
                          : theme.colors.surfaceAlt,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setSelectedSubCategory(null);
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          (selectedCategory?._id || selectedCategory?.id) === (cat._id || cat.id)
                            ? '#FFFFFF'
                            : theme.colors.textPrimary,
                      },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* SubCategory Selector */}
            {activeSubCategories.length > 0 && (
              <>
                <Text style={[styles.label, { color: theme.colors.textPrimary, marginTop: 12 }]}>
                  2. Service Type
                </Text>
                <View style={styles.gridContainer}>
                  {activeSubCategories.map((sub) => (
                    <TouchableOpacity
                      key={sub._id || sub.id}
                      style={[
                        styles.subCard,
                        {
                          backgroundColor:
                            (selectedSubCategory?._id || selectedSubCategory?.id) === (sub._id || sub.id)
                              ? theme.colors.primarySubtle
                              : theme.colors.surfaceAlt,
                          borderColor:
                            (selectedSubCategory?._id || selectedSubCategory?.id) === (sub._id || sub.id)
                              ? theme.colors.primary
                              : theme.colors.border,
                        },
                      ]}
                      onPress={() => setSelectedSubCategory(sub)}
                    >
                      <Text style={[styles.subCardTitle, { color: theme.colors.textPrimary }]}>{sub.name}</Text>
                      <Text style={[styles.subCardPrice, { color: theme.colors.primary }]}>₹{sub.price}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Issue Description */}
            <Text style={[styles.label, { color: theme.colors.textPrimary, marginTop: 14 }]}>
              3. Issue Description
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.colors.surfaceAlt,
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder="Describe what needs fixing or installation..."
              placeholderTextColor={theme.colors.textDisabled}
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
            />

            {/* Service Address */}
            <Text style={[styles.label, { color: theme.colors.textPrimary, marginTop: 12 }]}>
              4. Service Address
            </Text>

            {/* Quick Pick Saved Addresses */}
            {savedAddresses.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {savedAddresses.map((addr) => {
                  const full = `${addr.addressLine1}${addr.addressLine2 ? ', ' + addr.addressLine2 : ''}, ${addr.city}, ${addr.state} - ${addr.pincode}`;
                  const isSelected = address === full;
                  return (
                    <TouchableOpacity
                      key={addr.id || addr._id}
                      style={[
                        styles.addrChip,
                        {
                          backgroundColor: isSelected ? theme.colors.primarySubtle : theme.colors.surfaceAlt,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                      onPress={() => setAddress(full)}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textPrimary }}>
                        📍 {addr.title || 'Address'} {addr.isDefault ? '(Default)' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surfaceAlt,
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder="Full service address..."
              placeholderTextColor={theme.colors.textDisabled}
              value={address}
              onChangeText={setAddress}
            />

            {/* Priority Picker */}
            <Text style={[styles.label, { color: theme.colors.textPrimary, marginTop: 12 }]}>5. Priority</Text>
            <View style={styles.priorityRow}>
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityBtn,
                    {
                      backgroundColor: priority === p ? theme.colors.primary : theme.colors.surfaceAlt,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: priority === p ? '#FFFFFF' : theme.colors.textSecondary,
                    }}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Vendor Direct Assignment */}
            <Text style={[styles.label, { color: theme.colors.textPrimary, marginTop: 14 }]}>
              6. Preferred Vendor (Optional)
            </Text>
            <TouchableOpacity
              style={[
                styles.vendorSelectBtn,
                {
                  backgroundColor: !selectedVendor ? theme.colors.primarySubtle : theme.colors.surfaceAlt,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => setSelectedVendor(null)}
            >
              <Text style={[styles.vendorSelectText, { color: theme.colors.textPrimary }]}>
                📡 Open Broadcast (First Available Expert Wins)
              </Text>
            </TouchableOpacity>

            {vendors.map((v) => (
              <TouchableOpacity
                key={v._id || v.id}
                style={[
                  styles.vendorSelectBtn,
                  {
                    backgroundColor:
                      (selectedVendor?._id || selectedVendor?.id) === (v._id || v.id)
                        ? theme.colors.primarySubtle
                        : theme.colors.surfaceAlt,
                    borderColor:
                      (selectedVendor?._id || selectedVendor?.id) === (v._id || v.id)
                        ? theme.colors.primary
                        : theme.colors.border,
                  },
                ]}
                onPress={() => setSelectedVendor(v)}
              >
                <Text style={[styles.vendorSelectText, { color: theme.colors.textPrimary }]}>
                  ⭐ {v.businessName} ({v.averageRating}★ - {v.ownerName})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Submit CTA */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitBtnText}>{loading ? 'Creating Request...' : 'Confirm Service Booking'}</Text>
          </TouchableOpacity>
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
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollArea: {
    marginVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  horizontalScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subCard: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: '48%',
    flex: 1,
  },
  subCardTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  subCardPrice: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
  },
  textArea: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    textAlignVertical: 'top',
  },
  addrChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 8,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  vendorSelectBtn: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  vendorSelectText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
