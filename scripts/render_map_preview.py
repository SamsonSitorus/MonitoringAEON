import ezdxf
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPoly

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

fig, ax = plt.subplots(figsize=(16, 14), dpi=150)
ax.set_facecolor('#0f172a')
fig.patch.set_facecolor('#0f172a')

# 1. Draw Zones (Aisles / Sections)
for e in msp:
    if e.dxf.layer == 'ZONES' and e.dxftype() == 'LWPOLYLINE':
        pts = e.get_points(format='xy')
        if len(pts) >= 3:
            poly = MplPoly(pts, closed=True, fill=True, facecolor='#1e293b', edgecolor='#475569', linewidth=0.8, alpha=0.5)
            ax.add_patch(poly)

# 2. Draw Shelves
for e in msp:
    if e.dxf.layer == 'SHELVES' and e.dxftype() == 'LWPOLYLINE':
        pts = e.get_points(format='xy')
        if len(pts) >= 3:
            poly = MplPoly(pts, closed=True, fill=True, facecolor='#38bdf8', edgecolor='#0284c7', linewidth=0.5, alpha=0.8)
            ax.add_patch(poly)

# 3. Draw Cameras
for e in msp:
    if e.dxf.layer == 'CAMERAS' and e.dxftype() == 'CIRCLE':
        c = plt.Circle((e.dxf.center[0], e.dxf.center[1]), 0.6, color='#f43f5e', alpha=0.8)
        ax.add_patch(c)

# 4. Draw prominent labels
for e in msp:
    if e.dxf.layer == 'LABELS' and e.dxftype() == 'TEXT':
        text = e.dxf.text.strip()
        # Draw zone/prominent labels
        if any(w in text.lower() for w in ['area', 'supermarket', 'entrance', 'cashier', 'walkway', 'delica', 'bakery']):
            ax.text(e.dxf.insert[0], e.dxf.insert[1], text, color='#f8fafc', fontsize=6, fontweight='bold', ha='center', va='center')

ax.set_xlim(-2, 122)
ax.set_ylim(-2, 110)
ax.set_aspect('equal')
ax.axis('off')
plt.title("AEON Store Floor Plan (CAD Modelspace)", color='#f8fafc', fontsize=14, pad=12)
plt.tight_layout()
plt.savefig('map_preview.png', bbox_inches='tight', facecolor=fig.get_facecolor())
print("Saved map_preview.png successfully!")
