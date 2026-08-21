import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
});

test("shell search is keyboard operable and restores focus", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good afternoon, Maya", level: 1 })).toBeVisible();

  const trigger = page.getByRole("button", { name: /search matters/i });
  const dialog = page.getByRole("dialog", { name: "Search Athena" });
  await expect.poll(async () => {
    await trigger.click();
    return dialog.count();
  }).toBe(1);
  await expect(page.getByLabel("Search query")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Meta+k");
  await expect(dialog).toBeVisible();
  await page.getByLabel("Search query").fill("R");
  await expect(page.getByRole("status")).toContainText("Type at least two characters");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("critical shell and cost-governance surfaces match approved visuals", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveScreenshot("athena-home.png", { animations: "disabled", fullPage: true, maxDiffPixelRatio: 0.002 });

  await page.goto("/admin/costs");
  await expect(page.getByRole("heading", { name: "Usage and cost governance", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load cost evidence" })).toBeEnabled();
  await expect(page).toHaveScreenshot("athena-cost-governance.png", { animations: "disabled", fullPage: true, maxDiffPixelRatio: 0.002 });
});
