import axe, { type Result } from "axe-core";

export async function accessibilityViolations(
  container: Element,
): Promise<Result[]> {
  const report = await axe.run(container, {
    rules: {
      // jsdom cannot calculate rendered foreground/background contrast. Contrast
      // remains a browser/manual release check; every DOM-computable WCAG rule runs.
      "color-contrast": { enabled: false },
    },
  });

  return report.violations;
}

