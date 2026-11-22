# アイコン生成（2枚重ねのカード）
import sys
from PIL import Image, ImageDraw
out = sys.argv[1]
def make(size, maskable=False, bg_full=False):
    s = size
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    navy = (31, 58, 95, 255)
    if maskable or bg_full:
        d.rectangle([0, 0, s, s], fill=navy)
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=navy)
    k = 0.62 if maskable else 0.78  # safe zone
    cw, ch = s * k * 0.62, s * k * 0.78
    cx, cy = s / 2, s / 2
    # back card (rotated look via offset)
    off = s * k * 0.08
    d.rounded_rectangle([cx - cw/2 + off, cy - ch/2 - off, cx + cw/2 + off, cy + ch/2 - off],
                        radius=int(s*0.04), fill=(122, 160, 204, 255))
    d.rounded_rectangle([cx - cw/2 - off*0.4, cy - ch/2 + off*0.4, cx + cw/2 - off*0.4, cy + ch/2 + off*0.4],
                        radius=int(s*0.04), fill=(246, 245, 241, 255))
    # lines on front card
    lx0 = cx - cw/2 - off*0.4 + cw*0.18
    lx1 = cx + cw/2 - off*0.4 - cw*0.18
    top = cy - ch/2 + off*0.4 + ch*0.25
    for i, w in enumerate([1.0, 0.7, 0.85]):
        y = top + i * ch * 0.18
        d.rounded_rectangle([lx0, y, lx0 + (lx1 - lx0) * w, y + ch*0.07], radius=int(ch*0.035), fill=navy)
    return img
make(192).save(f'{out}/icon-192.png')
make(512).save(f'{out}/icon-512.png')
make(512, maskable=True).save(f'{out}/icon-maskable-512.png')
make(180, bg_full=True).convert('RGB').save(f'{out}/apple-touch-icon.png')
