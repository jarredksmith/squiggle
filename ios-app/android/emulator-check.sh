#!/usr/bin/env bash
# Run by .github/workflows/android-check.yml inside the emulator runner: install, launch, screenshot, log.
set -x
OUT="$GITHUB_WORKSPACE/emulator-out"; mkdir -p "$OUT"
APK=ios-app/android/app/build/outputs/apk/debug/app-debug.apk
shot(){ sleep "${2:-3}"; adb exec-out screencap -p > "$OUT/$1.png"; }
adb install -r "$APK"
adb logcat -c
adb shell monkey -p com.jarredsmith.squiggle -c android.intent.category.LAUNCHER 1
shot 1-launch 12
# Light and dark: flip the system theme and relaunch
adb shell input keyevent 4; sleep 2
adb shell cmd uimode night yes; sleep 2
adb shell monkey -p com.jarredsmith.squiggle -c android.intent.category.LAUNCHER 1
shot 2-dark 10
adb shell cmd uimode night no; sleep 2
# Open a shared squiggle link the way a friend would
adb shell am start -a android.intent.action.VIEW -d "https://jarredksmith.github.io/squiggle/" com.jarredsmith.squiggle
shot 3-link 8
# Back gesture
adb shell input keyevent 4
shot 4-after-back 3
adb logcat -d -s "Capacitor:*" "Capacitor/Console:*" "chromium:*" "AndroidRuntime:*" > "$OUT/logcat.txt"
adb shell dumpsys package com.jarredsmith.squiggle | grep -A3 -i "verif" > "$OUT/links.txt" || true
exit 0
