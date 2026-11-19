#!/usr/bin/env bash
# Rasterize the existing ImagiPIC logo; requires ImageMagick.
set -euo pipefail
icon_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../public/assets/icon" && pwd)"
if command -v magick >/dev/null 2>&1; then
  image_command=magick
else
  image_command=convert
fi
for size in 192 512; do
  "$image_command" -background none "$icon_dir/favicon.svg" -resize "${size}x${size}" -depth 8 -strip "$icon_dir/imagipic-${size}.png"
done
"$image_command" -background none "$icon_dir/favicon.svg" -resize 384x384 -gravity center -background '#6555db' -extent 512x512 -depth 8 -strip "$icon_dir/imagipic-maskable-512.png"
"$image_command" "$icon_dir/imagipic-maskable-512.png" -resize 180x180 "$icon_dir/imagipic-apple-180.png"
# Keep legacy URLs branded too, for browsers that request these fallbacks.
"$image_command" "$icon_dir/imagipic-512.png" "$icon_dir/icon.png"
"$image_command" "$icon_dir/imagipic-192.png" -resize 64x64 "$icon_dir/favicon.png"
