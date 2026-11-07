#!/bin/bash
# Android 16 is already booted when this starts. One emulator at a time.
cd /d/phone-tests/harness || exit 1
export ANDROID_SDK_ROOT='D:\Android\Sdk' ADB='D:\Android\Sdk\platform-tools\adb.exe'
LOG=/d/phone-tests/out/tier2-run.log
: > "$LOG"
echo "START $(date -u +%T)" >> "$LOG"

E2E_ADB_SERIAL=emulator-5572 E2E_ANDROID_LABEL='Android 16' node run.mjs --driver adb --profiles a36-320,a36-412,a36-land,a36-font --cells all --out D:/phone-tests/out/tier2/api36 --port 4175 >> "$LOG" 2>&1
echo "api36 exit $? at $(date -u +%T)" >> "$LOG"
"$ADB" -s emulator-5572 emu kill >> "$LOG" 2>&1
sleep 15

for spec in "35 a35-320,a35-412" "31 a31-320,a31-412" "30 a30-320,a30-412"; do
  set -- $spec
  node android/run.mjs --api "$1" --profiles "$2" --cells all --port 4175 >> "$LOG" 2>&1
  echo "api$1 exit $? at $(date -u +%T)" >> "$LOG"
  sleep 15
done
echo "ALL DONE $(date -u +%T)" >> "$LOG"
