"use client";

import {
  BriefcaseBusiness,
  Archive,
  BadgeDollarSign,
  BadgeCheck,
  CalendarDays,
  DatabaseZap,
  FileText,
  FlaskConical,
  Gauge,
  HardDriveDownload,
  Landmark,
  Mail,
  Menu,
  Mic2,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  Users,
  UserCog,
  Video,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
  ["Noted", Video, "/depositions"],
  ["Verbatim", Mic2, "/verbatim"],
] as const;

export function AppShell({
  children,
  active = "My Work",
}: {
  children: React.ReactNode;
  active?: string;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationTrigger = useRef<HTMLButtonElement>(null);

  const closeNavigation = (restoreFocus = false) => {
    setNavigationOpen(false);
    if (restoreFocus) requestAnimationFrame(() => navigationTrigger.current?.focus());
  };

  useEffect(() => {
    if (!navigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNavigation(true);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [navigationOpen]);

  return (
    <div className="app-shell">
      <aside className={navigationOpen ? "sidebar mobile-open" : "sidebar"} aria-label="Primary navigation" id="primary-navigation">
        <div className="mobile-navigation-heading">
          <span>Navigation</span>
          <button type="button" aria-label="Close navigation" onClick={() => closeNavigation(true)}>
            <X aria-hidden="true" size={19} />
          </button>
        </div>
        <Link href="/" className="brand" aria-label="Athena home" onClick={() => closeNavigation()}>
          <Image
            className="brand-emblem"
            src="/brand/athena-app-icon.png"
            width={512}
            height={512}
            sizes="42px"
            alt=""
            priority
          />
          <span className="brand-copy">
            <Image
              className="brand-wordmark"
              src="/brand/athena-wordmark.png"
              width={1000}
              height={250}
              sizes="116px"
              alt=""
              priority
            />
            <small>Defense case management</small>
          </span>
        </Link>

        <nav className="nav-list">
          {navigation.map(([label, Icon, href]) => (
            <Link
              className={label === active ? "nav-item active" : "nav-item"}
              href={href}
              key={label}
              aria-current={label === active ? "page" : undefined}
              onClick={() => closeNavigation()}
            >
              <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="trust-state">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>
              <strong>Synthetic workspace</strong>
              <small>No production data</small>
            </span>
          </div>
          <Link className="nav-item" href="/admin/integrations" onClick={() => closeNavigation()}>
            <Settings aria-hidden="true" size={17} /> Administration
          </Link>
          <Link className="nav-item" href="/admin/platform" onClick={() => closeNavigation()}>
            <ShieldCheck aria-hidden="true" size={17} /> Platform ops
          </Link>
          <Link className="nav-item" href="/admin/security" onClick={() => closeNavigation()}>
            <ShieldAlert aria-hidden="true" size={17} /> Security operations
          </Link>
          <Link className="nav-item" href="/admin/recovery" onClick={() => closeNavigation()}>
            <HardDriveDownload aria-hidden="true" size={17} /> Recovery evidence
          </Link>
          <Link className="nav-item" href="/admin/directory" onClick={() => closeNavigation()}>
            <UserCog aria-hidden="true" size={17} /> Identity & roles
          </Link>
          <Link className="nav-item" href="/admin/compliance" onClick={() => closeNavigation()}>
            <BadgeCheck aria-hidden="true" size={17} /> Provider compliance
          </Link>
          <Link className="nav-item" href="/admin/classification" onClick={() => closeNavigation()}>
            <Tags aria-hidden="true" size={17} /> Data classification
          </Link>
          <Link className="nav-item" href="/admin/exports" onClick={() => closeNavigation()}>
            <Archive aria-hidden="true" size={17} /> Tenant exports
          </Link>
          <Link className="nav-item" href="/admin/costs" onClick={() => closeNavigation()}>
            <BadgeDollarSign aria-hidden="true" size={17} /> Cost governance
          </Link>
          <Link className="nav-item" href="/admin/disposition" onClick={() => closeNavigation()}>
            <Trash2 aria-hidden="true" size={17} /> Disposition control
          </Link>
          <Link className="nav-item" href="/admin/migration" onClick={() => closeNavigation()}>
            <DatabaseZap aria-hidden="true" size={17} /> Migration center
          </Link>
          <Link className="nav-item" href="/operations/california" onClick={() => closeNavigation()}>
            <Landmark aria-hidden="true" size={17} /> California ops
          </Link>
          <Link className="nav-item" href="/pilot/release-one" onClick={() => closeNavigation()}>
            <FlaskConical aria-hidden="true" size={17} /> Release 1 pilot
          </Link>
        </div>
      </aside>
      {navigationOpen ? <button className="mobile-navigation-backdrop" type="button" aria-label="Close navigation" onClick={() => closeNavigation(true)} /> : null}

      <div className="workspace">
        <header className="topbar">
          <button ref={navigationTrigger} className="mobile-nav-trigger" type="button" aria-label="Open navigation" aria-expanded={navigationOpen} aria-controls="primary-navigation" onClick={() => setNavigationOpen(true)}>
            <Menu aria-hidden="true" size={20} />
          </button>
          <CommandPalette />
          <div className="topbar-actions">
            <button
              className="ask-button"
              type="button"
              disabled
              title="AI provider is not connected"
              data-policy-plane="ai"
              aria-describedby="athena-ai-policy-state"
            >
              <Sparkles size={16} aria-hidden="true" /> Ask Athena
            </button>
            <span id="athena-ai-policy-state" className="sr-only">
              AI retrieval is disabled and classified resources require an AI
              plane policy decision before use.
            </span>
            <div className="user-button" aria-label="Signed in pilot identity">
              <span className="avatar">MC</span>
              <span>
                <strong>Maya Chen</strong>
                <small>Attorney · Pilot</small>
              </span>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
