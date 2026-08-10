# Fixora — Branching Strategy

This repository follows **Git Flow**. This document is the authority on branch
naming, commit format, and merge rules. Read it before opening a pull request.

---

## 1. Branch Model

### Long-lived branches

These two always exist and are never deleted.

| Branch | Purpose | Deploys to | Accepts merges from |
|---|---|---|---|
| `main` | Production. Every commit is a shippable, tagged release. | Production | `release/*`, `hotfix/*` |
| `develop` | Integration. The current state of the next release. | QA / internal builds | `feature/*`, `bugfix/*`, `release/*`, `hotfix/*` |

> **Never commit directly to `main` or `develop`.** All changes arrive by pull request.

### Short-lived branches

Created on demand, **deleted immediately after merge**. Stale branches are clutter.

| Prefix | Branches from | Merges into | Purpose |
|---|---|---|---|
| `feature/` | `develop` | `develop` | New functionality |
| `bugfix/` | `develop` | `develop` | Defect found in `develop` (not yet released) |
| `release/` | `develop` | `main` **and** `develop` | Stabilise a version for launch |
| `hotfix/` | `main` | `main` **and** `develop` | Urgent fix to live production |
| `chore/` | `develop` | `develop` | Tooling, CI, dependencies, config |
| `docs/` | `develop` | `develop` | Documentation only |

---

## 2. Flow

```text
main ────●──────────────────────────●───────────────●──────►
         │ v1.0.0                   │ v1.0.1        │ v1.1.0
         │                          │               │
         │                     hotfix/1.0.1         │
         │                          │               │
develop ─┴──●────●────●─────────────┴──●────●───────┴──────►
             │    │    │                 │    │
      feature/…  │  bugfix/…       feature/…  │
                 │                            │
           feature/…                    release/1.1.0
```

**Golden rule:** a `hotfix` or `release` merged into `main` must **also** be merged
back into `develop`, or the fix is lost in the next release.

---

## 3. Naming Convention

```text
<type>/<ticket-id>-<short-kebab-description>
```

Examples:

```text
feature/FIX-101-vendor-selection-screen
feature/FIX-118-request-image-upload
bugfix/FIX-204-empty-vendor-list-blocks-submit
release/1.0.0
hotfix/1.0.1-login-crash-on-android-14
chore/FIX-090-upgrade-gradle-wrapper
docs/FIX-077-branching-strategy
```

Rules:

- Lowercase, hyphen-separated. No spaces, no underscores, no camelCase.
- Include the ticket ID where one exists — it links code to the tracker.
- Keep it under ~60 characters. The branch name is not the commit body.
- `release/` and `hotfix/` use the **version number**, not a ticket ID.

---

## 4. Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/). This keeps history
readable and makes changelog generation possible later.

```text
<type>(<scope>): <subject>

<body — what and why, not how>

<footer — breaking changes, ticket refs>
```

| Type | Use for |
|---|---|
| `feat` | New user-facing capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting; no behaviour change |
| `refactor` | Restructure; no behaviour change |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `build` | Build system, native config, dependencies |
| `ci` | CI configuration |
| `chore` | Housekeeping |
| `revert` | Reverts a previous commit |

Subject line: imperative mood, lowercase, no trailing period, ≤ 72 characters.

✅ `feat(request): add vendor selection screen`
❌ `Added vendor selection screen.`

---

## 5. Pull Requests

A PR must:

1. Target the correct branch (`develop` for features/bugfixes; `main` only for `release/*` and `hotfix/*`)
2. Have a descriptive title in Conventional Commit format
3. Explain **what** changed and **why**
4. Link its ticket
5. Pass lint, type-check and tests
6. Be reviewed and approved before merge

**Definition of Done** for a feature is in `CLAUDE.md` section 20, and the product
scope rules are in `PROJECT_BIBLE.md`. A PR that adds a Phase 2 feature during
Phase 1 should be rejected unless the product owner has explicitly approved it.

### Merge strategy

| Merging | Strategy | Why |
|---|---|---|
| `feature/*` → `develop` | **Squash** | One clean commit per unit of work |
| `release/*` → `main` | **Merge commit** (no fast-forward) | Preserves the release point |
| `hotfix/*` → `main` | **Merge commit** (no fast-forward) | Preserves the fix point |
| `main` → `develop` (back-merge) | **Merge commit** | Keeps branches in sync |

Delete the source branch after merge.

---

## 6. Versioning

[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

- **MAJOR** — breaking change to a published contract
- **MINOR** — backwards-compatible functionality (typical Phase 1 → Phase 2 features)
- **PATCH** — backwards-compatible bug fix (typical hotfix)

Every merge into `main` is tagged:

```bash
git tag -a v1.0.0 -m "Release 1.0.0 — Phase 1 MVP"
git push origin v1.0.0
```

Keep the app version in `android/app/build.gradle` (`versionName`/`versionCode`)
in step with the tag.

---

## 7. Release Process

```bash
# 1. Cut the release branch from develop
git checkout develop && git pull
git checkout -b release/1.0.0

# 2. Stabilise: bump version, fix release blockers only.
#    No new features on a release branch.

# 3. Merge to main and tag
git checkout main && git merge --no-ff release/1.0.0
git tag -a v1.0.0 -m "Release 1.0.0 — Phase 1 MVP"

# 4. Back-merge so develop keeps the stabilisation work
git checkout develop && git merge --no-ff release/1.0.0

# 5. Push everything, then delete the release branch
git push origin main develop --tags
git branch -d release/1.0.0 && git push origin --delete release/1.0.0
```

---

## 8. Hotfix Process

```bash
git checkout main && git pull
git checkout -b hotfix/1.0.1-login-crash

# fix, bump PATCH version, commit

git checkout main && git merge --no-ff hotfix/1.0.1-login-crash
git tag -a v1.0.1 -m "Hotfix 1.0.1 — login crash"

git checkout develop && git merge --no-ff hotfix/1.0.1-login-crash

git push origin main develop --tags
```

> Forgetting the back-merge into `develop` means the next release silently
> reintroduces the bug. This is the most common Git Flow mistake.

---

## 9. Recommended Branch Protection

Configure in **GitHub → Settings → Branches**. These are repo settings, not files,
so they must be enabled by a repo admin:

**`main`**
- Require a pull request before merging (≥ 1 approval)
- Require status checks to pass
- Require branches to be up to date before merging
- Restrict who can push
- Do not allow force pushes or deletions

**`develop`**
- Require a pull request before merging (≥ 1 approval)
- Require status checks to pass
- Do not allow force pushes or deletions

---

## 10. Current State

| Branch | Status |
|---|---|
| `main` | Phase 1 foundation — pre-production |
| `develop` | Active integration branch — **branch your work from here** |
| `release/1.0.0` | Phase 1 MVP launch train |

Phase 1 scope is defined in [`PROJECT_BIBLE.md`](../PROJECT_BIBLE.md).
Engineering standards are in [`CLAUDE.md`](../CLAUDE.md).
