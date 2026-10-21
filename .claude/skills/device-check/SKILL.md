---
name: device-check
description: Verify a finished Fixora slice on the emulator in one 1080x2400 Dark pass (functional and visual; small screens by calculation), measuring rather than eyeballing. Use when a slice reaches "device verification", or the user asks to test a screen on the device.
---

# Fixora device verification

Nothing is done until it has run on the emulator (CLAUDE.md §10). Run headless (`-no-window`, see the
`run-app` skill) unless the user wants to watch. Full recipes: `docs/WORKING_NOTES.md` §6.

## Setup

```bash
cd /d/kano/Fixora && source .uitap.sh          # gives: dump, tapnode "<exact text or content-desc>"
adb shell pm clear com.fixora                   # only when the check needs a fresh install state
adb logcat -c                                   # before any action you want to measure
```

Always read the screen (`dump`) right before tapping — never tap from an old position.

## One pass — 1080×2400 Dark (owner, 21/10/2026)

`adb shell cmd uimode night yes`, `adb shell wm size reset && adb shell wm density reset`, relaunch
(`adb shell am start -n com.fixora/.MainActivity`). Walk the whole slice workflow: every state (loading, empty,
error, retry, success), dialogs, long text, Android back, no accidental navigation, no crash — and look at
contrast, hierarchy, borders, icons and disabled states while there.

Small screens are covered by calculation, not a device test: no fixed widths, and for any row of text measure
its node `bounds` here (÷ 2.625 for dp) and work out whether a 360dp width still fits it. Light is not a
separate pass. The code must still suit every size and both modes (theme tokens only).

## Evidence rules

- **Measure, don't eyeball.** Before calling text clipped, read the node `bounds` from `dump` and divide by the
  density factor (420 dpi → ÷ 2.625). Downscaled screenshots fake truncation.
- **Prove retry by counting:** `adb logcat -c`, tap retry, then `adb logcat -d | grep -c "query failed"`.
- **Every accessible name on screen:**
  `dump | tr '<' '\n<' | grep -oE 'content-desc="[^"]+"' | sort -u`
- **Forced failures:** set `AppConfig.mock.failureRate` to 1, or patch one mock to throw and mark it
  `// TEMPORARY-VERIFICATION-ONLY`. Copy the file to `.bak` first, restore it after, then
  `grep -rn "TEMPORARY-VERIFICATION" src/` must print nothing.
- Screenshots: `MSYS_NO_PATHCONV=1 adb shell screencap -p /sdcard/s.png && MSYS_NO_PATHCONV=1 adb pull /sdcard/s.png "$TEMP/s.png"`.
- A red LogBox after a forced failure is the dev logger in a debug build, not a leak — check which node owns
  the text.

## Finish

Reset the emulator: `adb shell wm size reset && adb shell wm density reset && adb shell cmd uimode night no`.
Report the pass listing every state verified and every defect with the screen, the step and the measured
evidence.
