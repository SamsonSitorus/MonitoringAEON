import ezdxf
import numpy as np
from shapely.geometry import Polygon, Point, MultiPolygon
from shapely.ops import unary_union

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

# Collect zones
zones = []
for e in msp:
    if e.dxf.layer == 'ZONES' and e.dxftype() == 'LWPOLYLINE':
        pts = e.get_points(format='xy')
        if len(pts) >= 3:
            try:
                poly = Polygon(pts)
                if poly.is_valid and poly.area > 0:
                    zones.append(poly)
            except Exception:
                pass

print(f"Valid zones: {len(zones)}")

# Collect labels
labels = []
for e in msp:
    if e.dxf.layer == 'LABELS' and e.dxftype() == 'TEXT':
        text = e.dxf.text.strip()
        pt = (e.dxf.insert[0], e.dxf.insert[1])
        height = e.dxf.height
        labels.append((text, Point(pt), height, pt))

print(f"Total labels: {len(labels)}")

# Collect shelves
shelves = []
for e in msp:
    if e.dxf.layer == 'SHELVES' and e.dxftype() == 'LWPOLYLINE':
        pts = e.get_points(format='xy')
        if len(pts) >= 3:
            try:
                poly = Polygon(pts)
                if poly.is_valid and poly.area > 0:
                    shelves.append((e.dxf.handle, poly, pts))
            except Exception:
                pass

print(f"Valid shelves: {len(shelves)}")

# Check containment of shelves in zones
contained_count = 0
for handle, spoly, pts in shelves:
    center = spoly.centroid
    in_zone = False
    for z in zones:
        if z.contains(center):
            in_zone = True
            break
    if in_zone:
        contained_count += 1

print(f"Shelves contained in zones: {contained_count} / {len(shelves)}")
