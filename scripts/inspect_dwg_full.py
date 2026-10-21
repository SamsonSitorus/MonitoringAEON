import ezdxf

doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

print("Header variables:")
for k in doc.header.varnames():
    if any(term in k.lower() for term in ['ext', 'lim', 'unit', 'scale', 'ins']):
        print(f"  {k}: {doc.header.get(k)}")

print("\nSample TEXT entities (first 50):")
texts = []
for e in msp:
    if e.dxftype() == 'TEXT':
        texts.append((e.dxf.text, e.dxf.layer, e.dxf.insert, e.dxf.height))

for t in texts[:50]:
    print(f"  Layer: {t[1]}, Height: {t[3]:.2f}, Pos: ({t[2][0]:.2f}, {t[2][1]:.2f}), Text: {t[0]}")
