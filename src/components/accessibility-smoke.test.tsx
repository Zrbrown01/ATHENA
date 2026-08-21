import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { accessibilityViolations } from "@/test/accessibility";
import { AppShell } from "./app-shell";
import { ClientPortalOperations } from "./client-portal-operations";
import { ScaleOperations } from "./scale-operations";
import { TenantExportOperations } from "./tenant-export-operations";

afterEach(cleanup);

const operatorSurfaces = [
  ["client portal controls", <ClientPortalOperations key="portal" />],
  ["scale evidence", <ScaleOperations key="scale" />],
  ["tenant exports", <TenantExportOperations key="exports" />],
] as const;

describe("automated accessibility smoke coverage", () => {
  it("has no DOM-computable axe violations in the global application shell", async () => {
    const { container } = render(
      <AppShell>
        <h1>Accessibility fixture</h1>
      </AppShell>,
    );

    expect(await accessibilityViolations(container)).toEqual([]);
  });

  it.each(operatorSurfaces)(
    "has no DOM-computable axe violations in the initial %s surface",
    async (_name, surface) => {
      const { container } = render(surface);
      expect(await accessibilityViolations(container)).toEqual([]);
    },
  );
});

