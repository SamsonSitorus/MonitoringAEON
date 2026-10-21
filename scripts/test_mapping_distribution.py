import ezdxf
import pyarrow.parquet as pq
import pandas as pd
import numpy as np
from shapely.geometry import Polygon, Point, box
from shapely.strtree import STRtree

# 1. Transform matrix: dxf -> parquet
# px = a * dx + b * dy + c
# py = d * dx + e * dy + f
# Invert matrix to map parquet (px, py) -> dxf (dx, dy)
# [px - c]   [a b] [dx]
# [py - f] = [d e] [dy]
# [dx]   [a b]^-1 [px - c]
# [dy] = [d e]    [py - f]

a, b, c = 26.6727, 0.6225, 236.1826
d, e, f = 1.2497, -26.8877, 3043.9879

M = np.array([[a, b], [d, e]])
M_inv = np.linalg.inv(M)

def parquet_to_dxf(px, py):
    p_adj = np.vstack([px - c, py - f])
    dxf_coords = M_inv @ p_adj
    return dxf_coords[0], dxf_coords[1]

# 2. Load shelves from DXF
doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

shelves = []
for entity in msp:
    if entity.dxf.layer == 'SHELVES' and entity.dxftype() == 'LWPOLYLINE':
        pts = entity.get_points(format='xy')
        poly = Polygon(pts)
        shelves.append({
            'handle': entity.dxf.handle,
            'poly': poly,
            'pts': pts
        })

print(f"Loaded {len(shelves)} shelves.")

# 3. Read sample of 10,000 parquet events from 2026-10-14
file_path = r'k:\ai-shopper-events-2026-10-01-2026-10-17-final-20261018f-identity-split\ai_shopper_events_2026-10-14.parquet'
table = pq.read_table(file_path, columns=['x_coordinate', 'y_coordinate', 'action_code'])
df = table.slice(0, 10000).to_pandas()

# Convert coordinates to DXF
dx, dy = parquet_to_dxf(df['x_coordinate'].values, df['y_coordinate'].values)
df['dxf_x'] = dx
df['dxf_y'] = dy

# Spatial index of shelves
shelf_geoms = [s['poly'] for s in shelves]
tree = STRtree(shelf_geoms)

# Check distances to closest shelf
pts = [Point(x, y) for x, y in zip(dx, dy)]
nearest_indices = tree.nearest(pts)

distances = []
for p, s_idx in zip(pts, nearest_indices):
    s = shelf_geoms[s_idx]
    d = s.distance(p)
    distances.append(d)

distances = np.array(distances)
print("Distances to closest shelf (meters):")
print(f"  Min: {distances.min():.3f} m")
print(f"  25th percentile: {np.percentile(distances, 25):.3f} m")
print(f"  Median: {np.percentile(distances, 50):.3f} m")
print(f"  75th percentile: {np.percentile(distances, 75):.3f} m")
print(f"  90th percentile: {np.percentile(distances, 90):.3f} m")
print(f"  Max: {distances.max():.3f} m")

# How many are within 1.0 meter (shopper standing in front of shelf)?
within_1m = (distances <= 1.0).sum()
within_1_5m = (distances <= 1.5).sum()
print(f"Events within 1.0m of shelf: {within_1m} / 10000 ({within_1m/100:.1f}%)")
print(f"Events within 1.5m of shelf: {within_1_5m} / 10000 ({within_1_5m/100:.1f}%)")
