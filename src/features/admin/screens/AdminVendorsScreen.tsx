import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, TextInput, View } from 'react-native';

import type { AdminTabParamList } from '@/app/navigation/types';
import { ADMIN_CONTENT_MAX_WIDTH, VENDOR_REJECTION_REASONS } from '@/features/admin/constants';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Icon,
  InfoRow,
  Loader,
  Row,
  ScreenLoader,
  Text,
  useDialog,
  useToast,
} from '@/shared/components';
import { usePaginatedQuery } from '@/shared/hooks/usePaginatedQuery';
import { useRefreshOnFocus } from '@/shared/hooks/useRefreshOnFocus';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { vendorApi } from '@/shared/services/api';
import { fontFor, useTheme, type ColorTone } from '@/shared/theme';
import { AppError } from '@/shared/types/error';
import type { ApprovalStatus, VendorProfile } from '@/shared/types/models';
import { formatDate, formatPhone } from '@/shared/utils/format';

type Props = BottomTabScreenProps<AdminTabParamList, 'AdminVendors'>;

const FILTERS: { value: ApprovalStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];
const TONE: Record<ApprovalStatus, ColorTone> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' };
const LABEL: Record<ApprovalStatus, string> = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' };
const SEARCH_DEBOUNCE_MS = 350;

export function AdminVendorsScreen({ route }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { confirm, choose } = useDialog();
  const { breakpoint } = useResponsive();
  const columns = breakpoint === 'lg' || breakpoint === 'xl' ? 2 : 1;
  const [filter, setFilter] = useState<ApprovalStatus>(route.params?.status ?? 'PENDING');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const query = usePaginatedQuery(request => vendorApi.adminList(filter, request, search), [filter, search]);
  useRefreshOnFocus(query.refresh);

  // Dashboard tiles deep-link into a specific list.
  useEffect(() => {
    if (route.params?.status) setFilter(route.params.status);
  }, [route.params?.status]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const decide = async (vendor: VendorProfile, status: ApprovalStatus) => {
    let note = '';
    if (status === 'REJECTED') {
      const reason = await choose(
        vendor.approvalStatus === 'APPROVED' ? `Suspend ${vendor.businessName}?` : `Reject ${vendor.businessName}?`,
        VENDOR_REJECTION_REASONS.map(r => ({ value: r, label: r })),
        'Choose a reason. The provider will see it.',
      );
      if (!reason) return;
      note = reason;
    } else if (!(await confirm({ title: `Approve ${vendor.businessName}?`, message: 'They will start receiving requests immediately.', confirmLabel: 'Approve' }))) {
      return;
    }
    setBusyId(vendor.id);
    try {
      await vendorApi.setApproval(vendor.id, status, note);
      toast.show(status === 'APPROVED' ? 'Provider approved.' : 'Provider rejected.', 'info');
      query.refresh();
    } catch (caught) {
      toast.show(AppError.from(caught).userMessage, 'danger');
    } finally {
      setBusyId(null);
    }
  };

  const renderVendor = ({ item }: { item: VendorProfile }) => (
    <View style={{ flex: 1 / columns, padding: theme.spacing.xs }}>
      <Card testID={`admin-vendor-${item.businessName}`} style={{ flex: 1 }}>
        <View style={{ gap: theme.spacing.md, flex: 1 }}>
          <Row gap="md" style={{ alignItems: 'flex-start' }}>
            <Avatar name={item.businessName} uri={item.profileImage} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {item.businessName}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {item.ownerName} · Joined {formatDate(item.createdAt)}
              </Text>
            </View>
            <Badge label={LABEL[item.approvalStatus]} tone={TONE[item.approvalStatus]} />
          </Row>

          <View style={{ gap: theme.spacing.sm }}>
            <InfoRow icon="categories" label="Services" value={item.categories.map(c => c.name).join(', ') || '—'} />
            <InfoRow icon="phone" label="Contact" value={`${formatPhone(item.phone)} · ${item.email}`} />
            <InfoRow icon="location" label="Shop address" value={item.address || '—'} />
            {item.workingAreas.length ? <InfoRow icon="business" label="Working areas" value={item.workingAreas.join(', ')} /> : null}
            {item.workingHours ? <InfoRow icon="pending" label="Working hours" value={item.workingHours} /> : null}
            {item.description ? <InfoRow icon="about" label="About" value={item.description} /> : null}
            {item.approvalStatus === 'REJECTED' && item.approvalNote ? <InfoRow icon="info" label="Rejection reason" value={item.approvalNote} /> : null}
          </View>

          <View style={{ flex: 1 }} />
          <Row gap="sm">
            {item.approvalStatus !== 'REJECTED' ? (
              <Button
                variant="danger"
                size="sm"
                label={item.approvalStatus === 'APPROVED' ? 'Suspend' : 'Reject'}
                onPress={() => decide(item, 'REJECTED')}
                disabled={busyId === item.id}
                style={{ flex: 1 }}
              />
            ) : null}
            {item.approvalStatus !== 'APPROVED' ? (
              <Button
                testID={`admin-approve-${item.businessName}`}
                size="sm"
                label="Approve"
                onPress={() => decide(item, 'APPROVED')}
                loading={busyId === item.id}
                style={{ flex: 1 }}
              />
            ) : null}
          </Row>
        </View>
      </Card>
    </View>
  );

  return (
    <View testID="admin-vendors" style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ width: '100%', maxWidth: ADMIN_CONTENT_MAX_WIDTH, alignSelf: 'center', flex: 1 }}>
        <View style={{ paddingTop: theme.spacing.lg, paddingHorizontal: theme.screenPadding, gap: theme.spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              height: 44,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            }}>
            <Icon name="search" size="sm" color="textTertiary" />
            <TextInput
              testID="admin-vendor-search"
              accessibilityLabel="Search providers"
              placeholder="Search by business, owner, phone or email"
              placeholderTextColor={theme.colors.textTertiary}
              value={searchInput}
              onChangeText={setSearchInput}
              autoCapitalize="none"
              style={[{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.fontSize.md, paddingVertical: 0, outlineStyle: 'none' } as object, fontFor('regular')]}
            />
          </View>
          <ChipGroup options={FILTERS} value={filter} onChange={setFilter} scroll inset={0} testIDPrefix="admin-vendor-filter" />
        </View>
        {query.isLoading ? (
          <ScreenLoader />
        ) : query.error && !query.items.length ? (
          <ErrorState error={query.error} onRetry={query.retry} />
        ) : (
          <FlatList
            key={`cols-${columns}`}
            data={query.items}
            numColumns={columns}
            keyExtractor={v => v.id}
            contentContainerStyle={{ padding: theme.screenPadding - theme.spacing.xs, paddingBottom: theme.spacing.huge, flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={query.isRefreshing} onRefresh={query.refresh} tintColor={theme.colors.primary} />}
            onEndReached={query.loadMore}
            ListFooterComponent={query.isLoadingMore ? <Loader /> : null}
            ListEmptyComponent={
              <EmptyState
                icon="team"
                title={search ? 'No providers match your search.' : `No ${LABEL[filter].toLowerCase()} providers.`}
                message={filter === 'PENDING' && !search ? 'New registrations will appear here for review.' : undefined}
              />
            }
            renderItem={renderVendor}
          />
        )}
      </View>
    </View>
  );
}
