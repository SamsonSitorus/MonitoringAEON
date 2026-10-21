import pyarrow.parquet as pq
import pandas as pd
import numpy as np
from shapely.geometry import Polygon, Point
from shapely.strtree import STRtree
import ezdxf

a, b, c = 26.6727, 0.6225, 236.1826
d, e, f = 1.2497, -26.8877, 3043.9879
M = np.array([[a, b], [d, e]])
M_inv = np.linalg.inv(M)

def parquet_to_dxf(px, py):
    p_adj = np.vstack([px - c, py - f])
    dxf_coords = M_inv @ p_adj
    return dxf_coords[0], dxf_coords[1]

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()
shelves = []
for entity in msp:
    if entity.dxf.layer == 'SHELVES' and entity.dxftype() == 'LWPOLYLINE':
        pts = entity.get_points(format='xy')
        poly = Polygon(pts)
        shelves.append(poly)

tree = STRtree(shelves)

file_path = r'k:\ai-shopper-events-2026-10-01-2026-10-17-final-20261018f-identity-split\ai_shopper_events_2026-10-14.parquet'
table = pq.read_table(file_path, columns=['x_coordinate', 'y_coordinate', 'action_code'])
df = table.slice(0, 20000).to_pandas()

dx, dy = parquet_to_dxf(df['x_coordinate'].values, df['y_coordinate'].values)
pts = [Point(x, y) for x, y in zip(dx, dy)]
nearest_idx = tree.nearest(pts)
df['dist'] = [shelves[i].distance(p) for p, i in zip(pts, nearest_idx)]

print(df.groupby('action_code')['dist'].describe())
