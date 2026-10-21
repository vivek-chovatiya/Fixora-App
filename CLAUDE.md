# CLAUDE.md — Fixora

Fixora is a multi-service marketplace app: **customers** raise service requests (electrician, plumber, …) and
**vendors** receive, accept and complete them. One React Native app holds both sides.
This file is loaded every session. It holds the rules; the detail lives in the documents below.

---

## 0. Read first — six documents, six authorities

| File | Authority over | When to read |
|---|---|---|
| `PROJECT_BIBLE.md` | **Product and scope** — what each screen shows, what Phase 1 includes and excludes (87 sections) | Before any feature; read the sections the brief names |
| `CLAUDE.md` (this file) | **Rules and standards** | Always loaded |
| `docs/WORKING_NOTES.md` | **How the work is done** — process, code/test style, commands, device recipes, contracts, current state (§9), open items (§10), lessons (§11) | At the start of a session, and the sections relevant to the slice |
| `docs/DESIGN_CHANGES.md` | **Visual language** — tokens and UI invariants that must not break | Before touching any screen, component or theme file |
| `docs/BRANCHING.md` | **Git Flow** — branch names, commit format, merges, releases | Before branching, committing or opening a PR |
| `docs/RELEASE.md` | **Release builds and signing** — upload key, versioning, R8, release smoke test | Before a release build |

`WORKING_NOTES.md` is ~4,300 lines: open the section you need, never the whole file.
If two documents disagree, the bible wins on scope, this file wins on standards; report the conflict.

---

## 1. Phase boundary — the hard rule

The product owner's standing instruction:

> Do not implement Phase 2 features during Phase 1 unless explicitly approved. However, design Phase 1
> architecture so Phase 2 features can be plugged in without major rewrites.

Phase 1 **excludes**: online payment / gateway, wallet, chat, live tracking, AI, subscriptions, coupons,
referrals, invoices, vendor earnings, advanced analytics, advanced search, favourites, multi-country,
multi-language translation. Payment in Phase 1 is **offline record-keeping only**.

- If a request could be read as Phase 2, say so and get explicit approval before building it.
- Acknowledge future work with a **seam** (an interface with no implementation), never a half-feature.
- "Build for scale" means foundations Phase 2 can plug into — never Phase 2 features early.

---

## 2. Stack

| | |
|---|---|
| App | React Native **0.86.2**, React 19.2.3, TypeScript 5.8, Hermes, New Architecture on |
| State / forms | Redux Toolkit 2, react-hook-form 7 + zod 4 |
| Navigation / UI | React Navigation 7 (native-stack, bottom-tabs), Reanimated 4, @gorhom/bottom-sheet, react-native-vector-icons |
| Data | axios (only inside `src/core/http`), AsyncStorage (only inside `src/core/storage`), NetInfo (only inside `src/shared/services/device`) |
| Tests | Jest 29 + react-test-renderer — 123 test files in `__tests__/` |
| Android | app id `com.fixora`, emulator AVD **`Fixora_Pixel7`** (Pixel 7, API 36, 1080×2400 @ 420 dpi) |
| Metro port | **8085** (`metro.config.js` `server.port` + `reactNativeDevServerPort` in `android/gradle.properties`) |

There is **no backend yet**: every service has a mock implementation behind an interface.

---

## 3. How work is done

Work arrives **one slice at a time**; each slice is finished before the next starts. The owner's brief
usually ends with a list of what **not** to start — that list is binding.

**Order inside a slice (fixed):**
inspect → functionality → Fixora theme UI → modern UI polish → loading → error / empty → accessibility →
light / dark → responsive → device verification → lock.

- **Inspect before writing.** Read the bible sections the brief names, then the existing code for the seam
  being extended. Identify what can be reused (components, hooks, services) before creating anything.
- **Plan, then build.** A brief that describes the work is the approval for it. Anything outside the brief —
  new dependency, new shared token, risky change to a shared component, backend contract — needs the
  owner's OK first.
- **Stop rather than guess.** When a stop condition is met (missing contract, ambiguous field, new dependency,
  risky shared change), stop and report the exact decision needed with a recommendation. Never invent a
  backend contract to keep moving.
- **Ask as options.** When a choice is the owner's, give 2–4 options with the recommended one first.
- **Never widen scope.** Not even "while I'm here".
- **Finish with a numbered report** written against what was observed, not intended: files created, files
  modified, contracts used, payloads, every state verified, every gate result, issues found, anything
  needing approval.

---

## 4. Architecture — one shape everywhere

```
Screen  →  feature hook  →  service interface  →  implementation (mock today, API later)
```

```
src/
  app/          AppRoot, bootstrap, Redux store and typed hooks
  core/         config (AppConfig — the only config entry point), http, logger, storage, clipboard
  navigation/   param lists, navigators, tab chrome, placeholders
  shared/
    components/ the whole UI library — search index.ts before building anything
    hooks/      useServiceQuery, useServiceMutation, usePaginatedQuery, useSingleFlightQuery,
                useImageUpload, useResponsive, useCountdown, useNavigationEvent, useStaleState,
                useNetworkStatus, useAnalytics
    presentation/ display tables for backend strings (request status/priority tokens, rating)
    services/   types/ (interfaces), mock/ (fixtures), device/, ServiceRegistry.ts
    theme/      colors, spacing, radius, shadows, typography, icons, animation, breakpoints, …
    validation/ field rules shared across features
    types/      AppError and friends
  features/     auth, customer, notifications, onboarding, vendor
    <feature>/  screens/ components/ hooks/ constants/ validation/ state/
```

**A screen never touches** `axios`, `AsyncStorage`, `ServiceRegistry`, `PermissionsAndroid`, a picker
library or an icon library. It calls a hook in its own feature; the hook resolves a service via the registry.
There is no separate repository layer — **services are the boundary; never bypass them.**
`__tests__/architecture/importBoundaries.test.ts` enforces this and §2's core-only imports (axios, AsyncStorage,
NetInfo): it reads every file under `src` and fails the suite on a break.

**Data primitives:**
- `useServiceQuery(fetcher, deps)` → `{data, error, isLoading, isRefreshing, isError, refresh, retry}`
- `useServiceMutation(mutator)` → `{mutate, data, error, isSubmitting, isError, reset}`

**Rules that keep being proved right:**
- **Ids travel, display data does not.** Navigation params carry ids only; never key a client map on a
  display name.
- **Never invent a backend enum.** Statuses and priorities are plain strings with a presentation table that
  falls back safely.
- **Never hardcode service categories** and never create per-service screens (`ElectricianScreen`).
- **`error.userMessage` may reach the UI. `error.message` never may.**
- **System appearance is the only theme authority** — no preference, no toggle, no `useColorScheme`
  outside `ThemeProvider`.
- **Mocks are slow and can fail on purpose** (`AppConfig.mock`: `minLatencyMs`, `maxLatencyMs`,
  `failureRate`) so loading and retry states are reachable before the backend exists.

---

## 5. Engineering standards

**Components.** Never duplicate one — search `src/shared/components/index.ts` first. If something close is
locked to another screen, prefer a sibling with a docblock saying why they are not merged. An abstraction
needs a **second real consumer**; never write one speculatively. Never build one-off UI.

**Screens.** Every screen that reads handles **loading, empty, error and retry** (plus permissions, offline
and pull-to-refresh where relevant). Every screen that writes **locks its button while in flight** and
**keeps what the user typed** when it fails.

**Theme.** Nothing is hardcoded — colours, spacing, radii, shadows, typography, icons, durations all come from
`src/shared/theme`. If a semantic token is genuinely missing, **stop and say so**; never invent a
screen-local one.

**State.** Prefer local state; promote to Redux only when unrelated modules need it.

**Errors.** Every async path handles loading, error and retry. Never swallow an error.

**Performance.** `FlatList` for lists; memoise only when it measurably helps; no anonymous render functions,
no needless state, no deep nested rendering.

**Copy.** One frozen file per feature (`constants/<feature>Copy.ts`) — the seam translation plugs into later.

**Naming — predictable over clever.** `PrimaryButton` / `SecondaryButton` / `DangerButton`,
`EmailInput` / `PhoneInput` / `SearchInput`, `VendorCard` / `CategoryTile` / `RequestCard`.

**Never:** rename folders, invent architecture, hardcode categories, bypass services, over-engineer.

**Design.** Simple, professional, minimal business application. Never Dribbble, never flashy.

**Future-proofing.** Payments, wallet, subscriptions, chat, invoices, analytics, push, offline,
multi-language, multi-country and RBAC must be pluggable later **as seams** — see §1.

---

## 6. Code and comment style

- **Every file opens with a docblock**: why the file exists, the decision that shaped it, what it refuses to
  do. A `⚠️` paragraph marks what a future reader is most likely to break. Cite the bible section when a rule
  comes from there (`PROJECT_BIBLE.md section 18A.4`).
- **Comments explain why, never what.** Keep comments that record a device-found defect and why the obvious
  fix was wrong.
- **Match the surrounding file by hand.** The repo has `.prettierrc.js` but is **not** prettier-formatted —
  never run prettier over files.

## 7. Tests

Write tests against the **rule**, not the render. What has caught real bugs: asserting a payload's exact key
set, asserting a field's **absence**, serialising and searching (`not.toContain('<display name>')`), stub
services that **throw** to prove a screen never calls them, reading `accessibilityLabel` / `accessibilityState`.
Register stubs with `registerService`, clear with `resetServices`, and **unmount in `afterEach`** (a screen
left loading keeps `Skeleton` animating and Jest never exits). Detail: WORKING_NOTES §4.

---

## 8. The five gates — all must pass before a slice is done

Run from the repo root:

```bash
npx tsc --noEmit                              # 0 errors
npx eslint src __tests__ --ext .ts,.tsx       # 0 errors; warnings must not rise above the baseline
npx jest --silent                             # all green
npx react-native bundle --platform android --dev false --entry-file index.js \
  --bundle-output "$TEMP/fixora-bundle-check.js" --assets-dest "$TEMP/fixora-assets-check"
cd android && ./gradlew assembleDebug -q      # exit 0
```

**Lint baseline:** only `no-void` warnings on the deliberate `void promise` idiom (30 as of 20/10/2026 — the
live count and its history are in WORKING_NOTES §5). Never "fix" them piecemeal; never add one per caller.

**Gradle from a Claude shell on this machine:** if `gradlew.bat` "is not recognized", clear the
`NoDefaultCurrentDirectoryInExePath` environment variable for that command — the wrapper is fine.

---

## 9. Running the app

**Metro port is 8085.** 8081–8084 belong to the SumoEats / Sumo Ordering apps on this machine
(`D:\Projects\SUMO`) — **never kill another project's Metro**; check who owns a port first:

```powershell
Get-NetTCPConnection -LocalPort 8085 -State Listen |
  ForEach-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)").CommandLine }
```

```powershell
# Metro — its own visible window, always started from the repo root
Start-Process "cmd.exe" -ArgumentList '/k','title Metro - Fixora && npx react-native start' -WorkingDirectory "D:\kano\Fixora"
# Emulator — -WindowStyle Hidden keeps its log console off the desktop; add '-no-window' for verification runs
Start-Process "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" `
  -ArgumentList '-avd','Fixora_Pixel7','-no-snapshot-load','-no-boot-anim','-gpu','swiftshader_indirect' -WindowStyle Hidden
```

```bash
adb reverse tcp:8085 tcp:8085                 # after every reinstall
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.fixora/.MainActivity
```

- **Only Metro (and the emulator's device screen when the owner wants to use the app) may be on the
  desktop.** Never the emulator log console, never an empty redirected console, never a log-tail window.
- **Never start Metro, the emulator, a build or the app unless asked** — except: after changing native or
  build config (Kotlin/Java, manifest, Gradle, a native package), rebuild and confirm the app opens.
- If Metro serves 500s, it was started outside the repo root: stop that Metro and restart it from the root.

## 10. Device verification — nothing is done until it runs on the emulator

Passing tests is not evidence a screen works.

**One pass, one configuration (owner, 21/10/2026): 1080×2400 Dark** — the device's own size — the whole
functional workflow (every state, Android back, no accidental navigation, no crashes) and a visual look at
contrast, hierarchy and states. **Small screens are made safe by calculation, not by a separate device test:**
no fixed widths, text that wraps or truncates by rule, and node `bounds` measured on the big screen to work out
what a 360dp width leaves room for. Light mode is not a separate pass either — but the code must still work on
every size and in both modes: theme tokens only, nothing that only reads in one mode.

Toolkit (detail: WORKING_NOTES §6): `source .uitap.sh` → `dump`, `tapnode "<exact text>"`;
`adb shell cmd uimode night yes|no`; `adb shell wm size 360x640 && adb shell wm density 160` (reset after;
relaunch with `am start`). Put **`MSYS_NO_PATHCONV=1`** in front of any adb command with an `/sdcard/...` path.

- **Measure, don't eyeball** — read node `bounds` (÷ 2.625 at 420 dpi) before calling text clipped.
- **Prove retry by counting** service calls in logcat, not by seeing a button.
- **Forced failures:** `AppConfig.mock.failureRate = 1`, or a mock patched to throw and marked
  `// TEMPORARY-VERIFICATION-ONLY`; back up first, restore after, then `grep -rn "TEMPORARY-VERIFICATION" src/`
  must return nothing.
- A red LogBox on a failure in a debug build is the dev logger, not a leak — check which node the text is on.

---

## 11. Git and secrets

Git Flow — full rules in `docs/BRANCHING.md`.

- Branch from **`develop`**: `<type>/<ticket-id>-<kebab-description>` (`feature/`, `bugfix/`, `hotfix/`,
  `chore/`, `docs/`). **Never commit to `main` or `develop` directly.** A release/hotfix merged into `main`
  must also be back-merged into `develop`.
- **Claude commits and pushes only when asked** in the conversation, and shows what will be committed first.
- **Conventional Commits** with a real prose body: what changed and why.
- **No AI or tool attribution anywhere** — no `Co-Authored-By: Claude`, no "Generated with Claude Code", no
  mention of Claude / Anthropic in commits, PR bodies or repo content. If one slips into an unpushed commit,
  remove only lines starting `Co-Authored-By:` (never filter on the word "Claude" — `CLAUDE.md` is a real file).
- Remote: `https://github.com/vivek-chovatiya/Fixora-App.git` (owned by vivek-chovatiya). Credentials live in
  Git Credential Manager. **Never write a token into a remote URL or `.git/config`, never print one**, and never
  run `git credential-manager github list` (it prints raw tokens). If a push hangs, run it with
  `GIT_TERMINAL_PROMPT=0` and ask.

## 12. Definition of done

UI done · services integrated (mock) · loading, empty, error, retry handled · reusable parts extracted ·
theme tokens only · responsive · accessible · light and dark checked · **all five gates pass** · **device
verification done** · docs updated (WORKING_NOTES current state / open items / lessons, DESIGN_CHANGES when the
visual language changes) · no Phase 2 creep.

## 13. Environment

Windows 11; shell is Git Bash (adb recipes assume it) or PowerShell. Node 24.19, npm 11.17.
The Android toolchain is pinned **machine-wide** in `C:\Users\DELL\.gradle\gradle.properties` (Temurin JDK 17,
Gradle 9.0.0) and outranks any project setting — fix toolchain problems there, never per project; confirm with
`gradlew --version` (`Daemon JVM: … (from org.gradle.java.home)`). Android Studio's Gradle JDK must match it.

**Other projects on this machine:** `D:\Projects\SUMO` holds the separate SumoEats / Sumo Ordering apps.
"The user app" / "the merchant app" mean those, not Fixora. Never change or stop anything of theirs.
