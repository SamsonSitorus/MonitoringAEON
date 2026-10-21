from playwright.sync_api import sync_playwright
import time
import shutil
import os

def capture():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # 1600x1100 viewport
        context = browser.new_context(viewport={"width": 1600, "height": 1100})
        page = context.new_page()

        print("Navigating to app...")
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
            time.sleep(1.5)
            page.wait_for_load_state("networkidle")

        # 1. Full page overview of Map Heatmap
        page.screenshot(path="k:/MonitoringION/map_view_fullpage.png", full_page=True)
        print("Captured map_view_fullpage.png")

        # 2. Click a shelf (e.g. Ubi Cilembu or Processed Meat or Rice)
        shelf_polys = page.query_selector_all("#layer-shelves polygon")
        if len(shelf_polys) > 50:
            shelf_polys[50].click(force=True)
            time.sleep(1)
            page.screenshot(path="k:/MonitoringION/map_view_with_shelf.png")
            print("Captured map_view_with_shelf.png")

        # Copy to artifact directory
        artifact_dir = r"C:\Users\erwin\.gemini\antigravity\brain\7df800ea-bb86-48be-89a2-1aa0847d090c"
        for name in ["map_view_fullpage.png", "map_view_with_shelf.png"]:
            src = os.path.join(r"k:\MonitoringION", name)
            if os.path.exists(src):
                shutil.copy2(src, os.path.join(artifact_dir, name))
                print(f"Copied {name} to {artifact_dir}")

        browser.close()

if __name__ == "__main__":
    capture()
