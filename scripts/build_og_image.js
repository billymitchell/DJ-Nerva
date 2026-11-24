#!/usr/bin/env node
/*
 * Renders the social sharing card (og-image.jpg, 1200x630) from brand assets:
 * the site logo in Paper on the green palette's Ink, with a press photo tinted the
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
const PHOTO = 'press-kit/Images/000023590021-small.jpg';
const OUT = path.join(ROOT, 'og-image.jpg');

// Mirrors the :root[data-palette] blocks in simplified-style.css.
const PALETTES = {
  blue:    { primary: '#0580c2', accent: '#7bcaf4', ink: '#080e12' },
  green:   { primary: '#17ab4b', accent: '#7bf4a5', ink: '#08120b' },
  violet:  { primary: '#6625d9', accent: '#a77bf4', ink: '#0b0812' },
  magenta: { primary: '#ed1dae', accent: '#f47bd0', ink: '#12080f' },
  mono:    { primary: '#d6d6d6', accent: '#f2f2f2', ink: '#0a0a0a' },
};
const name = process.argv[2] || 'green';
const p = PALETTES[name];
if (!p) throw new Error(`Unknown palette "${name}"`);
const tint = name === 'mono' ? 1 : 0.65;

// The hero's inline SVG is the precise logo (logo.svg is a lower-precision export).
const logo = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .match(/<svg id="logo"[\s\S]*?<\/svg>/)[0]
  .replace(/<title[\s\S]*?<\/title>/, '')
  .replace(/ (id|class|role|aria-labelledby)="[^"]*"/g, '');

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
    width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%;
    filter: saturate(0.2) contrast(1.08) brightness(0.92);
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
  .logo svg { display: block; width: 400px; height: auto; }
  .logo svg * { fill: #f3f0e8; stroke: #f3f0e8; stroke-width: 2; }   /* seals seams, as on the site */
  .rule { width: 64px; height: 4px; background: ${p.primary}; border-radius: 2px; }
  .kicker {
    font-family: 'Press Start 2P', monospace; font-size: 15px; line-height: 1.9;
    letter-spacing: 0.06em; color: ${p.accent}; text-transform: uppercase;
  }
  #wave, #dots { position: absolute; inset: 0; pointer-events: none; }
  #wave { mix-blend-mode: screen; filter: drop-shadow(0 0 6px ${p.primary}); }
  #dots { mix-blend-mode: screen; filter: blur(0.4px) drop-shadow(0 0 4px ${p.primary}); }
  .foot {
    position: absolute; left: 80px; bottom: 52px;
    font-size: 20px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
    color: color-mix(in srgb, #f3f0e8 70%, transparent);
  }
</style></head><body>
  <div class="photo"><img src="file://${path.join(ROOT, PHOTO)}" alt=""></div>
  <div class="copy">
    <div class="logo">${logo}</div>
    <div class="rule"></div>
    <div class="kicker">DJ &middot; Baltimore, MD</div>
  </div>
  <canvas id="wave" width="1200" height="630"></canvas>
  <canvas id="dots" width="1200" height="630"></canvas>
  <div class="foot">djnerva.com</div>
<script>
// One clean sine line that, crossing into the photo, breaks into pixels
// which thin out and fade into the image.
(() => {
  const P = ${JSON.stringify(p)};
  const line = document.getElementById('wave').getContext('2d');
  const dots = document.getElementById('dots').getContext('2d');
  let seed = 11;                                  // deterministic output
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const X0 = 80, X1 = 1200, CY = 500, AMP = 22;
  const y = x => CY + AMP * Math.sin((x - X0) * 0.035) * (0.55 + 0.45 * Math.sin((x - X0) * 0.006));
  const D0 = 500, D1 = 1120;                      // dissolve span (starts at the photo edge)

  // Solid line, fading out as it breaks up
  const g = line.createLinearGradient(X0, 0, D0 + 220, 0);
  g.addColorStop(0, P.accent); g.addColorStop(0.55, P.accent); g.addColorStop(1, 'transparent');
  line.strokeStyle = g; line.lineWidth = 3; line.lineCap = 'round'; line.lineJoin = 'round';
  line.beginPath();
  for (let x = X0; x <= D0 + 220; x += 2) x === X0 ? line.moveTo(x, y(x)) : line.lineTo(x, y(x));
  line.stroke();

  // Pixels: sampled from the line, growing, drifting and thinning out
  for (let x = D0 - 40; x < D1; x += 3) {
    const d = smooth(D0 - 40, D1, x);
    if (rnd() > 0.9 - d * 0.55) continue;
    const cs = 3 + Math.round(d * 3) * 2;
    const px = Math.round((x + (rnd() - 0.3) * d * 50) / cs) * cs;
    const py = Math.round((y(x) + (rnd() - 0.5) * (4 + d * d * 220)) / cs) * cs;
    dots.globalAlpha = (1 - d) ** 1.4 * (0.5 + 0.5 * rnd());
    dots.fillStyle = rnd() < 0.5 ? P.accent : P.primary;
    dots.fillRect(px, py, cs - 1, cs - 1);
  }
})();
</script>
</body></html>`;

(async () => {
  const tmp = path.join(require('os').tmpdir(), 'og-card.html');
  fs.writeFileSync(tmp, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });   // supersampled, downscaled below
  await page.goto('file://' + tmp, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const shot = await page.screenshot({ type: 'png' });
  // Downscale 2x -> 1x in the browser for clean anti-aliasing on the logo edges.
  const b64 = await page.evaluate(async (src) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, 1200, 630);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, shot.toString('base64'));
  fs.writeFileSync(OUT, Buffer.from(b64, 'base64'));
  await browser.close();
  // Re-stamp the og:image / twitter:image URLs so link previews re-fetch the new card.
  const v = require('crypto').createHash('sha1').update(fs.readFileSync(OUT)).digest('hex').slice(0, 10);
  const indexPath = path.join(ROOT, 'index.html');
  fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf8')
    .replace(/(djnerva\.com\/og-image\.jpg)(\?v=[0-9a-f]+)?(?=")/g, `$1?v=${v}`));
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${name}), stamped ?v=${v}`);
})();
