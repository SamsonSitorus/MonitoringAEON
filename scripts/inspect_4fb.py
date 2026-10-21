import ezdxf
from shapely.geometry import Polygon, Point

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

# find shelf 4FB
target_shelf = None
for e in msp:
    if e.dxf.layer == 'SHELVES' and e.dxf.handle == '4FB':
        pts = e.get_points(format='xy')
        target_shelf = Polygon(pts)
        break

labels = []
for e in msp:
    if e.dxf.layer == 'LABELS' and e.dxftype() == 'TEXT':
        labels.append((e.dxf.text.strip(), Point(e.dxf.insert[0], e.dxf.insert[1])))

# find closest labels to 4FB
close_labels = sorted(labels, key=lambda l: target_shelf.distance(l[1]))
print(f"Shelf 4FB centroid: {target_shelf.centroid}")
print("Closest labels to 4FB:")
for text, pt in close_labels[:5]:
    print(f"  dist={target_shelf.distance(pt):.2f}m: '{text}'")

# find which zone contains 4FB
for e in msp:
    if e.dxf.layer == 'ZONES' and e.dxftype() == 'LWPOLYLINE':
        pts = e.get_points(format='xy')
        if len(pts) >= 3:
            zpoly = Polygon(pts)
            if zpoly.contains(target_shelf.centroid):
                # find zone labels
                z_labels = [l[0] for l in labels if zpoly.contains(l[1])]
                print(f"Containing Zone (handle {e.dxf.handle}): {z_labels[:5]}")
