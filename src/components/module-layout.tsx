import type { LucideIcon } from "lucide-react";
import { StatusPill } from "./status-pill";

export type ModuleMetric = { label: string; value: string; detail: string; icon: LucideIcon };
export type ModuleRow = { primary: string; secondary: string; owner: string; due: string; status: string; tone: "success" | "warning" | "danger" | "info" | "neutral" };

export function ModuleHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="module-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function MetricGrid({ metrics }: { metrics: ModuleMetric[] }) {
  return <section className="module-metrics" aria-label="Summary metrics">{metrics.map(({ label, value, detail, icon: Icon }) => <div key={label}><Icon size={18} /><span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span></div>)}</section>;
}

export function WorkstreamTable({ title, description, rows, column = "Item" }: { title: string; description: string; rows: ModuleRow[]; column?: string }) {
  return <section className="panel module-table"><header className="panel-heading"><div><h2>{title}</h2><p>{description}</p></div></header><div className="work-table-wrap"><table><thead><tr><th>{column}</th><th>Owner</th><th>Due / event</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.primary}><td><strong>{row.primary}</strong><small>{row.secondary}</small></td><td>{row.owner}</td><td>{row.due}</td><td><StatusPill tone={row.tone}>{row.status}</StatusPill></td></tr>)}</tbody></table></div></section>;
}
