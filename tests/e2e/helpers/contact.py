"""Tiles an interaction's screencast frames into one image (with each frame's time in ms) for review.
Usage: python3 -I contact.py <frameDir> <out.png> [first] [last] [step]"""
import json, os, sys
from PIL import Image, ImageDraw

d, out = sys.argv[1], sys.argv[2]
files = sorted(f for f in os.listdir(d) if f.startswith('f') and f.endswith('.jpg'))
times = json.load(open(os.path.join(d, 'times.json')))
a = int(sys.argv[3]) if len(sys.argv) > 3 else 0
b = int(sys.argv[4]) if len(sys.argv) > 4 else len(files)
step = int(sys.argv[5]) if len(sys.argv) > 5 else max(1, (b - a) // 16)
pick = list(range(a, min(b, len(files)), step))[:20]
ims = [Image.open(os.path.join(d, files[i])) for i in pick]
w = 190
h = int(ims[0].height * w / ims[0].width)
cols = min(10, len(ims))
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 16)), 'white')
t0 = times[0]
for k, (i, im) in enumerate(zip(pick, ims)):
    x, y = (k % cols) * w, (k // cols) * (h + 16)
    sheet.paste(im.resize((w, h)), (x, y + 16))
    ImageDraw.Draw(sheet).text((x + 4, y + 2), f'#{i} {int((times[i] - t0) * 1000)}ms', fill='black')
sheet.save(out)
print(out, len(pick), 'frames')
