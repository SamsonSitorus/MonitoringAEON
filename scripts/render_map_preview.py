import json
import math
import numpy as np
import ezdxf
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Polygon as MplPoly

# 1. Load DXF
doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

# 2. Load Cameras Export
with open(r'k:\cameras_export.json', 'r', encoding='utf-8') as f:
    cam_export = json.load(f)

M_cad = np.array([
    [ 3.17935574e-02, -3.07566525e-05],
    [-5.69980481e-05, -3.18116765e-02],
    [ 1.71471055e-01,  1.07086377e+02]
])

cam_dict = {}
for p in cam_export.get('planned_cameras', []):
    cam_dict[p['id']] = dict(p, review_status='planned')
for c in cam_export.get('cameras', []):
    status = c.get('review_status', 'verified')
    cam_dict[c['id']] = dict(c, review_status=status)

fig, ax = plt.subplots(figsize=(18, 16), dpi=160)
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

# 3. Draw Camera FOV Cones
for cid, cam in cam_dict.items():
    px, py = cam['pos']
    pt_h = np.array([px, py, 1.0])
    cad_pt = pt_h @ M_cad
    cx, cy = float(cad_pt[0]), float(cad_pt[1])
    
    heading = float(cam.get('heading_deg', 0))
    fov = float(cam.get('fov_deg', 90))
    range_m = float(cam.get('range_m', 6))
    is_ver = cam.get('review_status') == 'verified'
    
    cone_color = '#10b981' if is_ver else '#f59e0b'
    cad_heading = -heading
    wedge = patches.Wedge(
        (cx, cy),
        r=range_m,
        theta1=cad_heading - fov / 2.0,
        theta2=cad_heading + fov / 2.0,
        facecolor=cone_color,
        edgecolor=cone_color,
        linewidth=0.6,
        alpha=0.18,
        linestyle='-' if is_ver else '--'
    )
    ax.add_patch(wedge)

# 4. Draw Camera Pins & Orientation
for cid, cam in cam_dict.items():
    px, py = cam['pos']
    pt_h = np.array([px, py, 1.0])
    cad_pt = pt_h @ M_cad
    cx, cy = float(cad_pt[0]), float(cad_pt[1])
    heading = float(cam.get('heading_deg', 0))
    is_ver = cam.get('review_status') == 'verified'
    pin_col = '#10b981' if is_ver else '#f59e0b'
    
    # Heading vector
    rad = math.radians(-heading)
    ax.annotate(
        "", xy=(cx + 1.8 * math.cos(rad), cy + 1.8 * math.sin(rad)), xytext=(cx, cy),
        arrowprops=dict(arrowstyle="->", color=pin_col, lw=1.2, mutation_scale=8)
    )
    
    # Circle pin
    ax.plot(cx, cy, marker='o', markersize=6, color=pin_col, markeredgecolor='#ffffff', markeredgewidth=0.7)

# 5. Draw prominent labels
for e in msp:
    if e.dxf.layer == 'LABELS' and e.dxftype() == 'TEXT':
        text = e.dxf.text.strip()
        if any(w in text.lower() for w in ['area', 'supermarket', 'entrance', 'cashier', 'walkway', 'delica', 'bakery']):
            ax.text(e.dxf.insert[0], e.dxf.insert[1], text, color='#f8fafc', fontsize=6.5, fontweight='bold', ha='center', va='center',
                    bbox=dict(boxstyle='round,pad=0.2', facecolor='#0f172a', edgecolor='#475569', lw=0.5, alpha=0.85))

# Legend
legend_patches = [
    patches.Patch(facecolor='#10b981', edgecolor='#34d399', alpha=0.5, label='Kamera Terverifikasi (58 Kamera) + FOV'),
    patches.Patch(facecolor='#f59e0b', edgecolor='#fbbf24', alpha=0.4, label='Kamera Terencana (54 Kamera) + FOV'),
    patches.Patch(facecolor='#38bdf8', edgecolor='#0284c7', label='Rak Gondola (949 Shelves)'),
    patches.Patch(facecolor='#1e293b', edgecolor='#475569', label='Zonasi Toko (75 Zones)')
]
ax.legend(handles=legend_patches, loc='lower right', fontsize=9, facecolor='#0b1329', edgecolor='#475569', framealpha=0.95)

ax.set_xlim(-2, 122)
ax.set_ylim(-2, 110)
ax.set_aspect('equal')
ax.axis('off')
plt.title("AEON Store Floor Plan — Denah Jaringan CCTV Kamera & Cakupan FOV (112 Kamera)", color='#f8fafc', fontsize=14, fontweight='bold', pad=14)
plt.tight_layout()
plt.savefig('map_preview.png', bbox_inches='tight', facecolor=fig.get_facecolor())
plt.close()
print("Saved map_preview.png successfully with 112 cameras and FOV cones!")
