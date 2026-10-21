# Fixora's own R8 keep rules, appended to the default Android rules by
# `proguardFiles` in android/app/build.gradle (release builds only).
#
# There are none today, and none are needed: React Native and every native
# library the app uses ship their own keep rules, which R8 applies by itself.
# This file holds only what is ours (docs/RELEASE.md, "Shrinking (R8)").
#
# Add a rule here when code of our own is reached by name or by reflection —
# a native module or view written in this repository — or when a library ships
# without its rules. R8 breaks things at run time, not at build time: after
# changing this file, run the release smoke test (docs/RELEASE.md section 4) on
# a release install.
#
# Images the JavaScript bundles are kept by React Native's generated
# raw/keep.xml; never add a res/raw/keep.xml of our own.
