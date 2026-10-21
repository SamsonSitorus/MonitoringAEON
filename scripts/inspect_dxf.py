import ezdxf

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

for layer_name in ['SHELVES', 'ZONES', 'LABELS', 'CAMERAS']:
    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')
    count = 0
    for e in msp:
        if e.dxf.layer != layer_name:
            continue
        if e.dxftype() == 'LWPOLYLINE':
            for pt in e.get_points(format='xy'):
                min_x = min(min_x, pt[0])
                max_x = max(max_x, pt[0])
                min_y = min(min_y, pt[1])
                max_y = max(max_y, pt[1])
            count += 1
        elif e.dxftype() == 'TEXT':
            pt = e.dxf.insert
            min_x = min(min_x, pt[0])
            max_x = max(max_x, pt[0])
            min_y = min(min_y, pt[1])
            max_y = max(max_y, pt[1])
            count += 1
        elif e.dxftype() in ('CIRCLE', 'LINE'):
            count += 1
    print(f'Layer {layer_name} ({count} entities): X [{min_x:.2f}, {max_x:.2f}], Y [{min_y:.2f}, {max_y:.2f}]')
