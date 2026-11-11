"""
Packshot fond blanc -> meme packshot sur le fond sombre des packshots (#28272a), sans regenerer.

Le fond blanc se detoure proprement : GrabCut (bord = fond, ecart au blanc = produit probable), puis retrait
des zones claires et neutres (ombre grise) collees au bord du detourage ;
liseré blanc retire (erosion d'1 px + couleurs de bord ramenees vers l'interieur), legere ombre douce dessous.
Le cadrage du packshot blanc (produit a ~60 % de la hauteur) est conserve.

Usage : python scripts/white_to_dark.py <packshot-blanc.webp> <sortie.webp> [--garder-blanc]
  --garder-blanc : produit clair (ex. nacre) : on ne retire pas les zones claires et neutres
"""
import sys
import cv2
import numpy as np

BG = np.array([42, 39, 40], np.float32)                  # BGR = #28272a, comme packshot_margin.py (fond=40)

img = cv2.imread(sys.argv[1])
h, w = img.shape[:2]
f = img.astype(np.float32)
white = np.median(np.concatenate([f[:10].reshape(-1, 3), f[-10:].reshape(-1, 3)]), axis=0)
diff = np.abs(f - white).max(axis=2)

gc = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
gc[diff > 30] = cv2.GC_PR_FGD
gc[diff > 80] = cv2.GC_FGD
e = 12
gc[:e], gc[-e:], gc[:, :e], gc[:, -e:] = cv2.GC_BGD, cv2.GC_BGD, cv2.GC_BGD, cv2.GC_BGD
bgm, fgm = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
cv2.grabCut(img, gc, None, bgm, fgm, 6, cv2.GC_INIT_WITH_MASK)
obj = np.isin(gc, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(obj, 8)
keep = np.zeros_like(obj)
for i in range(1, n):
    if st[i][4] > h * w * 0.002:
        keep[lab == i] = 1
keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
# restes de fond / d'ombre grise colles au produit : zones claires et neutres qui touchent le bord du detourage
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
bglike = ((hsv[..., 2] > 170) & (hsv[..., 1] < 22) & (keep > 0)).astype(np.uint8) * (0 if '--garder-blanc' in sys.argv else 1)
border = keep - cv2.erode(keep, np.ones((3, 3), np.uint8))
n2, lab2, st2, _ = cv2.connectedComponentsWithStats(bglike, 8)
for i in range(1, n2):
    comp = lab2 == i
    if st2[i][4] > 30 and (border[comp] > 0).any():
        keep[comp] = 0
keep = cv2.morphologyEx(keep, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
keep = cv2.erode(keep, np.ones((3, 3), np.uint8))
alpha = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 1.0)[..., None]

# couleurs du bord : remplacees par celles de l'interieur (evite le halo blanc)
inner = cv2.erode(keep, np.ones((7, 7), np.uint8))
fill = cv2.inpaint(img, ((keep > 0) & (inner == 0)).astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA).astype(np.float32)
edge = ((keep > 0) & (inner == 0))[..., None]
prod = np.where(edge, fill * 0.6 + f * 0.4, f)

shadow = cv2.GaussianBlur(np.roll(keep.astype(np.float32), int(h * 0.012), axis=0), (0, 0), h * 0.018)[..., None]
out = np.empty_like(f)
out[:] = BG
out *= 1 - 0.5 * shadow
out = out * (1 - alpha) + prod * alpha
cv2.imwrite(sys.argv[2], np.clip(out, 0, 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 88])
print("->", sys.argv[2])
