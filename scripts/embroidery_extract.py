"""
Garde uniquement le fil de la broderie generee (pixels bleu marine) et le pose sur l'image d'origine :
la manchette, la veste et la lumiere restent exactement celles du film.

Usage : python scripts/embroidery_extract.py <origine.png> <brodee.png> <sortie.png>
"""
import sys
import cv2
import numpy as np

orig = cv2.imread(sys.argv[1]).astype(np.float32)
edit = cv2.resize(cv2.imread(sys.argv[2]), (orig.shape[1], orig.shape[0])).astype(np.float32)
b, g, r = edit[..., 0], edit[..., 1], edit[..., 2]
lum = 0.299 * r + 0.587 * g + 0.114 * b
# fil : bleu nettement au-dessus du rouge, ou tres sombre sur une zone claire a l'origine
o_lum = cv2.cvtColor(orig.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
thread = ((b - r > 18) & (lum < 170)) | ((o_lum - lum > 70) & (o_lum > 120) & (b - r > 6))
zone = np.zeros(thread.shape, np.uint8)
cv2.fillPoly(zone, [np.array([[40, 720], [120, 640], [515, 395], [790, 535], [760, 720]])], 1)
cv2.circle(zone, (556, 600), 62, 0, -1)                                  # le bouton reste celui d'origine
m = (thread & (zone > 0)).astype(np.uint8)
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))       # retire les points isoles
m = cv2.dilate(m, np.ones((3, 3), np.uint8))                              # inclut le bord du fil
a = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 0.8)[..., None]
# petite ombre portee du relief, decalee vers le bas
sh = cv2.GaussianBlur(np.roll(np.roll(m, 2, 0), 1, 1).astype(np.float32), (0, 0), 1.5)[..., None]
base = orig * (1 - 0.35 * sh * (1 - a))
out = base * (1 - a) + edit * a
cv2.imwrite(sys.argv[3], np.clip(out, 0, 255).astype(np.uint8))
print("pixels de fil :", int(m.sum()))
