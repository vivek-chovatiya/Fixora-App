# Fixora — Design Changes

State of the UI on `feature/FIX-001-navigation-and-auth-state`, as of 2026-08-25.

This is a **design reference**, not a changelog to append to. It records what the
interface now is, what tokens exist to build it from, and the rules that must not
be broken by the next change. Read it before touching any screen, component or
theme file.

Scope: Phase 1 only. Nothing here implements a Phase 2 feature — see
`PROJECT_BIBLE.md` and section 0 of `CLAUDE.md`.

---

## 1. The direction, in five sentences

1. **The brand panel is gone.** Auth screens used to open with a full-bleed band
   of brand colour carrying the mark, the wordmark, the heading and a supporting
   line — about a third of a small phone, on every screen, and it had to collapse
   itself when the keyboard opened. It was replaced by a 44dp top bar and a
   heading that lives in the page body and scrolls away with it.
2. **Controls are capsules of one height.** Every text field and every button is
   `radius.full` at `controlHeight` (52dp), so a form reads as one column instead
   of a stack of differently-shaped parts.
3. **State is never carried by colour alone.** Selection, focus and validity each
   change a second property — glyph shape, border thickness, text weight, dot
   width — because colour alone fails `PROJECT_BIBLE.md` section 46.
4. **Decoration is decoration.** Artwork is pointer-transparent and hidden from
   assistive technology; any words over it are rendered text, never baked pixels.
5. **Motion trails the work, it never gates it.** Navigation happens in the press
   handler; animation catches up afterwards, and honours reduced-motion.

---

## 2. Theme tokens

### 2.1 Added

| Token | Value | File | Why |
|---|---|---|---|
| `theme.borderWidth.hairline` | `StyleSheet.hairlineWidth` | `theme/borderWidth.ts` (new) | Dividers only — a control drawn at hairline disappears on a high-density screen. |
| `theme.borderWidth.thin` | `1` | same | A control at rest. |
| `theme.borderWidth.thick` | `1.5` | same | A control that is focused, invalid, or asking to be looked at. |
| `theme.controlHeight` | `52` | `theme/spacing.ts` | Shared height for buttons **and** fields. Deliberately *not* `hitSlop.minTarget` (44), which is a legal floor, not a design. |
| `typography.fontSize.hero` / `lineHeight.hero` | `34` / `42` | `theme/typography.ts` | The largest thing on a page, added because the removed brand band was carrying the shape of the auth screens and the heading now has to. |
| variant `hero` | 34/42 bold, tight tracking | same | Page headings. The only thing in the app at this size. |
| variant `button` | 16/24 semibold | same | Buttons used `label` (12px) — the largest target on a screen carried the smallest type on it. |
| variant `subtitle` | 16/24 regular | same | The scale had no regular 16px, so supporting copy could only be `body` (14), which under a 34px heading reads as small print. |
| `shadows.glow` | accent-tinted, `y+4 / r12 / 0.3`, elevation `lg` | `theme/shadows.ts` | Depth in the brand accent for the floating tab button. Same geometry as `lg` — one shadow system in a different colour, not a second one. Android tints elevation only from API 28; below that it renders neutral, which is quieter, not broken. |
| `animation.spring.travel` | `{ damping: 20, stiffness: 180, mass: 1 }` | `theme/animation.ts` | ζ≈0.75, ω≈13.4 rad/s → ~400ms settle, <3% overshoot. For motion that *travels*; timing curves stay for state changing in place. |
| `icons.arrowForward` | `arrow-right` | `theme/icons.ts` | A chevron points at what is beside it; an arrow says the control takes you somewhere. |
| `icons.homeSelected` / `requestsSelected` / `profileSelected` / `teamSelected` | filled counterparts | same | Tab selection must change shape, not only colour. |

### 2.2 Changed signatures

- `createShadows(shadowColor)` → `createShadows(shadowColor, accentColor)`.
- `ShadowToken` gained `'glow'`.
- `AppTheme` gained `borderWidth` and `controlHeight`.
- `animation` is now `{ duration, easing, spring }`.

### 2.3 Deliberately **not** changed

- **`screenPadding` is still 16 (`spacing.lg`).** Both supplied design references
  render a gutter around 7.7% of page width (≈32dp at 411dp); the app ships 3.9%.
  Changing it moves every screen in the application, so it was reported rather
  than done. If it is ever wanted: `screenPadding = spacing.xxl` (24) or
  `spacing.xxxl` (32), one line.
- **Colour tokens.** No new colours were invented. The vendor role card uses the
  existing `success`/`successSubtle` pair rather than a second green.

---

## 3. Shared components

### 3.1 New

**`BrandMark`** (`shared/components/BrandMark.tsx`)
The only place the logo is drawn. Renders a local PNG at three densities cut from
`brand/fixora-logo-master.png` by `brand/generate.py` — the same master the
Android launcher icon comes from, so the two cannot drift.
Sizes are steps, not pixels: `sm 0.625 · md 1 · lg 1.75 · xl 2.5` × 44dp.
`fadeDuration={0}` (Android's 300ms image fade meant the splash showed a
translucent brand for most of its life). Always decorative.

**`FieldLabel`** (`shared/components/FieldLabel.tsx`)
One label renderer for every kind of control, with the required marker inked in
`primary`. It exists because `Input` owned its own label and the chip-based
service field wrote another — so the registration form had ten required markers
you could scan for and one you could not. Indentation is the caller's business.

### 3.2 Changed

**`Input`**
- Capsule: `borderRadius: radius.full`, `minHeight: controlHeight`,
  `paddingHorizontal: spacing.xl`, `gap: spacing.md`.
- Border **thickens** as well as recolours: `thin` at rest → `thick` when focused
  or invalid. Error still outranks focus.
- Label, helper text and error are indented by `spacing.xl` to line up with the
  value inside the capsule.
- Label now comes from `FieldLabel` (primary ink, not secondary).
- New **`prefix`** slot: fixed, non-typed content pinned ahead of the value
  (dialling code, currency, unit), ruled off with an inset `FieldDivider` on both
  sides. Anything pressable belongs in `rightIcon`, not here.

**`Button`**
- Capsule: `radius.full`, `minHeight: controlHeight`,
  `paddingVertical: spacing.sm`, `paddingHorizontal: spacing.xxl`.
- Label is now the `button` variant (16/24 semibold), icon is `size="md"`.
- New **`iconPosition: 'leading' | 'trailing'`**. Leading names the action;
  trailing is a direction (the arrow on a submit button).
- **Secondary is now filled, not outlined**: `surfaceAlt`, pressed
  `borderStrong`. The old white-plate-with-a-border was a rectangle drawn round
  some words on a white card. Pressed uses `borderStrong` because in dark mode
  `border` and `surfaceAlt` are the same value and a press would have shown
  nothing.

**`Screen`**
- New **`header`** slot: sits outside the scroll area **and** outside the
  `KeyboardAvoidingView`. That placement is the point — a bar inside the
  keyboard-avoiding view is pushed off the top of the screen as the keyboard
  opens, and a back control inside a centred body drifts to the middle.

---

## 4. Auth feature components

All new unless noted.

| Component | What it is |
|---|---|
| `AuthTopBar` | The 44dp bar every auth screen opens with: mark centred in the full width, back control absolutely positioned on the left so the mark does not shift between screens that have one and screens that do not. Paints nothing, so the app-level `StatusBar` stands. |
| `AuthBackButton` | A raised, ringed 44dp disc with a chevron. Adds a *visible* exit to screens that were only escapable by hardware button or edge swipe. Pressing steps the fill up, never fades the ink. |
| `AuthHeading` | `hero` title + optional `subtitle`, in the page body so it scrolls away. |
| `AuthCityscape` | The decorative foot: `city-signin.png` at 430:162, with "Your information is safe with us." **rendered as text** over it beside a `primarySubtle` disc. The sentence was painted out of the supplied artwork — baked-in text is untranslatable, ignores the user's type size, and is invisible to a screen reader. |
| `PhoneCountryPrefix` | Drawn flag + `AppConfig.phone.dialCode`. **Not a picker and not a value**: no chevron (there is nothing to open — multi-country is Phase 2), and the code is never prepended to the digits or sent to a service. |
| `RoleCard` | The two choices on the entry screen: illustration tile, glyph, title, description, outcome badge, and a ringed chevron disc that *looks* like a button and deliberately is not one. The whole card is the single target; the vendor variant is the same card in the existing `success` tone. |
| `ServiceCategoryField` *(changed)* | Gained `required`; now uses `FieldLabel`, deliberately flush rather than indented because it names a chip row, not a capsule's interior. |
| `OtpVerificationForm` *(changed)* | Three presentation changes only: a `sentTo` line naming the masked destination (re-read from the challenge after a resend), a two-ink countdown (`copy.resendIn.split('{seconds}')`, the count in `primary`), and an optional `changeIcon`. **No handler, ref, state, effect, timer, schema or navigation call was altered; `VerificationCodeInput` and `VerificationScene` were not touched.** |

---

## 5. Screens

| Screen | Top bar | Back | Heading | Cityscape | Notes |
|---|---|---|---|---|---|
| `SplashScreen` | — | — | — | — | `BrandMark size="xl"` + wordmark grouped, loader apart. **No animation** — the screen lasts about as long as one storage read, so a fade meant the brand was invisible for most of it. |
| `OnboardingScreen` | — | — | per page | — | See §6. |
| `AuthEntryScreen` | **no** | — | inline | own `city-skyline` | The only auth screen without the top bar: nothing behind it, and the page scrolls, so the mark should scroll with it. Two `RoleCard`s. Footer links to vendor sign in, which is the only path to registration. |
| `CustomerLoginScreen` | yes | yes | yes | yes | Phone field carries `PhoneCountryPrefix`; submit uses `icon="arrowForward" iconPosition="trailing"`. |
| `CustomerOtpScreen` | yes | yes (→ change number) | yes | yes (`flex: 1` foot) | `changeIcon="call"`. `paddingTop: spacing.huge`. |
| `VendorLoginScreen` | yes | yes | yes | yes | **No `+91` prefix yet** — open item. |
| `VendorRegistrationScreen` | yes | yes | yes | yes (`flexGrow: 1` foot) | `padded={false}` + body gutter; BUSINESS / CONTACT / SERVICES overlines in `textSecondary`; `required` on the service field. |
| `VendorOtpScreen` | yes (mark only) | **no** | yes | **no** | Deliberate: it holds three steps in one screen, two of which display a standing credential. `changeIcon="edit"`. |

**Vertical rhythm.** Screens with a top bar use `contentContainerStyle` with
`paddingTop: spacing.huge`, which puts the heading **≈69dp below the brand-mark
centre** on customer OTP (69.1), vendor sign in (69.5) and registration (69.5).
Measured on device; keep new auth screens on that number.

**`flex` vs `flexGrow` on the artwork foot.** Short screens (sign in, OTP) use
`flex: 1` so the foot fills the slack. The registration form always overflows, so
`flex: 1` — zero basis, allowed to shrink — rendered the foot as a sliver of sky;
it uses `flexGrow: 1`.

---

## 6. Onboarding (new feature)

A three-page horizontal pager at `src/features/onboarding/`, registered inside
`AuthNavigator` and gated by `useOnboardingGate` reading `OnboardingStorage`
(`@fixora/onboarding`, deliberately separate from the session key — signing out
does not make someone a first-time user again).

- One route, three pages: they share a header, pager and footer, and splitting
  them would mean animating three stack transitions to imitate a swipe.
- The navigator is not mounted until the gate answers, because
  `initialRouteName` is only honoured on first mount. While it answers, the same
  `SplashScreen` stands, so the two storage reads read as one wait.
- **Skip and finish are the same act** — both mark it seen and land on sign in.
- `OnboardingPagination`: the active dot **widens** as well as recolouring; the
  group is one accessible node reporting its position in words.
- `PermissionPrompt`: explains first, asks second — a native dialog with no
  context gets refused, and a refusal is close to permanent on both platforms.
  The two buttons are also the page's only way forward, so every branch ends in
  `onAnswered`. Declining always leaves onboarding working.
- `OnboardingIllustration` is an explicit **stand-in**: theme glyphs composed
  into a tinted round stage with two orbiting motifs, same weight and silhouette
  as the real artwork. Pages reserve a square and ask by name, so dropping in
  `<Image>` or SVG later changes one file and moves no layout.
- Permissions go through `PermissionService` → `DevicePermissionService`. Screens
  never call `PermissionsAndroid` or `react-native-permissions` directly.

---

## 7. Navigation — the floating tab bar

Files: `navigation/components/{FloatingTabBar,ActiveTabIndicator,TabBarItem,tabBarGeometry}.tsx`,
plus `navigation/tabScreenOptions.tsx` and a rewritten `navigation/tabIcon.tsx`.
Both `CustomerNavigator` and `VendorNavigator` pass `tabBar={renderFloatingTabBar}`.

**Shape.** A capsule (`radius.full`, `shadows.lg`, hairline border) inset by
`screenPadding`, with the selected destination raised out of it into an
accent-filled circular button.

**Geometry** (`tabBarGeometry.ts`, both components read it so they cannot
disagree): `diameter = theme.controlHeight` (52), `lift = theme.spacing.xl` (20).
The root reserves `paddingTop: lift` rather than overflowing, because a child
drawn outside its parent is clipped on Android.

**The button travels.** One object moving, not one destroyed and rebuilt — two
buttons swapping places read as two things. `withSpring(offset, spring.travel)`.

**Positions are measured.** Each `TabBarItem` reports its own centre from
`onLayout`; the bar keeps them in a ref and bumps a `layoutVersion` to wake its
effects. A *destination* change springs; a *layout* change places instantly (a
rotation moves every centre at once, and a button sliding to catch up with a
layout that already jumped reads as a fault). The pill carries **no horizontal
padding**, so an item's measured `x` is the indicator's offset 1:1.

**Navigation never waits.** `navigation.navigate` is called synchronously in the
press handler, after the preventable `tabPress` emit — so "tap the current tab to
scroll to top" still works.

**Icons.** `createTabIcon` returns a renderer carrying `tabIconName`, and
`tabIconNameOf` recovers it. That lets `tabIcon.tsx` own **both** ink policies:
the bar's glyph is `primary`, the floating button's is `textInverse` (the accent
would be invisible on a button filled with the accent). Focus swaps outline →
filled. `TabIconName` is narrower than `IconName` on purpose, so a fifth tab
cannot ship without a filled counterpart.

**Crossfade.** The indicator keys on the route *key*, never on a stored element,
so an outgoing icon cannot go stale across a theme change. `ENTER_SCALE 0.75`,
`EXIT_SCALE 0.85`, and the swap is deliberately shorter than the travel: what you
are looking at settles before where it is does. The item's own icon fades out
`withDelay(duration.normal)` so there is never an empty slot.

**Press.** `PRESS_SCALE 0.96`, derived from a shared `pressedIndex` so the
timing is started once rather than on every style evaluation.

**Accessibility.** The floating button is `pointerEvents="none"`,
`accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`
— pure decoration. Every tab is `accessibilityRole="tab"` with
`accessibilityState.selected` and an **explicit** `accessibilityLabel`; the icon
is hidden from the accessibility layer, because the icon font's private-use
glyphs were otherwise announced as an unpronounceable character before the label.

**`tabScreenOptions`** describes the label and the two tint colours and nothing
else — `tabBarStyle`/`tabBarItemStyle` were removed, because under a custom bar
they are config React Navigation silently ignores.

---

## 8. Assets

All under `src/features/auth/assets/` and `src/assets/brand/`, at `@1x/@2x/@3x`.

- **`fixora-mark`** — cut from `brand/fixora-logo-master.png` by
  `brand/generate.py`, which also regenerates the Android launcher icons
  (`ic_launcher`, `ic_launcher_round`, `ic_launcher_foreground` + adaptive-icon
  XML). Replace the master and re-run the generator; never edit an output.
- **`city-signin`, `city-skyline`, `role-customer`, `role-vendor`** — the
  supplied crops were opaque with the page background baked in, and were cut to
  real alpha. Without that they are white slabs on the dark theme.
- **`flag-in`** — **redrawn from scratch**, not cropped. The original was a
  screenshot crop: the @3x had the tricolour in rows 21–47 / cols 15–59 of a
  60×48 canvas, with opaque white padding and clipping at the bottom and right,
  which rendered as a squashed flag sitting low in a correctly-centred box.
  Redrawn with PIL at 8× and reduced with LANCZOS: equal thirds `#FF9933` /
  white / `#138808`, Ashoka Chakra `#000080` (12 spokes at @2x/@3x, 8 at @1x).
  It also carries a hairline themed border, because its white middle band
  disappears on a `surface` field.

> PIL/Pillow is a **local authoring tool**, not a project dependency.

---

## 9. Copy

`AUTH_COPY.common` (shared, owned by no screen):
`back`, `backHint`, `safetyNote` ("Your information is safe with us." — reassurance,
deliberately claiming nothing about encryption, storage or compliance), and
`secondsShort` (`'{seconds}s'`).

- Both `resendIn` templates changed from `'Resend code in {seconds}s'` to
  `'Resend code in {seconds}'`, so the accent can cover the whole token including
  its unit. The rendered sentence is byte-identical.
- `sentTo: 'We sent a code to {destination}'` added to both OTP flows. The value
  is masked by the backend before it reaches the app.
- `AppConfig.phone.dialCode = '+91'` and `AppConfig.storage.onboardingKey` added.

---

## 10. Rules the next change must not break

1. **Tokens only.** No literal colour, spacing, radius, shadow, duration, border
   width, font size or icon glyph in a screen or component. No direct
   icon-library imports outside `shared/components/Icon`.
2. **Never state-by-colour-alone.** Add a second property: shape, weight,
   thickness, width, position.
3. **Decoration is inert.** Any artwork gets `accessibilityElementsHidden`,
   `importantForAccessibility="no-hide-descendants"`, and must not swallow a tap.
   Words over artwork are rendered text, never baked pixels.
4. **`BrandMark` is the only place the logo is drawn**, and it is never recoloured.
5. **`PhoneCountryPrefix` is display-only.** It must not grow a chevron, an
   `onPress`, or a value that reaches a service until multi-country is approved.
6. **A `Screen` header goes in the `header` slot**, never inside the body.
7. **Fields and buttons share `controlHeight` and `radius.full`.** A new control
   that differs will make its form read as parts.
8. **The tab bar's animation may never gate navigation**, and its positions may
   never be hardcoded.
9. **Reduced motion is honoured everywhere** (`useReducedMotion()` → duration 0 /
   direct assignment).
10. **System appearance is the only theme authority.** No toggle, no stored
    preference, no screen-level appearance detection.
11. Auth invariants stand unchanged: the OTP and the vendor auth code are never
    logged, stored in Redux, persisted, or put in navigation params; OTP
    verification creates no session; screens never touch `ServiceRegistry`,
    `axios` or storage directly; only `error.userMessage` is ever rendered.

---

## 11. Open items (raised, not decided)

- **Gutter.** `screenPadding` 16 vs the references' ≈32. One line; touches every
  screen. Awaiting a call.
- **OTP cityscape height.** The shared 430×162 artwork starts at ~80% of screen
  height; the reference's starts at ~64%, so our band between "Change phone
  number" and the artwork is larger. Taller artwork would close it, at the cost
  of this screen no longer matching the other three.
- **Vendor sign in and vendor registration have no `+91` prefix.**
- **Vendor OTP has no cityscape and no back control** — deliberate, but worth
  revisiting if the credential step ever moves.
- **Remaining crop-derived assets** (`city-signin`, `city-skyline`,
  `role-customer`, `role-vendor`) came from the same session as the defective
  flag. They look correct on device, but that is where to look first.
- **Country picker** unbuilt, pending Phase 2 approval.

---

## 12. Verification status

TypeScript **0 errors** · ESLint **0 errors**, 17 pre-existing warnings · Jest
**293/293 across 26 suites** · Android `assembleDebug` **exit 0**.

Verified on an emulator at 411×914dp, 360×640dp and a 360×400dp keyboard squeeze,
in light and dark. **iOS is written but unbuilt** (Windows host).

The whole body of work described here is **uncommitted** as of writing; the last
commit is `029895f`.
