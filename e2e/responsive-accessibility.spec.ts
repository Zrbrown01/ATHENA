import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

type AxeResult = {
  violations: Array<{
    id: string;
    impact: string | null;
    nodes: Array<{ target: string[]; failureSummary?: string }>;
  }>;
};

async function renderedAccessibility(page: Page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            root: Document,
            options: { runOnly: { type: "tag"; values: string[] } },
          ) => Promise<AxeResult>;
        };
      }
    ).axe;
    return axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    });
  });
}

test("phone shell uses an operable navigation drawer without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const trigger = page.getByRole("button", { name: "Open navigation" });
  const navigation = page.getByRole("complementary", {
    name: "Primary navigation",
  });
  await expect(navigation).toBeHidden();
  await expect
    .poll(async () => {
      await trigger.click();
      return page.locator("#primary-navigation").getAttribute("class");
    })
    .toContain("mobile-open");
  await expect(navigation).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.waitForTimeout(50);

  const geometry = await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>(".work-table-wrap");
    return {
      viewport: window.innerWidth,
      root: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      tableClient: wrapper?.clientWidth ?? 0,
      tableScroll: wrapper?.scrollWidth ?? 0,
    };
  });
  expect(geometry.root).toBe(geometry.viewport);
  expect(geometry.body).toBe(geometry.viewport);
  expect(geometry.tableScroll).toBeGreaterThan(geometry.tableClient);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Good afternoon, Maya", level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("athena-home-phone.png", {
    animations: "allow",
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
});

test("tablet shell contains wide data surfaces", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/");
  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(geometry.root).toBe(geometry.viewport);
  expect(geometry.body).toBe(geometry.viewport);
});

for (const path of [
  "/",
  "/admin/costs",
  "/admin/directory",
  "/admin/exports",
  "/admin/platform",
  "/calendar",
  "/clients",
]) {
  test(`rendered WCAG A/AA checks pass on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await renderedAccessibility(page);
    expect(
      results.violations,
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
  });
}
