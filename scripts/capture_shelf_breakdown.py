import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1600, 'height': 1050})
        page = await context.new_page()

        print("1. Navigating to http://localhost:5173...")
        await page.goto("http://localhost:5173")
        await page.wait_for_timeout(2000)

        # Demo login as supervisor
        if await page.locator("text=Supervisor Demo").is_visible():
            print("Logging in as Supervisor...")
            await page.click("text=Supervisor Demo")
            await page.wait_for_timeout(2000)

        # Navigate to Map Heatmap
        print("Navigating to Map Heatmap tab...")
        await page.click("text=Map Heatmap")
        await page.wait_for_timeout(3000)

        # Click on 4FB shelf directly
        print("Clicking on 4FB shelf polygon...")
        shelf_4fb = page.locator("#shelf-4FB")
        if await shelf_4fb.count() > 0:
            await shelf_4fb.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path="map_shelf_breakdown_actions.png")
            print("Saved map_shelf_breakdown_actions.png")

            # Click on 'Deteksi AI' button
            print("Clicking on Deteksi AI button...")
            ai_btn = page.locator("button:has-text('Deteksi AI')")
            if await ai_btn.count() > 0:
                await ai_btn.click()
                await page.wait_for_timeout(800)
                await page.screenshot(path="map_shelf_breakdown_ai.png")
                print("Saved map_shelf_breakdown_ai.png")
        else:
            print("Shelf 4FB not found, screenshotting anyway...")
            await page.screenshot(path="map_shelf_breakdown_fallback.png")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
