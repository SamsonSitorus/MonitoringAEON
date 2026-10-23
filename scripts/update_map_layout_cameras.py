import json
import math
import numpy as np
from shapely.geometry import Point, Polygon

def update_map_layout(export_path=r'k:\cameras_export.json', layout_path=r'backend/data/map_layout.json'):
    print(f"[CAM_UPDATE] Reading cameras from {export_path}...")
    with open(export_path, 'r', encoding='utf-8') as f:
        cam_export = json.load(f)

    print(f"[CAM_UPDATE] Reading layout from {layout_path}...")
    with open(layout_path, 'r', encoding='utf-8') as f:
        layout = json.load(f)

    # 1. Prepare Spatial Indices for Zones & Shelves
    zones_list = []
    for z in layout.get('zones', []):
        if z.get('area', 0) > 5000:
            continue
        pts = [float(x) for x_str in z['svg_points'].split() for x in x_str.split(',')]
        z_svg = [(pts[j], pts[j+1]) for j in range(0, len(pts), 2)]
        poly = Polygon(z_svg)
        zones_list.append((poly, z))

    shelves_list = []
    for s in layout.get('shelves', []):
        pts = [float(x) for x_str in s['svg_points'].split() for x in x_str.split(',')]
        s_svg = [(pts[j], pts[j+1]) for j in range(0, len(pts), 2)]
        poly = Polygon(s_svg)
        shelves_list.append((poly, s))

    # 2. Homography Dictionary
    homo_dict = {}
    for h in cam_export.get('homography', []):
        cid = h.get('cameraId')
        if cid:
            homo_dict[cid] = len(h.get('pairs', []))

    # 3. Deduplicate Cameras (combining active 'cameras' and 'planned_cameras')
    cam_dict = {}
    for p in cam_export.get('planned_cameras', []):
        cid = p['id']
        cam_dict[cid] = dict(p, review_status='planned', is_planned=True)

    for c in cam_export.get('cameras', []):
        cid = c['id']
        status = c.get('review_status', 'verified')
        cam_dict[cid] = dict(c, review_status=status, is_planned=(status == 'planned'))

    # Affine matrices
    M_svg = np.array([
        [ 6.35882463e-01,  6.11160835e-04],
        [-1.13825326e-03,  6.36232431e-01],
        [ 3.40736696e+00,  1.82864106e+01]
    ])

    M_cad = np.array([
        [ 3.17935574e-02, -3.07566525e-05],
        [-5.69980481e-05, -3.18116765e-02],
        [ 1.71471055e-01,  1.07086377e+02]
    ])

    def get_fov_svg_path(cx, cy, heading_deg, fov_deg, radius):
        if fov_deg >= 360:
            return f'M {cx - radius:.1f},{cy:.1f} a {radius:.1f},{radius:.1f} 0 1,0 {radius*2:.1f},0 a {radius:.1f},{radius:.1f} 0 1,0 -{radius*2:.1f},0'
        half_fov = fov_deg / 2.0
        start_ang = math.radians(heading_deg - half_fov)
        end_ang = math.radians(heading_deg + half_fov)
        x1 = cx + radius * math.cos(start_ang)
        y1 = cy + radius * math.sin(start_ang)
        x2 = cx + radius * math.cos(end_ang)
        y2 = cy + radius * math.sin(end_ang)
        large_arc = 1 if fov_deg > 180 else 0
        sweep_flag = 1
        return f'M {cx:.1f},{cy:.1f} L {x1:.1f},{y1:.1f} A {radius:.1f},{radius:.1f} 0 {large_arc} {sweep_flag} {x2:.1f},{y2:.1f} Z'

    cameras_processed = []
    area_counts = {'Supermarket': 0, 'Fresh Area': 0, 'Delica Area': 0}
    status_counts = {'verified': 0, 'planned': 0}

    for cid, cam in cam_dict.items():
        px, py = cam['pos']
        pt_h = np.array([px, py, 1.0])
        svg_pt = pt_h @ M_svg
        cad_pt = pt_h @ M_cad
        sx, sy = round(float(svg_pt[0]), 1), round(float(svg_pt[1]), 1)
        cx, cy = round(float(cad_pt[0]), 2), round(float(cad_pt[1]), 2)

        if sx >= 1460:
            area_name = 'Delica Area'
            area_id = 'delica_area'
        elif sy <= 700:
            area_name = 'Fresh Area'
            area_id = 'fresh_area'
        else:
            area_name = 'Supermarket'
            area_id = 'supermarket'

        area_counts[area_name] += 1

        heading = float(cam.get('heading_deg', 0))
        fov = float(cam.get('fov_deg', 90))
        range_m = float(cam.get('range_m', 6))
        range_svg = round(range_m * 20.0, 1)
        fov_path = get_fov_svg_path(sx, sy, heading, fov, range_svg)

        pt_geom = Point(sx, sy)
        nearest_z_name = 'Area ' + area_name
        min_z_dist = 9999
        for poly, z in zones_list:
            d = poly.distance(pt_geom)
            if d < min_z_dist:
                min_z_dist = d
                nearest_z_name = z.get('name', nearest_z_name)

        nearest_s_name = ''
        min_s_dist = 9999
        for poly, s in shelves_list:
            d = poly.distance(pt_geom)
            if d < min_s_dist:
                min_s_dist = d
                nearest_s_name = s.get('name', '')

        status = cam.get('review_status', 'verified')
        status_counts[status] = status_counts.get(status, 0) + 1

        cameras_processed.append({
            'id': cid,
            'label': cam.get('label', cid),
            'raw_pos': [px, py],
            'svg_pos': [sx, sy],
            'cad_pos': [cx, cy],
            'heading_deg': heading,
            'fov_deg': fov,
            'range_m': range_m,
            'range_svg': range_svg,
            'review_status': status,
            'is_planned': (status == 'planned'),
            'area': area_name,
            'area_id': area_id,
            'nearest_zone': nearest_z_name,
            'nearest_shelf': nearest_s_name,
            'note': cam.get('note', ''),
            'video_count': len(cam.get('videos', [])),
            'has_homography': cid in homo_dict,
            'homography_pairs': homo_dict.get(cid, 0),
            'fov_path': fov_path
        })

    # Sort cameras: verified first, then by ID
    cameras_processed.sort(key=lambda c: (0 if c['review_status'] == 'verified' else 1, c['id']))

    # Update layout dictionary
    layout['total_cameras'] = len(cameras_processed)
    layout['cameras_summary'] = {
        'total': len(cameras_processed),
        'verified': status_counts.get('verified', 0),
        'planned': status_counts.get('planned', 0),
        'by_area': area_counts
    }
    layout['cameras'] = cameras_processed

    # Also update area camera counts in layout['areas']
    for a in layout.get('areas', []):
        a_name = a.get('name')
        if a_name in area_counts:
            a['camera_count'] = area_counts[a_name]

    with open(layout_path, 'w', encoding='utf-8') as f:
        json.dump(layout, f, indent=2)

    print(f"[CAM_UPDATE] Successfully updated {layout_path}:")
    print(f"  - Total cameras: {len(cameras_processed)}")
    print(f"  - Verified: {status_counts.get('verified', 0)}")
    print(f"  - Planned: {status_counts.get('planned', 0)}")
    print(f"  - Area breakdown: {area_counts}")

if __name__ == '__main__':
    update_map_layout()
