import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useLayoutEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { AdminStackParamList } from '@/app/navigation/types';
import { ADMIN_CONTENT_MAX_WIDTH } from '@/features/admin/constants';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  ListGroup,
  PrimaryButton,
  Row,
  Screen,
  ScreenLoader,
  Text,
  TextField,
  Toggle,
  useDialog,
  useToast,
} from '@/shared/components';
import { useFormErrors } from '@/shared/hooks/useFormErrors';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { catalogApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import { AppError } from '@/shared/types/error';
import type { SubCategory } from '@/shared/types/models';
import { formatCurrency } from '@/shared/utils/format';
import { compact, hasErrors, validators } from '@/shared/utils/validation';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminSubCategories'>;
type Field = 'name' | 'price' | 'duration';
type Editing = { mode: 'create' } | { mode: 'edit'; sub: SubCategory } | null;

const DEFAULT_DURATION_MINUTES = '60';

/** Whole, non-negative numbers only — a typo must never silently become ₹0. */
const parseWholeNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
};

export function AdminSubCategoriesScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { confirm } = useDialog();
  const { category } = route.params;
  const query = useServiceQuery(() => catalogApi.adminSubCategories(category.id), [category.id]);
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState(DEFAULT_DURATION_MINUTES);
  const errors = useFormErrors<Field>();
  const save = useServiceMutation(async () => {
    const payload = {
      name: name.trim(),
      description: description.trim(),
      estimatedPrice: parseWholeNumber(price) ?? 0,
      estimatedDuration: parseWholeNumber(duration) ?? 0,
    };
    return editing?.mode === 'edit'
      ? catalogApi.updateSubCategory({ id: editing.sub.id, ...payload })
      : catalogApi.createSubCategory({ categoryId: category.id, ...payload });
  });

  useLayoutEffect(() => navigation.setOptions({ title: category.name }), [navigation, category.name]);

  const openForm = (next: Editing) => {
    setEditing(next);
    const sub = next?.mode === 'edit' ? next.sub : null;
    setName(sub?.name ?? '');
    setDescription(sub?.description ?? '');
    setPrice(sub?.estimatedPrice ? String(sub.estimatedPrice) : '');
    setDuration(sub ? String(sub.estimatedDuration ?? '') : DEFAULT_DURATION_MINUTES);
    errors.setErrors({});
  };

  const onSave = async () => {
    const next = compact<Field>({
      name: validators.minLength(name, 2, 'Name'),
      price: parseWholeNumber(price) === null ? 'Enter the price in whole rupees, e.g. 299.' : undefined,
      duration: parseWholeNumber(duration) === null ? 'Enter the duration in minutes, e.g. 60.' : undefined,
    });
    errors.setErrors(next);
    if (hasErrors(next)) return;
    if (await save.mutate()) {
      toast.show(editing?.mode === 'edit' ? 'Sub-category updated.' : 'Sub-category created.');
      setEditing(null);
      query.refresh();
    }
  };

  const toggle = async (sub: SubCategory) => {
    try {
      await catalogApi.updateSubCategory({ id: sub.id, isVisible: !sub.isVisible });
      query.refresh();
    } catch (caught) {
      toast.show(AppError.from(caught).userMessage, 'danger');
    }
  };

  const onDelete = async (sub: SubCategory) => {
    const ok = await confirm({
      title: `Delete ${sub.name}?`,
      message: 'Customers will no longer be able to book it. Items with active requests cannot be deleted — hide them instead.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await catalogApi.deleteSubCategory(sub.id);
      toast.show('Sub-category deleted.');
      setEditing(null);
      query.refresh();
    } catch (caught) {
      toast.show(AppError.from(caught).userMessage, 'danger');
    }
  };

  if (query.isLoading) return <ScreenLoader />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.retry} />;
  const subs = query.data ?? [];

  return (
    <Screen refreshing={query.isRefreshing} onRefresh={query.refresh} contentStyle={{ width: '100%', maxWidth: ADMIN_CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
      <Row justify="space-between" gap="md">
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <Text variant="h2">Sub-categories</Text>
          <Text variant="caption" color="textSecondary">
            What customers can book under {category.name}.
          </Text>
        </View>
        {!editing ? <Button testID="add-subcategory" size="sm" icon="add" label="Add" fullWidth={false} onPress={() => openForm({ mode: 'create' })} /> : null}
      </Row>

      {editing ? (
        <Card testID="subcategory-form">
          <View style={{ gap: theme.spacing.lg }}>
            <Text variant="h3">{editing.mode === 'edit' ? `Edit ${editing.sub.name}` : 'New sub-category'}</Text>
            {save.error && !save.error.fieldErrors ? <Banner tone="danger" icon="error" message={save.error.userMessage} /> : null}
            <TextField
              testID="subcategory-name"
              label="Name"
              value={name}
              onChangeText={value => {
                setName(value);
                errors.edited('name');
              }}
              placeholder="e.g. Fan Repair & Installation"
              error={errors.errorFor('name', save.error?.fieldErrors?.name)}
            />
            <TextField testID="subcategory-description" label="Description" optional value={description} onChangeText={setDescription} placeholder="One line customers see while choosing" maxLength={300} />
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}>
                <TextField
                  testID="subcategory-price"
                  label="Starting price (₹)"
                  optional
                  keyboardType="number-pad"
                  value={price}
                  onChangeText={value => {
                    setPrice(value);
                    errors.edited('price');
                  }}
                  placeholder="299"
                  error={errors.errorFor('price')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  testID="subcategory-duration"
                  label="Duration (min)"
                  keyboardType="number-pad"
                  value={duration}
                  onChangeText={value => {
                    setDuration(value);
                    errors.edited('duration');
                  }}
                  placeholder="60"
                  error={errors.errorFor('duration')}
                />
              </View>
            </View>
            <Row gap="sm">
              {editing.mode === 'edit' ? <Button variant="danger" size="sm" icon="remove" label="Delete" fullWidth={false} onPress={() => onDelete(editing.sub)} /> : null}
              <View style={{ flex: 1 }} />
              <Button variant="secondary" size="sm" label="Cancel" fullWidth={false} onPress={() => setEditing(null)} />
              <PrimaryButton testID="subcategory-save" size="sm" label={editing.mode === 'edit' ? 'Save changes' : 'Add sub-category'} fullWidth={false} loading={save.isSubmitting} onPress={onSave} />
            </Row>
          </View>
        </Card>
      ) : null}

      {subs.length === 0 ? <EmptyState title="No sub-categories yet." message="Customers can't book this category until it has at least one sub-category." /> : null}
      {subs.length ? (
        <ListGroup>
          {subs.map(sub => (
            <View key={sub.id} testID={`subcategory-row-${sub.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong" numberOfLines={1} color={sub.isVisible ? 'textPrimary' : 'textTertiary'}>
                  {sub.name}
                </Text>
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {sub.estimatedPrice ? `From ${formatCurrency(sub.estimatedPrice)}` : 'Price on inspection'}
                  {sub.estimatedDuration ? ` · ~${sub.estimatedDuration} min` : ''}
                  {sub.isVisible ? '' : ' · Hidden'}
                </Text>
              </View>
              <Toggle value={sub.isVisible} onValueChange={() => toggle(sub)} accessibilityLabel={`Show ${sub.name} to customers`} />
              <Pressable
                testID={`edit-subcategory-${sub.name}`}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${sub.name}`}
                hitSlop={8}
                onPress={() => openForm({ mode: 'edit', sub })}
                style={({ pressed }) => ({ padding: theme.spacing.xs, borderRadius: theme.radius.sm, backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent' })}>
                <Icon name="edit" size="md" color="textSecondary" />
              </Pressable>
            </View>
          ))}
        </ListGroup>
      ) : null}
    </Screen>
  );
}
