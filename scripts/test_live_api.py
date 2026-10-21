import requests

BASE_URL = "http://localhost:8080"

# 1. Healthcheck
res = requests.get(f"{BASE_URL}/health")
print(f"Healthcheck: {res.status_code}, {res.json()}")
assert res.status_code == 200

# 2. Demo Login as Supervisor
login_res = requests.post(f"{BASE_URL}/api/v1/auth/demo-login", json={"role": "supervisor"})
print(f"Login: {login_res.status_code}")
assert login_res.status_code == 200
token = login_res.json()["token"]
headers = {"Authorization": f"Bearer {token}"}

# 3. Get Manifest
man_res = requests.get(f"{BASE_URL}/api/v1/map-heatmap/manifest", headers=headers)
print(f"Manifest: {man_res.status_code}")
assert man_res.status_code == 200
manifest = man_res.json()
print(f"  Available dates: {manifest['total_days']} days, from {manifest['available_dates'][0]} to {manifest['available_dates'][-1]}")

# 4. Get Layout
layout_res = requests.get(f"{BASE_URL}/api/v1/map-heatmap/layout", headers=headers)
print(f"Layout: {layout_res.status_code}")
assert layout_res.status_code == 200
layout = layout_res.json()
print(f"  Total shelves in layout: {layout['total_shelves']}, zones: {layout['total_zones']}")
assert layout['total_shelves'] == 949

# 5. Get Daily Heatmap (2026-10-14)
daily_res = requests.get(f"{BASE_URL}/api/v1/map-heatmap/daily?date=2026-10-14", headers=headers)
print(f"Daily 2026-10-14: {daily_res.status_code}")
assert daily_res.status_code == 200
daily = daily_res.json()
print(f"  Total Events: {daily['total_events']}")
print(f"  Mapped Events: {daily['mapped_events']} ({daily['mapped_percentage']}%)")
print(f"  Unmapped Events: {daily['unmapped_events']}")
print(f"  Top Shelf: {daily['top_shelf']['name']} ({daily['top_shelf']['id']}) with {daily['top_shelf']['count']} events")
assert daily['total_events'] == 884936
assert daily['mapped_events'] == 646016
assert daily['unmapped_events'] == 238920
assert daily['total_events'] == daily['mapped_events'] + daily['unmapped_events']

# 6. Test Non-existent date
empty_res = requests.get(f"{BASE_URL}/api/v1/map-heatmap/daily?date=2026-12-31", headers=headers)
print(f"Daily 2026-12-31: {empty_res.status_code}")
assert empty_res.status_code == 200
empty_daily = empty_res.json()
assert empty_daily['total_events'] == 0

print("\n--- ALL LIVE API TESTS PASSED! ---")
