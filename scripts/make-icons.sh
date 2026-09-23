#!/bin/sh
# Renders the PWA icons from public/icon.svg. Needs rsvg-convert (brew install librsvg).
set -e
cd "$(dirname "$0")/../public"
square=$(mktemp -t wordleaf-icon).svg
sed 's/ rx="112"//' icon.svg > "$square"   # full-bleed: the OS applies its own mask
rsvg-convert -w 192 -h 192 icon.svg -o icon-192.png
rsvg-convert -w 512 -h 512 icon.svg -o icon-512.png
rsvg-convert -w 512 -h 512 "$square" -o icon-maskable-512.png
rsvg-convert -w 180 -h 180 "$square" -o apple-touch-icon.png
rm "$square"
