/**
 * CustomerHomeScreen
 *
 * The customer application's entry point (PROJECT_BIBLE.md section 10).
 *
 * It answers one question — what service do you need — and then offers two ways
 * to answer it: browse the categories, or look at what you already have running.
 * The order is the roadmap's: greeting, the prompt and its primary action,
 * categories, recent requests.
 *
 * ⚠️ No section owns the screen's state. Categories and recent requests load
 * independently and fail independently, so a slow or broken call darkens its own
 * section and nothing else. The greeting and the primary action need no data at
 * all, which is what guarantees this screen is never blank — the thing section
 * 47 forbids — no matter what the backend is doing.
 *
 * There is no search field. Section 61 puts search in Phase 2, and an input that
 * looked like one would advertise a capability the product does not have.
 *
 * Everything reachable from here is reachable once. The avatar is not a route to
 * the profile and the recent section has no "see all", because the bottom bar
 * already owns both destinations — a second path to the same place is one more
 * thing to explain and one more target competing with the screen's purpose.
 */

import React, { useCallback } from 'react';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CategoryGrid } from '@/features/customer/components/CategoryGrid';
import { HomeGreeting } from '@/features/customer/components/HomeGreeting';
import { HomeSection } from '@/features/customer/components/HomeSection';
import { RecentRequestList } from '@/features/customer/components/RecentRequestList';
import { ServicePrompt } from '@/features/customer/components/ServicePrompt';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useCustomerHome } from '@/features/customer/hooks/useCustomerHome';
import type { CustomerStackParamList, CustomerTabParamList } from '@/navigation/types';
import { Screen } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.home;

/**
 * A tab screen that also pushes onto the stack around it.
 *
 * Composite rather than plain, because Categories is not a tab: without this the
 * navigation object is typed as knowing only its three siblings, and the one
 * destination this screen actually sends people to would not type-check.
 */
type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Home'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

/**
 * Declared once at module scope so the array identity does not change on every
 * render, which would re-run the safe-area calculation for no reason.
 */
const TOP_EDGE_ONLY = ['top'] as const;

export function CustomerHomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const { greeting, name, categories, requests, refresh, isRefreshing } = useCustomerHome();

  const openCategories = useCallback(() => {
    navigation.navigate('Categories');
  }, [navigation]);

  return (
    <Screen
      scrollable
      // The tab bar below already clears the home indicator, adding the bottom
      // inset to its own padding. Claiming it here as well would leave a band of
      // empty page above a bar that had already moved out of the way.
      edges={TOP_EDGE_ONLY}
      onRefresh={refresh}
      isRefreshing={isRefreshing}
      contentContainerStyle={{
        gap: theme.spacing.xxl,
        paddingBottom: theme.spacing.xxl,
      }}
      testID="customer-home">
      <HomeGreeting greeting={greeting} name={name} testID="home-greeting" />

      <ServicePrompt onRequestService={openCategories} testID="home-prompt" />

      <HomeSection
        title={COPY.categoriesTitle}
        actionLabel={COPY.categoriesAction}
        onAction={openCategories}
        // "See all" heard on its own says nothing about what it will show.
        actionAccessibilityLabel={`${COPY.categoriesAction} ${COPY.categoriesTitle.toLowerCase()}`}
        actionAccessibilityHint={COPY.categoriesActionHint}
        testID="home-categories">
        <CategoryGrid
          categories={categories.data}
          isLoading={categories.isLoading}
          error={categories.error}
          onRetry={categories.retry}
          onSelect={openCategories}
          testID="home-category-grid"
        />
      </HomeSection>

      <HomeSection title={COPY.recentTitle} testID="home-recent">
        <RecentRequestList
          requests={requests.data}
          isLoading={requests.isLoading}
          error={requests.error}
          onRetry={requests.retry}
          onRequestService={openCategories}
          testID="home-recent-list"
        />
      </HomeSection>
    </Screen>
  );
}

