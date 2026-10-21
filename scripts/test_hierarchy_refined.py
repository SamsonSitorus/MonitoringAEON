import ezdxf
from shapely.geometry import Polygon, Point
import pandas as pd

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

# Shelves
shelves = []
for e in msp:
    if e.dxf.layer == 'SHELVES' and e.dxftype() == 'LWPOLYLINE':
        pts = e.get_points(format='xy')
        poly = Polygon(pts)
        if poly.is_valid:
            shelves.append({
                'handle': e.dxf.handle,
                'poly': poly,
                'pts': pts,
                'centroid': poly.centroid
            })

# Labels
labels = []
for e in msp:
    if e.dxf.layer == 'LABELS' and e.dxftype() == 'TEXT':
        labels.append({
            'text': e.dxf.text.strip(),
            'point': Point(e.dxf.insert[0], e.dxf.insert[1]),
            'x': e.dxf.insert[0],
            'y': e.dxf.insert[1]
        })

# Zones: Isle zones
isle_zones = []
for e in msp:
    if e.dxf.layer == 'ZONES' and e.dxftype() == 'LWPOLYLINE':
        pts = e.get_points(format='xy')
        if len(pts) >= 3:
            poly = Polygon(pts)
            # Find isle label inside or touching
            contained_labels = [l for l in labels if poly.contains(l['point'])]
            if poly.area < 200: # Isle/gondola level zone
                name = contained_labels[0]['text'] if contained_labels else f"Zone-{e.dxf.handle}"
                isle_zones.append({
                    'handle': e.dxf.handle,
                    'poly': poly,
                    'name': name,
                    'area': poly.area
                })

print(f"Total Isle Zones: {len(isle_zones)}")

# Classify Area based on Y and X coordinates
# Y >= 73: Fresh Area
# Y < 73 and X < 64: Supermarket
# Y < 73 and X >= 64: Cashier Supermarket / Delica
for s in shelves:
    cy = s['centroid'].y
    cx = s['centroid'].x
    if cy >= 73.0:
        area = "Fresh Area"
    elif cx >= 64.0:
        area = "Cashier Supermarket"
    else:
        area = "Supermarket"
    s['area'] = area

    # Closest Isle zone
    contained_isles = [iz for iz in isle_zones if iz['poly'].contains(s['centroid'])]
    if contained_isles:
        s['isle'] = min(contained_isles, key=lambda z: z['area'])['name']
    else:
        # closest isle zone
        closest_iz = min(isle_zones, key=lambda z: z['poly'].distance(s['centroid']))
        s['isle'] = closest_iz['name']

    # Shelf name from closest label
    closest_l = min(labels, key=lambda l: s['poly'].distance(l['point']))
    s['shelf_name'] = closest_l['text']

df_sh = pd.DataFrame([{
    'id': s['handle'],
    'shelf': s['shelf_name'],
    'isle': s['isle'],
    'area': s['area']
} for s in shelves])

print("\nShelves by Area:")
print(df_sh['area'].value_counts())
print("\nTop Isles in Supermarket:")
print(df_sh[df_sh['area'] == 'Supermarket']['isle'].value_counts().head(10))
print("\nTop Isles in Fresh Area:")
print(df_sh[df_sh['area'] == 'Fresh Area']['isle'].value_counts().head(10))
