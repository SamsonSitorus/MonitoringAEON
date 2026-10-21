from playwright.sync_api import sync_playwright
import time
import shutil
import os

def capture():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Larger viewport to see complete layout and panels
        context = browser.new_context(viewport={"width": 1600, "height": 1100})
        page = context.new_page()

        print("1. Navigating to http://localhost:5173...")
        page.goto("http://localhost:5173")
        page.wait_for_load_state("networkidle")

        demo_btn = page.query_selector("button:has-text('Supervisor')")
        if demo_btn:
            demo_btn.click()
            time.sleep(1.5)
            page.wait_for_load_state("networkidle")

        map_nav = page.query_selector("button:has-text('Map Heatmap')")
        if map_nav:
            map_nav.click()
            time.sleep(2)
            page.wait_for_load_state("networkidle")

        # Scroll so the entire map canvas and legend are beautifully framed
        page.evaluate("window.scrollTo(0, 220)")
        time.sleep(1)

        # 1. Capture Full Map View with all 3 areas clearly visible!
        page.screenshot(path="k:/MonitoringION/map_full_3areas.png")
        print("Captured map_full_3areas.png")

        # 2. Click a Delica Area zone (e.g. index 41 which is Bakery or Delica Area)
        print("Clicking Delica Area zone...")
        page.evaluate("""() => {
            const polys = Array.from(document.querySelectorAll('#layer-zones polygon'));
            // Find a polygon with Delica amber fill or index around 40-45
            const delicaPoly = polys.find(p => p.getAttribute('fill') && p.getAttribute('fill').includes('245, 158, 11')) || polys[41];
            if (delicaPoly) {
                delicaPoly.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            }
        }""")
        time.sleep(1)
        page.screenshot(path="k:/MonitoringION/map_delica_zone_selected.png")
        print("Captured map_delica_zone_selected.png")

        # 3. Click tab: Ringkasan Area & Isle
        tab_area = page.query_selector("button:has-text('Ringkasan Area & Isle')")
        if tab_area:
            tab_area.click()
            time.sleep(1)
            page.evaluate("window.scrollTo(0, 0)")
            time.sleep(0.5)
            page.screenshot(path="k:/MonitoringION/map_tab_3areas_summary.png")
            print("Captured map_tab_3areas_summary.png")

        # Copy to artifact directory
        artifact_dir = r"C:\Users\erwin\.gemini\antigravity\brain\7df800ea-bb86-48be-89a2-1aa0847d090c"
        for name in ["map_full_3areas.png", "map_delica_zone_selected.png", "map_tab_3areas_summary.png"]:
            src = os.path.join(r"k:\MonitoringION", name)
            if os.path.exists(src):
                shutil.copy2(src, os.path.join(artifact_dir, name))
                print(f"Copied {name} to {artifact_dir}")

        browser.close()

if __name__ == '__main__':
    capture()
