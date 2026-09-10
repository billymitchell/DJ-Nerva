#!/usr/bin/env python3
"""Generate optimized hero assets and an early-loading manifest. Requires Pillow."""
from pathlib import Path
import json, hashlib, base64
from PIL import Image, ImageOps
root=Path(__file__).resolve().parent.parent
sets=json.loads((root/'image_data.json').read_text())
result=[]
before=after=0
for item in sets:
    entry={k:item[k] for k in ('folder','primaryColor','secondaryColor','accentColor')}
    for mode in ('desktop','mobile'):
        src=root/'splash-images'/item['folder']/item[mode]
        out=src.parent/'optimized';out.mkdir(exist_ok=True)
        with Image.open(src) as im:
            im=ImageOps.exif_transpose(im).convert('RGB')
            im.thumbnail((1920,1920) if mode=='desktop' else (1200,1600))
            target=out/(mode+'.webp');im.save(target,'WEBP',quality=82,method=6)
            small=im.copy();small.thumbnail((48,48))
            import io
            buf=io.BytesIO();small.save(buf,'WEBP',quality=35)
            entry[mode+'Preview']='data:image/webp;base64,'+base64.b64encode(buf.getvalue()).decode()
        entry[mode]=str(target.relative_to(root))+'?v='+hashlib.sha256(target.read_bytes()).hexdigest()[:12]
        before+=src.stat().st_size;after+=target.stat().st_size
    result.append(entry)
(root/'hero_assets.json').write_text(json.dumps(result,separators=(',',':')))
print(f'{len(result)} hero sets: {before/1e6:.1f} MB → {after/1e6:.1f} MB')
