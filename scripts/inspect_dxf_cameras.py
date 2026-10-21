import ezdxf

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

# Look at TEXT entities that might be camera names or look for TEXT on any layer
texts_by_layer = {}
for e in msp:
    if e.dxftype() == 'TEXT':
        texts_by_layer.setdefault(e.dxf.layer, []).append((e.dxf.text, e.dxf.insert[0], e.dxf.insert[1]))

print("Text counts by layer:")
for k, v in texts_by_layer.items():
    print(f"  {k}: {len(v)}")

# Search for "ENTRANCE", "LORONG", "FRESH" in all texts
for layer, items in texts_by_layer.items():
    matches = [it for it in items if any(w in it[0].upper() for w in ['ENTRANCE', 'LORONG', 'FRESH'])]
    print(f"Matches in layer {layer}: {len(matches)}")
    for m in matches[:10]:
        print(f"    {m[0]} at ({m[1]:.2f}, {m[2]:.2f})")
