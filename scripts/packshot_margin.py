"""
Packshot pour le survol : fond assombri vers celui du site, produit a ~60 % de la hauteur, de l'air autour.

Pas de detourage (les produits noirs sur fond anthracite se detourent mal) :
1. Courbe de tons : le niveau du fond (mediane du bord) descend vers TARGET ; au-dessus, la courbe remonte
   jusqu'au blanc, donc les reflets (soie, laiton, ivoire) restent lumineux.
2. Cadrage : boite du produit (ecart au fond), canevas agrandi pour qu'il occupe FILL de la hauteur ;
   le fond residuel (degrade, estime localement) est remplace par un fond uni, le bord de la photo y est fondu.
3. Format 900x1125.

Usage : python scripts/packshot_margin.py <brut.webp> <sortie.webp> [remplissage=0.6] [fond=40]
        fond > 128 : version fond blanc (ex. 251)
"""
import sys
import cv2
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
FILL = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6
TARGET = float(sys.argv[4]) if len(sys.argv) > 4 else 40.0
# fond commun a toute une serie, derive de TARGET : 40 -> #28272a (packshots sombres) ; > 128 : fond blanc
BG = np.array([TARGET + 2, TARGET - 1, TARGET], np.float32) if TARGET <= 128 else np.full(3, TARGET, np.float32)
OUT_W, OUT_H = 900, 1125


def edge_pixels(im):
    return np.concatenate([im[:10].reshape(-1, 3), im[-10:].reshape(-1, 3), im[:, :10].reshape(-1, 3), im[:, -10:].reshape(-1, 3)])


img = cv2.imread(src)
h, w = img.shape[:2]
bg_lum = float(np.median(edge_pixels(img).mean(axis=1)))

# 1. courbe de tons
knee = bg_lum + 10
k = TARGET / bg_lum
x = np.arange(256, dtype=np.float32)
lut = np.where(x <= knee, x * k, knee * k + (x - knee) * (255 - knee * k) / (255 - knee))
if TARGET > 128:                                         # fond blanc : simple gain, le fond monte a TARGET
    lut = x * TARGET / bg_lum
img = cv2.LUT(img, np.clip(lut, 0, 255).astype(np.uint8))
bg = np.median(edge_pixels(img), axis=0)

# 2. boite du produit (on ignore 2 % au bord)
m = (int(h * .02), int(w * .02))
diff = np.abs(img.astype(np.float32) - bg).max(axis=2)
obj = cv2.morphologyEx((diff > 9).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
ys, xs = np.nonzero(obj[m[0]:h - m[0], m[1]:w - m[1]])
y0, y1, x0, x1 = ys.min() + m[0], ys.max() + m[0], xs.min() + m[1], xs.max() + m[1]
cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
# canevas au format final, assez grand pour que le produit occupe FILL de la hauteur (et au plus 80 % de la largeur)
CH = max(h, (y1 - y0) / FILL, (x1 - x0) / 0.8 * OUT_H / OUT_W)
CH = int(round(CH))
CW = int(round(CH * OUT_W / OUT_H))
canvas = np.empty((CH, CW, 3), np.float32)
canvas[:] = BG
oy, ox = int(round(CH / 2 - cy)), int(round(CW / 2 - cx))
# fondu du bord de la photo dans le fond uni
e = int(min(h, w) * 0.06)
fade = np.zeros((h, w), np.float32)
fade[e:-e, e:-e] = 1
fade = cv2.GaussianBlur(fade, (0, 0), e / 2)[..., None]
ya, yb, xa, xb = max(0, oy), min(CH, oy + h), max(0, ox), min(CW, ox + w)
# fond rendu parfaitement uni. Le fond d'origine n'est pas plat (degrade, vignettage) : on l'estime localement
# (produit masque puis bouche par inpainting, sur image reduite, puis lisse) et on ne garde que l'ecart a ce fond local.
f = img.astype(np.float32)
rough = cv2.dilate((diff > 12).astype(np.uint8), np.ones((25, 25), np.uint8))
sm = 4
small = cv2.resize(img, (w // sm, h // sm), interpolation=cv2.INTER_AREA)
hole = cv2.resize(rough, (w // sm, h // sm), interpolation=cv2.INTER_NEAREST) * 255
local = cv2.inpaint(small, hole, 9, cv2.INPAINT_TELEA)
local = cv2.GaussianBlur(cv2.resize(local, (w, h), interpolation=cv2.INTER_CUBIC).astype(np.float32), (0, 0), 25)
dl = np.abs(f - local).max(axis=2)
keep = np.clip((dl - 10) / 8, 0, 1) * np.clip((diff - 12) / 8, 0, 1)   # doit se detacher du fond local ET du fond global
keep = cv2.GaussianBlur(keep, (0, 0), 2)[..., None]
img = BG + (f - local) * keep                           # meme fond exact pour tous les produits
patch = img[ya - oy:yb - oy, xa - ox:xb - ox].astype(np.float32)
a = fade[ya - oy:yb - oy, xa - ox:xb - ox]
canvas[ya:yb, xa:xb] = patch * a + canvas[ya:yb, xa:xb] * (1 - a)

cv2.imwrite(dst, cv2.resize(np.clip(canvas, 0, 255).astype(np.uint8), (OUT_W, OUT_H), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_WEBP_QUALITY, 88])
print(f"fond {bg_lum:.0f} -> {TARGET:.0f}, produit {(y1 - y0) / CH:.0%} de la hauteur -> {dst}")
