#!/bin/sh
# Rebuild vendor/three/three.min.js: three.js plus OrbitControls as one
# minified ES module, for the 3D movement viewer (move.html). The app has
# no build step, so the bundle is committed; rerun this to upgrade.
set -e
VERSION=${1:-0.186.0}
TMP=$(mktemp -d)
cd "$TMP"
npm init -y >/dev/null
npm install --silent "three@$VERSION" esbuild@0.25
printf "export * from 'three';\nexport { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';\n" > entry.js
npx esbuild entry.js --bundle --format=esm --minify --legal-comments=none --outfile=three.min.js
cd - >/dev/null
cp "$TMP/three.min.js" vendor/three/three.min.js
cp "$TMP/node_modules/three/LICENSE" vendor/three/LICENSE
echo "vendor/three/three.min.js is three@$VERSION"
