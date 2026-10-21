from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1600, "height": 1050})
        page = context.new_page()

        print("1. Navigating to http://localhost:5173...")
        page.goto("http://localhost:5173")
        page.wait_for_load_state("networkidle")

        demo_btn = page.query_selector("button:has-text('Supervisor')")
        if demo_btn:
            print("Clicking Supervisor demo login...")
            demo_btn.click()
            time.sleep(2)
            page.wait_for_load_state("networkidle")

        map_nav = page.query_selector("button:has-text('Map Heatmap')")
        if map_nav:
            print("Clicking Map Heatmap nav...")
            map_nav.click()
            time.sleep(3)
            page.wait_for_load_state("networkidle")

        # Open Peringkat Shelf tab and click "Lihat di Peta" on Rank #1 (Ubi Cilembu / 4FB)
        tab_rank = page.query_selector("button:has-text('Peringkat Shelf')")
        if tab_rank:
            print("Opening Peringkat Shelf tab...")
            tab_rank.click()
            time.sleep(1)
            
            # Click first "Lihat di Peta" button
            view_map_btn = page.query_selector("table tbody tr button:has-text('Lihat di Peta')")
            if view_map_btn:
                print("Clicking Lihat di Peta on Rank #1 (Ubi Cilembu)...")
                view_map_btn.click()
                time.sleep(2)
                page.screenshot(path="map_shelf_breakdown_actions.png")
                print("Screenshot saved to map_shelf_breakdown_actions.png")

                card = page.locator(".card:has-text('DETAIL SHELF TERPILIH')")
                if card.count() > 0:
                    card.first.screenshot(path="map_shelf_card_actions_detail.png")
                    print("Screenshot saved to map_shelf_card_actions_detail.png")

                # Switch to Deteksi AI tab
                ai_tab_btn = page.query_selector("button:has-text('Deteksi AI')")
                if ai_tab_btn:
                    print("Clicking Deteksi AI tab...")
                    ai_tab_btn.click()
                    time.sleep(1)
                    page.screenshot(path="map_shelf_breakdown_ai.png")
                    print("Screenshot saved to map_shelf_breakdown_ai.png")
                    if card.count() > 0:
                        card.first.screenshot(path="map_shelf_card_ai_detail.png")
                        print("Screenshot saved to map_shelf_card_ai_detail.png")

        browser.close()

if __name__ == '__main__':
    run()
