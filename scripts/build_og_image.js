#!/usr/bin/env node
/*
 * Renders the social sharing card (og-image.jpg, 1200x630) from brand assets:
 * logo.svg in Paper on the violet palette's Ink, with a press photo tinted the
 * same way the site tints imagery (muted, then a primary-color "color" blend).
 *
 *   node scripts/build_og_image.js [palette]     # blue | green | violet | magenta | mono
 *
 * Uses the Playwright + Chromium already available to the environment
 * (not a package.json dependency). Needs network access for Google Fonts.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PHOTO = 'press-kit/Images/IMG_9254.jpg';
const OUT = path.join(ROOT, 'og-image.jpg');

// Mirrors the :root[data-palette] blocks in simplified-style.css.
const PALETTES = {
  blue:    { primary: '#0580c2', accent: '#7bcaf4', ink: '#080e12' },
  green:   { primary: '#17ab4b', accent: '#7bf4a5', ink: '#08120b' },
  violet:  { primary: '#6625d9', accent: '#a77bf4', ink: '#0b0812' },
  magenta: { primary: '#ed1dae', accent: '#f47bd0', ink: '#12080f' },
  mono:    { primary: '#d6d6d6', accent: '#f2f2f2', ink: '#0a0a0a' },
};
const name = process.argv[2] || 'violet';
const p = PALETTES[name];
if (!p) throw new Error(`Unknown palette "${name}"`);
const tint = name === 'mono' ? 1 : 0.55;

const logo = fs.readFileSync(path.join(ROOT, 'logo.svg'), 'utf8')
  .replace(/<\?xml[^>]*\?>/, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Press+Start+2P&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    position: relative; font-family: 'Noto Sans', sans-serif; color: #f3f0e8;
    background:
      radial-gradient(120% 90% at 0% 100%, color-mix(in oklch, ${p.primary} 22%, ${p.ink}) 0%, ${p.ink} 60%),
      ${p.ink};
  }
  .photo { position: absolute; inset: 0 0 0 auto; width: 640px; isolation: isolate; }
  .photo img {
    width: 100%; height: 100%; object-fit: cover; object-position: 62% 40%;
    filter: saturate(0.55) contrast(1.08) brightness(0.9);
  }
  .photo::before {                 /* palette tint, as on the site */
    content: ''; position: absolute; inset: 0; background: ${p.primary};
    mix-blend-mode: color; opacity: ${tint};
  }
  .photo::after {                  /* fade into the ink panel */
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(90deg, ${p.ink} 0%, color-mix(in srgb, ${p.ink} 55%, transparent) 30%, transparent 62%),
                linear-gradient(0deg, color-mix(in srgb, ${p.ink} 60%, transparent) 0%, transparent 35%);
  }
  .copy {
    position: absolute; left: 80px; top: 0; bottom: 0; width: 560px;
    display: flex; flex-direction: column; justify-content: center; gap: 34px;
  }
  .logo svg { display: block; width: 400px; height: auto; fill: #f3f0e8; stroke: #f3f0e8; stroke-width: 2.5; stroke-linejoin: round; }
  .rule { width: 64px; height: 4px; background: ${p.primary}; border-radius: 2px; }
  .kicker {
    font-family: 'Press Start 2P', monospace; font-size: 15px; line-height: 1.9;
    letter-spacing: 0.06em; color: ${p.accent}; text-transform: uppercase;
  }
  .foot {
    position: absolute; left: 80px; bottom: 52px;
    font-size: 20px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
    color: color-mix(in srgb, #f3f0e8 70%, transparent);
  }
  .foot b { color: ${p.accent}; font-weight: 700; }
</style></head><body>
  <div class="photo"><img src="file://${path.join(ROOT, PHOTO)}" alt=""></div>
  <div class="copy">
    <div class="logo">${logo}</div>
    <div class="rule"></div>
    <div class="kicker">Jungle &middot; Drum &amp; Bass<br>Baltimore Club &middot; House</div>
  </div>
  <div class="foot">djnerva.com <b>/</b> Baltimore, MD</div>
</body></html>`;

(async () => {
  const tmp = path.join(require('os').tmpdir(), 'og-card.html');
  fs.writeFileSync(tmp, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto('file://' + tmp, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 88 });
  await browser.close();
  // Re-stamp the og:image / twitter:image URLs so link previews re-fetch the new card.
  const v = require('crypto').createHash('sha1').update(fs.readFileSync(OUT)).digest('hex').slice(0, 10);
  const indexPath = path.join(ROOT, 'index.html');
  fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf8')
    .replace(/(djnerva\.com\/og-image\.jpg)(\?v=[0-9a-f]+)?(?=")/g, `$1?v=${v}`));
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${name}), stamped ?v=${v}`);
})();
