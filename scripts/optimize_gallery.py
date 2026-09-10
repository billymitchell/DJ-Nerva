#!/usr/bin/env python3
"""Create web-sized gallery copies. Requires Pillow: python3 -m pip install Pillow.
Run before node scripts/build_gallery_manifest.js after adding photos.
"""
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent / 'DJ-images'
out = root / 'optimized'
out.mkdir(exist_ok=True)
before = after = count = 0
for source in sorted(root.iterdir()):
    if source.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.webp'}:
        continue
    target = out / (source.name + '.webp')
    if not target.exists() or target.stat().st_mtime < source.stat().st_mtime:
        with Image.open(source) as image:
            # MPO photos contain auxiliary images, not animation frames.
            if getattr(image, 'is_animated', False) and image.format != 'MPO':
                continue
            image.seek(0)
            image = ImageOps.exif_transpose(image)
            image.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
            image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
            image.save(target, 'WEBP', quality=80, method=6)
    with Image.open(target) as check:
        check.load()
        assert max(check.size) <= 1200
    before += source.stat().st_size
    after += target.stat().st_size
    count += 1
print(f'{count} images: {before / 1e6:.1f} MB → {after / 1e6:.1f} MB ({100 * (1 - after / before):.0f}% smaller)' if before else 'No images found.')
