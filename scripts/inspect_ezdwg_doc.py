import ezdwg

doc = ezdwg.read(r'c:\Users\erwin\Downloads\map_full_2026-10-21-08-52-34.dwg')

print("Blocks:")
# Let's see what methods doc has
for attr in dir(doc):
    if any(k in attr.lower() for k in ['block', 'table', 'dict', 'object', 'ent']):
        print(f"  {attr}")
