/**
 * E2E tests for the G-Track shot entry app.
 * Requires a local HTTP server at http://localhost:8765 serving the project root.
 * Start with: python3 -m http.server 8765
 *
 * Sequential click flow per hole:
 *   Load → tee auto-placed → click to set pin → click for each shot landing
 *   → mark lie "Green" in sidebar → click for each putt → mark last putt holed
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8765/index.html';

async function mapBox(page) {
  return page.locator('#map').boundingBox();
}

// Load page, wait for map, place tee (first click) then pin (second click)
async function loadAndSetupHole(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const box = await mapBox(page);
  // First click → tee
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.55);
  await page.waitForTimeout(400);
  // Second click → pin
  await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.45);
  await page.waitForTimeout(400);
}

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
  test('on load guidance prompts for tee placement (no tee dot yet)', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await expect(page.locator('.map-dot.tee')).toHaveCount(0);
    await expect(page.locator('#guidance-label')).toBeVisible();
    await expect(page.locator('#guidance-label')).toContainText('tee');
  });

  test('first click places tee, second places pin, subsequent clicks place shot landings', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const box = await mapBox(page);

    // First click → tee
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.55);
    await page.waitForTimeout(400);
    await expect(page.locator('.map-dot.tee')).toHaveCount(1);
    expect(await page.locator('.map-pin').count()).toBe(0);

    // Second click → pin
    await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.45);
    await page.waitForTimeout(400);
    await expect(page.locator('.map-pin')).toHaveCount(1);
    expect(await page.locator('.map-dot').count()).toBe(1); // only tee dot

    // Third click → approach landing
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(400);
    expect(await page.locator('.map-dot').count()).toBe(2);
    await expect(page.locator('.map-dot.tee')).toHaveCount(1);
    await expect(page.locator('.map-dot.approach')).toHaveCount(1);

    // Fourth click → next shot (shot mode persists)
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.45);
    await page.waitForTimeout(400);
    expect(await page.locator('.map-dot').count()).toBe(3);
  });

  test('sidebar shows tee row with club and lie buttons after tee placed', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const box = await mapBox(page);

    // Place tee first
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.55);
    await page.waitForTimeout(400);

    await expect(page.locator('.shot-item .club-select').first()).toBeVisible();
    await expect(page.locator('.lie-btn').filter({ hasText: 'FW' }).first()).toBeVisible();
  });

  test('carry distance appears after approach landing placed', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const box = await mapBox(page);

    // Tee click
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.55);
    await page.waitForTimeout(400);

    const teeDist = page.locator('.shot-item .shot-dist').first();
    await expect(teeDist).toContainText('tap map');

    // Pin click (no yardage yet)
    await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.45);
    await page.waitForTimeout(400);
    await expect(teeDist).toContainText('tap map');

    // Approach landing click
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.4);
    await page.waitForTimeout(400);
    await expect(teeDist).toContainText('yds');
  });
});

test.describe('Shot entry flow', () => {
  test('OB lie button marks shot red on map', async ({ page }) => {
    await loadAndSetupHole(page);
    const box = await mapBox(page);

    // Place tee landing
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(400);

    // Mark it OB
    await page.locator('.lie-btn').filter({ hasText: 'OB' }).first().click();
    await page.waitForTimeout(200);

    await expect(page.locator('.map-dot.ob')).toHaveCount(1);
  });
});

test.describe('Putting flow', () => {
  test('marking approach lie Green switches to putting phase', async ({ page }) => {
    await loadAndSetupHole(page);
    const box = await mapBox(page);

    // Place tee landing
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(400);

    // Mark as on green → enters putt mode
    await page.locator('.lie-btn').filter({ hasText: 'Green' }).first().click();
    await page.waitForTimeout(200);

    // Next click places a putt
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.waitForTimeout(400);
    await expect(page.locator('.map-dot.putt')).toHaveCount(1);
  });

  test('putt shows ft-to-pin in sidebar', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const box = await mapBox(page);

    // Tee, pin, approach landing, mark green, putt
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.55); // tee
    await page.waitForTimeout(400);
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6); // pin
    await page.waitForTimeout(400);
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5); // approach landing
    await page.waitForTimeout(400);
    await page.locator('.lie-btn').filter({ hasText: 'Green' }).first().click(); // on green
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4); // putt
    await page.waitForTimeout(400);

    await expect(page.locator('.map-dot.putt')).toHaveCount(1);
    await expect(page.locator('.putt-dist')).toContainText('ft to pin');
  });

  test('marking putt holed shows ⛳ and updates button', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const box = await mapBox(page);

    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.55); // tee
    await page.waitForTimeout(400);
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6); // pin
    await page.waitForTimeout(400);
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5); // approach landing
    await page.waitForTimeout(400);
    await page.locator('.lie-btn').filter({ hasText: 'Green' }).first().click();
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4); // putt
    await page.waitForTimeout(400);

    await page.locator('.putt-holed-btn').click();
    await expect(page.locator('.putt-holed-btn')).toHaveClass(/holed/);
    await expect(page.locator('.putt-holed-btn')).toContainText('Holed');
  });
});

test.describe('Undo and navigation', () => {
  test('undo removes last placed dot', async ({ page }) => {
    await loadAndSetupHole(page);
    const box = await mapBox(page);

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

  test('navigating to new hole clears markers and prompts for tee', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await page.click('#btn-next');
    await page.waitForTimeout(600);

    await expect(page.locator('.map-dot.tee')).toHaveCount(0);
    await expect(page.locator('#guidance-label')).toBeVisible();
    await expect(page.locator('#guidance-label')).toContainText('tee');
  });
});
