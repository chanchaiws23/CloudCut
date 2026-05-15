import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /CloudCut/i })).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test('demo login works', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/Email/i).fill('alice@cloudcut.dev');
    await page.getByLabel(/Password/i).fill('password123');
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByText(/Product Demo Video/i)).toBeVisible({ timeout: 10000 });
  });
});
