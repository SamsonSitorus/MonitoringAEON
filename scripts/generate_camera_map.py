import json
import math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from shapely.geometry import Polygon, Point

# 1. Load layout JSON & cameras_export.json
with open('backend/data/map_layout.json', 'r', encoding='utf-8') as f:
    layout = json.load(f)

with open(r'k:\cameras_export.json', 'r', encoding='utf-8') as f:
    cam_export = json.load(f)

SCALE = 20.0
MAX_Y = 108.0

# Affine transformation matrices (from Export pixels to CAD meters and SVG pixels)
M_cad = np.array([
    [ 3.17935574e-02, -3.07566525e-05],
    [-5.69980481e-05, -3.18116765e-02],
    [ 1.71471055e-01,  1.07086377e+02]
])

M_svg = np.array([
    [ 6.35882463e-01,  6.11160835e-04],
    [-1.13825326e-03,  6.36232431e-01],
    [ 3.40736696e+00,  1.82864106e+01]
])

# Homography mapping
homo_dict = {h['cameraId']: len(h.get('pairs', [])) for h in cam_export.get('homography', []) if 'cameraId' in h}

# Deduplicate cameras
cam_dict = {}
for p in cam_export.get('planned_cameras', []):
    cam_dict[p['id']] = dict(p, review_status='planned', is_planned=True)

for c in cam_export.get('cameras', []):
    status = c.get('review_status', 'verified')
    cam_dict[c['id']] = dict(c, review_status=status, is_planned=(status == 'planned'))

cameras_list = []
for cid, c in cam_dict.items():
    px, py = c['pos']
    pt_h = np.array([px, py, 1.0])
    cad_pt = pt_h @ M_cad
    svg_pt = pt_h @ M_svg
    
    cx, cy = float(cad_pt[0]), float(cad_pt[1])
    sx, sy = float(svg_pt[0]), float(svg_pt[1])
    
    status = c.get('review_status', 'verified')
    heading = float(c.get('heading_deg', 0))
    fov = float(c.get('fov_deg', 90))
    range_m = float(c.get('range_m', 6))
    
    if sx >= 1460:
        area_name = 'Delica Area'
    elif sy <= 700:
        area_name = 'Fresh Area'
    else:
        area_name = 'Supermarket'
        
    cameras_list.append({
        'id': cid,
        'label': c.get('label', cid),
        'cad_x': cx,
        'cad_y': cy,
        'svg_x': sx,
        'svg_y': sy,
        'heading': heading,
        'fov': fov,
        'range_m': range_m,
        'status': status,
        'area': area_name,
        'note': c.get('note', ''),
        'videos': c.get('videos', []),
        'has_homo': cid in homo_dict
    })

print(f"[CAM_MAP] Total cameras to plot: {len(cameras_list)}")

# 2. Setup Figure
plt.style.use('dark_background')
fig, ax = plt.subplots(figsize=(26, 22), facecolor='#060a12', dpi=180)
ax.set_facecolor('#090f1d')

# 2.1 Store Outer Boundary
if layout.get('store_boundary'):
    b_pts = [float(x) for x_str in layout['store_boundary'].split() for x in x_str.split(',')]
    b_cad = [(b_pts[j]/SCALE, MAX_Y - b_pts[j+1]/SCALE) for j in range(0, len(b_pts), 2)]
    ax.add_patch(patches.Polygon(b_cad, closed=True, facecolor='#0d1527', edgecolor='#475569', linewidth=2.5))

# 2.2 Area Ambient Backdrops
# Fresh Area (North)
ax.add_patch(patches.Rectangle((21, 72), 52, 28, facecolor='#064e3b', alpha=0.18, edgecolor='#10b981', linestyle='--', linewidth=1.8))
ax.text(42, 98.5, "[AREA 1] FRESH AREA (PRODUK SEGAR)", 
        fontsize=12, fontweight='bold', color='#34d399', ha='center', va='center',
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#064e3b', edgecolor='#10b981', lw=1.2, alpha=0.9))

# Supermarket (West/Center)
ax.add_patch(patches.Rectangle((21, 23), 52, 47.5, facecolor='#0c4a6e', alpha=0.15, edgecolor='#38bdf8', linestyle='--', linewidth=1.8))
ax.text(47, 70.8, "[AREA 2] SUPERMARKET (GROCERIES & KEBUTUHAN POKOK)", 
        fontsize=12, fontweight='bold', color='#38bdf8', ha='center', va='center',
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#0c4a6e', edgecolor='#38bdf8', lw=1.2, alpha=0.9))

# Delica Area & Dine-In Seating (East)
ax.add_patch(patches.Rectangle((74, 4), 45, 96, facecolor='#78350f', alpha=0.15, edgecolor='#f59e0b', linestyle='--', linewidth=1.8))
ax.text(96.5, 102.0, "[AREA 3] DELICA AREA & DINE-IN SEATING", 
        fontsize=12, fontweight='bold', color='#fbbf24', ha='center', va='center',
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#78350f', edgecolor='#f59e0b', lw=1.2, alpha=0.9))

# 2.3 Draw Zones
for z in layout.get('zones', []):
    if z.get('area', 0) > 5000:
        continue
    pts = [float(x) for x_str in z['svg_points'].split() for x in x_str.split(',')]
    z_cad = [(pts[j]/SCALE, MAX_Y - pts[j+1]/SCALE) for j in range(0, len(pts), 2)]
    is_delica = z.get('is_delica') or z.get('parent_area') == 'Delica Area'
    
    if is_delica:
        z_fc, z_ec = '#1c1308', '#92400e'
    else:
        z_fc, z_ec = '#0f172a', '#334155'
    ax.add_patch(patches.Polygon(z_cad, closed=True, facecolor=z_fc, edgecolor=z_ec, linewidth=0.5, alpha=0.45))

# 2.4 Draw Shelves
for s in layout['shelves']:
    pts = [float(x) for x_str in s['svg_points'].split() for x in x_str.split(',')]
    s_cad = [(pts[j]/SCALE, MAX_Y - pts[j+1]/SCALE) for j in range(0, len(pts), 2)]
    if s.get('area') == 'Fresh Area':
        fc, ec = '#064e3b', '#059669'
    elif s.get('area') == 'Supermarket':
        fc, ec = '#1e293b', '#475569'
    else:
        fc, ec = '#334155', '#64748b'
    ax.add_patch(patches.Polygon(s_cad, closed=True, facecolor=fc, edgecolor=ec, linewidth=0.4, alpha=0.6))

# 2.5 Prominent Store Labels
store_labels = [
    ("ENTRANCE MALL (PINTU UTAMA)", 112, 65, "#fbbf24", 9),
    ("ENTRANCE TAMAN SAKURA", 73, 104, "#34d399", 8.5),
    ("ENTRANCE PARKIR GEDUNG", 73, 5, "#38bdf8", 8.5),
    ("KASIR SUPERMARKET", 66.5, 47, "#38bdf8", 9),
    ("KASIR DELICA", 89, 78, "#fbbf24", 8.5),
    ("BAKERY & PASTRY", 99, 32, "#fbbf24", 9),
    ("SEATING AREA (UTARA)", 95, 88, "#fbbf24", 8),
    ("SEATING AREA (TENGAH)", 93, 74, "#fbbf24", 8),
    ("SEATING AREA (SELATAN)", 86, 32, "#fbbf24", 8),
    ("F&B TENANT (FOOD COURT)", 78, 74, "#fbbf24", 8),
    ("PHARMACY / HBC", 42, 16, "#94a3b8", 8),
    ("COOKWARE & TABLEWARE", 36, 65.5, "#94a3b8", 7),
    ("PASTA & CANNED FOOD", 37, 57.0, "#94a3b8", 7),
    ("INSTANT NOODLES", 37, 54.0, "#94a3b8", 7),
    ("BEVERAGES", 37, 42.5, "#94a3b8", 7),
    ("LAUNDRY CARE", 55, 66.0, "#94a3b8", 7),
    ("FRESH FRUIT & VEGETABLES", 52, 81.3, "#34d399", 7.5),
]
for text, lx, ly, col, fs in store_labels:
    ax.text(lx, ly, text, fontsize=fs, fontweight='bold', color=col, ha='center', va='center',
            bbox=dict(boxstyle='round,pad=0.2', facecolor='#090f1d', edgecolor=col, lw=0.6, alpha=0.85))

# 2.6 Draw Camera FOV Cones (Under the pins)
# Note: In CAD space, Y is inverted relative to screen (CAD y = 108 - svg_y / 20).
# So a heading pointing +Y in screen (-90 in CAD angle or flipped Y component).
for c in cameras_list:
    cx, cy = c['cad_x'], c['cad_y']
    heading_deg = c['heading']
    fov_deg = c['fov']
    range_m = c['range_m']
    is_ver = c['status'] == 'verified'
    
    # Color scheme
    cone_color = '#10b981' if is_ver else '#f59e0b'
    cone_alpha = 0.16 if is_ver else 0.12
    cone_edge = '#34d399' if is_ver else '#fbbf24'
    
    # In CAD coordinates: X increases right, Y increases UP.
    # In export coordinates: X increases right, Y increases DOWN.
    # Therefore: heading in CAD is -heading_deg!
    cad_heading = -heading_deg
    theta1 = cad_heading - fov_deg / 2.0
    theta2 = cad_heading + fov_deg / 2.0
    
    wedge = patches.Wedge(
        (cx, cy),
        r=range_m,
        theta1=theta1,
        theta2=theta2,
        facecolor=cone_color,
        edgecolor=cone_edge,
        linewidth=0.8,
        alpha=cone_alpha,
        linestyle='-' if is_ver else '--'
    )
    ax.add_patch(wedge)

# 2.7 Draw Camera Pins and Orientation Vectors
for c in cameras_list:
    cx, cy = c['cad_x'], c['cad_y']
    heading_deg = c['heading']
    is_ver = c['status'] == 'verified'
    
    pin_color = '#10b981' if is_ver else '#f59e0b'
    glow_color = '#059669' if is_ver else '#d97706'
    
    # Direction vector arrow
    cad_heading_rad = math.radians(-heading_deg)
    arrow_len = min(2.2, c['range_m'] * 0.5)
    dx = arrow_len * math.cos(cad_heading_rad)
    dy = arrow_len * math.sin(cad_heading_rad)
    
    ax.annotate(
        "", xy=(cx + dx, cy + dy), xytext=(cx, cy),
        arrowprops=dict(arrowstyle="->", color=pin_color, lw=1.5, mutation_scale=10)
    )
    
    # Glowing pin
    ax.plot(cx, cy, marker='o', markersize=10, color=glow_color, alpha=0.35)
    ax.plot(cx, cy, marker='o', markersize=6, color=pin_color, markeredgecolor='#ffffff', markeredgewidth=0.8)
    
    # Camera label (short ID)
    short_label = c['id']
    if len(short_label) > 14:
        # Simplify long names for map clarity
        short_label = short_label.replace("Shelf M ", "M-").replace("Lorong ", "L-").replace("Entrance ", "Ent-")
    
    # Place text near camera
    text_color = '#a7f3d0' if is_ver else '#fde68a'
    ax.text(
        cx, cy - 0.9, short_label,
        fontsize=5.5, fontweight='bold', color=text_color, ha='center', va='top',
        bbox=dict(boxstyle='round,pad=0.15', facecolor='#090f1d', edgecolor=pin_color, lw=0.4, alpha=0.85)
    )

# 2.8 Compass & Header
ax.set_title("DENAH PEMETAAN TITIK KAMERA CCTV STORE LENGKAP (AEON STORE CAMERA COVERAGE MAP)\n"
             "PEMETAAN 112 TITIK KAMERA CCTV, BIDANG PANDANG (FOV CONES), STATUS VERIFIKASI & AREA CAKUPAN", 
             fontsize=14, fontweight='black', color='#38bdf8', pad=18)

ax.annotate("UTARA / NORTH\n▲\nN", xy=(115, 102), fontsize=10, fontweight='black', color='#38bdf8', ha='center',
            bbox=dict(boxstyle='round,pad=0.4', facecolor='#090f1d', edgecolor='#38bdf8', lw=1.5))

# 2.9 Executive Summary & Stats Card (Bottom-Left)
stats_text = (
    "RINGKASAN SISTEM TITIK KAMERA CCTV:\n"
    "• Total Titik Kamera: 112 Kamera Aktif & Terencana\n"
    "  ├─ 58 Kamera Terverifikasi (Online / Video NVR Siap)\n"
    "  └─ 54 Kamera Terencana (Area Mayora & Lorong Gondola)\n"
    "• Sebaran Area Toko:\n"
    "  ├─ Supermarket (Groceries & Kasir): 75 Kamera\n"
    "  ├─ Delica Area & Food Court: 30 Kamera\n"
    "  └─ Fresh Area (Buah, Sayur, Daging): 7 Kamera\n"
    "• Kalibrasi Homografi 2D: 59 Kamera Terkalibrasi\n"
    "• Rentang Jangkauan (FOV Range): 2.0m s/d 9.3m (Rata-rata 6.2m)\n"
    "• Sudut Pandang (FOV Angle): 83° s/d 163° (Rata-rata 93.5°)\n"
    "• Sumber Konfigurasi: cameras_export.json"
)
ax.text(
    0, 2, stats_text, fontsize=8.5, color='#e2e8f0', linespacing=1.4,
    bbox=dict(boxstyle='round,pad=0.7', facecolor='#0b1329', edgecolor='#38bdf8', lw=1.5, alpha=0.96)
)

# 2.10 Legend (Bottom-Right)
legend_handles = [
    patches.Patch(facecolor='#10b981', edgecolor='#34d399', alpha=0.5, label='Kamera Terverifikasi (58 Kamera) + FOV Cone'),
    patches.Patch(facecolor='#f59e0b', edgecolor='#fbbf24', alpha=0.4, label='Kamera Terencana (54 Kamera) + FOV Cone'),
    patches.Patch(facecolor='#064e3b', edgecolor='#10b981', label='Area 1: Fresh Area (7 Kamera)'),
    patches.Patch(facecolor='#1e293b', edgecolor='#38bdf8', label='Area 2: Supermarket (75 Kamera)'),
    patches.Patch(facecolor='#78350f', edgecolor='#f59e0b', label='Area 3: Delica Area & Seating (30 Kamera)'),
    plt.Line2D([0], [0], marker='o', color='#34d399', markeredgecolor='#ffffff', markersize=8, label='Pin Posisi Fisik Kamera'),
    plt.Line2D([0], [0], color='#10b981', marker='>', markersize=7, lw=1.5, label='Arah Hadap Lensa (Heading)')
]
ax.legend(handles=legend_handles, loc='lower right', fontsize=8.5, facecolor='#0b1329', edgecolor='#475569', framealpha=0.96, borderpad=0.8)

ax.set_xlim(-2, 122)
ax.set_ylim(-2, 110)
ax.set_aspect('equal')
ax.grid(True, linestyle=':', alpha=0.18, color='#64748b')
ax.set_xlabel("Sumbu X CAD (meter) — Lebar Total Toko ≈ 120 meter", fontsize=10, color='#94a3b8', labelpad=8)
ax.set_ylabel("Sumbu Y CAD (meter) — Panjang Total Toko ≈ 110 meter", fontsize=10, color='#94a3b8', labelpad=8)

output_png = 'map_kamera_aeon_lengkap.png'
plt.savefig(output_png, dpi=180, bbox_inches='tight', facecolor='#060a12')
plt.close()
print(f"[SUCCESS] Complete Camera Map generated at: {output_png}")
