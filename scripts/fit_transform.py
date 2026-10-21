import ezdxf
import pyarrow.parquet as pq
import pandas as pd
import numpy as np
import math

# 1. Read Parquet cameras
file_path = r'k:\ai-shopper-events-2026-10-01-2026-10-17-final-20261018f-identity-split\ai_shopper_events_2026-10-14.parquet'
table = pq.read_table(file_path, columns=['camera_id', 'x_coordinate', 'y_coordinate'])
df = table.to_pandas()
pq_cams = df.groupby('camera_id').agg(
    count=('x_coordinate', 'count'),
    mean_x=('x_coordinate', 'mean'),
    mean_y=('y_coordinate', 'mean')
).reset_index()

# 2. Read DXF cameras and their labels
doc = ezdxf.readfile('map_full.dxf')
msp = doc.modelspace()

dxf_texts = []
for e in msp:
    if e.dxftype() == 'TEXT':
        dxf_texts.append((e.dxf.text.strip(), e.dxf.insert[0], e.dxf.insert[1]))

dxf_cams = []
for e in msp:
    if e.dxf.layer in ('CAMERAS', 'CAMERAS_PLANNED') and e.dxftype() == 'CIRCLE':
        cx, cy = e.dxf.center[0], e.dxf.center[1]
        # find closest label
        best_label = None
        min_d = 999
        for text, tx, ty in dxf_texts:
            d = math.hypot(cx - tx, cy - ty)
            if d < min_d:
                min_d = d
                best_label = text
        if min_d < 1.0: # very close label
            dxf_cams.append({
                'dxf_name': best_label,
                'dxf_x': cx,
                'dxf_y': cy,
                'dist': min_d
            })

dxf_cams_df = pd.DataFrame(dxf_cams)
print(f"Matched {len(dxf_cams_df)} DXF cameras with labels.")

# Merge on camera_id
# Normalize camera names for matching: e.g. "D2" -> "D2", or uppercase
dxf_cams_df['cam_upper'] = dxf_cams_df['dxf_name'].str.upper()
pq_cams['cam_upper'] = pq_cams['camera_id'].str.upper()

merged = pd.merge(pq_cams, dxf_cams_df, on='cam_upper')
print(f"\nSuccessfully matched {len(merged)} cameras between Parquet and DXF!")
print(merged[['cam_upper', 'count', 'mean_x', 'mean_y', 'dxf_x', 'dxf_y']].to_string())

# Let's perform linear regression
# parquet_x = a * dxf_x + b * dxf_y + c
# parquet_y = d * dxf_x + e * dxf_y + f
X_dxf = np.column_stack([merged['dxf_x'], merged['dxf_y'], np.ones(len(merged))])
px = merged['mean_x'].values
py = merged['mean_y'].values

# Least squares
sol_x, residuals_x, _, _ = np.linalg.lstsq(X_dxf, px, rcond=None)
sol_y, residuals_y, _, _ = np.linalg.lstsq(X_dxf, py, rcond=None)

print("\n--- Affine Fit Results ---")
print(f"parquet_x = {sol_x[0]:.4f} * dxf_x + {sol_x[1]:.4f} * dxf_y + {sol_x[2]:.4f}")
print(f"parquet_y = {sol_y[0]:.4f} * dxf_x + {sol_y[1]:.4f} * dxf_y + {sol_y[2]:.4f}")

# Compute errors
pred_x = X_dxf @ sol_x
pred_y = X_dxf @ sol_y
err = np.sqrt((pred_x - px)**2 + (pred_y - py)**2)
print(f"Mean residual error (camera center vs event centroid): {np.mean(err):.2f} px")
