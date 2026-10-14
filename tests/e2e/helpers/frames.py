"""Frame analysis for the motion audit: for every recorded interaction, how each screencast frame differs
from the last one. A smooth transition approaches the end state steadily. Flags:
  flash    one frame that's very different from both neighbours (a flicker or a blank frame)
  bounce   the screen gets close to the end state, then moves away again (a jump, double fade or pop)
Usage: python3 -I frames.py <auditDir> [name-filter]"""
import json, os, sys
from PIL import Image, ImageChops, ImageStat

root = sys.argv[1]
flt = sys.argv[2] if len(sys.argv) > 2 else ''


def small(p):
    return Image.open(p).convert('L').resize((96, 96))


def diff(a, b):
    return ImageStat.Stat(ImageChops.difference(a, b)).mean[0]


report = []
for name in sorted(os.listdir(root)):
    d = os.path.join(root, name)
    if not os.path.isdir(d) or flt not in name:
        continue
    files = sorted(f for f in os.listdir(d) if f.startswith('f') and f.endswith('.jpg'))
    if len(files) < 3:
        report.append((name, 0, [], 'too few frames'))
        continue
    frames = [small(os.path.join(d, f)) for f in files]
    last = frames[-1]
    to_end = [diff(f, last) for f in frames]
    issues = []
    for i in range(1, len(frames) - 1):
        a, b, c = frames[i - 1], frames[i], frames[i + 1]
        ab, bc, ac = diff(a, b), diff(b, c), diff(a, c)
        if ab > 6 and bc > 6 and ac < min(ab, bc) / 2.5:
            issues.append(f'flash@{i}')
    best = to_end[0]
    for i, v in enumerate(to_end):
        if v < best:
            best = v
        elif best < 2.5 and v - best > 4:
            issues.append(f'bounce@{i}(+{v - best:.1f})')
            best = v
    report.append((name, len(frames), issues, ' '.join(f'{v:.0f}' for v in to_end[:: max(1, len(to_end) // 24)])))

for name, n, issues, seq in report:
    print(f'{name:45} {n:4} {"; ".join(issues[:6]) or "ok":40} {seq if issues else ""}')
