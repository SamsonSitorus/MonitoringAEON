import ezdxf
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPoly
import pyarrow.parquet as pq
import numpy as np

# Inverse affine matrix
a, b, c = 26.6727, 0.6225, 236.1826
d, e, f = 1.2497, -26.8877, 3043.9879
M = np.array([[a, b], [d, e]])
M_inv = np.linalg.inv(M)

def parquet_to_dxf(px, py):
    p_adj = np.vstack([px - c, py - f])
    dxf_coords = M_inv @ p_adj
    return dxf_coords[0], dxf_coords[1]

# Load DXF
doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

fig, ax = plt.subplots(figsize=(16, 14), dpi=150)
ax.set_facecolor('#0b0f19')
fig.patch.set_facecolor('#0b0f19')

# Draw Zones
for e in msp:
    if e.dxf.layer == 'ZONES' and e.dxftype() == 'LWPOLYLINE':
        pts = e.get_points(format='xy')
        if len(pts) >= 3:
            poly = MplPoly(pts, closed=True, fill=True, facecolor='#1e293b', edgecolor='#334155', linewidth=0.6, alpha=0.4)
            ax.add_patch(poly)

# Draw Shelves
for e in msp:
    if e.dxf.layer == 'SHELVES' and e.dxftype() == 'LWPOLYLINE':
        pts = e.get_points(format='xy')
        if len(pts) >= 3:
            poly = MplPoly(pts, closed=True, fill=True, facecolor='#3b82f6', edgecolor='#1d4ed8', linewidth=0.4, alpha=0.6)
            ax.add_patch(poly)

# Load 15,000 shopper events
file_path = r'k:\ai-shopper-events-2026-10-01-2026-10-17-final-20261018f-identity-split\ai_shopper_events_2026-10-14.parquet'
table = pq.read_table(file_path, columns=['x_coordinate', 'y_coordinate', 'action_code'])
df = table.slice(0, 15000).to_pandas()

dx, dy = parquet_to_dxf(df['x_coordinate'].values, df['y_coordinate'].values)

# Scatter shopper events
# Use yellow/orange for shopper events with transparency
ax.scatter(dx, dy, s=1.5, c='#f59e0b', alpha=0.25, edgecolors='none', label='Shopper Events')

ax.set_xlim(20, 75)
ax.set_ylim(25, 90)
ax.set_aspect('equal')
ax.axis('off')
plt.title("Shopper Events Overlay on Supermarket Shelves & Aisles (2026-10-14)", color='#f8fafc', fontsize=14, pad=12)
plt.tight_layout()
plt.savefig('shopper_events_overlay.png', bbox_inches='tight', facecolor=fig.get_facecolor())
print("Saved shopper_events_overlay.png successfully!")
