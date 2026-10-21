import ezdxf
import pyarrow.parquet as pq
import numpy as np
import time
from shapely.geometry import Polygon, Point
from shapely.strtree import STRtree
import pandas as pd

t0 = time.time()

# 1. Transformation
a, b, c = 26.6727, 0.6225, 236.1826
d, e, f = 1.2497, -26.8877, 3043.9879
M = np.array([[a, b], [d, e]])
M_inv = np.linalg.inv(M)

def parquet_to_dxf(px, py):
    p_adj = np.vstack([px - c, py - f])
    dxf_coords = M_inv @ p_adj
    return dxf_coords[0], dxf_coords[1]

# 2. Shelves from DXF
doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

shelf_list = []
shelf_geoms = []
for entity in msp:
    if entity.dxf.layer == 'SHELVES' and entity.dxftype() == 'LWPOLYLINE':
        pts = entity.get_points(format='xy')
        poly = Polygon(pts)
        shelf_list.append({
            'handle': entity.dxf.handle,
            'pts': pts,
            'centroid': (poly.centroid.x, poly.centroid.y)
        })
        shelf_geoms.append(poly)

print(f"Loaded {len(shelf_geoms)} shelves in {time.time()-t0:.2f}s")

# 3. Read full parquet (884k rows)
t1 = time.time()
file_path = r'k:\ai-shopper-events-2026-10-01-2026-10-17-final-20261018f-identity-split\ai_shopper_events_2026-10-14.parquet'
table = pq.read_table(file_path, columns=['x_coordinate', 'y_coordinate', 'action_code'])
df = table.to_pandas()
print(f"Read {len(df)} rows in {time.time()-t1:.2f}s")

# 4. Transform coordinates in vectorized numpy
t2 = time.time()
px = df['x_coordinate'].values
py = df['y_coordinate'].values
p_adj = np.vstack([px - c, py - f])
dxf_coords = M_inv @ p_adj
dx = dxf_coords[0]
dy = dxf_coords[1]
print(f"Transformed coordinates in {time.time()-t2:.2f}s")

# 5. Spatial query with STRtree
t3 = time.time()
tree = STRtree(shelf_geoms)
pts = [Point(x, y) for x, y in zip(dx, dy)]
nearest_indices = tree.nearest(pts)

# Compute distances
MAX_DISTANCE = 1.0 # 1 meter buffer
mapped_shelf_counts = {}
unmapped_count = 0

# Vectorized distance or batch distance check
# To make it fast, we can test distance to nearest shelf
for i, (p, s_idx) in enumerate(zip(pts, nearest_indices)):
    s_geom = shelf_geoms[s_idx]
    dist = s_geom.distance(p)
    if dist <= MAX_DISTANCE:
        handle = shelf_list[s_idx]['handle']
        mapped_shelf_counts[handle] = mapped_shelf_counts.get(handle, 0) + 1
    else:
        unmapped_count += 1

total_mapped = sum(mapped_shelf_counts.values())
print(f"Mapping completed in {time.time()-t3:.2f}s")
print(f"Total events: {len(df)}")
print(f"Total mapped (dist <= {MAX_DISTANCE}m): {total_mapped} ({total_mapped/len(df)*100:.2f}%)")
print(f"Total unmapped: {unmapped_count} ({unmapped_count/len(df)*100:.2f}%)")
print(f"Shelves with >= 1 event: {len(mapped_shelf_counts)} / {len(shelf_geoms)}")
max_shelf = max(mapped_shelf_counts.items(), key=lambda x: x[1])
print(f"Highest event shelf: {max_shelf[0]} with {max_shelf[1]} events")
