// Makes the store app's icon and splash sources in ./assets, for
// `npx @capacitor/assets generate` (see README.md). Drawn in headless
// Chromium from the kettlebell in ../favicon.svg, the same mark as the
// website's icons, so the app and the site can't differ:
//   icon-only.png        1024 square, teal to the edges (iOS rounds it)
//   icon-foreground.png  the kettlebell alone, inside Android's safe zone
//   icon-background.png  the teal behind it
//   splash.png, splash-dark.png  2732 square, FIT's background with the
//                        icon in the middle (FIT is dark either way)
//
// Usage: node make-assets.mjs   (needs Playwright, as test-bridge.mjs does)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'assets');
mkdirSync(out, { recursive: true });

const TEAL = '#0d9488', BG = '#050a0a';
// the kettlebell from favicon.svg, without its rounded square
const svg = readFileSync(join(here, '..', 'favicon.svg'), 'utf8');
const mark = svg.replace(/<svg[^>]*>|<\/svg>/g, '').replace(/<rect[^>]*\/>/, '').trim();
if (!mark.includes('<circle') || !mark.includes('<path')) throw new Error('favicon.svg has changed shape: check make-assets.mjs');

// One picture: a square of `size` px, a background (or none), and the
// kettlebell's 64-unit drawing scaled by `scale` about the middle, on a
// rounded tile of `tile` px if there is one.
const page = (size, { background, scale = 1, tile = 0 }) => `<!doctype html><html><body style="margin:0;background:${background || 'transparent'}">
<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style="display:block">
  ${tile ? `<rect x="${32 - tile / 2}" y="${32 - tile / 2}" width="${tile}" height="${tile}" rx="${tile * 14 / 64}" fill="${TEAL}"/>` : ''}
  <g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${mark}</g>
</svg></body></html>`;

const PICTURES = {
  'icon-only.png': [1024, { background: TEAL }],
  // Android crops the foreground to a circle about 61% across: the
  // kettlebell (about 73% tall at full size) goes in at 62% of that
  'icon-foreground.png': [1024, { scale: 0.62 }],
  'icon-background.png': [1024, { background: TEAL, scale: 0 }],
  'splash.png': [2732, { background: BG, tile: 12, scale: 12 / 64 }],
  'splash-dark.png': [2732, { background: BG, tile: 12, scale: 12 / 64 }]
};

const launch = {};
if (process.env.CHROMIUM) launch.executablePath = process.env.CHROMIUM;
else if (existsSync('/opt/pw-browsers/chromium')) launch.executablePath = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(launch);
for (const [name, [size, opts]] of Object.entries(PICTURES)) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(opts.scale === 0 ? `<body style="margin:0;background:${opts.background}">` : page(size, opts));
  await p.screenshot({ path: join(out, name), omitBackground: !opts.background });
  await p.close();
  console.log(`assets/${name}  ${size} x ${size}`);
}
await browser.close();
