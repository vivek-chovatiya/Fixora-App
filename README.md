# Fixora — Mobile App (React Native)

Customer and vendor app for the Fixora multi-service marketplace (Phase 1).
Product scope: [`PROJECT_BIBLE.md`](PROJECT_BIBLE.md). Engineering rules: [`CLAUDE.md`](CLAUDE.md).

## Run it

1. Start the backend (see `../Backend/README.md`): MongoDB running, then `npm run seed` and `npm run dev` in `Backend/`.
2. In this folder:

```sh
npm install
npm start            # Metro
npm run android      # Android emulator / device
npm run web          # browser build on http://localhost:3000 (react-native-web)
```

The API host is set in [`src/core/config/AppConfig.ts`](src/core/config/AppConfig.ts):
`10.0.2.2:5000` on the Android emulator, `localhost:5000` on iOS simulator and web.
For a **physical phone**, change `DEV_API_HOST` to your computer's LAN IP.

After adding native dependencies (AsyncStorage, image picker, vector-icon fonts),
rebuild the native app once with `npm run android`.

Demo logins are listed in `../Backend/README.md` (password `Password123!`).
The login screen has a "Platform admin? Log in here" link for `admin@fixora.com`.

## Structure

```text
src/
  app/            AppRoot + role-based navigation (Auth / Customer / Vendor / Admin)
  core/           config, HTTP client, logger, session storage
  features/
    auth/         AuthProvider (single owner of token/user/role) + login/signup/reset
    customer/     home, categories, request creation, vendor selection, tracking, review, profile, addresses
    vendor/       approval gate, dashboard, requests, request detail, complete work, team, profile, reviews, reports
    admin/        vendor approvals, categories
    requests/     shared request presentation (status tones, cards, timeline, vendor panel)
    catalog/      generic category tiles (no service-specific screens)
    account/      notifications, change password, header bell
  shared/
    components/   design-system components (buttons, fields, cards, states, dialogs, toasts, uploader…)
    hooks/        useServiceQuery, usePaginatedQuery, useServiceMutation, useImageUploads, useAppMeta…
    services/api/ the only layer that calls the backend
    theme/        tokens — no hardcoded colours/spacing in screens
```

Data flow: **Screen → hook → `shared/services/api` → `core/http/HttpClient` → backend.**

## Rules the app follows (from the bible)

- Categories, sub-categories, priorities and payment methods come from the backend.
- Vendor recommendations are rendered exactly in backend order; "Any available vendor" is a first-class choice, and an empty or failed vendor list never blocks submission.
- Status changes are never optimistic. Valid actions come from the backend's `allowedActions`.
- Losing an open-dispatch race shows "This request has already been assigned to another vendor." and refreshes the list. It is not shown as an error.
- Payment is recorded, not processed (no gateway in Phase 1).
