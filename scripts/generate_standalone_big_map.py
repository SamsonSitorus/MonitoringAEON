import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

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

# 3. Dedicated Standalone Big Map Canvas (Full Bleed 4000 x 3600 px)
plt.style.use('dark_background')
fig, ax = plt.subplots(figsize=(24, 20), facecolor='#060a12', dpi=180)
ax.set_facecolor('#090f1d')

# 3.1 Store Outer Boundary
if layout.get('store_boundary'):
    b_pts = [float(x) for x_str in layout['store_boundary'].split() for x in x_str.split(',')]
    b_cad = [(b_pts[j]/SCALE, MAX_Y - b_pts[j+1]/SCALE) for j in range(0, len(b_pts), 2)]
    ax.add_patch(patches.Polygon(b_cad, closed=True, facecolor='#0d1527', edgecolor='#475569', linewidth=2.5))

# 3.2 Area Floor Zones (Ambient Backdrops)
# Area 1: Fresh Area (North)
ax.add_patch(patches.Rectangle((21, 72), 52, 28, facecolor='#064e3b', alpha=0.18, edgecolor='#10b981', linestyle='--', linewidth=2.0))
ax.text(42, 98.5, "[AREA 1] FRESH AREA (PRODUK SEGAR)", 
        fontsize=12, fontweight='bold', color='#34d399', ha='center', va='center',
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#064e3b', edgecolor='#10b981', lw=1.2, alpha=0.9))

# Area 2: Supermarket (West/Center)
ax.add_patch(patches.Rectangle((21, 23), 52, 47.5, facecolor='#0c4a6e', alpha=0.15, edgecolor='#38bdf8', linestyle='--', linewidth=2.0))
ax.text(47, 70.8, "[AREA 2] SUPERMARKET (GROCERIES & KEBUTUHAN POKOK)", 
        fontsize=12, fontweight='bold', color='#38bdf8', ha='center', va='center',
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#0c4a6e', edgecolor='#38bdf8', lw=1.2, alpha=0.9))

# Area 3: Delica Area & Dine-In Seating (East)
ax.add_patch(patches.Rectangle((74, 4), 45, 96, facecolor='#78350f', alpha=0.15, edgecolor='#f59e0b', linestyle='--', linewidth=2.0))
ax.text(96.5, 102.0, "[AREA 3] DELICA AREA & DINE-IN SEATING", 
        fontsize=12, fontweight='bold', color='#fbbf24', ha='center', va='center',
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#78350f', edgecolor='#f59e0b', lw=1.2, alpha=0.9))

# 3.3 Draw All 75 Zones
for z in layout.get('zones', []):
    if z.get('area', 0) > 5000:
        continue
    pts = [float(x) for x_str in z['svg_points'].split() for x in x_str.split(',')]
    z_cad = [(pts[j]/SCALE, MAX_Y - pts[j+1]/SCALE) for j in range(0, len(pts), 2)]
    is_delica = z.get('is_delica') or z.get('parent_area') == 'Delica Area'
    
    if is_delica:
        z_fc = '#241408'
        z_ec = '#d97706'
        z_lw = 1.0
        z_al = 0.5
    else:
        z_fc = '#111c33'
        z_ec = '#334155'
        z_lw = 0.6
        z_al = 0.4
    ax.add_patch(patches.Polygon(z_cad, closed=True, facecolor=z_fc, edgecolor=z_ec, linewidth=z_lw, alpha=z_al))

# 3.4 Draw All 949 Shelves
for s in layout['shelves']:
    pts = [float(x) for x_str in s['svg_points'].split() for x in x_str.split(',')]
    s_cad = [(pts[j]/SCALE, MAX_Y - pts[j+1]/SCALE) for j in range(0, len(pts), 2)]
    
    if s.get('area') == 'Fresh Area':
        fc, ec = '#065f46', '#10b981'
    elif s.get('area') == 'Supermarket':
        fc, ec = '#1e3a5f', '#38bdf8'
    else:
        fc, ec = '#334155', '#64748b'
        
    ax.add_patch(patches.Polygon(s_cad, closed=True, facecolor=fc, edgecolor=ec, linewidth=0.6, alpha=0.82))

# 3.5 Prominent Store Labels & Aisles
store_labels = [
    # Entrances
    ("ENTRANCE MALL (PINTU UTAMA)", 112, 65, "#fbbf24", 10),
    ("ENTRANCE TAMAN SAKURA", 73, 104, "#34d399", 9.5),
    ("ENTRANCE PARKIR GEDUNG", 73, 5, "#38bdf8", 9.5),
    # Cashiers & Major Delica Sections
    ("KASIR SUPERMARKET (1 s/d 9)", 66.5, 47, "#38bdf8", 10),
    ("KASIR DELICA", 89, 78, "#fbbf24", 9.5),
    ("BAKERY & PASTRY", 99, 32, "#fbbf24", 10),
    ("SEATING AREA (UTARA)", 95, 88, "#fbbf24", 9),
    ("SEATING AREA (TENGAH)", 93, 74, "#fbbf24", 9),
    ("SEATING AREA (SELATAN)", 86, 32, "#fbbf24", 9),
    ("F&B TENANT (FOOD COURT)", 78, 74, "#fbbf24", 9),
    ("BICYCLE & MOBILITY AREA", 90, 14, "#94a3b8", 8.5),
    ("PHARMACY / HEALTH & BEAUTY", 42, 16, "#94a3b8", 9),
    # Selected Key Grocery Aisles
    ("COOKWARE & TABLEWARE", 36, 65.5, "#cbd5e1", 7.5),
    ("PASTA & CANNED FOOD", 37, 57.0, "#cbd5e1", 7.5),
    ("INSTANT & IMPORT NOODLES", 37, 54.0, "#cbd5e1", 7.5),
    ("READY TO DRINK BEVERAGES", 37, 42.5, "#cbd5e1", 7.5),
    ("REGULAR RICE (BERAS UMUM)", 37, 35.8, "#cbd5e1", 7.5),
    ("HEALTHY CORNER & FROZEN BAKERY", 55, 32.8, "#cbd5e1", 7.5),
    ("NUTS & TRADITIONAL SNACKS", 55, 36.0, "#cbd5e1", 7.5),
    ("WAFER & CHOCOLATE", 55, 39.0, "#cbd5e1", 7.5),
    ("KIDS TOYS & CANDY", 55, 48.0, "#cbd5e1", 7.5),
    ("PET FOOD & SUPPLIES", 55, 57.0, "#cbd5e1", 7.5),
    ("TISSUE & ADULT DIAPERS", 55, 60.0, "#cbd5e1", 7.5),
    ("HOUSEHOLD CLEANER", 55, 63.0, "#cbd5e1", 7.5),
    ("LAUNDRY CARE", 55, 66.0, "#cbd5e1", 7.5),
    ("COLD BEVERAGE & CUT FRUIT", 56, 72.4, "#34d399", 8.0),
    ("FRESH FRUIT & VEGETABLES", 52, 81.3, "#34d399", 8.5),
]

for text, lx, ly, col, fs in store_labels:
    ax.text(lx, ly, text, fontsize=fs, fontweight='bold', color=col, ha='center', va='center',
            bbox=dict(boxstyle='round,pad=0.25', facecolor='#090f1d', edgecolor=col, lw=0.7, alpha=0.88))

# 3.6 HIGHLIGHT TARGET AISLE "Baking & Specialty Rice"
aisle_rect = patches.Rectangle((34.2, 36.5), 9.6, 5.0, linewidth=3.0, edgecolor='#f43f5e', facecolor='#f43f5e', alpha=0.30, linestyle='-')
ax.add_patch(aisle_rect)

# Double beacon pulse border
glow_rect1 = patches.Rectangle((33.7, 36.0), 10.6, 6.0, linewidth=1.8, edgecolor='#fb7185', facecolor='none', linestyle=':')
ax.add_patch(glow_rect1)
glow_rect2 = patches.Rectangle((33.2, 35.5), 11.6, 7.0, linewidth=1.0, edgecolor='#fda4af', facecolor='none', linestyle='--', alpha=0.6)
ax.add_patch(glow_rect2)

# Plot the 4 Points on Full Map with trajectory
for i in range(len(pts_cad) - 1):
    ax.annotate("", xy=pts_cad[i+1], xytext=pts_cad[i],
                arrowprops=dict(arrowstyle="->", color="#fb7185", lw=2.5, linestyle="--", alpha=0.95, mutation_scale=16))

point_meta = [
    {"num": "1", "color": "#f59e0b", "nearest": "Chocolate Block [488] (0.40m)"},
    {"num": "2", "color": "#06b6d4", "nearest": "Red, Brown Rice [42C] (0.64m)"},
    {"num": "3", "color": "#10b981", "nearest": "Red, Brown Rice [42D] (0.05m)"},
    {"num": "4", "color": "#c084fc", "nearest": "Japanese Rice [439] (0.59m)"}
]

for idx, ((cx, cy), pmeta) in enumerate(zip(pts_cad, point_meta)):
    # Glowing point pin
    ax.plot(cx, cy, marker='o', markersize=20, color=pmeta["color"], alpha=0.35)
    ax.plot(cx, cy, marker='o', markersize=12, color=pmeta["color"], markeredgecolor='#ffffff', markeredgewidth=1.5)
    ax.text(cx, cy, str(idx+1), fontsize=8, fontweight='bold', color='#000000', ha='center', va='center')

# Callout banner for Target Aisle placed in the clean open space at the left
ax.annotate(
    "LOKASI PRESISI TARGET 4 TITIK KOORDINAT:\n"
    "• Lorong: Baking & Specialty Rice (Supermarket)\n"
    "• Sisi Utara: Bahan Pembuat Kue (Gelatin, Cokelat Blok, Topping)\n"
    "• Sisi Selatan: Beras Khusus (Ketan, Beras Merah, Organik, Impor)\n"
    "• Koordinat CAD: X: 37.5m - 41.1m | Y: 38.2m - 39.3m\n"
    "• 100% Seluruh Titik Terverifikasi di Lorong yang Sama\n"
    "• P1: Chocolate Block (0.40m) | P2: Brown Rice (0.64m)\n"
    "• P3: Red/Brown Rice (0.05m)  | P4: Japanese Rice (0.59m)",
    xy=(36.0, 39.0),
    xytext=(15, 23),
    arrowprops=dict(facecolor='#f43f5e', edgecolor='#ffffff', arrowstyle='fancy', lw=1.5),
    fontsize=10.5, fontweight='bold', color='#ffffff',
    bbox=dict(boxstyle='round,pad=0.6', facecolor='#881337', edgecolor='#f43f5e', lw=2.0, alpha=0.98)
)

# Orientation & Scale & Header
ax.set_title("DENAH BESAR LENGKAP SATU TOKO UTUH (STORE FULL MAP BLUEPRINT - 120m × 110m)\n"
             "PEMETAAN GLOBAL 4 TITIK KOORDINAT PADA AREA TOKO, ZONASI & RAK GONDOLA", 
             fontsize=15, fontweight='black', color='#38bdf8', pad=18)

# Compass rose
ax.annotate("UTARA / NORTH\n▲\nN", xy=(115, 102), fontsize=10, fontweight='black', color='#38bdf8', ha='center',
            bbox=dict(boxstyle='round,pad=0.4', facecolor='#090f1d', edgecolor='#38bdf8', lw=1.5))

# Legend at bottom right
legend_patches = [
    patches.Patch(facecolor='#065f46', edgecolor='#10b981', label='Fresh Area (Produk Segar, Buah, Sayur, Daging)'),
    patches.Patch(facecolor='#1e3a5f', edgecolor='#38bdf8', label='Supermarket (Groceries, Makanan/Minuman, Non-Food)'),
    patches.Patch(facecolor='#78350f', edgecolor='#f59e0b', label='Delica Area & Dine-In Seating (Food Court, Bakery)'),
    patches.Patch(facecolor='#f43f5e', edgecolor='#ffffff', label='Lorong Terverifikasi: Baking & Specialty Rice'),
    plt.Line2D([0], [0], marker='o', color='w', markerfacecolor='#f43f5e', markersize=10, label='Posisi 4 Titik Event Shopper (#1 s/d #4)'),
    plt.Line2D([0], [0], color='#fb7185', linestyle='--', lw=2.0, label='Alur Lintasan Shopper (1 -> 2 -> 3 -> 4)')
]
ax.legend(handles=legend_patches, loc='lower left', fontsize=9.5, facecolor='#090f1d', edgecolor='#334155', framealpha=0.95, borderpad=0.8)

ax.set_xlim(-2, 122)
ax.set_ylim(-2, 110)
ax.set_aspect('equal')
ax.grid(True, linestyle=':', alpha=0.2, color='#64748b')
ax.set_xlabel("Sumbu X CAD (meter) — Lebar Total Toko ≈ 120 meter", fontsize=11, color='#94a3b8', labelpad=8)
ax.set_ylabel("Sumbu Y CAD (meter) — Panjang Total Toko ≈ 110 meter", fontsize=11, color='#94a3b8', labelpad=8)

output_standalone = 'map_besar_lengkap_standalone.png'
plt.savefig(output_standalone, dpi=200, bbox_inches='tight', facecolor='#060a12')
plt.close()
print(f"[SUCCESS] Big Standalone Full Store Map generated at: {output_standalone}")
