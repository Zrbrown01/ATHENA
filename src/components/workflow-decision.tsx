"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useState } from "react";

export function WorkflowDecision({ workflowType, aggregateId, matterId, action, label, successLabel, tone = "primary" }: {
  workflowType: "intake" | "authority" | "time" | "report" | "filing";
  aggregateId: string; matterId?: string; action: string; label: string; successLabel: string;
  tone?: "primary" | "secondary";
}) {
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");

  async function decide() {
    setState("pending");
    try {
      const response = await fetch("/api/workflows/decide", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: "tenant-golden", workflowType, aggregateId, matterId, action, idempotencyKey: `${workflowType}-${aggregateId}-${action}-${crypto.randomUUID()}` }),
      });
      if (!response.ok) throw new Error();
      setState("success");
    } catch { setState("error"); }
  }

  return <div className="decision-control">
    <button type="button" className={tone === "primary" ? "primary-action" : "secondary-action"} onClick={decide} disabled={state === "pending" || state === "success"}>
      {state === "pending" ? <><LoaderCircle className="spin" size={15} />Recording…</> : state === "success" ? <><Check size={15} />{successLabel}</> : label}
    </button>
    {state === "error" && <small role="alert">Decision could not be recorded.</small>}
  </div>;
}
