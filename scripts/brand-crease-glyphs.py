# Lumen identity proposal ("Crease"): extracts the outlines the wordmarks are built from, so they are reproducible
# without the font at render time. Geist is licensed under the SIL Open Font License 1.1.
# Dev-only; needs fontTools and brotli (pip install fonttools brotli). Run from the repository root:
#   python3 scripts/brand-crease-glyphs.py
# Writes brand/crease/source/geist-600.json ("lumen", the Phase 1 wordmark) and geist-660.json ("umen", the
# integrated Crease-L wordmark); scripts/brand-crease.mjs reads them.
import json
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

SRC = "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2"
for weight, letters in ((600, "lumen"), (660, "umen")):
    font = instantiateVariableFont(TTFont(SRC), {"wght": weight})
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    out = {"font": "Geist (variable), OFL-1.1", "wght": weight, "upm": font["head"].unitsPerEm, "xHeight": font["OS/2"].sxHeight, "glyphs": {}}
    for ch in letters:
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
        glyphs[name].draw(pen)
        out["glyphs"][ch] = {"d": pen.getCommands(), "advance": font["hmtx"][name][0]}
    with open(f"brand/crease/source/geist-{weight}.json", "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")
    print(f"wrote brand/crease/source/geist-{weight}.json")
