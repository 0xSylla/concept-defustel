"""
Contours du mot brodé (police Alex Brush, SIL Open Font License) -> chemin SVG.

Le chemin est centré sur (0, 0), ligne de base à y = 0, hauteur de capitale ~ SIZE.
Les lettres restent dans l'ordre d'écriture : l'aiguille les parcourt de gauche à droite.

Usage : python scripts/embroidery_path.py <police.ttf> [mot]  -> site/assets/js/embroidery-path.js
"""
import os
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "site", "assets", "js", "embroidery-path.js")
SIZE = 100.0


def main():
    font = TTFont(sys.argv[1])
    word = sys.argv[2] if len(sys.argv) > 2 else "Defustel"
    cmap, glyphs, hmtx = font.getBestCmap(), font.getGlyphSet(), font["hmtx"]
    s = SIZE / font["OS/2"].sCapHeight
    letters, x = [], 0.0
    for ch in word:
        name = cmap[ord(ch)]
        letters.append((name, x))
        x += hmtx[name][0]
    bp = BoundsPen(glyphs)
    for name, gx in letters:
        glyphs[name].draw(TransformPen(bp, (1, 0, 0, 1, gx, 0)))
    x0, y0, x1, y1 = bp.bounds
    cx = (x0 + x1) / 2
    paths = []
    for name, gx in letters:
        pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.1f}")
        glyphs[name].draw(TransformPen(pen, (s, 0, 0, -s, (gx - cx) * s, 0)))
        paths.append(pen.getCommands())
    w, top, bottom = (x1 - x0) * s, -y1 * s, -y0 * s
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* Généré par scripts/embroidery_path.py — police Alex Brush (SIL Open Font License) */\n")
        f.write(f"window.EMBROIDERY = {{ word: {word!r}, width: {w:.1f}, top: {top:.1f}, bottom: {bottom:.1f},\n")
        f.write("  letters: [\n" + ",\n".join(f"    '{p}'" for p in paths) + "\n  ] };\n")
    print(word, f"largeur {w:.0f}, haut {top:.0f}, bas {bottom:.0f} ->", OUT)


if __name__ == "__main__":
    main()
