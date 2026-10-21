import ezdxf
from shapely.geometry import Polygon, Point

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

zones = []
for e in msp:
    if e.dxf.layer == 'ZONES' and e.dxftype() == 'LWPOLYLINE':
        pts = e.get_points(format='xy')
        if len(pts) >= 3:
            poly = Polygon(pts)
            if poly.is_valid and poly.area > 0:
                zones.append({
                    'handle': e.dxf.handle,
                    'poly': poly,
                    'area': poly.area,
                    'centroid': (poly.centroid.x, poly.centroid.y),
                    'bounds': poly.bounds
                })

# Labels
labels = []
for e in msp:
    if e.dxf.layer == 'LABELS' and e.dxftype() == 'TEXT':
        pt = (e.dxf.insert[0], e.dxf.insert[1])
        labels.append({
            'text': e.dxf.text.strip(),
            'point': Point(pt),
            'height': e.dxf.height,
            'pos': pt
        })

# Match labels to zones
for z in zones:
    z_labels = [l for l in labels if z['poly'].contains(l['point'])]
    # sort by height descending (major zone names usually have larger font or prominent text)
    z_labels.sort(key=lambda x: x['height'], reverse=True)
    z['labels'] = z_labels

print(f"Total zones: {len(zones)}")
for i, z in enumerate(zones[:25]):
    texts = [f"'{l['text']}' (h={l['height']:.2f})" for l in z['labels'][:5]]
    print(f"Zone {i} (handle={z['handle']}, area={z['area']:.1f}): labels count={len(z['labels'])}, top labels: {', '.join(texts)}")
