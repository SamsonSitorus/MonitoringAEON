import json
from shapely.geometry import Point, Polygon
import numpy as np

with open('backend/data/map_layout.json', 'r') as f:
    layout = json.load(f)

TRANS_A, TRANS_B, TRANS_C = 26.6727, 0.6225, 236.1826
TRANS_D, TRANS_E, TRANS_F = 1.2497, -26.8877, 3043.9879
M = np.array([[TRANS_A, TRANS_B], [TRANS_D, TRANS_E]])
M_inv = np.linalg.inv(M)
SCALE = 20.0
MAX_Y = 108.0

pts_raw = [
    (1339.44, 2037.35),
    (1260.80, 2048.56),
    (1299.94, 2066.10),
    (1355.44, 2054.14)
]

def analyze_points(pts_cad, title):
    print(f"\n=======================================================")
    print(f"=== {title} ===")
    print(f"=======================================================")
    for idx, (cx, cy) in enumerate(pts_cad):
        raw_x, raw_y = pts_raw[idx]
        pt = Point(cx, cy)
        print(f"\nTitik #{idx+1}: Raw ({raw_x}, {raw_y}) -> CAD Meter: (X={cx:.3f} m, Y={cy:.3f} m)")
        
        # Find nearest 3 shelves
        shelf_dists = []
        for s in layout['shelves']:
            poly_pts = [float(x) for p in s['svg_points'].split() for x in p.split(',')]
            poly_pts_cad = [(poly_pts[i]/SCALE, MAX_Y - poly_pts[i+1]/SCALE) for i in range(0, len(poly_pts), 2)]
            poly = Polygon(poly_pts_cad)
            dist = poly.distance(pt)
            shelf_dists.append((dist, s))
        
        shelf_dists.sort(key=lambda x: x[0])
        print("  Top 3 Rak Terdekat:")
        for d, s in shelf_dists[:3]:
            print(f"    - Jarak: {d:.2f} m | ID Shelf: {s['id']} | Nama Rak: \"{s['name']}\" | Isle/Lorong: \"{s['isle']}\" | Area: \"{s['area']}\"")
        
        # Check zones
        zone_matches = []
        for z in layout['zones']:
            poly_pts = [float(x) for p in z['svg_points'].split() for x in p.split(',')]
            poly_pts_cad = [(poly_pts[i]/SCALE, MAX_Y - poly_pts[i+1]/SCALE) for i in range(0, len(poly_pts), 2)]
            poly = Polygon(poly_pts_cad)
            if poly.contains(pt):
                zone_matches.append((0, z))
            else:
                dist = poly.distance(pt)
                zone_matches.append((dist, z))
        zone_matches.sort(key=lambda x: x[0])
        print(f"  Zona Toko: {zone_matches[0][1]['name']} (Jarak ke zona: {zone_matches[0][0]:.2f} m)")

# 1. Parquet Interpretation
pts_parquet_cad = []
for px, py in pts_raw:
    p_adj = np.array([px - TRANS_C, py - TRANS_F])
    cx, cy = M_inv @ p_adj
    pts_parquet_cad.append((cx, cy))

analyze_points(pts_parquet_cad, "INTERPRETASI 1: KOORDINAT DARI DATA EVENT PARQUET (x_coordinate, y_coordinate)")

# 2. SVG Interpretation
pts_svg_cad = []
for sx, sy in pts_raw:
    cx = sx / SCALE
    cy = MAX_Y - (sy / SCALE)
    pts_svg_cad.append((cx, cy))

analyze_points(pts_svg_cad, "INTERPRETASI 2: KOORDINAT DARI DENAH GAMBAR / SVG (Screen / SVG Coordinates)")
