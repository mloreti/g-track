/**
 * E2E tests for the G-Track shot entry app.
 * Requires a local HTTP server at http://localhost:8765 serving the project root.
 * Start with: python3 -m http.server 8765
 *
 * Click flow per hole:
 *   Load → click to set tee → click to set pin → clicks to place shot landings
 *   → mark endLie "Green" → clicks for putts → mark last putt holed
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8765/index.html';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

async function mapBox(page) {
  return page.locator('#map').boundingBox();
}

// Load page and run through setup: tee (click 1), pin (click 2), first shot landing (click 3).
async function loadAndSetupHole(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const box = await mapBox(page);
  // Click 1 → tee
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.8);
  await page.waitForTimeout(400);
  // Click 2 → pin
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.2);
  await page.waitForTimeout(400);
  // Click 3 → first shot landing (tee shot)
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
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

test.describe('Guided setup flow', () => {
  test('on load guidance prompts for tee placement, no dots yet', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await expect(page.locator('.map-dot')).toHaveCount(0);
    await expect(page.locator('.map-pin')).toHaveCount(0);
    await expect(page.locator('#guidance-label')).toBeVisible();
    await expect(page.locator('#guidance-label')).toContainText('tee');
  });

  test('click 1 places tee marker, click 2 places pin, click 3 places first shot', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const box = await mapBox(page);

    // Click 1 → tee marker appears, guidance switches to pin
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.8);
    await page.waitForTimeout(400);
    await expect(page.locator('.map-tee')).toHaveCount(1);
    await expect(page.locator('#guidance-label')).toContainText('pin');

    // Click 2 → pin marker appears, guidance switches to shot
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.2);
    await page.waitForTimeout(400);
    await expect(page.locator('.map-pin')).toHaveCount(2); // tee + pin
    await expect(page.locator('#guidance-label')).toContainText('shot landed');

    // Click 3 → first shot dot appears
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
    await page.waitForTimeout(400);
    await expect(page.locator('.map-dot')).toHaveCount(1);
    await expect(page.locator('.map-dot.approach')).toHaveCount(1);
  });

  test('sidebar shows shot row with club and lie buttons after first shot placed', async ({ page }) => {
    await loadAndSetupHole(page);

    await expect(page.locator('.shot-item .club-select').first()).toBeVisible();
    await expect(page.locator('.lie-btn').filter({ hasText: 'FW' }).first()).toBeVisible();
  });

  test('carry distance appears immediately after first shot placed', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const box = await mapBox(page);

    // Place tee
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.8);
    await page.waitForTimeout(400);
    // Place pin
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.2);
    await page.waitForTimeout(400);

    // Before first shot is placed, there's no shot-desc yet
    await expect(page.locator('.shot-item .shot-desc')).toHaveCount(0);

    // Place first shot landing — carry is immediately calculable (from hole.tee to shots[0])
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
    await page.waitForTimeout(400);
    const firstDesc = page.locator('.shot-item .shot-desc').first();
    await expect(firstDesc).toContainText('yds');
  });
});

test.describe('Shot entry flow', () => {
  test('OB lie button marks shot red on map', async ({ page }) => {
    await loadAndSetupHole(page);

    await page.locator('.shot-item').last().locator('.lie-btn').filter({ hasText: 'OB' }).click();
    await page.waitForTimeout(200);

    await expect(page.locator('.map-dot.ob')).toHaveCount(1);
  });
});

test.describe('OB flow', () => {
  test('marking OB enters drop mode and shows drop guidance', async ({ page }) => {
    await loadAndSetupHole(page);

    await page.locator('.shot-item').last().locator('.lie-btn').filter({ hasText: 'OB' }).click();
    await page.waitForTimeout(200);

    await expect(page.locator('#guidance-label')).toBeVisible();
    await expect(page.locator('#guidance-label')).toContainText('drop');
  });

  test('tapping map after OB places a drop dot', async ({ page }) => {
    await loadAndSetupHole(page);
    const box = await mapBox(page);

    await page.locator('.shot-item').last().locator('.lie-btn').filter({ hasText: 'OB' }).click();
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
    await page.waitForTimeout(400);

    await expect(page.locator('.map-dot.drop')).toHaveCount(1);
    await expect(page.locator('.map-dot.ob')).toHaveCount(1);
    expect(await page.locator('.map-dot').count()).toBe(2); // OB shot + drop
  });

  test('drop row shows lie buttons but not OB or Penalty options', async ({ page }) => {
    await loadAndSetupHole(page);
    const box = await mapBox(page);

    await page.locator('.shot-item').last().locator('.lie-btn').filter({ hasText: 'OB' }).click();
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
    await page.waitForTimeout(400);

    const dropItem = page.locator('.shot-item').last();
    await expect(dropItem.locator('.lie-btn').filter({ hasText: 'FW' }).first()).toBeVisible();
    await expect(dropItem.locator('.lie-btn').filter({ hasText: 'OB' })).toHaveCount(0);
    await expect(dropItem.locator('.lie-btn').filter({ hasText: 'Penalty' })).toHaveCount(0);
  });

  test('drop row has no club selector', async ({ page }) => {
    await loadAndSetupHole(page);
    const box = await mapBox(page);

    await page.locator('.shot-item').last().locator('.lie-btn').filter({ hasText: 'OB' }).click();
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
    await page.waitForTimeout(400);

    const dropItem = page.locator('.shot-item').last();
    await expect(dropItem.locator('.club-select')).toHaveCount(0);
  });

  test('undo after drop removes drop dot and re-enters drop mode', async ({ page }) => {
    await loadAndSetupHole(page);
    const box = await mapBox(page);

    await page.locator('.shot-item').last().locator('.lie-btn').filter({ hasText: 'OB' }).click();
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
    await page.waitForTimeout(400);
    expect(await page.locator('.map-dot').count()).toBe(2);

    await page.click('#btn-undo');
    await page.waitForTimeout(300);

    expect(await page.locator('.map-dot').count()).toBe(1); // OB shot remains
    await expect(page.locator('.map-dot.drop')).toHaveCount(0);
    await expect(page.locator('#guidance-label')).toContainText('drop');
  });

  test('can continue placing shots after drop', async ({ page }) => {
    await loadAndSetupHole(page);
    const box = await mapBox(page);

    await page.locator('.shot-item').last().locator('.lie-btn').filter({ hasText: 'OB' }).click();
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
    await page.waitForTimeout(400);
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.43);
    await page.waitForTimeout(400);

    expect(await page.locator('.map-dot').count()).toBe(3); // OB + drop + next shot
    await expect(page.locator('.map-dot.ob')).toHaveCount(1);
    await expect(page.locator('.map-dot.drop')).toHaveCount(1);
    await expect(page.locator('.map-dot.approach')).toHaveCount(1);
  });
});

test.describe('Putting flow', () => {
  test('marking shot lie Green switches to putting phase', async ({ page }) => {
    await loadAndSetupHole(page);
    const box = await mapBox(page);

    await page.locator('.lie-btn').filter({ hasText: 'Green' }).first().click();
    await page.waitForTimeout(200);

    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.waitForTimeout(400);
    // P1 auto-placed at chip landing + P2 from map click = 2 putt dots
    await expect(page.locator('.map-dot.putt')).toHaveCount(2);
  });

  test('putt shows ft-to-pin in sidebar', async ({ page }) => {
    await loadAndSetupHole(page);
    const box = await mapBox(page);

    // Place a second shot then mark it green
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
    await page.waitForTimeout(400);
    await page.locator('.shot-item').last().locator('.lie-btn').filter({ hasText: 'Green' }).click();
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.waitForTimeout(400);

    // P1 auto-placed at chip landing + P2 from map click = 2 putt dots
    await expect(page.locator('.map-dot.putt')).toHaveCount(2);
    await expect(page.locator('.putt-dist').first()).toContainText('ft to pin');
  });

  test('marking putt holed shows ⛳ and updates button', async ({ page }) => {
    await loadAndSetupHole(page);

    // Mark the tee shot as on the green — auto-places putts[0] at shot position
    await page.locator('.lie-btn').filter({ hasText: 'Green' }).first().click();
    await page.waitForTimeout(200);

    // putts[0] is auto-placed; mark it holed without another map click
    await page.locator('.putt-holed-btn').first().click();
    await expect(page.locator('.putt-holed-btn').first()).toHaveClass(/holed/);
    await expect(page.locator('.putt-holed-btn').first()).toContainText('Holed');
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

    await expect(page.locator('.map-dot')).toHaveCount(0);
    await expect(page.locator('#guidance-label')).toBeVisible();
    await expect(page.locator('#guidance-label')).toContainText('tee');
  });
});
