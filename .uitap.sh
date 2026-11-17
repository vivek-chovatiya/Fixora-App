#!/bin/bash
# Dumps the view hierarchy and taps the centre of the first node whose text or
# content-desc matches $1 exactly.
dump() { MSYS_NO_PATHCONV=1 adb shell uiautomator dump --compressed /sdcard/ui.xml >/dev/null 2>&1; MSYS_NO_PATHCONV=1 adb shell cat /sdcard/ui.xml 2>/dev/null; }
tapnode() {
  local needle="$1"
  local xml; xml=$(dump)
  local line; line=$(echo "$xml" | tr '<' '\n<' | grep -F -- "\"$needle\"" | head -1)
  if [ -z "$line" ]; then echo "NOT FOUND: $needle"; return 1; fi
  local b; b=$(echo "$line" | grep -o 'bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' | head -1)
  local nums; nums=$(echo "$b" | grep -o '[0-9]\+')
  set -- $nums
  local x=$(( ($1 + $3) / 2 )); local y=$(( ($2 + $4) / 2 ))
  adb shell input tap $x $y
  echo "tapped '$needle' at $x,$y"
}
