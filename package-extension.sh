#!/bin/bash
# package-extension.sh — Creates a clean ZIP for Chrome Web Store submission

EXTENSION_NAME="youtube-break-reminder"
VERSION=$(node -p "require('./manifest.json').version")
OUTPUT="${EXTENSION_NAME}-v${VERSION}.zip"

# Remove old package
rm -f "$OUTPUT"

# Create ZIP excluding dev and unnecessary files
zip -r "$OUTPUT" . \
  -x ".git/*" \
  -x ".github/*" \
  -x "node_modules/*" \
  -x ".env" \
  -x "*.map" \
  -x "tests/*" \
  -x "__tests__/*" \
  -x "*.test.*" \
  -x "*.spec.*" \
  -x "eslint.config.js" \
  -x "package.json" \
  -x "package-lock.json" \
  -x "CHROMEWEBSTORE.md" \
  -x "README.md" \
  -x "PRIVACY.md" \
  -x "LICENSE" \
  -x ".DS_Store" \
  -x "Thumbs.db" \
  -x "*.sh" \
  -x "store-assets/*"

echo "✅ Packaged successfully: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
