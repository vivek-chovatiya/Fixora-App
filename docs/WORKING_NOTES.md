# Working notes

How this project is built, debugged and run — written so a session on another
machine can pick up mid-flow without relearning any of it.

Three files carry authority, and they do not overlap:

| File | Authority over |
|---|---|
| `PROJECT_BIBLE.md` | **Product and scope.** 87 sections. What each screen shows, what Phase 1 includes, what it excludes. |
| `CLAUDE.md` | **Engineering standards.** Folder ownership, component rules, the definition of done. |
| `docs/WORKING_NOTES.md` (this file) | **How we actually work.** Process, style, commands, device recipes, current state. |

`docs/DESIGN_CHANGES.md` records the visual language and its invariants.
`docs/BRANCHING.md` records the branch model.

---

## 1. The working agreement

Work arrives one slice at a time, and each slice is finished before the next
starts. The owner writes the brief; the brief usually ends with an explicit list
of what **not** to start. That list is binding.

The order inside a slice is fixed:

```
inspect  →  functionality  →  Fixora theme UI  →  modern UI polish
         →  loading  →  error / empty  →  accessibility
         →  light / dark  →  responsive  →  device verification  →  lock
```

**Inspect before writing anything.** Read the bible sections named in the brief,
then read the code that already exists for the seam being extended. Most briefs
say this outright; do it even when they do not.

**Stop rather than guess.** A brief will list stop conditions — a missing
contract, an ambiguous field, a required new dependency, a shared component that
needs a risky change. When one is genuinely met, stop and report it with the
specific decision to be made and a recommendation. Do not invent a backend
contract to keep moving. When the choice is genuinely the owner's, ask it as a
short set of options with a recommendation first; that has been the fastest path
every time.

**Do not widen scope.** The failure mode the owner guards against is accidentally
building half of Phase 2 before launch. A seam (an interface with no
implementation) is the right way to acknowledge future work.

**Report at the end.** Briefs ask for a numbered final report — files created,
files modified, contracts used, payload, every state verified, every gate's
result, issues discovered, and anything needing approval. Write it against what
was actually observed, not what was intended.

---

## 2. Architecture

One shape, everywhere:

```
Screen  →  feature hook  →  service interface  →  implementation (mock today, API later)
```

A screen never touches `axios`, `AsyncStorage`, `ServiceRegistry`,
`PermissionsAndroid`, a picker library, or an icon library. It calls a hook in
its own feature module; the hook resolves a service through the registry.

```
src/
  core/            config, http, logger, storage, clipboard  (AppConfig is the only config entry point)
  navigation/      param lists, navigators, tab chrome, placeholders
  shared/
    components/    the whole UI library — search here before building anything
    hooks/         useServiceQuery, useServiceMutation, usePaginatedQuery, useResponsive, useCountdown
    services/      types/ (interfaces)  mock/ (fixtures)  device/  ServiceRegistry.ts
    theme/         colors, spacing, radius, shadows, typography, icons, animation, breakpoints
    validation/    field rules shared across features
    types/         AppError and friends
  features/
    <feature>/     screens/ components/ hooks/ constants/ validation/ state/
```

**The two data primitives.**

- `useServiceQuery(fetcher, deps)` → `{data, error, isLoading, isRefreshing, isError, refresh, retry}`
- `useServiceMutation(mutator)` → `{mutate, data, error, isSubmitting, isError, reset}`

Every screen that reads must handle loading, empty, error and retry. Every screen
that writes must lock its button while in flight and preserve what the user
entered when it fails.

**Rules that keep getting proved right.**

- Identifiers travel; display data does not. Navigation params carry ids only.
  A name is the backend's to change and translate, so routing on one makes a
  rename a broken link.
- Never key a client map on a display name. `SUB_CATEGORY_SEED` is keyed by
  category id for exactly this reason.
- Never invent a backend enum. Statuses and priorities are plain strings with a
  presentation table that falls back safely, so a value the backend adds tomorrow
  renders plainly instead of crashing.
- `error.userMessage` may reach the UI. `error.message` may not, ever.
- System appearance is the only theme authority. No preference, no toggle, no
  persisted theme, no `useColorScheme` outside `ThemeProvider`.
- Nothing is hardcoded: colours, spacing, radii, shadows, typography, icon
  glyphs and durations all come from the theme. If a semantic token is genuinely
  missing, stop and say so rather than inventing a screen-local one.
- Mock services take time and can fail, on purpose. `AppConfig.mock` holds
  `minLatencyMs`, `maxLatencyMs` and `failureRate`; without simulated latency the
  loading and retry states would be unreachable before the backend exists.

---

## 3. How we write code

**Every file opens with a docblock that explains itself.** Not a restatement of
the name — the reason the file exists, the decision that shaped it, and what it
refuses to do. A `⚠️` paragraph marks the thing a future reader is most likely to
break. Cite the bible section when a rule comes from there (`PROJECT_BIBLE.md
section 18A.4`), because that is what lets the next person check the reasoning
rather than trusting it.

**Comments explain why, never what.** A comment that says "sets the border
colour" is noise. A comment that says the border thickens as well as changing
colour *because colour alone fails section 46* is the one worth keeping. Comments
that record a defect found on device — and why the obvious fix was wrong — have
paid for themselves repeatedly; keep writing them.

**Match the surrounding file.** The repo has `.prettierrc.js` but is **not**
prettier-formatted. Running prettier reflows files into a style the rest of the
codebase does not use. Write by hand in the style of the file being edited.

**Naming.** `PrimaryButton` / `SecondaryButton` / `DangerButton`,
`EmailInput` / `PhoneInput` / `SearchInput`, `VendorCard` / `CategoryTile` /
`RequestCard`. Predictable over clever.

**Do not duplicate a component.** Search `src/shared/components/index.ts` first.
If something close exists but is locked to another screen, prefer a sibling with
a clear docblock saying why they are not merged over editing the locked one.

**Abstractions need a second real consumer.** `SelectableCard` exists because a
vendor row and "no preference" must not drift apart. `SelectionChip` exists
because priority, date and time are the same interaction three times on one
screen. Neither was written speculatively.

**Copy lives in one file per feature** (`constants/<feature>Copy.ts`), frozen,
with docblocks explaining wording choices. It is the seam translation plugs into
later, and it stops a sentence drifting between two screens.

---

## 4. How we write tests

Tests are written against the rule, not the render. The suite header says what
class of mistake the file is guarding against.

What has actually caught bugs:

- **Asserting the payload's exact key set.** `Object.keys(payload()).sort()`
  catches a field added by accident.
- **Asserting absence.** That `vendorId` is missing entirely for open dispatch —
  not null, not `""`, not `"any"` — is a one-line test protecting a contract
  decision.
- **Serialising and searching.** `expect(JSON.stringify(sent)).not.toContain('Sharma Electricals')`
  proves display data never reaches the wire.
- **Stubs that throw.** Registering a service whose method throws is how a test
  file proves a screen never calls it.
- **Announcement tests.** Reading `accessibilityLabel` / `accessibilityState`
  off the tree catches what a screenshot cannot.

Mechanics: `react-test-renderer` with `act`, services registered as stubs through
`registerService` and cleared in `afterEach` with `resetServices`. Screens that
use a toast need `ToastProvider`; screens in the request flow need
`RequestDraftProvider`.

**Unmount in `afterEach`.** A test that leaves a screen in its loading state
leaves `Skeleton` animating forever and jest's worker will not exit. Unmounting
runs the cleanup the component already has. (The underlying leak — a
`withRepeat(-1)` with no `cancelAnimation` — was a real bug found this way.)
A toast's dwell timer and `useCountdown`'s tick outlive a tree that is never
unmounted too, and fire after teardown; eight suites that skipped the unmount
were the whole of the "worker process has failed to exit" warning (3D-10).

Both the composite `Pressable` and the host view it renders carry
`accessibilityRole`, so filter on `typeof node.props?.onPress === 'function'`
when counting controls, or every one is found twice.

---

## 5. How we run things

The five gates, run from the repo root. All five must pass before a slice is
called done.

```bash
npx tsc --noEmit                     # must be 0 errors
npx eslint src __tests__ --ext .ts,.tsx   # must be 0 errors
npx jest --silent                    # all green
npx react-native bundle --platform android --dev false \
  --entry-file index.js \
  --bundle-output "$TEMP/fixora-bundle-check.js" \
  --assets-dest "$TEMP/fixora-assets-check"
cd android && ./gradlew assembleDebug -q      # exit 0
```

**Known lint baseline:** 30 warnings, 0 errors. They are all
`no-void` on the deliberate `void promise` idiom used by the shared hooks. Do not
"fix" them piecemeal; the idiom is consistent across the codebase. It is one per
hook that starts work from a synchronous handler — the 29th is `useAddressBook`
(3D-9), whose `run` holds that hook's only one. The 30th is the vendor profile
form's Save handler (3E-1), the same `void onSubmit()` every react-hook-form
screen uses; the `void` in `useImageUpload` is the one `useProfileImage` used
to hold, moved, not added. Phases 3E-2 and 3E-3 added none: neither
the dashboard nor the request list has a handler that starts a promise.
Phase 3E-6 (vendor reviews) added none either; it reuses `useSingleFlightQuery`.
Phase 3E-7 (vendor team) added none: its form passes `handleSubmit(...)` straight
to `onPress`, and its removal is awaited with `.then` by the screen. A hook that needs the idiom
should keep it to a single `void` inside such a `run`, as `useProfileImage` and
`useAddressBook` do, rather than one per caller. The eight slices of 20/10/2026
(3E-8 to 3E-11, 3F-1, 3F-2, 3D-10) added none; a docblock in
`useCurrentLocation` only moved its existing one down a few lines. The six
slices of 21/10/2026 (3C-2, 3E-12, 3D-11, 3E-13, 3G-1, 3G-2) added none
either: still 30. `useNetworkStatus` was written without a `void` on purpose.

Metro and the app. **Fixora's Metro is on port 8085**, set in two places that
must agree: `server.port` in `metro.config.js` and `reactNativeDevServerPort`
in `android/gradle.properties` (the React Native Gradle plugin reads the latter
into the debug build).

```bash
npx react-native start                        # from the repo root, always; 8085 comes from metro.config.js
adb reverse tcp:8085 tcp:8085                 # after every reinstall
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.fixora/.MainActivity
```

If Metro serves 500s, it was started from the wrong directory: stop the Fixora
Metro on 8085 and restart it from the repo root.

**Metro can stop on its own.** It did twice on 21/10/2026 — once after the
NetInfo install, once while the machine slept — and the app then shows "Unable
to load script" or a blank reload. Restart it from the repo root (the
`Start-Process` line below), then `adb reverse tcp:8085 tcp:8085` again. After a
native dependency is added, install a fresh debug build before blaming Metro.

⚠️ **An APK built before the port moved still looks for 8081.** The port is
baked into the debug build, so an install that predates the change shows
"Unable to load script" (or quietly runs the bundle in its assets) while Metro
is up and healthy on 8085. Install the current debug APK, then
`adb reverse tcp:8085 tcp:8085` (found 20/10/2026: the emulator's install dated
from 28/09).

**Before assuming a stray Metro is ours.** Ports 8081–8084 belong to the SUMO
apps under `D:\Projects\SUMO` — SumoEats merchant 8081, SumoEats user 8082,
Sumo Ordering merchant 8083, the EPOS tablet app 8084. They are different
projects — never kill one. Check whose a port is first:

```powershell
Get-NetTCPConnection -LocalPort 8085 -State Listen |
  ForEach-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)").CommandLine }
```

**Leave nothing on the desktop but what is being used.** The owner works on the
same screen while these run, so the only windows that may appear are Metro,
printing in its own console, and — when the app is being run to be used — the
emulator's device screen. Never the emulator's log console (the window full of
`Ignore IPv6 address` and `Boot completed in … ms`), never a console whose
output was redirected to a file and so shows nothing, and never a second window
opened just to tail a log.

```powershell
# Interactive: device screen visible, log console suppressed by -WindowStyle Hidden.
Start-Process "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" `
  -ArgumentList '-avd','Fixora_Pixel7','-no-snapshot-load','-no-boot-anim','-gpu','swiftshader_indirect' `
  -WindowStyle Hidden
# Verification: add -no-window. adb, uiautomator dump and screencap all work headless.
Start-Process "cmd.exe" -ArgumentList '/k','title Metro - Fixora && npx react-native start' `
  -WorkingDirectory "D:\kano\Fixora"
```

To clear a window that is already up, hide it — `ShowWindow(handle, 0)` — rather
than killing the process: killing the emulator or Metro destroys a running
verification along with the device state set up for it. `PseudoConsoleWindow`
and `ConsoleWindowClass` are the log console; `Qt653QWindowIcon` and
`Qt653QWindowToolSaveBits` are the device screen. A Windows Terminal *tab* has
no window handle of its own — ask for it to be closed.

**Release builds** are not one of the gates and not a routine step. How to
sign, version, build and smoke-test one is `docs/RELEASE.md`; in short, from
`android/`:

```bash
./gradlew assembleRelease    # APK to install: android/app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease      # what Play takes: android/app/build/outputs/bundle/release/app-release.aab
```

Never `-q` here: it hides the warning that the build fell back to the debug key
because the four `FIXORA_UPLOAD_*` properties are not in
`~/.gradle/gradle.properties`. A release install replaces the debug one and
does not use Metro — reinstall the debug APK afterwards. R8 is on, so a green
build proves nothing about what it removed: smoke-test a release install
(`docs/RELEASE.md` section 4).

---

## 6. How we debug on a device

**Nothing is done until it has been run on the emulator.** Tests passing is not
evidence that a screen works; several real defects in this flow passed every unit
test and were only visible on the device.

**One pass, at 1080×2400 Dark (owner, 21/10/2026).** The device's own size:
the whole functional workflow of the slice — every state, dialogs, long text,
Android back, no accidental navigation, no crash — with a look at contrast,
hierarchy and states while there. **Small screens are made safe by
calculation, not a device test:** no fixed widths, and node `bounds` measured
here (÷ 2.625 for dp) to work out what a 360dp width leaves room for. Light is
not a separate pass. (20/10/2026 had briefly made 360×640 Dark the one pass —
the 3E-8 … 3D-10 records were run that way; the phase records before them list
the three passes run at the time.) The code must still suit every size and
both modes — theme tokens only, nothing that reads in one mode only.

Start the emulator. `Fixora_Pixel7` is this project's AVD — a Pixel 7, API 36,
1080x2400 at 420dpi, created to match `targetSdk` — and is what device
verification runs on; the others on this machine (`Small_Phone`, `Pixel_Tablet`,
`Small_Tablet`, `Resizable_Experimental`, `SumoEats_Pixel`) belong to other work.
Launch it as shown in section 5, so its log console never appears:

```bash
adb devices
adb shell pm clear com.fixora          # fresh install state, back to onboarding
adb logcat -c                          # clear before an action you want to measure
```

**`.uitap.sh` is the workhorse.** `source .uitap.sh` gives two functions:

- `dump` — prints the whole view hierarchy as XML
- `tapnode "<exact text or content-desc>"` — taps the centre of the first match

```bash
source .uitap.sh
tapnode "Request a Service"

# every accessible name on screen
dump | tr '<' '\n<' | grep -oE 'content-desc="[^"]+"' | sort -u

# selection state of a group
dump | tr '<' '\n<' | grep -E 'content-desc="(Low|Medium|High)"' \
  | grep -oE 'content-desc="[^"]*"|checked="[a-z]*"' | paste - -
```

`MSYS_NO_PATHCONV=1` is required in front of any `adb` command carrying an
`/sdcard/...` path, or Git Bash rewrites it into a Windows path.

Other recipes that keep coming up:

```bash
adb shell cmd uimode night yes|no              # live theme switch, no restart
adb shell wm size 360x640 && adb shell wm density 160     # small screen
adb shell wm size reset && adb shell wm density reset
adb shell input tap X Y ; adb shell input text "with%sspaces" ; adb shell input keyevent 111  # 111 = ESC, closes the keyboard
MSYS_NO_PATHCONV=1 adb shell screencap -p /sdcard/s.png
MSYS_NO_PATHCONV=1 adb pull /sdcard/s.png "$TEMP/s.png"
```

Changing `wm size` drops the app to the launcher — relaunch with `am start`.

**Measure, do not eyeball.** Two "clipped text" findings turned out to be
artefacts of the downscaled screenshot. Both times the answer came from measuring
the node's `bounds` (and dividing by the density: 420 → ÷2.625) or from
re-rendering at the same dp width with twice the pixels. Real truncation and a
blurry capture look identical at 1×.

**Count service calls to prove retry.** Clear logcat, tap retry, then
`adb logcat -d | grep -c "query failed"`. That is evidence; "the button is there"
is not.

**Deterministic failures.** Either raise `AppConfig.mock.failureRate` to 1, or
patch a single mock method to throw and mark it `// TEMPORARY-VERIFICATION-ONLY`.
Back the file up first (`cp x x.bak`), restore it after, and confirm with
`grep -rn "TEMPORARY-VERIFICATION" src/`. Leaving a lever flipped is the easiest
way to ship a fake.

**Expect a LogBox overlay on any failure in a debug build.** The shared logger
calls `console.error`, so RN draws a red box containing the raw error text. It is
dev-only and is not the screen leaking — check which node the text belongs to
before treating it as a defect.

---

## 7. Environment

Windows 11. Shell is Git Bash (POSIX) or PowerShell; the adb recipes above assume
Git Bash. Node 24.19, npm 11.17. React Native 0.86.2, React 19.2.3, TypeScript 5.8.

**Android toolchain is pinned machine-wide, never per project.** The pin lives in
`C:\Users\DELL\.gradle\gradle.properties`: `org.gradle.java.home` →
Temurin JDK 17, plus `-Xmx6g`, parallel, caching, `workers.max=8`. Gradle 9.0.0
from one shared wrapper cache.

The precedence here is counter-intuitive and was verified: **the global
`gradle.properties` outranks a project's own**, and a command-line
`-Dorg.gradle.java.home=` is ignored. A project cannot override it. So when a
gradlew or JDK problem appears in *any* project, fix the global file — a
per-project override will not work. Never re-add a per-project JDK pin or a
vendored Gradle zip. Confirm the pin is live with `gradlew --version`, which must
print `Daemon JVM: ... (from org.gradle.java.home)`.

Android Studio's Gradle JDK (`android/.idea/gradle.xml` → `gradleJvm`) must stay
in sync with it; AS's embedded `jbr-25` must not be selected.

This machine also holds the SumoEats pair under `D:\Projects\SUMO`
(`sumoeatsUserWrapperApp`, `SumoEatsMerchantApp`) and the Sumo Ordering apps
under `D:\Projects\SUMO\SUMO_ORDERING` — **different** codebases, whose Metros
hold 8081–8084 (section 5). "The user app and the merchant app" always means the
SumoEats pair, not Fixora. Their running context doc is
`D:\Projects\SUMO\docs\status\SUMO_HANDOFF.md`. Fixora and the SumoEats pair
share the same Android config, which is why one toolchain serves them.

**Standing preference:** when an environment problem is solved, solve it
globally and delete the per-project workaround it replaces — then verify the
global path is the one actually in effect. Flag genuinely destructive steps
(deleting a large vendored file, wiping a cache) before doing them.

---

## 8. Git

Git Flow, documented in `docs/BRANCHING.md`.

- `main` — production, tagged releases
- `develop` — integration; **branch new work from here**
- `release/1.0.0` — Phase 1 launch train, treat as a placeholder
- `feature/` `bugfix/` `hotfix/` `chore/` `docs/` — `<type>/<ticket-id>-<kebab-description>`

Never commit directly to `main` or `develop`. A release or hotfix merged into
`main` must also be back-merged into `develop`.

Remote is `https://github.com/vivek-chovatiya/Fixora-App.git`. The repo is owned
by **vivek-chovatiya** while the local identity is Dhananjay Chauhan, so write
access depends on collaborator permission. Git Credential Manager is configured
repo-locally and holds a working credential — `git push` succeeds unattended.
Never write a token into `.git/config` or a remote URL. If the credential is ever
revoked, run with `GIT_TERMINAL_PROMPT=0` so it fails fast instead of hanging,
and ask rather than guessing.

**Commits carry no AI or tool attribution.** No `Co-Authored-By: Claude …`
trailer, no "Generated with Claude Code", no mention of Claude, Opus or
Anthropic — in commit messages, PR bodies, or any repo content. This is a
standing instruction from the owner and it overrides the default trailer
behaviour. Commit history is a professional artifact reviewed by colleagues.
If a trailer is ever committed but not pushed, rewrite it out — stripping only
lines beginning `Co-Authored-By:`, never keyword-filtering on "Claude", because
`CLAUDE.md` is a real tracked filename that legitimately appears in commit bodies.

Messages are Conventional Commits with a real prose body: what changed, and why.

---

## 9. Where the product is now

Auth and onboarding are done. The customer flow runs end to end:

```
Home → Categories → Sub Categories → Create Request → Service Address
     → Preferred Vendor → Confirmation → createRequest() → Request Submitted
     → Request Details   (also opened from Home's recent requests)
Home category tile → that category's Sub Categories (3D-10)
Service Address → Choose Saved Address → back, address filled (3D-10)

Requests tab → My Requests (§23) → Request Details
     (COMPLETED / CLOSED with a record: the Payment group, read-only — 3E-9)

Request Details (COMPLETED / CLOSED) → Rate Your Experience (§24)
     → submitReview() → read-only review → Back to Request Details

Request Details (nobody has accepted yet) → Cancel request → confirm
     → cancelRequest() → "Request cancelled"; Home and My Requests told (3D-11)

Home bell → Notifications → mark read → Request Details (3F-2)

Profile tab (§25) → details from the session → Log out → confirm
     → clear the unsent draft → signOut() → root navigator → role selection
```

The vendor side, after registration and profile setup (3E-1), each phase below:

```
Vendor sign in → phone + 6-digit code; on a device signed in before, the code alone (3C-2)
Dashboard (3E-2) → bell → Notifications → Vendor Request Details (3F-2)
     (while new requests are off: a notice with Turn on — 3E-12)
Requests tab (3E-3) → Vendor Request Details → Accept / Reject (3E-4)
     → Start work → Mark completed (3E-5) → Complete Work form → confirm
     → completeRequest(id, completion) → back, completed with its Payment card (3E-9)
Requests tab → Rejected → a declined request, read-only (3E-13)
Team tab (3E-7) → Edit team member, with a photo (3E-13) → Disable / Enable member (3E-11)
Profile tab → Availability card: Accepting new requests switch (3E-12)
            → Edit working hours → Working hours (3E-12)
            → Shop images card → Manage shop images (3E-10)
            → Manage team (switches to the Team tab)
            → Customer reviews, with the rating breakdown (3E-6, 3E-11)
            → Reports: Today / This week / This month (3E-8)
            → Edit business profile · Log out
```

Under both: §54's events and crash handling behind seams (3F-1), and the
offline banner above everything while the device is offline (3G-1).

Live tracking is Phase 2. Since 3D-11 (21/10/2026) a customer may cancel a
request until a professional accepts it (owner decision); after that there is
still no cancel (see "Customer actions" below).

**Service contracts** (`src/shared/services/types/`):

| Service | Methods |
|---|---|
| `AuthService` | customer OTP, vendor registration / OTP / auth code; since 3C-2 the vendor auth code is exactly six digits, always a string (`AppConfig.vendorAuthCode.length`), sent bare, and a wrong, revoked or unknown-number sign in is `unauthorized` alike |
| `CategoryService` | `listServiceCategories()`, `listSubCategories(categoryId)` |
| `RequestService` | `listRecentRequests(limit)`, `listRequests(filter, { page, pageSize })` → `Page`, `getRequest(requestId)` → record or `null`, `createRequest(input)`; since 3E-9 a completed record may carry `payment?` (`CustomerPaymentRecord`: amount, currency, status, method label — no notes, no method id); since 3D-11 `cancelRequest(requestId)` → `{ outcome: 'cancelled', request }` or `{ outcome: 'refused', reason: 'notCancellable' }` |
| `ReviewService` | customer: `getReview(requestId)` → review or `null`, `submitReview({ requestId, rating, comment? })`; vendor (3E-6): `getVendorReviews()` → `{ averageRating, totalReviews, ratingBreakdown, reviews }` — `ratingBreakdown` (3E-11) is five `{ stars, count }`, five stars first, zeros included |
| `AddressService`, `LocationService` | address search and reverse lookup; device coordinates (mock only — no geolocation library) |
| `VendorService` | `listEligibleVendors(categoryId, subCategoryId)` |
| `VendorProfileService` (3E-1) | `getProfile()`, `saveProfile(update)`; since 3E-10 `VendorProfile.shopImageUrls` (always a list) and `updateShopImages(imageUrls)` — replaces the whole list, answers with the whole profile; `saveProfile` never carries shop images; since 3E-12 `VendorProfile.acceptingRequests` and `workingHours` (always seven days, Monday first), `setAcceptingRequests(accepting)` and `updateWorkingHours(days)`, each answering with the whole profile — neither is ever carried by `saveProfile` |
| `VendorRequestService` (3E-3 to 3E-5) | `listRequests()`, `getRequest(id)`, `acceptRequest(id)`, `rejectRequest(id)`, `startRequest(id)`; since 3E-9 `completeRequest(requestId, completion)` with `VendorCompletionInput` and `listPaymentMethods()`; since 3E-13 `listRequests()` also answers `rejected` (this vendor's declines, latest first) and a summary may carry `rejectedAt?` |
| `VendorTeamService` (3E-7) | `listMembers()`, `addMember(input)`, `updateMember(memberId, input)`, `removeMember(memberId)` — every mutation answers with the whole team; since 3E-11 `TeamMember.status` (a plain string) and `setMemberStatus(memberId, 'ACTIVE' \| 'DISABLED')`; since 3E-13 `TeamMember.photoUrl?` (an http(s) URL; absent on an edit removes it) |
| `VendorReportService` (3E-8) | `getReport(period)` → `VendorReport` — `'today' \| 'week' \| 'month'` sent as a key; the server's figures, scoped by the session |
| `AnalyticsService`, `CrashReporter` (3F-1) | `track(event, properties?)`, `identify(user \| null)`; `recordError(error, { fatal?, source? })`, `setUser(user \| null)` — synchronous, fire and forget, never throwing, reached through `shared/services/telemetry.ts` only |
| `ImageService` | pick / compress / validate / upload+progress / retry / remove |
| `NotificationService`, `PermissionService` | since 3F-2 a session-scoped inbox: `list(page)` newest first, `getUnreadCount()`, `markAsRead(id)`, `markAllAsRead()`, `remove(id)` (on the contract, offered nowhere), push registration inert; camera, location, notifications |
| `NetworkStatusService` (3G-1) | `getCurrent()` → `{ isOffline }`, `subscribe(listener)` → unsubscribe; the device implementation only (NetInfo), registered outside the mock/live switch, read by `useNetworkStatus` |

**The create-request payload** — the thing most worth not breaking:

```ts
{
  categoryId, subCategoryId,        // ids only, from the route
  priority,                          // LOW | MEDIUM | HIGH | EMERGENCY (§15)
  preferredDate?,                    // YYYY-MM-DD, local calendar date
  preferredTime?,                    // HH:mm, 24-hour
  imageUrls?,                        // remote URLs, uploaded before submit (§16)
  notes?,                            // exactly as typed, never trimmed
  address,                           // RequestAddress; formattedAddress required, coordinates optional
  vendorId?,                         // present = directed; ABSENT = open dispatch (§18A)
}
```

`vendorId` absent is the message. Not `null`, not `""`, not `"any"` — the backend
reads absence as open dispatch and broadcasts. This answers §18A.6's open
question in favour of the single-call form; if the backend wants the two-call
form instead, §18A.6 says the UI is unaffected and only that field and the call
behind it move.

**Flow state.** `RequestDraftContext` (`src/features/customer/state/`) carries
the one in-progress request from the form to the screen that submits it, and is
persisted through `RequestDraftStorage` so an interrupted request can be resumed.
It is mounted around the customer stack — not params (navigation state is
serialised, logged and restorable, which is no place for someone's notes, photos
or address), not Redux. `completionOf(draft)` is the only answer to "is this
ready?". Since 3D-7 the draft belongs to one customer: `CustomerNavigator`
passes the session's user id to `RequestDraftProvider` (`ownerId`), the draft is
saved with it (schema v3), and a draft saved for anyone else — or before owners
were recorded — is discarded and removed on read rather than resumed.
Since 3D-10 the draft also belongs to **one service**: a Create Request form
merges only into a draft for its own sub-category, writes nothing while another
service's draft is on hand, and replaces it only on Continue — carrying address
and professional from its own draft alone (see "Customer fixes and the
saved-address picker"). Since 3D-11 (21/10/2026), owner decision: a form with
no draft of its own takes the other draft's address on Continue — never its
professional (see "Customer cancel and the carried address").

**A submitted request is not a draft.** A successful submit clears the draft and
leaves a memory-only `submitted` handoff for the success screen. From then on a
request is read from `RequestService.getRequest` by reference: Request Details
never reads the draft or the handoff, and its route carries only `requestId`.

**Request status is derived, never stored.** The contract's `status` is a
section 21 constant (`RequestStatus`: typed as §21's list, still open to values
§21 does not name). What the customer sees comes from
`features/customer/constants/requestStatus.ts`: `requestStateOf(status, dispatch)`
turns the backend status plus whether a professional was chosen into a stage —
`submitted`, `searching`, `awaiting_vendor`, `assigned`, `in_progress`,
`completed` — or an off-path state (`cancelled`, `rejected`, `on_hold`), or
`unknown`. The owner chose this on 2026-09-11 over storing semantic statuses,
because §21 says the frontend never invents statuses and dispatch is routing,
not status. All status words live in `CUSTOMER_COPY.requestStatus`.

Frontend-only assumptions, none of them backed by a real API:

- `CREATED` → submitted; `PENDING_VENDOR` → searching (open) or awaiting response
  (directed); `ACCEPTED` → assigned; `COMPLETED` and `CLOSED` → completed.
- Since Phase 3D-5 a request summary carries `preferredVendor` (absent = open
  dispatch, as on the record), so cards on Home and My Requests say "Searching"
  or "Awaiting response" exactly as Request Details does. `awaiting_professional`
  ("Awaiting professional") remains only for a caller that cannot know the
  dispatch mode.
- A created mock request starts at `PENDING_VENDOR` (the single-call form of
  §18A.6 dispatches on creation). The mock never advances a status: no timers,
  no polling, no transitions. Since 3D-11 (21/10/2026) the customer's own
  cancellation is the one change: `cancelRequest` moves `CREATED` or
  `PENDING_VENDOR` to `CANCELLED`. Nothing moves on its own.
- An assigned professional is shown only for assigned, in progress or completed,
  even when the record carries a vendor name.
- The progress path is the usual route, not a promise; §20 lets a directed
  request fall back to open dispatch, and the next read shows whatever the backend
  says. "Professional on the way" is deliberately absent — no status supports it.

**My Requests (§23).** Established 2026-09-21 (Phase 3D-5).

- **What §23 asks, and what was built.** Screen "My Requests"; filters All,
  Active, Completed, Cancelled; each card shows service, vendor, status, date and
  priority; card → Request Details; pagination supported. All of it is built,
  and nothing else is: no search, no sort control, no per-card actions (3D-3),
  and no "See all" on Home — §10 names none, and Home's docblock records that the
  tab bar owns that destination.
- **Route.** The Requests tab (§26), `CustomerTabParamList.Requests` →
  `features/customer/screens/MyRequestsScreen.tsx`, replacing the placeholder. A
  card calls `navigate('RequestDetails', { requestId })` — the reference only.
- **Contract.** `RequestService.listRequests(filter, { page, pageSize })` →
  `Page<CustomerRequest>`, on the shared `Page` type (`items`, `page`, `pageSize`,
  `total`, `hasMore`). `RequestHistoryFilter` is §23's four names, sent as names;
  the service decides what each covers. A page past the last resolves empty; a
  malformed page or filter is refused as a validation error.
- **Filter mapping (mock; owner decision 2026-09-21).** Active: `CREATED`,
  `PENDING_VENDOR`, `ACCEPTED`, `IN_PROGRESS`, `ON_HOLD`. Completed: `COMPLETED`,
  `CLOSED`. Cancelled: `CANCELLED`. `REJECTED` and any status §21 does not name
  appear under All only — never as completed.
- **Ordering.** The table's newest-first by `createdAt`, recomputed on every page
  read, the same order Home's recent list uses. The screen never sorts.
- **Paging.** Offset pages of `AppConfig.pagination.defaultPageSize` (20). The
  next page is asked for with a "Show more requests" button, never on scroll: §23
  requires pagination but not infinite scroll, and a button loads nothing
  unasked and is reachable by a screen reader. `usePaginatedQuery` now:
  - lets a filter change or refresh replace a load in flight (the old answer is
    discarded), while a next-page load waits its turn, so one is never requested
    twice at once;
  - clears the list when a new question starts (a filter change), so a failed
    filter never shows the previous filter's requests;
  - reports `failedDuring` (`load` / `refresh` / `more`), and `retry` repeats
    exactly that — a failed next page is fetched again and what was shown stays;
  - with `getKey`, drops a request a later page repeats (pages shift by one
    when a request is raised between two reads).
- **States.** The heading and filters are always drawn. Four placeholder cards
  while the first page loads, with the list named "Loading your requests" and
  busy. A first-page failure shows `ErrorState` with a retry that re-reads page
  one, and no pull-to-refresh over it. No requests at all shows §48's sentence
  and "Request a Service" (→ Categories), the same as Home; a filter with no
  matches says so ("No active requests") with no action. A failed refresh or
  next page keeps the list and shows an inline error with a retry beneath it.
  The next page shows an inline `Loader` ("Loading more requests").
- **Refresh.** Pull re-reads page one from the service and replaces the list;
  nothing is mutated or advanced.
- **Relationship to 3D-4.** Reads the same table `MockRequestHistoryStorage`
  restores. There is no second store, and nothing about the screen — filter,
  scroll position, pages — is saved.
- **Scoping.** Unchanged from 3D-4: the customer session's id decides the table.
  A vendor session has no customer history and never mounts this screen.
- **Backend reconciliation.** `ApiRequestService.listRequests` becomes a paged
  GET with the filter name; the backend owns the mapping and the order. If it
  offers cursor paging instead, only the service and `usePaginatedQuery`'s fetch
  change.
- **Deferred.** Nothing §23 names. Refreshing on tab focus is an open question
  (below).

**Customer profile and logout (§25).** Established 2026-09-22 (Phase 3D-7).
Nothing here is backed by a real API.

- **Scope (owner decision).** Read-only profile plus Log out. §25 also lists Edit
  Profile, Change Profile Image and Manage Addresses; all three are deferred with
  no dead controls for them, and §25's Future items (favorites, saved services,
  settings, notification preferences) are not built. No account deletion, phone
  change or passwords (§7A has none).
- **Where.** Profile tab → `features/customer/screens/CustomerProfileScreen.tsx`,
  replacing the placeholder. `useCustomerProfile` (the rules, `profileOf`) and
  `useCustomerLogout` in `features/customer/hooks/`; copy in
  `CUSTOMER_COPY.profile`.
- **Data source.** The session's `AuthUser` only (`useAuthSession`). No
  ProfileService and no second copy of the user anywhere; a future edit updates
  the session (`userUpdated`) and the screen follows.
- **What it shows.** Avatar, a heading, and a "Contact details" card with Phone
  and, only when the account has one, Email. The phone is shown exactly as the
  backend holds it.
- **Empty name.** First and last name, trimmed, blanks dropped. When both are
  blank the phone number is the heading and the avatar shows the profile glyph
  (`Avatar`'s no-initials fallback, labelled "Profile picture").
- **Email.** Shown when present and non-blank; otherwise the row is hidden.
  Never "Add email".
- **Avatar.** Initials ("Asha Patel profile picture") or the glyph. There is no
  profile image field on `AuthUser` and no upload contract, so no image.
- **Logout confirmation.** Shared `ConfirmDialog` (new, `shared/components`; §44
  lists a confirmation dialog): "Log out?" / "You will need to sign in again to
  access your account." / Cancel · Log out. A platform `Modal`, named by its
  title, title as a heading; Cancel is secondary and first, Log out is the
  danger button. Cancel, the back button and the backdrop all cancel; none of
  them works while logging out, when Log out shows busy and Cancel is disabled.
- **Logout sequence.** Confirm → `clearDraft()` (awaited) → `useSignOut()` →
  the root navigator follows the cleared session to role selection. No screen
  navigates. One logout at a time (a ref lock plus the dialog's busy state). The
  existing sign-out behaviour is unchanged: a server that refuses still signs
  out locally; a device that cannot clear the session leaves the customer signed
  in, closes the dialog and says "We could not log you out" beside Log out.
- **Draft isolation.** Logout clears the unsent draft, in memory and on the
  device. If that removal fails, the draft still carries its owner's id, so the
  next customer's provider discards it unread and deletes it — one customer's
  draft can never be offered to another. (The same customer signing back in
  after a failed removal would see it again; that is the only cost of a failure.)
- **Preserved at logout.** Submitted requests (3D-4, `mock-request-history/<id>`)
  and reviews (3D-6, `mock-request-reviews/<id>`) stay on the device under the
  customer's own keys, and are there again when they sign back in. Logging out
  is not deleting an account.
- **Mock customers.** `mockAuthData` now seeds three customers (code 123456):
  9876543210 Asha Patel; 9876543211 a long name with an email; 9876543212 no
  name and no email — so every profile edge, and a second customer on the same
  device, is reachable by signing in.
- **Deferred then, built since.** Edit Profile and Profile Image were deferred
  here for want of a contract and are Phase 3D-8; Manage Addresses is Phase
  3D-9. Both are below.

**Editing the profile, and the picture (§25).** Established 2026-09-29 (Phase
3D-8). Nothing here is backed by a real API.

- **What §25 says, all of it.** "Displays: Profile Image, Name, Email, Phone,
  Addresses, Logout. Actions: Edit Profile, Change Profile Image, Manage
  Addresses, Logout." That is the whole section. §26 puts Edit Profile below
  Profile as a pushed screen and gives the image no screen of its own. §9's
  field list (first name, last name, email) survives only as "the record of what
  a profile screen may later collect"; §7A removed the password from it and made
  the phone the identity. §16's image rules are about a *request's* photographs.
- **Owner decisions, 2026-09-29.** The image control lives on Profile, not in
  the form, and saves as soon as it is chosen. Name and email are editable, the
  phone is not. Leaving the form with unsaved edits asks first.
- **Decisions taken here, for want of a section.** Email is optional and
  clearing it removes it. Changing an email needs no verification in Phase 1 —
  §7A verifies a phone and says nothing about addresses. A picture can be
  removed. A failed upload keeps the chosen image for a retry. A first name is
  required and a last name is not, because plenty of people have one name.
  `PROFILE_NAME_MAX_LENGTH` is 50 and is the app's, not the backend's.
- **Contract.** `shared/services/types/ProfileService.ts`, its own service —
  never a method on `AuthService`. Proving who somebody is and editing their
  name are different operations that will be different endpoints, and a name
  edit must not sit on the interface that issues credentials. Every operation
  returns the whole updated `AuthUser` rather than an acknowledgement, so the
  backend stays the authority over its own normalisation and the device adopts
  the result instead of guessing it.
- **One identity, still.** There is no profile store. `MockProfileService`
  reads the session, returns a changed copy and writes nothing; the caller
  persists. `updateSessionUser` (authThunks) writes `SessionStorage` and *then*
  dispatches `userUpdated` — the same order every other session change uses, so
  a profile that is on screen is already on disk.
- **`AuthUser.avatarUrl`.** The one shape change this phase needed. A remote URL
  and never a `file://` path: a local URI belongs to the device that picked it,
  so persisting one would restore a broken image next launch and show nothing on
  another device. `SessionStorage`'s parser only requires a token and a user, so
  no migration was needed.
- **Where.** `EditProfileScreen` on the `EditProfile` route (no params — whose
  profile it is, is whoever is signed in). `useUpdateProfile` and
  `useProfileImage` in `features/customer/hooks/`; `profileSchemas.ts` for the
  form; copy in `CUSTOMER_COPY.editProfile` and additions to
  `CUSTOMER_COPY.profile`.
- **The form.** Seeded once from the session and deliberately not re-seeded —
  the session is about to change underneath it. Local edits never touch the
  stored profile; a refusal keeps what was typed, stays put and shows the error
  above Save. Save cannot be pressed twice. The phone is a summary row rather
  than a disabled field, because a dimmed box invites a tap and then refuses it.
- **The picture.** `ImageService` does all of it — pick, validate, compress,
  upload — and no picker library is imported here, exactly as for request
  photos. The account changes last and only on success, so the avatar shows the
  stored picture until a new one is genuinely stored; a failed one appears
  beside its failure with Try again, never as the avatar. Backing out of the
  picker is not a failure. Compression happens per attempt, so a retry
  compresses the original rather than compounding on an already-compressed file.
- **Not built.** Email verification; changing the phone; cropping or rotating
  a picture (`ImageService` has no such operation); any §25 "Future" item.

**Saved addresses (§18, reached from §25).** Established 2026-09-29 (Phase
3D-9). Nothing here is backed by a real API.

- **What the Bible says.** §18: "Phase 1 supports: address selection, address
  display, add address, edit address, delete address, default address." §25
  lists Manage Addresses; §26 names the route `Addresses`, below Profile. §63
  puts "Home / Office / Other, map selection, GPS coordinates, current location"
  in **Phase 2**.
- **Owner decisions, 2026-09-29.** No labels at all — §63 makes them Phase 2.
  `placeId` and coordinates are kept when the source supplied them, never typed
  and never shown. Saved addresses are **not** wired into `ServiceAddressScreen`
  in this phase; the request flow is untouched.
- **Contract.** `shared/services/types/AddressBookService.ts`. `SavedAddress` is
  `id`, `formattedAddress`, optional `addressLine` / `locality` / `postalCode`,
  `isDefault`, optional `placeId` / `latitude` / `longitude`. No label, and no
  `createdAt` / `updatedAt` — nothing displays or sorts by them, and insertion
  order in the stored array is what ordering needs. `SavedAddressInput` omits
  `id` and `isDefault`, so saving an edit can never move the default.
- **Not `RequestAddress & {…}`.** Different lifetimes, different required
  fields. A request carries its address **by value** (see `CreateRequestInput`)
  and refers to no saved record, so editing or deleting a saved address can
  never alter a request already sent. `RequestAddress` was not changed.
- **Its own service.** `AddressBookService`, never CRUD on `AddressService`. That
  one is a stateless gazetteer that does not know who is asking; this one owns a
  customer's collection. No `getAddress(id)` — the list is already in hand
  wherever one is edited. Every mutation returns the **whole list**, as
  `ProfileService` returns the whole `AuthUser`: changing one address can change
  another, so the caller adopts the service's answer rather than recomputing it.
- **The rules, all in `MockAddressBookService`.** The first address is the
  default; a later one never displaces it. Exactly one default while any exist,
  none when none do. `setDefaultAddress` sets and clears in one pass. Deleting
  the default promotes the most recently added of those remaining. Editing keeps
  the default where it was. Ordering is the default first, then insertion order.
  It re-checks `isUsableAddress` itself, and refuses with `unauthorized` when
  nobody is signed in.
- **Storage.** `@fixora/mock-saved-addresses/<customerId>`, schema version 1,
  `MockSavedAddressStorage` — the same shape as request history and reviews:
  per customer, versioned, strict decode, never throws. A record that does not
  decode is dropped; a duplicated id keeps the first; half a coordinate pair is
  dropped; "exactly one default" is repaired on read, because a dropped record
  may have been the default. Nothing is written into the draft, the history or
  the reviews. **Kept across logout**, like history and reviews — the draft is
  the only thing logout clears.
- **Screens.** `ManageAddressesScreen` on `Addresses`; `EditAddressScreen` on
  `EditAddress` (`addressId` absent = add). One form screen, because add and
  edit differ only in what the form opens with. The list re-reads on returning
  focus but **not** on first focus — the query has just read on mount, and a
  second read would both double the call and hide a failure behind a retry.
- **Finding an address** reuses `useAddressSearch` / `AddressService` and
  `isUsableAddress` (8–240) with `serviceAddress.tooShort` — no second gazetteer
  and no second rule. A chosen suggestion's metadata is kept while the box still
  reads as it did when chosen; retyping by hand drops it, because coordinates
  beside a rewritten line would point at the old place.
- **The default is words, not colour.** A "Default" badge with a check glyph,
  and the card's text announces "…. Default address". With no labels, the
  default is the only thing distinguishing one card from another.
- **Every action names its address.** `Button` gained an optional
  `accessibilityLabel` (defaulting to `label`) so "Edit" beside five addresses
  reads as "Edit: 412, 5th Block…" to a screen reader. It must always still
  contain the visible label, so voice control can reach it by the word shown.
- **Nothing optimistic.** The list changes when the service answers. One change
  at a time; while it runs every action is disabled and only its own row shows
  busy. A failed change leaves the list on screen with an error above it —
  losing the list and failing one change are drawn differently.
- **Leaving the form** with an unsaved address asks first, through
  `beforeRemove` — the Android back button is guarded too, the lesson 3D-8 paid
  for.
- **Not built.** Labels (Home / Office / Other or custom), maps, a GPS or
  current-location picker, choosing a saved address while raising a request,
  contact name or phone, duplicate detection, a maximum count, address history.
  Since 3D-10 a saved address can be chosen on Service Address (below).
- **Since 3G-2 (21/10/2026)** the Add / Edit Address screen's two service calls
  live in `useSavedAddressEditor`. The screen had called `getService` itself
  since this phase — a CLAUDE.md §4 break that every suite passed with until
  the import-boundary test found it.

**Customer review (§24).** Established 2026-09-22 (Phase 3D-6). Nothing here is
backed by a real API.

- **What §24 says, all of it.** A review "becomes available only after the
  request reaches the appropriate completed/closed state"; the screen is "Rate
  Your Experience"; the fields are "Rating (1–5 stars), Comment, Optional Images
  (if supported)"; "One request = ONE REVIEW ONLY"; "Review Submitted →
  Read-only Review". Around it: §2 ("Customer reviews vendor"), §56 ("Submit
  Review"), §22's timeline ends "Review Submitted", §41 has the vendor's side
  and says a vendor cannot edit customer reviews, §54 names a
  `review_submitted` event.
- **Owner decisions, 2026-09-22.** The comment is optional (§24 marks only the
  images optional; the owner chose optional). Both `COMPLETED` and `CLOSED` are
  reviewable. Review photos are deferred.
- **Eligibility — one rule.** `features/customer/constants/requestReview.ts`:
  `isReviewableStatus(status)` (`COMPLETED` or `CLOSED`, case- and
  padding-insensitive) and `reviewAvailabilityOf(status, review)` →
  `unavailable` | `checking` | `open` | `reviewed`. Request Details and the review
  screen both ask it; neither compares a status. Every other §21 status, and any
  status §21 does not name, is `unavailable` — it fails closed. A review that
  exists is `reviewed` whatever the status. It lives in its own file rather than
  beside `hasAssignedProfessional` in `requestStatus.ts` (as 3D-3 anticipated),
  because a review is its own domain and the status module stays unaware of it.
- **Contract.** `shared/services/types/ReviewService.ts`, its own service —
  never a method or field on `RequestService`, and never a status. `RequestReview`
  is `{ requestId, rating, comment?, submittedAt }`; `SubmitReviewInput` is
  `{ requestId, rating, comment? }`. The request's own reference is the
  association, so there is no review id. No update or delete: §24 gives a
  customer neither. `REVIEW_RATING_MIN`/`MAX` (1 and 5) are §24's scale.
- **Rating.** Whole stars, 1 to 5, required. Nothing is preselected (the form
  holds `NO_RATING` = 0, which the schema refuses with "Choose a rating from 1 to
  5 stars."). `StarRating` draws five stars, each a radio named "n out of 5
  stars" in a radiogroup named "Rating", checked when it is the rating, at least
  a minimum touch target; chosen stars are filled glyphs and unchosen outlines
  (shape, not colour alone), and the rating is written underneath in words.
  Read-only it is one node: "Rating: 4 out of 5 stars".
- **Comment.** Optional. Sent exactly as typed, or left off the payload when it
  is empty or only whitespace (`buildSubmitReviewInput`). No minimum length —
  §24 sets none. Ceiling `REVIEW_COMMENT_MAX_LENGTH` = the request notes' 500,
  reused rather than invented; a counter appears in the last 100 characters and
  the schema explains an overrun (no hard `maxLength`, as on the notes box).
- **One review per request, held three ways.** The Submit button is
  `isLoading` while the call is out, and a ref blocks a second tap landing in the
  same frame; the mock refuses a second review with `conflict` (checked and
  claimed with nothing awaited in between, so two racing calls let exactly one
  through); and success replaces the form with the read-only review. A `conflict`
  or `notFound` on submit re-reads the request and the review, so the screen then
  shows the review that exists (or that the request cannot be reviewed) instead
  of an error.
- **The mock mirrors the server's rules, not the app's.** `MockReviewService`
  refuses a request that is not `COMPLETED`/`CLOSED` (`conflict`), one that does
  not exist (`notFound`), a rating outside 1–5 (`validation`) and a second review
  (`conflict`), reading the request through `RequestService` as a backend reads
  its own table. It keeps its own copy of the status rule on purpose: the app's
  copy decides what to show, the mock's stands for the server's refusal.
- **What a review never touches.** The request's status, record and history;
  any vendor's rating or review count (§41's averages are the backend's); the
  draft; navigation params (the route carries `requestId` only); notifications;
  payments. The §22 timeline and §54 analytics event are not built.
- **Screens.** `RequestReviewScreen` (route `RequestReview: { requestId }`,
  pushed from Request Details) reads the request and the review itself. States:
  loading (placeholders, "Loading the review for this request", busy); request
  failed or review check failed → `ErrorState` with retry; not found →
  `EmptyState` with Back; not completed/closed → "This request cannot be reviewed
  yet" with Back to request; already reviewed → read-only; otherwise the form
  (which request and who did it, stars, comment, Submit). A failed submit keeps
  the stars and the comment and shows the error above Submit, which is the retry.
  Success shows "Review submitted" (an `alert` live region, announced once), the
  read-only review, and "Back to request".
- **Request Details.** A "Your review" group, last on the page, only for
  `COMPLETED`/`CLOSED`: a placeholder while checking; "Rate your experience"
  (secondary button) when there is none; the read-only review when there is one;
  "We could not check your review" with a retry when the check fails — never the
  button, since not knowing is not the same as not reviewed. The review is looked
  up only for a reviewable request, re-read when the screen regains focus (which
  is how a review just sent replaces the prompt) and on pull. The request itself
  is not re-read on focus: sending a review never changes it.
- **My Requests.** Unchanged. §23 gives the list no review access, so cards stay
  a single control that opens Request Details.
- **Persistence.** Required, because requests already survive a restart
  (3D-4): a review that did not would leave a reviewed request offering a second
  one. `shared/services/mock/MockReviewStorage.ts` (`read`, `save`),
  `AsyncStorageMockReviewStorage`, key `AppConfig.storage.mockRequestReviewKey`
  (`@fixora/mock-request-reviews`) + `/<customer id>`. Schema
  `{ version: 1, reviews: RequestReview[] }`, decoded strictly (a whole-number
  rating 1–5, a non-blank `requestId`, a parseable `submittedAt`, a comment absent
  or non-blank); another version is ignored; one review per request (last
  written wins). Never the request history's key or the draft's. Storage never
  throws; a failed save still accepts the review for the session and logs that it
  will not survive a restart. Nothing derived and no screen state is saved.
- **Scoping.** The same `signedInCustomerId` as 3D-4: customer role only, one key
  per customer, no customer session means memory only. A vendor session never
  mounts these screens.
- **Backend reconciliation.** `ApiReviewService` becomes GET/POST against the
  request's review; the server owns eligibility and uniqueness and answers a
  second review or an ineligible request with 409 (→ `conflict`), which the
  screen already handles. Delete `MockReviewStorage`, its key and the wiring.
- **Deferred, explicitly.** Review photos (§24 "if supported"; the contract can
  take `imageUrls?` beside `comment?` without a rewrite). Editing or deleting a
  review (§24 does not give either). The §22 "Review Submitted" timeline step and
  the §54 `review_submitted` event. Any vendor-side review display (§41) —
  since built, read-only, in Phase 3E-6 (see "Vendor reviews" below). Since
  3F-1 `review_submitted { requestId, rating }` is sent once a review is
  accepted; the timeline step is still not built.

**Customer actions: none that change a sent request.** Established 2026-09-11
against `PROJECT_BIBLE.md`, updated 2026-09-22 for the review (3D-6); nothing
here is backed by a real API.

What the roadmap gives a customer once a request is sent: view it (§20), quote
its reference (§19), open it from a card (§23), read it again (§35: "frontend
refreshes request state"), and — later — review it once it is `COMPLETED` or
`CLOSED` (§24). Nothing else. The vendor moves a request through §21
(§33–36), §34 forbids frontend-only status changes, and §22 calls the
timeline read-only.

Since 3D-11 (21/10/2026), owner decision: one action changes a sent request — a
customer may **cancel while no professional has accepted it**. Its gate is
`isCancellableState` in `requestStatus.ts`, its call
`RequestService.cancelRequest`, and the service still sets the status (see
"Customer cancel and the carried address"). The tables are updated for it.

| §21 status | Customer sees | Offered on Request Details today | Roadmap action not yet built |
|---|---|---|---|
| `CREATED` | submitted | Back · Copy reference · pull to refresh · Cancel request (3D-11) | — |
| `PENDING_VENDOR` | searching / awaiting response | same | — |
| `ACCEPTED` | assigned | Back · Copy reference · pull to refresh | — |
| `IN_PROGRESS` | in progress | same | — |
| `COMPLETED` | completed | same, plus Rate your experience (§24) or the read-only review | — |
| `CLOSED` | completed | same, plus Rate your experience (§24) or the read-only review | — |
| `CANCELLED` | cancelled | same | — |
| `REJECTED` | not accepted | same | — |
| `ON_HOLD` | on hold | same | — |
| anything else | status unavailable | same | nothing, ever, until the status is known |

Copy appears only when the record carries a non-blank reference; pull to refresh
only once a record has loaded. All three read or navigate and change nothing,
which is why none of them is gated on status. Request Submitted keeps Copy,
View Request and Home; a recent-request card stays a single control that opens
Request Details. Home holds no action logic — Request Details is where any
future action lives.

There is no action type, availability table or service method for actions,
because nothing would consume one. The review is not an operation on the request
— it is its own record in `ReviewService`, and sending one leaves the request as
it was — and its gate is `reviewAvailabilityOf` in `requestReview.ts` (see
"Customer review" above), which treats an unknown status as not permitted.

Deliberately not built:

| Action | Why |
|---|---|
| Cancel after acceptance | Since 3D-11 (21/10/2026) a customer may cancel before acceptance only. Once a professional has accepted, cancelling means talking to them, and Phase 1 has no channel for that. |
| Reschedule / change date or time | Not in the roadmap. §14 makes date and time optional "if supported by backend". Backend-dependent. |
| Edit service, notes, photos or address | Not in the roadmap. §18's "edit address" is the profile address book (§25), not a sent request. |
| Change professional / re-dispatch | §20: the frontend "never re-dispatches on its own"; §18A.1 puts assignment on the backend; §18A.6's two-call form is unconfirmed. |
| Contact or call the professional | Not in Phase 1, and no phone number is on the contract. Chat is Phase 2 (§64). |
| Track, live location, ETA | Phase 2 (§65). |
| Rebook / repeat request | Phase 2 retention (§73). |
| Pay | Phase 1 payment is recorded offline by the vendor (§36–37). |

**Mock levers.** `AppConfig.mock.failureRate` drives failures app-wide.
Sub-categories are seeded by id with `cat_appliance_repair` and `cat_pest_control`
left empty, and vendors are seeded with `sub_light_installation` left empty, so
both empty states are reachable by tapping through the real app rather than by
editing a mock.

`MockRequestService` is a request table, one per instance: created requests are
stored, listed newest first by `createdAt` (sorted at read time, never by
insertion), and read back with `getRequest`. It refuses a service or vendor its
sibling fixtures do not know, as a backend would. Built without `history` and
`currentCustomerId` (every test that is not about restarts) it is memory only.

**Submitted requests survive a restart — locally, and only in the mock.**
Established 2026-09-11 (Phase 3D-4). This is not backend persistence, not sync
and not account history: there is no server, and another device sees none of it.

- **Where.** `shared/services/mock/MockRequestHistoryStorage.ts`: the interface
  `MockRequestHistoryStorage` (`read(customerId)`, `save(customerId, request)`)
  and `AsyncStorageMockRequestHistory`. Only that file touches AsyncStorage.
  (Since 3G-2, 21/10/2026: it reaches the device through
  `core/storage/KeyValueStorage`, as every storage now does; nothing outside
  `src/core/storage` imports AsyncStorage.)
  `ServiceRegistry` hands it to `MockRequestService` together with the
  signed-in customer's id. It lives beside the mock because it is deleted with
  it; no screen, hook or context sees it.
- **Key.** `AppConfig.storage.mockRequestHistoryKey` (`@fixora/mock-request-history`)
  plus `/<customer id>` — one key per customer. Never the draft's key
  (`@fixora/request-draft`), and neither storage reads the other: a sent request
  cannot come back as a draft to resume.
- **Schema.** `{ version: 1, requests: CustomerRequestDetails[] }`. Another version
  is ignored rather than migrated, and the next save replaces it. Each entry is
  decoded field by field; one missing its reference, identifiers, names, status,
  priority, a parseable `createdAt` or a non-blank `formattedAddress`, or holding
  a wrong-typed optional field, is dropped. Corrupt JSON reads as none. A status
  §21 does not name is kept, and shown as unavailable as before.
- **Persisted fields.** Exactly `CustomerRequestDetails`: `id`, `categoryId`,
  `subCategoryId`, `categoryName`, `serviceName`, `vendorName?`, `status` (the
  backend's, verbatim), `priority`, `createdAt`, `preferredDate?`,
  `preferredTime?`, `notes?`, `imageUrls?`, `address` (coordinates when present)
  and `preferredVendor?`. Nothing derived — no stage, label, description, tone
  or progress — and no draft, submission handoff or UI state.
- **Hydration.** Every public method first awaits `prepare()`. It asks who the
  customer is (`SessionStorage`, customer role only) and, when that is not whose
  requests the table holds, rebuilds it as the seed plus that customer's saved
  requests, restored exactly: same reference, same status, same timestamp.
  Calls that arrive together share one load. The seed is fixture data, rebuilt
  on every launch and never saved.
- **Duplicates.** The reference is the identity. Storage replaces by reference on
  save and reads a duplicated reference once (the last written wins); the table
  is a Map by reference; loading happens once per customer, so reads, refreshes
  and re-renders add nothing. Numbering continues after the highest saved
  `REQ-n` and skips any reference already held, so a restart never reissues one.
- **Order.** Newest first by `createdAt`, computed on every read; arrival order
  only breaks a tie. Where storage keeps a record is not a contract. The seed's
  "minutes ago" timestamps are anchored to the earlier of now and the oldest
  saved request, so fixtures always predate what the customer raised. Before
  this, a seed re-dated on each launch climbed above a request raised yesterday
  and pushed it off Home's three cards — found on the device during 3D-4.
- **When it is saved.** Inside `createRequest`, after the request is accepted, and
  awaited before `createRequest` resolves — so the success screen is never shown
  for a request an app killed a moment later would forget. A refused request has
  thrown by then, so nothing uncreated is saved. The submit flow is unchanged:
  `createRequest` → `recordSubmission` (clears the draft) → `reset` to Request
  Submitted.
- **Failures.** Storage never throws. Unreadable history reads as none, and the
  seed and this session's requests still work. A failed save resolves `false`:
  the request still exists for this session, `createRequest` still succeeds (the
  "backend" accepted it), and the log says it will not survive a restart. No
  screen claims a request is saved anywhere. Storage problems log warnings rather
  than errors, so a debug build shows no red screen for them.
- **Scoping.** By the customer session's `AuthUser.id`. Another customer — after
  signing out and in, in the same process or after a restart — gets the seed and
  their own saved requests only. No customer session means memory only and
  nothing saved; a vendor session has no customer history. Signing out does not
  delete history. (The draft is now scoped too, and cleared at logout — see
  "Customer profile and logout".)
- **Mock limits.** References continue per customer key, so two customers on one
  device can each hold `REQ-24083`; a real backend issues references globally.
  No size limit and no pagination — §23's paginated history is unbuilt. Home
  still asks for 3.
- **Backend reconciliation.** When `ApiRequestService` lands, requests come from
  the server, scoped by the token. Delete `MockRequestHistoryStorage`, its key and
  the `currentCustomerId` wiring; nothing above the service changes. Local mock
  history is not uploaded — it never existed on a server. `REQ-24076` carries one photo URL on the reserved `.invalid` domain, so the
failed-image state is reachable by opening it.


### Vendor profile setup (Phase 3E-1)

The first vendor step after authentication (PROJECT_BIBLE.md §38, §43). Auth
itself is untouched: registration, OTP, auth code and sign in are as they were.

**Contract.** `shared/services/types/VendorProfileService.ts`:
`getProfile(): VendorProfile` and `saveProfile(VendorProfileUpdate): VendorProfile`,
registered as `vendorProfile` (separate from `vendor`, which lists vendors for a
customer).

- `VendorProfile` = `vendorId`, `businessName`, `description?`,
  `serviceCategoryIds` (ids only, §11), `serviceArea?: { description }`,
  `imageUrl?` (remote URL only), plus `ownerName`, `phone`, `email?` and
  `isSetupComplete`.
- `VendorProfileUpdate` is the business half only. **Contact details are never
  written through this service**: they are the account's, read from the session
  on every call, so there is no second copy to go stale. Changing the phone is
  changing the account (§7A) and is not this phase.
- A vendor with nothing saved gets a profile (contact details, empty business,
  `isSetupComplete: false`) — "not set up" is an answer, not an error.
- The service answers `unauthorized` with no session **and for a customer**.

**Rules** (form and mock agree; the backend's own are the authority later):
business name required, trimmed, ≤ 80 (`VENDOR_BUSINESS_NAME_MAX_LENGTH`, now
defined on the contract and re-exported by `authSchemas`, so registration and
setup share one ceiling); at least one service category (registration already
requires one, so setup never accepts less); description ≤ 500 and service area
≤ 200, both optional; blanks are sent as absent and clear the field; repeated
category ids collapse; the image must be an `http(s)` URL. No other format is
imposed.

**Service area.** An object holding one sentence the vendor writes
(`{ description }`), deliberately an object so structured fields — localities,
a centre and radius, a polygon — can be added beside it without changing stored
data. No GPS, map or radius: matching is the backend's (§18A.1).

**Mock storage.** `MockVendorProfileStorage` / `AsyncStorageMockVendorProfiles`,
key `AppConfig.storage.mockVendorProfileKey` (`@fixora/mock-vendor-profiles`) +
`/<vendor id>`, schema `{ version: 1, profile: VendorProfileUpdate }`. Strict,
all-or-nothing decode; another version, bad JSON or an unreadable device reads
as "not set up" and nothing throws. Kept at logout (the vendor's own record).
Unlike the address book, a **failed write fails the save** (`unknown`): setup
routes on the answer, and "saved" for a profile gone on the next launch would
silently send the vendor back through setup. Since 3E-10 the stored record may
carry `shopImageUrls`; the schema is **still version 1**, because a record
without the list is read as having none.

**Completion and routing.** `VendorProfileProvider`
(`features/vendor/state/VendorProfileContext.tsx`) — local to the vendor tree,
not Redux, keyed by the session's vendor id — loads the profile once and exposes
`adopt(profile)`. `VendorNavigator` draws a loader, then a full-screen
`ErrorState` with retry if the load fails, then a native stack whose screens
depend on `isSetupComplete`: until it is true the stack holds
`VendorProfileSetup` alone (no tabs, no route around it); afterwards
`VendorTabs` + `EditVendorProfile`. Saving adopts the stored profile and the
tree swaps to the Dashboard placeholder by itself — no screen navigates, as
with sign in. The mock considers setup complete once a business is saved; a real
backend decides for itself and the app only reads the flag.

**The form.** `VendorProfileFormScreen` serves both routes. Setup: no back
control, a quiet **Sign out** so a vendor on the wrong account is not trapped.
Edit: back control, `beforeRemove` discard guard (Android back included), and
goes back after saving. react-hook-form + zod (`vendorProfileSchema`), values
trimmed by the schema, field errors plus a live "Check the highlighted fields."
line, every value kept on a refused or failed save (Save is the retry), and a
ref in `useSaveVendorProfile` refuses a second press before state catches up.
Categories use `ServiceCategoryField`, **moved from `features/auth/components`
to `shared/components`** so registration and setup share one field without a
cross-feature import. Contact details are read-only rows (`ProfileDetailRow`).

**The photo.** The pick → validate → compress → upload pipeline was extracted
from `useProfileImage` into `shared/hooks/useImageUpload` (`attach`/`detach`
supplied by the caller); `useProfileImage` is now a thin wrapper with identical
behaviour. The vendor form attaches the uploaded URL to **form state**, so it is
saved with the profile and leaving unsaved leaves the stored picture alone.
Failure keeps the image for Try again or Discard; Remove clears it. One image
only — §38's "Shop Images" gallery is not built (since 3E-10 it is, on its own
screen and outside this form). Actions are spoken as
"Add / Replace profile image with the camera / from your photos" and "Remove
profile image".

**Profile tab.** `VendorProfileScreen` replaces that tab's placeholder with the
profile read back (business, services by name via `useCategoryNames`, area,
contact), **Edit business profile** and **Log out** (confirmed; the vendor tree
had no way to sign out before). It shows nothing §38 lists that is not built —
no working hours, availability, rating or team rows. Team remained a
placeholder until 3E-7; the Dashboard arrived in 3E-2 and Requests in 3E-3.
Since 3E-12 (21/10/2026) Profile carries an Availability card with the working
hours.

**Mock data.** A second seeded vendor, `9000000002` + `FX-VENDOR-DEMO-TWO`
(Meena Iyer, with an email), exists to prove isolation without registering —
vendors registered in the app live in `MockAuthService` memory and do not
survive a restart. Registration's business name and categories are not carried
into the profile by the mock (it has nowhere to keep them); a backend that
remembers them returns them from `getProfile` and the form opens on them.
Since 3C-2 (21/10/2026) the codes are six digits: Meena's is `573014`, Ravi's
(`9000000001`) `482913`.

**Backend reconciliation.** Endpoints, field names, error shapes, the limits
above, the completeness rule, whether categories are required, whether contact
details are editable from here and how the image is attached are all this app's
guess. Delete `MockVendorProfileService`, its storage, the key and the
`signedInUser` wiring when `ApiVendorProfileService` lands; nothing above the
service changes.


### Vendor dashboard (Phase 3E-2)

The vendor's landing screen once setup is done (PROJECT_BIBLE.md §30). The
setup gate, the profile and vendor authentication are unchanged from 3E-1.

**What it is.** A read-only summary: greeting, the business, three counts and
three short previews. **Nothing on it acts** — no Accept, no Reject, no status
change; job cards are not buttons. The only things to press are the business
card (→ the existing Profile tab) and each section's "See all" (→ the existing
Requests tab — the request list since 3E-3). It adds no route. Since 3E-12
(21/10/2026) one thing on it acts: while new requests are off, a notice with
**Turn on**.

**Architecture.** `VendorDashboardScreen` → `useVendorDashboard` →
`VendorDashboardService` (registered as `vendorDashboard`) →
`MockVendorDashboardService` → fixtures in `mockVendorDashboardData.ts`.

- **Two sources, kept apart.** Identity (owner's first name, business name,
  services, area, picture) comes from `VendorProfileContext`, already loaded by
  the 3E-1 gate, so the greeting and business card draw at once and need no
  request. Work comes from the dashboard service. A slow or failed dashboard
  call darkens the work and nothing else — the screen is never blank (§47).
- **Category names** are a third, small query (`useCategoryNames`, from 3E-1)
  that fails quietly: the business card simply omits the services line.
- **Retry guard.** `useServiceQuery` already drops superseded answers; a ref in
  the hook stops a second press sending a second request. It is released by the
  *answer* (`data`/`error` identity), not by `isLoading` — see Lessons.
- **Pull-to-refresh** re-reads the work. There is no refresh on tab focus.

**Contract.** `shared/services/types/VendorDashboardService.ts`:
`getDashboard(previewLimit): VendorDashboard`.

- `VendorDashboard` = `counts { pending, active, completed }` (the whole of each
  group) + `pending[]`, `active[]`, `recentlyCompleted[]` (at most
  `previewLimit` each; the screen asks for 3, `DASHBOARD_PREVIEW_LIMIT`).
- `VendorJobSummary` = §31's card fields: `id` (reference), `serviceName`,
  `customerName`, `locality?`, `priority`, `status` (backend's, verbatim),
  `dispatch?: 'directed' | 'broadcast'` (§31.1, only when the backend says),
  `createdAt`, `completedAt?`.
- **The service sorts work into the three groups; the app never buckets
  statuses** (§21, §34). The app only words each job's own status.
- **Never an address** — locality at most. The address belongs to request
  details (§32).
- **No business identity** on it; that is the profile's.
- Scoped by the session, no vendor id parameter. `unauthorized` with no session
  and for a customer. No work is zeros and empty lists, not an error.

**Mock data.** Deterministic: every job is written out, nothing is random, no
timer moves a job between groups, and the only input besides the vendor is the
clock (ages in minutes → timestamps, injectable as `now`). Named scenarios —
`empty`, `pendingOnly`, `activeOnly`, `completedOnly`, `mixed` — cover every
state the screen draws. `usr_vendor_1` (Ravi) gets `mixed` (4 waiting, 2 under
way, 5 finished); **every other vendor gets `empty`**, which is the truth for a
business that has just set up and is what makes isolation checkable by signing
in. **No persistence**: fixtures are rebuilt per call, so there is no storage
key and nothing one vendor's call leaves behind for the next.
⚠️ Not connected to the customer's mock requests — a request raised in the
customer app does not appear here. Matching and dispatch are the backend's
(§18A.1); simulating them would be inventing them.

**Presentation.**

- `features/vendor/constants/jobPresentation.ts` words a status for the vendor:
  waiting → "Direct request" / "Open request" / "New" (no dispatch given),
  `ACCEPTED` → "Accepted", `IN_PROGRESS` → "In progress",
  `COMPLETED`/`CLOSED` → "Completed"; anything else is humanised and neutral, a
  blank one is "Status unavailable". A second table on purpose: the same status
  reads differently to a customer.
- Priority and relative dates are the customer's, now shared (below), so a
  request is never "High" on one side and something else on the other.
  Emergency/High are told apart by word and glyph as well as colour (§31).
- Components: `BusinessSummaryCard`, `DashboardOverview` (three equal tiles),
  `JobPreviewCard`, `JobPreviewSection`. Empty groups use the shared
  `EmptyState` and show no "See all".

**Shared moves (no customer consumer edited).** Three customer-local pieces
were needed unchanged, so they moved to shared and the customer files became
re-exports: `Skeleton` → `shared/components/Skeleton`; `HomeSection` →
`shared/components/ContentSection` (customer still exports it as
`HomeSection`); `presentPriority`, `humaniseToken`, `formatRequestDate`,
`TokenPresentation` and `RELATIVE_TIME_COPY` → `shared/presentation/
requestTokens.ts` (re-exported from `requestPresentation.ts` and
`customerCopy.ts`). Every customer import path still resolves; the customer
suites pass untouched.

**States.** Loading (placeholders for the tiles and two cards, announced once as
"Loading your dashboard"); loaded; all-empty (zeros + three empty states);
partially empty; failed (`ErrorState` with the dashboard's own title where the
work would be, greeting and business card still shown); retry.

**Assumptions.** Pending/Active/Completed are the three figures (the brief's);
§30 also lists Today's Requests, Accepted and In Progress separately, and
Rating — see Open items. Sections run waiting → under way → finished. Three
previews per group. "Completed" counts all finished work, not a period.

**Known limitations.** No refresh on tab focus. A failed pull-to-refresh keeps
the old data and says nothing (the `useServiceQuery` defect already listed).
Job cards open nothing until request details exist. In a debug build the
query-failure `log.error` raises React Native's developer toast over the error
state; release builds have none.

**Verification (2026-09-30).** TypeScript 0; ESLint 0 errors, 30 warnings
(unchanged); Jest 62 suites / 1151 tests (65 new: service 20, status wording
and greeting 16, screen 29). Device
(Fixora_Pixel7): 1080×2400 Light, 1080×2400 Dark and 360×640 Dark — mixed
dashboard, empty dashboard, 80-character business name, loading, error and
retry (via a temporary patch, reverted), See all → Requests, business card →
Profile, pull-to-refresh, A → B → A isolation; no horizontal overflow, no
crash, no JS warning or error beyond the injected failure's own log. A release JS
bundle builds.


### Vendor requests (Phase 3E-3)

The Requests tab (PROJECT_BIBLE.md §31) and a read-only request it opens (§32).
**Nothing in this phase changes a request**: no Accept, Reject, Start, Complete,
cancel, call or message anywhere — §33–§37 are later phases.

**Architecture.** `VendorRequestsScreen` → `useVendorRequests` →
`VendorRequestService` (registered as `vendorRequests`) →
`MockVendorRequestService` → the dashboard's fixtures.
`VendorRequestDetailsScreen` → `useVendorRequestDetails` → the same service.
New stack route `VendorRequestDetails: { requestId }` in the set-up branch of
`VendorNavigator`; the Requests tab and the dashboard's "See all" are the routes
that were already there.

**Contract decisions.** `shared/services/types/VendorRequestService.ts`.

- **One request model.** A list item is the dashboard's `VendorJobSummary`; no
  second type. The two screens are two views of the same work.
- `listRequests(): { pending[], active[], completed[] }` — **the service sorts
  requests into the groups, as on the dashboard**; the app never buckets a
  status. Whole, not previewed. **No filter parameter**, on purpose: choosing a
  view is the screen's, and a parameter would put the app's idea of the groups
  into the contract.
- `getRequest(requestId): VendorRequestDetails` = the summary +
  `categoryName?` + `description?` (what the customer wrote).
- **Deliberately not on the details record:** address, photographs, preferred
  date/time, phone. §32 lists them; whether a vendor sees a customer's address
  *before accepting* is a product decision nobody has made and cannot be taken
  back once shipped. They join this record with the accept flow.
- Scoped by the session. `unauthorized` with no session and for a customer. A
  reference that is not this vendor's is **`notFound`, not `forbidden`** —
  including one that exists and is somebody else's, so its existence is not
  confirmed.
- No paging. Fine for fixtures; the completed group is what will need it.

**Filter semantics** (`features/vendor/constants/requestFilters.ts`, local
state, never sent anywhere; changing it makes no request):

- **All** — every request returned, in the order pending → active → completed,
  each group under a heading with its count. **An empty group is left out**, not
  drawn as an empty heading. Nothing in any group → "No requests yet".
- **Pending / Active / Completed** — that group alone, in the service's order,
  no heading. Empty → that view's own sentence ("No pending requests", "No
  active work", "No completed requests yet").
- The words are the dashboard tiles', so a count there is a filter here. §31's
  own tab list is finer — see Open items.
- Since 3E-13 (21/10/2026) `listRequests` also answers `rejected`, and a fifth
  chip, **Rejected**, shows that group alone. All still leaves it out.

**Status presentation.** Still `jobPresentation.ts`, one place for both screens.
**Changed in this phase:** a status the app does not recognise now reads
**"Status unavailable"** instead of the humanised raw value ("Awaiting parts").
A backend constant nobody has worded is not a Fixora status; the raw value
stays on the record and is never drawn. This matches the customer side. The
service passes statuses through untouched. An unrecognised *priority* is still
shown tidied — that is the shared `presentPriority`, unchanged.

**The card.** `JobPreviewCard` (3E-2) gained an optional `onPress(requestId)`:
without it (dashboard) it is a card, with it (list) it is the button that opens
the request and carries a chevron. Same fields either way. **Customer and area
are now on separate lines** — on one line a long name pushed the area off the
card entirely. This changes the dashboard card's layout too (one extra line
when a locality exists). The title takes the row's remaining width rather than
its own measured width — see the bug under Verification.

**Mock data assumptions.** `MockVendorRequestService` reads
`mockVendorDashboardData` — the same fixtures and the same vendor → scenario
table as the dashboard — so the counts on the dashboard are the lengths of the
lists here (pinned by a test). It adds only a small table of category and
description by reference. No storage, no timers, no status changes. One fixture
(the third waiting request) was made the long-field stress case: reference
`REQ-2026-BLR-EAST-0031021`, a long area, the long service and customer names it
already had. `workFor` is a test-only override for a record the fixtures do not
hold (an unknown status).

**Refresh behaviour — decision B (a local notice).** The shared `useServiceQuery`
keeps the old data when a refresh fails and says nothing (listed under Known
defects). For this list that silence is wrong — §31.2 warns against acting on
stale leads — so `useVendorRequests` exposes `isStale` (there is a list and the
last refresh failed) and the screen draws `StaleNotice` above the list: "Could
not refresh. These requests may be out of date." with the failure's
`userMessage` and Try again (a refresh, so the list stays on screen). It is
announced when it appears and clears on the next good read. **The shared hook is
unchanged and no customer screen's refresh behaviour was touched.** A failed
*first* load is different: there is no list, so it is the full `ErrorState` with
its own retry and no pull offered.

**Retry / refresh guard.** New `shared/hooks/useSingleFlightQuery`:
`useServiceQuery` plus "while a request is in the air, asking again does
nothing". The guard is taken when the service is called and **released in a
`finally` when that call settles** — not by watching `isLoading` (the 3E-2 bug)
and not by the answer's identity (which a service returning the same object
twice would break). Used by the list and the details screen. The dashboard's
own guard from 3E-2 is left as it was; it could adopt this hook. Since
20/10/2026 the guard belongs to the **newest call**, not a boolean — see
Lessons ("A boolean in-flight guard").

**Shared moves (no customer consumer edited).** `SelectionChip` →
`shared/components/SelectionChip`; the customer file is a re-export, as with
`Skeleton` and `HomeSection` in 3E-2. Since 3D-10 `StaleNotice` lives in
`shared/components` too (Home and Categories use it); the vendor file is gone.

**Details screen.** Service as the heading with status and urgency (one phrase
for a screen reader); Request card (reference, category, service, raised,
completed when finished, how it reached the vendor when the backend says);
Customer card (name, area); "What the customer said". Absent fields are left
out, never drawn blank. Not found → a calm "This request is not available"
with no retry; other failures → `ErrorState` with retry. The only control is
Back.

**Verification (2026-09-30).** TypeScript 0; ESLint 0 errors, 30 warnings
(unchanged); Jest 66 suites / 1231 tests (80 new: service 20, filter semantics
13, single-flight hook 6, screen and details 41). Release JS bundle builds.
Device (Fixora_Pixel7) at 1080×2400 Light, 1080×2400 Dark and 360×640 Dark:
the mixed list (all 11 requests, three counted groups), each filter (4 / 2 / 5)
and back to All, the empty list and each filtered-empty sentence (vendor B),
loading, a failed first load and its retry, a failed pull with the stale notice
and its own retry, pull-to-refresh, card → details → back (control and Android
back), the long-field request in the list and opened, Dashboard "See all" →
list, A → B → A isolation; no mutation or contact controls anywhere, no
horizontal overflow, no crash, no JS error beyond the injected failure's log.
The dashboard was re-checked after the card change. Error and stale states used
a temporary patch to the mock, reverted.

**Bug found on device and fixed.** At 360×640 the first card's title drew as
"Switchboard" — "repair" had wrapped onto a second line that the one-line height
clipped, with no ellipsis. The title was sized by its own content inside a row
(`flexShrink`) and was line-broken a fraction narrower than it was measured.
It now takes the row's remaining width (`flex: 1`). See Lessons.

### Vendor accept / reject (Phase 3E-4)

A waiting request can be accepted or rejected (PROJECT_BIBLE.md §33), from its
card in the Requests list and from its details. **The first change a vendor can
make to a request** — and the only one: no Start, Complete, Cancel, contact or
tracking (§34–§37 are later phases).

**Architecture.** Screens → `useVendorRequestDecision` (one hook, both
screens) → `VendorRequestService.acceptRequest` / `rejectRequest` →
`MockVendorRequestService` → a `MockVendorRequestBook` shared with
`MockVendorDashboardService`. New: `MockVendorRequestBook.ts`,
`useVendorRequestDecision.ts`, `state/VendorWorkSync.tsx`,
`components/RequestAnswerActions.tsx`, `components/RejectRequestDialog.tsx`.
Changed: the contract, both mocks, `ServiceRegistry` (one shared book),
`mockVendorDashboardData` (Meena's scenario), `jobPresentation`
(`REJECTED`, `isAwaitingAnswer`), `vendorCopy` (`answer` block,
`statusRejected`), `JobPreviewCard` (`actions` slot), both request screens and
their hooks, `useVendorDashboard` (re-reads on change), `VendorNavigator`
(mounts `VendorWorkSyncProvider`), `theme/icons` (`accept`, `reject`).

**Contract** (`shared/services/types/VendorRequestService.ts`).

- `acceptRequest(id)` / `rejectRequest(id)` resolve with a typed
  `VendorRequestDecisionResult`: `{ outcome: 'accepted' | 'rejected', request }`
  — the record as the service now holds it — or `{ outcome: 'refused', reason }`
  with `reason` `taken` (an open request another vendor accepted first) or
  `notPending` (this vendor's, but already answered or moved on).
- A refusal is a **result, not an error** (§49.1: losing the race is a business
  outcome). Faults reject with `AppError` as everywhere else: `unauthorized`
  (no session, or a customer's), `notFound` (not this vendor's — including
  somebody else's directed request, so its existence is not confirmed, the same
  rule as `getRequest`), `unknown` when the answer could not be recorded.
- **Status transitions.** `PENDING_VENDOR`/`CREATED` → `ACCEPTED` on accept,
  → `REJECTED` on reject. Nothing else moves; `ACCEPTED` stays until the Work
  Status phase adds `ACCEPTED → IN_PROGRESS → COMPLETED`. Backend status values
  stay on the record verbatim; grouping is still the service's.
- `dispatch` is dropped from an answered record (it describes a waiting
  request; the fixtures' own active work has none), so the details screen
  stops showing "How it reached you" once accepted.

**Rejected-list semantics (the smaller, reversible choice).** A rejected
request leaves the vendor's list: it is in none of the three groups and counted
nowhere, so there is **no Rejected filter**. `getRequest` still answers for it
by reference with status `REJECTED`, so the details screen it was rejected on
shows "Rejected" and no buttons. This matches the dialog's own words ("This
request will no longer be available to you"). §31 names a Rejected tab; whether
a vendor keeps a history of what they declined is the backend's to say — see
Open items. Adding a `rejected` group later is additive. Since 3E-13
(21/10/2026), owner decision: vendors keep a Rejected list — a confirmed
rejection moves to the top of its own group instead of leaving, and the
dashboard still counts none of it (see "Rejected requests and team photos").

**Broadcast race.** One request, one winner: the book records the acceptance
per request, and `waiting()` + the write run synchronously after the session
read, so two answers in flight cannot both win (pinned by a `Promise.all`
test). The loser gets `refused: taken`; the request disappears from their list
and `getRequest` says `notFound`. A rejection is per vendor — declining an
open request leaves it open to everybody else. Directed requests are never
offered to another vendor, so they can only be `notFound` for one. Deterministic:
no randomness, no timers; a request is taken only because some vendor called
accept.

**Mock state — in memory, not persisted.** `MockVendorRequestBook` holds
"request → who accepted it" and "vendor → what they rejected". One instance in
`ServiceRegistry`, shared by the request and dashboard mocks. It survives
sign-out/sign-in (so B sees what A did on the same device) and is **cleared by
an app restart** — every request is waiting again. Not persisted on purpose:
the fixtures are rebuilt from the clock on each read and are not records, so
storing answers to them would be a half-real database; the backend owns this.

**Fixture change.** Meena (`usr_vendor_2`) moved from `empty` to a new
`openOnly` scenario: the two open (broadcast) requests Ravi also sees —
`REQ-31042` and `REQ-2026-BLR-EAST-0031021` — and nothing of his own. That is
what makes the race checkable by signing in. Her empty states are still
reachable (answer both, or let Ravi take them); any newly registered vendor
still has nothing. One 3E-2 test that pinned "B has nothing" and two 3E-3
service tests were updated to the new table.

**Presentation.** `REJECTED` reads "Rejected", neutral tone, crossed-circle
glyph — the vendor's own answer, not an alarm. `isAwaitingAnswer(job)` (in
`jobPresentation`, beside the labels) is true only for `PENDING_VENDOR` and
`CREATED`; an unknown status is never answerable. The list offers answers only
on a card in the service's `pending` group **and** awaiting an answer; the
details only when awaiting.

**The card.** `JobPreviewCard` gained an `actions` slot. With it, the card is
split: the request is the open button (same label, hint, chevron, `testID`),
and Accept/Reject sit under it **as siblings, not inside it** — Android cannot
focus a button inside a button, and a tap on an answer must never open the
details. Without `actions` (dashboard, active, completed) it is unchanged.

**Buttons.** `RequestAnswerActions`: Accept = primary with a tick, Reject =
secondary with a crossed circle — told apart by word, glyph and weight, not
colour; neither is red. Spoken names say which request ("Accept Switchboard
repair, Ref REQ-31042") and start with the visible word. Each keeps its own
width (`flexBasis: 'auto'`, grow) and the row wraps, so they sit side by side
where they fit and stack where they do not; touch targets never shrink.

**Reject confirmation.** `RejectRequestDialog` = the shared `ConfirmDialog`:
"Reject request?" / "This request will no longer be available to you." /
Cancel · Reject (danger). It stays open and busy while the rejection is sent
(no dismiss mid-action) and is closed by the caller when the service answers.
Accept is not confirmed. Since 3G-2 (21/10/2026) the message reads "You won't
be able to take it after this. It will stay in your Rejected list."

**One answer at a time — and the guard cannot stick.** `useVendorRequestDecision`
takes a ref the moment an answer is asked for (five taps in one frame send one
request) and releases it in a `finally` — after accepted, refused, failed and
non-`AppError` exceptions alike (each pinned). While one is in the air every
Accept and Reject on the screen is disabled and the one in flight shows busy.

**Outcomes, said once, in the hook** (toasts — the existing `ToastProvider`,
assertive live region, so each is announced):
- accepted → "Request accepted. It is now in your active work."; rejected →
  "Request rejected." Both tell the other screens the work changed.
- refused `taken` → "This request is no longer available. Another professional
  accepted it first." (info); `notPending` → "This request is no longer waiting
  for an answer."; a `notFound` from an answer → "This request is no longer
  available." All three tell the other screens to read again.
- failed → "The request was not accepted." / "…not rejected." + the failure's
  `userMessage` (tone and glyph from `ERROR_PRESENTATION`). Nothing changes and
  nobody is told to re-read; the same button is the retry. Logged by kind and
  answer only — never the reference.

**List behaviour.** After a confirmed answer the card moves **at once**:
`useVendorRequests.settle` lays the service's answer over the last read (out of
Pending; into Active after the work already under way if accepted; nowhere if
rejected or refused) and the list is re-read; each overlay entry is dropped by
the first read that no longer lists the request as waiting. Never a guess —
only the service's own confirmed answer (§33.1). A failure leaves the card
where it was. The user is never navigated anywhere. Since 3E-13 (21/10/2026) a
confirmed rejection settles to the top of Rejected; under All it still leaves.

**Details behaviour.** "Your answer" sits right under the heading (first
screen, no scrolling to answer), with a line that says what accepting means:
open request → "Other professionals can see this request too. The first to
accept it gets the job."; directed → "The customer chose you…". After an
answer the screen **adopts the record the service returned** (status changes,
answers disappear) and stays. After a refusal it **sets aside** the record on
screen and reads again: "This request is not available" if it was taken, its
real state otherwise; a failed re-read shows the error state, never the old
waiting request. Back always works.

**Dashboard reconciliation — a signal, not a store.** `VendorWorkSync` is a
counter in the vendor tree (inside the per-vendor `VendorProfileProvider`):
`workChanged()` after any confirmed answer or refusal. The dashboard and the
list each re-read their own service when it moves — the dashboard with an
unguarded refresh (a read already in the air may predate the change), the list
through its single-flight guard (its own overlay covers the gap). The details
screen does not listen; it adopts or reconciles itself. So a request accepted on
the details is already in Active when the vendor goes back, and the dashboard
counts are right when its tab is next shown. No shared cache, no duplicated
store. This answers 3E-2's open "refresh on focus?" for the answer case.

**Shared changes.** `theme/icons`: `accept` (check) and `reject`
(close-circle-outline), additive. Nothing else shared was changed; no customer
file was touched.

**Lint.** No new warnings (still 30).

**Verification (2026-10-05).** TypeScript 0; ESLint 0 errors, 30 warnings;
Jest 69 suites / 1316 tests (85 new: service 27, decision hook 15, list +
details + dashboard + isolation through the navigator 29, presentation 13, list
1; and 6 earlier tests rewritten where 3E-4 deliberately changed what they
pinned — Meena's fixture, "nothing to press" on details, "no Accept anywhere").
Release JS bundle builds.

**Device.** Fixora_Pixel7 at 1080×2400 Light, 1080×2400 Dark and 360×640
Dark, two sessions each from a fresh app start (106 checks per configuration, all
passing): answers offered on every waiting card and on none under Active or
Completed; accept failing once, then five taps sending exactly one call; every
other answer held (disabled) while one is in the air; the accepted card moving
to Active as "Accepted" with Pending/Active counts following; Reject's dialog,
Cancel sending nothing, a failed rejection, then five confirms sending one call
and the card leaving the list; losing the race on an open request (calm toast,
card gone, not added to Active); the card still opening its details and no
answer ever opening them; on details — "Your answer" on the first screen with
the open/directed prompt, the lost race ending on "This request is not
available", reject → "Rejected" with no buttons, a failed accept then a good
one → "Accepted"; Back working throughout; the dashboard counting 1 / 3 / 5
afterwards; then vendor B: offered only the two open requests, holding the one
B "won", still offered the one A rejected, none of A's own; B accepting it; and
A no longer seeing it. Long service, customer, area and reference whole or
truncated as designed; Accept and Reject side by side and unclipped even at
360dp; no horizontal overflow; no crash; JS errors only the injected failures'
own log lines (kind and answer, never a reference) and the shared query's
not-found after the lost race. Service calls counted from a log line per call.
The delays, the two injected failures and the forced race came from a
temporary patch to `MockVendorRequestService`, reverted (no trace in `src` or
the release bundle); an unpatched smoke run at 1080 Light then accepted from
the list, rejected via the dialog and accepted on details at real latency
(12/12, no JS errors).

### Vendor work status (Phase 3E-5)

Accepted work can be started and then marked completed (PROJECT_BIBLE.md §34–
§36), from its card in the Requests list and from its details. **Only
`ACCEPTED → IN_PROGRESS → COMPLETED`** — no cancellation, reassignment,
scheduling, contact, tracking, payment or completion details.

**Architecture — extended, not added to.** `VendorRequestService` gained two
calls; `MockVendorRequestBook` (3E-4) gained vendor-scoped work progress;
`applyVendorAnswers` applies it, so the list, the details and the dashboard
still read one source. `useVendorRequestDecision` (3E-4) now carries all four
actions through its one guard, its toasts and its `VendorWorkSync` signal —
the name is 3E-4's; "decision" now covers the work steps. The list overlay
(`settle`) was generalised from "answers on waiting requests" to any confirmed
action. New: `RequestWorkAction.tsx` (the one step button),
`CompleteWorkDialog.tsx`. Changed: the contract, the book, the request mock,
`jobPresentation` (`nextWorkStep`), `vendorCopy` (`work` block), both request
screens, `useVendorRequests`, `RequestAnswerActions` (its busy prop now takes
any action), `JobPreviewCard` (the date fix below), `theme/icons` (`startWork`,
`completeWork`).

**Status contract — the project's own values, one path.** `ACCEPTED →
IN_PROGRESS` (start) and `IN_PROGRESS → COMPLETED` (complete), both values
already in `KnownRequestStatus` and already worded by `presentJobStatus`
("Accepted", "In progress", "Completed"). `COMPLETED` is the vendor's final
state; `CLOSED` stays the backend's own later state (listed under Completed as
before, never reached by a vendor call). Backend status stays on the record;
grouping stays the service's. Pending/Reject from 3E-4 are unchanged.

**Mutation contract** (`shared/services/types/VendorRequestService.ts`).

- `startRequest(id)` / `completeRequest(id)` resolve with
  `VendorWorkStepResult`: `{ outcome: 'started' | 'completed', request }` — the
  record as the service now holds it (`completedAt` set on completion) — or
  `{ outcome: 'refused', reason: 'invalidTransition' }` when the request is not
  in the step's starting status: waiting, rejected, already started, already
  completed, accepted but never started. A refusal is a result, not an error,
  exactly as 3E-4's.
- Faults as in 3E-4: `unauthorized` (no session / a customer), `notFound` (not
  this vendor's — including work another vendor took, so its existence is not
  confirmed), `unknown` when the step could not be recorded.
- `VendorRequestAction = 'accept' | 'reject' | 'start' | 'complete'`.
- Since 3E-9 `completeRequest(requestId, completion)` takes the final amount
  and payment record, "Mark completed" opens the Complete Work form, and the
  dialog below is shown only by that form.

**Mock state.** The same in-memory `MockVendorRequestBook` — no second store.
Progress is keyed **vendor → request**, so one vendor's progress can never show
in another's list even on a colliding fixture reference (pinned by a test that
gives both vendors the same fixtures). Started work stays in `active` with
status `IN_PROGRESS`; `active` is ordered furthest along first (in progress,
then accepted, otherwise as before). Completed work leaves `active` and is
listed first in `completed` (latest finished first, by record order), with
`completedAt` from the service clock. Held while the app runs, cleared by an
app restart, never persisted — as 3E-4. No timers, no randomness, no automatic
transitions.

**Service rules.** Each step reads the request as it stands now (everybody's
answers and this vendor's progress applied) and checks its status in the same
synchronous step as the write, so two calls in flight cannot both pass. Start
needs `ACCEPTED`; complete needs `IN_PROGRESS`. A rejected request (still
readable by reference) is refused, not "not found".

**Stale / conflict behaviour.** A refused step means the job moved on
elsewhere (another phone, say). The hook says calmly "This job has already
changed. Showing its latest status." and signals `workChanged`; the list
re-reads (the card is left as it is until the read lands — no guess about where
it went), the details screen sets aside its record and re-reads, showing the
real status and the right next step. Failures say "Work was not started." /
"The job was not marked completed." plus the failure's message, change nothing
and leave the button as the retry.

**One action at a time.** All four actions share the 3E-4 guard: taken at the
tap, released in a `finally` after done / refused / failed / non-`AppError`
exception (each pinned for both steps). While anything is in the air every
action button on the screen is disabled and the one in flight shows busy.
Five quick taps (or five quick confirms) send one call.

**List overlay, generalised.** `settle(id, to)` records `from` — where and as
what the **read** had the request — and `to` — where the service's answer puts
it (`{ group, request }`, or null). Applied: accept → end of Active; reject →
out of the list; start → replaced in place; complete → top of Completed. A
second action before the read caught up keeps the first `from` (accept then
start then complete chains). An entry stops applying, and is pruned, as soon as
a read no longer shows the request where and as it was — that read has caught
up. Pure functions, pinned by `settledAnswers.test.ts`.

**UI.**
- List: an accepted card offers **Start work** (primary, play glyph), a card in
  progress **Mark completed** (primary, check-circle glyph), each one full-width
  button under the card's open button — never inside it, so a tap steps and
  opens nothing. Finished and waiting work offer no step (waiting keeps
  Accept/Reject). Filters unchanged.
- Details: "Your work" sits where "Your answer" does, under the heading, with
  one line ("Start work when you begin the job." / "Mark the job completed when
  the work is done.") and the button. After a step the screen adopts the
  returned record and shows the next step, so Accept → Start work → Mark
  completed all happen on one screen. Completed shows its status, its completed
  date and no action.
- Confirmation: **Start is not confirmed** (no Fixora pattern asks; it is the
  step a vendor wants to take quickly). **Completion is**: the shared
  `ConfirmDialog` — "Complete this job?" / "This will mark the request as
  completed." / Cancel · Complete (primary tone: finishing is not destructive),
  busy and undismissable while sending.
- Accessibility: "Start work on Switchboard repair, Ref REQ-31042" and "Mark
  completed: Switchboard repair, Ref REQ-31042". The brief's example ("Mark AC
  repair completed…") was reworded so the spoken name **starts with the visible
  label** — the rule `Button` documents for voice control. Busy/disabled are
  exposed; outcomes are assertive toasts; status is always a word and a glyph.
- Toasts: "Work started. This job is now in progress." / "Job completed. It is
  now in your completed work."

**Dashboard reconciliation.** Unchanged mechanism: every confirmed step (and
every refusal) calls `workChanged`, the dashboard re-reads, and its counts and
previews are the service's (start: Active count unchanged, preview says "In
progress"; complete: Active −1, Completed +1, the job first under Recently
completed).

**Copy.** Buttons are sentence case ("Start work", "Mark completed"), as every
other Fixora button; the brief wrote them in title case.

**Tests changed for the new behaviour.** Two 3E-3 tests that pinned "no Start /
Complete anywhere" now pin "only the step each request is ready for" and "a
finished request has only Back". Every 3E-4 test passes unchanged.

**Lint.** No new warnings (still 30).

**Verification (2026-10-05).** TypeScript 0; ESLint 0 errors, 30 warnings;
Jest 72 suites / 1398 tests (82 new: service 26, list overlay 11, decision
hook 12, screens through the navigator 23, presentation 10; and the two 3E-3
tests above rewritten). Release JS bundle builds.

**Device — Dark first (Fixora_Pixel7).**

- **360×640 Dark — the main pass, functional and responsive.** Every state
  offered correctly (Start work on accepted, Mark completed on in progress,
  nothing on pending's work steps or on finished work); a start failing once,
  then five taps sending one call (busy/held states read from the screen); the
  card turning In progress in place with Mark completed offered; the completion
  dialog — Cancel sending nothing, a failed completion, then five confirms
  sending one call — and the job moving to the top of Completed with no action;
  Accept and Reject still working; a start refused because the job had been
  started "on another phone" (calm toast, re-read, the card in progress with
  Mark completed); card → details → Android back; on details, the long request
  taken all the way (Accept → Start work → Mark completed, one call per step),
  completed state with its date and no action, a finished fixture with no
  action; dashboard counts after list steps (2 / 3 / 5) and after details steps
  (3 / 2 / 6); vendor B seeing none of A's work, A's taken request gone, B's own
  job going through the same steps, and A's work as left. No clipping, no
  horizontal overflow at any stop, no crash, no JS error beyond the injected
  failures' own log lines (kind and step, never a reference). 93 checks, after
  two script fixes (a chip switch lost to a failed UI dump; a card below the
  fold) — neither an app fault.
- **1080×2400 Dark — the visual pass.** Dashboard, Active list with both step
  buttons, a start's busy and failure states, the in-progress details, the
  completion dialog idle and busy, completed details, the Completed list and
  the dashboard afterwards; spoken labels read from the device ("Start work on
  MCB replacement, Ref REQ-30961", "Mark completed: Inverter installation, Ref
  REQ-30954"). Contrast, badges (word + glyph + tone), borders and elevation as
  the rest of the vendor app.
- **1080×2400 Light — quick regression, unpatched, real latency.** Requests,
  accepted details with Start work, In progress with Mark completed, the
  dialog, Completed with no action: 11/11, no JS errors.

The delays, the injected failures and the "other phone" start came from a
temporary patch to `MockVendorRequestService`, reverted (no trace in `src` or
the release bundle).

**Bug found on device and fixed.** A job completed seconds earlier read
"Completed **J**ust now" on its card: the shared formatter words a date to
stand alone, and the card puts a label in front of it. The fixtures had only
ever said "1 day ago", so it first showed when a job could be completed live.
`JobPreviewCard` now says "Completed just now" / "Raised just now" (vendor copy
`job.justNow`); the shared formatter and every customer screen are untouched;
the details row, where the date stands alone, still says "Just now". Pinned by
the list test and re-checked at 360×640 Dark (7/7).

### Vendor reviews (Phase 3E-6)

The reviews customers wrote about the signed-in vendor's work, read-only
(PROJECT_BIBLE.md §41; §38 lists the rating on the profile; §48 words the
empty state). **Nothing here changes a review**: no reply, edit, delete,
report, moderation, contact, notification or analytics.

**Architecture.** `VendorReviewsScreen` → `useVendorReviews` →
`ReviewService.getVendorReviews` → `MockReviewService` → fixtures in
`mockVendorReviewData.ts`, joined to the vendor's completed jobs in
`mockVendorDashboardData`. New stack route `VendorReviews` (no params) in the
set-up branch of `VendorNavigator`, pushed from one **Customer reviews**
button on the Profile tab (above Edit business profile). The tab bar is
unchanged — §43 keeps it to four.

**Contract — the existing service, extended** (`shared/services/types/ReviewService.ts`).

- **No parallel `VendorReviewService`.** It is one review — the record a
  customer sent — read by the person it is about, so the brief's rule
  (extend unless separation is clearly required) applied. Each method
  belongs to one role; the service refuses the other.
- `getVendorReviews(): VendorReviews` — **no vendor id parameter**. Scoped by
  the session; `unauthorized` with no session and for a customer. A vendor
  with no reviews is `{ averageRating: null, totalReviews: 0, reviews: [] }`,
  not an error.
- `VendorReviews` = `averageRating` (the backend's, one decimal place; `null`
  exactly when there are none — an average of nothing is not zero stars),
  `totalReviews` (all of them, not `reviews.length`, so a paged list fits
  later), `reviews` (newest first — the service's order).
- `VendorReview extends RequestReview` with optional, display-only
  `serviceName` and `customerName` — the same review plus what a vendor needs
  to recognise the job. Absent when the backend does not say, and then not
  drawn. **Not a second review model**: `requestId`, `rating`, `comment?`,
  `submittedAt` are §24's record unchanged.
- No breakdown, distribution, trend or period. §41 names a breakdown
  ("★★★★★ 80%"); the brief excluded it unless the contract already had it,
  and it did not. It would join the two figures without moving them. Since
  3E-11 the breakdown is on the contract and drawn (see "Rating breakdown and
  team member status").

**Rating figures.** Computed by the service (the mock: the mean of the
vendor's ratings, rounded to one decimal), shown by the screen as given.
`presentRatingSummary` only words them: "4.3", whole stars = the average
rounded (4.3 → 4, 4.8 → 5, as §41 sketches it), "4 reviews", and "Rating 4.3
out of 5, based on 4 reviews." A figure the app cannot trust — `null`, not a
number, off the 1–5 scale, or a count below one — draws **no summary** rather
than "0.0". Nothing on screen sums the list (pinned by a test whose service
returns 4.8 / 12 beside two reviews).

**Mock strategy — fixtures, deliberately not the customers' reviews.** A
customer's review (3D-6) is stored under that customer's id and is about a
request raised to `MockVendorService`'s catalogue vendors (`ven_*`), which
are not vendor accounts (`usr_vendor_*`); nothing joins either to a signed-in
vendor, and inventing that join in a mock would be inventing the backend's
matching. So `mockVendorReviewData` holds deterministic reviews of the
vendor's **own completed fixture jobs**, and the service and customer each
review shows are taken from that job, so a name is written once.

- Scenarios: `none`, `single` (REQ-30744, 4★), `several` (Ravi's four:
  REQ-30912 5★, REQ-30876 4★ with a 473-character comment, REQ-30833 5★ with
  no comment, REQ-30790 3★, dated rather than aged because it is over a week
  old). Average 4.3, count 4. REQ-30744 is finished and **never reviewed**
  in Ravi's table — not every job gets one.
- Table: `usr_vendor_1` (Ravi) → `several`; **everyone else → `none`**,
  including Meena (`openOnly`, nothing finished) and any registered vendor.
- No randomness, no timers, no storage; finishing a job in the app (3E-5)
  **does not create a review**. The clock only turns ages into timestamps,
  always after the job's `completedAt`.
- The empty state's copy promises nothing: "When customers review your
  completed work, their reviews will appear here."

**Scoping.** The route carries nothing, the hook passes nothing, the service
reads the session. A hand-built route with `{ vendorId }` still shows the
signed-in vendor's reviews (pinned). The customer navigator has no
`VendorReviews` route at all (pinned through `RootNavigator`).

**Shared move (no customer screen edited).** `StarRating` →
`shared/components/StarRating`, and its words (`RATING_COPY`,
`describeRating`) → `shared/presentation/rating.ts`; the customer
component file, `describeRating` in `requestReview.ts` and the `rating*` keys
in `CUSTOMER_COPY.review` now point there with identical values, as the 3E-2
and 3E-3 moves did. The two customer test stubs of `ReviewService` gained a
`getVendorReviews` that throws — proving no customer screen calls it.

**UI.** One `FlatList` owning the scroll; heading, summary
(`RatingSummaryCard`: overline, the average in `display`, stars, count) and
any stale notice are its header. Each review is a `VendorReviewCard`:
customer name (two lines, then truncated on screen only), stars + date,
"service · Ref", then the comment **drawn whole** — §24's 500-character
ceiling wraps on any phone, and Fixora has no expand pattern to reuse. Not
pressable. Colours, spacing, type and glyphs are theme tokens; the stars are
filled against outlined (shape, not colour).

**Accessibility.** The summary is one node: "Rating 4.3 out of 5, based on 4
reviews." Each card is one focusable, non-clickable block: "Review from
Karthik Iyer. 5 out of 5 stars. 1 day ago. Geyser wiring, Ref REQ-30912.
Comment: …". No comment → the sentence ends at the job (never "Comment" and
nothing). No name → "Customer review". The inner star rows sit in a
`no-hide-descendants` subtree so a rating is never said twice. The list is
named "Your reviews" / "Loading your reviews" with `busy` on every render.

**States.** Loading: a summary placeholder and three card placeholders.
Loaded. Empty: §48's "No reviews yet" and the sentence above, no summary, pull
still available. Failed first read: `ErrorState` with Try again, no pull over
it. Failed pull: the reviews stay and 3E-3's `StaleNotice` says "Could not
refresh. These reviews may be out of date." with its own Try again (a
refresh). Retry and pull share `useSingleFlightQuery`, so five taps send one
read. No refresh on focus and no `VendorWorkSync` listener — completing work
does not produce a review.

**Verification (2026-10-08).** TypeScript 0; ESLint 0 errors, 30 warnings
(unchanged); Jest 75 suites / 1467 tests (69 new: service 22, presentation 17,
screen through the navigator 28, root navigator 2; two customer stubs
extended). Release JS bundle builds. No native change, so no native build.

**Device — Dark first (Fixora_Pixel7).**

- **360×640 Dark — functional and responsive.** Profile → Customer reviews;
  summary and its spoken sentence; all four reviews reachable by scrolling,
  newest first; the long comment whole; the no-comment card without
  "Comment"; the dated review ("Oct 1"); each card one focusable,
  non-clickable block, stars not separately exposed; Back control and Android
  back to Profile; an unpatched pull sending one read. Patched: loading
  placeholders announced "Loading your reviews, busy"; an injected first-load
  failure; five rapid Try again taps sending **one** read (2 calls in all); a
  57-character customer name and a long service wrapping inside the card; a
  failing pull keeping the reviews under the stale notice, and its Try again
  clearing it. Unpatched again: Ravi → Meena (empty state, no summary, none
  of Ravi's reviews) → Ravi (his four). Widest node 360 at every stop; no JS
  error beyond the injected failures' own `query failed` log.
- **1080×2400 Dark — visual.** Summary, cards top and bottom, error state and
  empty state: amber filled stars and grey outlines read clearly on the card
  surface; borders, spacing and type as the rest of the vendor app.
- **1080×2400 Light — quick regression.** Error, empty and populated states
  render; widest node 1080; an unpatched smoke afterwards with no JS error.
- **Customer regression on device (Dark).** Asha → My Requests → REQ-24048 →
  Rate your experience: the moved `StarRating` reads as a "Rating" radiogroup
  of five radios, the fourth checked after a tap; submitted; "Review
  submitted" and the read-only 4★ shown. (That mock review now sits in the
  emulator's local storage for Asha.)

The failures, delay, empty answer and long name came from two temporary
patches to `MockReviewService.getVendorReviews`, each reverted from a backup;
`grep -rn "TEMPORARY-VERIFICATION" src/` finds nothing.

**Backend reconciliation.** The endpoint (e.g. `GET /vendors/me/reviews`),
field names, rounding of the average, whether the customer's name is shown
to the vendor and in what form, paging (and whether `totalReviews` then
counts all), ordering, and the §41 breakdown are this app's guess. Delete
`mockVendorReviewData` and the vendor half of `MockReviewService` (the
`currentUser`, scenario and `now` options) when `ApiReviewService` lands.

### Vendor team (Phase 3E-7)

The vendor's team (PROJECT_BIBLE.md §39; §43's Team tab; §38's "Manage
Team"; §48's empty state): see who is on it, add somebody, change their
details, take them off. **A list the vendor keeps, nothing more** — no
assignment to requests (§40), dispatch, permissions or hierarchy, login (§7A.3:
team members never sign in), attendance, pay, availability, location,
notifications or analytics.

**Owner decisions, 2026-10-08.**

- **Where it lives.** The existing **Team tab is the team** (its placeholder
  replaced), and Profile gets one **Manage team** button that switches to it,
  as the dashboard's "See all" switches to Requests. One list, not a second
  copy pushed from Profile. The tab bar is unchanged.
- **Fields.** **Name and role required, phone optional.**

**Architecture.** `VendorTeamScreen` (Team tab) → `useVendorTeam` →
`VendorTeamService` (registered as `vendorTeam`) → `MockVendorTeamService` →
`MockVendorTeamStorage` + `mockVendorTeamData`. `TeamMemberFormScreen` on one
new stack route, `EditTeamMember: { memberId?: string }` (absent = add, as
`EditAddress`), → `useTeamMemberForm` → the same service. Components:
`TeamMemberCard`; the 3E-3 `StaleNotice` reused. Copy in `VENDOR_COPY.team`,
`.teamForm`, four `validation` keys and `profile.team`. Schema in
`validation/teamMemberSchema.ts`.

**Contract** (`shared/services/types/VendorTeamService.ts`).

- `TeamMember` = `id`, `name`, `role` (§39's "Designation"), `phone?` (digits,
  as every phone leaving the app; absent, never `""`). `TeamMemberInput` =
  the same without `id`.
- `listMembers()`, `addMember(input)`, `updateMember(memberId, input)`,
  `removeMember(memberId)`. **Every mutation answers with the whole team**, as
  `AddressBookService` does: the service owns the order (insertion order), and
  a removal refreshes the list with that answer rather than a second read.
- **Scoped by the session; no call takes a vendor id.** `unauthorized` with no
  session and for a customer, on every call. A member id not on this vendor's
  team is **`notFound`, not `forbidden`** — including one on another vendor's —
  so another team can be neither changed nor discovered.
- `validation` for a missing or too-long name or role, or a phone that is not
  a phone. Ceilings `TEAM_MEMBER_NAME_MAX_LENGTH` 80 and
  `TEAM_MEMBER_ROLE_MAX_LENGTH` 60 — the app's, on the contract (as 3E-1 put
  the business name's there).
- Not built from §39: **Profile Image** (the card shows initials), **Status**
  and **Disable Team Member** — the brief built add / edit / remove only, and
  said status only "if the existing contract supports it"; none existed. Each
  is one optional field or call later. Since 3E-11 Status and Disable are
  built (`status`, `setMemberStatus`); Profile Image is still not. Since 3E-13
  (21/10/2026) it is: `photoUrl?`, a photo card on the form, and the photo in
  the card's avatar (initials when there is none).

**Mock rules** (`MockVendorTeamService`, behaving as a backend):

- Re-checks the input (the form's rules, plus the shared `phoneSchema`) and
  normalises: trims; phone → `normalisePhone` digits; blank phone → none.
- **Mutations are serialised** (a promise chain): each reads what the last one
  wrote, so two adds in flight both land. A failed one does not block the next.
- **A change that could not be stored did not happen**: a failed write fails
  the call (`unknown`) and the team is as it was — the vendor profile's rule
  (3E-1), not the address book's.
- **New ids come from the clock** (`tm_<base36 ms>`, suffixed on a clash,
  injectable `now`). Not "max + 1": that hands a removed member's id to the
  next person, and an edit form still open on the removed member would then
  save over somebody else.

**Mock storage.** `AsyncStorageMockVendorTeam`, key
`AppConfig.storage.mockVendorTeamKey` (`@fixora/mock-vendor-team`) +
`/<vendor id>`, schema `{ version: 1, members: TeamMember[] }`. `read` answers
**`null` for "never saved"** and **`[]` for "saved empty"**: the starting team
is offered only until the vendor's team is first written, so a vendor who
removes everybody is never handed the fixtures back. Strict decode (a member
that does not decode is dropped; a repeated id keeps the first); another
version, bad JSON or an unreadable device read as never saved; nothing throws.
Kept at logout, as a vendor's own record. Since 3E-11 the schema is
**version 2** (members carry `status`); version 1 is still read, every member
as `ACTIVE`.

**Mock data.** `mockVendorTeamData`: Ravi (`usr_vendor_1`) starts with three —
Suresh Naik (Senior technician, phone), the long-name stress case (57-char
name, 51-char role, phone), Farhan Ali (Helper, **no phone**). Meena
(`usr_vendor_2`) and any registered vendor start with nobody. No role names a
service category.

**Team tab.** One `FlatList` owning the scroll; heading, **Add team member**
(only over a team) and any stale notice are its header. Each
`TeamMemberCard`: initials avatar, name and role (two lines each, then cut on
screen only), phone line only when there is one, then **Edit** (secondary) and
**Remove** (danger) as equal halves that wrap to full rows when they cannot fit.
States: placeholders while the first read runs ("Loading your team", busy);
`ErrorState` + Try again on a failed first read (no pull, no Add over it);
§48's "No team members yet" / "You haven't added any team members yet." with
its own **Add team member** — the only Add then, never two; a failed pull
keeps the team under `StaleNotice` ("Your team may be out of date."). Reads go
through `useSingleFlightQuery`. **Re-read on returning to the tab or from the
form, not on first focus** (3D-9's rule), and only once there is a team.

**Removing.** Remove → `ConfirmDialog` "Remove team member?" / "<name> will be
removed from your team." / Cancel · Remove (danger). The dialog stays open and
busy while the call is out (Cancel held), closes on the answer. A ref lock in
`useVendorTeam` makes five confirms one call and is released in a `finally`;
while it runs every Edit, Remove and Add is disabled and only that member's
Remove shows busy. Outcomes are toasts (the vendor side's convention): "Team
member removed." / "The team member was not removed." + the reason. The list
then shows the **team the service answered with**. ⚠️ **List reads are
numbered**, and a read started before the removal answered never overrides
that answer — otherwise a pull or a return-read already in the air could bring
the member back (pinned by a test).

**The form.** react-hook-form + zod (`teamMemberSchema`): name and role
required and bounded; phone optional and, when typed, held to `phoneSchema`
with that rule's own messages (`capPhoneInput` bounds digits as on
registration). Field errors under each field, "Check the highlighted fields."
beside Save, nothing sent until it passes. Save shows busy and a ref in
`useTeamMemberForm` refuses a second press; a failure keeps every value with
the reason above Save (Save is the retry); success toasts "Team member added." /
"Team member updated." and goes back. Edit **reads the member from the
service** (the route carries the id only): loading placeholders; a read
failure with retry; a member no longer on the team — or an id that was never
this vendor's — "This team member is no longer on your team" with Back and no
form. Leaving with unsaved changes asks first through `beforeRemove` (Back
control, Android back, gesture).

**Accessibility.** A member's details are one block: "Suresh Naik, Senior
technician. Phone 9000000101" (no phone → "Farhan Ali, Helper"). Actions are
siblings of that block, never inside it, named for the member and starting
with the visible word: "Edit Suresh Naik", "Remove Suresh Naik". The list is
named and its busy state stated on every render.

**Verification (2026-10-08).** TypeScript 0; ESLint 0 errors, 30 warnings
(unchanged); Jest 79 suites / 1553 tests (86 new: service 29, storage 8,
schema 10, list + form + removal + isolation through the navigator 39).
Release JS bundle builds. No native change.

**Device — Dark first (Fixora_Pixel7).**

- **360×640 Dark — functional and responsive.** Team tab with Ravi's three
  (one read on open); long name and role wrapping in the card; no phone line
  for Farhan; Profile → Manage team → the tab; widest node 360 throughout.
  Add: empty Save → "Enter their name." / "Enter their role." / "Check the
  highlighted fields." and no call; a 5-digit phone → "That number looks too
  short. Please check it." and no call; a valid add → toast, back, listed
  (one re-read on return). Edit: opens on stored values; role changed → toast,
  list updated. Discard guard from the Back control and Android back; leaving
  unchanged asks nothing. Remove: dialog naming the member; Cancel sends
  nothing; confirm → toast, gone, one call and **no** extra read. Patched (3 s
  per call; first read, first add, first update, first removal and third read
  failing): loading placeholders announced busy; first-load failure; five Try
  again taps → one read; a failing pull → stale notice over the team, its Try
  again clearing it; five Saves → one add, failure keeping both values, Save
  again → added; edit form loading; five Saves → one update, failure, then
  saved; five confirms → one removal (dialog busy, Cancel held, every action
  disabled), failure leaving the member, then removed. Unpatched: Ravi adds
  Kiran; Meena sees the empty state with one Add, adds Leela; **app restart**
  → Meena still has Leela; Ravi → his four, no Leela. No JS error outside the
  injected failures' own logs.
- **1080×2400 Dark — visual.** List top and bottom (last card clears the
  floating tab bar), edit form, add form with errors, remove dialog, error
  state, empty state; Requests, Dashboard and Reviews re-opened unchanged.
- **1080×2400 Light — quick regression.** Error, empty and populated states,
  the edit form and the dialog render; widest node 1080; an unpatched smoke
  afterwards with no JS error.

Two temporary patches to `MockVendorTeamService`, each reverted from a backup;
`grep -rn "TEMPORARY-VERIFICATION" src/` finds nothing and the release bundle
holds no trace.

**Found during verification and fixed.** Edit and Remove first drew at their
natural widths (`flexBasis: 'auto'`), visibly unequal; they now take equal
halves with a 40% floor so they still wrap, as on the address book.

**Backend reconciliation.** Endpoints, field names, the 80/60 ceilings,
whether role is required server-side, phone format and uniqueness, ordering,
id issuance, whether removal is a delete or §39's "disable", and Profile Image
are this app's guess. Delete `MockVendorTeamService`, its storage, the key,
`mockVendorTeamData` and the `vendorTeam` mock wiring when `ApiVendorTeamService`
lands; nothing above the service changes.

### Vendor reports (Phase 3E-8)

The vendor's basic report (PROJECT_BIBLE.md §42; §56's "View Basic Reports";
§43 lets Reports hang off Dashboard or Profile): choose Today, This week or
This month and see five figures for it — total requests, completed, rejected,
cancelled, and the average rating with how many ratings it comes from.
**Read-only and simple** — no money (payment is offline record-keeping in
Phase 1, earnings are §68's), no completion or acceptance rate (§78, Phase 2),
no chart, trend, comparison, export or date picker.

**Owner decisions, 20/10/2026.**

- **Where it lives.** Profile gets one **Reports** button (below Customer
  reviews, above Edit business profile), pushing a new stack route
  `VendorReports` (no params). The dashboard is untouched; the tab bar stays at
  four.
- **Mock** a fixture table per vendor and period, not derived from the other
  mocks.
- Decided in the slice: the screen opens on **Today** — §42 lists it first.
  Nothing remembers the last period between visits.

**Architecture.** `VendorReportsScreen` → `useVendorReport` →
`VendorReportService` (registered as `vendorReports`) →
`MockVendorReportService` → `mockVendorReportData`. Wording in
`constants/reportPresentation.ts`; one card component, `ReportFigureCard`;
`StaleNotice`, `SelectionChip`, `StarRating`, `Skeleton`, `ErrorState` and
`BackButton` reused. Copy in `VENDOR_COPY.reports` and `profile.reports`. One
icon token added, `cancelled` (`cancel`), so Rejected and Cancelled differ in
shape and not only in word.

**Contract** (`shared/services/types/VendorReportService.ts`).

- `VendorReportPeriod = 'today' | 'week' | 'month'`; `VENDOR_REPORT_PERIODS`
  lists them in §42's order.
- `getReport(period)` → `VendorReport` = `period`, `totalRequests`,
  `completedRequests`, `rejectedRequests`, `cancelledRequests`,
  `averageRating: number | null` (one decimal, the server's rounding; `null`
  exactly when there are no ratings), `ratingCount`. **No vendor id**: scoped
  by the session; `unauthorized` with no session and for a customer. A period
  that is not one of the three is `validation`.
- ⚠️ **The app sends a key and computes no dates.** Where the vendor's day,
  week and month begin — time zone, the day a week starts on — is decided where
  the requests are counted. An app-computed range would count a late-evening
  job into a different day from the server, and two phones on different clocks
  would disagree about "today".
- ⚠️ **The figures are the server's.** The app never adds them up from the
  request list or the reviews, never checks completed + rejected + cancelled
  against the total (the rest is work still waiting or under way), never
  derives one from another. A quiet period is zeros and `null`, not an error.

**Mock.** Refuses without a vendor session (checked before the period),
re-checks the period, answers a fresh copy labelled with the period asked for,
and logs the period only (`Mock report read { period }`), never the figures.

| Ravi (`usr_vendor_1`) | Total | Completed | Rejected | Cancelled | Rating |
|---|---|---|---|---|---|
| Today | 4 | 1 | 1 | 0 | none (`null`, 0) |
| This week | 15 | 9 | 2 | 1 | 4.5 from 6 |
| This month | 48 | 34 | 6 | 3 | 4.3 from 21 |

Meena and any registered vendor: zeros and no rating in every period. ⚠️ **Not
connected to the other mocks** — answering a request in the app moves no
figure, and Ravi's month is larger than his Requests tab. Counting periods is
the server's; simulating it would be inventing the period boundaries.

**The stale-period guard** (`useVendorReport`). `useServiceQuery` drops an
answer that lands after a newer read began, but it does not forget its last
answer when its deps change: for the render between the choice and the newer
read starting it still holds the old period's figures (or failure), and if the
newer read fails it keeps the old figures beside the failure. So every answer is
labelled with the period that was **asked for** (not the server's echo), a ref
notes the period the newest read asked for as it starts, and anything not for
the chosen period — figures or failure — stays behind the loading state until
that period's read settles. ⚠️ A failed first read of a period is an error,
never another period's report. The shared hooks are unchanged. Retry and pull
go through `useSingleFlightQuery`; choosing a period is never held back by it.

**Screen.** Back bar ("Back to profile"), heading and subtitle, the three
periods as `SelectionChip`s in a `radiogroup` named "Report period" (wrapped,
never disabled — the newer choice wins), any stale notice, then four count
cards two to a row (`flexGrow: 1`, `flexBasis: '40%'`) and the rating card on
its own row — sized by the row, no fixed widths, words wrap rather than
truncate. Rejected and Cancelled are neutral, not red (§49.1: ordinary
outcomes, not faults). No ratings → "No ratings yet" in the figure's place,
never "0.0"; a period with no requests adds "No requests in this period yet."
A count that is not a non-negative whole number draws "—" and is said "not
available", as the reviews refuse an untrusted average.

**States.** Placeholders while a period's read runs (one `progressbar` block,
"Loading your report", busy); a failed read → `ErrorState` "We could not load
your report" + Try again where the figures would be, chips still usable, no pull
over it; a failed pull → the figures stay under `StaleNotice`. The chosen period
is kept through a pull. No re-read on focus and no `VendorWorkSync` listener:
the screen is pushed, so every visit reads afresh.

**Accessibility.** Each card is one stop — "Total requests, 4", "Average rating
4.5 out of 5, from 6 ratings", "Average rating, no ratings yet" — with its
insides in a `no-hide-descendants` subtree (so a dump shows only the block's
`content-desc`). The chips are radios with `selected` / `checked`.

**Verification (20/10/2026).** The eight slices of this date (3E-8 to 3E-11,
3F-1, 3F-2, 3D-10) were built side by side and verified together; one run over
the whole tree covers this section and the six after it. TypeScript 0; ESLint
0 errors, 30 warnings (unchanged); Jest 106 suites / 2280 tests (27 new suites
since 3E-7), no worker-exit warning; release JS bundle builds; no native change,
so no native build. Device: the one 360×640 Dark pass (section 6) on
Fixora_Pixel7, widest node 360 on every screen measured; the forced-failure run
(`AppConfig.mock.failureRate = 1`) was restored and
`grep -rn "TEMPORARY-VERIFICATION" src/` finds nothing.

**Tests.** 82 new: service 20 (each period, zeros, refusals, session before
period, exact key set with no money or rate keys); presentation 11 (never
sums, untrusted counts and averages); `useVendorReport` 9, which **records
every render** and pins that no render ever shows one period's figures or
failure under another (removing the ref guard fails 2, the whole guard 5); the
screen through the real `VendorNavigator` 41 (out-of-order answers, a newer
period's failure, an old failure landing late, `vendorRequests` / `review` /
`vendorTeam` registered as throwing stubs, a hand-built `{ vendorId, period }`
route ignored); `RootNavigator` +1.

**Device.** Ravi: Today 4 / 1 / 1 / 0 and no ratings; This week 15 / 9 / 2 / 1,
4.5 from 6; This month 48 / 34 / 6 / 3, 4.3 from 21. One read per period
switch; a pull reads once.

**Backend reconciliation.** The endpoint (e.g.
`GET /vendors/me/reports?period=week`), the field names and the meaning of each
figure are this app's guess — see the open items. Delete
`MockVendorReportService`, `mockVendorReportData` and the `vendorReports` mock
wiring when `ApiVendorReportService` lands; nothing above the service changes.

### Complete work and the offline payment record (Phase 3E-9)

Completing a job now records what it came to (PROJECT_BIBLE.md §36:
"Completion Notes, Final Amount, Payment Method, Payment Status"; §37, the
offline payment record; §56's "Record Offline Payment"; §80). **Recorded, never
processed** (§37: "Payment Recorded ✅, Payment Processed by Fixora ❌"): no
gateway, wallet, invoice or earnings — the vendor writes down what happened and
the app keeps it. ⚠️ Nothing on any screen says Fixora took, received or
confirmed money; both payment displays end "Fixora does not process payments."
This record is the seam Phase 2's online payment would arrive beside, as its own
flow.

**Owner decisions, 20/10/2026.**

- **Flow.** "Mark completed" now opens a **Complete Work** form (stack route
  `CompleteWork: { requestId }`, ids only) instead of going straight to the
  3E-5 dialog. The form's "Complete work" validates, then shows the existing
  `CompleteWorkDialog`; confirming sends the call. Success → back to wherever
  the form was opened, showing the completed request. `invalidTransition` →
  as 3E-5 (calm toast, every screen re-reads) and the form is left. Failure →
  everything kept, button live again, toast with the `userMessage`.
- **Fields.** Final amount (required; rupees on a decimal keypad, at most two
  decimals, above 0, at most ₹10,00,000); payment status ("Paid" / "Not paid
  yet", sent as `PAID` / `UNPAID`); payment method (required only when Paid,
  hidden and dropped from the payload otherwise, the options from the service);
  completion notes (optional, at most 500, sent exactly as typed, left off when
  blank).
- **Currency** from a new `AppConfig.money.currency` (`'INR'`) — the single
  source; "₹" is written only in the formatter's table.

**Decisions taken in the slice.**

- **The list's "Mark completed" opens the form too.** The contract now requires
  a completion, so a bare dialog could no longer complete; the 3E-5 dialog is
  drawn only by the form. The entry button keeps its label and spoken name; its
  hint now says it opens the form.
- **How the details learn of a completion made on the form.** The details cannot
  adopt the answer (the form made the call), and a store would break 3E-4's "a
  signal, not a store". So the details screen listens to `VendorWorkSync` and,
  when the revision moves **while it is out of view**, `reconcile()`s (sets its
  record aside and re-reads). Its own actions happen in view and are adopted as
  before, with no second read. ⚠️ In-view comes from `focus` / `blur` events, not
  from a check during render: on the way back the completion's signal and the
  return can land in one render, and the navigator emits `focus` from its own
  effect after the screen's. ⚠️ The flag **starts from
  `navigation.isFocused()`, not `true`**: a details screen mounted without ever
  being focused (a stack restored with Details and CompleteWork together) never
  gets a `blur`, and a completion above it would never be re-read (pinned).
- `useVendorRequestDecision` gained `complete(requestId, completion)`;
  `answer()` now takes only `accept | reject | start`. One guard, one set of
  toasts, one signal — completion is still one of the four actions.
- **Payment words are shared** (`shared/presentation/payment.ts`, re-exported
  by `vendor/constants/paymentPresentation.ts`), the `requestTokens` / `rating`
  precedent: "Paid · UPI" must read the same to the vendor and the customer. An
  unknown status reads "Payment status unavailable", with no method.
- **`isFinishedWork(job)`** (`COMPLETED` / `CLOSED`) in `jobPresentation`: a
  payment card on work under way would contradict its status.
- **The customer sees less than the vendor**: the amount, status · method label
  and "Recorded by your professional" — no method id and **no completion
  notes**, which are the professional's working notes, not a message. Owner
  decision, 21/10/2026: they stay vendor-only. The field invites working notes
  ("What was done, parts used, anything to remember about the job"), and a
  summary for the customer would need its own field and its own wording.
- A server `validation` is the failure toast, not field messages; mapping it
  needs `fieldErrors` on a real contract.

**Contract** (`shared/services/types/VendorRequestService.ts`).

- `completeRequest(requestId, completion: VendorCompletionInput)` with
  `{ finalAmountMinor, currency, paymentStatus, paymentMethodId?, notes? }`.
  ⚠️ `paymentMethodId` and `notes` are **absent** — not `null`, not `""` — when
  they do not apply (exact key-set tests for both payloads, at schema level and
  through the screen).
- `listPaymentMethods()` → `PaymentMethodOption { id, label }[]`. The app holds
  no list of its own.
- `VendorRequestDetails.completion?: VendorCompletionRecord` — what was sent,
  plus `paymentMethodLabel?` named by the server when it was recorded. Customer:
  `CustomerRequestDetails.payment?: CustomerPaymentRecord { finalAmountMinor,
  currency, paymentStatus, paymentMethodLabel? }`.
- On the contract: `PAYMENT_STATUS_PAID` / `PAYMENT_STATUS_UNPAID`,
  `FINAL_AMOUNT_MAX_MINOR` (100,000,000 = ₹10,00,000.00),
  `COMPLETION_NOTES_MAX_LENGTH` (500 — the request notes' figure, its own
  constant because it bounds a different field).

**Money** (`shared/presentation/money.ts`). ⚠️ **Integer minor units, by
hand** — no `Intl`, no `toLocaleString`, and never `parseFloat * 100` (1.15 →
115, pinned). The typed amount must match `^\d+(\.\d{1,2})?$` and its digits are
joined: "1,000" is refused (a comma is ambiguous), as are "-5", ".5", "5.",
"1e3" and "1 000". `formatMoney` writes INR with Indian grouping
("₹1,25,000.50", whole rupees without decimals), an unknown currency as its code
("USD 1250.50"), and anything that is not a safe integer as "", so a screen
leaves the line out.

**Mock rules.** The body is checked first (as an endpoint validates before
touching the record), then the request, then its status. `validation` for an
amount that is not a safe integer, is 0 or less or is over the ceiling; a
currency that is not `AppConfig.money.currency` (a symbol is refused); a status
that is not exactly `PAID` / `UNPAID`; PAID without a known method; UNPAID with
any method; notes over 500. A refused, invalid or failed completion records
nothing. The methods are §37's five, in its order: `cash`, `upi`,
`bank_transfer`, `card`, `other`. Fixtures: REQ-30912 Geyser wiring, ₹1,850,
PAID · UPI with a note; REQ-30833 Socket replacement, ₹650, UNPAID; the older
three with no record. Customer: REQ-24048 Switch Repair, ₹450, PAID · Cash, and
a new seed, REQ-24012 Tap Fitting (`CLOSED`), with none. ⚠️ The vendor and
customer mocks **share no data** — a payment recorded in the app appears on no
customer request. Joining them is the backend's.

**The form.** "Complete work", "Ref <id>", and "Record what the job came to and
whether the customer has paid you. Fixora does not process payments." The
amount capsule carries a "₹" prefix hidden from TalkBack, the symbol said in the
field's name instead. Status is a radio group with nothing preselected. Methods
(only when Paid) have their own placeholder, failure with Try again
(single-flight) and empty sentence. Choosing "Not paid yet" clears the method's
message, so "Check the highlighted fields." never points at nothing; the chosen
method is kept, unsent, if they switch back. Every message shows on the first
press (zod 4 runs the object refinement even when a field failed — checked).
Inputs lock while the call is out; the dialog is busy and cannot be dismissed.
`beforeRemove` asks "Discard this completion?" — never when untouched, in
flight, or after completing. A mounted ref stops a late answer navigating a form
that has gone.

**Displays.** Vendor details: a **Payment** card under the heading on finished
work with a record — Final amount, Payment status ("Paid · UPI" / "Not paid
yet"), Completion notes when there are any, and "Recorded by you. Fixora does
not process payments." Customer details: a **Payment** group before "Your
review", only for a completed or closed request with a record. List and
dashboard cards are unchanged.

**Tests.** 148 new: money 29, schema 39, mock completion 32, the form through
the real `VendorNavigator` 27 (plus the restored-stack test above), customer
details 12, `isFinishedWork` 9. The 3E-5 suites now complete through the form,
and `answer(id, 'complete')` no longer type-checks.

**Device.** Form errors on an empty submit; `1,250` refused; Paid shows the
five method chips, wrapping; UPI + a note → confirm → the job first under
Completed, and on its details the Payment card: ₹1,250.50 · Paid · UPI · the
note. Fixture Geyser wiring: ₹1,850 · Paid · UPI. Customer Asha, Switch Repair:
₹450 · Paid · Cash, "Recorded by your professional".

**Backend reconciliation.** Every value above is this app's guess — the
endpoints, `PAID` / `UNPAID`, the method ids and labels, integer minor units,
`INR`, the two ceilings, whether the label is stored with the record, body
before state, and the customer's subset. The completion rules and fixture
records go with the other vendor mocks.

### Vendor shop images (Phase 3E-10)

The vendor's shop images (PROJECT_BIBLE.md §38's "Shop Images" and "Upload
Shop Images"; §57's vendor "Shop Images"; §16's upload rules): a "Shop images"
card on Profile, and a pushed **Shop images** screen to add, retry and remove
photos. **Each change is saved as it is made** — no Save button and no draft.
Customers see shop images nowhere yet (§18A.3's vendor list item is unchanged).

**Owner decisions, 20/10/2026.**

- **Contract.** `VendorProfile.shopImageUrls: string[]` — always a list,
  possibly empty, in display order. `updateShopImages(imageUrls)` replaces the
  whole list (session-scoped, no vendor id) and answers with the whole profile.
  ⚠️ `VendorProfileUpdate` — the profile form's save — does **not** carry shop
  images, so the form can never wipe them.
- **Ceiling** `AppConfig.image.maxShopImagesPerVendor` = 6. Size, type and
  compression are `AppConfig.image`'s existing rules, through `ImageService`.
- **UI.** A Profile card with up to six squares or "No shop images yet", and
  "Manage shop images" → `ShopImages` (no params). The screen: a responsive
  grid, an add tile while under the ceiling, a counter, Remove behind
  `ConfirmDialog`, upload with progress, a failed upload kept with retry, a
  failed save kept as "Not saved" with Try again, one save at a time.
- **Reuse.** Shared pieces unchanged; customer photo code untouched — the tile
  is a vendor sibling of `RequestPhotoTile`, its docblock saying why.

**Decisions taken in the slice.**

- **Both ways in on the add tile**, "Take a photo" and "Choose a photo", as two
  halves of one square — the request photos' rule: camera and library are
  different intentions, chosen before any permission dialog. The camera
  permission is asked on "Take a photo" only; a refusal says "We could not open
  the camera. You can choose a photo from your library instead." One photo per
  pick. Compression per attempt, as `useImageUpload` does.
- **Serialised in the hook.** Two uploads may run side by side; their saves wait
  in one line, each built on the list the previous save stored, and removals
  wait in the same line.
- **Removing an unsaved photo asks nothing** (nothing stored is lost); only a
  saved photo asks first. A photo whose save is waiting or under way shows no
  Remove — that save would put it back.
- ⚠️ **A save has two states**: `waiting` ("Waiting to save", in line) and
  `saving` (from the moment its turn comes, set immediately before the call goes
  out). Leaving with anything **unsent** — uploading, upload failed, waiting, not
  saved — asks "Leave before your photos are saved?", adding "A photo already
  saving will still be added." only while one is in the air; a save already sent
  cannot be recalled, so it finishes and is adopted, and leaving with only sent
  saves asks nothing. If everything unsent becomes sent while the dialog is open,
  the screen leaves by itself — the vendor already asked to.
- ⚠️ **"Already stored" is taken only when it can be this photo's own doing.** A
  failed save records `mayBeStored` — true only when the outcome is unknown
  (`AppError.isRetryable`), false for a refusal. Try again skips the call only
  when `mayBeStored` **and** the URL is in the stored list; a first save, or a
  retry after a definite refusal, is always sent. See Lessons.
- **Taking off a photo whose save failed keeps the uploaded file** — that save
  may have been stored with only its answer lost. `ImageService.remove` is
  called only for a photo that never reached a save.
- **`MockImageService` URLs are unique across launches** (a per-launch token
  beside the `mockId`, the lead's OK): the counter restarted at 1 each launch,
  so the first photo of a launch had the URL of one stored on an earlier launch.
- Outcomes are toasts (the vendor convention): "Shop photo saved.", "Shop photo
  removed.", or "The photo was not saved." / "… not removed." + the reason. The
  counter counts what is on screen ("3 of 6 photos").

**Architecture.** `ShopImagesScreen` → `useShopImages` → `ImageService` +
`PermissionService` (add) and `VendorProfileService` (`getProfile`,
`updateShopImages`) → `MockVendorProfileService` → `MockVendorProfileStorage`.
Components: `ShopImageTile`, `AddShopImageTile`, `ShopImagesSection` (the
Profile card). No new token, dependency or native change; the registry is
unchanged.

**Contract.** `updateShopImages` refuses with `validation` a list over the
ceiling, an entry that is not an uploaded `http(s)` URL (blank, local file, not
text), a URL twice, or not a list; `notFound` before the business profile exists;
`unauthorized` with no session or for a customer. A refusal changes nothing.

**Mock rules.** Trims each URL, then refuses the whole list rather than dropping
or reordering anything. ⚠️ **`saveProfile` and `updateShopImages` are serialised
together** (a promise chain, as the team mock), so a form save in flight cannot
write the old list back over a new photo, and `saveProfile` keeps the stored
list whatever it is sent. A change that could not be stored did not happen
(3E-1's rule, now one `store` helper for both calls).

**Mock storage.** `StoredVendorProfile` is the update plus an optional
`shopImageUrls`. ⚠️ **Schema version stays 1**: the rule is to bump when an old
record cannot satisfy the new shape, and an old record satisfies it by having no
list — bumping would make every saved profile unreadable and send each vendor
back through setup (the `preferredVendor` precedent). A list that is present but
not a list of non-blank strings makes the whole record read as none, as any
corrupt field in that file does; a repeated URL is read once.

**Profile card.** Between the Business and Contact cards: overline, squares in
rows (three on a phone) built as explicit rows of `flex: 1` cells, each spoken
"Shop photo 2 of 4", "No shop images yet" when none, and **Manage shop images**.
The screen adopts every save's answer into `VendorProfileContext`, so coming
back shows it with no read.

**Shop images screen.** Back bar "Back to profile", heading, "Photos of your
shop, your van or your work. Each change is saved as you make it.", counter,
grid, and a live notice line for a refused camera, a refused file or the
ceiling. The grid takes the theme's breakpoint columns (two on a phone) with
squares sized from the window — never a fixed width — and is not a `FlatList`:
it is bounded at seven cells, and a list's column count cannot change without
remounting. Placeholders on the first read; `ErrorState` with Try again on a
failed first read (no pull, no add tile); a failed pull keeps the photos under
`StaleNotice`. Reads are single-flight and **numbered** (3E-7's rule): a read
started before a change answered never overrides it.

**Tiles.** Uploading (dimmed, a primary progress bar along the bottom), Waiting
to save (clock glyph), Saving, and Upload failed / Not saved (warning glyph,
"Try again", a thick danger border; the whole tile is the retry). ⚠️ State words
sit on a **`surface` label**, not inverse text on the scrim, so they read in
both themes. Remove is a small `surface` circle, 30dp drawn + 8dp slop.

**Accessibility.** A saved tile is one image node, "Shop photo 2 of 4"; in
progress, "…, Uploading" / "…, Saving"; a failed one is the button "Try again,
shop photo 3 of 4, Upload failed". Remove is "Remove shop photo 2 of 4" with a
hint that says whether it asks first. The add halves start with their visible
words and say how many more fit.

**Tests.** `MockVendorShopImages.test.ts` 36 and `VendorShopImages.test.tsx` 42
through the real `VendorNavigator` — including both serialisation directions,
the stale read, the leave dialog with one sent and one waiting save, the
"already stored" shortcut only after an unknown outcome, and the whole tree
unmounted mid-upload with a save in the air. Three existing suites gained the
contract's new required field.

**Device.** Add; two quick adds both land; remove with its confirm; the Profile
thumbnails after Back.

**Found during verification and fixed.** At 360dp the add tile's "Take a photo"
drew as "Take a" — a 69dp box, one line, the last word gone: the 3E-3 measuring
defect again, this time in centred text sized by its own content. The label now
has a definite width (`alignSelf: 'stretch'`), centred inside it. See Lessons.

**Final review rounds (21/10/2026) — one line per vendor.** Three more review
rounds each found a timing case in the save queue (a lost answer, a pull and a
second save interleaving), so the model was simplified rather than patched
again. ⚠️ **Every read and every change of the profile — the first read, a
pull, Try again, a shop-image save or removal, and the profile form's own save
— waits its turn in one line that belongs to the vendor's session**
(`inLine<T>` on `VendorProfileContext`, keyed by vendor id in `VendorNavigator`,
gone at sign-out; an operation whose turn comes after the provider has gone is
refused as `cancelled`). No read can overlap a change, so the list on screen and
on Profile changes only when an operation ends, in line order, and an older
list can never land after a newer one — including across leaving the screen and
coming back (a save still "Saving" when the vendor leaves finishes before the
reopened screen's first read). A read that ends after its screen has gone is not
adopted. A "Not saved" photo whose save got no answer (`mayBeStored`) is settled
only at a line boundary: its URL in the answer means saved after all (one
toast), missing means not stored. Removal no longer holds the dialog open:
confirming closes it and the tile shows **"Removing"** until the answer
(failure puts it back, with a toast). A pull made while a save is in the air
keeps its spinner until that save answers — accepted. The leave dialog names
the tiles' own words and says "may not be added" only when a save's answer was
lost (`mayBeSaved`). `VendorShopImages.test.tsx` ends at 61 tests; every fix was
mutation-checked, and every earlier check re-run on the final model.

**Device, normal phone size (1080×2400 Dark, 21/10/2026).** Two photos stored
earlier survived an app restart; a photo added while pulling landed (3 of 6)
and Profile showed three; a removal through its confirm left two. Small
screens by calculation: the grid sizes squares from the window width, labels
have a definite width.

**Backend reconciliation.** The endpoint and its shape (a whole-list PUT, or add
and remove per image), the field name, the ceiling of 6, ordering, the duplicate
rule, `notFound` before setup, and whether shop images live on the profile
record at all are this app's guess. Delete the mock's `updateShopImages` rules
and the storage field when `ApiVendorProfileService` lands; nothing above the
service changes.

### Rating breakdown and team member status (Phase 3E-11)

Two follow-ups that 3E-6 and 3E-7 left out because the contract had nothing
for them: §41's "Rating Breakdown" ("★★★★★ 80%") under the average on Reviews,
and §39's "Status" and "Disable Team Member". Reviews stay **read-only**.

**The breakdown — contract** (`ReviewService`). `VendorReviews` gains
`ratingBreakdown: VendorRatingCount[]`, `{ stars, count }`. **Always five
entries, five stars first; a star nobody gave is a count of zero**, not left
out. ⚠️ **Counts, never percentages**: the app works out each share so the five
shown always add up to exactly 100 — shares the backend had rounded could add
up to 99 or 101. Counts that disagree with `totalReviews`: the breakdown trusts
its counts (shares of their own sum), the summary keeps the total.

**The arithmetic** (`ratingShares`, in `shared/presentation/rating.ts` beside
the rating words — a rule about ratings, not one screen). Largest remainder:
each share is rounded down, and the points still missing from 100 go one each to
the shares that lost most; **ties go to the row with more stars** (the drawing
order), so the same counts always give the same figures. Integer arithmetic
throughout, so a tie is a real tie (1/1/1 → 34/33/33; 3/3/2 → 38/37/25). A star
nobody gave is always 0% and never takes a point. **No breakdown is drawn** when
there is nothing to share **or when it cannot be read** — not a list, a star off
the scale or given twice, a count negative or not whole: one wrong figure hides
the whole breakdown, as the summary refuses an average it cannot trust. A star
the backend leaves out is taken as zero.

**The breakdown — UI** (`RatingSummaryCard`). Under the average, in the same
card, only when the summary itself is drawn. Each row: the number and a small
filled star, a bar, the percentage. ⚠️ **Bars are the same length in every
row**: the star and percentage columns take their text's width and the bar
`flex: 1`, with the percentage column held open at the width of "100%" by an
invisible, zero-height copy of it — so "0%" and "100%" rows get the same bar and
"100%" can never clip. Digits are `tabular-nums`; track `borderStrong`, fill
`warning`, existing tokens only. The summary placeholder grew so nothing jumps.
Each row is **one stop**, "5 stars, 50 percent, 2 reviews", its parts in a
`no-hide-descendants` subtree. The mock counts the breakdown from the very
reviews it returns: Ravi 2 / 1 / 1 / 0 / 0 → 50 / 25 / 25 / 0 / 0; Meena five
zeros → none.

**Team status — contract** (`VendorTeamService`). `TeamMember.status` is a
**plain string**, the backend's vocabulary; known values in `TEAM_MEMBER_STATUS`
(`ACTIVE`, `DISABLED`). ⚠️ **Add and update never carry a status**
(`TeamMemberInput` omits it): a new member is `ACTIVE` and an edit keeps the
member's status (the mock ignores one smuggled into the input — pinned). New
`setMemberStatus(memberId, status)` answers with the whole team: session-scoped,
`notFound` for a member not on this team, `validation` for anything but exactly
`ACTIVE` or `DISABLED`, idempotent, serialised through the same change chain, a
failed store failing the call. **A mark the vendor keeps and nothing more** —
a disabled member stays on the team, in their place; nothing signs in, is
assigned (§40 is not built) or is blocked because of it.

**Team status — storage.** `SCHEMA_VERSION` 1 → **2**. ⚠️ **Version 1 is still
read**, every member as `ACTIVE` (nobody could be disabled then); reading it as
never saved would hand vendors the starting team back over their own. It is
rewritten as v2 on the next change. In v2 a member whose status is missing,
blank or not a string does not decode and is dropped; a well-formed status the
app does not know (`ON_LEAVE`) is kept as written — wording it is the
presentation table's job.

**Team status — presentation** (`teamMemberStatus.ts`). `ACTIVE` → "Active"
(no badge on the card); `DISABLED` → a neutral "Disabled" badge; anything else
→ a neutral "Status unavailable", the raw value never drawn, and treated as
**not** disabled, so the form offers "Disable member" (which sets a known
status) and never "Enable member". The table also chooses the form's sentence,
so the screen never picks wording.

**Team status — the edit form** (edit mode only; the add form has no status).
Under Save, a "Status" section with the badge, a sentence and one button:
**Disable member** (danger, behind `ConfirmDialog`, busy and undismissable while
the call runs) or **Enable member** (secondary, no confirm). It applies **at
once, not on Save**; the form's member is read from the answer. Typed values are
untouched and the discard guard is not woken by the change alone. Status and
Save refuse each other while either runs (refs, before state lands). The card
ends its spoken block with the status: "Farhan Ali, Helper. Disabled".

**Leaving mid-change.** ⚠️ Back during a status change or a Save could let the
Team tab's return-read finish **before** the write, so the list said "Disabled"
under "Team member enabled." The form now **holds** any leave while
`isBusy()` (read from refs, true the instant a change starts) and releases it
once, never after unmount, never while the other change runs; a successful Save
takes the held leave as its own way back, instead of `goBack`, never both. ⚠️
The release does **not** send the held action back through the guard — React
Navigation 7 lets a re-dispatched action skip that screen's `beforeRemove` (see
Lessons) — so it asks the unsaved-changes question itself: dirty → the discard
dialog with the held action, clean → dispatch.

**Tests.** Breakdown: `rating.test.ts` 17 new (including an exhaustive 0–3 per
star sweep always summing to 100), presentation +5, mock +2, screen +6. Team:
service +14, storage +8, schema +1, `VendorTeam.test.tsx` now 68, among them
the three hold tests and three "saving and the status never overlap" tests that
press a handler drawn before the other change began; six mutation checks, each
failing its test.

**Device.** Reviews: the breakdown 50 / 25 / 25 / 0 / 0, bars aligned, nothing
clipped, one spoken stop per row. Team: Disable (dialog, badge, spoken
"Disabled"); Enable then Back at once lands on Team with the right status.

**Backend reconciliation.** Breakdown field names, "always five, zeros
included" and star order; the status endpoint (a call of its own or a field on
update), its vocabulary and casing, whether setting the same status is an error,
whether a disabled member can be removed and whether §39's "disable" replaces
removal. The v1 → v2 read goes with the mock storage.

### Analytics and crash handling (Phase 3F-1)

PROJECT_BIBLE.md §54 (only essential events; analytics "must not interfere with
business operations"), §57's Shared "Analytics" and "Crash Handling", §49 (never
a raw error), §7A.2 (the vendor auth code never in analytics or crash reports),
§58 (why the dispatch events matter). **Seams only** — no analytics or crash SDK,
no new dependency, no native change, nothing from §78 (no screen views, funnels,
timings, user traits or dashboards). Built in two slices on one day: the seam
and the auth events, then §54's events in the customer and vendor flows.

**Two services behind the registry**, both synchronous, fire and forget, never
throwing: `AnalyticsService` (`analytics`) — `track(event, properties?)`,
`identify({ id, role } | null)`; `AnalyticsEventName` is a closed union of
exactly §54's nineteen events, and properties are a flat record of string,
number and boolean. `CrashReporter` (`crashReporter`) — `recordError(error,
{ fatal?, source? })` with `source` `'render'` or `'global'`, and `setUser`. Both
mocks are registered in the mock branch, beside `location`: there is no provider
to register, and they move up beside `permission` the day one is approved — a
provider is not the backend.

**One door: `shared/services/telemetry.ts`** (`trackEvent`, `identifyUser`,
`recordError`). Everything that is not a component goes through it; components
use `useAnalytics()`, whose frozen `{ track }` is `trackEvent` itself.

- It resolves the service at call time and **does nothing when none is
  registered** (one debug line per service per process) — a suite that resets
  the registry loses an event, not a sign in.
- It catches anything an implementation throws (logged by error name only); one
  service failing does not stop the other being told.
- `identifyUser` copies `{ id, role }` out of whatever it is given — TypeScript
  lets a whole `AuthUser` through, so the copy is what keeps a name and phone
  out.
- ⚠️ **`trackEvent` drops a property whose key looks personal** and logs the
  key, never the value, always (not only in debug): name, phone, mobile, email,
  address, street, location, latitude, longitude, note, comment, message, text,
  body, description, otp, code, token, password, secret, vpa, whatsapp,
  contact, aadhaar, msisdn, birth, pincode, landmark, house anywhere in the key,
  and `upi`, `pan`, `pin`, `dob`, `lat`, `lng`, `zip` as whole camelCase words
  (`upiHandle`, `panNumber`, `PANNumber` — an acronym is its own word — but not
  `groupId`, `companyName`). Any string value containing `@`
  is dropped whatever the key — an email address or a UPI handle. Booleans pass
  (`hasNote: true`), and so do id-named keys (`id`, `…Id`) — **except** an id
  that names a contact or an identity number (`emailId`, `whatsAppId`,
  `aadhaarId`, `upiId`, `panId`): in Indian usage an "email id" or a "UPI id" is
  the address itself. A test pins that every key the app sends today still
  passes (found across three review rounds, tests added). Non-primitive values
  are dropped. A net under the rule, not the rule.

**Error boundary.** `AppErrorBoundary` (`shared/components`) wraps the
`NavigationContainer` inside `AppRoot` — inside Redux, safe area and theme, so
the fallback is themed and the session survives; the `StatusBar` moved out to
sit beside it. A render failure is recorded once (`componentDidCatch`, `fatal:
false`, `source: 'render'`), then a full-screen fallback: "Something went wrong"
announced as a header, "Sorry — the app hit a problem. Try again, and if it keeps
happening, restart the app.", and **Try again**, which resets the boundary — the
navigators remount and the user lands on the first screen of their side, still
signed in. The error's message is never rendered. A sibling of `ErrorState`, not
a use of it: there is no `AppError`, and retry re-renders rather than re-fetches.

**Global handler** (`app/globalErrorHandler.ts`, installed by bootstrap after
`configureServices`). Wraps `ErrorUtils`' handler: records with React Native's
`fatal` and `source: 'global'`, then **always** calls the previous handler — the
red box in debug and release crash handling are unchanged. ⚠️ Idempotent by a
mark on the installed handler (`Symbol.for('fixora.globalErrorHandler')`), not a
module flag, so a Fast Refresh re-evaluation does not wrap it twice.

**The rule for every event.** Each fires once, at the moment the thing happened,
from the place that already owns that moment — the auth thunks for the session,
the feature hook for a service call, the screen's own handler for a selection.
After the service said yes; never on failure, refusal, an ignored second tap or a
re-render. Properties are ids, enums, counts and booleans only.

| Event | Where | Properties | Notes |
|---|---|---|---|
| `app_opened` | bootstrap | — | Once per JS start; coming back from the background sends nothing. |
| `login_completed` | `signInCustomer`, `signInVendor` | `role` | Every successful verification. `identifyUser` runs first, so the event is the user's; `identifyUser(null)` on sign out, the 401 handler included. |
| `vendor_signup` | `confirmVendorAuthCode` | `role` | Onboarding finished; not `login_completed` as well. |
| `category_selected` | Categories and Home's tile | `categoryId` | A tile tap only — never See all, the primary action or the empty state's. |
| `subcategory_selected` | Sub Categories | `categoryId`, `subCategoryId` | A row tap. |
| `request_started` | Create Request (`beginDraft`) | `categoryId`, `subCategoryId` | The first time this form starts a draft — autosave, leaving with something entered, or Continue, whichever comes first — and only when it did not open on its own service's draft. A ref, not a look at the draft (a just-started draft reaches `liveDraft` a render later). |
| `vendor_selected` | Preferred Vendor, Continue | ids + `vendorId` | Not on card taps. |
| `vendor_selection_skipped` | same | ids + `reason` | `list_loading` (checked first — a retry clears the error), `list_failed`, `list_empty`, `chosen_none`. |
| `request_created` | `useCreateRequest`, after the send | `requestId`, ids, `priority`, `directed`, `photoCount`, `hasPreferredDate`, `hasPreferredTime` | Read off the accepted payload; the retry that works counts once. |
| `review_submitted` | `useSubmitReview` | `requestId`, `rating` | Never the comment; never on `conflict`. |
| `request_viewed` | `useVendorRequestDetails` | `requestId`, `dispatch` when known | Once per opening, keyed by record id: re-reads and the re-read after a completion never count again. |
| `request_accepted` / `request_rejected` | `useVendorRequestDecision` | `requestId`, `dispatch` when known | `dispatch` comes from the waiting record the caller holds (`answer`'s optional third argument): the answered record has none. Absent, not `'unknown'`. |
| `request_accept_lost` | same | `requestId` | Only an accept refused with `taken`. |
| `work_started` / `work_completed` | same | `requestId`; `paymentStatus` on completion | Never the amount, currency, method or notes. |

The two vendor-choice events are remembered per screen instance as the last
decision said: a double tap, or Back from the summary and Continue unchanged,
sends nothing; a changed mind sends again. Vendor events never fire for
`notPending`, `invalidTransition`, `notFound` or any failure.

**Not sent, and why.** `signup_completed` — the verify response does not say
whether it created the account, so every customer verification is
`login_completed` for now. `vendor_approved` and `request_completed` — the
backend's to emit (approval happens server-side; the customer app never
witnesses completion, and `work_completed` carries the same `requestId`). No
`resumed` event — §54's list is closed.

**Known limits, by design.** Resuming straight to the summary after a kill
sends no vendor event (`request_created.directed` is the authoritative split);
a remounted Preferred Vendor screen sends its decision again; category taps are
not deduped (navigation absorbs a double tap, analytics does not);
`request_viewed` counts each opening.

**Tests.** 62 for the seam (mocks, the door with exact key sets and nested
values dropped, the hook, the boundary, the global handler's order and double
install, bootstrap, twelve auth-event tests) and 75 in the flows, each suite
with an analytics stub asserting exact key sets, nothing on failure, refusal,
cancel or an ignored tap, and — serialised — no names, phones, addresses,
notes, comments, amounts, method ids or photo URLs; two prove a throwing
analytics service changes nothing. The lead added the contact-handle test.

**Device.** Asha: `login_completed` and the identify lines logged; an
Electrician tile → `category_selected { categoryId }` only; a full request →
`request_created` with ids and flags only. Ravi: `request_viewed` on opening
REQ-31042 from the inbox.

**Backend reconciliation.** Provider choice, consent, retention and sampling
belong to the day a provider is approved; delete both mocks and their
registrations then. The open items list what the backend must add or emit.

### Notifications inbox (Phase 3F-2)

The in-app notifications §57 lists under Shared, at §80's level — **Basic**: a
bell with the unread count at the top of Customer Home and the Vendor
Dashboard, and one inbox that lists, marks read and opens. **In-app only.**
Push, email, SMS and WhatsApp are §72's Phase 2: nothing registers a device,
asks a permission or schedules anything, and `registerDevice` /
`unregisterDevice` stay the inert seams they were.

**Owner decisions, 20/10/2026.**

- **Where it lives.** A new role-agnostic feature, `src/features/notifications/`
  (as onboarding is): the screen, `NotificationBell`, `NotificationCard`,
  `useNotifications`, `useUnreadNotificationCount`, `notificationSync`, and the
  copy, link and presentation constants.
- **One screen, two registrations.** `Notifications: undefined` in both stack
  param lists, the same component registered in each, so neither role's
  navigation holds the other's (§3). The vendor's exists only once setup is
  complete.
- **Entry.** The bell, top-right: on Home after the decorative avatar (a new
  `trailing` slot on `HomeGreeting`, so the greeting knows nothing about
  notifications), on the Dashboard beside the greeting heading, never inside
  it.
- **Memory-only mock**, documented: a stored inbox would have needed a key, a
  schema and a strict decode for something that is not the account's own record.

**Contract** (`NotificationService` — signatures unchanged, rules now written
on it). Scoped by the session; no call takes an account; `unauthorized` with
nobody signed in. Either role has an inbox. An id not in this account's inbox
is **`notFound`, not `forbidden`**, so another inbox can be neither changed nor
discovered. `list` answers newest first and the app never re-sorts; the page
size is `AppConfig.pagination.defaultPageSize`. `markAsRead` on one already
read succeeds and changes nothing. `remove` stays on the contract, offered
nowhere. ⚠️ `deepLink` is an **opaque backend string** and `type` is shown to
nobody and **never branched on**.

**The link.** `parseNotificationLink` understands exactly
`fixora://requests/<reference>` (scheme and place without case, the reference
kept exactly and decoded). Anything else — absent, another scheme or place
(`fixora://reviews`), anything after the reference, a broken escape — is null:
the row is marked read and nothing opens. ⚠️ The link says **what** to open,
never **where**: the screen picks the route from the session's role, as
`RootNavigator` picks the application — `RequestDetails` or
`VendorRequestDetails`, `{ requestId }` only.

**Mock.** An inbox per user id, made the first time that account asks; copies
out; each change one synchronous step, so two marks in flight both land; logs
counts, never content. Asha: 22, six unread, more than one page, told as the
customer seed's own history, with one long row, one unknown link and one with
none. The second customer: the same 22, all unread (the bell's "9+"). Ravi: 8,
five unread, linked to his real requests. The third customer, Meena and anyone
registered: none. Marks last for the life of the app; a restart brings the
fixtures back.

**The bell.** A ringed, raised 44dp disc, as `BackButton` is. The badge: the
count, **"9+" above nine**, nothing at 0 or with no count; a `danger` fill with
**`onDanger`** digits — white in both themes (the lead's change: `textInverse`
on red500 is 4.2:1 in dark, white 4.8:1). Spoken "Notifications, 3 unread"
(always the exact number); the badge is hidden inside the button. ⚠️ **A failed
count read is no badge, never an error UI.** It reads on arrival, again each
time its screen regains focus, and again whenever the inbox says a mark
succeeded (`notificationSync`) — so a mark still in flight when they came back
is counted once it lands. Focus comes from `NavigationContext`, not
`useFocusEffect`, which throws outside a navigator; the first focus event is
ignored, so arrival is one read. Since 3G-2 (21/10/2026) that is the shared
`useNavigationEvent('focus', refresh, { onlyOnReturn: true })`, which does
exactly this.

**`notificationSync`.** A signal, not a store (the `VendorWorkSync` idea), but a
module rather than a context: the bell and the inbox are screens of two
applications, and a provider would have been threaded through both navigators
to carry nothing.

**The inbox.** One `FlatList` owning the scroll: Back bar, heading, then **Mark
all as read** only over notifications. Each card: the backend's glyph (the bell
when absent, never one chosen from `type`), the title (strong when unread, wraps
fully), the body (two lines), the time (the shared `formatRequestDate`), and an
unread dot. Unread is said three ways on screen — weight, dot, tinted disc — and
**first in words** ("Unread. Request accepted. …"). ⚠️ **A row is a button only
when pressing it does something** (unread, or a link the app opens); a read row
with no usable link is plain text.

- **Pressing** marks it read **at once** (optimistic) and opens the request
  without waiting. Two taps send one mark. A failed mark puts the row back to
  unread with a toast — even over the request it opened.
- **Mark all as read** is not optimistic: busy while out, five presses one call,
  success → every row read and a toast; failure → nothing changes.
- ⚠️ **Kept beside the list, never written into it**: pending marks, confirmed
  marks and, after a mark-all, "everything at least as old as the newest one on
  screen when it was pressed" — so a page already in flight cannot draw old ones
  unread again (pinned with the all-unread second customer's page 2).
- **States.** Placeholders, busy; a failed first read with Try again and no
  pull; the empty state with no Mark all; a failed pull → "Could not refresh"
  **above** the rows, where the pull was; the next page on scroll end, and a
  failed next page → Try again **below**, where the scroll was, with scrolling
  on not retrying it.

**Tests.** 116 new: the mock 32 (isolation between accounts and roles,
`notFound` for another's id, paging, two marks in flight), links 12,
presentation 15, the bell 14, the screen through both real navigators 43.

**Device.** Ravi: the Dashboard bell 44×44dp with the badge "5" in white
digits; the inbox's rows and unread drawing; "New request near you" →
REQ-31042 (`request_viewed` logged), the row read, the badge 4. Asha: Home's
bell beside the avatar, both fitting; a row → REQ-24063; Mark all as read
clears the badge. Forced failure: the bell with no badge, the inbox's error
with Try again, three fast taps sending one page load.

**Found during verification and fixed.** Vendor request details' back control
said "Back to requests", but the screen is also reached from the inbox (the
Dashboard's bell), where Back does not go to the list. It now says "Back", as
the customer's details do.

**Backend reconciliation.** Endpoints; paging; server-side order; the unread
count; mark-one on a read item as success; mark-all as "everything at the time
of the call"; the `fixora://requests/<reference>` format (the reference must be
the id the request endpoints take); the `iconName` vocabulary; `type` tokens;
whether `remove` exists. Delete `mockNotificationData` and the mock wiring when
`ApiNotificationService` lands; nothing above the service changes.

### Customer fixes and the saved-address picker (Phase 3D-10)

The customer-side open items from section 10, one slice: three defects on
Home and Categories, choosing a saved address while raising a request, the
Jest worker-exit warning, and — found by the analytics slice — a data loss
between two services' drafts. No contract changed; the payload is as it was.

**Home's tiles open their own category.** `CategoryGrid.onSelect` was typed
`() => void`, so no category id ever left the grid and every tile opened the
whole catalogue. It now passes `categoryId`, and Home navigates to
`SubCategories { categoryId }` — exactly what Categories sends. "See all", the
primary action and the empty state still open Categories. The tile's default
hint and Sub Categories' back hint ("Returns to the previous screen") were
corrected with it.

**Home's regions said "busy" alone.** The loading placeholder and the loaded
list were different views at the same place, so the native view was updated in
place and kept the loading view's `busy` after its label went — the 3D-2
sub-categories lesson. `RecentRequestList` now draws **one region around all
four states**, with its label and `busy` on every render; `CategoryGrid` had the
same shape and got the same fix (a deliberate widening to its twin). The
`progressbar` role was dropped rather than carried into the loaded list.
Since 3G-2 (21/10/2026) the cause is fixed instead: each draws two keyed views,
loading and settled, so the loaded region carries no label and is no longer a
stop that repeats its heading (see "Finishing polish").

**A failed pull on Home and Categories.** Categories was silent (its error
showed only in `ListEmptyComponent`); Home was **destructive** — a failed pull
replaced a working grid and the customer's request cards with inline errors.
Both now follow 3E-3's decision B with the shared hook unchanged: `useCategories`
and `useCustomerHome` split `isStale` / `staleError` from a first-load `error`
(`hasData && error` is stale), and the screens draw `StaleNotice` — one per page
on Home, above the categories, whose Try again pulls again rather than clearing.
A first-load failure is still each section's own `ErrorState`. Since 3G-2
(21/10/2026) the split is the shared `useStaleState`, which also holds the
reason through a refresh, so Try again shows its spinner.

**`StaleNotice` moved to `shared/components`**, and its spoken label no longer
says ".." — `spokenSentences(parts)` adds a full stop only to a part that does
not already end in one. The visible text is unchanged; the vendor file is gone.

**Choosing a saved address** (§18's "address selection", left out of 3D-9).
A stack screen, `ChooseSavedAddress` (no params) — the app uses no bottom sheet
anywhere. `useSavedAddresses` reads the list; `SavedAddressOption` sits on
`SelectableCard`, with "Default" as a word-only badge (the card's tick already
means chosen). Service Address offers **Use a saved address** (`home` glyph)
**below** Use my current location — last in the group, so its late arrival
shifts nothing above it — only when a read has found at least one; it re-reads
on returning focus, and a re-read that fails keeps the last good list rather
than withdrawing a button under a finger. The picker takes the **first tap
only** (a second would `goBack()` twice and pop Service Address too).
`requestAddressFromSaved` copies the address by value — details only when
non-empty, coordinates only as a pair, never `id` or `isDefault`; a hand-saved
address produces a payload **equal** to one typed by hand.

- ⚠️ **Why Service Address needed an adoption effect.** It stays mounted under
  the picker and seeds its box once. Writing the draft alone would leave the box
  showing the old text — and the next keystroke would overwrite the choice with
  it. Passing the address back in params was refused (params carry no
  addresses), and an id would need the list re-resolved. So a ref records the
  exact object the screen last wrote, and an effect adopts any address it did
  not write: the box, the resolved metadata, and "settled", so a saved address
  with no coordinates still shows its card and passes Continue.
- ⚠️ **A location that answers late no longer overwrites a later choice.** Every
  explicit address action — typing, a suggestion, taking what was typed,
  clearing, opening saved addresses, adopting one — bumps a turn; a location
  answer is kept only if nothing has bumped since it was asked. Asking notes the
  turn and does not bump it, so a second tap cannot orphan the first answer.

**Another service's draft was rewritten by this form** (found while wiring
§54). `CreateRequestScreen.save` merged into any live draft, and it runs on
mount — so merely **opening** service B with A's draft on hand replaced A's
priority, date, time, notes and photos with B's empty defaults; Continue on B
then carried A's address and A's professional into B's request. ⚠️ Now a form
merges only into a draft for **its own** sub-category, writes nothing while
another service's draft exists, and on Continue replaces it carrying address and
professional **only from its own draft** — B starts with no address and no
choice. Not carrying A's *professional* is a correctness fix (Preferred Vendor
never checks eligibility); not carrying A's *address* is a choice the owner may
reverse in one line. The cost: what is typed on B and left without Continue is
not kept while A's draft exists (open item). Since 3D-11 (21/10/2026), owner
decisions: A's address **is** carried into B, whole — A's professional never
is — and the non-blocking notice below stays rather than a blocking "Replace
your unfinished request?" prompt.

**"Going back from vendor selection resets the vendor choice"** no longer
reproduces: Continue on the details form already carries the draft's address
and professional forward. Two tests now pin the in-flow path, which the earlier
test (a resumed draft only) did not cover.

**The Jest worker-exit warning.** Reproduced with the customer and auth suites,
then each suite run alone with a kill switch: Categories, Sub Categories and
Customer Home **never exited** — screens left loading kept `Skeleton`'s
`withRepeat(-1)` scheduling frames forever — and the auth suites and Create
Request left toast and countdown timers firing after teardown. Production code
already cleans up on unmount; the eight suites now unmount every renderer in
`afterEach` (section 4). No `--forceExit`, no global fake timers. The full run
now ends cleanly.

**Tests.** `StaleNotice` 8; Home's tile navigation (the params' exact key set),
its regions' busy state on the same host instance, and +6 for the stale
notice; Categories +5;
`savedAddressChoice` 14; `ChooseSavedAddressScreen` 17, with an integration
block mounting Service Address and the picker on one draft; Service Address
+6, then the late-location, re-read and order tests; Create Request's "when
the draft on hand is another service's" block. Each follow-up fix was
mutation-checked — every one fails with its line reverted.

**Final review rounds (21/10/2026).**
- ⚠️ **A late location answer is dropped once the customer has moved on.**
  Continue, and leaving the screen any other way (a `blur` listener), end the
  location lookup's turn — Service Address stays mounted under the later
  screens, and a slow answer used to replace the draft's address there (Submit
  then sent the device's address). A refused Continue does not end it.
- ⚠️ **Submit sends one request however fast it is pressed**: an `inFlight` ref
  on Request Confirmation, as Rate Your Experience has, released only when
  nothing was created (so Submit stays the retry after a failure).
- **Another service's draft.** An emptied draft for another service no longer
  blocks this one. When a worth-keeping draft for another service exists, the
  form shows an info notice under its heading: "You have an unfinished request
  for {name}. This request is kept only when you press Continue, and it will
  then replace that one." A draft in the same category is named by its service
  (hidden until the services list answers, "another Electrician service" if it
  cannot be named) — never by the bare category. The name is display only; it
  never reaches params or the draft (pinned by serialising the draft).
- Each fix was mutation-checked.

**Device.** Asha: an Electrician tile → Electrician's sub-categories, Back →
Home; a saved address added, "Use a saved address" below "Use my current
location", a double tap landing once on Service Address with the address
filled; a full request sent, REQ-24083 to Sharma Electricals. Forced failure:
the categories section's own error on a first load. At normal phone size
(1080×2400 Dark, 21/10/2026): a draft for Switch Repair, then Drain Cleaning
showed the notice ("…for Electrician"), leaving it kept Switch Repair's Low
urgency and note intact; Home, the date and time rails, the saved-address
picker and the Payment group all drew in full.

### Vendor auth code and returning vendors (Phase 3C-2)

PROJECT_BIBLE.md §7A.2 as amended on 21/10/2026 (owner), §7A.4, §28. The vendor
auth code was an opaque `FX-XXXX-XXXX` string with a completeness-only rule; it
is now **exactly six digits**, and a vendor who has signed in on this device
before is asked for the code alone. No new method, field or error kind.

**One source for the format.** `AppConfig.vendorAuthCode.length` (6): the
schema, the field's ceiling, the copy that names the length ("The 6-digit
code…") and the mock's generator all read it. Always a string — a leading zero
is part of the code.

**What a person may type or paste.** `normaliseVendorAuthCode` (authSchemas)
removes separators and nothing else: whitespace (the no-break space the display
uses included) and hyphens and dashes, so "482 913", "482-913" and a notes
app's en dash all become `482913`. A letter, a full stop, a seventh digit or
another script's digits are left for the schema to refuse, in order — empty,
not digits, wrong count — and the field shows the first. Callers send the
normalised value, as phone fields send `normalisePhone`; the schema does not
transform.

- **The field** is a number pad whose `maxLength` is twice the length — 12
  characters, not digits — so a code pasted digit by digit fits, and a wrong
  paste is refused with a reason instead of being cut by `maxLength` into
  something that looks complete.
- **Out of autofill** on both code fields (`autoComplete="off"`,
  `importantForAutofill="no"`): no "Save password?". On iOS the masked sign-in
  field is `oneTimeCode` (a secure field is otherwise offered for saving as a
  password); the confirmation field is deliberately `none` — the SMS code that
  arrived minutes earlier is exactly what the keyboard would offer there, and it
  is the wrong code.
- **Shown once at registration** as "482 913" (`groupVendorAuthCode`: groups of
  three joined by a no-break space, so it never wraps) and spoken digit by
  digit, so TalkBack does not read a number in the hundreds of thousands. Copy
  still copies the bare six digits. The confirmation step keeps its plain field
  rather than the OTP cells: cells strip non-digits and stop at the last one, so
  a pasted seven-digit code would arrive as a complete-looking wrong code.

**Refusals in the app's words.** An `unauthorized` sign in is answered with
"That code didn't work…" (code only) or "That number and code didn't work…"
(full form), each ending "…or if your code was changed, use the new one." —
never repeating the code, never saying which half was wrong. A real backend's
bare 401 would otherwise show the default "Your session has expired…" about a
session nobody has yet. Every other kind still shows its own `userMessage`.
⚠️ The sentence is fixed in state when the attempt is made, not derived from
the face on screen while rendering: derived, "Use a different number" after a
refusal rebuilt the message and the toast (which tells failures apart by
identity) announced the old failure again. A test fails with the derived
version.

**The remembered phone — where.** `features/auth/state/rememberedVendorStorage.ts`,
`{ version: 1, phone }` under `AppConfig.storage.rememberedVendorKey`
(`@fixora/remembered-vendor`). It reaches the device through a new
`core/storage/KeyValueStorage.ts` (`getItem` / `setItem` / `removeItem`), so the
feature never imports AsyncStorage; `KeyValueStorage` refuses any key outside
`@fixora/` and rejects rather than swallowing — the caller decides what a
failure means. ⚠️ **The module can store a phone and nothing else:** `remember`
normalises to digits and refuses anything `phoneSchema` refuses — a six-digit
code is shorter than any phone, so a code passed by mistake is turned away, not
written. Reads validate the same way, and anything unusable is discarded and
removed. It never throws, and its logs carry an error name at most — never a
value (a parse error would quote the phone, so its error is not logged).

**The remembered phone — when.** After the session is stored, never before and
never on failure: `signInVendor` remembers the phone it was given,
`confirmVendorAuthCode` remembers `session.user.phone` (no phone was typed
there). A broken store cannot fail a sign in. Customers never touch it, and
**sign-out does not forget it** — that is the point. A refusal does not forget
it either: wrong, revoked and unknown-number are all `unauthorized`, so the app
cannot learn that an account is gone and does not try. Only "Use a different
number" forgets it, or the next vendor's sign in replaces it.

**One form, two faces.** `useRememberedVendorPhone()` reads once on mount.
While it reads, the form slot is empty — drawing the phone field and then
swapping it away would move the form under a thumb, and the read finishes
inside the push animation; a failed read is the full form. Remembered: "Welcome
back", a card with `••••••0001` (`maskPhone`, spoken "Phone number ending 0 0 0
1"), the code field alone, Sign in and "Use a different number"; registration
is offered only on the full form. The remembered number fills the hidden phone
field, so one schema checks one set of values and the request is the same
either way. "Use a different number" empties the phone and keeps a typed code.

**Mock.** Ravi `9000000001` → `482913`, Meena `9000000002` → `573014`. Issued
codes come from an injectable random source (tests pin them), and
regeneration steps past a repeat — a "replacement" equal to the revoked code
would revoke nothing. Codes are per account, so two vendors may share one. No
log line carries a code.

**Tests.** +116: the rules 40, the remembered store 22 (every device write
serialised and searched for the code), `KeyValueStorage` 7, `MockAuthService`
+5, the thunks +7, the login screen +26 (including the whole loop — sign in, sign out, code only —
against the real mock over an in-memory device), registration's display +9.
Each rule was broken and its test seen failing (22 breaks), then restored byte
for byte.

**Device** (release APK, 1080×2400 Dark, 21/10/2026). Signed in with
`9000000001` / `482913`; signed out → "Welcome back", `••••••0001` and the code
field alone; a wrong code refused; `482913` and `111111` never appear in
logcat.

### Vendor availability and working hours (Phase 3E-12)

PROJECT_BIBLE.md §38 ("Working Hours", "Availability"), §18A.1, §46–49. An
**Availability** card on Profile — the "Accepting new requests" switch and the
week in short — a pushed **Working hours** screen, and a notice on the
dashboard while new requests are off. No new dependency, token or native
change, and no §54 event (§54 lists none).

**Owner decisions, 21/10/2026** (taken by the lead under the owner's authority).

- **Availability is a switch plus a week.** Off means the **backend stops
  offering this vendor new requests** — not shown as a recommended
  professional, not sent open requests, not chosen directly. Work already
  accepted is unaffected and can still be started and completed, and the
  dashboard says so. ⚠️ **The app records and shows it; it filters nothing.**
  §18A.1 puts availability and eligibility with the backend, and an app that
  hid or refused requests itself would be a second matcher disagreeing with the
  first. Working hours are information the backend may use and a customer may
  later see; the app never enforces them.
- **Default week**, for an existing or a new vendor: Monday to Saturday
  09:00–19:00, Sunday closed — the app's stand-in for whatever a real backend
  starts a vendor on, chosen so a new vendor's Profile shows a sensible week
  rather than seven closed days.

**Contract** (`VendorProfileService`). `VendorProfile` gains
`acceptingRequests` (a new vendor starts accepting) and `workingHours:
VendorWorkingDay[]` — always seven, Monday first, `{ day, isOpen, opensAt?,
closesAt? }`. `day` is a **plain string** (known values `VENDOR_WORKING_DAYS`,
the `TEAM_MEMBER_STATUS` precedent); times are `HH:mm`, present exactly when
open, closing after opening on the same day — **no overnight shift in Phase
1**. Two session-scoped calls, each answering with the whole profile:
`setAcceptingRequests(accepting)` and `updateWorkingHours(days)`. ⚠️ Neither
field is part of `VendorProfileUpdate`, so the profile form's save — which
reads an absent field as cleared — can never wipe them (the shop-images rule).
`notFound` before setup (a record holding only availability would read back as
a finished setup); `validation` for anything but a boolean or a well-formed
week.

**Storage.** Older records lack both fields and read as the defaults — the
schema is **still version 1** (bumping it would make every saved profile
unreadable and send each vendor back through setup). Either field present and
corrupt reads the whole record as none. The mock checks a week with the **same
function** the store decodes with (`decodeWorkingHours`), so what it accepts
and what it reads back cannot drift.

**Decisions a later change must keep.**

- ⚠️ **Both writes go through the vendor's one profile line** (`inLine` on
  `VendorProfileContext`) and adopt their answer inside their turn —
  `useAcceptingRequests` and `useSaveWorkingHours`, as `useSaveVendorProfile`
  and `useShopImages` do. Pinned by a test whose shop-image save answers late:
  out of line, that late answer (accepting: true) put "accepting" back on
  Profile after the switch had turned it off.
- **The switch applies at once; the week is saved on Save.** A switch is one
  decision; a week is several that belong together, and half of one stored
  would be a week the vendor never chose.
- **Optimistic, then the truth.** While a change is out, the switch draws the
  value asked for, busy and locked; then the stored value takes over — the new
  one, or on failure the old one. A ref refuses a second request before state
  lands.
- **Turning off asks** — "Stop new requests?", Cancel / Stop; turning on never
  does. The labels are short on purpose: "Keep accepting" and "Stop new
  requests" would not fit a 360dp row. (Since 3G-2 the dialog stacks by itself
  when labels would not fit; the short labels stay.)
- **`SwitchRow`: the whole row is the control and one stop** — role `switch`,
  checked, disabled and busy on every render, the platform `Switch` drawn for
  the eye only. A tap on the words flips it too, and a screen reader never
  meets an unlabelled switch beside its label. Vendor-local while both
  consumers are vendor (the `StaleNotice` precedent).
- **Times are chosen from a list, not a picker** (no dependency).
  `TimeChoiceDialog`, built like `ConfirmDialog`, holds 48 half-hour
  `SelectionChip`s two to a row — an hour a row — and opens on the current
  time. A stored time off the half hour (a backend may store 09:15) is inserted
  in its place, never silently replaced.
- **The form is plain state, not react-hook-form + zod**: nothing is typed, and
  the one rule spans two fields of a day (`validation/workingHoursForm.ts`). A
  closed day keeps its times in the draft so reopening restores them; the week
  sent leaves them off, and "unsaved" is measured on the week that would be
  sent. The screen edits the seven known days, taken by code: a day missing
  opens closed, never invented as open.
- **Validation is live** — a day closing at or before it opens says so on that
  day at once (thick danger border, the sentence, a live region; never colour
  alone), and Save then sends nothing and says "Check the highlighted days."
- **Leaving** follows the team form (3E-11): `beforeRemove` asks when the week
  that would be sent differs; a leave during the save is held and taken once,
  and a failed save asks the question itself rather than re-dispatching through
  the guard. "Copy Monday to all weekdays" copies to Tuesday–Friday only and is
  disabled while Monday is wrong.
- **Dashboard "Turn on" turns new requests on directly**, through the same hook
  as Profile's switch, rather than navigating to Profile — so the button's word
  is true. The notice reads the **stored** value, so it goes only once the
  service has said yes. It is a sibling of `StaleNotice`, not a use of it: that
  one is an alert about a failure; this is a state the vendor chose (§49.1).
- `formatTimeValue` moved unchanged to `shared/presentation/clockTime.ts`; the
  customer module re-exports it.

**Tests.** 114 new: the mock 66 (defaults, every refusal, old version 1 records
read as defaults, ten corrupt shapes, the form's save keeping both, four
changes in flight), presentation and form 23, the screens 25 (including the
line test and the 3E-11 held-leave tests). 23 mutations, each caught.

**Device** (debug, 1080×2400 Dark, 21/10/2026). The Availability card → "Stop
new requests?" (Cancel / Stop) → Stop → the dashboard's "You're not accepting
new requests." with Turn on → Turn on → the notice gone.

### Customer cancel and the carried address (Phase 3D-11)

Two owner decisions in one slice. Nothing here is backed by a real API.

**Owner decisions, 21/10/2026** (taken by the lead under the owner's authority).

- **A customer may cancel only before a professional accepts** — `CREATED` and
  `PENDING_VENDOR` (submitted, searching, awaiting the chosen professional).
  Before acceptance nobody has committed any time; after it, cancelling means
  talking to the professional, and Phase 1 has no channel for that. `ON_HOLD`,
  `REJECTED` and any status §21 does not name fail closed: whether anybody is
  involved is not known. No reason is collected; no §54 event (§54 names none).
- **Continue on a second service carries the unfinished request's address,
  never its professional**, and the non-blocking "unfinished request" notice
  (3D-10) stays rather than a blocking prompt.

**Contract.** `RequestService.cancelRequest(requestId)` →
`CancelRequestResult`: `{ outcome: 'cancelled', request }` — the record as the
service now holds it, which is what the screen shows (the app never marks a
request cancelled itself, §34) — or `{ outcome: 'refused', reason:
'notCancellable' }`. Faults reject: `unauthorized` without a customer session,
`notFound` for a reference that is not this customer's (the answer
`getRequest`'s `null` gives). One decision taken for the backend: **a request
already `CANCELLED` answers `cancelled`, unchanged** — that is a cancellation
whose answer was lost being sent again, and refusing it would tell the customer
a professional had accepted a request that is in fact cancelled.

**The mock.** Its own copy of the rule, kept apart from the app's (the reviews
precedent), checked and changed with nothing awaited between, so two
cancellations at once change it once. Only the status changes — the record has
no place for when, and one was not invented. A cancelled request the customer
raised is saved through `MockRequestHistoryStorage` and survives a restart.

- ⚠️ **A seeded request's cancellation is not saved.** The seed is rebuilt on
  every launch and `load` prefers it over anything saved under its references,
  so a saved copy would never be read. Cancelling REQ-24081 lasts until a
  relaunch.
- ⚠️ **The vendor mocks never hear of it.** They share no requests with this
  table; telling the professionals is the backend's.

**The app's gate.** `isCancellableState(state)` in `requestStatus.ts`, beside
`hasAssignedProfessional`, on the derived state — so case, padding and dispatch
mode are handled once, by `requestStateOf`. Pinned never to overlap an assigned
state.

**Request Details.** A full-width danger **Cancel request**, last on the page,
only when the gate allows — it never meets the review group. Its
`ConfirmDialog`: "Cancel this request?" / "Professionals will no longer see
it. This can't be undone." / "Keep request" above "Cancel request". "Keep
request", not "Cancel", for the way out: a dialog about cancelling whose safe
answer is also called Cancel leaves the customer guessing. `useCancelRequest`:

- **Once** — a ref taken before any state lands, released in a `finally`; the
  dialog is busy and cannot be dismissed while the call is out.
- **Cancelled** → the screen adopts the returned record, with no second read:
  "Request cancelled", no path, no Cancel; toast "Request cancelled."
- **Refused** → an info toast ("A professional has already accepted this
  request, so it can't be cancelled here.") and the request is read again from
  the loading state (`reconcile`); a failed re-read shows the error, never the
  waiting request again. A `notFound` does the same.
- **Failed** → "Your request was not cancelled. {userMessage}"; nothing
  changes, and Cancel is the retry.
- **Disabled while a pull is in the air** — that answer could already say a
  professional has it. That is also what makes adoption safe: no read that
  started before the change can land after it.
- ⚠️ `useRequestDetails` gained `adopt` and `reconcile`. Adoption is laid over
  the read it was taken on and yields to any later read — deliberately not the
  vendor's identity-based "set aside": a caching client can return the very
  same object for an unchanged read, and setting that aside would draw a
  request that exists as one that does not.

**Home and My Requests learn of it by a signal**, not a re-read on focus:
`features/customer/state/customerRequestSync.ts` (the `notificationSync`
idea), sent on a cancellation, a refusal and a `notFound`, never on a plain
failure. With something on screen they refresh under it; with nothing yet they
read again from the start under placeholders — a refresh there would draw "You
don't have any service requests yet" over the read about to find one.

**The carried address.** One line in `CreateRequestScreen.onContinue`
(`own ? own.address : liveDraft.current?.address ?? null`): B's new draft takes
A's address **whole** — coordinates, details, place handle — and Service
Address opens on it, filled in and editable. ⚠️ **Never A's professional** —
chosen from another service's list, perhaps not offered for B, and Preferred
Vendor does not check — and none of A's other answers. Autosave still writes
nothing while A exists, and the notice's sentence is still true. The payload is
unchanged (pinned by building B's: `address`, `categoryId`, `priority`,
`subCategoryId`, no `vendorId`).

**`ConfirmDialog` gained `stacked`** here, opt-in. Worked out before the device
pass: side by side, each label has about 86dp at 360dp, and "Cancel request"
(~108dp) and "Keep request" (~96dp) would both be cut off. ⚠️ The row never
wraps, whatever `flexWrap` suggests: each button's basis is its 40% minimum,
never its words. Since 3G-2 the dialog decides for itself.

**Tests.** 45 new: the mock 14, the gate 4, Request Details 15, My Requests 4,
Home 3, Create Request 3, `ConfirmDialog` 2. Every customer `RequestService`
stub gained a throwing `cancelRequest`, so seven suites now prove their screens
never cancel. 31 mutations, each caught.

**Device** (debug, 1080×2400 Dark, 21/10/2026). Asha's Leak Repair, REQ-24081
→ Cancel request → "Keep request" above "Cancel request", a white label on red
→ a double tap sent one cancellation → "Request cancelled". The carried address
was not exercised on the device; its tests cover it.

### Rejected requests and team photos (Phase 3E-13)

Two vendor additions: §31's Rejected tab and §39's team member Profile Image.
Nothing else changes a request or a member, and the dashboard's numbers are
untouched.

**Owner decisions, 21/10/2026** (taken by the lead under the owner's
authority). Vendors keep a list of what they declined — §31 names the tab. A
team member can have a photo — §39 lists it.

**Rejected — contract** (`VendorRequestService`). `VendorRequestList` gains
`rejected: VendorJobSummary[]` — **this vendor's** declines, most recently
declined first, each `REJECTED`. History, not work: nothing can be done to it,
and **the dashboard counts none of it**. Another vendor's decline never puts a
request here; one this vendor declined **stays** after somebody else accepts it
— it records what they did, not what became of the request. `getRequest`
answers for it as the list has it, never `notFound`. `VendorJobSummary` gains
`rejectedAt?` (ISO-8601), exposed because the card's date line already
switches by state and the list is ordered by it — a card dated "Raised …"
would make the order look random. Optional: a backend that does not say leaves
the card on "Raised …".

**Rejected — the mock.** `MockVendorRequestBook` keeps each rejection with when
(`rejectedAt`, from the service clock) and in what order (the book's existing
`sequence`) — the sequence, not the clock, so a clock that stands still or goes
back cannot reorder the history (pinned). `rejectedByVendor` lists them and is
kept apart from `applyVendorAnswers`, which is what the dashboard counts; the
details read finds a rejected request through the same function, so the list
and the details cannot describe it differently. Still in memory and cleared by
a restart (3E-4's reasons).

**Rejected — the list.** Chips All, Pending, Active, Completed, **Rejected**,
last. ⚠️ **All does not include Rejected.** All is the work the vendor has or
had; a declined request is not work, and under All it would grow without end
beneath the jobs to do. Enforced by type: `VENDOR_REQUEST_GROUPS` is
`WorkGroup[]`. Empty: "No rejected requests" / "You haven't declined any
requests." A confirmed rejection settles to the top of Rejected at once (the
overlay unshifts into `rejected` and never lists a request twice); under All
the card still simply leaves.

- ⚠️ **A card in Rejected offers nothing** and only opens its request. The
  guard reads the **group first**, so even a backend slip that lists a waiting
  record among the declined offers no answer (pinned with exactly that record).
- Details gain one row, "Rejected" with the date, when the record carries
  `rejectedAt`.

**Team photo — contract.** `TeamMember.photoUrl?`: an uploaded picture's
http(s) URL; absent, never `""`, means initials. ⚠️ **Absent on an edit removes
it**, exactly as an absent phone does (3E-7: `updateMember` replaces every
detail), so the app always sends the photo it is showing —
`buildTeamMemberInput(values, photoUrl?)`, the business picture's shape. The
mock refuses anything but an http(s) URL with `validation` — a `file://` or
`content://` path, a bare host, a non-string — rather than dropping it, because
dropping it would leave the form saying a chosen photo was saved. Storage is
**still version 2**: every saved record satisfies the optional field by not
having one.

**Team photo — the form.** A photo card at the top of the add and edit form,
drawn as the business picture's in `VendorProfileFormScreen`: avatar, "Photo",
"Optional. A clear photo of their face.", Take a photo / Choose a photo, Remove
photo, an "Uploading the photo…" live line, and on failure "The photo was not
uploaded" with Try again (re-uploads without reopening the picker) and Discard.
Through `useImageUpload`; the URL is a form value until Save, so leaving
without saving leaves the member's photo as it was. A failed upload keeps
everything typed.

- ⚠️ **Save waits for an upload, and the photo waits for Save.** Save checks
  `photo.isBusy || photo.isRunning()`: `useImageUpload` gained `isRunning()`,
  its own in-flight ref (additive), to cover the frame between the tap that
  starts an upload and `isBusy` landing — Save pressed in that frame would have
  saved without the photo and then lost it. Each photo handler checks the
  form's ref-based `isBusy()` too.
- Unsaved changes include the photo: added, replaced, removed, or chosen and
  not yet uploaded.
- The picture is hidden from a screen reader on the form — the actions already
  say whether there is one ("Add their photo…" / "Replace their photo…") — and
  on the card, whose spoken sentence is unchanged.
- **Why there are two photo cards.** `VendorProfileFormScreen` is locked and
  device-verified, and its card is written inline; lifting it out would change
  that screen in a slice that did not need to. `TeamMemberPhotoField` lives
  inside the team form with a docblock naming its twin (open item).

**Tests.** Rejected, 30 new: the book and service 13, filters 3, overlay 3, the
list and details through the navigator 11. Team photo, 29 new: service 9,
storage 4, schema 2, screen 14. Each rule was proved by breaking it.

**Device** (debug, 1080×2400 Dark, 21/10/2026). REQ-31038 rejected with the new
wording → the Rejected tab lists it, "Rejected just now"; the team edit form
draws its photo card.

### Release readiness and the offline banner (Phase 3G-1)

Two parts: a release build that can be signed, shrunk and versioned, and a
strip that says the device is offline. How to build and sign a release is
`docs/RELEASE.md`; this records why it is the way it is.

**Found.** `app_name` was already "Fixora" and the launcher icon already the
brand mark (`brand/generate.py`); no icon work was needed. Release builds were
signed with the debug key and unshrunk, `versionName` was "1.0", and in dark
mode AppCompat's #303030 grey showed between the system splash and the
near-black JS splash.

**The release build** (`android/app/build.gradle`).

- **Signing from four Gradle properties** — `FIXORA_UPLOAD_STORE_FILE`,
  `FIXORA_UPLOAD_STORE_PASSWORD`, `FIXORA_UPLOAD_KEY_ALIAS`,
  `FIXORA_UPLOAD_KEY_PASSWORD`, kept in the machine-wide
  `~/.gradle/gradle.properties`, never in the repo. All four present → a
  `release` signing config is created and used. Any missing → debug signing and
  a warning naming the missing properties (never values), printed only when a
  release package task is in the graph. Falling back rather than failing lets
  anyone build and smoke-test a minified release without the key; the `release`
  config exists only when the key is configured, so an incomplete one can never
  be selected. A store path that is set but wrong still fails the build.
- **R8 on** — `minifyEnabled` and `shrinkResources` — with the template's
  `proguard-android.txt` (`-dontoptimize`: fewer transformations, less run-time
  risk) and no keep rules of our own. React Native and every native library
  ship theirs; the mapping shows the JNI-reached classes keep their names.
- ⚠️ **Never add a `res/raw/keep.xml`.** React Native's bundle step writes one
  into `build/generated/res/react/release/` listing every image the JS bundles
  — that is what keeps them under the resource shrinker, since they are looked
  up by name at run time. An app-level file of the same name is silently
  replaced in the merge (a probe drawable listed in ours was still stripped).
- **`versionName "1.0.0"`, `versionCode 1`**; the rules are `docs/RELEASE.md`
  section 2.
- **The window background per mode.** `res/values/colors.xml` and
  `res/values-night/colors.xml` define `window_background` (#F9FAFB and
  #030712), which `AppTheme`'s `android:windowBackground` uses. Android 12+'s
  system splash takes the window background when it is a single colour, so
  splash, window and JS splash are one colour in each mode. ⚠️ They are
  **copies** of the JS `background` token — native resources cannot read the
  JS theme; change all three together.

**The offline banner.**

- **Dependency:** `@react-native-community/netinfo` **12.0.1**, exact
  (published 14/02/2026; a New Architecture TurboModule). It merges two normal
  permissions, `ACCESS_NETWORK_STATE` and `ACCESS_WIFI_STATE` (no prompt). With
  the default config on Android it takes reachability from the platform's
  validated capability and sends no request of its own.
- **The seam.** `NetworkStatusService` → `DeviceNetworkStatusService`, the
  **only** NetInfo import: offline only when `isConnected` or
  `isInternetReachable` is `false` — unknown counts as online. Registered beside
  `permission`, outside the mock/live switch, because the device's answer is
  real in every build; `MockNetworkStatusService` is for tests and is not
  registered. `useNetworkStatus` starts online, subscribes before it asks,
  ignores an answer to a superseded question, and on a failed read stays online
  and logs.
- **`OfflineBanner`** (shared): a strip on `warningSubtle` with the network
  failure's own glyph and tone (`ERROR_PRESENTATION.network`), "You're offline."
  and "Some things may not load until you reconnect." — one block, role alert,
  a polite live region, not pressable, nothing at all when online. It sits **in
  the layout, not over it**, inside `AppErrorBoundary` in `AppRoot`, so it
  pushes the app down rather than covering a header and its back control.
- ⚠️ **A second `SafeAreaProvider`, below the banner.** The native
  `SafeAreaView` pads by its nearest provider's overlap with the status bar,
  not its own; with one app-wide provider every screen under the banner padded
  a whole status bar again. The navigators' own provider starts below the
  strip, so its top inset is 0 while the banner shows and the full inset when
  it does not. Toast stays on the root provider (it overlays the app).
- ⚠️ **`WindowOffsetContext` feeds the keyboard.** `KeyboardAvoidingView` mixes
  a parent-relative frame with window coordinates; under the banner it would
  have left exactly the banner's height of a form under the keyboard.
  `AppRoot` measures the banner and provides its height; `Screen` passes it to
  `keyboardVerticalOffset` (0 everywhere else, and `Screen` is the only
  `KeyboardAvoidingView`).
- The banner coming and going never remounts the navigators (pinned).
- **No retry on reconnect.** Each screen keeps its own Try again. A reload
  driven from the banner would fire on every mounted screen at the moment the
  connection returns — a burst exactly when the network is least settled — and
  would discard what someone is reading.

**Tests.** `DeviceNetworkStatusService`, `useNetworkStatus`, `OfflineBanner`
and a new `AppRoot` suite; `jest.setup.js` mocks NetInfo with the library's own
jest mock.

**Verification.** `assembleRelease` exit 0 (80.8 MB, four ABIs), printing the
debug-key warning; `signingReport` shows `debug` without the properties and
`release` with them; `aapt2` shows versionCode 1, versionName 1.0.0, the window
colour per mode and all 11 bundled images; the release and debug APKs carry
the same (debug) certificate, so `adb install -r` moves between them. **Device**
(release APK, 1080×2400 Dark, 21/10/2026): a cold start; icons and images
render under R8; in airplane mode the banner appears, amber, with the content
pushed down and no double gap, and it clears on reconnect.

### Finishing polish (Phase 3G-2)

The items that reviews and device passes had left open, and one rule that had
never been run. No contract changed.

**Owner decision, 21/10/2026** (taken by the lead under the owner's authority):
**danger buttons have a white label.** `Button`'s `danger` variant labels with
`onDanger` — white in both themes, 4.8:1 on red500 — instead of `textInverse`
(near-black in dark, 4.2:1); the icon and the busy spinner follow. Light mode
is unchanged. Every danger button and every `ConfirmDialog` confirm moved with
it. The pressed state still shows no change (open item).

**`ConfirmDialog` chooses row or stack by itself.** `stacked` is now an
override; left out, the dialog stacks when either label might not fit,
calculated rather than measured (`answersFitSideBySide`): the dialog is the
window less `spacing.xl` each side, capped at `breakpoints.sm`; each answer is
half of what is left inside its padding, less the gap; each label has that less
the capsule's padding (`BUTTON_LABEL_INSET`, exported by `Button` so the two
cannot drift) — **86dp at 360dp, 106dp from 400dp up**. A label is taken as
code points × 16sp × the system font scale × **0.6**, about 15% over the widest
real label measured (0.46–0.52 em a character). ⚠️ It errs towards stacking on
purpose: a stacked dialog that would have fitted costs nothing, a cut-off word
does. So every one-word pair stays in a row, and "Keep editing / Discard" now
stacks on every phone, 411dp included — consistent and never clipped, over
compact. Request Details still passes `stacked`; redundant and harmless.

**One TalkBack stop per region, fixed at the cause.** `CategoryGrid` and
`RecentRequestList` (Home) now draw two different **keyed** views — `loading`
(label, busy) and `settled` (no label, role or state). React replaces the
native view, so no stale `busy` can survive and the loaded region is no longer
a stop that repeats its heading. Sub Categories, the precedent: its
placeholders moved into a keyed loading region in `ListEmptyComponent`, and the
list carries no label. Keying the `FlatList` itself was rejected: it would
remount the heading inside the list and drop TalkBack focus from it when the
services land.

**One back button.** `AuthTopBar` draws the shared `BackButton` with the auth
copy's words; `AuthBackButton` is deleted, and its test moved to
`__tests__/shared/components/BackButton.test.tsx`. Nothing looks different.

**Smaller fixes.**

- Home offers "Continue your request" only for a draft worth keeping
  (`isDraftWorthKeeping`), not one the form has emptied. The check sits in the
  screen; its natural home is `useCustomerHome`'s `resume` (open item).
- The reject dialog says "You won't be able to take it after this. It will stay
  in your Rejected list."
- The vendor profile form refuses a Save pressed in the same frame an upload
  starts (`photo.isRunning()`, 3E-13's rule).
- **Customer copy no longer promises channels the app lacks.** Request
  Submitted, Confirmation and two support lines on the form promised hearing
  from us, a confirmed visit, getting in touch and a saved phone call; they now
  name what exists — the Notifications inbox, My Requests, cancelling until a
  professional accepts, a preferred time as a preference rather than a booking.
  "The professional will see your preferred date and time" was not used: the
  vendor's record does not carry it (3E-3), so it would be untrue. A test
  serialises all of `CUSTOMER_COPY` and refuses those promises.

**Core.**

- **`useNavigationEvent('focus' | 'blur', callback, { onlyOnReturn? })`**
  (shared) reads the navigation context — no `useFocusEffect`, which throws
  without a navigator — and listens to nothing without one. `onlyOnReturn`
  passes a focus on only after the screen was out of focus, so arrival stays one
  read. Used by the notification badge, `useSavedAddresses` and Service
  Address's blur.
- **`useStaleState({ hasData, error, isRefreshing })`** (shared), with the pure
  `splitStale` beside it: one rule for "a failed refresh over data is stale, a
  failed first read is an error", replacing seven copies (`useVendorRequests`,
  `useVendorReviews`, `useVendorTeam`, `useVendorReport`, `useShopImages`,
  `useCategories`, `useCustomerHome`). ⚠️ It **holds the last stale reason while
  a refresh is in the air**, which is what lets `StaleNotice`'s Try again show
  its spinner — `useServiceQuery` clears `error` as a refresh starts, so the
  notice used to unmount the moment Try again was pressed. The same reason keeps
  the same node, so nothing is announced twice. `useServiceQuery` is unchanged.
- `ToastProvider` ignores `showToast` once it has unmounted (re-armed in its
  effect for StrictMode); the unmount still clears the dwell timer.
- **Every storage goes through `KeyValueStorage`.** `requestDraftStorage` and the
  five `Mock*Storage` files no longer import AsyncStorage. Every key was already
  under `@fixora/`, so none was renamed; the `AsyncStorage…` class names were
  kept, because tests and `ServiceRegistry` import them and AsyncStorage is still
  what lies underneath.

**The import boundaries are now a test.**
`__tests__/architecture/importBoundaries.test.ts` reads every file under `src`
and fails if axios is imported at run time outside `src/core/http` (a type-only
import is erased and allowed), AsyncStorage outside `src/core/storage`, NetInfo
outside `src/shared/services/device`, or if a feature's screen or component
imports the registry, axios, AsyncStorage, NetInfo, `react-native-permissions`
or `react-native-vector-icons`, or names `PermissionsAndroid`. Plain file reads,
no mocks, so no renderer can fool it. ⚠️ Its first run found
`EditAddressScreen` calling `getService` itself — a CLAUDE.md §4 break since
3D-9 that every suite had passed with. The calls moved into
`features/customer/hooks/useSavedAddressEditor.ts`, behaviour unchanged.

**Tests.** `Button` 7 new; `ConfirmDialog` 8 → 20 (the window set inside `act`
and restored in `afterEach`); the Home and Sub Categories region tests;
`BackButton` retargeted; `customerCopyChannels` 8; the import-boundary test.
Every change was mutation-checked.

**Device** (debug, 1080×2400 Dark, 21/10/2026). A white label on red in the
stacked cancel dialog; a look in light mode at Request Details and Home. A red
"Should have a queue … calling Hooks conditionally" screen on the dashboard was
a Fast Refresh artefact — several agents had edited the screen while it was
open — and a cold start drew it cleanly with nothing in the log (see Lessons).

**Gates on the final code, before review (21/10/2026).** `tsc` 0 errors; ESLint
0 errors, 30 warnings (unchanged); Jest 123 suites / 2,771 tests; the debug and
release Gradle builds exit 0.

---

### Review fixes and the last list fix (Phase 3G-3, 21/10/2026)

Two review rounds on the night's work, every code change made by an agent (the
lead edits docs only while the owner is away — a lead code edit triggers a
blocking review question). All five gates green afterwards: tsc 0; eslint 0
errors / 30 warnings; jest 126 suites / 2,842 tests; release bundle builds;
`assembleDebug` exit 0.

- ⚠️ **Dialogs pad themselves by the safe area** (`useDialogBackdropPadding`,
  shared by ConfirmDialog and TimeChoiceDialog) — and add the offline banner's
  height, because the screens' safe-area provider reports a top inset of 0 under
  the banner. Found on the Pixel 7 (status bar 136px ≈ 52dp): the full-height
  time list put "Monday closing time" at 105px, under the clock; after the fix it
  starts at 241px.
- **The import-boundary test** now also scans `src/shared/components/` and
  `src/navigation/` (Icon.tsx is the one allowed wrapper), catches re-exports,
  side-effect imports, `import()`, `require` and the registry by relative path,
  and tests its own matcher on 14 caught and 7 erased forms. It found
  `ServiceCategoryField` reading the registry — moved into
  `src/shared/hooks/useServiceCategories.ts`. ⚠️ It carries **no Node types**
  (`jest.requireActual` with local types; `__dirname` declared for that file
  alone): a `/// <reference types="node" />` would put `process`/`Buffer` in
  scope for app code, which type-checks and then fails on Hermes.
- **The remembered vendor phone is the one typed at registration**, carried on
  a new `phone` param to `VendorOtp` (as `CustomerOtp` already does), not
  `session.user.phone`, whose format no contract fixes.
- **Release signing:** `bundleRelease` fails without the upload key;
  `assembleRelease` falls back to the debug key and says so at error level, which
  `-q` cannot hide (`docs/RELEASE.md` updated).
- A pasted code also loses zero-width and bidi marks (U+200B–200F, U+202A–202E,
  U+2060–2069, U+FEFF). The remembered phone is filled in `useLayoutEffect`; a
  storage read slower than 300 ms shows the shared Loader. `.gitignore` covers
  `*.p12` and `*.jks`. "Accepting new requests" keeps one pending value and one
  in-flight guard in `VendorProfileContext`, so Profile and Dashboard can never
  both send.
- **Stacked ConfirmDialog answers: confirm on top, Cancel at the bottom** —
  nearest the thumb (owner decision under full authority). Side-by-side order is
  unchanged.
- **Every list now uses the keyed loading region** (Categories, Choose saved
  address, My Requests, Preferred Vendor, Notifications, Shop images, Vendor
  requests, reviews and team): one "<loading copy>, busy" region while loading,
  and a loaded list with no label, role or state — no stop that repeats the
  heading, and no stale `busy`. Device: the vendor Requests list carries no
  content-desc once loaded. Eight list-label copy keys that nothing read any more
  were removed.
- Lesson (testing): never compare test-renderer nodes with `toEqual`/`toBe` — on
  a mismatch Jest prints the node and walks the whole tree, and the run hangs.
  Compare testIDs, and check identity with `a === b` as a boolean.

## 10. Open items

Carried forward, all raised with the owner and none yet decided:

**Missing contracts, deliberately.**

- **Address (§18)** has a frontend contract (`RequestAddress`) and mock search
  and location services, but no backend schema. The mapping belongs in
  `buildCreateRequestInput` once one exists.
- **Request Details (§20)** has a frontend contract (`CustomerRequestDetails`,
  `getRequest`) and no backend endpoint. The record names its category and the
  preferred professional itself, following the precedent of `serviceName` and
  `vendorName` on the summary.

**My Requests (Phase 3D-5), for the owner.**

- Whether My Requests should refresh itself when its tab is focused again.
  Today it reads on mount, on a filter change, on pull and on retry. The success
  screen's `reset` remounts the tabs, so a just-sent request does appear, but a
  status changed on the server while the tab stayed mounted waits for a pull.
- Page size is `AppConfig.pagination.defaultPageSize` (20); §23 names none.
- The filter mapping is the mock's stand-in for the backend's. The real one may
  differ, and nothing above the service would change if it does.

**Customer profile (Phases 3D-7, 3D-8 and 3D-9), for the owner.**

- **Backend reconciliation for 3D-9.** The address-book endpoints, field names
  and error shapes are this app's guess, as are: the default-promotion rule on
  delete, "first address is default", default-first ordering, no maximum count,
  and no duplicate detection. Whether a real backend issues address ids or
  accepts client ones is open — the mock issues them.
- The phone is shown exactly as stored; formatting it (dial code, grouping) is
  a display decision nobody has made.
- **Backend reconciliation for 3D-8.** The profile update call, its field names
  and its error shapes are this app's guess. So are: the 50-character name
  ceiling, whether a first name is genuinely required, whether an email may be
  removed, and whether changing one needs verification. The avatar has no size
  or aspect rules of its own — it reuses `AppConfig.image` (5 MB, jpeg/png/webp,
  1600px longest edge, quality 0.7), which was chosen for request photographs;
  a square crop is the obvious thing a real contract might want and there is no
  cropping operation on `ImageService` to do it with.

**Finishing polish (Phase 3G-2), for the owner.**

- ~~Nine more lists keep the always-labelled pattern~~ — resolved in 3G-3: every
  list now uses the keyed loading region.
- **The danger button's pressed state shows no change**: its pressed fill is
  `danger` itself. A pressed red would be a new shared colour token.
- The Home resume check (`isDraftWorthKeeping`) sits in `CustomerHomeScreen`
  only because `useCustomerHome` was being edited by another slice that night;
  its natural home is one line in the hook's `resume`.
- `ConfirmDialog`'s 0.6 em a character is for the Latin script the app ships
  in; a translation into a script with wider glyphs needs its own figure.
- `Toast`'s own exit animation runs once more after its provider unmounts —
  finite, so it ends by itself (unlike the old `Skeleton` leak).

**Release readiness and the offline banner (Phase 3G-1), for the owner.**

- **The upload key.** The owner creates it (`docs/RELEASE.md` section 1) and
  adds the four `FIXORA_UPLOAD_*` properties to `~/.gradle/gradle.properties`.
  Until then every release build is debug-signed and says so.
- **NetInfo 12.0.1 overrides `onCatalystInstanceDestroy()`**, which React Native
  marks deprecated for removal. It builds today, with one javac warning; recheck
  it on the next React Native upgrade.
- The header comment in `~/.gradle/gradle.properties` says a project's own file
  overrides it; section 7 (verified) says the opposite. Worth correcting there.
- Cosmetic: `android/app/proguard-rules.pro` still carries the template's text
  and no rules (none are needed); `package.json`'s `version` is still "0.0.1"
  (Android does not read it).

**Rejected requests and team photos (Phase 3E-13), for the owner and the
backend.**

- **Two photo cards.** `TeamMemberPhotoField` and the business picture card in
  `VendorProfileFormScreen` are the same UI written twice. With two real
  consumers, one shared component is justified, but it changes a locked screen —
  the owner's call.
- **Upload progress** is an indeterminate line on both photo fields;
  `ImageService.upload` supports `onProgress`, but `useImageUpload` does not pass
  it. A percentage is a shared-hook change.
- Backend, rejected: whether it lists a vendor's rejections at all, the field
  name and place, `rejectedAt`, the order, paging (the history only grows),
  whether a decline stays visible after a re-dispatch, and whether a reason is
  recorded (§33) — all this app's guess.
- Backend, photo: `photoUrl`, "absent on an edit removes it" (a PATCH-style
  backend would read absent as "keep", and the app would then send an explicit
  clear), the URL rule, and whether team uploads share the business picture's
  endpoint.

**Customer cancel and the carried address (Phase 3D-11), for the owner and the
backend.**

- **The refusal names acceptance**, the race the rule exists for. A backend that
  refuses for another reason (rejected, on hold) needs its own `reason` on the
  contract and its own sentence; not invented.
- **"Already cancelled answers cancelled"** is this app's assumption of the
  backend; so are the endpoint and the result's shape.
- **Cancel request uses the filled danger button** — the same question as 3E-11's
  "quieter Disable button" below.
- **Mock only:** a seeded request's cancellation lasts until a relaunch, and the
  vendor app keeps offering a request the customer cancelled.
- **A corner of My Requests:** an empty view whose pull failed, then a
  cancellation elsewhere — the signalled re-read is a refresh there, so the
  empty sentence can show until the answer lands.

**Vendor availability and working hours (Phase 3E-12), for the owner and the
backend.**

- Backend: field and endpoint names, "always seven, Monday first", the time
  format, whether availability is a profile field or its own resource, whether
  the default week exists at all, and `notFound` before setup — all this app's
  guess. Delete the mock's two methods, `decodeWorkingHours`, the two storage
  fields and `DEFAULT_WORKING_HOURS` when `ApiVendorProfileService` lands.
- **Not representable in Phase 1:** overnight shifts, open until midnight (the
  latest closing choice is 23:30), breaks within a day, holidays, more than one
  shift a day. Each is a contract change, not a UI one.
- Whether customers ever see the hours (§18A.3 lists availability on the vendor
  list item — the backend's to supply; nothing was added to the customer side).
- Whether the backend pauses availability by itself outside working hours — the
  app would simply show the stored value.
- `RootNavigator.test.tsx` could also pin that a customer tree never has
  `WorkingHours`, as it does for `VendorReviews`.

**Vendor auth code and returning vendors (Phase 3C-2), for the owner and the
backend.**

- Backend: six digits, as a string; `signInVendor` refusing wrong, revoked
  (regenerated or reissued by an administrator) and unknown numbers alike as
  401; and whether it will ever tell the app an account is gone — the app would
  then forget the remembered phone. Today it cannot know, by design.
- **`KeyValueStorage`** is shared infrastructure in `core/storage`, approved by
  the lead on 21/10/2026 under the owner's authority because the brief forbade
  the feature importing AsyncStorage and no primitive existed. Since 3G-2 every
  storage uses it.
- Not test-pinned, covered by reasoning in comments only: the remembered-phone
  read answering after unmount, and the form filling the hidden phone field
  before any tap can land.
- iOS behaviour of `oneTimeCode` on the masked sign-in field is untested
  (Android only on this machine).

**Customer fixes and the saved-address picker (Phase 3D-10), for the owner.**

- **Preferred Vendor accepts a professional who is not in the eligible list.**
  No longer reachable from the cross-service path, but a resumed or restored
  draft could still carry one if a vendor stopped being eligible.
- `RequestDetailsScreen`'s review "checking" view (progressbar, busy) is
  followed by a different view at the same place — the exposure Home's regions
  had. Worth the same check.
- Categories still offers pull-to-refresh over its first-load `ErrorState`; the
  vendor lists remove it there. Pre-existing.
- Saved addresses are read when Service Address mounts and again when the picker
  opens — two reads a visit. A real backend may want caching.
- The saved-address shortcut uses the `home` glyph so it does not look like the
  location shortcut beside it; `location` is a one-line swap.
- `CreateRequestInput`'s docblock in `RequestService.ts` still says a saved
  address book has "no service and no screen" — stale since 3D-9.

**Notifications inbox (Phase 3F-2), for the owner and the backend.**

- **Unread weight.** "Bold when unread" is the `bodyStrong` variant (medium
  500) plus the dot and the tinted disc, not a 700 override. Say if a heavier
  weight is wanted.
- **Pull-to-refresh on Home and the Dashboard does not re-read the badge**; it
  re-reads on every focus and after every mark.
- **Read state is memory-only in the mock** — a restart brings the fixtures back
  unread. Intended.
- A failed mark's toast can appear over the request it opened (the mark is not
  awaited before navigating). Intended: the toast is the truth about the mark.
- §72 lists "Vendor Assigned" among Phase 2 *push* notifications; the in-app
  "Request accepted" is the owner's own example, and the app never depends on
  which notifications the backend sends.
- Backend: endpoints, paging, mark-all semantics, the link format and the icon
  vocabulary are this app's guess (see the phase).

**Analytics and crash handling (Phase 3F-1), for the owner and the backend.**

- **`signup_completed` needs `isNewAccount`.** The customer verify response
  does not say whether it created the account (§7A.1), so every verification is
  `login_completed` and `signup_completed` is never sent. Recommended: the
  backend adds `isNewAccount: boolean` and the thunk sends `signup_completed`
  for a new account. Inferring it from an empty name was rejected — a customer
  who never gave one would count as new at every sign in.
- **`vendor_approved` and `request_completed` are backend-emitted.** Approval
  happens server-side when the onboarding code is verified, and the customer app
  never witnesses a completion; sending either from a client would double-count
  once the backend does. Both stay in the union because §54 lists them.
- **Unhandled promise rejections are not recorded.** React Native 0.86 tracks
  them only in debug builds, through one Hermes tracker that reports straight to
  its exception manager; there is no supported hook without replacing that
  tracker or patching `Promise`.
- **`app_opened` counts JS starts**, not returns from the background. Whether
  §54 means every launch or every cold start is the owner's call.
- A render failure **above** the boundary (the provider stack in `App.tsx`,
  `AppRoot` itself) is not recorded; it is fatal either way. In a debug build a
  caught render failure still shows RN's "Render Error" LogBox first — dismiss
  it to see the fallback.
- To confirm: `hasPreferredDate` beside `hasPreferredTime` (§14's date and time
  are separate answers); the fourth skip reason, `list_loading` (otherwise
  someone who never saw a vendor counts as declining one — §58's question); one
  vendor-choice event per screen visit.
- Provider, consent, retention and sampling wait for a provider to be approved.

**Rating breakdown and team member status (Phase 3E-11), for the owner and the
backend.**

- **A quieter Disable button.** The brief asked for a "danger-styled
  secondary"; the shared `Button` has primary, secondary and danger only, so
  Disable uses the filled danger variant, as Log out does. A tonal-danger
  variant would be a new shared variant and needs approval. The customer's
  Cancel request (3D-11) is the same case.
- Backend: breakdown field names, "always five, zeros included", star order,
  and whether percentages could ever be sent instead of counts; the status
  endpoint, vocabulary and casing, the same status as a no-op or an error,
  whether a disabled member can be removed, whether §39's disable replaces
  removal, and how a status added later should read.

**Vendor shop images (Phase 3E-10), for the owner and the backend.**

- **No reordering.** The contract carries order; there is no UI for it.
- **Two devices can lose an update**: a whole-list replace is last writer wins.
  A per-image add and remove, or a version / ETag, would close it.
- **Orphaned uploads** — taken off, abandoned on leaving, or a failed save never
  retried — are the backend's housekeeping. `ImageService.remove` is called only
  for a photo that never reached a save.
- Endpoint and shape, the field name, the ceiling of 6, the duplicate rule and
  `notFound` before setup are this app's guess.
- **A pull waits behind a save in the air** (one line per vendor): its spinner
  stays until the save answers — up to the request timeout on a dead
  connection. Accepted for correctness; revisit with a real backend.
- **A held Back on the team form gives no feedback** while a save or status
  change finishes (under a second on the mock, up to the timeout on a real
  API). Deliberate; a "Saving…" note would be the refinement.

**Complete work and the offline payment record (Phase 3E-9), for the owner and
the backend.**

- **Can a payment record change after completion** ("Not paid yet" → "Paid" a
  week later)? Not built: completing cannot be undone, there is no call to
  amend, and §37 does not say. One more call and a form mode if wanted.
- Server `validation` is a toast, not field messages, until a contract gives
  `fieldErrors`.
- The vendor and customer mocks are not joined; a recorded payment reaches the
  customer side only through the fixture.
- Every value is this app's guess: endpoints, `PAID` / `UNPAID`, method ids and
  labels, integer minor units, `INR`, the ₹10,00,000 and 500 ceilings, whether
  the method label is stored with the record, body-before-state validation, and
  the customer's subset.

**Vendor reports (Phase 3E-8), for the owner and the backend.**

- **What each figure counts.** Does total cover every request offered (directed
  and broadcast, including broadcasts another vendor took) or only those that
  became the vendor's? Is rejected only their own? Is cancelled by the customer
  only, before or after acceptance? Are ratings counted by review date or by the
  date of the job reviewed? And the average's rounding.
- **Where a period begins** — the vendor's time zone and the first day of the
  week. The app assumes neither, because it computes neither.
- The mock's figures do not move when work is answered in the app, by design.

**Vendor team (Phase 3E-7), for the owner and the backend.**

- **Team assignment (§40)** is not built and nothing exposes it; a member's
  `id` is what assignment would refer to.
- **Duplicates and limits.** No duplicate check (same phone twice) and no
  maximum team size; both are the backend's to decide.
- **Returning from the form** re-reads the team; until that read lands (well
  under a second at real latency, with the pull spinner showing) the list
  shows the team as it was. Adopting the form's answer directly would need a
  shared signal between the two screens; not built.
- **The phone is shown as stored digits**, unformatted, as on the customer
  profile.

**Vendor reviews (Phase 3E-6), for the owner and the backend.**

- **Where else the rating appears.** §30 (dashboard) and §38 (profile) both
  list Rating; neither screen shows the number — the dashboard is locked and
  the profile only links to Reviews. Decide whether either should.
- **The customer's name.** Shown as the backend gives it (the vendor already
  sees it on the job). Whether a review shows the full name, a first name or
  nothing is a product and privacy decision nobody has made.
- **Paging and order.** The list is whole and newest first; a busy vendor
  will need pages, and `totalReviews` is already separate from the list.
- **Refresh.** Reads on open, on pull and on Try again; not on focus.
- **Mock join.** A review a customer sends in this app never reaches a
  vendor's list — the two mocks share no data until the backend joins them.

**Vendor work status (Phase 3E-5), for the owner and the backend.**

- **Endpoints and idempotency**: the exact start/complete calls, and whether a
  retried step that already succeeded should be answered as success rather than
  `invalidTransition`.
- **Final status**: whether the vendor's completion is `COMPLETED` and `CLOSED`
  a later backend/customer step (assumed), and whether the customer confirms.
- **Who stamps `completedAt`** (assumed: the server), and whether a start time
  is recorded too.
- **Other transitions**: on hold, undo/restart, cancellation after acceptance,
  reassignment — none exist in the app; §21 lists `ON_HOLD` and `CANCELLED`.
- **Ordering** of active work (furthest along first is this app's reading of
  its own contract).

**Vendor accept / reject (Phase 3E-4), for the owner and the backend.**

- **Endpoints**: the exact accept and reject calls, their payloads, and whether
  an idempotency key is required (a retried accept that already succeeded
  should not be refused as `notPending` if the backend can tell it is the same
  request).
- **Status values**: whether `ACCEPTED` and `IN_PROGRESS` are separate (the app
  assumes so) and what a rejected request's status is (`REJECTED` assumed).
- **Broadcast winner locking**: how first-accept-wins is enforced, the exact
  conflict response (409 with a reason?), and what happens to the other
  vendors' copies (assumed: they disappear; `getRequest` says not found).
- **Rejection**: whether it is persisted, whether a reason is required (§33:
  "if backend supports it" — none is collected), and what happens to a directed
  request its vendor rejects (back to the customer, or into open dispatch?).
  Vendors keep a Rejected list since 3E-13 (owner decision); its backend
  questions are under that phase.
- **Expiry**: whether an offer or an acceptance can expire.
- **Authorization**: `notFound` (not `forbidden`) for somebody else's request
  is assumed for answers too.
- **Consistency**: the app re-reads list and dashboard after every answer. A
  push or a version number would let it notice changes made elsewhere.
- **What a vendor sees after accepting** — address, photographs, phone — is
  still not on the record; the accept flow is where it would arrive (§32).
- Delete `MockVendorRequestBook` with the other vendor mocks when the real
  service lands.

**Vendor requests (Phase 3E-3), for the owner.**

- **§31's tabs are finer than this list's.** It names New, Accepted, In
  Progress, Completed and Rejected. Here Accepted and In Progress are both
  "Active" (each card says which). Rejected has been its own filter since
  3E-13.
- **What a vendor may see before accepting**: address, photographs, preferred
  date and time, the customer's phone. None are on the details record yet.
- Whether the dashboard's "See all" should open the list already filtered
  (Pending from New requests, and so on), and whether dashboard cards should
  open the request. Both would touch the locked dashboard.
- Paging for the completed group, and whether the list should refresh when its
  tab is focused again.
- Backend reconciliation: endpoints, field names, how groups and `dispatch` are
  expressed, `notFound` versus `forbidden` for somebody else's request, and
  whether a broadcast request that was taken disappears or comes back marked.
  Delete `MockVendorRequestService` when the real service lands; the fixtures
  go with the dashboard mock.

**Vendor dashboard (Phase 3E-2), for the owner.**

- §30's other figures: **Today's Requests**, **Accepted** and **In Progress** as
  separate counts, and **Rating**. Not drawn — there is no contract for "today"
  and ratings belong to the reviews phase. Since 3E-6 the rating exists
  (`getVendorReviews`), reached from Profile; the dashboard still does not
  show it. Since 3E-8 today's counts exist too, on Reports
  (`getReport('today')`); the dashboard does not show those either.
- Whether job cards on the dashboard should open the request once details (§32)
  exist, and whether the counts should become filters into the request list.
- Whether the dashboard should refresh when its tab is focused again. Since
  3E-4 it re-reads whenever a request is answered (`VendorWorkSync`); changes
  made elsewhere (another device, the backend) still wait for a pull.
- Backend reconciliation: the endpoint, its field names, how `dispatch` is
  expressed, which statuses fall in which group, what "completed" spans and the
  preview size are all this app's guess. Delete `MockVendorDashboardService` and
  `mockVendorDashboardData` when the real service lands.

**Vendor profile (Phase 3E-1), for the owner.**

- Whether registration's business name and categories should pre-fill setup
  (needs the backend to keep them; the mock cannot).
- Whether a service area is required before a vendor can receive requests, and
  what structure matching needs from it.
- Whether the owner may edit their own name/email from the vendor app.

**Customer review (Phase 3D-6), for the owner.**

- The comment ceiling (500, reused from request notes) is the app's; §24 names
  none, and the backend's limit wins when there is one.
- Review photos, deferred on 2026-09-22 — §24 says "if supported".
- Whether §22's "Review Submitted" timeline step is wanted before a backend
  exists. Not built. (§54's `review_submitted` event is sent since 3F-1.)
- Whether My Requests should say a completed request is waiting for a review.
  §23 lists nothing of the kind, so the cards are unchanged.
- "Cannot be changed" in the success message rests on §24 giving a customer no
  edit. If the backend ever allows edits, that sentence changes.

**Smaller things.**

- Created mock requests and mock reviews survive a restart on this device only
  (Phases 3D-4, 3D-6); they are not on any server, and two customers on one
  device can hold the same reference. Both go away with the backend.
- A stray `ChatGPT Image ….png` sits untracked at the repo root.
- The branch `feature/FIX-001-navigation-and-auth-state` now carries the whole
  customer request flow, which is wider than its name.

---

## 11. Lessons this flow paid for

Written down because each one cost a device session to find.

- **After agents edit a mounted screen, cold-start before judging a hook-order
  error (21/10/2026).** A red "Should have a queue … calling Hooks
  conditionally" screen on the vendor dashboard was Fast Refresh patching a
  screen that several agents had edited while it was open; a cold start drew it
  cleanly with nothing in the log. Fast Refresh keeps hook state across edits
  and cannot when the list of hooks changes shape under it.
- **A rule nobody runs is a rule nobody keeps (3G-2).** CLAUDE.md §4 forbade a
  screen to reach the registry, and the Add / Edit Address screen had done so
  since 3D-9, through every review and every green suite. The first run of a
  test that simply reads the files found it. A boundary written only in prose is
  a hope; make it a test.
- **The native `SafeAreaView` measures its provider, not itself (3G-1).** It
  pads by its nearest `SafeAreaProvider`'s overlap with the system bars, so
  anything put above the navigators in the layout needs a provider of their own
  below it, or every screen pads a second status bar.
- **`KeyboardAvoidingView` mixes two coordinate spaces (3G-1).** Its frame comes
  from `onLayout`, relative to its parent; the keyboard's top is on the window.
  Anything that moves a `Screen` down from the window's top must feed
  `keyboardVerticalOffset`, or exactly that much of a form stays under the
  keyboard.
- **React Native already writes a `raw/keep.xml` for bundled images (3G-1)**,
  and an app-level one of the same name is silently replaced in the merge.
  Prove a keep rule with a probe resource, not by reading the shrinker's log —
  "matches string pool constant" had kept the images by coincidence.
- **`findByType` cannot find a `memo` component (3G-1)** — `Icon` is one. Find
  it by its props.
- **`jest.getTimerCount()` counts Reanimated's frame timers (3G-2).** A toast's
  entrance and exit leave fake-timer entries that are not the provider's, so "no
  timers after unmount" fails for the wrong reason. Watch the provider's own
  timer by its delay (`duration.toast`) through a `setTimeout` / `clearTimeout`
  spy.
- **Jest's default window is 750dp at font scale 2 (3G-2).** Anything laid out
  from the window — `ConfirmDialog`'s fit — needs `Dimensions.set` inside `act`
  and the window restored in `afterEach`, or the test measures a tablet with
  large type.
- **Use `globalThis`, not `global`, in a test (3G-2)** — `global` does not
  type-check under this tsconfig.
- **A shared rule with memory is a hook, not a pure function (3G-2).** The stale
  fix needed the previous reason across a render where the query had already
  cleared it. The pure `splitStale` keeps the rule testable as a table, and
  `useStaleState` holds the one ref.
- **A `ConfirmDialog` row never wraps (3D-11).** Each button's basis is its 40%
  minimum, never its words, so `flexWrap` does nothing there and a long label is
  cut, not wrapped. Count the room before trusting a row (since 3G-2 the dialog
  does).
- **Changing `wm density` under a running app leaves stale text layouts
  (21/10/2026).** After 360×640 @160dpi and back to 420dpi with the process
  still alive, the date and time chips drew "No preferen…" and "Tomorro…" in
  boxes of the right size; after `am force-stop` and a relaunch they drew in
  full. Not an app defect — a phone does not change density mid-use. Always
  force-stop and relaunch after a density or size change before judging text.
- **A save queue needs one line per session, not per screen (3E-10).** Three
  review rounds each found a new interleaving of a lost answer, a pull and a
  second save while reads and changes ran on separate tracks, and the line
  lived in a screen that could be left and reopened. Putting every read and
  change of the record in one line owned by the session removed the whole
  class at once.
- **Re-dispatching an action from `beforeRemove` skips that screen's own guard
  (3E-11).** React Navigation 7 tags the action handed to `beforeRemove` with
  the routes it has already visited, and sending that action again does not
  run the same screen's listener — which is how a confirmed discard gets out.
  So "hold the leave, then send it back through the guard" silently left with
  unsaved typing after a failed save. Whatever releases a held leave must ask
  the guard's question itself. Found by a test, not on the device.
- **The 3E-3 clipping comes back wherever text is sized by its own content
  (3E-10).** The shop-images add tile's "Take a photo", centred in its half of
  a square, drew as "Take a" at 360dp: measured at its natural width, broken a
  fraction narrower, the second line cut. Centring does not help; a definite
  width does (`alignSelf: 'stretch'` and centred text inside it, or `flex: 1`
  in a row). Check every short centred label at 360×640 @160dpi.
- **A boolean in-flight guard is released by the wrong call when the inputs
  change mid-read (20/10/2026).** The newer read starts while the superseded one
  is still running, and the older one's `finally` opens the guard under the
  newer read — a retry or pull in that window sends a second request.
  A count of calls in the air was the first fix and the second-round review
  broke it: a superseded read that never settles (a dead connection, up to the
  request timeout) kept Try again shut after the newest read had failed. Now
  each call takes a number and only the latest number releases the guard; two
  tests pin it — one fails with the boolean, one with the count.
- **An APK built before the Metro port moved looks for the old port
  (20/10/2026).** The port is compiled into the debug build, so the emulator's
  install from 28/09 kept asking for 8081 — "Unable to load script", then the
  bundle in its assets — while Metro was healthy on 8085. After a port change,
  install the current debug APK before suspecting Metro, then
  `adb reverse tcp:8085 tcp:8085`.
- **An "already stored" shortcut must not trust a URL a mock can repeat
  (3E-10).** `MockImageService` numbered its URLs from 1 on every launch, so a
  new photo could carry the URL of one stored the day before, and "is this URL
  in the list? then it is saved" marked it saved without saving it. The
  shortcut now needs both an unknown outcome on this photo's own save and the
  URL in the list, and the mock's URLs carry a per-launch token. A real
  backend's URLs are unique, but "found in the list" is still not "my save
  worked".
- **Parallel agents in one working tree — what worked (20/10/2026).** Eight
  slices were built at once by separate agents. Each owned a disjoint set of
  files; a shared file (a copy file, the navigator, the
  registry, a theme file) was changed only with Edit on a unique anchor, never
  rewritten whole; each agent wrote its findings to its own notes file rather
  than to this one, and the lead folded them in; each ran only its own suites
  and type-checked knowing another slice could be mid-edit, and the lead ran
  the full gates and the device pass on the finished tree. What it cost: a
  run that failed only to load another slice's half-written screen, and a
  re-export kept alive for a sibling's import until the lead removed it.
- **Two screens, one label (3E-7).** The team form's Save reads "Add team
  member", exactly as the list's Add does — and the list stays mounted under
  the form. In tests, press within the form's subtree; on the device, the dump
  only holds the screen in front, so `tapdesc` is unaffected.
- **uiautomator cannot see inside a hidden subtree (3E-6).** Text under
  `importantForAccessibility="no-hide-descendants"` — the inside of a card
  that speaks as one block — is absent from `uiautomator dump`, so its bounds
  cannot be measured from the dump. Judge it at 360×640 @160dpi, where a
  screenshot is 1:1 with dp, and read the block's own `content-desc` for the
  words.
- **Close the keyboard with Back, not ESC, before tapping the next field
  (3E-6).** ESC (keyevent 111) did not always hide the keyboard on this
  emulator, and a tap computed while it was open landed on the wrong field
  or the button below.
- **Stopping a background run does not stop the script it started (3E-5).**
  The Git Bash process tree outlives the task, so a "stopped" device run went on
  tapping alongside the next one and both wrote into the same log (a gap of
  null bytes is the sign). Kill by command line —
  `Get-CimInstance Win32_Process | ? CommandLine -like '*<script>*'` then
  `Stop-Process` — and confirm none remain before starting again. And a tap
  helper must say when its target was never found: a UI dump can fail for a
  moment while the screen settles, and a silent miss made a later step act on
  the wrong filter.
- **Never edit a script a background run is executing (3E-4).** Bash reads a
  script as it goes; an edit shifts the bytes under it and the run carries on
  from the wrong place. Copy the script and run the copy.
- **A screen under a pushed screen is still mounted (3E-4).** In a test, the
  list under the details it opened still renders its own Accept for the same
  request, so an unscoped lookup presses the hidden one. Scope a details test's
  lookups to the details screen's subtree.
- **A UI dump costs ~2 s on this emulator (3E-4).** Two dumps after a tap can
  outlast a 3 s answer and the 4 s toast after it. Check everything a moment
  needs from one dump, then wait for the toast.
- **A wrapping `Text` sized by its own content, in a row, can clip its last
  word (3E-3).** With only `flexShrink` it is measured at its natural width and
  then line-broken against one a fraction narrower; the height was computed for
  one line, so the second is cut off with no ellipsis. It shows at low density
  (360×640 @160dpi) and not at 420dpi, and the same text in the same box drew
  correctly in a `ScrollView` and wrongly in a `FlatList` cell. Give a
  multi-line title `flex: 1` (a definite width), or `numberOfLines={1}` if one
  line is acceptable — never `flexShrink` alone.
- **A `FlatList` mounts only its first screenful in the test renderer (3E-3).**
  Count what a list holds from its `data` prop, not from the rendered tree, and
  press a card through the node with `accessibilityRole="button"` — the wrapper
  component has the same `testID` and an `onPress` with a different signature.
- **A swipe at the top of a list is a pull-to-refresh (3E-3).** A device script
  that "scrolls to top" with upward swipes refreshes the list each time, which
  moves what it is about to tap and clears a stale notice it is about to
  screenshot. Tap first, scroll afterwards. Android also appends the state to
  the name: a busy list reads `"Loading your requests, busy"`, so match the
  prefix.
- **A guard released by `isLoading` can stay shut for good (3E-2).** A retry
  that fails at once sets loading and clears it in the same render, so an effect
  watching `isLoading` never runs and "one retry at a time" becomes "one retry,
  ever". Release such a guard on the answer — a new `data` or `error` object —
  or in a `finally` around the awaited call. Caught by a test that retried
  twice; nothing on the device would have shown it with a slow mock.
- **`jest.spyOn(AsyncStorage, 'setItem')` + `mockRestore()` strips the mock's
  implementation (3E-1).** The jest AsyncStorage mock is already a `jest.fn`;
  spying returns the same function and restoring leaves it returning undefined
  for every later test. Use `(AsyncStorage.setItem as jest.Mock)
  .mockRejectedValueOnce(...)` and restore nothing.
- **Changing `wm density` under a running app leaves stale text measurements
  (3E-1).** Clipped letters after a size switch are the device, not the app:
  force-stop and relaunch before judging a screenshot.

- **A prop that becomes `undefined` is not an instruction to unset.** A list
  announced itself as "busy" because it carried `accessibilityState` and no
  label; dropping the state once loaded did not clear it, because the native view
  is updated rather than remounted. Both the label and the state have to be
  present on **every** render. (Since 3G-2, 21/10/2026, the cleaner way out is
  two keyed views, loading and settled: React replaces the native view, so the
  loaded one need carry no label at all.)
- **`toISOString()` is the wrong way to get `YYYY-MM-DD`.** It converts to UTC
  first, so half past midnight in Delhi is still yesterday in Greenwich and a
  customer asking for tomorrow is recorded as asking for today. Build the string
  from local components.
- **Put error and empty in `ListEmptyComponent`, not instead of the list.**
  Replacing the list takes the header and footer with it — which once removed the
  screen's own name, and would have removed the "no preference" option that
  §18A.4 requires to stay available when the vendor list fails.
- **Two primary buttons doing the same thing is a bug.** An `ErrorState` with
  `onRetry` above a Submit button gave the customer two identical blue calls to
  action. Submit is the retry.
- **`numberOfLines` no longer sizes a multiline `TextInput` on Android**, and
  `rows` is not in this RN version's types. Size it with `minHeight`, and give the
  input `alignSelf: 'stretch'` or only the top strip of the box is tappable.
- **Cancel repeating animations on unmount.** `withRepeat(-1)` without
  `cancelAnimation` is a real leak; it showed up first as jest refusing to exit.
