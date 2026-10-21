/**
 * Navigation route contracts
 *
 * One param list per navigator. Screens read their params through these types,
 * so a renamed route or a changed param fails type-check instead of failing at
 * runtime in front of a user.
 *
 * Customer and Vendor param lists are separate on purpose. They are never
 * combined into one navigator, which is what makes the role separation required
 * by PROJECT_BIBLE.md section 3 structural rather than merely conventional — a
 * customer build has no vendor route to navigate to, even via a deep link.
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

import type { OtpChallenge } from '@/shared/services/types/AuthService';

/**
 * Pre-authentication flow (PROJECT_BIBLE.md sections 7A, 9, 28).
 *
 * Routes are named by role. Customer and vendor authentication are different
 * mechanisms — a one-time code versus a permanent auth code — so a shared
 * "Login" route would have had to branch on something the screen should not be
 * deciding.
 *
 * There is no password reset route. Neither role has a password: customers use a
 * one-time code, and a vendor uses the auth code they saved.
 *
 * There is no customer signup route either. A customer account is created by the
 * backend on first successful phone verification, so signing up and signing in
 * are the same three taps — a separate screen would collect details nobody has
 * yet asked for and add a step to the shortest path in the product.
 *
 * There is no vendor recovery route either, and its absence is deliberate.
 * `regenerateVendorAuthCode` is keyed by `registrationId`, which a returning
 * vendor does not have — so the current contract cannot express "I lost my
 * code" safely. Inventing a phone-only regeneration would turn a lost phone into
 * account takeover. It needs a backend operation before it can need a route.
 *
 * The remaining vendor routes are added with their screens, not ahead of them.
 */
export type AuthStackParamList = {
  /**
   * The introduction, shown once on a first launch.
   *
   * It lives in this stack rather than above it because it belongs to the same
   * unauthenticated phase: it is what an unknown user sees before choosing a
   * role, and it is unreachable to anyone with a session. Whether it is the
   * stack's entry point is decided at mount from local storage, not navigated
   * to — so nothing can return to it once it has been finished.
   */
  Onboarding: undefined;

  /**
   * Role selection, and the stack's entry point once the introduction is done. The choice made here is a
   * navigation decision only — the authenticated role comes from the session,
   * so nothing selected here is carried as a param or trusted afterwards.
   */
  AuthEntry: undefined;

  CustomerLogin: undefined;
  /**
   * `phone` travels with the challenge because `verifyCustomerOtp(phone, code)`
   * needs it and `OtpChallenge` carries no identifier of its own — unlike vendor
   * onboarding, which is keyed by `registrationId`. It is the user's own number,
   * not a credential; the code itself never appears in navigation params.
   */
  CustomerOtp: { phone: string; challenge: OtpChallenge };

  /**
   * Returning vendors. Separate from CustomerLogin because the mechanisms
   * differ — a one-time code versus a permanent auth code — and a single screen
   * branching on role would have to decide something it should not.
   */
  VendorLogin: undefined;
  VendorRegistration: undefined;
  /**
   * Typed ahead of its screen so registration has a contract to hand off to.
   *
   * `registrationId` is the onboarding identity — never the phone number, so a
   * half-finished registration cannot be resumed by anyone who merely knows the
   * number. Every onboarding call is keyed by it alone. The challenge carries
   * only the masked destination and timings; no one-time code and no auth code
   * ever travels in params.
   *
   * `phone` travels beside it for one job, never as an identity: once
   * onboarding finishes, it is the number remembered on this device for the
   * next sign in — the digits the vendor typed, as sign in remembers the digits
   * typed there. The account's own `phone` has no format contract, and a
   * backend that answered "+919000000001" would have the next code-only sign
   * in send twelve digits and fail as a wrong code. It is the vendor's own
   * number, not a credential, like `CustomerOtp`'s.
   */
  VendorOtp: { registrationId: string; phone: string; challenge: OtpChallenge };
};

/** Customer bottom tabs (PROJECT_BIBLE.md section 26). */
export type CustomerTabParamList = {
  Home: undefined;
  Requests: undefined;
  Profile: undefined;
};

/**
 * The customer application's stack (PROJECT_BIBLE.md section 26).
 *
 * The tabs are one route inside it rather than the application itself, because
 * categories and request creation are pushed screens — they cover the tabs
 * rather than living in one. Wrapping the tabs is what gives them somewhere to
 * be pushed onto without any tab screen owning a stack of its own.
 *
 * Only `Categories` is registered so far. The rest of the flow arrives with the
 * screens that fill it; a route typed ahead of its screen is a promise the app
 * can navigate to and then fail to render.
 */
export type CustomerStackParamList = {
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList>;

  /**
   * Editing the signed-in customer's own details (PROJECT_BIBLE.md sections 25
   * and 26, Phase 3D-8).
   *
   * Takes no params. Whose profile it is, is whoever is signed in — passing an
   * id would imply this screen can edit somebody else's, which it cannot, and
   * passing the current values would let a stale copy be saved over fresher
   * ones. The screen reads the session, like every other screen that needs it.
   */
  EditProfile: undefined;

  /**
   * The customer's saved addresses (PROJECT_BIBLE.md section 18; section 26
   * names this route `Addresses`, below Profile).
   *
   * Takes no params, for the reason `EditProfile` takes none: whose addresses
   * they are, is whoever is signed in.
   */
  Addresses: undefined;

  /**
   * Adding one, or changing one that is already saved.
   *
   * `addressId` absent means a new address. One route rather than two because
   * the two differ only in what the form opens with — splitting them would be
   * two screens maintaining one form. The id and nothing else: the screen reads
   * the record from the service rather than being handed a copy that may have
   * gone stale while another change was in flight.
   */
  EditAddress: { addressId?: string };

  /**
   * Service discovery, reached from Home's primary action.
   *
   * Takes no params: it lists what the backend offers, and the customer has not
   * chosen anything yet.
   */
  Categories: undefined;

  /**
   * The services inside one category.
   *
   * `categoryId` and nothing else. The name is display data — it is rendered,
   * translated and changed by the backend, so routing on it would make a
   * renamed category a broken link. The screen behind this route asks the
   * backend what the id means rather than trusting what it was handed.
   */
  SubCategories: { categoryId: string };

  /**
   * Where a chosen service leads (PROJECT_BIBLE.md sections 13 and 26).
   *
   * Two identifiers and nothing else. The screen behind this asks the backend
   * what they mean rather than being handed names, glyphs or a response object —
   * the same rule the sub-category route follows, for the same reason.
   */
  CreateRequest: { categoryId: string; subCategoryId: string };

  /**
   * Where the work is to be done (PROJECT_BIBLE.md section 18).
   *
   * The same two identifiers as its neighbours, and for the same reason — the
   * screen resolves what they mean rather than being handed names. The address
   * itself never travels in params: it is where somebody lives, and navigation
   * state is serialised, logged by devtools and restored from disk, which is no
   * place for it. `RequestDraftContext` carries it, as it carries the notes and
   * the photo URLs.
   *
   * Named `ServiceAddress` rather than `CustomerServiceAddress`: every route in
   * this list is the customer's, so the prefix would distinguish it from
   * nothing, and none of its siblings carry one.
   */
  ServiceAddress: { categoryId: string; subCategoryId: string };

  /**
   * One of the customer's saved addresses, chosen as the service address
   * (PROJECT_BIBLE.md section 18's "address selection"), pushed from
   * `ServiceAddress` and popped back to it.
   *
   * ⚠️ No params, and the choice never travels in one. Whose addresses they are
   * is whoever is signed in, and the address chosen is copied into
   * `RequestDraftContext` — where `ServiceAddress` reads it back — because an
   * address in navigation state is an address in devtools and on disk, the
   * reason `ServiceAddress` itself carries none.
   */
  ChooseSavedAddress: undefined;

  /**
   * Choosing a professional, or choosing not to (PROJECT_BIBLE.md section 18A).
   *
   * The same two identifiers, because the backend decides eligibility from the
   * service being asked for and this screen has to ask it. Nothing else travels:
   * what the customer typed into the details form is carried by
   * `RequestDraftContext`, not by the route, because notes and photo URLs have
   * no business in navigation state.
   */
  PreferredVendor: { categoryId: string; subCategoryId: string };

  /**
   * The summary a customer reads before sending (PROJECT_BIBLE.md section 19).
   *
   * The same two identifiers again, for the same reason: the screen resolves the
   * names it shows from the backend rather than being handed them. Everything it
   * summarises comes from `RequestDraftContext`, which is also what it checks
   * before letting anything be sent.
   */
  RequestConfirmation: { categoryId: string; subCategoryId: string };

  /**
   * The moment after a request goes out (PROJECT_BIBLE.md section 19).
   *
   * ⚠️ Takes the same two identifiers as its siblings and nothing else — no
   * reference, no address, no vendor. It is tempting to pass the outcome here
   * because the draft that held it is destroyed at the same moment, and it would
   * be wrong for the reason every other screen in this flow avoids it:
   * navigation state is serialised, written to disk and printed by devtools, and
   * a customer's home address has no business in any of those. The outcome
   * travels in `RequestDraftContext`, which is where the request lived all
   * along.
   *
   * It is reached by `reset` rather than `navigate`, so there is nothing behind
   * it to go back to — see the screen for why.
   */
  RequestSubmitted: { categoryId: string; subCategoryId: string };

  /**
   * One request, read back (PROJECT_BIBLE.md section 20).
   *
   * ⚠️ The reference and nothing else. Unlike the creation routes this carries
   * no category or service, because a request that exists already knows what it
   * was for — the screen asks `RequestService` for the record rather than being
   * handed any of it. Above all it is never handed the record itself: an address,
   * notes and photographs in a route param are all three in navigation state,
   * which is serialised, restored from disk and printed by devtools. A reference
   * is what a customer reads aloud, and is safe to travel.
   */
  RequestDetails: { requestId: string };

  /**
   * Section 24's "Rate Your Experience", for one request.
   *
   * ⚠️ The reference and nothing else, for the reason `RequestDetails` gives —
   * and never the review either. Whether the request can be reviewed, and
   * whether it already has been, are read from the services by the screen, so a
   * stale or hand-built route can at worst open a screen that says no.
   */
  RequestReview: { requestId: string };

  /**
   * The customer's notifications (PROJECT_BIBLE.md section 57; in-app only, as
   * section 80's "Basic" — push is section 72's Phase 2), pushed from the bell
   * on Home.
   *
   * ⚠️ No params. Whose notifications they are is the session's, so no route —
   * restored, deep-linked or hand-built — can open somebody else's. The vendor
   * stack registers the same screen under the same name; neither stack holds
   * the other's (section 3), and a notification's link opens a request in this
   * stack's own `RequestDetails`.
   */
  Notifications: undefined;
};

/** Vendor bottom tabs (PROJECT_BIBLE.md section 43). */
export type VendorTabParamList = {
  Dashboard: undefined;
  Requests: undefined;
  Team: undefined;
  Profile: undefined;
};

/**
 * The vendor application's stack (Phase 3E-1).
 *
 * ⚠️ Which routes exist depends on the profile, the way the root depends on the
 * session: until setup is complete the stack holds `VendorProfileSetup` and
 * nothing else, so no tab, deep link or stray `navigate` can reach the
 * application around it. Saving the profile swaps the set; nothing navigates.
 *
 * No params anywhere: the profile is read from `VendorProfileService`, never
 * carried in a route (a route is serialised, restored and printed by devtools).
 */
export type VendorStackParamList = {
  VendorProfileSetup: undefined;
  VendorTabs: NavigatorScreenParams<VendorTabParamList>;
  /** The same form as setup, opened from the Profile tab. */
  EditVendorProfile: undefined;
  /**
   * One request, read-only (section 32, Phase 3E-3).
   *
   * ⚠️ The reference and nothing else, for the reason the customer's
   * `RequestDetails` gives. Whose request it is comes from the session, never
   * from here: a hand-built route to somebody else's reference opens a screen
   * that says it could not be found.
   */
  VendorRequestDetails: { requestId: string };
  /**
   * Completing a job in progress and recording what it came to — the final
   * amount and the offline payment (sections 36 and 37) — pushed from the
   * request's "Mark completed", on its details or its card.
   *
   * ⚠️ The reference and nothing else, as `VendorRequestDetails`. Nothing about
   * the job is carried: the service decides whether it is this vendor's and in
   * progress, and refuses the completion otherwise.
   */
  CompleteWork: { requestId: string };
  /**
   * Recording, after the job, that a customer recorded "Not paid yet" has now
   * paid (owner decision, 21/10/2026; section 37's offline record), pushed
   * from "Record payment" on a finished request's details.
   *
   * ⚠️ The reference and nothing else, as `CompleteWork`. Not the amount, not
   * the record: the service decides whether there is an unpaid record of this
   * vendor's to change, and refuses otherwise.
   */
  RecordPayment: { requestId: string };
  /**
   * The vendor's notifications (section 57; in-app only, section 80 — push is
   * section 72's Phase 2), pushed from the bell on the Dashboard.
   *
   * ⚠️ No params, and never an account id: whose notifications they are is the
   * session's. The same screen the customer stack registers under the same
   * name; a notification's link opens a request in this stack's own
   * `VendorRequestDetails`, never the customer's route.
   */
  Notifications: undefined;
  /**
   * The reviews customers wrote about this vendor's work, read-only (section
   * 41, Phase 3E-6), pushed from the Profile tab.
   *
   * ⚠️ No params, and never a vendor id. Whose reviews they are comes from the
   * session, so no route — restored, deep-linked or hand-built — can open
   * another vendor's.
   */
  VendorReviews: undefined;
  /**
   * The vendor's basic report — today, this week or this month (section 42),
   * pushed from the Profile tab.
   *
   * ⚠️ No params: not a vendor id, and not the period either. Whose figures they
   * are comes from the session, and the period is chosen on the screen, so no
   * route — restored, deep-linked or hand-built — can open another vendor's.
   */
  VendorReports: undefined;
  /**
   * Adding a team member (no `memberId`) or changing one (section 39, Phase
   * 3E-7), pushed from the Team tab. One form, as `EditAddress` is.
   *
   * ⚠️ The member's id and nothing else. The details are read from
   * `VendorTeamService`, never carried here, and whose team it is comes from
   * the session: an id that is not on this vendor's team opens a form that says
   * so, and saving it is refused.
   */
  EditTeamMember: { memberId?: string };
  /**
   * The vendor's shop images — add, retry, remove (section 38's "Upload Shop
   * Images"), pushed from the Profile tab.
   *
   * ⚠️ No params, never a vendor id and never a URL. The images are read from
   * `VendorProfileService` for whoever is signed in, so no route can open or
   * change another vendor's.
   */
  ShopImages: undefined;
  /**
   * The vendor's usual week — which days they open, and when (section 38's
   * "Working Hours" and "Manage Availability"), pushed from the Profile tab's
   * "Edit working hours".
   *
   * ⚠️ No params: never a vendor id and never the hours. The week is the
   * profile's for whoever is signed in, and is saved through
   * `VendorProfileService`, so no route can open or change another vendor's.
   */
  WorkingHours: undefined;
};

/**
 * The root is switched by auth state, not navigated between. It is typed here so
 * that `useNavigation` resolves correctly anywhere in the tree.
 */
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Customer: NavigatorScreenParams<CustomerStackParamList>;
  Vendor: NavigatorScreenParams<VendorStackParamList>;
};

/**
 * Registers the root routes with React Navigation so `useNavigation()` is typed
 * without a generic at every call site. The local type is named
 * RootStackParamList rather than RootParamList so it does not collide with the
 * global interface being augmented here.
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
