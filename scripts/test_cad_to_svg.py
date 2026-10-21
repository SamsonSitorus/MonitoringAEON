import ezdxf
from shapely.geometry import Polygon, Point
import json

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

# Transform CAD (cx, cy) to SVG (sx, sy)
# Supermarket and Fresh area bounds: X [21, 74], Y [25, 88]
# Let's set viewBox="0 0 1100 1350"
# Scale: 20 units per meter
OFFSET_X = 21.0
OFFSET_Y = 88.0
SCALE = 20.0

def cad_to_svg(cx, cy):
    sx = round((cx - OFFSET_X) * SCALE, 1)
    sy = round((OFFSET_Y - cy) * SCALE, 1)
    return sx, sy

# Test with a shelf
for e in msp:
    if e.dxf.layer == 'SHELVES' and e.dxftype() == 'LWPOLYLINE':
        pts = e.get_points(format='xy')
        svg_pts = [cad_to_svg(x, y) for x, y in pts]
        print(f"Shelf {e.dxf.handle}: CAD pts {pts[:2]} -> SVG pts {svg_pts[:2]}")
        break
