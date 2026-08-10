# FIXORA — Product & Development Roadmap

> **Product:** Fixora
> **Platform:** Multi-Service Marketplace
> **Frontend:** React Native
> **Primary Users:** Customer and Vendor
> **Payment Gateway:** NOT included in Phase 1
> **Status:** Pre-Production Development

---

## ⚠️ PRIME DIRECTIVE — READ BEFORE ANY IMPLEMENTATION

**Do not implement Phase 2 features during Phase 1 unless explicitly approved by the product owner. However, design Phase 1 architecture so Phase 2 features can be plugged in without major rewrites.**

That balance is the whole point of this document.

- Phase 1 is the **launch product**.
- Phase 2 is **not a deadline** — it is a *response to successful Phase 1 validation*.
- The failure mode to avoid: accidentally building half of Phase 2 before launch.

Build a small, excellent Phase 1.

---

## Table of Contents

- [1. Product Overview](#1-product-overview)
- [2. Primary Product Objective](#2-primary-product-objective)
- [3. Application Model](#3-application-model)
- [4. Phase Definitions](#4-phase-definitions)
- [5. Phase 1 — MVP](#5-phase-1--mvp)
- [6–26. Phase 1 Customer Application](#6-phase-1-customer-application)
  - [**7A. Authentication Model**](#7a-authentication-model--approved) — customer OTP, vendor code
  - [**18A. Vendor Selection & Dispatch**](#18a-vendor-selection--dispatch) — directed vs open dispatch
- [27–43. Phase 1 Vendor Application](#27-phase-1-vendor-application)
- [44–55. Shared Frontend Concerns](#44-shared-frontend-features--phase-1)
- [56–58. Success Criteria & Launch](#56-phase-1-success-criteria)
- [59–79. Phase 2](#59-phase-2-objective)
- [80. Phase 1 vs Phase 2 Matrix](#80-phase-1-vs-phase-2)
- [81–87. Development Rules](#81-what-must-not-happen)

---

# 1. PRODUCT OVERVIEW

Fixora is a multi-service marketplace application that connects customers with service vendors.

The platform is **not limited to one service**. The same application must support multiple service categories such as:

- Electrician
- Plumber
- Carpenter
- AC Repair
- Appliance Repair
- Cleaning
- Painting
- Pest Control
- General Home Maintenance
- Future Services

The application must be **category-driven**.

A new service should be added through **backend configuration** rather than requiring a new mobile application or a completely new frontend implementation.

---

# 2. PRIMARY PRODUCT OBJECTIVE

The primary objective of Phase 1 is to **validate the core business workflow**.

```text
Customer needs a service
        ↓
Customer selects service
        ↓
Customer creates request
        ↓
Customer selects a vendor  ── OR ──  leaves it open
        ↓                                   ↓
Request directed to               Request broadcast to
that vendor                       eligible vendors
        ↓                                   ↓
        └──────────────┬────────────────────┘
                       ↓
Vendor receives request
        ↓
Vendor accepts or rejects
   (first accept wins on open dispatch)
        ↓
Vendor performs service
        ↓
Vendor completes request
        ↓
Customer reviews vendor
```

This workflow is the heart of Fixora.

**Everything that does not directly support this workflow is secondary for Phase 1.**

---

# 3. APPLICATION MODEL

The React Native application supports two primary user experiences.

- **Customer** — uses Fixora to request services.
- **Vendor** — uses Fixora to receive and manage service requests.

The application uses **role-based navigation**:

```text
User Login
    ↓
Determine User Role
    ↓
Customer → Customer Application
Vendor   → Vendor Application
```

Customer and Vendor **must not** see each other's navigation or unauthorized functionality.

---

# 4. PHASE DEFINITIONS

## PHASE 1 — MVP / Initial Launch

**Goal:** Validate that customers can request services and vendors can successfully receive and complete those requests.

## PHASE 2 — Growth / Business Expansion

Phase 2 begins **only after** Phase 1 has successfully launched and sufficient real-world feedback has been collected. Phase 2 adds features based on *actual user behaviour* and business requirements.

---

# 5. PHASE 1 — MVP

## 5.1 Phase 1 Objective

The Phase 1 application must be:

- Simple
- Stable
- Fast
- Easy to understand
- Easy to use
- Easy to maintain

**Do not over-engineer Phase 1.**
**Do not build future features just because the architecture can support them.**
**Build only what is required for launch.**

---

# 6. PHASE 1 CUSTOMER APPLICATION

Major areas:

- Authentication
- Home
- Categories
- Sub Categories
- Service Request
- Vendor Selection (optional — see §18A)
- Request Tracking
- Request History
- Profile
- Review

---

# 7. CUSTOMER AUTHENTICATION

## 7.1 Splash Screen

**Purpose:** initialize application, load configuration, check authentication state, determine user role, redirect to correct navigation.

```text
Splash
   ↓
Check Authentication
   ↓
Authenticated?
   ├── Yes → Load Role
   └── No  → Login
```

Splash should be simple. **Do not create unnecessary animation.**

---

# 7A. AUTHENTICATION MODEL — APPROVED

Sections 8, 9 and 28 were written before the authentication mechanism was
settled, so they describe fields generally ("Email / Phone ... Password, per
final backend authentication contract"). **This section is the specific,
approved decision and takes precedence wherever they differ.** Their field lists
remain useful as the record of what a form may collect once profile capture is
designed.

## 7A.1 Customer — phone and one-time code

```text
Phone number → one-time code → verification → authenticated customer session
```

**The delivery channel is a backend concern.** The code travels over WhatsApp
today; it could be SMS or anything else tomorrow. The frontend depends on
exactly two operations and knows nothing about how the code arrives:

```text
requestCustomerOtp(phone)
verifyCustomerOtp(phone, code)
```

> **No WhatsApp or SMS SDK may be added to the React Native application.**
> Naming a provider anywhere in the app makes switching provider a mobile
> release.

## 7A.2 Vendor — phone and permanent vendor code

```text
Vendor registers → admin reviews → admin approves → admin issues vendor code
       → vendor signs in with phone + permanent code
```

**The vendor code is a standing credential.** It never expires, so a leak is
permanent until an administrator reissues it. It must never be:

- written to a log
- included in an error message, user-facing or developer-facing
- persisted anywhere beyond the request that uses it
- attached to analytics events
- included in crash reports

`AppConfig.logging.redactedKeys` already masks `vendorCode`, `otp`, `authCode`,
`password` and `token` at any depth, so `Logger` enforces the first of these
automatically.

## 7A.3 Roles

The session identifies **CUSTOMER** or **VENDOR**, and nothing else.

- There is **no Admin role in the mobile application.** Admin is a separate
  future web application.
- There is **no team-member authentication** in the MVP. Team members are
  records a vendor manages (section 39), not accounts that sign in.

## 7A.4 The backend decides

The frontend never determines whether an account exists, whether a code is
valid, whether a vendor is approved, whether a session is still good, or what a
user is allowed to do. It asks and it renders the answer. The mock simulates
those answers so the UI can be built; simulation never becomes the rule.

---

# 8. CUSTOMER LOGIN

> **Mechanism superseded by section 7A:** customers sign in with a phone number
> and a one-time code. There is no customer password.

**Screen:** Login

**Fields:** Email / Phone (per final backend authentication contract), Password

**Actions:** Login, Forgot Password, Signup

**States:** Default, Loading, Validation Error, Authentication Error, Network Error, Success

**The UI must never freeze during login.**

---

# 9. CUSTOMER SIGNUP

**Screen:** Create Account

Fields depend on the finalized backend contract. Minimum expected:

- First Name
- Last Name
- Email
- Phone
- Password
- Confirm Password

**Actions:** Create Account, Back to Login

```text
Signup → Account Created → Login / Auto Login → Customer Home
```

---

# 10. CUSTOMER HOME

Main customer entry point.

```text
Header
   ↓
Greeting
   ↓
Service Categories
   ↓
Popular / Available Services
   ↓
Recent Requests
```

**Primary action:** Request a Service

The Home screen should immediately communicate: **"What service do you need?"**

---

# 11. CATEGORY SCREEN

Categories come from **backend**. Examples: Electrician, Plumber, Carpenter, AC Repair, Cleaning, Painting.

> **Never hardcode service categories in the mobile application.**

Each category may contain: Icon, Image, Name, Description (if provided).

Category visibility is controlled by backend.

---

# 12. SUB CATEGORY SCREEN

```text
Category → Sub Categories
```

Example — Electrician: Fan Repair, Switch Repair, Light Installation, MCB Repair.

The application must **dynamically render** whatever subcategories the backend returns.

**Do not create service-specific screens** such as `ElectricianScreen` or `PlumberScreen`.

Instead: `CategoryScreen`, `SubCategoryScreen`.

*This is extremely important for scalability.*

---

# 13. SERVICE REQUEST CREATION

One of the most important screens in the entire application.

```text
Category → Sub Category → Request Details → Priority → Images → Notes → Address
                                                                          ↓
                                                          Vendor Selection (optional, §18A)
                                                                          ↓
                                                              Confirmation → Submit Request
```

Vendor selection is **optional**. Skipping it is a first-class path, not an error —
it means "open dispatch" (§18A), and the UI must present it as a normal choice.

---

# 14. REQUEST DETAILS

Customer should provide enough information for the vendor to understand the problem.

**Fields:** Service, Description, Priority, Images, Notes, Address, Preferred Date/Time (if supported by backend)

---

# 15. PRIORITY

Phase 1 priority values: `LOW`, `MEDIUM`, `HIGH`, `EMERGENCY`

- Do not allow arbitrary priority values.
- Priority should come from **backend-supported constants**.
- UI displays human-friendly labels: Low, Medium, High, Emergency.

---

# 16. REQUEST IMAGES

Customer can attach images to help the vendor understand the problem.

**Features:** select from gallery, camera, image preview, remove image, upload state, upload failure state, retry.

The UI must clearly show upload progress or failure.

> **Do not allow the user to believe a request was successfully submitted if required image uploads failed.**

---

# 17. REQUEST NOTES

Customer can add additional information.

> Example: *The fan is making noise and stops after 10 minutes.*

Notes are optional unless the backend marks them required.

---

# 18. CUSTOMER ADDRESS

Customer must provide the service location.

Phase 1 supports: address selection, address display, add address, edit address, delete address, default address.

Future location features (GPS/maps) are added later.

---

# 18A. VENDOR SELECTION & DISPATCH

After the customer has completed the service request details, the customer **may**
select an eligible vendor from a recommended vendor list.

The list represents vendors available for the requested service and area, and may be
ordered according to backend-defined recommendation/rating criteria.

There are exactly two outcomes:

```text
Request details complete
          ↓
   Recommended vendor list
          ↓
   ┌──────┴───────┐
   ↓              ↓
Customer       Customer
selects a      selects
vendor         nothing
   ↓              ↓
DIRECTED       OPEN DISPATCH
Request goes   Backend finds eligible vendors
to that        in the service area and
vendor         broadcasts the request
   ↓              ↓
               First eligible vendor to
               successfully accept wins
                  ↓
          Once assigned, the request is
          no longer available to others
```

## 18A.1 Backend owns all of this

The following are **backend responsibilities**. The frontend must not reimplement,
approximate, or second-guess any of them:

- Vendor eligibility
- Radius / service-area calculation
- Ranking and recommendation order
- Availability
- Assignment
- First-accept-wins enforcement

## 18A.2 The frontend's only job

1. Present the vendor list exactly as the backend returns it
2. Capture the customer's selection, or the absence of one
3. Render the resulting state

> **Never sort, rank, filter, or re-order vendors client-side.**
> **Never compute distance or eligibility client-side.**
> The order the backend returns *is* the recommendation.

## 18A.3 Vendor list item

Display only fields the backend provides — typically: vendor name, rating, review
count, area/distance label, availability, image.

Do not compute or infer any of these.

## 18A.4 Screen states

Standard four states apply (§47), with one critical rule:

| State | Behaviour |
|---|---|
| Loading | Skeleton / loader |
| Success | Render list, selection optional |
| **Empty** | **Must still allow submission via open dispatch** |
| Error | Message + Retry, **and** still allow open dispatch |

> An empty or failed vendor list **must never block request submission.**
> Open dispatch is the fallback that makes the request work anyway.

## 18A.5 Selection is optional

"Skip" / "Any available vendor" must be a **first-class, visible action** — not a
hidden or secondary path. Most customers are expected to use open dispatch.

## 18A.6 Open question — backend contract

Not yet confirmed, and it changes the implementation:

- **Assumed:** vendor selection is captured during creation and sent as an optional
  `vendorId` on the create-request payload (single call).
- **Alternative:** the request is created first, then vendor selection is a second
  call against the created request.

Confirm against the backend contract before building. The UI flow above is the same
either way; only the service layer differs.

---

# 19. REQUEST CONFIRMATION

Before submitting, show a summary: Service, Sub Service, Priority, Description, Images, Address, Preferred Date/Time, **Vendor**.

The vendor row must always be present and must state which dispatch mode applies:

| Customer chose | Confirmation shows |
|---|---|
| A specific vendor | That vendor's name |
| Nothing | **Any available vendor** |

The customer must never reach Submit unsure of whether a vendor was chosen.

```text
Request Created → Request Details
```

Show a clear request identifier/reference.

---

# 20. CUSTOMER REQUEST DETAILS

Primary tracking screen. Displays: Request ID, Service, Sub Service, Priority, Description, Images, Address, Vendor, Current Status, Created Date.

Vendor display depends on dispatch mode (§18A) and assignment state:

| Dispatch | Not yet accepted | Accepted |
|---|---|---|
| **Directed** (customer picked a vendor) | *Waiting for {Vendor Name}* | Vendor Information |
| **Open** (no selection) | *Finding a vendor for you* | Vendor Information |

- The customer should be able to tell whether they are waiting on **one specific
  vendor** or on **open dispatch** — these are different waits with different
  expectations.
- A directed request that the chosen vendor rejects may re-enter open dispatch if
  the backend says so. The frontend reflects backend state; it never re-dispatches
  on its own.

---

# 21. REQUEST STATUS

Phase 1 supported states:

`CREATED`, `PENDING_VENDOR`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `CLOSED`

Alternative states: `REJECTED`, `CANCELLED`, `ON_HOLD`

> **The frontend must never invent statuses.** Statuses come from backend constants/API.

**Dispatch does not add statuses.** Directed and open dispatch (§18A) are *routing*,
not status. Both live under the existing pre-acceptance state (`PENDING_VENDOR` or
whatever the backend returns). If the backend later introduces dispatch-specific
statuses, they come from the backend like every other status — the frontend still
invents nothing.

---

# 22. REQUEST TIMELINE

```text
Request Created
      ↓
Vendor Requested        (directed)
   — or —
Sent to Vendors         (open dispatch)
      ↓
Vendor Accepted / Assigned
      ↓
Work Started
      ↓
Work Completed
      ↓
Review Submitted
```

Each timeline item may contain: Status, Description, Date, Time.

**Timeline is read-only.**

---

# 23. CUSTOMER REQUEST HISTORY

**Screen:** My Requests

**Filters:** All, Active, Completed, Cancelled

Each request card shows: Service, Vendor, Status, Date, Priority.

```text
Request Card → Request Details
```

**Pagination must be supported.**

---

# 24. CUSTOMER REVIEW

Review becomes available **only after** the request reaches the appropriate completed/closed state.

**Screen:** Rate Your Experience

**Fields:** Rating (1–5 stars), Comment, Optional Images (if supported)

> **One request = ONE REVIEW ONLY.**

```text
Review Submitted → Read-only Review
```

---

# 25. CUSTOMER PROFILE

Displays: Profile Image, Name, Email, Phone, Addresses, Logout.

**Actions:** Edit Profile, Change Profile Image, Manage Addresses, Logout

**Future:** Favorites, Saved Services, Settings, Notification Preferences

---

# 26. CUSTOMER NAVIGATION — PHASE 1

**Bottom Tabs:** Home, Requests, Profile

Categories and request creation are **pushed screens**.

```text
Home
 └── Categories
      └── Sub Categories
           └── Create Request
                └── Select Vendor        (optional — skippable, §18A)
                     └── Confirmation
                          └── Request Details

Requests
 └── Request Details

Profile
 ├── Edit Profile
 ├── Addresses
 └── Logout
```

**Keep navigation simple.**

---

# 27. PHASE 1 VENDOR APPLICATION

Vendor focuses on: Requests, Work, Team, Profile, Reports.

---

# 28. VENDOR AUTHENTICATION

> **Mechanism superseded by section 7A:** vendors sign in with a phone number
> and the permanent code issued by an administrator after approval. There is no
> vendor password.

**Screens:** Vendor Login, Vendor Signup

Vendor registration may require: Personal Information, Business Name, Phone, Email, Service Categories, Shop Information, Documents, Shop Images.

The exact required fields must follow the **backend contract**.

---

# 29. VENDOR APPROVAL

```text
Signup → Pending Approval → Admin Review → Approved / Rejected
```

If pending, show: *Your account is under verification.*

Vendor should **not** receive normal service requests until approved.

If rejected, show appropriate status and message.

---

# 30. VENDOR DASHBOARD

Vendor's main screen. Shows: Today's Requests, Pending Requests, Accepted Requests, In Progress, Completed, Rating.

**Quick actions:** View Requests, Team, Profile

Dashboard should prioritize **active work**. Do not overload it with unnecessary analytics during Phase 1.

---

# 31. VENDOR REQUEST LIST

**Tabs/filters:** New, Accepted, In Progress, Completed, Rejected

Each request card: Request ID, Service, Customer, Priority, Date, Status.

**Emergency/high-priority requests should be visually distinguishable.**

## 31.1 The "New" tab contains two kinds of request

| Kind | Origin | Competition |
|---|---|---|
| **Directed** | Customer chose this vendor (§18A) | None — it is theirs to accept or reject |
| **Broadcast** | Open dispatch to all eligible vendors | **Other vendors are competing for it** |

If the backend distinguishes these, the UI should too — a directed request is a much
stronger lead than a broadcast one, and vendors will want to prioritise it.

## 31.2 Broadcast requests are volatile

A broadcast request **can disappear at any moment** because another vendor accepted
it first. This is normal, not an error.

- The list must support **pull-to-refresh** (§9 of the constitution / §46).
- A vanished request must not be presented as a failure or a crash.
- Do not cache the "New" list aggressively enough that vendors act on stale leads.

---

# 32. VENDOR REQUEST DETAILS

Vendor sees: Request ID, Customer Information, Service, Sub Service, Priority, Description, Images, Notes, Address, Preferred Date/Time, Current Status.

Actions depend on current state.

---

# 33. REQUEST APPROVE / REJECT

For a pending request: **Accept**, **Reject**

Reject should require a reason if backend supports it.

> **Never show actions that are invalid for the current status.**
> Example: if already completed, Accept/Reject must not appear.

## 33.1 Accept can legitimately fail — first-accept-wins

On an open-dispatch request, **the vendor may lose the race.** Another eligible vendor
may accept in the moment between this vendor seeing the request and pressing Accept.

This is a normal, expected outcome — **not a bug and not a network error.**

```text
Vendor presses Accept
        ↓
Backend enforces first-accept-wins
        ↓
   ┌────┴─────┐
   ↓          ↓
 Won        Lost
   ↓          ↓
Assigned   "This request has already
to vendor   been assigned to another vendor"
   ↓          ↓
Request    Remove from New list,
Details    return to list
```

Requirements:

- The Accept button must show a **pending state** and be **disabled while in flight**,
  so a vendor cannot double-submit.
- A lost race must produce a **clear, non-alarming message** — never a raw error, never
  a generic "Something went wrong", never a crash.
- After losing, refresh the list so the vendor immediately sees current work.
- The frontend must **never decide** who won. It asks; the backend answers.

> **The frontend must never optimistically mark a request as accepted.**
> Only the backend's confirmed response assigns a request.

---

# 34. VENDOR WORKFLOW

```text
Request arrives
  ├── Directed  (customer chose this vendor)
  └── Broadcast (open dispatch, competing with other vendors)
        ↓
     Accept ──► may fail: another vendor won (§33.1)
        ↓
     Accepted → Start Work → In Progress → Complete Work → Completed
```

The frontend must follow **backend state transitions**.

> **Never allow frontend-only status changes.**
> **Never assume Accept succeeded** — on open dispatch it may not have.

---

# 35. VENDOR START WORK

```text
ACCEPTED → IN_PROGRESS
```

Backend changes status. Frontend refreshes request state.

---

# 36. VENDOR COMPLETE WORK

Required information may include: Completion Notes, Final Amount, Payment Method, Payment Status.

**Phase 1 payment is offline.** The application does **NOT** process the payment. It may *record* payment information.

---

# 37. OFFLINE PAYMENT

**Phase 1: NO PAYMENT GATEWAY.**

Possible recorded methods: Cash, UPI, Bank Transfer, Card, Other. The exact supported methods must follow backend configuration.

The frontend should clearly distinguish:

- **Payment Recorded** ✅
- ~~Payment Processed by Fixora~~ ❌

Fixora does not process online payment during Phase 1.

---

# 38. VENDOR PROFILE

Includes: Business Name, Owner Name, Profile Image, Shop Images, Description, Phone, Email, Service Categories, Working Areas, Working Hours, Availability, Rating.

**Actions:** Edit Profile, Upload Shop Images, Manage Availability, Manage Team

---

# 39. VENDOR TEAM

Vendor can: View Team Members, Add Team Member, Edit Team Member, Disable Team Member, View Team Member.

Basic information: Name, Phone, Designation, Profile Image, Status.

**Phase 1 team management should remain simple.**

---

# 40. TEAM ASSIGNMENT

If backend supports team assignment in Phase 1:

```text
Request → Assign Team Member → Team Member handles work
```

If not required for initial launch, keep the UI architecture ready but **do not expose unnecessary functionality**.

> **Do not build a complex workforce-management system in Phase 1.**

---

# 41. VENDOR REVIEWS

Shows: Average Rating, Total Reviews, Rating Breakdown, Review List.

```text
★★★★★ 80%
★★★★☆ 15%
★★★☆☆  5%
```

**Vendor cannot edit customer reviews.**

---

# 42. VENDOR REPORTS

Phase 1 reports are simple: Total Requests, Completed Requests, Rejected Requests, Cancelled Requests, Average Rating.

Time filters: Today, This Week, This Month.

> **Do not build advanced financial analytics in Phase 1.**

---

# 43. VENDOR NAVIGATION — PHASE 1

**Bottom Tabs:** Dashboard, Requests, Team, Profile

Reports accessed from Dashboard/Profile depending on final UI.

---

# 44. SHARED FRONTEND FEATURES — PHASE 1

Both applications share:

Authentication handling · API client · Error handling · Loading components · Empty states · Image picker · Image preview · Modal · Toast · Confirmation dialog · Theme · Typography · Spacing · Buttons · Inputs · Cards · Status badges · Avatar · Network error handling

> **Do not duplicate these components between roles.**

---

# 45. PHASE 1 DESIGN SYSTEM

Centralized theme:

```text
theme/
  colors
  typography
  spacing
  radius
  shadows
  icons
```

Do not hardcode `color: "#123456"` throughout screens. Use `theme.colors.primary`.

---

# 46. PHASE 1 UX PRINCIPLES

- **Simple** — users should understand what to do immediately
- **Clear** — every action should have clear feedback
- **Consistent** — same component = same behaviour everywhere
- **Forgiving** — confirm destructive actions
- **Responsive** — loading states must be visible
- **Accessible** — readable text, large enough buttons, comfortable touch targets

---

# 47. LOADING STATES

Every API-driven screen must support:

```text
Loading → Success → Empty → Error
```

> **Do not show blank screens.**

---

# 48. EMPTY STATES

- **No Requests:** *You don't have any service requests yet.* → `Request a Service`
- **No Reviews:** *No reviews yet.*
- **No Team Members:** *You haven't added any team members yet.* → `Add Team Member`
- **No Recommended Vendors** (§18A): *No vendors available to show right now. You can still submit — we'll find one for you.* → `Continue`
  This empty state **must not block submission**; it falls through to open dispatch.
- **No New Requests (Vendor):** *No new requests right now.* → pull to refresh

---

# 49. ERROR HANDLING

- **Network error:** *Unable to connect. Please check your internet connection.* → allow **Retry**
- **Authentication error:** redirect appropriately
- **Validation error:** show error beside relevant field
- **Server error:** show friendly message
- **Assignment conflict (§33.1):** *This request has already been assigned to another vendor.* → refresh list

> **Never show raw Axios/server errors to users.**

## 49.1 Not every failure is an error

Two outcomes in the dispatch flow look like errors but are normal business results.
Treating them as errors makes the product feel broken:

| Outcome | Correct treatment |
|---|---|
| Vendor list is empty or fails to load | Continue to open dispatch — **not** a blocker |
| Vendor loses the first-accept race | Informational message + refresh — **not** a failure |

Reserve error styling (red, alarm, retry-only) for genuine faults.

---

# 50. AUTHENTICATION STATE

Centrally manage: Access Token, Current User, Role, Authentication State.

> **Do not duplicate authentication logic inside screens.**

---

# 51. API ARCHITECTURE

> **Screens must never directly call Axios.**

❌ Bad: `axios.get(...)` inside a screen.

✅ Correct:

```text
Screen → Hook / Feature Service → API Service → API Client → Backend
```

The API client centrally manages: Base URL, Headers, Authentication, Errors, Timeouts, Token handling.

---

# 52. PHASE 1 SECURITY

Frontend must never be trusted as the source of authorization. Frontend can *hide* unavailable functionality; backend remains the final authority.

Even if a Customer somehow calls a Vendor API, the backend must reject it.

> **Frontend security is for UX. Backend security is actual security.**

---

# 53. PHASE 1 PERFORMANCE

Use: FlatList, FlashList (if approved), image optimization, pagination, lazy loading, memoization where useful, stable callbacks where required.

> **Avoid premature optimization. Measure before optimizing complex rendering.**

---

# 54. PHASE 1 ANALYTICS

Only essential events.

**Customer:** `app_opened`, `signup_completed`, `login_completed`, `category_selected`, `subcategory_selected`, `request_started`, `vendor_selected`, `vendor_selection_skipped`, `request_created`, `request_completed`, `review_submitted`

**Vendor:** `vendor_signup`, `vendor_approved`, `request_viewed`, `request_accepted`, `request_rejected`, `request_accept_lost`, `work_started`, `work_completed`

The three dispatch events matter disproportionately for §58 (deciding Phase 2):
`vendor_selected` vs `vendor_selection_skipped` reveals whether customers actually
want to choose a vendor, and `request_accept_lost` reveals how contested open
dispatch really is.

> **Analytics implementation must not interfere with business operations.**

---

# 55. PHASE 1 NOT INCLUDED

Do **NOT** build these unless explicitly requested:

Online Payment · Wallet · Coupons · Referral System · Subscription · Chat · Live Tracking · AI Assistant · Advanced Search · Loyalty Program · Complex Vendor Earnings · Complex Workforce Management · Multi-country · Multi-language · Advanced Recommendation Engine

*These belong to later phases.*

---

# 56. PHASE 1 SUCCESS CRITERIA

**A real customer can:**

```text
Install App → Create Account → Login → Browse Service → Select Sub Service
→ Create Request → Upload Images → Provide Address
→ Select a Vendor OR skip to open dispatch
→ Submit → Track Request → See Vendor
→ Receive Completed Service → Submit Review
```

**Both dispatch paths must work end-to-end:**

```text
Directed:      Customer picks vendor → that vendor receives it → accepts → service
Open dispatch: Customer skips        → eligible vendors receive it
                                     → first to accept wins → service
```

**A real vendor can:**

```text
Register → Complete Profile → Get Approved → Login
→ Receive Request (directed or broadcast) → View Request
→ Accept / Reject  (and survive losing an open-dispatch race)
→ Start Work → Complete Work
→ Record Offline Payment → Receive Review → View Basic Reports
```

If these workflows work reliably, **Phase 1 has achieved its goal**.

---

# 57. PHASE 1 LAUNCH CHECKLIST

**Customer**
- [ ] Signup
- [ ] Login
- [ ] Profile
- [ ] Categories
- [ ] Sub Categories
- [ ] Request Creation
- [ ] Image Upload
- [ ] Address
- [ ] Vendor Selection (list, select, **skip**)
- [ ] Vendor list empty/error still allows submission
- [ ] Request Tracking
- [ ] Request History
- [ ] Review

**Vendor**
- [ ] Signup
- [ ] Login
- [ ] Approval Status
- [ ] Dashboard
- [ ] Profile
- [ ] Shop Images
- [ ] Request List (directed vs broadcast)
- [ ] Request Details
- [ ] Accept
- [ ] Accept-lost (first-accept-wins) handled gracefully
- [ ] Reject
- [ ] Start Work
- [ ] Complete Work
- [ ] Team
- [ ] Reviews
- [ ] Reports

**Shared**
- [ ] Authentication
- [ ] API Handling
- [ ] Error Handling
- [ ] Loading States
- [ ] Empty States
- [ ] Network Errors
- [ ] Image Handling
- [ ] Notifications
- [ ] Analytics
- [ ] Crash Handling

---

# 58. AFTER PHASE 1 LAUNCH

> **Do NOT immediately start building every Phase 2 feature. First collect real-world feedback.**

Observe: How many customers register? How many create requests? Where do customers abandon? How quickly do vendors respond? How many requests are rejected? How many completed? How many reviews submitted? Which categories are most popular? Which screens cause confusion? Which vendor workflows are difficult?

**Use real data to decide Phase 2 priorities.**

---

# 59. PHASE 2 OBJECTIVE

Phase 2 transforms Fixora from a basic request-management MVP into a stronger marketplace platform, focusing on: Monetization, Retention, Communication, Automation, Vendor productivity, Customer convenience, Marketplace intelligence.

---

# 60. PHASE 2 — CUSTOMER FEATURES

**Advanced Home:** personalized services, popular services, recently used services, recommended vendors, promotional sections, search.

# 61. PHASE 2 SEARCH

Search across Categories, Sub Categories, Vendors.

# 62. PHASE 2 FAVORITES

Favorite Vendors, Favorite Services.

# 63. PHASE 2 MULTIPLE ADDRESSES

Home / Office / Other, map selection, GPS coordinates, current location.

# 64. PHASE 2 CHAT

Text, images, read status, typing indicator, timestamps. **Chat must be request-specific.**

```text
Request #12345 → Customer ↔ Vendor
```

# 65. PHASE 2 LIVE TRACKING

```text
Vendor Accepted → Vendor En Route → Live Location → Customer Arrival
```

Requires location permissions and backend real-time infrastructure. **Do not implement during Phase 1.**

# 66. PHASE 2 ONLINE PAYMENTS

```text
Service Completed → Invoice / Amount → Payment → Gateway → Payment Success → Receipt
```

Future methods: UPI, Cards, Net Banking, Wallets, other gateway-supported methods.

Payment architecture must be designed carefully — it introduces financial and reconciliation requirements.

# 67. PHASE 2 INVOICES

View: Invoice, Service, Vendor, Amount, Taxes, Discount, Payment Status, Date. Actions: View, Download, Share.

# 68. PHASE 2 VENDOR EARNINGS

Total Earnings, Pending Amount, Paid Amount, Completed Jobs, Average Job Value. Only after payment handling is properly defined.

# 69. PHASE 2 VENDOR SUBSCRIPTIONS

Plans: Free, Basic, Professional, Premium. Benefits: more leads, featured listing, better visibility, reports, priority support.

# 70. PHASE 2 COUPONS

Coupon Code, Discount, Expiry, Minimum Order, Applicable Services. **Coupon validation remains backend-controlled.**

# 71. PHASE 2 REFERRALS

```text
Invite Friend → Friend Registers → Friend Completes First Service → Referral Reward
```

# 72. PHASE 2 NOTIFICATIONS

Push, Email, SMS, WhatsApp. Customer notifications: Vendor Assigned, Vendor En Route, Service Reminder, Payment Reminder, Invoice, Promotional.

# 73. PHASE 2 CUSTOMER RETENTION

Service history, rebook service, favorite vendor, favorite service, repeat request, maintenance reminders, personalized recommendations.

# 74. PHASE 2 AI FEATURES

Only where it provides measurable value:

- **Service Recommendation** — customer describes *"My AC is not cooling"* → AI suggests *AC Repair*
- **Request Description Assistance**
- **Vendor Assistance** — summarize customer issue → recommended action
- **Customer Support** — answer common questions

> **AI must never make unauthorized business decisions.**

# 75. PHASE 2 MULTI-LANGUAGE

Potential: English, Hindi, Gujarati.

The frontend architecture should be **localization-ready from Phase 1**, but full translation need not be implemented before launch unless required.

> **Never hardcode user-facing strings directly into complex components.**

# 76. PHASE 2 MULTI-COUNTRY

Multiple currencies, countries, regions, country-specific services, localized addresses, localized payment methods. Long-term. **Do not implement prematurely.**

# 77. PHASE 2 ADVANCED VENDOR MANAGEMENT

Multiple team members, team assignment, team availability, job assignment, performance, attendance, work history, earnings, staff management.

> **The MVP should not become a full HR/workforce-management application.**

# 78. PHASE 2 BUSINESS INTELLIGENCE

- **Customer:** Services Used, Spending, Frequency, Favorite Services
- **Vendor:** Requests, Completion Rate, Acceptance Rate, Rating, Earnings
- **Admin:** Customers, Vendors, Requests, Revenue, Growth, Categories, Conversion

# 79. PHASE 2 PRODUCT GOAL

Fixora evolves from **Request Management App** into **Full Service Marketplace**.

```text
Customer → Discover Service → Find Vendor → Request → Communicate
        → Receive Service → Pay → Review → Return

Vendor   → Receive Leads → Manage Jobs → Manage Team → Complete Jobs
        → Receive Payment → Build Reputation → Grow Business
```

---

# 80. PHASE 1 VS PHASE 2

| Feature | Phase 1 | Phase 2 |
|---|---|---|
| Customer Signup | ✅ | Improve |
| Customer Login | ✅ | Improve |
| Vendor Signup | ✅ | Improve |
| Vendor Approval | ✅ | Improve |
| Categories | ✅ | Search/Recommendation |
| Sub Categories | ✅ | Improve |
| Request Creation | ✅ | Advanced |
| Vendor Selection (from recommended list) | ✅ | Advanced ranking/filters |
| Open Dispatch (broadcast, first-accept-wins) | ✅ | Smart/auto assignment |
| Priority | ✅ | Advanced |
| Images | ✅ | Advanced Media |
| Address | ✅ | GPS/Maps |
| Request Tracking | ✅ | Live Tracking |
| Vendor Accept/Reject | ✅ | Smart Assignment |
| Vendor ranking / eligibility logic | Backend-owned | Backend-owned |
| Work Status | ✅ | Advanced Workflow |
| Offline Payment Record | ✅ | — |
| Online Payment | ❌ | ✅ |
| Reviews | ✅ | Advanced |
| Team | Basic | Advanced |
| Reports | Basic | Advanced |
| Notifications | Basic | Multi-channel |
| Chat | ❌ | ✅ |
| Search | Basic/Optional | ✅ |
| Favorites | ❌ | ✅ |
| Coupons | ❌ | ✅ |
| Referral | ❌ | ✅ |
| Wallet | ❌ | ✅ |
| Invoices | ❌ | ✅ |
| Vendor Subscription | ❌ | ✅ |
| AI | ❌ | ✅ |
| Multi-language | Prepared | ✅ |
| Multi-country | ❌ | Future |

---

# 81. WHAT MUST NOT HAPPEN

**Do not turn Phase 1 into Phase 2.**

Do not implement: Payment gateway · Wallet · Chat · Live tracking · AI · Subscription · Coupons · Referral · Complex analytics

— unless explicitly approved.

*The goal is to launch quickly with a reliable core workflow.*

---

# 82. FRONTEND DEVELOPMENT PRINCIPLE

**Build Phase 1 so Phase 2 can be added. Do NOT build Phase 2 now.**

| ✅ Good | ❌ Bad |
|---|---|
| `PaymentService` can be added later | Building complete payment infrastructure before Phase 1 has users |
| `NotificationService` supports future providers | Building SMS + WhatsApp + Email + Push infrastructure when only basic push is required |

---

# 83. FRONTEND ARCHITECTURE PRINCIPLE

Phase 1 provides strong foundations: Theme · Navigation · API Client · Authentication · Storage · Error Handling · Components · Forms · Image Handling · Notifications · Analytics · Feature Modules

**Future features plug into these foundations.**

---

# 84. DEVELOPMENT ORDER

### Stage 1 — Foundation
```text
React Native Setup → Theme → Navigation → API Client
→ Authentication State → Reusable Components → Error Handling
```

### Stage 2 — Authentication
```text
Splash → Login → Signup → Role Detection → Customer/Vendor Navigation
```

### Stage 3 — Customer
```text
Home → Categories → Sub Categories → Create Request → Request Details
→ Request History → Review → Profile
```

### Stage 4 — Vendor
```text
Vendor Dashboard → Requests → Request Details → Accept/Reject
→ Start Work → Complete Work → Team → Reviews → Reports → Profile
```

### Stage 5 — Stabilization
```text
Error Handling → Loading States → Empty States → Network Handling
→ Performance → Analytics → Crash Monitoring → Release Testing
```

---

# 85. PHASE 1 RELEASE CRITERIA

> **Do not consider the app complete because all screens exist.**

Phase 1 is complete only when complete workflows work **end-to-end**:

- **Customer:** Signup → Login → Browse → Request → Upload → *Select Vendor or Skip* → Submit → Track → Review
- **Vendor:** Signup → Approval → Login → Receive → Accept → Start → Complete → Review

**Both dispatch paths must be verified, not just the happy one:**

- [ ] Directed request reaches the chosen vendor
- [ ] Skipped selection broadcasts and is accepted by an eligible vendor
- [ ] A second vendor attempting to accept an already-assigned request is handled
      gracefully (§33.1)
- [ ] Vendor list empty / failing does not block submission

The app must work with **real backend APIs**.

> **No fake/mock data should remain in production builds unless intentionally required.**

---

# 86. CLAUDE CODE DEVELOPMENT RULE

Before implementing any feature:

1. Read `AGENTS.md`
2. Read `PROJECT_BIBLE.md` (this file)
3. Read relevant backend/API documentation
4. Inspect existing frontend code
5. Identify reusable components
6. Explain the implementation plan
7. **Wait for approval if the change is architectural**
8. Implement the smallest complete feature
9. Test the workflow
10. Report changed files and remaining issues

> **Never rewrite large parts of the application without approval.**

---

# 87. FINAL PRODUCT VISION

- **Fixora Phase 1:** a reliable service-request platform
- **Fixora Phase 2:** a complete service marketplace

```text
Customer → Discover → Request → Vendor → Communicate
        → Service → Payment → Review → Repeat

Vendor → Receive Leads → Manage Jobs → Manage Team
      → Complete Work → Get Paid → Build Reputation → Grow Business
```

**The application should remain simple for users even as the underlying platform becomes more powerful.**

---

*END OF FIXORA FRONTEND ROADMAP*
