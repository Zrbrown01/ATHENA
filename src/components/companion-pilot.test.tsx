import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompanionPilot } from "./companion-pilot";

describe("CompanionPilot", () => {
  it("exposes the workflow and first action to keyboard and assistive technology", () => {
    render(<CompanionPilot/>);
    expect(screen.getByRole("region", { name: "Release 1 workflow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load pilot state" })).toBeEnabled();
    expect(screen.getByText("Microsoft 365 disconnected")).toBeInTheDocument();
    expect(screen.getByText("Deterministic synthetic pilot")).toBeInTheDocument();
  });
});
