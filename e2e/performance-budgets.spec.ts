import { expect, test } from "@playwright/test";

const budgets = {
  domContentLoadedMs: 2_500,
  firstContentfulPaintMs: 2_000,
  javascriptBytes: 2_500_000,
  stylesheetBytes: 300_000,
  imageBytes: 1_500_000,
} as const;

for (const route of ["/", "/admin/costs"] as const) {
  test(`critical route ${route} stays within local browser budgets`, async ({
    page,
  }, testInfo) => {
    await page.goto(route, { waitUntil: "networkidle" });

    const measurements = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming,
        resources = performance.getEntriesByType(
          "resource",
        ) as PerformanceResourceTiming[],
        bytesFor = (initiatorType: string) =>
          resources
            .filter((entry) => entry.initiatorType === initiatorType)
            .reduce(
              (total, entry) =>
                total + (entry.encodedBodySize || entry.transferSize),
              0,
            ),
        firstContentfulPaint = performance.getEntriesByName(
          "first-contentful-paint",
        )[0];

      return {
        domContentLoadedMs: Math.ceil(
          navigation.domContentLoadedEventEnd - navigation.startTime,
        ),
        firstContentfulPaintMs: Math.ceil(
          firstContentfulPaint?.startTime ?? Number.POSITIVE_INFINITY,
        ),
        javascriptBytes: bytesFor("script"),
        stylesheetBytes: bytesFor("css") + bytesFor("link"),
        imageBytes: bytesFor("img"),
        resourceCount: resources.length,
      };
    });

    await testInfo.attach(`performance-${route === "/" ? "home" : "costs"}`, {
      body: JSON.stringify({ route, budgets, measurements }, null, 2),
      contentType: "application/json",
    });

    expect(measurements.domContentLoadedMs).toBeLessThanOrEqual(
      budgets.domContentLoadedMs,
    );
    expect(measurements.firstContentfulPaintMs).toBeLessThanOrEqual(
      budgets.firstContentfulPaintMs,
    );
    expect(measurements.javascriptBytes).toBeLessThanOrEqual(
      budgets.javascriptBytes,
    );
    expect(measurements.stylesheetBytes).toBeLessThanOrEqual(
      budgets.stylesheetBytes,
    );
    expect(measurements.imageBytes).toBeLessThanOrEqual(budgets.imageBytes);
  });
}
