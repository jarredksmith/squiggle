#!/usr/bin/env bash
# Run by .github/workflows/android-check.yml inside the emulator runner: install, launch, screenshot, log.
set -x
OUT="$GITHUB_WORKSPACE/emulator-out"; mkdir -p "$OUT"
APK=ios-app/android/app/build/outputs/apk/debug/app-debug.apk
PKG=com.jarredsmith.squiggle
shot(){ sleep "${2:-3}"; adb exec-out screencap -p > "$OUT/$1.png"; }
launch(){ adb shell am force-stop $PKG; adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1; }
# The Play button sits at about 45% of the screen height on a Pixel 7-sized screen
play(){ adb shell input tap 540 1080; }
adb install -r "$APK"
adb logcat -c
# Stream the log to the runner as it happens, so it survives even if the emulator dies
(adb logcat -v time > "$OUT/logcat-live.txt" 2>&1 &)
adb shell cmd uimode night no; launch; shot 1-home-light 12
play; shot 2-game-light 4
adb shell input keyevent 4; shot 3-back-to-home 3
adb shell cmd uimode night yes; sleep 2; launch; shot 4-home-dark 10
play; shot 5-game-dark 4
adb shell cmd uimode night no
adb shell am start -a android.intent.action.VIEW -d "https://jarredksmith.github.io/squiggle/" $PKG; shot 6-link 8
adb logcat -d -s "Capacitor:*" "Capacitor/Console:*" "AndroidRuntime:*" > "$OUT/logcat.txt"
adb shell dumpsys webviewupdate | grep -i "current webview package" > "$OUT/webview.txt" || true
exit 0
