import pyarrow.parquet as pq
import pandas as pd

file_path = r'k:\ai-shopper-events-2026-10-01-2026-10-17-final-20261018f-identity-split\ai_shopper_events_2026-10-14.parquet'
table = pq.read_table(file_path, columns=['camera_id', 'x_coordinate', 'y_coordinate', 'roi_area_id', 'store_id'])
df = table.to_pandas()

cam_stats = df.groupby('camera_id').agg(
    count=('x_coordinate', 'count'),
    min_x=('x_coordinate', 'min'),
    max_x=('x_coordinate', 'max'),
    mean_x=('x_coordinate', 'mean'),
    min_y=('y_coordinate', 'min'),
    max_y=('y_coordinate', 'max'),
    mean_y=('y_coordinate', 'mean')
).reset_index().sort_values(by='count', ascending=False)

print(f"Total unique cameras: {len(cam_stats)}")
print(cam_stats.to_string())
