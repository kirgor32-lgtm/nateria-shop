"""Cut mascot from pack photo: flood background from borders, quantize interior to palette."""
import sys, json
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

S = 4  # upscale factor

def cut(src, box, palette, out, bg_from=('top', 'left', 'right'), band_from_bottom=True, dark=105):
    im = Image.open(src).convert('RGB').crop(box)
    im = im.resize((im.width * S, im.height * S), Image.LANCZOS)
    a = np.array(im).astype(int)
    h, w, _ = a.shape
    lum = (a[..., 0] * 299 + a[..., 1] * 587 + a[..., 2] * 114) // 1000
    isdark = lum < dark
    # thicken outline a bit so the flood doesn't leak through jpeg gaps
    dk = Image.fromarray((isdark * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3))
    wall = np.array(dk) > 0
    isbg = np.zeros((h, w), bool)
    q = deque()
    def seed(y, x):
        if not wall[y, x] and not isbg[y, x]:
            isbg[y, x] = True; q.append((y, x))
    if 'top' in bg_from:
        for x in range(w): seed(0, x)
    if 'left' in bg_from:
        for y in range(h): seed(y, 0)
    if 'right' in bg_from:
        for y in range(h): seed(y, w - 1)
    if band_from_bottom:
        for x in range(w): seed(h - 1, x)
    while q:
        y, x = q.popleft()
        for ny, nx in ((y+1, x), (y-1, x), (y, x+1), (y, x-1)):
            if 0 <= ny < h and 0 <= nx < w and not isbg[ny, nx] and not wall[ny, nx]:
                isbg[ny, nx] = True; q.append((ny, nx))
    # wall pixels that only touch bg and are not truly dark -> bg
    fg = ~isbg
    pal = np.array([[int(c[i:i+2], 16) for i in (1, 3, 5)] for c in palette])
    d = ((a[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(-1)
    idx = d.argmin(-1)
    idx[isdark] = 0  # palette[0] must be the outline colour
    lab = np.where(fg, idx + 1, 0).astype('uint8')
    # smooth labels with mode filter (keeps flat regions clean)
    li = Image.fromarray(lab).filter(ImageFilter.ModeFilter(7))
    lab = np.array(li)
    rgba = np.zeros((h, w, 4), 'uint8')
    for i, c in enumerate(pal):
        m = lab == i + 1
        rgba[m, :3] = c; rgba[m, 3] = 255
    Image.fromarray(rgba).save(out)
    ys, xs = np.where(lab > 0)
    print(out, 'size', w, h, 'fg bbox', xs.min(), xs.max(), ys.min(), ys.max(),
          'counts', [int((lab == i + 1).sum()) for i in range(len(pal))])

if __name__ == '__main__':
    cfg = json.loads(sys.argv[1])
    cut(**cfg)
