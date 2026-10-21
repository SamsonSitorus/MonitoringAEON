import ezdxf
from shapely.geometry import Polygon, Point

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

shelves = []
for e in msp:
    if e.dxf.layer == 'SHELVES' and e.dxftype() == 'LWPOLYLINE':
        pts = e.get_points(format='xy')
        poly = Polygon(pts)
        shelves.append({
            'handle': e.dxf.handle,
            'poly': poly,
            'centroid': poly.centroid
        })

labels = []
for e in msp:
    if e.dxf.layer == 'LABELS' and e.dxftype() == 'TEXT':
        pt = (e.dxf.insert[0], e.dxf.insert[1])
        labels.append({
            'text': e.dxf.text.strip(),
            'point': Point(pt)
        })

matched = 0
for s in shelves:
    # check if any label is inside or close to shelf (e.g. dist < 0.5m)
    min_d = 999
    best_l = None
    for l in labels:
        d = s['poly'].distance(l['point'])
        if d < min_d:
            min_d = d
            best_l = l
    if min_d < 0.5:
        matched += 1

print(f"Total shelves: {len(shelves)}")
print(f"Shelves with close label (<0.5m): {matched} / {len(shelves)}")
