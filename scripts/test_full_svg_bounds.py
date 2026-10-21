import ezdxf
from shapely.geometry import Polygon

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

MAX_Y = 108.0
SCALE = 20.0

def cad_to_svg(x, y):
    return round(float(x) * SCALE, 1), round((MAX_Y - float(y)) * SCALE, 1)

shelves_svg = []
for e in msp:
    if e.dxf.layer == 'SHELVES' and e.dxftype() == 'LWPOLYLINE':
        pts = e.get_points(format='xy')
        svg_pts = [cad_to_svg(x, y) for x, y in pts]
        shelves_svg.append(svg_pts)

min_sx = min(p[0] for s in shelves_svg for p in s)
max_sx = max(p[0] for s in shelves_svg for p in s)
min_sy = min(p[1] for s in shelves_svg for p in s)
max_sy = max(p[1] for s in shelves_svg for p in s)

print(f"Shelves in SVG ({len(shelves_svg)} shelves):")
print(f"  SX: [{min_sx}, {max_sx}], width = {max_sx - min_sx}")
print(f"  SY: [{min_sy}, {max_sy}], height = {max_sy - min_sy}")
