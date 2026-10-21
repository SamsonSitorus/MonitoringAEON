import ezdxf

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

print("--- Inspecting ZONES ---")
zones = []
for e in msp:
    if e.dxf.layer == 'ZONES':
        pts = e.get_points(format='xy') if hasattr(e, 'get_points') else []
        zones.append((e.dxftype(), pts))
print(f"Total ZONES entities: {len(zones)}")
for i, z in enumerate(zones[:10]):
    print(f"  Zone {i}: type={z[0]}, num_pts={len(z[1])}, pts={z[1][:3]}...")

print("\n--- Inspecting SHELVES ---")
shelves = []
for e in msp:
    if e.dxf.layer == 'SHELVES':
        pts = e.get_points(format='xy') if hasattr(e, 'get_points') else []
        shelves.append((e.dxftype(), pts, e.dxf.handle))
print(f"Total SHELVES entities: {len(shelves)}")
for i, s in enumerate(shelves[:10]):
    print(f"  Shelf {i}: handle={s[2]}, type={s[0]}, num_pts={len(s[1])}, pts={s[1]}")

print("\n--- Inspecting CAMERAS ---")
cameras = []
for e in msp:
    if e.dxf.layer == 'CAMERAS':
        cameras.append((e.dxftype(), getattr(e.dxf, 'center', getattr(e.dxf, 'insert', getattr(e.dxf, 'start', None)))))
print(f"Total CAMERAS entities: {len(cameras)}")
for i, c in enumerate(cameras[:10]):
    print(f"  Camera {i}: type={c[0]}, pos={c[1]}")
