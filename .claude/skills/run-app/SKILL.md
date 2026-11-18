---
name: run-app
description: Start Fixora on the Fixora_Pixel7 emulator with Metro on port 8085 and confirm the app actually opens. Use when the user asks to run, start or open the Fixora app, or after a native/Gradle change that needs a rebuild.
---

# Run Fixora

Only run this when the user asks, or right after a native/build-config change (CLAUDE.md §9). Never kill
another project's Metro or emulator — `D:\Projects\SUMO` apps use ports 8081–8084.

## 1. What is already running?

```powershell
Get-NetTCPConnection -LocalPort 8085 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)").CommandLine }
```
```bash
adb devices -l
```

If Fixora's Metro (command line in `D:\kano\Fixora`) is already listening on 8085, reuse it. If something else
holds 8085, stop and ask.

## 2. Emulator (only if no device is listed)

```powershell
# Interactive run (the user wants to use the app): the device screen shows, the log console stays hidden.
Start-Process "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" `
  -ArgumentList '-avd','Fixora_Pixel7','-no-snapshot-load','-no-boot-anim','-gpu','swiftshader_indirect' `
  -WindowStyle Hidden
# Verification-only run: add '-no-window' to the argument list as well.
```

Wait for boot without a fixed sleep: poll `adb shell getprop sys.boot_completed` until it prints `1`.

## 3. Metro — its own visible window, from the repo root

```powershell
Start-Process "cmd.exe" -ArgumentList '/k','title Metro - Fixora && npx react-native start' -WorkingDirectory "D:\kano\Fixora"
```

`metro.config.js` sets port 8085, so no `--port` flag is needed. Confirm it is up:
`curl -s http://localhost:8085/status` must print `packager-status:running`.

## 4. Build (only if native/Gradle code changed or no debug APK exists), install, launch

```powershell
Remove-Item Env:\NoDefaultCurrentDirectoryInExePath -ErrorAction SilentlyContinue; Set-Location D:\kano\Fixora\android; .\gradlew.bat assembleDebug -q
```
```bash
cd /d/kano/Fixora
adb reverse tcp:8085 tcp:8085
adb reverse tcp:5000 tcp:5000   # the backend (sign in and categories are live); see WORKING_NOTES section 5
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.fixora/.MainActivity
```

## 5. Confirm it really opened — never end before this

```bash
adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" | head -2   # must show com.fixora
MSYS_NO_PATHCONV=1 adb shell screencap -p /sdcard/fixora.png && MSYS_NO_PATHCONV=1 adb pull /sdcard/fixora.png "$TEMP/fixora.png"
```

Look at the screenshot: a real Fixora screen, not a red error box and not "Unable to load script" (that means
the app is looking for Metro on the wrong port — check `adb reverse` and that Metro is on 8085).

Sign in and the category lists need the backend: `curl -s http://127.0.0.1:5000/api/v1/health` on this machine
must print `"success":true`, and `adb reverse --list` must show `tcp:5000`. If sign in or the categories answer
"No internet connection", one of the two is missing. Never start, stop or edit the backend unless asked — it is
another person's code (`D:\kano\Fixora-Backend`).

Tell the user which windows are open: "Metro - Fixora" (keep it open), and the emulator screen if interactive.
