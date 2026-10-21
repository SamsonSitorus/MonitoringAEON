with open(r'c:\Users\erwin\Downloads\map_full_2026-10-21-08-52-34.dwg', 'rb') as f:
    data = f.read()

pos = 0
targets = [b'Entrance Utara 2', b'Lorong Bawah 3', b'Fresh Area 2', b'Cold Bev', b'Wafer']
for t in targets:
    pos = data.find(t)
    print(f"Target {t}: found at {pos}")
    if pos != -1:
        # print 100 bytes around it
        start = max(0, pos - 50)
        end = min(len(data), pos + 100)
        print("  Context:", data[start:end])
