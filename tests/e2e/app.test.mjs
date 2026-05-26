/**
 * E2E tests for the G-Track shot entry app.
 * Requires a local HTTP server at http://localhost:8765 serving the project root.
 * Start with: python3 -m http.server 8765
 */

import { test, expect, chromium } from '@playwright/test';

const BASE = 'http://localhost:8765/index.html';

test.describe('App load', () => {
  test('map tiles load and sidebar shows Hole 1 · Par 4', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await expect(page.locator('#hole-label')).toHaveText('Hole 1 · Par 4');
    const tiles = await page.locator('.leaflet-tile-loaded').count();
    expect(tiles).toBeGreaterThan(0);
  });
});

test.describe('Guided tee flow', () => {
  test('tee marker auto-placed and guidance label shown on load', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Tee shot auto-placed — one dot should already be on the map
    await expect(page.locator('.map-dot.tee')).toHaveCount(1);

    // Guidance label should be visible with landing prompt
    const guidance = page.locator('#guidance-label');
    await expect(guidance).toBeVisible();
    await expect(guidance).toContainText('ball land');
  });

  test('first map tap places landing position (approach), not a second tee', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const map = page.locator('#map');
    const box = await map.boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(400);

    // Should now have 2 dots: tee + approach landing
    const dots = await page.locator('.map-dot').count();
    expect(dots).toBe(2);

    // First dot is tee, second is approach (blue)
    await expect(page.locator('.map-dot.tee')).toHaveCount(1);
    await expect(page.locator('.map-dot.approach')).toHaveCount(1);

    // Guidance label hidden after placing shot
    await expect(page.locator('#guidance-label')).not.toBeVisible();
  });

  test('sidebar shows tee row with club and result lie buttons', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Tee row should have a club dropdown and lie buttons
    const clubSelect = page.locator('.shot-item .club-select').first();
    await expect(clubSelect).toBeVisible();

    const fwBtn = page.locator('.lie-btn').filter({ hasText: 'FW' }).first();
    await expect(fwBtn).toBeVisible();
  });

  test('carry distance appears in sidebar after landing placed', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Before landing: shows hint text
    const teeDist = page.locator('.shot-item .shot-dist').first();
    await expect(teeDist).toContainText('tap map');

    // Place landing
    const map = page.locator('#map');
    const box = await map.boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.4);
    await page.waitForTimeout(400);

    // After landing: shows yardage
    await expect(teeDist).toContainText('yds');
  });
});

test.describe('Shot entry flow', () => {
  test('+ Shot button activates with guidance then clears after tap', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Place landing first to clear auto-mode
    const map = page.locator('#map');
    const box = await map.boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(400);

    // Click + Shot
    await page.click('#btn-add-shot');
    await expect(page.locator('#btn-add-shot')).toHaveClass(/active/);
    await expect(page.locator('#guidance-label')).toContainText('ball land');

    // Tap map — places approach shot
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.waitForTimeout(400);
    await expect(page.locator('#btn-add-shot')).not.toHaveClass(/active/);
    await expect(page.locator('#guidance-label')).not.toBeVisible();
    expect(await page.locator('.map-dot').count()).toBe(3);
  });

  test('OB lie button marks shot red on map', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Place approach landing
    const map = page.locator('#map');
    const box = await map.boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(400);

    // Mark it OB
    const obBtn = page.locator('.lie-btn').filter({ hasText: 'OB' }).first();
    await obBtn.click();
    await page.waitForTimeout(200);

    // Dot should now be OB (red) class
    await expect(page.locator('.map-dot.ob')).toHaveCount(1);
  });
});

test.describe('Putting flow', () => {
  test('On Green shows guidance and enables pin + putt buttons', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await page.click('#btn-on-green');
    await expect(page.locator('#btn-on-green')).toHaveClass(/green/);
    await expect(page.locator('#guidance-label')).toContainText('pin');
  });

  test('placing pin then putt shows ft-to-pin in sidebar', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await page.click('#btn-on-green');
    const map = page.locator('#map');
    const box = await map.boundingBox();

    // Place pin
    await page.click('#btn-place-pin');
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6);
    await page.waitForTimeout(400);
    await expect(page.locator('.map-pin')).toHaveCount(1);

    // Place putt
    await page.click('#btn-add-putt');
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.waitForTimeout(400);
    await expect(page.locator('.map-dot.putt')).toHaveCount(1);
    await expect(page.locator('.putt-dist')).toContainText('ft to pin');
  });

  test('marking putt holed shows ⛳ and updates button', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await page.click('#btn-on-green');
    const map = page.locator('#map');
    const box = await map.boundingBox();

    await page.click('#btn-place-pin');
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6);
    await page.waitForTimeout(400);

    await page.click('#btn-add-putt');
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.waitForTimeout(400);

    await page.locator('.putt-holed-btn').click();
    await expect(page.locator('.putt-holed-btn')).toHaveClass(/holed/);
    await expect(page.locator('.putt-holed-btn')).toContainText('Holed');
  });
});

test.describe('Undo and navigation', () => {
  test('undo removes last placed dot', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const map = page.locator('#map');
    const box = await map.boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(400);

    expect(await page.locator('.map-dot').count()).toBe(2);
    await page.click('#btn-undo');
    await page.waitForTimeout(300);
    expect(await page.locator('.map-dot').count()).toBe(1);
  });

  test('next/prev navigation updates hole label', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await page.click('#btn-next');
    await page.waitForTimeout(300);
    await expect(page.locator('#hole-label')).toHaveText('Hole 2 · Par 4');

    await page.click('#btn-prev');
    await page.waitForTimeout(300);
    await expect(page.locator('#hole-label')).toHaveText('Hole 1 · Par 4');
  });

  test('navigating to new hole resets tee auto-placement', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await page.click('#btn-next');
    await page.waitForTimeout(600);

    // Hole 2 should also have auto-placed tee dot
    await expect(page.locator('.map-dot.tee')).toHaveCount(1);
    await expect(page.locator('#guidance-label')).toBeVisible();
  });
});
