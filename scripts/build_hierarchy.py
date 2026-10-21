import ezdxf
from shapely.geometry import Polygon, Point
import json
import pandas as pd


doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

# 1. Labels
labels = []
for e in msp:
    if e.dxf.layer == 'LABELS' and e.dxftype() == 'TEXT':
        labels.append({
            'text': e.dxf.text.strip(),
            'point': Point(e.dxf.insert[0], e.dxf.insert[1]),
            'x': e.dxf.insert[0],
            'y': e.dxf.insert[1],
            'height': e.dxf.height
        })

# 2. Zones (Isles / Sections / Areas)
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
                    'pts': pts
                })

# Assign names to zones
# Major Areas: Fresh Area, Supermarket, Delica Area, Bakery, Walkway, Seating, Cashier
MAJOR_AREAS = [
    'Fresh Area', 'Supermarket', 'Delica Area', 'Bakery', 'Cashier Supermarket', 
    'Walkway', 'Pharmacy / HBC', 'Seating Area', 'Event'
]

# Sort zones by area descending so parent areas encompass child zones
zones.sort(key=lambda z: z['area'], reverse=True)

# Find labels inside each zone
for z in zones:
    z['contained_labels'] = [l for l in labels if z['poly'].contains(l['point'])]
    # Find name
    # If any major area label is inside:
    major_match = [l['text'] for l in z['contained_labels'] if any(ma.lower() in l['text'].lower() for ma in MAJOR_AREAS)]
    z['major_name'] = major_match[0] if major_match else None
    
    # Primary label (e.g. aisle name)
    z['name'] = z['contained_labels'][0]['text'] if z['contained_labels'] else f"Zone-{z['handle']}"

# 3. Shelves
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

# Map each shelf to closest label (Shelf Name)
# And map shelf to containing zones: smallest containing zone is Isle, largest containing zone is Area!
shelf_hierarchy = []
for s in shelves:
    # 1. Shelf name from closest label
    closest_l = min(labels, key=lambda l: s['poly'].distance(l['point']))
    shelf_name = closest_l['text']
    
    # 2. Containing zones (sorted by area ascending: first is smallest/isle, last is largest/area)
    containing_zones = [z for z in zones if z['poly'].contains(s['centroid'])]
    containing_zones.sort(key=lambda z: z['area'])
    
    if len(containing_zones) >= 2:
        isle_zone = containing_zones[0]
        area_zone = containing_zones[-1]
        isle_name = isle_zone['name']
        area_name = area_zone['major_name'] or area_zone['name']
    elif len(containing_zones) == 1:
        isle_zone = containing_zones[0]
        isle_name = isle_zone['name']
        area_name = isle_zone['major_name'] or "Supermarket"
    else:
        # Fallback to closest zone
        closest_z = min(zones, key=lambda z: z['poly'].distance(s['centroid']))
        isle_name = closest_z['name']
        area_name = closest_z['major_name'] or "Supermarket"
        
    shelf_hierarchy.append({
        'shelf_id': s['handle'],
        'shelf_name': shelf_name,
        'isle_name': isle_name,
        'area_name': area_name,
        'bounds': s['poly'].bounds
    })

df_sh = pd.DataFrame(shelf_hierarchy)
print("Hierarchy Summary:")
print(f"Total shelves: {len(df_sh)}")
print("\nUnique Areas:")
print(df_sh['area_name'].value_counts())
print("\nUnique Isles (top 20):")
print(df_sh['isle_name'].value_counts().head(20))
print("\nSample Shelves:")
print(df_sh.sample(10)[['shelf_id', 'shelf_name', 'isle_name', 'area_name']].to_string())
