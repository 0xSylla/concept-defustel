"""
Retire les poignets de chemise qui flottent seuls (OCTABOOT, images 16 a 97), sans IA.

1. Positions : centres des deux poignets releves a la main sur des images de reference,
   interpoles entre elles. On ne touche qu'une zone autour de ces positions.
2. Masque : dans cette zone, l'objet clair qui contient le centre (le poignet), elargi ;
   plus son reflet au sol, dans la meme colonne.
3. Remplissage : chaque pixel masque prend la valeur du meme pixel dans l'image la plus proche
   ou cet endroit est libre ; a defaut, inpainting OpenCV (Telea).

Usage : python scripts/remove_cuffs.py [--debug]
Sortie : octaboot-cuffs/frames/frame_XXXXX.webp (+ masques si --debug)
"""
import os
import sys
import cv2
import numpy as np

SRC = r"C:/Users/DELL02/Desktop/Personal Builds/Octaboot-reference/assets/frames"
ROOT = os.path.join(os.path.dirname(__file__), "..", "octaboot-cuffs")
OUT = os.path.join(ROOT, "frames")
DBG = os.path.join(ROOT, "masques")
FIRST, LAST = 15, 97
FAINT_UNTIL = 23     # poignets encore pales : on masque toute la zone
FADE_FROM = 93      # reapparition progressive des poignets au bout des manches (93 -> 98)
TEMPORAL = 50
HALF = 48            # demi-taille de la zone autour du centre
FLOOR_Y = 640        # sous cette ligne : zone des reflets

# Centres releves (image : (x, y)) ; interpoles lineairement
LEFT = {15: (518, 478), 20: (514, 486), 25: (501, 494), 30: (476, 507), 35: (449, 521), 40: (421, 532),
        45: (394, 543), 50: (369, 554), 55: (347, 561), 60: (329, 566), 65: (316, 566), 70: (292, 566),
        75: (282, 556), 80: (293, 540), 85: (289, 524), 90: (290, 512), 94: (292, 505), 97: (295, 501)}
RIGHT = {15: (752, 484), 20: (756, 490), 25: (780, 502), 30: (810, 518), 35: (838, 531), 40: (869, 539),
         45: (899, 549), 50: (926, 559), 55: (949, 566), 60: (970, 568), 65: (988, 568), 70: (1008, 565),
         75: (1021, 555), 80: (1024, 540), 85: (1025, 517), 90: (1022, 505), 94: (1020, 498), 97: (1018, 492)}


def interp(keys, n):
    ks = sorted(keys)
    if n <= ks[0]:
        return keys[ks[0]]
    if n >= ks[-1]:
        return keys[ks[-1]]
    for a, b in zip(ks, ks[1:]):
        if a <= n <= b:
            t = (n - a) / float(b - a)
            return tuple(keys[a][i] + (keys[b][i] - keys[a][i]) * t for i in range(2))


def load(n):
    return cv2.imread(os.path.join(SRC, f"frame_{n:05d}.webp"), cv2.IMREAD_COLOR)


def cuff_mask(gray, cx, cy, faint=False):
    h, w = gray.shape
    m = np.zeros_like(gray, np.uint8)
    x0, x1 = int(max(0, cx - HALF)), int(min(w, cx + HALF))
    y0, y1 = int(max(0, cy - HALF)), int(min(h, cy + HALF))
    win = gray[y0:y1, x0:x1]
    n, lab, st, cen = cv2.connectedComponentsWithStats((win > 95).astype(np.uint8), 8)
    best, bestd = None, 1e9
    for i in range(1, n):
        if st[i][4] < 30:
            continue
        d = np.hypot(cen[i][0] + x0 - cx, cen[i][1] + y0 - cy)
        if d < bestd:
            best, bestd = i, d
    if faint or best is None or bestd >= HALF * 0.8:
        box = (int(cx - 30), int(cy - 30), 60, 60)
    else:
        bx, by, bw, bh, _ = st[best]
        box = (bx + x0, by + y0, bw, bh)
    # masque = rectangle plein autour du poignet (couvre aussi sa face ombree) + colonne du reflet au sol
    bx, by, bw, bh = box
    M = 12
    m[max(0, by - M):min(h, by + bh + M), max(0, bx - M):min(w, bx + bw + M)] = 255
    ya = max(FLOOR_Y, by + bh + M)
    if ya < h:
        m[ya:h, max(0, bx - M):min(w, bx + bw + M)] = 255
    return m


def main():
    debug = "--debug" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    if debug:
        os.makedirs(DBG, exist_ok=True)
    rng = range(max(1, FIRST - TEMPORAL), min(535, LAST + TEMPORAL) + 1)
    frames = {n: load(n) for n in rng}
    masks = {}
    for n in range(FIRST, LAST + 1):
        g = cv2.cvtColor(frames[n], cv2.COLOR_BGR2GRAY)
        f = n <= FAINT_UNTIL
        m = cuff_mask(g, *interp(LEFT, n), faint=f) | cuff_mask(g, *interp(RIGHT, n), faint=f)
        masks[n] = cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=3)
    empty = np.zeros(frames[FIRST].shape[:2], np.uint8)
    for n in range(FIRST, LAST + 1):
        img = frames[n].copy()
        todo = masks[n] > 0
        for d in range(1, TEMPORAL + 1):
            if not todo.any():
                break
            for k in (n - d, n + d):
                if k not in frames or k > LAST:
                    continue  # apres LAST, les poignets sont encore la : pas une source de fond
                free = todo & ~(masks.get(k, empty) > 0)
                if free.any():
                    img[free] = frames[k][free]
                    todo &= ~free
        if todo.any():
            img = cv2.inpaint(img, todo.astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA)
        # ajuste la luminosite du patch sur son contour immediat (la brume varie d'une image a l'autre)
        m8 = (masks[n] > 0).astype(np.uint8)
        ring = cv2.dilate(m8, np.ones((15, 15), np.uint8)) - m8
        if ring.any():
            o = frames[n].astype(np.float32); f = img.astype(np.float32)
            gain = (o[ring > 0].mean(axis=0) + 1) / (f[ring > 0].mean(axis=0) + 1)
            f[m8 > 0] *= gain
            img = np.clip(f, 0, 255).astype(np.uint8)
        # bords adoucis
        soft = cv2.GaussianBlur(cv2.dilate(m8, np.ones((9, 9), np.uint8)).astype(np.float32), (0, 0), 9)[..., None]
        img = (img * soft + frames[n] * (1 - soft)).astype(np.uint8)
        if n >= FADE_FROM:
            w = (n - FADE_FROM + 1) / float(LAST - FADE_FROM + 2)
            img = cv2.addWeighted(frames[n], w, img, 1 - w, 0)
        cv2.imwrite(os.path.join(OUT, f"frame_{n:05d}.webp"), img, [cv2.IMWRITE_WEBP_QUALITY, 95])
        if debug:
            cv2.imwrite(os.path.join(DBG, f"frame_{n:05d}-masque.png"), masks[n])
    print("images", FIRST, "a", LAST, "traitees")


if __name__ == "__main__":
    main()
