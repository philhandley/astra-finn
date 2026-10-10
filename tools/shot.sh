#!/usr/bin/env bash
# Usage: tools/shot.sh <name> <url-path-and-query> [WxH] [virtual-ms]
# Takes a headless Chrome screenshot of http://127.0.0.1:8100/<path> into the scratchpad and prints console lines.
OUT="/c/Users/Phil/AppData/Local/Temp/claude/C--1-Astra-Nova---Finn/ed878fef-9acb-46d7-ac85-5fb088ec2160/scratchpad/shots"
mkdir -p "$OUT"
NAME="$1"; PATHQ="$2"; SIZE="${3:-1280,800}"; VT="${4:-5000}"
timeout 120 "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --enable-unsafe-swiftshader --use-angle=swiftshader \
  --no-first-run --user-data-dir="$OUT/profile-$NAME" --window-size="$SIZE" --virtual-time-budget="$VT" \
  --enable-logging=stderr --v=0 --screenshot="$OUT/$NAME.png" "http://127.0.0.1:8100/$PATHQ" 2>&1 | grep -E "CONSOLE" | sed -E 's/^.*CONSOLE[^"]*"//' | head -20
echo "-> $OUT/$NAME.png"
