import { describe, expect, it } from "vitest";
import { decideCommunication, type AssociationCandidateState, type CommunicationMessageState, type CommunicationThreadState } from "./lifecycle";

const context = { tenantId: "t", userId: "u", roles: ["attorney"], matterAccess: new Set(["m"]) };
const candidate: AssociationCandidateState = { id: "candidate-1", threadId: "thread-1", messageId: "message-1", suggestedMatterId: "m", status: "pending", revision: 1 };
const thread: CommunicationThreadState = { id: "thread-1", matterId: "m", associationStatus: "filed", revision: 2 };
const message: CommunicationMessageState = { id: "message-out-1", threadId: "thread-1", matterId: "m", direction: "outbound", status: "approved", revision: 2 };

describe("communication lifecycle", () => {
  it("files a suggested thread with human authorization and no provider operation", () => {
    const result = decideCommunication({ context, candidate, raw: { action: "resolve_association", tenantId: "t", matterId: "m", candidateId: "candidate-1", expectedRevision: 1, decision: "file_to_matter", reason: "Attorney verified the claim and ADJ signals.", idempotencyKey: "communication-file" } });
    expect(result.toStatus).toBe("filed");
    expect(result.event.payload).toMatchObject({ humanAuthorized: true, microsoftConnected: false, providerDeliveryAttempted: false });
  });
  it("supports an explicit reversible undo", () => {
    const result = decideCommunication({ context, candidate: { ...candidate, status: "filed", revision: 2 }, raw: { action: "undo_association", tenantId: "t", matterId: "m", candidateId: "candidate-1", expectedRevision: 2, reason: "Reviewer found conflicting matter evidence.", idempotencyKey: "communication-undo" } });
    expect(result.toStatus).toBe("undone");
  });
  it("requires a filed matter thread before drafting", () => {
    expect(() => decideCommunication({ context, thread: { ...thread, associationStatus: "suggested" }, raw: { action: "create_outbound_draft", tenantId: "t", matterId: "m", threadId: "thread-1", messageId: "message-out-1", toAddresses: ["examiner@example.test"], ccAddresses: [], subject: "Rivera matter update", bodyText: "This is the synthetic matter status update for review.", idempotencyKey: "communication-draft" } })).toThrow("filed");
  });
  it("records a blocked Microsoft handoff rather than sent", () => {
    const result = decideCommunication({ context, thread, message, raw: { action: "record_delivery_block", tenantId: "t", matterId: "m", threadId: "thread-1", messageId: "message-out-1", expectedRevision: 2, reason: "Microsoft app registration and tenant consent are unavailable.", idempotencyKey: "communication-block" } });
    expect(result.toStatus).toBe("blocked_not_connected");
    expect(result.event.payload).toMatchObject({ microsoftConnected: false, providerDeliveryAttempted: false });
  });
  it("enforces optimistic revisions and tenant isolation", () => {
    expect(() => decideCommunication({ context, candidate, raw: { action: "resolve_association", tenantId: "t", matterId: "m", candidateId: "candidate-1", expectedRevision: 2, decision: "file_to_matter", reason: "Attorney verified the source signals.", idempotencyKey: "communication-stale" } })).toThrow("changed");
    expect(() => decideCommunication({ context, candidate, raw: { action: "resolve_association", tenantId: "other", matterId: "m", candidateId: "candidate-1", expectedRevision: 1, decision: "file_to_matter", reason: "Attorney verified the source signals.", idempotencyKey: "communication-tenant" } })).toThrow("Access denied");
  });
});
