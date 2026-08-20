import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  FileText,
  Gauge,
  Landmark,
  Mail,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

const navigation = [
  ["My Work", Gauge],
  ["Matters", BriefcaseBusiness],
  ["Calendar", CalendarDays],
  ["Documents", FileText],
  ["Communications", Mail],
  ["Billing", WalletCards],
  ["Reports", Landmark],
  ["Clients", Users],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <Link href="/" className="brand" aria-label="Athena home">
          <span className="brand-mark">A</span>
          <span>
            <strong>ATHENA</strong>
            <small>Defense OS</small>
          </span>
        </Link>

        <nav className="nav-list">
          {navigation.map(([label, Icon], index) => (
            <Link className={index === 0 ? "nav-item active" : "nav-item"} href="/" key={label}>
              <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="trust-state">
            <ShieldCheck size={17} aria-hidden="true" />
            <span><strong>Synthetic workspace</strong><small>No production data</small></span>
          </div>
          <Link className="nav-item" href="/admin/integrations">
            <Settings aria-hidden="true" size={17} /> Administration
          </Link>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="command-search" role="search">
            <Search size={17} aria-hidden="true" />
            <span>Search matters, documents, people, or commands</span>
            <kbd>⌘ K</kbd>
          </div>
          <div className="topbar-actions">
            <button className="ask-button" type="button" disabled title="AI provider is not connected">
              <Sparkles size={16} aria-hidden="true" /> Ask Athena
            </button>
            <button className="user-button" type="button">
              <span className="avatar">MC</span>
              <span><strong>Maya Chen</strong><small>Attorney · Pilot</small></span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
