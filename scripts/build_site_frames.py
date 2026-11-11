"""
Images du film pour le site : montage v3 (montage-final/frames/f_XXXXX.png) -> WebP.

  site/assets/frames/d/NNNN.webp : 1280x720 (ordinateur)
  site/assets/frames/m/NNNN.webp : recadrage central 720x720 (mobile, plus leger)
  site/assets/img/poster.webp    : premiere image (affichee avant le chargement et sans JavaScript)
  site/assets/img/still-*.webp   : images fixes pour les sections sous le film

Usage : python scripts/build_site_frames.py
"""
import os
import cv2

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "montage-final", "frames")
SITE = os.path.join(ROOT, "site", "assets")
QUALITY = 74
STILLS = {"chemise": 125, "veste": 318, "manchette": 455, "avenue": 545}


def main():
    names = sorted(f for f in os.listdir(SRC) if f.endswith(".png"))
    for sub in ("d", "m"):
        os.makedirs(os.path.join(SITE, "frames", sub), exist_ok=True)
    os.makedirs(os.path.join(SITE, "img"), exist_ok=True)
    q = [cv2.IMWRITE_WEBP_QUALITY, QUALITY]
    for i, name in enumerate(names, 1):
        img = cv2.imread(os.path.join(SRC, name))
        h, w = img.shape[:2]
        x0 = (w - h) // 2
        cv2.imwrite(os.path.join(SITE, "frames", "d", f"{i:04d}.webp"), img, q)
        cv2.imwrite(os.path.join(SITE, "frames", "m", f"{i:04d}.webp"), img[:, x0:x0 + h], q)
        if i == 1:
            cv2.imwrite(os.path.join(SITE, "img", "poster.webp"), img, [cv2.IMWRITE_WEBP_QUALITY, 85])
        for key, n in STILLS.items():
            if i == n:
                cv2.imwrite(os.path.join(SITE, "img", f"still-{key}.webp"), img, [cv2.IMWRITE_WEBP_QUALITY, 85])
    print(len(names), "images ->", os.path.join(SITE, "frames"))


if __name__ == "__main__":
    main()
