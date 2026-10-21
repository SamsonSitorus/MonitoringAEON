from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print("1. Navigating to http://localhost:5173...")
        page.goto("http://localhost:5173")
        page.wait_for_load_state("networkidle")

        demo_btn = page.query_selector("button:has-text('Supervisor')")
        if demo_btn:
            demo_btn.click()
            time.sleep(2)
            page.wait_for_load_state("networkidle")

        map_nav = page.query_selector("button:has-text('Map Heatmap')")
        if map_nav:
            map_nav.click()
            time.sleep(2)
            page.wait_for_load_state("networkidle")

        # Click on a shelf specifically in #layer-shelves
        shelf_polys = page.query_selector_all("#layer-shelves polygon")
        print(f"Total shelf polygons: {len(shelf_polys)}")

        if shelf_polys:
            # Click shelf #20
            print("Clicking shelf polygon...")
            shelf_polys[20].click(force=True)
            time.sleep(1)
            page.screenshot(path="map_heatmap_shelf_selected.png")
            print("Screenshot saved to map_heatmap_shelf_selected.png")

        # Test tab navigation: Peringkat Shelf
        tab_rank = page.query_selector("button:has-text('Peringkat Shelf')")
        if tab_rank:
            tab_rank.click()
            time.sleep(1)
            page.screenshot(path="map_heatmap_tab_rankings.png")
            print("Screenshot saved to map_heatmap_tab_rankings.png")

        # Test tab navigation: Ringkasan Area & Isle
        tab_area = page.query_selector("button:has-text('Ringkasan Area & Isle')")
        if tab_area:
            tab_area.click()
            time.sleep(1)
            page.screenshot(path="map_heatmap_tab_areas.png")
            print("Screenshot saved to map_heatmap_tab_areas.png")

        # Test tab navigation: Rekonsiliasi Data
        tab_audit = page.query_selector("button:has-text('Rekonsiliasi Data')")
        if tab_audit:
            tab_audit.click()
            time.sleep(1)
            page.screenshot(path="map_heatmap_tab_audit.png")
            print("Screenshot saved to map_heatmap_tab_audit.png")

        browser.close()

if __name__ == '__main__':
    run()
