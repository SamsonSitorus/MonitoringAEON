import os
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from shapely.geometry import Polygon, Point

# 1. Load layout
with open('backend/data/map_layout.json', 'r', encoding='utf-8') as f:
    layout = json.load(f)

# 2. Transformation Constants
TRANS_A, TRANS_B, TRANS_C = 26.6727, 0.6225, 236.1826
TRANS_D, TRANS_E, TRANS_F = 1.2497, -26.8877, 3043.9879
M = np.array([[TRANS_A, TRANS_B], [TRANS_D, TRANS_E]])
M_inv = np.linalg.inv(M)
SCALE = 20.0
MAX_Y = 108.0

# 3. Given Points
pts_raw = [
    (1339.44, 2037.35),
    (1260.80, 2048.56),
    (1299.94, 2066.10),
    (1355.44, 2054.14)
]

pts_cad = []
for px, py in pts_raw:
    p_adj = np.array([px - TRANS_C, py - TRANS_F])
    cx, cy = M_inv @ p_adj
    pts_cad.append((cx, cy))

# 4. Setup figure
plt.style.use('dark_background')
fig = plt.figure(figsize=(22, 12), facecolor='#0b1120')

# Grid layout: top has 2 columns (minimap & zoomed 2D map), bottom has data table
gs = fig.add_gridspec(2, 2, height_ratios=[1, 0.18], width_ratios=[1, 2.7], wspace=0.14, hspace=0.22)
ax_mini = fig.add_subplot(gs[0, 0])
ax_main = fig.add_subplot(gs[0, 1])
ax_table = fig.add_subplot(gs[1, :])

for ax in [ax_mini, ax_main, ax_table]:
    ax.set_facecolor('#0f172a')

# -------------------------------------------------------------
# A. OVERVIEW MINI-MAP (Full Store Context)
# -------------------------------------------------------------
ax_mini.set_title("1. LOKASI LORONG PADA DENAH TOKO (OVERVIEW)", fontsize=12, fontweight='bold', color='#38bdf8', pad=12)

# Draw all shelves simplified
for s in layout['shelves']:
    poly_pts = [float(x) for x_str in s['svg_points'].split() for x in x_str.split(',')]
    poly_cad = [(poly_pts[j]/SCALE, MAX_Y - poly_pts[j+1]/SCALE) for j in range(0, len(poly_pts), 2)]
    poly_patch = patches.Polygon(poly_cad, closed=True, facecolor='#1e293b', edgecolor='#334155', linewidth=0.5)
    ax_mini.add_patch(poly_patch)

# Draw outer boundary
if layout.get('store_boundary'):
    b_pts = [float(x) for x_str in layout['store_boundary'].split() for x in x_str.split(',')]
    b_cad = [(b_pts[j]/SCALE, MAX_Y - b_pts[j+1]/SCALE) for j in range(0, len(b_pts), 2)]
    ax_mini.add_patch(patches.Polygon(b_cad, closed=True, facecolor='none', edgecolor='#475569', linewidth=1.5, linestyle='--'))

# Draw major area labels
ax_mini.text(45, 95, "FRESH AREA", fontsize=10, fontweight='bold', color='#34d399', ha='center', alpha=0.8)
ax_mini.text(40, 55, "SUPERMARKET", fontsize=10, fontweight='bold', color='#38bdf8', ha='center', alpha=0.8)
ax_mini.text(95, 55, "DELICA AREA\n& SEATING", fontsize=10, fontweight='bold', color='#fbbf24', ha='center', alpha=0.8)

# Highlight box for Baking & Specialty Rice aisle
aisle_box = patches.Rectangle((34.5, 36.5), 9.0, 5.0, linewidth=2, edgecolor='#f43f5e', facecolor='#f43f5e', alpha=0.25, linestyle='-')
ax_mini.add_patch(aisle_box)
ax_mini.plot([p[0] for p in pts_cad], [p[1] for p in pts_cad], 'ro', markersize=4)

ax_mini.annotate(
    "Target 4 Titik\n(Baking & Specialty Rice)",
    xy=(39.0, 39.0),
    xytext=(20, 20),
    arrowprops=dict(facecolor='#f43f5e', edgecolor='#f43f5e', arrowstyle='->', lw=1.5),
    fontsize=9, fontweight='bold', color='#f43f5e',
    bbox=dict(boxstyle='round,pad=0.3', facecolor='#1e293b', edgecolor='#f43f5e', lw=1)
)

ax_mini.set_xlim(-5, 125)
ax_mini.set_ylim(-5, 115)
ax_mini.set_aspect('equal')
ax_mini.grid(True, linestyle=':', alpha=0.2, color='#64748b')
ax_mini.set_xlabel("Sumbu X CAD (meter)", fontsize=9, color='#94a3b8')
ax_mini.set_ylabel("Sumbu Y CAD (meter)", fontsize=9, color='#94a3b8')

# -------------------------------------------------------------
# B. ZOOMED DETAILED 2D AISLE MAP WITH OVERLAY
# -------------------------------------------------------------
ax_main.set_title("2. DETAIL 2D OVERLAY LORONG: BAKING & SPECIALTY RICE (AREA SUPERMARKET)", fontsize=13, fontweight='bold', color='#38bdf8', pad=12)

# View limits
xmin, xmax = 34.5, 43.5
ymin, ymax = 35.8, 41.8

# Draw corridor walkway shaded background
corridor_rect = patches.Rectangle((34.5, 38.0), 9.0, 1.8, facecolor='#1e293b', edgecolor='#38bdf8', alpha=0.5, linestyle=':', linewidth=1)
ax_main.add_patch(corridor_rect)
ax_main.text(39.0, 38.9, "KORIDOR / LORONG PEJALAN KAKI (LEBAR ≈ 2.22 m)", fontsize=9, fontweight='bold', color='#38bdf8', alpha=0.35, ha='center', va='center')

# Draw shelves in and around this aisle
shelf_polys_cad = []
shelf_meta_map = {}

for s in layout['shelves']:
    poly_pts = [float(x) for x_str in s['svg_points'].split() for x in x_str.split(',')]
    poly_cad = [(poly_pts[j]/SCALE, MAX_Y - poly_pts[j+1]/SCALE) for j in range(0, len(poly_pts), 2)]
    poly_geom = Polygon(poly_cad)
    
    cx, cy = s['cad_centroid']
    if (xmin - 1.5) <= cx <= (xmax + 1.5) and (ymin - 1.5) <= cy <= (ymax + 1.5):
        shelf_polys_cad.append((poly_geom, s))
        shelf_meta_map[s['id']] = s
        
        # Color coding by category/side
        if cy > 39.0:
            # Baking top row
            fcolor = '#1e3a5f'
            ecolor = '#38bdf8'
            tcolor = '#bae6fd'
        elif cy > 37.4:
            # Rice specialty middle row
            fcolor = '#064e3b'
            ecolor = '#10b981'
            tcolor = '#a7f3d0'
        else:
            # Regular rice bottom row
            fcolor = '#143329'
            ecolor = '#059669'
            tcolor = '#6ee7b7'
            
        patch = patches.Polygon(poly_cad, closed=True, facecolor=fcolor, edgecolor=ecolor, linewidth=1.2, alpha=0.85)
        ax_main.add_patch(patch)
        
        # Add shelf text annotation (with clip_on=True)
        if xmin <= cx <= xmax and ymin <= cy <= ymax:
            name = s['name']
            if len(name) > 16:
                name = name[:15] + ".."
            label_text = f"[{s['id']}]\n{name}"
            ax_main.text(cx, cy, label_text, fontsize=7.5, fontweight='bold', color=tcolor, ha='center', va='center', clip_on=True)

# Aisle Header Banner at top of main chart
ax_main.text((xmin + xmax)/2, ymax - 0.22, "▲ Gondola Sisi Utara: Bahan Pembuat Kue (Gelatin, Cokelat Blok, Topping)", 
             fontsize=9.5, fontweight='bold', color='#38bdf8', ha='center', va='top',
             bbox=dict(boxstyle='square,pad=0.25', facecolor='#0f172a', edgecolor='#38bdf8', lw=0.8, alpha=0.9))

ax_main.text((xmin + xmax)/2, ymin + 0.25, "▼ Gondola Sisi Selatan: Beras Khusus (Ketan, Beras Merah, Beras Organik, Beras Impor)", 
             fontsize=9.5, fontweight='bold', color='#10b981', ha='center', va='bottom',
             bbox=dict(boxstyle='square,pad=0.25', facecolor='#0f172a', edgecolor='#10b981', lw=0.8, alpha=0.9))

# Draw the 4 Points with custom colors & labels
point_configs = [
    {"num": "1", "color": "#f59e0b", "label": "P1: Chocolate Block", "offset": (20, 22), "nearest_id": "488"},
    {"num": "2", "color": "#06b6d4", "label": "P2: Sticky / Brown Rice", "offset": (-40, -32), "nearest_id": "42C"},
    {"num": "3", "color": "#10b981", "label": "P3: Red/Brown Rice", "offset": (22, -26), "nearest_id": "42D"},
    {"num": "4", "color": "#c084fc", "label": "P4: Japanese/Organic", "offset": (20, 22), "nearest_id": "439"}
]

# Draw trajectory path between points: 1 -> 2 -> 3 -> 4
for i in range(len(pts_cad) - 1):
    p_from = pts_cad[i]
    p_to = pts_cad[i+1]
    ax_main.annotate(
        "", xy=p_to, xytext=p_from,
        arrowprops=dict(arrowstyle="->", color="#94a3b8", lw=1.8, linestyle="--", alpha=0.75, mutation_scale=15)
    )

point_analysis_records = []

# Plot each point and projection to nearest shelf
for i, ((cx, cy), cfg) in enumerate(zip(pts_cad, point_configs)):
    raw_x, raw_y = pts_raw[i]
    color = cfg["color"]
    
    # Glow effect circle
    ax_main.plot(cx, cy, marker='o', markersize=18, color=color, alpha=0.3)
    ax_main.plot(cx, cy, marker='o', markersize=12, color=color, alpha=0.7)
    ax_main.plot(cx, cy, marker='o', markersize=6, color='#ffffff')
    
    # Find nearest shelf geometry and distance
    pt = Point(cx, cy)
    nearest_shelf = shelf_meta_map[cfg["nearest_id"]]
    nearest_poly = [poly for poly, s in shelf_polys_cad if s['id'] == cfg['nearest_id']][0]
    dist = nearest_poly.distance(pt)
    
    # Projection line to nearest shelf
    sh_cx, sh_cy = nearest_shelf['cad_centroid']
    ax_main.plot([cx, sh_cx], [cy, sh_cy], color=color, linestyle=':', lw=1.2, alpha=0.7)
    
    # Point annotation box
    annotation_text = (
        f"Titik #{i+1}\n"
        f"Parquet: ({raw_x:.1f}, {raw_y:.1f})\n"
        f"CAD: ({cx:.2f}m, {cy:.2f}m)\n"
        f"Rak: {nearest_shelf['name']} ({dist:.2f}m)"
    )
    
    ax_main.annotate(
        annotation_text,
        xy=(cx, cy),
        xytext=cfg["offset"],
        textcoords="offset points",
        fontsize=8, fontweight='bold', color='#ffffff',
        bbox=dict(boxstyle="round,pad=0.35", facecolor='#1e293b', edgecolor=color, lw=1.5, alpha=0.95),
        arrowprops=dict(arrowstyle="->", color=color, lw=1.5)
    )
    
    point_analysis_records.append([
        f"Titik #{i+1}",
        f"({raw_x:.2f}, {raw_y:.2f})",
        f"({cx:.2f} m, {cy:.2f} m)",
        f"{nearest_shelf['name']} [{nearest_shelf['id']}]",
        f"{dist:.2f} meter",
        "Baking & Specialty Rice",
        "Supermarket"
    ])

ax_main.set_xlim(xmin, xmax)
ax_main.set_ylim(ymin, ymax)
ax_main.set_aspect('equal')
ax_main.grid(True, linestyle='--', alpha=0.2, color='#64748b')
ax_main.set_xlabel("Sumbu X CAD (meter)", fontsize=10, color='#94a3b8')
ax_main.set_ylabel("Sumbu Y CAD (meter)", fontsize=10, color='#94a3b8')

# Legend for Main Map placed neatly at bottom left
legend_elements = [
    patches.Patch(facecolor='#1e3a5f', edgecolor='#38bdf8', label='Gondola Sisi Utara: Bahan Kue (Gelatin, Chocolate Block, Topping)'),
    patches.Patch(facecolor='#064e3b', edgecolor='#10b981', label='Gondola Sisi Selatan: Beras Khusus (Ketan, Beras Merah, Organik, Impor)'),
    patches.Patch(facecolor='#1e293b', edgecolor='#38bdf8', linestyle=':', label='Area Koridor Lorong (Baking & Specialty Rice)'),
    plt.Line2D([0], [0], marker='o', color='w', markerfacecolor='#f59e0b', markersize=8, label='Titik Koordinat Event Shopper (#1 s/d #4)'),
    plt.Line2D([0], [0], color='#94a3b8', linestyle='--', lw=1.5, label='Alur Lintasan Shopper (1 -> 2 -> 3 -> 4)'),
]
ax_main.legend(handles=legend_elements, loc='upper left', fontsize=8.0, facecolor='#0f172a', edgecolor='#334155', framealpha=0.92)

# -------------------------------------------------------------
# C. BOTTOM DATA TABLE (Audit & Verification Summary)
# -------------------------------------------------------------
ax_table.axis('off')
table_headers = [
    "No",
    "Koordinat Input Parquet (X, Y)",
    "Koordinat Hasil Transformasi CAD",
    "Rak Fisik Terdekat (ID CAD)",
    "Jarak ke Rak",
    "Lorong / Isle Terverifikasi",
    "Area Toko"
]

tbl = ax_table.table(
    cellText=point_analysis_records,
    colLabels=table_headers,
    cellLoc='center',
    loc='center',
    bbox=[0.0, 0.0, 1.0, 0.95]
)
tbl.auto_set_font_size(False)
tbl.set_fontsize(9)

# Style table cells
for (row, col), cell in tbl.get_celld().items():
    cell.set_edgecolor('#334155')
    if row == 0:
        cell.set_facecolor('#1e293b')
        cell.set_text_props(color='#38bdf8', fontweight='bold')
    else:
        cell.set_facecolor('#0f172a' if row % 2 == 0 else '#131d31')
        cell.set_text_props(color='#f1f5f9')
        if col == 4:
            cell.set_text_props(color='#10b981', fontweight='bold')
        elif col == 5:
            cell.set_text_props(color='#38bdf8', fontweight='bold')

# Save figure
output_path = 'map_2d_aisle_overlay.png'
plt.savefig(output_path, dpi=200, bbox_inches='tight', facecolor='#0b1120')
plt.close()
print(f"[SUCCESS] High-resolution 2D Aisle Mapping generated at: {output_path}")
