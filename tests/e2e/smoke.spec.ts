import { expect, test } from '@playwright/test';

test('quick start, research, hero purchase and dev gold', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('survivalchaos.settings.v1', JSON.stringify({ quality: 'low', pixelRatio: 1 })));
  await page.goto('/');
  await page.click('text=Quick Start');
  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('.cmdcard')).toBeVisible();
  // research at the forge with the hotkey
  await page.keyboard.press('F3');
  await expect(page.locator('.infopanel .name')).toContainText('War Forge');
  const goldBefore = Number((await page.locator('.topbar .res').first().textContent())!.replace(/\D/g, ''));
  await page.keyboard.press('q');
  await expect.poll(async () => Number((await page.locator('.topbar .res').first().textContent())!.replace(/\D/g, ''))).toBeLessThan(goldBefore);
  // dev menu: add gold, then buy a hero into the middle lane
  await page.keyboard.press('`');
  await page.locator('.dev >> text=+1k').click();
  await page.keyboard.press('F2'); await page.keyboard.press('q');
  await expect(page.locator('.lane-hint')).toBeVisible();
  await page.keyboard.press('w');
  await expect(page.locator('.messages')).toContainText('entered the battle');
  expect(errors).toEqual([]);
});
