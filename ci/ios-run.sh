#!/bin/bash
# Runs on a GitHub Mac runner. One simulator at a time.
# Usage: ci/ios-run.sh <profile> "<device name>" <iOS version> <cells> [only]
set -u
PROFILE="$1"; DEVICE="$2"; RUNTIME="$3"; CELLS="$4"; ONLY="${5:-}"; KEYBOARD="${KEYBOARD:-yes}"
OUT="${OUT:-out}/$PROFILE"
mkdir -p "$OUT"
log() { echo "[$PROFILE] $*"; }

UDID=$(xcrun simctl list -j devices available | node -e '
  const [device, runtime] = process.argv.slice(1);
  let text = ""; process.stdin.on("data", d => text += d).on("end", () => {
    const all = JSON.parse(text).devices;
    const key = Object.keys(all).find(k => k.endsWith("iOS-" + runtime.replace(/\./g, "-")));
    const hit = key && all[key].find(d => d.name === device);
    if (!hit) { console.error("available runtimes: " + Object.keys(all).join(", ")); process.exit(3); }
    console.log(hit.udid);
  });' "$DEVICE" "$RUNTIME") || { log "STOP no simulator for $DEVICE on iOS $RUNTIME"; exit 3; }
log "simulator $UDID"
export E2E_SIM_UDID="$UDID"
export E2E_SIM_LABEL="$DEVICE, iOS $RUNTIME"

defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false
START=$(date +%s)
xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b > /dev/null
log "booted in $(( $(date +%s) - START ))s"

# A fresh simulator is slow to start Safari the first time, so warm it up before timing anything.
WARM=$(date +%s)
xcrun simctl launch "$UDID" com.apple.mobilesafari > /dev/null || log "Safari warm-up launch failed"
sleep 20
log "Safari warmed up in $(( $(date +%s) - WARM ))s"
xcrun simctl io "$UDID" screenshot --type=jpeg "$OUT/after-warmup.jpg" || true

log "self-test"
node run.mjs --driver simctl --profiles "$PROFILE" --cells selftest --out "$OUT/selftest" --port 4173
if [ "$CELLS" != "selftest" ]; then
  log "pages: $CELLS"
  if [ -n "$ONLY" ] && [ "$ONLY" != "all" ]; then
    node run.mjs --driver simctl --profiles "$PROFILE" --cells "$CELLS" --only "$ONLY" --out "$OUT/pages" --port 4173
  else
    node run.mjs --driver simctl --profiles "$PROFILE" --cells "$CELLS" --out "$OUT/pages" --port 4173
  fi
fi

if [ "$KEYBOARD" = "yes" ]; then
  log "keyboard scenes through safaridriver"
  # The on-screen keyboard only follows the hardware-keyboard setting once the Simulator app is open.
  open -a Simulator --args -CurrentDeviceUDID "$UDID" -ConnectHardwareKeyboard 0 || log "could not open the Simulator app"
  sleep 15
  safaridriver -p 4444 --diagnose > "$OUT/safaridriver.log" 2>&1 &
  SD=$!
  sleep 10
  for attempt in 1 2; do
    if node run.mjs --driver safaridriver --profiles "$PROFILE" --cells scenes --only "scene-chat-composer,scene-manual-order,scene-copilot,scene-product-editor" --out "$OUT/keyboard" --port 4173; then
      log "keyboard scenes finished on attempt $attempt"; break
    fi
    log "safaridriver attempt $attempt failed"; sleep 5
  done
  kill "$SD" 2>/dev/null || true
fi
xcrun simctl shutdown "$UDID" || true
log "finished in $(( $(date +%s) - START ))s"
