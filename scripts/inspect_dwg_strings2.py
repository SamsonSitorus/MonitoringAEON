import re

with open(r'c:\Users\erwin\Downloads\map_full_2026-10-21-08-52-34.dwg', 'rb') as f:
    data = f.read()

# find all ascii sequences of length >= 3 from 100000 onwards
matches = re.finditer(b'[\x20-\x7e]{3,}', data[100000:145000])
for m in matches:
    print(f"Offset {100000 + m.start()}: {m.group().decode('latin1')}")
