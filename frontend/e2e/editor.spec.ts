import { test, expect } from '@playwright/test';

test.describe('Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/Email/i).fill('alice@cloudcut.dev');
    await page.getByLabel(/Password/i).fill('password123');
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByTestId('project-title')).toContainText(/Product Demo Video/i, { timeout: 10000 });
  });

  test('timeline renders with tracks', async ({ page }) => {
    await expect(page.locator('[data-testid="timeline"]')).toBeVisible();
    await expect(page.locator('[data-testid="timeline-track"]')).toHaveCount(3);
  });

  test('tool buttons toggle active state', async ({ page }) => {
    const selectBtn = page.getByTitle(/Select/i).first();
    const bladeBtn = page.getByTitle(/Blade/i).first();
    await expect(selectBtn).toHaveClass(/bg-primary/);
    await bladeBtn.click();
    await expect(bladeBtn).toHaveClass(/bg-primary/);
  });

  test('theme toggle switches between dark and light', async ({ page }) => {
    const toggle = page.getByTitle(/Toggle theme/i);
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('html')).toHaveClass(/light/);
    await toggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
