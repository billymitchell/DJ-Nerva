#!/usr/bin/env python3
"""Create web-sized gallery copies. Requires Pillow: python3 -m pip install Pillow.
Run before `node scripts/build_gallery_manifest.js` after adding photos.

  python3 scripts/optimize_gallery.py                     # build 1200px + 600px WebP copies
  python3 scripts/optimize_gallery.py --check-duplicates  # flag exact/near-exact copies
  python3 scripts/optimize_gallery.py --contact-sheet     # write gallery-contact-sheet.jpg (not deployed)

--check-duplicates only catches the same image saved twice (re-exports, HEIC
conversions). Two different shots of the same moment won't match, so skim the
contact sheet before publishing new photos.
"""
import sys
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent / 'DJ-images'
out = root / 'optimized'
small_dir = out / '600'
out.mkdir(exist_ok=True)
small_dir.mkdir(exist_ok=True)
EXTS = {'.jpg', '.jpeg', '.png', '.webp'}


def save_webp(image, target, size):
    image = image.copy()
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
    image.save(target, 'WEBP', quality=80, method=6)


# 1) Originals dropped in DJ-images/ -> optimized/<name>.webp (1200px max).
for source in sorted(root.iterdir()):
    if source.suffix.lower() not in EXTS:
        continue
    target = out / (source.name + '.webp')
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        continue
    with Image.open(source) as image:
        # MPO photos contain auxiliary images, not animation frames.
        if getattr(image, 'is_animated', False) and image.format != 'MPO':
            continue
        image.seek(0)
        save_webp(ImageOps.exif_transpose(image), target, 1200)
    print('optimized', target.name)

# 2) optimized/*.webp -> optimized/600/*.webp for the 2-4 column grid.
for full in sorted(out.glob('*.webp')):
    target = small_dir / full.name
    if target.exists() and target.stat().st_mtime >= full.stat().st_mtime:
        continue
    with Image.open(full) as image:
        save_webp(image, target, 600)
    print('small', target.name)

# Remove 600px copies whose full-size photo is gone.
for orphan in small_dir.glob('*.webp'):
    if not (out / orphan.name).exists():
        orphan.unlink()
        print('removed orphan', orphan.name)


def dhash(path, n=16):
    with Image.open(path) as im:
        px = list(im.convert('L').resize((n + 1, n), Image.Resampling.LANCZOS).getdata())
    return sum(1 << i for i, (a, b) in enumerate(
        (px[r * (n + 1) + c], px[r * (n + 1) + c + 1]) for r in range(n) for c in range(n)) if a > b)


if '--check-duplicates' in sys.argv:
    files = sorted(out.glob('*.webp')) + sorted((root / 'video' / 'posters').glob('*.jpg'))
    hashes = {f: dhash(f) for f in files}
    found = False
    for i, a in enumerate(files):
        for b in files[i + 1:]:
            if bin(hashes[a] ^ hashes[b]).count('1') < 40:
                print(f'Possible duplicate: {a.name}  <->  {b.name}')
                found = True
    print('No copied photos found.' if not found else 'Review the pairs above.')

if '--contact-sheet' in sys.argv:
    from PIL import ImageDraw
    files = sorted(out.glob('*.webp')) + sorted((root / 'video' / 'posters').glob('*.jpg'))
    w, h, cols = 260, 300, 6
    sheet = Image.new('RGB', (cols * w, -(-len(files) // cols) * h), 'white')
    draw = ImageDraw.Draw(sheet)
    for i, f in enumerate(files):
        with Image.open(f) as im:
            im = im.convert('RGB')
            im.thumbnail((w - 10, h - 30))
            x, y = (i % cols) * w, (i // cols) * h
            sheet.paste(im, (x + 5, y + 5))
            draw.text((x + 5, y + h - 22), f.name[:34], fill='black')
    target = root.parent / 'gallery-contact-sheet.jpg'
    sheet.save(target, quality=80)
    print('Contact sheet:', target)
