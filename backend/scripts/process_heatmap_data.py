import os
import sys
import glob
import json
import time
import ezdxf
import numpy as np
import pandas as pd
import pyarrow.parquet as pq
from shapely.geometry import Polygon, Point
from shapely.strtree import STRtree

# Transformation matrix constants from Parquet pixels to CAD meters
# px = a * dx + b * dy + c
# py = d * dx + e * dy + f
TRANS_A, TRANS_B, TRANS_C = 26.6727, 0.6225, 236.1826
TRANS_D, TRANS_E, TRANS_F = 1.2497, -26.8877, 3043.9879
M = np.array([[TRANS_A, TRANS_B], [TRANS_D, TRANS_E]])
M_inv = np.linalg.inv(M)

MAX_Y = 108.0
SCALE = 20.0
MAX_INTERACTION_DISTANCE = 1.0  # 1.0 meter around shelf

def cad_to_svg(x, y):
    return round(float(x) * SCALE, 1), round((MAX_Y - float(y)) * SCALE, 1)

def parquet_to_dxf(px, py):
    p_adj = np.vstack([px - TRANS_C, py - TRANS_F])
    dxf_coords = M_inv @ p_adj
    return dxf_coords[0], dxf_coords[1]

def build_layout(dxf_path, output_dir):
    print(f"[LAYOUT] Reading DXF from {dxf_path}...")
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()

    # 1. Labels
    labels = []
    for e in msp:
        if e.dxf.layer == 'LABELS' and e.dxftype() == 'TEXT':
            pt = (e.dxf.insert[0], e.dxf.insert[1])
            labels.append({
                'text': e.dxf.text.strip(),
                'point': Point(pt),
                'x': float(pt[0]),
                'y': float(pt[1]),
                'svg_x': cad_to_svg(pt[0], pt[1])[0],
                'svg_y': cad_to_svg(pt[0], pt[1])[1]
            })

    # 2. Zones
    zones = []
    zone_svg_list = []
    store_boundary = "0.0,2160.0 2385.0,2160.0 2385.0,18.0 0.0,18.0"

    for e in msp:
        if e.dxf.layer == 'ZONES' and e.dxftype() == 'LWPOLYLINE':
            pts = e.get_points(format='xy')
            if len(pts) >= 3:
                poly = Polygon(pts)
                if poly.is_valid and poly.area > 0:
                    cx, cy = poly.centroid.x, poly.centroid.y
                    
                    # Store perimeter boundary check
                    if poly.area > 5000:
                        name = "Batas Luar Toko (Perimeter)"
                        parent_area = "Store Perimeter"
                        area_id = "perimeter"
                        is_delica = False
                        is_entrance = False
                        contained_labels = []
                        svg_pts = [cad_to_svg(x, y) for x, y in pts]
                        store_boundary = " ".join([f"{p[0]},{p[1]}" for p in svg_pts])
                    else:
                        contained_labels = [l for l in labels if poly.contains(l['point'])]
                        if contained_labels:
                            name = contained_labels[0]['text']
                        else:
                            # Find closest label
                            best_l = min(labels, key=lambda l: poly.distance(l['point']))
                            name = best_l['text']

                        # Classify zone area into 3 major store areas:
                        # 1. Fresh Area (North)
                        # 2. Delica Area (East / Right side: Bakery, Seating, F&B, Delica, Mall Entrance)
                        # 3. Supermarket (Center / West: Grocery Aisles, Cashiers)
                        if cx >= 72.0 or any(k in name.lower() for k in ['delica', 'bakery', 'seating', 'tenant', 'bicycle']):
                            parent_area = "Delica Area"
                            area_id = "delica_area"
                            is_delica = True
                        elif cy >= 73.0 or any(k in name.lower() for k in ['fresh', 'fruit', 'vegetable', 'beef', 'poultry', 'fish', 'seafood', 'pork']):
                            parent_area = "Fresh Area"
                            area_id = "fresh_area"
                            is_delica = False
                        else:
                            parent_area = "Supermarket"
                            area_id = "supermarket"
                            is_delica = False

                        is_entrance = 'entrance' in name.lower()

                    svg_pts = [cad_to_svg(x, y) for x, y in pts]
                    centroid_svg = list(cad_to_svg(cx, cy))

                    zones.append({
                        'handle': e.dxf.handle,
                        'poly': poly,
                        'name': name,
                        'area': poly.area,
                        'parent_area': parent_area,
                        'contained_labels': [l['text'] for l in contained_labels]
                    })

                    zone_svg_list.append({
                        'id': e.dxf.handle,
                        'name': name,
                        'area': round(poly.area, 1),
                        'parent_area': parent_area,
                        'area_id': area_id,
                        'is_delica': is_delica,
                        'is_entrance': is_entrance,
                        'svg_points': " ".join([f"{p[0]},{p[1]}" for p in svg_pts]),
                        'centroid_svg': centroid_svg,
                        'cad_centroid': [round(cx, 2), round(cy, 2)]
                    })

    # Filter isle-level zones for supermarket & fresh (area < 200m2)
    isle_zones = [z for z in zones if z['area'] < 200 and z['parent_area'] in ('Supermarket', 'Fresh Area')]

    # 3. Shelves
    shelves = []
    shelf_geoms = []
    shelf_meta_list = []

    for e in msp:
        if e.dxf.layer == 'SHELVES' and e.dxftype() == 'LWPOLYLINE':
            pts = e.get_points(format='xy')
            poly = Polygon(pts)
            if not poly.is_valid or poly.area <= 0:
                continue

            cx, cy = poly.centroid.x, poly.centroid.y

            # Area determination for shelves:
            # 1. Fresh Area (Top/North, cy >= 73.0) -> 102 shelves
            # 2. Supermarket (Groceries + Cashiers) -> 847 shelves (837 grocery + 10 cashier shelves)
            if cy >= 73.0:
                area_name = "Fresh Area"
            else:
                area_name = "Supermarket"

            # Isle determination
            if cx >= 64.0 and cy < 73.0:
                isle_name = "Cashier Supermarket"
            else:
                contained_isles = [iz for iz in isle_zones if iz['poly'].contains(poly.centroid)]
                if contained_isles:
                    isle_name = min(contained_isles, key=lambda z: z['area'])['name']
                else:
                    closest_iz = min(isle_zones, key=lambda z: z['poly'].distance(poly.centroid))
                    isle_name = closest_iz['name']

            # Shelf name from closest label
            closest_l = min(labels, key=lambda l: poly.distance(l['point']))
            shelf_name = closest_l['text']

            svg_pts = [cad_to_svg(x, y) for x, y in pts]
            svg_centroid = cad_to_svg(cx, cy)

            shelf_data = {
                'id': e.dxf.handle,
                'name': shelf_name,
                'isle': isle_name,
                'area': area_name,
                'cad_centroid': [round(cx, 3), round(cy, 3)],
                'svg_centroid': list(svg_centroid),
                'svg_points': " ".join([f"{p[0]},{p[1]}" for p in svg_pts]),
                'bounds_svg': [
                    min(p[0] for p in svg_pts),
                    min(p[1] for p in svg_pts),
                    max(p[0] for p in svg_pts),
                    max(p[1] for p in svg_pts)
                ]
            }

            shelves.append(shelf_data)
            shelf_geoms.append(poly)
            shelf_meta_list.append(shelf_data)

    # 4. Major Store Labels & Annotations for rich SVG visualization
    major_labels = [
        {'text': 'FRESH AREA', 'pos_svg': [950.0, 470.0], 'area': 'Fresh Area', 'type': 'area_header', 'size': 26},
        {'text': 'SUPERMARKET', 'pos_svg': [920.0, 1150.0], 'area': 'Supermarket', 'type': 'area_header', 'size': 26},
        {'text': 'DELICA AREA', 'pos_svg': [1800.0, 1020.0], 'area': 'Delica Area', 'type': 'area_header', 'size': 26},
        {'text': 'BAKERY', 'pos_svg': [1975.0, 1520.0], 'area': 'Delica Area', 'type': 'section_header', 'size': 18},
        {'text': 'SEATING AREA (UTARA)', 'pos_svg': [1905.0, 395.0], 'area': 'Delica Area', 'type': 'section_header', 'size': 14},
        {'text': 'SEATING AREA (TENGAH)', 'pos_svg': [1870.0, 670.0], 'area': 'Delica Area', 'type': 'section_header', 'size': 14},
        {'text': 'SEATING AREA (SELATAN)', 'pos_svg': [1715.0, 1515.0], 'area': 'Delica Area', 'type': 'section_header', 'size': 14},
        {'text': 'F&B TENANT', 'pos_svg': [1555.0, 670.0], 'area': 'Delica Area', 'type': 'section_header', 'size': 14},
        {'text': 'KASIR DELICA', 'pos_svg': [1785.0, 825.0], 'area': 'Delica Area', 'type': 'section_header', 'size': 13},
        {'text': 'KASIR SUPERMARKET', 'pos_svg': [1340.0, 1220.0], 'area': 'Supermarket', 'type': 'section_header', 'size': 14},
        {'text': 'ENTRANCE MALL', 'pos_svg': [2095.0, 900.0], 'area': 'Delica Area', 'type': 'entrance', 'size': 14},
        {'text': 'ENTRANCE TAMAN SAKURA', 'pos_svg': [1460.0, 330.0], 'area': 'Supermarket', 'type': 'entrance', 'size': 13},
        {'text': 'ENTRANCE PARKIR GEDUNG', 'pos_svg': [1480.0, 2005.0], 'area': 'Supermarket', 'type': 'entrance', 'size': 13},
        {'text': 'PHARMACY / HBC', 'pos_svg': [835.0, 1835.0], 'area': 'Supermarket', 'type': 'section_header', 'size': 14},
        {'text': 'BICYCLE AREA', 'pos_svg': [1800.0, 1870.0], 'area': 'Delica Area', 'type': 'section_header', 'size': 13},
    ]

    # Store areas definition
    store_areas = [
        {
            'id': 'supermarket',
            'name': 'Supermarket',
            'description': 'Area Belanja Kebutuhan Pokok, Groceries, Minuman, Non-Food & Kasir Supermarket',
            'shelf_count': sum(1 for s in shelf_meta_list if s['area'] == 'Supermarket'),
            'zone_count': sum(1 for z in zone_svg_list if z['parent_area'] == 'Supermarket'),
            'color': '#38bdf8'
        },
        {
            'id': 'fresh_area',
            'name': 'Fresh Area',
            'description': 'Area Produk Segar, Buah, Sayur, Daging, Ayam & Seafood',
            'shelf_count': sum(1 for s in shelf_meta_list if s['area'] == 'Fresh Area'),
            'zone_count': sum(1 for z in zone_svg_list if z['parent_area'] == 'Fresh Area'),
            'color': '#34d399'
        },
        {
            'id': 'delica_area',
            'name': 'Delica Area',
            'description': 'Area Makanan Siap Saji, Bakery, Food Court, Dine-In Seating & Pintu Masuk Mall',
            'shelf_count': 0,
            'zone_count': sum(1 for z in zone_svg_list if z['parent_area'] == 'Delica Area'),
            'color': '#fbbf24'
        }
    ]

    # 5. Save Layout JSON
    layout_data = {
        'viewbox_full': "0 0 2400 2160",
        'viewbox_focused': "420 380 1050 1300",
        'viewbox_delica': "1400 200 1000 1900",
        'store_boundary': store_boundary,
        'areas': store_areas,
        'major_labels': major_labels,
        'total_shelves': len(shelves),
        'total_zones': len(zone_svg_list),
        'shelves': shelf_meta_list,
        'zones': zone_svg_list
    }

    layout_file = os.path.join(output_dir, 'map_layout.json')
    with open(layout_file, 'w', encoding='utf-8') as f:
        json.dump(layout_data, f, indent=2)
    print(f"[LAYOUT] Saved {len(shelves)} shelves and {len(zone_svg_list)} zones across 3 Areas to {layout_file}")

    return shelf_meta_list, shelf_geoms

def process_daily_parquet(parquet_file, shelf_meta_list, shelf_geoms, tree, output_dir):
    filename = os.path.basename(parquet_file)
    date_str = filename.replace('ai_shopper_events_', '').replace('.parquet', '')
    print(f"[PROCESS] Processing date {date_str} from {filename}...")
    t0 = time.time()

    # Read parquet
    table = pq.read_table(parquet_file, columns=['x_coordinate', 'y_coordinate', 'action_code', 'action_ai'])
    df = table.to_pandas()
    total_events = len(df)

    if total_events == 0:
        print(f"[PROCESS] No events for {date_str}")
        return None

    # Transform coordinates
    px = df['x_coordinate'].values
    py = df['y_coordinate'].values
    p_adj = np.vstack([px - TRANS_C, py - TRANS_F])
    dxf_coords = M_inv @ p_adj
    dx = dxf_coords[0]
    dy = dxf_coords[1]

    # Query nearest shelves
    pts = [Point(x, y) for x, y in zip(dx, dy)]
    nearest_indices = tree.nearest(pts)

    shelf_counts = {}
    shelf_actions = {}
    unmapped_count = 0

    act_codes = df['action_code'].values
    act_ais = df['action_ai'].values if 'action_ai' in df.columns else None

    for idx, (p, s_idx) in enumerate(zip(pts, nearest_indices)):
        s_geom = shelf_geoms[s_idx]
        if s_geom.distance(p) <= MAX_INTERACTION_DISTANCE:
            sh_id = shelf_meta_list[s_idx]['id']
            shelf_counts[sh_id] = shelf_counts.get(sh_id, 0) + 1
            if sh_id not in shelf_actions:
                shelf_actions[sh_id] = {'actions': {}, 'ai_actions': {}}
            ac = str(act_codes[idx])
            shelf_actions[sh_id]['actions'][ac] = shelf_actions[sh_id]['actions'].get(ac, 0) + 1
            if act_ais is not None:
                ai = act_ais[idx]
                if pd.notna(ai):
                    ai_str = str(ai)
                    shelf_actions[sh_id]['ai_actions'][ai_str] = shelf_actions[sh_id]['ai_actions'].get(ai_str, 0) + 1
        else:
            unmapped_count += 1

    mapped_count = sum(shelf_counts.values())

    # Build per-shelf stats
    shelf_details = []
    top_shelf = None
    max_count = -1

    # Base 3 Areas initialization
    area_stats = {
        'Supermarket': {
            'total_events': 0,
            'shelves_with_events': 0,
            'total_shelves': 0,
            'description': 'Area Belanja Kebutuhan Pokok, Groceries, Minuman, Non-Food & Kasir',
            'status': 'Aktif Beroperasi'
        },
        'Fresh Area': {
            'total_events': 0,
            'shelves_with_events': 0,
            'total_shelves': 0,
            'description': 'Area Produk Segar, Buah, Sayur, Daging, Ayam & Seafood',
            'status': 'Aktif Beroperasi'
        },
        'Delica Area': {
            'total_events': 0,
            'shelves_with_events': 0,
            'total_shelves': 0,
            'description': 'Area Makanan Siap Saji, Bakery, Food Court & Tempat Makan (Dine-in)',
            'status': 'Area Kuliner & Dine-In (Pelacakan CCTV AI Parquet difokuskan pada rak belanja)'
        }
    }
    isle_stats = {}

    for s in shelf_meta_list:
        sh_id = s['id']
        count = shelf_counts.get(sh_id, 0)
        pct = round((count / total_events) * 100, 3) if total_events > 0 else 0.0
        
        detail = {
            'id': sh_id,
            'name': s['name'],
            'isle': s['isle'],
            'area': s['area'],
            'count': count,
            'percentage': pct
        }
        shelf_details.append(detail)

        if count > max_count:
            max_count = count
            top_shelf = detail

        # Area aggregation
        a = s['area']
        if a not in area_stats:
            area_stats[a] = {'total_events': 0, 'shelves_with_events': 0, 'total_shelves': 0, 'description': '', 'status': ''}
        area_stats[a]['total_events'] += count
        area_stats[a]['total_shelves'] += 1
        if count > 0:
            area_stats[a]['shelves_with_events'] += 1

        # Isle aggregation
        i = s['isle']
        if i not in isle_stats:
            isle_stats[i] = {'total_events': 0, 'shelves_with_events': 0, 'total_shelves': 0, 'area': a}
        isle_stats[i]['total_events'] += count
        isle_stats[i]['total_shelves'] += 1
        if count > 0:
            isle_stats[i]['shelves_with_events'] += 1

    # Action code breakdown
    action_counts = df['action_code'].value_counts().to_dict()

    daily_payload = {
        'date': date_str,
        'total_events': total_events,
        'mapped_events': mapped_count,
        'unmapped_events': unmapped_count,
        'mapped_percentage': round((mapped_count / total_events) * 100, 2) if total_events > 0 else 0.0,
        'shelves_total': len(shelf_meta_list),
        'shelves_with_events': len([s for s in shelf_details if s['count'] > 0]),
        'isles_count': len(isle_stats),
        'areas_count': 3,
        'top_shelf': top_shelf,
        'action_breakdown': action_counts,
        'shelf_counts': shelf_counts,
        'shelf_actions': shelf_actions,
        'area_summary': area_stats,
        'isle_summary': isle_stats,
        'processed_at': time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        'duration_seconds': round(time.time() - t0, 2)
    }

    out_file = os.path.join(output_dir, 'daily', f"{date_str}.json")
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(daily_payload, f, indent=2)

    print(f"[PROCESS] Done {date_str} in {daily_payload['duration_seconds']}s -> {mapped_count} mapped ({daily_payload['mapped_percentage']}%), {unmapped_count} unmapped.")

    return {
        'date': date_str,
        'total_events': total_events,
        'mapped_events': mapped_count,
        'unmapped_events': unmapped_count,
        'top_shelf_name': top_shelf['name'] if top_shelf else '',
        'top_shelf_count': top_shelf['count'] if top_shelf else 0,
        'shelves_with_events': daily_payload['shelves_with_events']
    }

def main():
    dxf_path = 'map_full.dxf'
    output_dir = os.path.join('backend', 'data')
    os.makedirs(os.path.join(output_dir, 'daily'), exist_ok=True)

    # 1. Build layout
    shelf_meta_list, shelf_geoms = build_layout(dxf_path, output_dir)
    tree = STRtree(shelf_geoms)

    # 2. Scan parquet files
    parquet_dir = r'k:\ai-shopper-events-2026-10-01-2026-10-17-final-20261018f-identity-split'
    parquet_files = sorted(glob.glob(os.path.join(parquet_dir, "ai_shopper_events_*.parquet")))
    print(f"[MAIN] Found {len(parquet_files)} parquet files to process.")

    manifest_entries = []
    for pf in parquet_files:
        res = process_daily_parquet(pf, shelf_meta_list, shelf_geoms, tree, output_dir)
        if res:
            manifest_entries.append(res)

    manifest = {
        'available_dates': [m['date'] for m in manifest_entries],
        'total_days': len(manifest_entries),
        'dates_summary': manifest_entries,
        'last_updated': time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

    manifest_file = os.path.join(output_dir, 'manifest.json')
    with open(manifest_file, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    print(f"\n[COMPLETED] Processed all {len(manifest_entries)} days successfully! Manifest saved to {manifest_file}.")

if __name__ == '__main__':
    main()
