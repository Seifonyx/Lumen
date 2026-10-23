# Lumen identity proposal ("Crease"): extracts the outlines the wordmark is built from, so the wordmark is
# reproducible without the font at render time. Geist is licensed under the SIL Open Font License 1.1.
# Dev-only; needs fontTools and brotli (pip install fonttools brotli). Run from the repository root:
#   python3 scripts/brand-crease-glyphs.py
# Writes brand/crease/source/geist-600.json; scripts/brand-crease.mjs reads it.
import json
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

SRC = "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2"
WEIGHT = 600
font = instantiateVariableFont(TTFont(SRC), {"wght": WEIGHT})
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
out = {"font": "Geist (variable), OFL-1.1", "wght": WEIGHT, "upm": font["head"].unitsPerEm, "xHeight": font["OS/2"].sxHeight, "glyphs": {}}
for ch in "lumen":
    name = cmap[ord(ch)]
    pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
    glyphs[name].draw(pen)
    out["glyphs"][ch] = {"d": pen.getCommands(), "advance": font["hmtx"][name][0]}
with open("brand/crease/source/geist-600.json", "w") as f:
    json.dump(out, f, indent=1)
    f.write("\n")
print("wrote brand/crease/source/geist-600.json")
