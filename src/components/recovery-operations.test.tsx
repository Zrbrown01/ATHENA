import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecoveryOperations } from "./recovery-operations";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const restoredProjection = {
  snapshots: [],
  exercises: [
    {
      id: "recovery-local-proof-002",
      status: "restored",
      revision: 2,
      targetEnvironment: "disposable-local-sqlite-proof",
      productionMutation: false,
      durationSeconds: 1,
      rpoSeconds: 0,
      rtoSeconds: 1,
    },
  ],
  checks: [],
  approvals: [],
  limitation: "Local recovery evidence only.",
};

describe("RecoveryOperations", () => {
  it("submits the five governed checks from the current full-schema restore proof", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(restoredProjection))
      .mockResolvedValueOnce(Response.json(restoredProjection));
    vi.stubGlobal("fetch", fetchMock);

    render(<RecoveryOperations />);
    fireEvent.click(screen.getByRole("button", { name: "Load recovery evidence" }));
    const advance = await screen.findByRole("button", {
      name: "Advance recovery proof",
    });
    fireEvent.click(advance);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      action: string;
      checks: Array<{ code: string; expectedValue: string; actualValue: string }>;
    };
    expect(body.action).toBe("verify_restore");
    expect(body.checks).toHaveLength(5);
    expect(body.checks.map((check) => check.code)).toEqual([
      "table_count",
      "event_count",
      "outbox_count",
      "snapshot_checksum",
      "tenant_scope",
    ]);
    expect(body.checks[0]).toMatchObject({
      expectedValue: "174",
      actualValue: "174",
    });
  });
});
