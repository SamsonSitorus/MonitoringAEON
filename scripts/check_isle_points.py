import json
from shapely.geometry import Point, Polygon

with open('backend/data/map_layout.json', 'r') as f:
    layout = json.load(f)

pts_raw = [
    (1339.44, 2037.35),
    (1260.80, 2048.56),
    (1299.94, 2066.10),
    (1355.44, 2054.14)
]

pts_cad = [
    (40.445, 39.318),  # Point 1 (1339.44, 2037.35)
    (37.510, 38.765),  # Point 2 (1260.80, 2048.56)
    (38.991, 38.182),  # Point 3 (1299.94, 2066.10)
    (41.059, 38.723),  # Point 4 (1355.44, 2054.14)
]

xs = [p[0] for p in pts_cad]
ys = [p[1] for p in pts_cad]

print("=== ANALISIS SEBARAN KOORDINAT ===")
print(f"Sebaran Sumbu X: {min(xs):.3f} m s/d {max(xs):.3f} m (Rentang: {max(xs)-min(xs):.2f} meter)")
print(f"Sebaran Sumbu Y: {min(ys):.3f} m s/d {max(ys):.3f} m (Rentang: {max(ys)-min(ys):.2f} meter)")

print("\n=== PEMETAAN SETIAP TITIK KE ISLE TERDEKAT ===")
for i, pt in enumerate(pts_cad):
    p = Point(pt)
    dists = []
    for s in layout['shelves']:
        poly_pts = [float(x) for x_str in s['svg_points'].split() for x in x_str.split(',')]
        poly_cad = [(poly_pts[j]/20.0, 108.0 - poly_pts[j+1]/20.0) for j in range(0, len(poly_pts), 2)]
        poly = Polygon(poly_cad)
        dists.append((poly.distance(p), s['isle'], s['name'], s['id']))
    dists.sort(key=lambda x: x[0])
    raw = pts_raw[i]
    print(f"Titik #{i+1} Raw ({raw[0]}, {raw[1]}) -> CAD ({pt[0]:.2f}m, {pt[1]:.2f}m):")
    print(f"  -> ISLE: \"{dists[0][1]}\" (Jarak: {dists[0][0]:.2f} meter ke rak '{dists[0][2]}', ID: {dists[0][3]})")

# Check all shelves in this bounding box
print("\n=== BATAS FISIK LORONG Baking & Specialty Rice ===")
isle_shelves = [s for s in layout['shelves'] if s['isle'] == 'Baking & Specialty Rice']
print(f"Total rak dalam Isle 'Baking & Specialty Rice': {len(isle_shelves)} rak")
isle_xs = []
isle_ys = []
for s in isle_shelves:
    isle_xs.append(s['cad_centroid'][0])
    isle_ys.append(s['cad_centroid'][1])

print(f"Batas Lorong: X dari {min(isle_xs):.2f} m s/d {max(isle_xs):.2f} m")
print(f"Batas Lorong: Y dari {min(isle_ys):.2f} m s/d {max(isle_ys):.2f} m")
