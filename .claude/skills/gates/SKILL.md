---
name: gates
description: Run Fixora's five quality gates (type-check, lint, tests, release bundle, Android debug build) and report each result against the baseline. Use when the user says "run the gates", "check everything", before calling a slice done, or before a commit.
---

# Fixora — the five gates

All five must pass before a slice is called done (CLAUDE.md §8). Run them from the repo root,
`D:/kano/Fixora`, in this order. Run every gate even if an earlier one fails, so the report is complete —
except stop before gate 5 if gate 1 fails (a type error will fail the build too, and it takes minutes).

## Commands (Git Bash)

```bash
cd /d/kano/Fixora
npx tsc --noEmit 2>&1 | tail -20                       # gate 1: must be 0 errors
npx eslint src __tests__ --ext .ts,.tsx 2>&1 | tail -15  # gate 2: 0 errors, warnings <= baseline
npx jest --silent 2>&1 | tail -25                      # gate 3: all suites green
npx react-native bundle --platform android --dev false --entry-file index.js \
  --bundle-output "$TEMP/fixora-bundle-check.js" --assets-dest "$TEMP/fixora-assets-check" 2>&1 | tail -5   # gate 4
```

Gate 5 is slow (minutes) — run it in the background and wait for it, never with a fixed sleep:

```bash
cd /d/kano/Fixora/android && ./gradlew assembleDebug -q; echo "gradle exit: $?"   # gate 5: exit 0
```

If a build launched from PowerShell says `'gradlew.bat' is not recognized`, the wrapper is fine: the Claude
shell has `NoDefaultCurrentDirectoryInExePath` set. Prefix the command with
`Remove-Item Env:\NoDefaultCurrentDirectoryInExePath -ErrorAction SilentlyContinue;` — never edit the user's
environment variables.

## Baseline

Read the live lint baseline from `docs/WORKING_NOTES.md` §5 (`grep -n "Known lint baseline" docs/WORKING_NOTES.md`).
Only `no-void` warnings are allowed, and their count must not rise. A **new** warning of any other rule, or one
more `no-void`, is a failure even though eslint exits 0.

## Report

| Gate | Result | Detail |
|---|---|---|
| 1 Type-check | PASS / FAIL | n errors (first 3 with file:line) |
| 2 Lint | PASS / FAIL | errors, warnings vs baseline |
| 3 Tests | PASS / FAIL | suites and tests passed/failed; name each failing test |
| 4 Bundle | PASS / FAIL | — |
| 5 Debug build | PASS / FAIL | exit code; first error line |

Then one line: "All five gates pass" or exactly which gate blocks the slice and the cause. Report what was
observed — never "should pass".
