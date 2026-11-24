import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { AdminStackParamList } from '@/app/navigation/types';
import { IconPicker } from '@/features/admin/components/IconPicker';
import { ADMIN_CONTENT_MAX_WIDTH, CATEGORY_ICON_SUGGESTIONS } from '@/features/admin/constants';
import {
  Banner,
  Button,
  Card,
  DynamicIcon,
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
import type { Category } from '@/shared/types/models';
import { compact, hasErrors, validators } from '@/shared/utils/validation';

type Editing = { mode: 'create' } | { mode: 'edit'; category: Category } | null;

/** Categories are backend configuration — adding one here adds a service to the app with no release. */
export function AdminCategoriesScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { confirm } = useDialog();
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();
  const query = useServiceQuery(() => catalogApi.adminCategories(), []);
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string>(CATEGORY_ICON_SUGGESTIONS[0]);
  const errors = useFormErrors<'name'>();
  const save = useServiceMutation(async () => {
    const payload = { name: name.trim(), description: description.trim(), icon };
    return editing?.mode === 'edit' ? catalogApi.updateCategory({ id: editing.category.id, ...payload }) : catalogApi.createCategory(payload);
  });

  const openForm = (next: Editing) => {
    setEditing(next);
    const category = next?.mode === 'edit' ? next.category : null;
    setName(category?.name ?? '');
    setDescription(category?.description ?? '');
    setIcon(category?.icon || CATEGORY_ICON_SUGGESTIONS[0]);
    errors.setErrors({});
  };

  const onSave = async () => {
    const next = compact<'name'>({ name: validators.minLength(name, 2, 'Name') });
    errors.setErrors(next);
    if (hasErrors(next)) return;
    if (await save.mutate()) {
      toast.show(editing?.mode === 'edit' ? 'Category updated.' : 'Category created.');
      setEditing(null);
      query.refresh();
    }
  };

  const onDelete = async (category: Category) => {
    const ok = await confirm({
      title: `Delete ${category.name}?`,
      message: 'Customers will no longer see this service. Categories with active requests cannot be deleted — hide them instead.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await catalogApi.deleteCategory(category.id);
      toast.show('Category deleted.');
      setEditing(null);
      query.refresh();
    } catch (caught) {
      toast.show(AppError.from(caught).userMessage, 'danger');
    }
  };

  const toggle = async (category: Category) => {
    try {
      await catalogApi.updateCategory({ id: category.id, isVisible: !category.isVisible });
      query.refresh();
    } catch (caught) {
      toast.show(AppError.from(caught).userMessage, 'danger');
    }
  };

  if (query.isLoading) return <ScreenLoader />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.retry} />;
  const categories = query.data ?? [];

  return (
    <Screen
      testID="admin-categories"
      refreshing={query.isRefreshing}
      onRefresh={query.refresh}
      contentStyle={{ width: '100%', maxWidth: ADMIN_CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
      <Row justify="space-between" gap="md">
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <Text variant="h2">Categories</Text>
          <Text variant="caption" color="textSecondary">
            {categories.length} categories · {categories.filter(c => c.isVisible).length} visible to customers
          </Text>
        </View>
        {!editing ? <Button testID="add-category" size="sm" icon="add" label="Add category" fullWidth={false} onPress={() => openForm({ mode: 'create' })} /> : null}
      </Row>

      {editing ? (
        <Card testID="category-form">
          <View style={{ gap: theme.spacing.lg }}>
            <Text variant="h3">{editing.mode === 'edit' ? `Edit ${editing.category.name}` : 'New category'}</Text>
            {save.error && !save.error.fieldErrors ? <Banner tone="danger" icon="error" message={save.error.userMessage} /> : null}
            <TextField
              testID="category-name"
              label="Name"
              value={name}
              onChangeText={value => {
                setName(value);
                errors.edited('name');
              }}
              placeholder="e.g. Pest Control"
              error={errors.errorFor('name', save.error?.fieldErrors?.name)}
            />
            <TextField testID="category-description" label="Short description" optional value={description} onChangeText={setDescription} placeholder="Shown under the category name" maxLength={300} />
            <IconPicker value={icon} onChange={setIcon} />
            <Row gap="sm">
              {editing.mode === 'edit' ? (
                <Button variant="danger" size="sm" icon="remove" label="Delete" fullWidth={false} onPress={() => onDelete(editing.category)} />
              ) : null}
              <View style={{ flex: 1 }} />
              <Button variant="secondary" size="sm" label="Cancel" fullWidth={false} onPress={() => setEditing(null)} />
              <PrimaryButton testID="category-save" size="sm" label={editing.mode === 'edit' ? 'Save changes' : 'Create category'} fullWidth={false} loading={save.isSubmitting} onPress={onSave} />
            </Row>
          </View>
        </Card>
      ) : null}

      {categories.length === 0 ? <EmptyState title="No categories yet." message="Add the first service customers can book." /> : null}
      {categories.length ? (
        <ListGroup testID="category-list">
          {categories.map(category => (
            <View key={category.id} testID={`category-row-${category.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: theme.radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: category.isVisible ? theme.colors.primarySubtle : theme.colors.surfaceAlt,
                }}>
                <DynamicIcon glyph={category.icon} size="md" color={category.isVisible ? 'primary' : 'textTertiary'} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${category.name} sub-categories`}
                onPress={() => navigation.navigate('AdminSubCategories', { category: { id: category.id, name: category.name } })}
                style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {category.name}
                </Text>
                <Text variant="caption" color={category.isVisible ? 'textSecondary' : 'textTertiary'} numberOfLines={1}>
                  {category.isVisible ? 'Visible' : 'Hidden'} · Manage sub-categories
                </Text>
              </Pressable>
              <Toggle value={category.isVisible} onValueChange={() => toggle(category)} accessibilityLabel={`Show ${category.name} to customers`} />
              <Pressable
                testID={`edit-category-${category.name}`}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${category.name}`}
                hitSlop={8}
                onPress={() => openForm({ mode: 'edit', category })}
                style={({ pressed }) => ({ padding: theme.spacing.xs, borderRadius: theme.radius.sm, backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent' })}>
                <Icon name="edit" size="md" color="textSecondary" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${category.name}`}
                hitSlop={8}
                onPress={() => navigation.navigate('AdminSubCategories', { category: { id: category.id, name: category.name } })}>
                <Icon name="forward" size="md" color="textTertiary" />
              </Pressable>
            </View>
          ))}
        </ListGroup>
      ) : null}
    </Screen>
  );
}
