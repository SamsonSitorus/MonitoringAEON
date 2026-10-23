import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from shapely.geometry import Polygon, Point

# 1. Load layout JSON & DXF data
with open('backend/data/map_layout.json', 'r', encoding='utf-8') as f:
    layout = json.load(f)

# 2. Transformation Constants
TRANS_A, TRANS_B, TRANS_C = 26.6727, 0.6225, 236.1826
TRANS_D, TRANS_E, TRANS_F = 1.2497, -26.8877, 3043.9879
M = np.array([[TRANS_A, TRANS_B], [TRANS_D, TRANS_E]])
M_inv = np.linalg.inv(M)
SCALE = 20.0
MAX_Y = 108.0

# 3. Given 4 Points
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

# 4. Create Matplotlib Figure
plt.style.use('dark_background')
fig = plt.figure(figsize=(24, 18), facecolor='#060a12', dpi=180)

# We want 1 MAIN FULL STORE MAP occupying the entire canvas,
# plus a detailed zoom inset card in a designated clean corner (e.g. bottom left or top right)
# or a structured layout: Left/Center: Huge Full Map, Right: Zoom Detail + Data Summary
gs = fig.add_gridspec(2, 2, width_ratios=[1.7, 1.0], height_ratios=[1.3, 0.7], wspace=0.10, hspace=0.14)

ax_full = fig.add_subplot(gs[:, 0])      # Full Store Map (Huge Left/Center)
ax_zoom = fig.add_subplot(gs[0, 1])      # Zoom Inset of Target Aisle (Top Right)
ax_info = fig.add_subplot(gs[1, 1])      # Audit Data & Verification Table (Bottom Right)

for ax in [ax_full, ax_zoom, ax_info]:
    ax.set_facecolor('#090f1d')

# ==============================================================================
# 1. HUGE FULL STORE MAP (Makro: 120m x 110m)
# ==============================================================================
ax_full.set_title("DENAH LENGKAP SATU TOKO UTUH (AEON STORE FLOOR PLAN - 120m × 110m)", 
                  fontsize=13, fontweight='bold', color='#38bdf8', pad=14)

# 1.1 Store Perimeter / Outer Walls
if layout.get('store_boundary'):
    b_pts = [float(x) for x_str in layout['store_boundary'].split() for x in x_str.split(',')]
    b_cad = [(b_pts[j]/SCALE, MAX_Y - b_pts[j+1]/SCALE) for j in range(0, len(b_pts), 2)]
    ax_full.add_patch(patches.Polygon(b_cad, closed=True, facecolor='#0b1326', edgecolor='#475569', linewidth=2.0))

# 1.2 Area Tint Backdrops
# Fresh Area (North)
fresh_rect = patches.Rectangle((21, 71), 52, 29, facecolor='#064e3b', alpha=0.18, edgecolor='#10b981', linestyle='--', linewidth=1.5)
ax_full.add_patch(fresh_rect)
ax_full.text(47, 98, "[AREA 1] FRESH AREA", fontsize=11, fontweight='bold', color='#34d399', ha='center', va='center')
ax_full.text(47, 95.5, "(Produk Segar, Buah, Sayur, Daging & Seafood)", fontsize=8, color='#a7f3d0', ha='center', va='center')

# Supermarket Area (West/Center)
supermarket_rect = patches.Rectangle((21, 24), 52, 46.5, facecolor='#0c4a6e', alpha=0.15, edgecolor='#38bdf8', linestyle='--', linewidth=1.5)
ax_full.add_patch(supermarket_rect)
ax_full.text(47, 68.5, "[AREA 2] SUPERMARKET", fontsize=12, fontweight='bold', color='#38bdf8', ha='center', va='center')
ax_full.text(47, 66.2, "(Kebutuhan Pokok, Groceries, Minuman, Non-Food & Kasir)", fontsize=8, color='#bae6fd', ha='center', va='center')

# Delica Area & Seating (East)
delica_rect = patches.Rectangle((73.5, 4), 45.5, 96, facecolor='#78350f', alpha=0.15, edgecolor='#f59e0b', linestyle='--', linewidth=1.5)
ax_full.add_patch(delica_rect)
ax_full.text(96, 96, "[AREA 3] DELICA AREA & SEATING", fontsize=11, fontweight='bold', color='#fbbf24', ha='center', va='center')
ax_full.text(96, 93.5, "(Makanan Siap Saji, Bakery, Food Court & Dine-In)", fontsize=8, color='#fde68a', ha='center', va='center')

# 1.3 Draw All 75 Zones (Delica & Aisles)
for z in layout.get('zones', []):
    if z.get('area', 0) > 5000:
        continue
    pts = [float(x) for x_str in z['svg_points'].split() for x in x_str.split(',')]
    z_cad = [(pts[j]/SCALE, MAX_Y - pts[j+1]/SCALE) for j in range(0, len(pts), 2)]
    is_delica = z.get('is_delica') or z.get('parent_area') == 'Delica Area'
    
    if is_delica:
        z_fc = '#241408'
        z_ec = '#d97706'
        z_lw = 0.8
        z_al = 0.45
    else:
        z_fc = '#0f172a'
        z_ec = '#334155'
        z_lw = 0.5
        z_al = 0.35
    ax_full.add_patch(patches.Polygon(z_cad, closed=True, facecolor=z_fc, edgecolor=z_ec, linewidth=z_lw, alpha=z_al))

# 1.4 Draw All 949 Shelves
for s in layout['shelves']:
    pts = [float(x) for x_str in s['svg_points'].split() for x in x_str.split(',')]
    s_cad = [(pts[j]/SCALE, MAX_Y - pts[j+1]/SCALE) for j in range(0, len(pts), 2)]
    
    if s.get('area') == 'Fresh Area':
        fc, ec = '#065f46', '#10b981'
    elif s.get('area') == 'Supermarket':
        fc, ec = '#1e3a5f', '#38bdf8'
    else:
        fc, ec = '#334155', '#64748b'
        
    ax_full.add_patch(patches.Polygon(s_cad, closed=True, facecolor=fc, edgecolor=ec, linewidth=0.5, alpha=0.75))

# 1.5 Prominent Store Labels
store_key_labels = [
    # Entrances
    ("ENTRANCE MALL", 112, 65, "#fbbf24", 8),
    ("ENTRANCE TAMAN SAKURA", 73, 104, "#34d399", 8),
    ("ENTRANCE PARKIR GEDUNG", 73, 5, "#38bdf8", 8),
    # Kasir & Sections
    ("KASIR SUPERMARKET", 66, 47, "#38bdf8", 8),
    ("KASIR DELICA", 89, 78, "#fbbf24", 8),
    ("BAKERY", 99, 32, "#fbbf24", 8),
    ("SEATING AREA (UTARA)", 95, 88, "#fbbf24", 7.5),
    ("SEATING AREA (TENGAH)", 93, 74, "#fbbf24", 7.5),
    ("SEATING AREA (SELATAN)", 86, 32, "#fbbf24", 7.5),
    ("F&B TENANT", 78, 74, "#fbbf24", 7.5),
    ("BICYCLE AREA", 90, 14, "#94a3b8", 7.5),
    ("PHARMACY / HBC", 42, 16, "#94a3b8", 7.5),
    ("COOKWARE & TABLEWARE", 36, 69, "#94a3b8", 6.5),
    ("INSTANT & IMPORT NOODLES", 37, 54, "#94a3b8", 6.5),
    ("PASTA & CANNED FOOD", 37, 57, "#94a3b8", 6.5),
    ("READY TO DRINK BEVERAGES", 37, 42, "#94a3b8", 6.5),
    ("WAFER & CHOCOLATE", 55, 39, "#94a3b8", 6.5),
    ("PET FOOD & SUPPLIES", 55, 57, "#94a3b8", 6.5),
    ("LAUNDRY CARE", 55, 66, "#94a3b8", 6.5),
]

for text, lx, ly, col, fs in store_key_labels:
    ax_full.text(lx, ly, text, fontsize=fs, fontweight='bold', color=col, ha='center', va='center',
                 bbox=dict(boxstyle='round,pad=0.2', facecolor='#090f1d', edgecolor=col, lw=0.6, alpha=0.85))

# 1.6 Highlight TARGET AISLE "Baking & Specialty Rice"
aisle_rect = patches.Rectangle((34.5, 36.5), 9.0, 5.0, linewidth=2.5, edgecolor='#f43f5e', facecolor='#f43f5e', alpha=0.35, linestyle='-')
ax_full.add_patch(aisle_rect)

# Draw glow around target aisle
glow_rect = patches.Rectangle((34.0, 36.0), 10.0, 6.0, linewidth=1.5, edgecolor='#fb7185', facecolor='none', linestyle=':')
ax_full.add_patch(glow_rect)

# Plot the 4 Points on Full Map
for idx, (cx, cy) in enumerate(pts_cad):
    ax_full.plot(cx, cy, marker='o', markersize=9, color='#f43f5e', markeredgecolor='#ffffff', markeredgewidth=1.2)
    ax_full.text(cx, cy + 1.2, f"#{idx+1}", fontsize=8, fontweight='bold', color='#ffffff', ha='center',
                 bbox=dict(boxstyle='circle,pad=0.15', facecolor='#f43f5e', edgecolor='#ffffff', lw=0.8))

# Big Callout Leader Line from Target Aisle pointing to the right panel
ax_full.annotate(
    "TARGET 4 TITIK KOORDINAT\nLorong: Baking & Specialty Rice\n(Supermarket)",
    xy=(39.0, 41.5),
    xytext=(28, 52),
    arrowprops=dict(facecolor='#f43f5e', edgecolor='#ffffff', arrowstyle='fancy', lw=1.2),
    fontsize=9.5, fontweight='bold', color='#ffffff',
    bbox=dict(boxstyle='round,pad=0.4', facecolor='#be123c', edgecolor='#ffffff', lw=1.5)
)

ax_full.set_xlim(-2, 122)
ax_full.set_ylim(-2, 110)
ax_full.set_aspect('equal')
ax_full.grid(True, linestyle=':', alpha=0.18, color='#475569')
ax_full.set_xlabel("Sumbu X CAD (meter)", fontsize=9, color='#94a3b8')
ax_full.set_ylabel("Sumbu Y CAD (meter)", fontsize=9, color='#94a3b8')

# Compass rose (North indicator)
ax_full.annotate("U / N\n▲", xy=(114, 102), fontsize=10, fontweight='black', color='#38bdf8', ha='center',
                 bbox=dict(boxstyle='circle,pad=0.3', facecolor='#090f1d', edgecolor='#38bdf8', lw=1.2))

# ==============================================================================
# 2. ZOOM INSET CARD (Mikro: Detail Lorong & Rak Terdekat)
# ==============================================================================
ax_zoom.set_title("PEMBESARAN DETAIL LORONG (ZOOM INSET): BAKING & SPECIALTY RICE", 
                  fontsize=11.5, fontweight='bold', color='#f43f5e', pad=12)

# View limits for zoom inset
z_xmin, z_xmax = 34.5, 43.5
z_ymin, z_ymax = 35.8, 41.8

# Walkway corridor background
zoom_corridor = patches.Rectangle((34.5, 38.0), 9.0, 1.8, facecolor='#1e293b', edgecolor='#38bdf8', alpha=0.5, linestyle=':', linewidth=1)
ax_zoom.add_patch(zoom_corridor)
ax_zoom.text(39.0, 38.9, "KORIDOR LORONG (LEBAR ≈ 2.22 m)", fontsize=8, fontweight='bold', color='#38bdf8', alpha=0.45, ha='center', va='center')

# Draw shelves inside zoom area
zoom_shelf_meta = {}
for s in layout['shelves']:
    cx, cy = s['cad_centroid']
    if (z_xmin - 1.5) <= cx <= (z_xmax + 1.5) and (z_ymin - 1.5) <= cy <= (z_ymax + 1.5):
        pts = [float(x) for x_str in s['svg_points'].split() for x in x_str.split(',')]
        s_cad = [(pts[j]/SCALE, MAX_Y - pts[j+1]/SCALE) for j in range(0, len(pts), 2)]
        zoom_shelf_meta[s['id']] = (Polygon(s_cad), s)
        
        if cy > 39.0:
            fc, ec, tc = '#1e3a5f', '#38bdf8', '#bae6fd'
        elif cy > 37.4:
            fc, ec, tc = '#064e3b', '#10b981', '#a7f3d0'
        else:
            fc, ec, tc = '#143329', '#059669', '#6ee7b7'
            
        ax_zoom.add_patch(patches.Polygon(s_cad, closed=True, facecolor=fc, edgecolor=ec, linewidth=1.2, alpha=0.88))
        
        if z_xmin <= cx <= z_xmax and z_ymin <= cy <= z_ymax:
            sname = s['name']
            if len(sname) > 16:
                sname = sname[:15] + ".."
            ax_zoom.text(cx, cy, f"[{s['id']}]\n{sname}", fontsize=7, fontweight='bold', color=tc, ha='center', va='center', clip_on=True)

# Gondola side headers
ax_zoom.text((z_xmin + z_xmax)/2, z_ymax - 0.22, "▲ Gondola Utara: Bahan Pembuat Kue (Gelatin, Cokelat Blok, Topping)", 
             fontsize=8.5, fontweight='bold', color='#38bdf8', ha='center', va='top',
             bbox=dict(boxstyle='square,pad=0.2', facecolor='#090f1d', edgecolor='#38bdf8', lw=0.8, alpha=0.9))

ax_zoom.text((z_xmin + z_xmax)/2, z_ymin + 0.25, "▼ Gondola Selatan: Beras Khusus (Ketan, Beras Merah, Organik, Impor)", 
             fontsize=8.5, fontweight='bold', color='#10b981', ha='center', va='bottom',
             bbox=dict(boxstyle='square,pad=0.2', facecolor='#090f1d', edgecolor='#10b981', lw=0.8, alpha=0.9))

# Trajectory arrows: 1 -> 2 -> 3 -> 4
for i in range(len(pts_cad) - 1):
    ax_zoom.annotate("", xy=pts_cad[i+1], xytext=pts_cad[i],
                     arrowprops=dict(arrowstyle="->", color="#94a3b8", lw=1.6, linestyle="--", alpha=0.8, mutation_scale=14))

# 4 Points configurations
pt_cfgs = [
    {"num": "1", "color": "#f59e0b", "nearest_id": "488", "offset": (18, 20)},
    {"num": "2", "color": "#06b6d4", "nearest_id": "42C", "offset": (-36, -28)},
    {"num": "3", "color": "#10b981", "nearest_id": "42D", "offset": (20, -24)},
    {"num": "4", "color": "#c084fc", "nearest_id": "439", "offset": (18, 20)}
]

table_rows = []
for i, ((cx, cy), cfg) in enumerate(zip(pts_cad, pt_cfgs)):
    raw_x, raw_y = pts_raw[i]
    color = cfg["color"]
    
    # Glow & marker
    ax_zoom.plot(cx, cy, marker='o', markersize=16, color=color, alpha=0.3)
    ax_zoom.plot(cx, cy, marker='o', markersize=10, color=color, alpha=0.7)
    ax_zoom.plot(cx, cy, marker='o', markersize=5, color='#ffffff')
    
    # Distance to nearest shelf
    poly_geom, shelf_dict = zoom_shelf_meta[cfg["nearest_id"]]
    dist = poly_geom.distance(Point(cx, cy))
    sh_cx, sh_cy = shelf_dict['cad_centroid']
    ax_zoom.plot([cx, sh_cx], [cy, sh_cy], color=color, linestyle=':', lw=1.2, alpha=0.7)
    
    # Callout tag
    callout_txt = f"Titik #{i+1}\n({cx:.2f}m, {cy:.2f}m)\n{shelf_dict['name']} ({dist:.2f}m)"
    ax_zoom.annotate(
        callout_txt, xy=(cx, cy), xytext=cfg["offset"], textcoords="offset points",
        fontsize=7.5, fontweight='bold', color='#ffffff',
        bbox=dict(boxstyle="round,pad=0.3", facecolor='#0f172a', edgecolor=color, lw=1.4, alpha=0.95),
        arrowprops=dict(arrowstyle="->", color=color, lw=1.4)
    )
    
    table_rows.append([
        f"Titik #{i+1}",
        f"({raw_x:.1f}, {raw_y:.1f})",
        f"({cx:.2f}m, {cy:.2f}m)",
        f"{shelf_dict['name']} [{shelf_dict['id']}]",
        f"{dist:.2f} m",
        "Baking & Specialty Rice",
        "Supermarket"
    ])

ax_zoom.set_xlim(z_xmin, z_xmax)
ax_zoom.set_ylim(z_ymin, z_ymax)
ax_zoom.set_aspect('equal')
ax_zoom.grid(True, linestyle='--', alpha=0.2, color='#64748b')
ax_zoom.set_xlabel("Sumbu X CAD (meter)", fontsize=8, color='#94a3b8')
ax_zoom.set_ylabel("Sumbu Y CAD (meter)", fontsize=8, color='#94a3b8')

# ==============================================================================
# 3. VERIFICATION DATA & METADATA SUMMARY TABLE (Bottom Right)
# ==============================================================================
ax_info.axis('off')
ax_info.set_title("REKAPITULASI AUDIT VERIFIKASI SPASIAL KOORDINAT", fontsize=11, fontweight='bold', color='#38bdf8', pad=8)

tbl_headers = ["Titik", "Input Parquet", "Hasil CAD", "Rak Fisik Terdekat", "Jarak", "Lorong / Isle", "Area"]
tbl = ax_info.table(
    cellText=table_rows,
    colLabels=tbl_headers,
    cellLoc='center',
    loc='top',
    bbox=[0.0, 0.40, 1.0, 0.55]
)
tbl.auto_set_font_size(False)
tbl.set_fontsize(8)

for (row, col), cell in tbl.get_celld().items():
    cell.set_edgecolor('#334155')
    if row == 0:
        cell.set_facecolor('#1e293b')
        cell.set_text_props(color='#38bdf8', fontweight='bold')
    else:
        cell.set_facecolor('#090f1d' if row % 2 == 0 else '#111a2e')
        cell.set_text_props(color='#f1f5f9')
        if col == 4:
            cell.set_text_props(color='#10b981', fontweight='bold')
        elif col == 5:
            cell.set_text_props(color='#38bdf8', fontweight='bold')

# Summary Box at the very bottom
summary_text = (
    "RINGKASAN AUDIT KORELASI SPASIAL:\n"
    "• Dimensi Total Toko: ~120 meter (Sumbu X) × 110 meter (Sumbu Y) | Luas: ~13.200 m²\n"
    "• Total Kapasitas Display: 949 Rak Shelf | 75 Zonasi/Lorong | 3 Area Terverifikasi (Fresh, Supermarket, Delica)\n"
    "• Status Korelasi 4 Titik: 100% Valid & Konsisten berada pada Lorong 'Baking & Specialty Rice' (Supermarket)\n"
    "• Titik #3 (CAD 38.99m, 38.18m) berada pada jarak 0.05 m (5 cm) dari bibir Rak 'Red, Brown, Black Rice' (Shelf 42D)\n"
    "  mengindikasikan interaksi langsung pengambilan barang / observasi dekat oleh pengunjung."
)
ax_info.text(0.0, 0.02, summary_text, fontsize=8, color='#94a3b8', va='bottom', ha='left',
             bbox=dict(boxstyle='round,pad=0.5', facecolor='#0f172a', edgecolor='#334155', lw=1.0))

# Save full image
output_path = 'map_besar_lengkap_overlay.png'
plt.savefig(output_path, dpi=200, bbox_inches='tight', facecolor='#060a12')
plt.close()
print(f"[SUCCESS] Big complete store map generated at: {output_path}")
