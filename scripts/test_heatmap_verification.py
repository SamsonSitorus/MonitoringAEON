import os
import json
import pytest
import pyarrow.parquet as pq

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', 'data')

def test_layout_structure():
    layout_file = os.path.join(DATA_DIR, 'map_layout.json')
    assert os.path.exists(layout_file), "map_layout.json must exist"

    with open(layout_file, 'r', encoding='utf-8') as f:
        layout = json.load(f)

    assert layout['total_shelves'] == 949, "Total shelves must be 949"
    assert layout['total_zones'] == 75, "Total zones must be 75"
    assert len(layout['shelves']) == 949
    assert len(layout['zones']) == 75
    assert 'viewbox_full' in layout
    assert 'viewbox_focused' in layout

    # Check shelf properties
    for s in layout['shelves']:
        assert 'id' in s and s['id']
        assert 'name' in s and s['name']
        assert 'isle' in s and s['isle']
        assert 'area' in s and s['area']
        assert s['area'] in ('Supermarket', 'Fresh Area', 'Cashier Supermarket')
        assert 'svg_points' in s and len(s['svg_points']) > 0
        assert 'svg_centroid' in s and len(s['svg_centroid']) == 2

def test_manifest_structure():
    manifest_file = os.path.join(DATA_DIR, 'manifest.json')
    assert os.path.exists(manifest_file), "manifest.json must exist"

    with open(manifest_file, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    assert manifest['total_days'] == 17, "Manifest must contain all 17 days"
    assert len(manifest['available_dates']) == 17
    assert '2026-10-14' in manifest['available_dates']

def test_daily_data_reconciliation():
    # Test all 17 days for exact reconciliation: total_events == mapped_events + unmapped_events
    daily_dir = os.path.join(DATA_DIR, 'daily')
    assert os.path.exists(daily_dir), "daily dir must exist"

    dates = sorted([f.replace('.json', '') for f in os.listdir(daily_dir) if f.endswith('.json')])
    assert len(dates) == 17, "Must have 17 daily JSON files"

    for date in dates:
        file_path = os.path.join(daily_dir, f"{date}.json")
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        assert data['date'] == date
        total = data['total_events']
        mapped = data['mapped_events']
        unmapped = data['unmapped_events']

        # Exact reconciliation principle
        assert total == mapped + unmapped, f"Reconciliation failed for {date}: {total} != {mapped} + {unmapped}"
        assert data['shelves_total'] == 949
        assert data['shelves_with_events'] <= 949
        assert data['shelves_with_events'] > 850
        assert data['areas_count'] == 3
        assert data['isles_count'] >= 45

        # Check sum of shelf_counts equals mapped_events
        sum_shelf_events = sum(data['shelf_counts'].values())
        assert sum_shelf_events == mapped, f"Sum of shelf counts != mapped_events for {date}"

        # Check top shelf integrity
        top = data['top_shelf']
        assert top is not None
        assert top['count'] > 0
        assert top['id'] in data['shelf_counts']
        assert top['count'] == data['shelf_counts'][top['id']]

def test_reference_date_2026_10_14():
    # Specific check on the user's reference file
    file_path = os.path.join(DATA_DIR, 'daily', '2026-10-14.json')
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Parquet 2026-10-14 has exactly 884,936 rows
    assert data['total_events'] == 884936
    assert data['mapped_events'] == 646016
    assert data['unmapped_events'] == 238920
    assert round(data['mapped_percentage'], 2) == 73.00
    assert data['top_shelf']['id'] == '4FB'
    assert data['top_shelf']['name'] == 'Ubi Cilembu'
    assert data['top_shelf']['count'] == 13713
