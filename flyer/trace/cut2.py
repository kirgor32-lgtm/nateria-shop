"""Cut a pack mascot: label pixels by palette, background = BG-coloured region connected to
the border above the band line; below the band line everything that isn't outline/mascot colour
becomes band white. Output: 4x upscaled RGBA with flat colours."""
import sys, json
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

S = 4

def hexrgb(c): return [int(c[i:i+2], 16) for i in (1, 3, 5)]

def cut(src, box, classes, bg, out, band_cols, hole_class=None, mode=7, flood_extra=(), rot=0, blur=2.0, band_clear=True, clip_below=80):
    """classes: list of [name, photo_hex, clean_hex]; classes[0] = outline, classes[1] = white.
    bg: list of photo hexes for pack background (glare variants)."""
    im = Image.open(src).convert('RGB')
    if rot:
        cx, cy = (box[0]+box[2])/2, (box[1]+box[3])/2
        im = im.rotate(rot, resample=Image.BICUBIC, center=(cx, cy), fillcolor=tuple(hexrgb(bg[0])))
    im = im.crop(box)
    im = im.resize((im.width * S, im.height * S), Image.LANCZOS)
    if blur: im = im.filter(ImageFilter.GaussianBlur(blur))
    a = np.array(im).astype(int)
    h, w, _ = a.shape
    ref = np.array([hexrgb(c[1]) for c in classes] + [hexrgb(c) for c in bg])
    d = ((a[:, :, None, :] - ref[None, None]) ** 2).sum(-1)
    lab = d.argmin(-1)
    nC = len(classes)
    lab[lab >= nC] = nC  # BG label
    lab = np.array(Image.fromarray(lab.astype('uint8')).filter(ImageFilter.ModeFilter(mode))).astype(int)
    ys = []
    for cx in band_cols:
        col = lab[:, cx * S]
        y = h - 1
        while y > 0 and col[y] == 1: y -= 1
        ys.append(y + 1)
    xs = [c * S for c in band_cols]
    k, b = np.polyfit(xs, ys, 1) if len(xs) > 1 else (0, ys[0])
    print('band line', [round(v) for v in ys], 'k', round(k, 4))
    yy, xx = np.mgrid[0:h, 0:w]
    below = yy >= (k * xx + b - 6)
    isbg = np.zeros((h, w), bool)
    q = deque()
    cand = np.isin(lab, [nC, *flood_extra]) & ~below
    def seed(y, x):
        if cand[y, x] and not isbg[y, x]: isbg[y, x] = True; q.append((y, x))
    for x in range(w): seed(0, x)
    for y in range(h): seed(y, 0); seed(y, w - 1)
    while q:
        y, x = q.popleft()
        for ny, nx in ((y+1, x), (y-1, x), (y, x+1), (y, x-1)):
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not isbg[ny, nx]:
                isbg[ny, nx] = True; q.append((ny, nx))
    hole = (lab == nC) & ~isbg & ~below
    lab[hole] = hole_class if hole_class is not None else 1
    lab[(lab == nC) & below] = 1
    # keep only the largest connected foreground component (drops slogan text, specks)
    fgm = ~isbg
    comp = np.zeros((h, w), np.int32); best = (0, 0); cid = 0
    for sy, sx in zip(*np.where(fgm[::8, ::8])):
        sy *= 8; sx *= 8
        if comp[sy, sx]: continue
        cid += 1; n = 0; q = deque([(sy, sx)]); comp[sy, sx] = cid
        while q:
            y, x = q.popleft(); n += 1
            for ny, nx in ((y+1, x), (y-1, x), (y, x+1), (y, x-1)):
                if 0 <= ny < h and 0 <= nx < w and fgm[ny, nx] and not comp[ny, nx]:
                    comp[ny, nx] = cid; q.append((ny, nx))
        if n > best[0]: best = (n, cid)
    isbg = comp != best[1]
    isbg = isbg | (yy > (k * xx + b + clip_below))
    up = ~isbg & ~below
    ux = np.where(up.any(0))[0]
    isbg = isbg | (below & ((xx < ux.min() - 8) | (xx > ux.max() + 8)))
    if band_clear:
        isbg = isbg | (below & (lab == 1))
    rgba = np.zeros((h, w, 4), 'uint8')
    for i, c in enumerate(classes):
        m = (lab == i) & ~isbg
        rgba[m, :3] = hexrgb(c[2]); rgba[m, 3] = 255
    Image.fromarray(rgba).save(out)
    fy, fx = np.where(~isbg)
    print(out, w, h, 'fg', fx.min(), fx.max(), fy.min(), fy.max(), 'band_y_center', round(k * w / 2 + b),
          {c[0]: int(((lab == i) & ~isbg).sum()) for i, c in enumerate(classes)})
    json.dump({'w': w, 'h': h, 'band_k': k, 'band_b': b}, open(out + '.json', 'w'))
    prev = Image.new('RGBA', (w, h), (60, 170, 90, 255)); prev.alpha_composite(Image.fromarray(rgba))
    prev.convert('RGB').resize((w // 2, h // 2)).save('C:/Users/User/AppData/Local/hermes/cache/scratch/' + out.replace('.png', '-prev.png'))

if __name__ == '__main__':
    cut(**json.loads(open(sys.argv[1], encoding='utf-8').read()))
