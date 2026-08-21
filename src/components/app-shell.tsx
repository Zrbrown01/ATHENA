import {
  BriefcaseBusiness,
  CalendarDays,
  DatabaseZap,
  FileText,
  FlaskConical,
  Gauge,
  Landmark,
  Mail,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { CommandPalette } from "./command-palette";

const navigation = [
  ["My Work", Gauge, "/"],
  ["Matters", BriefcaseBusiness, "/matters"],
  ["Calendar", CalendarDays, "/calendar"],
  ["Documents", FileText, "/documents"],
  ["Communications", Mail, "/communications"],
  ["Billing", WalletCards, "/billing"],
  ["Reports", Landmark, "/reports"],
  ["Clients", Users, "/clients"],
] as const;

export function AppShell({ children, active = "My Work" }: { children: React.ReactNode; active?: string }) {
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
          {navigation.map(([label, Icon, href]) => (
            <Link className={label === active ? "nav-item active" : "nav-item"} href={href} key={label} aria-current={label === active ? "page" : undefined}>
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
          <Link className="nav-item" href="/admin/platform">
            <ShieldCheck aria-hidden="true" size={17} /> Platform ops
          </Link>
          <Link className="nav-item" href="/admin/migration">
            <DatabaseZap aria-hidden="true" size={17} /> Migration center
          </Link>
          <Link className="nav-item" href="/operations/california">
            <Landmark aria-hidden="true" size={17} /> California ops
          </Link>
          <Link className="nav-item" href="/pilot/release-one">
            <FlaskConical aria-hidden="true" size={17} /> Release 1 pilot
          </Link>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <CommandPalette />
          <div className="topbar-actions">
            <button className="ask-button" type="button" disabled title="AI provider is not connected">
              <Sparkles size={16} aria-hidden="true" /> Ask Athena
            </button>
            <div className="user-button" aria-label="Signed in pilot identity">
              <span className="avatar">MC</span>
              <span><strong>Maya Chen</strong><small>Attorney · Pilot</small></span>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
