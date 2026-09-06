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

**Known lint baseline:** 21 warnings, 0 errors. They are all
`no-void` on the deliberate `void promise` idiom used by the shared hooks. Do not
"fix" them piecemeal; the idiom is consistent across the codebase.

Metro and the app:

```bash
npx react-native start                        # from the repo root, always
adb reverse tcp:8081 tcp:8081                 # after every reinstall
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.fixora/.MainActivity
```

If Metro serves 500s, it was started from the wrong directory: kill whatever
holds port 8081 and restart from the repo root.

---

## 6. How we debug on a device

**Nothing is done until it has been run on the emulator.** Tests passing is not
evidence that a screen works; several real defects in this flow passed every unit
test and were only visible on the device.

Start the emulator (AVDs on this machine: `Small_Phone`, `Pixel_Tablet`,
`Small_Tablet`, `Resizable_Experimental`, `SumoEats_Pixel`):

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
(`sumoeatsUserWrapperApp`, `SumoEatsMerchantApp`) — a **different** codebase.
"The user app and the merchant app" always means those, not Fixora. Their running
context doc is `D:\Projects\SUMO\SUMO_HANDOFF.md`. All three RN apps share the
same Android config, which is why one toolchain serves them.

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
Home → Categories → Sub Categories → Create Request → Preferred Vendor → createRequest()
```

Everything after that call is unbuilt.

**Service contracts** (`src/shared/services/types/`):

| Service | Methods |
|---|---|
| `AuthService` | customer OTP, vendor registration / OTP / auth code |
| `CategoryService` | `listServiceCategories()`, `listSubCategories(categoryId)` |
| `RequestService` | `listRecentRequests(limit)`, `createRequest(input)` |
| `VendorService` | `listEligibleVendors(categoryId, subCategoryId)` |
| `ImageService` | pick / compress / validate / upload+progress / retry / remove |
| `NotificationService`, `PermissionService` | unread count; camera, location, notifications |

**The create-request payload** — the thing most worth not breaking:

```ts
{
  categoryId, subCategoryId,        // ids only, from the route
  priority,                          // LOW | MEDIUM | HIGH | EMERGENCY (§15)
  preferredDate?,                    // YYYY-MM-DD, local calendar date
  preferredTime?,                    // HH:mm, 24-hour
  imageUrls?,                        // remote URLs, uploaded before submit (§16)
  notes?,                            // exactly as typed, never trimmed
  vendorId?,                         // present = directed; ABSENT = open dispatch (§18A)
}
```

`vendorId` absent is the message. Not `null`, not `""`, not `"any"` — the backend
reads absence as open dispatch and broadcasts. This answers §18A.6's open
question in favour of the single-call form; if the backend wants the two-call
form instead, §18A.6 says the UI is unaffected and only that field and the call
behind it move.

**Flow state.** `RequestDraftContext` (`src/features/customer/state/`) carries
the details from the form to the screen that submits them. It is mounted around
the customer stack — not params (navigation state is serialised, logged and
restorable, which is no place for someone's notes or photos of their home), not
Redux, not storage (an abandoned draft restored a week later is a request nobody
meant to send).

**Mock levers.** `AppConfig.mock.failureRate` drives failures app-wide.
Sub-categories are seeded by id with `cat_appliance_repair` and `cat_pest_control`
left empty, and vendors are seeded with `sub_light_installation` left empty, so
both empty states are reachable by tapping through the real app rather than by
editing a mock.

---

## 10. Open items

Carried forward, all raised with the owner and none yet decided:

**Missing contracts, deliberately.**

- **Address (§18)** is a Phase 1 launch item with no service, no type and no
  screen. A submitted request currently carries no location.
  `CreateRequestInput` is shaped to gain `addressId` without disturbing anything.
- **Confirmation (§19) and Request Details (§20)** do not exist. Submission
  currently shows a toast with the reference and returns to Home
  (`navigation.popToTop()`). It is a seam and is meant to be replaced; when §19
  lands, the vendor screen's Submit becomes Continue and the call moves again.

**Known defects on locked screens.**

- Home's category tiles open the full catalogue rather than that category's
  services.
- Home's recent-requests region announces `content-desc="busy"` — the same defect
  fixed on the sub-categories list, still present there.
- `useServiceQuery`'s pull-to-refresh failure is silent: it sets an error but
  keeps stale data, so nothing tells the user the refresh failed. Affects Home
  and Categories.

**Smaller things.**

- `BackButton` duplicates `AuthBackButton`; collapsing them means editing auth.
- Going back from vendor selection to edit details resets the vendor choice.
- The mock does not persist created requests, so a new one never appears in
  Home's recent list.
- A stray `ChatGPT Image ….png` sits untracked at the repo root.
- The branch `feature/FIX-001-navigation-and-auth-state` now carries the whole
  customer request flow, which is wider than its name.

---

## 11. Lessons this flow paid for

Written down because each one cost a device session to find.

- **A prop that becomes `undefined` is not an instruction to unset.** A list
  announced itself as "busy" because it carried `accessibilityState` and no
  label; dropping the state once loaded did not clear it, because the native view
  is updated rather than remounted. Both the label and the state have to be
  present on **every** render.
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
