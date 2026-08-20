export function StatusPill({ tone, children }: { tone: "success" | "warning" | "danger" | "neutral" | "info"; children: React.ReactNode }) {
  return <span className={`status-pill ${tone}`}><span aria-hidden="true" />{children}</span>;
}
