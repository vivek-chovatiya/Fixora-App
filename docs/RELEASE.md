# Fixora — Android Release

How to sign, version and build Fixora for the Play Store, and what to check
before a build goes anywhere. Branching, tagging and the release branch itself
are in `docs/BRANCHING.md`; this document starts where that one hands over a
commit to build.

> **No store submission without the owner's explicit approval** (sprint plan H4).
> Building and testing a signed release is fine; uploading it is not, until approved.

---

## 1. The upload key

Google Play signs the app users install with its own **app signing key** (Play App
Signing, which every new app uses). We sign each upload with our **upload key**,
which is how Play knows an upload came from us.

### Create it — once, ever

Run this from PowerShell. `keytool` ships with the JDK; use the one in the Temurin
JDK 17 that `C:\Users\DELL\.gradle\gradle.properties` pins (`org.gradle.java.home`
→ `bin\keytool.exe`), or Android Studio's (`jbr\bin\keytool.exe`).

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.fixora-keys"
keytool -genkeypair -v -storetype PKCS12 `
  -keystore "$env:USERPROFILE\.fixora-keys\fixora-upload.p12" `
  -alias fixora-upload -keyalg RSA -keysize 2048 -validity 10000
```

- It asks for a password and for name and organisation details. Type the password
  at the prompt — never on the command line, where it lands in shell history.
- PKCS12 has **one password for the store and the key**. keytool does not ask for
  a separate key password; use the same one for both properties below.
- 10000 days is about 27 years; Android's guidance is a key valid for at least 25.

### Keep it — outside the repository, backed up

- The `.p12` file lives **outside the repo** (`%USERPROFILE%\.fixora-keys\` above).
  `android/app/debug.keystore` is the only keystore that belongs in git: its
  password is public, which is why it can only sign debug builds.
- Back up **both the file and the password**, separately: the password in a
  password manager, the file in an encrypted backup that is not on this machine.
- ⚠️ **Treat a lost upload key as losing the ability to update the app.** With
  Play App Signing, Google can reset an upload key after a request from the
  account owner, but it takes days and blocks every update meanwhile; without
  Play App Signing there is no recovery at all. A leaked key must be reported and
  reset the same way.

### Tell Gradle where it is — four properties, machine-wide

Add these to `C:\Users\<you>\.gradle\gradle.properties` — the machine-wide file
that also pins the JDK. Never to `android/gradle.properties`, `local.properties` or
any other file in the repo.

```properties
FIXORA_UPLOAD_STORE_FILE=C:/Users/<you>/.fixora-keys/fixora-upload.p12
FIXORA_UPLOAD_STORE_PASSWORD=<the password typed at the keytool prompt>
FIXORA_UPLOAD_KEY_ALIAS=fixora-upload
FIXORA_UPLOAD_KEY_PASSWORD=<the same password>
```

- Forward slashes in the path: a backslash is an escape character in a
  `.properties` file.
- The `FIXORA_` prefix keeps them apart from the SUMO projects that read the same file.
- A CI machine can supply the same four as environment variables named
  `ORG_GRADLE_PROJECT_FIXORA_UPLOAD_STORE_FILE` and so on; Gradle reads those as
  the same properties.

### What the build does with them

`android/app/build.gradle` ("Release signing") signs release builds with the upload
key when **all four** are set. When any is missing:

- `bundleRelease` **fails before building anything**, naming the missing
  properties. An App Bundle is only for the Play Store, and Play rejects one signed
  with the debug key.
- `assembleRelease` signs the APK with the debug key, so a release build still
  installs for testing, and prints (even with `-q`):

```
WARNING: this Fixora release APK is signed with the DEBUG key.
  The Play Store will not accept it. Use it only for testing on a device.
  Missing Gradle properties: …
```

Only the names of missing properties are printed, never a value. If the path is set
but the file is not there, the build fails rather than falling back — a typo must
not quietly produce a debug-signed "release".

Check which key a build will use without building it:

```bash
cd android && ./gradlew :app:signingReport
```

Under `Variant: release`, `Config: release` with your `.p12` as `Store` means the
upload key; `Config: debug` means the fallback.

---

## 2. Versioning

Both numbers live in `android/app/build.gradle`, `defaultConfig`. Change them on the
`release/x.y.z` branch (`docs/BRANCHING.md` section 7), never on a feature branch.

| Field | Rule | Now |
|---|---|---|
| `versionCode` | A whole number Play uses to order builds. **Every upload to any Play track — internal testing included — must be higher than every earlier upload.** Play rejects a reused or lower one. Add 1 per upload; never reuse, never go down. | `1` |
| `versionName` | What users see. Semantic versioning `MAJOR.MINOR.PATCH`, identical to the git tag (`v1.0.0` ↔ `1.0.0`), as `docs/BRANCHING.md` section 6 describes. | `1.0.0` |

A build that is rejected or abandoned after upload has still used its
`versionCode`; the next upload takes the next number.

---

## 3. Building

From `android/`, in Git Bash (`./gradlew`) or PowerShell (`.\gradlew.bat`). If
`gradlew.bat` "is not recognized", clear `NoDefaultCurrentDirectoryInExePath` for
that command (CLAUDE.md section 8).

| What | Command | Output |
|---|---|---|
| App bundle — what Play takes | `./gradlew bundleRelease` | `android/app/build/outputs/bundle/release/app-release.aab` |
| APK — to install and test on a device | `./gradlew assembleRelease` | `android/app/build/outputs/apk/release/app-release.apk` |

`-q` is safe: without the upload key, `bundleRelease` fails and `assembleRelease`
still prints the debug-key warning, both at error level.

To install a release APK for testing: `adb install -r android/app/build/outputs/apk/release/app-release.apk`.
It replaces the debug install and does not use Metro. If Android refuses with
`INSTALL_FAILED_UPDATE_INCOMPATIBLE`, the installed build is signed with a
different key: `adb uninstall com.fixora` first (this clears the app's data).
Reinstall the debug APK afterwards to go back to development.

### Shrinking (R8)

Release builds are minified and resource-shrunk (`enableProguardInReleaseBuilds`).
React Native and every native library ship their own keep rules, so
`android/app/proguard-rules.pro` holds only what is ours. The images the
JavaScript bundles are looked up by name at run time, which the resource shrinker
cannot see; React Native's bundle step writes a `raw/keep.xml` listing each of
them into `android/app/build/generated/res/react/release/`, so they survive.
⚠️ Never add a `res/raw/keep.xml` of our own: same name, and one hides the other.

- ⚠️ R8 breaks things **at run time**, not at build time. After changing shrinking
  rules or adding any native dependency, run the smoke test below on a release install.
- Keep, for every uploaded `versionCode`, a copy of
  `android/app/build/outputs/mapping/release/mapping.txt`. Without it a Java/Kotlin
  stack trace from that build cannot be read. If Play Console shows an obfuscated
  crash for a release, upload that release's file there.

---

## 4. Release smoke test — on a device, from a release install

A green build proves nothing about what R8 removed. Install the release APK and,
in **dark and light**:

1. **Cold start** from the launcher: the system splash and the window behind the
   first frame are the app's own background — no white or grey flash before the
   Fixora splash.
2. **Launcher icon** is the brand mark (round and square launchers; themed icons
   on Android 13+).
3. **Customer**: introduction → sign in with OTP → Home → categories →
   create a request through to the confirmation screen.
4. **Vendor**: sign in → dashboard → requests → accept one → start and complete
   work → reports.
5. **Navigation**: every tab, push and pop, Android back, the floating tab bar's
   animation (Reanimated and worklets run native code R8 must keep).
6. **Bundled images**: the brand mark, the sign-in artwork, the `+91` flag.
7. **Icons**: every tab and button glyph renders — no empty boxes.
8. **Photos**: add a photo to a request — the camera permission prompt appears and
   the picked photo tiles show (picking is still the mock `ImageService`).
9. **Clipboard**: copy a request reference number and paste it somewhere.
10. **Storage**: sign in, swipe the app away, reopen — still signed in.
11. **Offline banner**: turn on airplane mode — the banner appears at the top and
    pushes the screen down; turn it off — it goes. Nothing reloads by itself.
12. **Permissions**: location and notifications prompts during onboarding.

---

## 5. Pre-release checklist

- [ ] All five gates pass on the release branch (CLAUDE.md section 8).
- [ ] `versionCode` is higher than every earlier upload; `versionName` matches the tag.
- [ ] `signingReport` shows `Config: release` for the release variant, and
      `bundleRelease` succeeded (it refuses to build without the upload key).
- [ ] The smoke test in section 4 passed on a release install, dark and light.
- [ ] `AppConfig.mock.failureRate` is `0`. ⚠️ `AppConfig.features.useMockServices` is
      `true` and there is no backend yet: a build for real users needs the API
      services first. Until then a release build is for testing only.
- [ ] The permissions in the merged manifest are the expected ones and match the
      Play Console data-safety answers: `INTERNET`, `ACCESS_NETWORK_STATE`,
      `ACCESS_WIFI_STATE` (both from the connectivity library, normal permissions
      with no prompt), `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `CAMERA`,
      `POST_NOTIFICATIONS`, and `com.fixora.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`
      (added by AndroidX for the app's own internal broadcasts; nothing is asked of
      the user). That was the list for 1.0.0; check it again with
      `aapt2 dump badging app-release.apk` (in the SDK's `build-tools`), because a
      new library can add more.
- [ ] `mapping.txt` and the `.aab` are archived under the `versionCode`.
- [ ] Tagged and merged as `docs/BRANCHING.md` section 7 describes.
- [ ] Owner's approval to submit (sprint plan H4). The store listing, privacy
      policy, support links, release notes, monitoring and rollback plan are the
      owner's decisions and are not covered here.
