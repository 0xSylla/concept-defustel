"""
Etalonnage de la partie Wan vers le look de nos clips (sans IA, identique sur chaque image).

1. LUT par canal : appariement d'histogramme entre une image Wan (322) et une image de notre look
   au contenu similaire (0:16 : la veste avec les mains). Calculee une seule fois.
2. Debruitage leger (bilateral) puis accentuation (unsharp), identiques sur chaque image.

Usage :
  python scripts/grade_wan.py test        -> montage-final/grade/test.png (avant / apres / reference)
  python scripts/grade_wan.py lut         -> enregistre montage-final/grade/lut.npy
  python scripts/grade_wan.py apply       -> montage-final/grade/wan/NNN.png (index = image - 300)
                                             et montage-final/grade/pont/NNN.png
     Wan : etalonnage plein jusqu'a 386, retire progressivement pendant l'arrivee de l'avenue (386 -> 396).
     Pont : poids croissant de 0 (notre veste) a 1 (derniere image, = Wan 322).
"""
import os
import sys
import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..")
GD = os.path.join(ROOT, "montage-final", "grade")
OURS = os.path.join(ROOT, "montage-final", "v3-0016.png")
WAN_REF = os.path.join(ROOT, "montage-final", "wan-nc-322.png")
WAN_VIDEO = os.path.join(ROOT, "montage-final", "wan-notre-costume-300-527.mp4")
PONT_VIDEO = os.path.join(ROOT, "montage-final", "pont-veste-wan.mp4")
FADE0, FADE1 = 386, 396


def build_lut(src, ref):
    lut = np.zeros((3, 256), np.uint8)
    for c in range(3):
        s_hist = np.bincount(src[..., c].ravel(), minlength=256).astype(np.float64)
        r_hist = np.bincount(ref[..., c].ravel(), minlength=256).astype(np.float64)
        s_cdf = np.cumsum(s_hist) / s_hist.sum()
        r_cdf = np.cumsum(r_hist) / r_hist.sum()
        lut[c] = np.clip(np.searchsorted(r_cdf, s_cdf), 0, 255).astype(np.uint8)
        # lissage de la courbe pour eviter les cassures
        lut[c] = np.clip(np.convolve(np.pad(lut[c].astype(np.float64), 4, mode="edge"), np.ones(9) / 9, "valid"), 0, 255).astype(np.uint8)
    return lut


def grade(img, lut, strength=1.0):
    out = np.stack([cv2.LUT(img[..., c], lut[c]) for c in range(3)], axis=-1)
    out = cv2.bilateralFilter(out, 5, 18, 5)                         # grain
    blur = cv2.GaussianBlur(out, (0, 0), 1.2)
    out = cv2.addWeighted(out, 1.35, blur, -0.35, 0)                 # nettete
    f = out.astype(np.float32) / 255                                 # noirs plus profonds + courbe en S douce
    f = np.clip((f - 0.05) / 0.95, 0, 1)
    f = f * f * (3 - 2 * f) * 0.35 + f * 0.65
    out = (f * 255 + 0.5).astype(np.uint8)
    if strength < 1.0:
        out = cv2.addWeighted(img, 1 - strength, out, strength, 0)
    return out


def all_frames(video):
    cap = cv2.VideoCapture(video)
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            return out
        out.append(f)


def apply(lut):
    for name, video in (("wan", WAN_VIDEO), ("pont", PONT_VIDEO)):
        d = os.path.join(GD, name)
        os.makedirs(d, exist_ok=True)
        fr = all_frames(video)
        for i, f in enumerate(fr):
            if name == "wan":
                n = 300 + i
                s = 1.0 if n <= FADE0 else max(0.0, (FADE1 - n) / float(FADE1 - FADE0))
            else:
                s = i / float(len(fr) - 1)
            cv2.imwrite(os.path.join(d, f"{i:03d}.png"), grade(f, lut, s) if s > 0 else f)
        print(name, len(fr), "images ->", d)


def frames_at(indices):
    cap = cv2.VideoCapture(WAN_VIDEO)
    got, i = {}, 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if i in indices:
            got[i] = f
        i += 1
    return got


def main():
    os.makedirs(GD, exist_ok=True)
    ours = cv2.imread(OURS)
    wan = cv2.imread(WAN_REF)
    lut = build_lut(wan, ours)
    np.save(os.path.join(GD, "lut.npy"), lut)
    if sys.argv[1:] == ["lut"]:
        return
    if sys.argv[1:] == ["apply"]:
        return apply(lut)
    idx = [22, 34, 46, 60, 80]      # images Wan 322, 334, 346, 360, 380
    fr = frames_at(set(idx))
    rows = []
    for k in idx:
        a = cv2.resize(fr[k], (480, 270))
        b = cv2.resize(grade(fr[k], lut), (480, 270))
        rows.append(np.hstack([a, b]))
    top = np.hstack([cv2.resize(ours, (480, 270)), np.zeros((270, 480, 3), np.uint8)])
    cv2.imwrite(os.path.join(GD, "test.png"), np.vstack([top] + rows))
    print("test ecrit :", os.path.join(GD, "test.png"))


if __name__ == "__main__":
    main()
