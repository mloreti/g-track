/**
 * E2E tests for the G-Track shot entry app.
 * Requires a local HTTP server at http://localhost:8765 serving the project root.
 * Start with: python3 -m http.server 8765
 *
 * Flow per hole:
 *   1. Load → tee auto-placed, guidance prompts for pin
 *   2. First map click → places pin, guidance shifts to "tee shot landed"
 *   3. Second map click → places tee landing (approach dot)
 *   4. Subsequent clicks via + Shot / + Putt buttons
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8765/index.html';

// Place the pin (first required click on every fresh hole load)
async function placePin(page) {
  const map = page.locator('#map');
  const box = await map.boundingBox();
  await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.45);
  await page.waitForTimeout(400);
}

// Full hole setup: load, wait, place pin
async function loadAndSetupHole(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await placePin(page);
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
  test('tee marker auto-placed and guidance prompts for pin on load', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Tee auto-placed — one dot on map
    await expect(page.locator('.map-dot.tee')).toHaveCount(1);

    // Guidance should prompt to set the pin first
    const guidance = page.locator('#guidance-label');
    await expect(guidance).toBeVisible();
    await expect(guidance).toContainText('pin');
  });

  test('first click places pin, second click places tee landing', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const map = page.locator('#map');
    const box = await map.boundingBox();

    // First click → pin placed (no new dot, but map-pin appears)
    await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.45);
    await page.waitForTimeout(400);
    await expect(page.locator('.map-pin')).toHaveCount(1);
    expect(await page.locator('.map-dot').count()).toBe(1); // still only tee dot

    // Second click → tee landing placed (approach dot)
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(400);
    expect(await page.locator('.map-dot').count()).toBe(2);
    await expect(page.locator('.map-dot.tee')).toHaveCount(1);
    await expect(page.locator('.map-dot.approach')).toHaveCount(1);

    // Guidance clears after landing placed
    await expect(page.locator('#guidance-label')).not.toBeVisible();
  });

  test('sidebar shows tee row with club and result lie buttons', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Tee row rendered immediately (tee auto-placed before pin prompt)
    const clubSelect = page.locator('.shot-item .club-select').first();
    await expect(clubSelect).toBeVisible();

    const fwBtn = page.locator('.lie-btn').filter({ hasText: 'FW' }).first();
    await expect(fwBtn).toBeVisible();
  });

  test('carry distance appears in sidebar after tee landing placed', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Before landing: tee row shows hint
    const teeDist = page.locator('.shot-item .shot-dist').first();
    await expect(teeDist).toContainText('tap map');

    const map = page.locator('#map');
    const box = await map.boundingBox();

    // First click → place pin (still no landing)
    await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.45);
    await page.waitForTimeout(400);
    await expect(teeDist).toContainText('tap map');

    // Second click → place tee landing
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.4);
    await page.waitForTimeout(400);

    // Now shows carry yardage
    await expect(teeDist).toContainText('yds');
  });
});

test.describe('Shot entry flow', () => {
  test('+ Shot button activates with guidance then clears after tap', async ({ page }) => {
    await loadAndSetupHole(page);

    const map = page.locator('#map');
    const box = await map.boundingBox();

    // Place tee landing to finish initial auto-mode
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
    await loadAndSetupHole(page);

    // Place tee landing
    const map = page.locator('#map');
    const box = await map.boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(400);

    // Mark it OB
    const obBtn = page.locator('.lie-btn').filter({ hasText: 'OB' }).first();
    await obBtn.click();
    await page.waitForTimeout(200);

    await expect(page.locator('.map-dot.ob')).toHaveCount(1);
  });
});

test.describe('Putting flow', () => {
  test('On Green shows guidance and activates putting phase', async ({ page }) => {
    await loadAndSetupHole(page);

    await page.click('#btn-on-green');
    await expect(page.locator('#btn-on-green')).toHaveClass(/green/);
    await expect(page.locator('#guidance-label')).toContainText('Putt');
  });

  test('pin placed on load, putt shows ft-to-pin in sidebar', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const map = page.locator('#map');
    const box = await map.boundingBox();

    // First click places pin
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6);
    await page.waitForTimeout(400);
    await expect(page.locator('.map-pin')).toHaveCount(1);

    // Enter putting phase and place putt
    await page.click('#btn-on-green');
    await page.click('#btn-add-putt');
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.waitForTimeout(400);
    await expect(page.locator('.map-dot.putt')).toHaveCount(1);
    await expect(page.locator('.putt-dist')).toContainText('ft to pin');
  });

  test('marking putt holed shows ⛳ and updates button', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const map = page.locator('#map');
    const box = await map.boundingBox();

    // Place pin (first click)
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6);
    await page.waitForTimeout(400);

    // Enter putting phase and place putt
    await page.click('#btn-on-green');
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
    await loadAndSetupHole(page);

    const map = page.locator('#map');
    const box = await map.boundingBox();

    // Place tee landing
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

  test('navigating to new hole resets tee and prompts for pin', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await page.click('#btn-next');
    await page.waitForTimeout(600);

    // Hole 2: tee auto-placed, guidance prompts for pin
    await expect(page.locator('.map-dot.tee')).toHaveCount(1);
    await expect(page.locator('#guidance-label')).toBeVisible();
    await expect(page.locator('#guidance-label')).toContainText('pin');
  });
});
