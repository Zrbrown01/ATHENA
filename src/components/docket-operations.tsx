"use client";

import { BellRing, CalendarClock, CheckCircle2, LoaderCircle, RefreshCcw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";

type Series = { id: string; title: string; recurrenceRule: string; occurrenceCount: number; providerMode: string };
type EventRow = { id: string; title: string; eventKind: string; startsAt: string; endsAt: string; seriesId?: string | null; parentEventId?: string | null; externalProviderId?: string | null };
type Dependency = { id: string; parentEventId: string; childEventId: string; relationType: string; offsetDays: number; calculationBasis: string };
type Reminder = { id: string; status: string; remindAt: string; revision: number };
type Conflict = { id: string; status: string; explanation: string; resolutionReason?: string | null; revision: number };
type SyncState = { id: string; status: string; providerMode: string; grantedScopes: string[]; deltaCursor?: string | null; subscriptionId?: string | null; lastSuccessfulSyncAt?: string | null; revision: number };
type Projection = { series: Series[]; events: EventRow[]; dependencies: Dependency[]; reminders: Reminder[]; conflicts: Conflict[]; syncStates: SyncState[]; limitation?: string; error?: string };

const SERIES = "calendar-series-rivera-weekly";
const REMINDER = "calendar-reminder-msc-001";
const CONFLICT = "calendar-conflict-rivera-001";
const SYNC = "calendar-sync-maya-001";

export function DocketOperations() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function load() { setPending(true); try { const response = await fetch("/api/calendar/docket"); const result = await response.json() as Projection; if (!response.ok) throw new Error(result.error ?? "Docket could not be loaded"); setData(result); } catch (error) { setMessage(error instanceof Error ? error.message : "Load failed"); } finally { setPending(false); } }
  async function act(action: "materialize" | "acknowledge" | "resolve" | "block") {
    const reminder = data?.reminders.find((item) => item.id === REMINDER);
    const conflict = data?.conflicts.find((item) => item.id === CONFLICT);
    const sync = data?.syncStates.find((item) => item.id === SYNC);
    const shared = { tenantId: "tenant-golden", matterId: "matter-golden-001", idempotencyKey: `docket-${action}-${crypto.randomUUID()}` };
    const body = action === "materialize" ? {
      action: "materialize_fixture_docket", ...shared, seriesId: SERIES, hearingEventId: "calendar-event-msc-001", preparationEventId: "calendar-event-msc-prep-001",
      recurringEventIds: ["calendar-event-call-001", "calendar-event-call-002", "calendar-event-call-003"], conflictingEventId: "calendar-event-depo-conflict-001",
      dependencyId: "calendar-dependency-msc-prep-001", reminderId: REMINDER, conflictId: CONFLICT, syncStateId: SYNC, ownerId: "user-maya-chen",
      hearingStart: "2026-09-18T15:30:00.000Z", hearingEnd: "2026-09-18T17:00:00.000Z", preparationStart: "2026-09-16T23:00:00.000Z", preparationEnd: "2026-09-17T00:00:00.000Z",
      recurringStart: "2026-09-01T17:00:00.000Z", recurringEnd: "2026-09-01T17:30:00.000Z", conflictStart: "2026-09-01T17:15:00.000Z", conflictEnd: "2026-09-01T18:00:00.000Z",
      timezone: "America/Los_Angeles", sandboxAcknowledged: true,
    } : action === "acknowledge" ? { action: "acknowledge_reminder", ...shared, reminderId: REMINDER, expectedRevision: reminder?.revision, reason: "Attorney reviewed the in-app reminder and its synthetic proceeding source." }
      : action === "resolve" ? { action: "resolve_conflict", ...shared, conflictId: CONFLICT, expectedRevision: conflict?.revision, resolution: "reschedule_required", reason: "The overlapping deposition must be rescheduled before this docket is relied upon." }
      : { action: "record_sync_block", ...shared, syncStateId: SYNC, expectedRevision: sync?.revision, reason: "Microsoft OAuth, calendar scopes, subscriptions, delta recovery, revocation, and write reconciliation remain unavailable." };
    setPending(true);
    try { const response = await fetch("/api/calendar/docket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json() as Projection; if (!response.ok) throw new Error(result.error ?? "Docket operation failed"); setData(result); setMessage(({ materialize: "Synthetic recurrence, hearing, preparation chain, reminder, and overlap evidence persisted.", acknowledge: "In-app reminder acknowledged with human evidence.", resolve: "Conflict marked reschedule required; no event was silently moved.", block: "Microsoft calendar state reconfirmed as not connected; no provider write occurred." } as const)[action]); } catch (error) { setMessage(error instanceof Error ? error.message : "Operation failed"); } finally { setPending(false); }
  }
  if (!data) return <section className="panel operator-load"><CalendarClock size={22}/><div><h2>Native docket lifecycle</h2><p>Load local recurrence, deadline chains, reminders, overlap findings, and calendar-provider truth.</p><button className="secondary-action" onClick={() => void load()} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <CalendarClock size={15}/>}Load docket records</button>{message && <p className="inline-message" role="status">{message}</p>}</div></section>;
  const series = data.series.find((item) => item.id === SERIES), reminder = data.reminders.find((item) => item.id === REMINDER), conflict = data.conflicts.find((item) => item.id === CONFLICT), sync = data.syncStates.find((item) => item.id === SYNC);
  const next = !series ? "materialize" : reminder?.status === "scheduled" ? "acknowledge" : conflict?.status === "open" ? "resolve" : sync?.revision === 1 ? "block" : null;
  const labels = { materialize: "Materialize synthetic docket", acknowledge: "Acknowledge reminder", resolve: "Require rescheduling", block: "Record sync block" } as const;
  return <section className="panel operator-panel"><header><div><h2>Native docket lifecycle</h2><p>{data.limitation}</p></div><StatusPill tone={conflict?.status === "open" ? "danger" : series ? "success" : "neutral"}>{conflict?.status === "open" ? "Conflict open" : series ? "Local docket" : "Empty"}</StatusPill></header>
    {sync && <div className="truth-banner"><RefreshCcw size={17}/><div><strong>Microsoft calendar · {sync.status}</strong><p>Scopes {sync.grantedScopes.length} · cursor {sync.deltaCursor ?? "none"} · subscription {sync.subscriptionId ?? "none"} · last sync {sync.lastSuccessfulSyncAt ?? "never"}</p></div></div>}
    {series && <p><strong>{series.title}</strong> · {series.recurrenceRule} · {series.occurrenceCount} locally expanded occurrences · {series.providerMode}</p>}
    {data.events.length > 0 && <ol>{data.events.map((event) => <li key={event.id}><strong>{event.title}</strong><small>{event.eventKind} · {new Date(event.startsAt).toLocaleString()} · external ID {event.externalProviderId ?? "none"}</small></li>)}</ol>}
    {data.dependencies.map((dependency) => <p key={dependency.id}><strong>Preparation chain:</strong> {dependency.relationType} · offset {dependency.offsetDays} days<br/><small>{dependency.calculationBasis}</small></p>)}
    {reminder && <p><BellRing size={14}/> <strong>Reminder {reminder.status}</strong> · {new Date(reminder.remindAt).toLocaleString()}</p>}
    {conflict && <p><TriangleAlert size={14}/> <strong>Conflict {conflict.status}</strong> · {conflict.explanation}{conflict.resolutionReason ? ` · ${conflict.resolutionReason}` : ""}</p>}
    {next && <div className="operator-actions"><button className="primary-action" onClick={() => void act(next)} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <CheckCircle2 size={15}/>} {labels[next]}</button></div>}
    {message && <p className="inline-message" role="status">{message}</p>}
  </section>;
}
