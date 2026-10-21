import ezdxf
import math

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

# Get all camera circles
cam_circles = []
for e in msp:
    if e.dxf.layer in ('CAMERAS', 'CAMERAS_PLANNED') and e.dxftype() == 'CIRCLE':
        cam_circles.append((e.dxf.center[0], e.dxf.center[1], e.dxf.layer, e.dxf.radius))

print(f"Total camera circles: {len(cam_circles)}")

# Get all texts across all layers
all_texts = []
for e in msp:
    if e.dxftype() == 'TEXT':
        all_texts.append((e.dxf.text, e.dxf.insert[0], e.dxf.insert[1], e.dxf.layer))

print(f"Total texts: {len(all_texts)}")

# For first 15 cameras, find closest text
for i, (cx, cy, clayer, rad) in enumerate(cam_circles[:25]):
    # find closest text within distance 5.0
    close = []
    for ttext, tx, ty, tlayer in all_texts:
        dist = math.hypot(cx - tx, cy - ty)
        if dist < 5.0:
            close.append((dist, ttext, tlayer))
    close.sort()
    print(f"Camera {i} ({cx:.2f}, {cy:.2f}) [{clayer}]:")
    for d, t, l in close[:3]:
        print(f"    dist={d:.2f}: '{t}' ({l})")
