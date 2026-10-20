"""Wycina tło (szachownicę lub jednolity kolor) z grafiki AI. Użycie: cutout.py wejście wyjście"""
import sys
from PIL import Image, ImageFilter
import numpy as np
from collections import deque, Counter
from scipy import ndimage
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(int)
H, W, _ = a.shape
# odcienie tła z rogów
corners = np.concatenate([a[:80, :80].reshape(-1, 3), a[:80, -80:].reshape(-1, 3), a[-80:, :80].reshape(-1, 3), a[-80:, -80:].reshape(-1, 3)])
cnt = Counter(tuple(c // 6 * 6 + 3) for c in corners)
tones = []
for c, n in cnt.most_common(8):
    if n < len(corners) * 0.06: break
    if all(np.abs(np.array(c) - np.array(t)).max() > 18 for t in tones): tones.append(c)
tones = [np.array(t) for t in tones[:3]]
print('tones', [t.tolist() for t in tones])
d = np.min([np.abs(a - t).max(2) for t in tones], axis=0)
bgc = d <= 16
mask = np.zeros((H, W), bool); q = deque()
for x in range(W):
    for y in (0, H - 1):
        if bgc[y, x]: mask[y, x] = True; q.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if bgc[y, x] and not mask[y, x]: mask[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and not mask[ny, nx] and bgc[ny, nx]:
            mask[ny, nx] = True; q.append((ny, nx))
# zamknięte kawałki tła (np. wewnątrz łuku)
lab, n = ndimage.label(bgc & ~mask)
if n:
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    for i, sz in enumerate(sizes, 1):
        if sz < 250: continue
        comp = lab == i
        if len(tones) == 1 or sz > 3000: mask |= comp; continue
        px = a[comp]
        near = [(np.abs(px - t).max(1) <= 16).mean() for t in tones]
        if sum(v > 0.12 for v in near) >= 2: mask |= comp
# szare kwadraciki w nieco innym odcieniu (artefakty JPG), stykające się z tłem
mx, mn = a.max(2), a.min(2)
grey = ((mx - mn) <= 10) & (mn >= 55) & (mx <= 170) & ~mask
lab3, n3 = ndimage.label(grey)
if n3:
    touch = ndimage.binary_dilation(mask, iterations=2)
    sizes3 = ndimage.sum(np.ones_like(lab3), lab3, range(1, n3 + 1))
    hit = ndimage.maximum(touch, lab3, range(1, n3 + 1))
    for i, (sz, h) in enumerate(zip(sizes3, hit), 1):
        if h and sz >= 40: mask |= lab3 == i
# usuń luźne wysepki (resztki szachownicy), zostaw postać
lab2, n2 = ndimage.label(~mask)
if n2 > 1:
    sizes2 = ndimage.sum(np.ones_like(lab2), lab2, range(1, n2 + 1))
    big = sizes2.max()
    for i, sz in enumerate(sizes2, 1):
        if sz < big * 0.04: mask |= lab2 == i
print('removed', round(mask.mean(), 3))
alpha = np.where(mask, 0, 255).astype(np.uint8)
al = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
out = im.convert('RGBA'); out.putalpha(al)
out = out.crop(out.getbbox()); out.save(dst); print('size', out.size)
