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
 *
 * The bell at the top is the one way to the notifications inbox (section 57);
 * the bar has no tab for it. A pull reads its count again with the sections. A
 * failed unread count is a bell with no badge, never an error on this screen.
 */

import React, { useCallback } from 'react';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import { CategoryGrid } from '@/features/customer/components/CategoryGrid';
import { HomeGreeting } from '@/features/customer/components/HomeGreeting';
import { HomeSection } from '@/features/customer/components/HomeSection';
import { RecentRequestList } from '@/features/customer/components/RecentRequestList';
import { ResumeRequestCard } from '@/features/customer/components/ResumeRequestCard';
import { ServicePrompt } from '@/features/customer/components/ServicePrompt';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useCustomerHome } from '@/features/customer/hooks/useCustomerHome';
import type { RequestDraftStep } from '@/features/customer/state/requestDraft';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import type { CustomerStackParamList, CustomerTabParamList } from '@/navigation/types';
import { Screen, StaleNotice } from '@/shared/components';
import { useAnalytics } from '@/shared/hooks/useAnalytics';
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
  /*
    `resume` is offered only while the draft is worth keeping, and the bell's
    count is read again by the pull with everything else — both decided in the
    hook (3D-12).
  */
  const {
    greeting,
    name,
    categories,
    requests,
    resume,
    unreadNotifications,
    unreadIsLowerBound,
    refresh,
    isRefreshing,
    isStale,
    staleError,
  } = useCustomerHome();

  const openCategories = useCallback(() => {
    navigation.navigate('Categories');
  }, [navigation]);

  /*
    The bell (section 57): the unread count, read on arrival, on every return
    and on every pull, and the inbox as a pushed screen. Whose notifications
    they are is the session's, so nothing travels.
  */
  const openNotifications = useCallback(() => {
    navigation.navigate('Notifications');
  }, [navigation]);

  /*
    A tile opens its own category, with exactly what the catalogue sends.

    It used to open the whole catalogue, so the customer tapped the category
    they wanted and then had to find it and tap it again. The id and nothing
    else, as `CategoriesScreen` sends — Sub Categories reads the name for
    itself — and pushed onto the stack, so its Back comes straight home. "See
    all" and the primary action still open the catalogue: those are the ways in
    for someone who has not chosen yet.

    The tile is also the choice section 54 counts as `category_selected`, sent
    exactly as the catalogue sends it. "See all" and the primary action send
    nothing: opening the catalogue is not choosing from it.
  */
  const { track } = useAnalytics();
  const openCategory = useCallback(
    (categoryId: string) => {
      track('category_selected', { categoryId });
      navigation.navigate('SubCategories', { categoryId });
    },
    [navigation, track],
  );

  /*
    A request, by its reference and nothing more.

    The card has the summary; the details screen fetches the record for itself.
    Handing it the summary would make the details screen depend on which list it
    was opened from, and the address and notes it shows are not on a card anyway.
  */
  const openRequest = useCallback(
    (requestId: string) => {
      navigation.navigate('RequestDetails', { requestId });
    },
    [navigation],
  );

  /*
    Resuming rebuilds the flow, rather than jumping to the middle of it.

    Where to land is the draft's answer, not navigation history's — that is the
    whole point of the draft carrying its own progress. But landing there with an
    empty stack behind it would make Back go Home from the middle of a request,
    so the screens that come before are pushed underneath: someone resumed at the
    vendor step can still go back and change a date.
  */
  const resumeRequest = useCallback(() => {
    if (!resume) {
      return;
    }

    const { categoryId, subCategoryId } = resume.draft;
    const params = { categoryId, subCategoryId };

    /*
      Every step up to the one that still needs them, and no further.

      Built from the draft's own answer rather than from a remembered history,
      so a request left at the address step comes back to the address step even
      after the app has been closed — and so the screens before it are underneath
      rather than absent, which is what lets Back go back rather than home.
    */
    const before: RequestDraftStep[] = ['details', 'address', 'vendor', 'review'];
    const reached = before.indexOf(resume.step);

    const routes = [
      { name: 'CustomerTabs' as const },
      { name: 'CreateRequest' as const, params },
      ...(reached >= before.indexOf('address') ? [{ name: 'ServiceAddress' as const, params }] : []),
      ...(reached >= before.indexOf('vendor') ? [{ name: 'PreferredVendor' as const, params }] : []),
      ...(reached >= before.indexOf('review')
        ? [{ name: 'RequestConfirmation' as const, params }]
        : []),
    ];

    /*
      The stack, explicitly.

      This screen is a tab inside the stack, so its own `reset` would rearrange
      the three tabs — `navigate` reads through to the parent but `reset` does
      not, which is the kind of difference that only shows up at runtime.
    */
    navigation
      .getParent<NativeStackNavigationProp<CustomerStackParamList>>()
      ?.reset({ index: routes.length - 1, routes });
  }, [resume, navigation]);

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
      <HomeGreeting
        greeting={greeting}
        name={name}
        trailing={
          <NotificationBell
            unreadCount={unreadNotifications}
            isLowerBound={unreadIsLowerBound}
            onPress={openNotifications}
            testID="home-notifications"
          />
        }
        testID="home-greeting"
      />

      <ServicePrompt onRequestService={openCategories} testID="home-prompt" />

      {/*
        Above the catalogue, below the prompt. A request already begun is more
        immediately useful than starting another, and putting it under the two
        existing sections would bury it — but it is not the reason the screen
        exists, so it does not displace the question the screen is here to ask.
      */}
      {resume ? (
        <ResumeRequestCard
          serviceName={resume.categoryName}
          startedLabel={resume.startedLabel}
          onPress={resumeRequest}
          testID="home-resume"
        />
      ) : null}

      {/*
        A pull that failed, said once for the page, directly above the two
        sections it failed to refresh. They keep what they had — a working grid
        and the customer's own requests are still worth showing — and this stops
        them passing for current. Try again pulls again, so nothing on screen is
        cleared while it reloads.
      */}
      {isStale ? (
        <StaleNotice
          title={COPY.staleTitle}
          message={COPY.staleMessage}
          error={staleError}
          retryLabel={COPY.staleRetry}
          retryHint={COPY.staleRetryHint}
          onRetry={refresh}
          isRetrying={isRefreshing}
          testID="home-stale"
        />
      ) : null}

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
          onSelect={openCategory}
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
          onOpenRequest={openRequest}
          testID="home-recent-list"
        />
      </HomeSection>
    </Screen>
  );
}

