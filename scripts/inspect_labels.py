import ezdxf
from collections import Counter

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

labels = []
for e in msp:
    if e.dxf.layer == 'LABELS' and e.dxftype() == 'TEXT':
        labels.append((e.dxf.text, e.dxf.insert[0], e.dxf.insert[1], e.dxf.height))

print(f"Total labels: {len(labels)}")
counter = Counter([l[0] for l in labels])
print(f"Unique label texts: {len(counter)}")
print("\nTop 30 most frequent labels:")
for text, count in counter.most_common(30):
    print(f"  {text}: {count}")

print("\nSample label texts:")
for l in labels[:30]:
    print(f"  '{l[0]}' at ({l[1]:.2f}, {l[2]:.2f})")
