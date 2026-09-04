"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import SearchOverlay from "@/components/search/SearchOverlay";
import { BrandCluster } from "@/components/brand/Logos";
import { useAuth } from "@/components/auth/AuthProvider";

type NavItem = { label: string; href: string; icon: string; disabled?: boolean };

const links: NavItem[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Ask a question", href: "/generate", icon: "ask" },
  { label: "Knowledge Tree", href: "/browse", icon: "tree" },
  { label: "Wiki", href: "/wiki", icon: "book" },
  { label: "Brain", href: "/brain", icon: "brain" },
  { label: "Archive", href: "#archive", icon: "archive", disabled: true },
  { label: "Learn", href: "#learn", icon: "learn", disabled: true },
];

function active(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/browse") return pathname === "/browse" || pathname.startsWith("/p/") || pathname.startsWith("/glossary");
  if (href === "/wiki") return pathname === "/wiki" || pathname.startsWith("/a/");
  return pathname.startsWith(href);
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<string, ReactNode> = {
    home: <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
    ask: <path d="m13 2-2 7h5l-5 13 2-9H8l5-11Z" />,
    tree: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z" /><path d="M4 5.5v16M8 7h8M8 11h8" /></>,
    brain: <><path d="M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v2a3 3 0 0 0 3 3h1" /><path d="M15 3a3 3 0 0 1 3 3v1a3 3 0 0 1 0 6v2a3 3 0 0 1-3 3h-1" /><path d="M9 9h6M12 6v12" /></>,
    archive: <><path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6" /></>,
    learn: <><path d="m4 6 8-3 8 3-8 3-8-3Z" /><path d="M6 8v5c2 2 10 2 12 0V8M20 7v7" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <path d="m18 6-12 12M6 6l12 12" />,
    more: <path d="M6 12h.01M12 12h.01M18 12h.01" />,
    sso: <><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, configured, loading } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [returnTo, setReturnTo] = useState(pathname);
  const [signInOpen, setSignInOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const signInRef = useRef<HTMLButtonElement>(null);
  const accountName = user?.name || user?.email || "Account";
  const initials = accountName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    if (window.localStorage.getItem("equityiq.sidebar.expanded") === "false") setExpanded(false);
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    setReturnTo(`${window.location.pathname}${window.location.search}`);
  }, [pathname]);
  useEffect(() => window.localStorage.setItem("equityiq.sidebar.expanded", String(expanded)), [expanded]);
  useEffect(() => { setMoreOpen(false); setAccountOpen(false); }, [pathname]);
  useEffect(() => {
    const open = () => setSignInOpen(true);
    window.addEventListener("equityiq:open-sign-in", open);
    return () => window.removeEventListener("equityiq:open-sign-in", open);
  }, []);

  const railWidth = expanded ? 180 : 60;
  const openSignIn = () => { setMoreOpen(false); setSignInOpen(true); };
  const closeSignIn = () => { setSignInOpen(false); window.dispatchEvent(new Event("equityiq:sign-in-cancelled")); };
  const searchLabel = pathname === "/" || pathname.startsWith("/generate")
    ? "Search topics or ask a question"
    : pathname === "/browse" || pathname.startsWith("/p/") || pathname.startsWith("/glossary")
      ? "Search knowledge base"
      : "Search";

  return <>
    <aside className={`v9-rail ${expanded ? "is-expanded" : "is-collapsed"}`} style={{ width: railWidth }}>
      <div className="v9-rail-brand">
        {expanded && <span>EquityIQ</span>}
        <button type="button" onClick={() => setExpanded((value) => !value)} className="v9-rail-toggle" aria-label={expanded ? "Collapse navigation" : "Expand navigation"} aria-expanded={expanded} title={expanded ? "Collapse navigation" : "Expand navigation"}>
          <span style={{ transform: expanded ? "rotate(180deg)" : "none" }}><Icon name="chevron" size={17} /></span>
        </button>
      </div>
      <nav className="v9-rail-links" aria-label="Primary navigation">
        {links.map((link) => {
          const isCurrent = active(pathname, link.href);
          const body = <><Icon name={link.icon} /><span className="v9-rail-label">{link.label}</span>{link.disabled && expanded && <span className="v9-soon">Coming soon</span>}</>;
          if (link.disabled) return <button key={link.label} type="button" disabled className="v9-rail-link is-disabled" title="Coming soon">{body}</button>;
          return <Link key={link.href} href={link.href} className={`v9-rail-link ${isCurrent ? "is-active" : ""}`} title={expanded ? undefined : link.label}>{body}</Link>;
        })}
      </nav>
      <div className="v9-rail-account">
        {user && accountOpen && <div className="v9-account-menu"><strong>{accountName}</strong>{user.email && <span>{user.email}</span>}{user.provider && <span className="v9-account-provider">Signed in with {user.provider}</span>}<a href="/auth/logout">Sign out</a></div>}
        <button ref={signInRef} type="button" disabled={loading} className="v9-rail-link v9-sign-in" onClick={() => user ? setAccountOpen((value) => !value) : openSignIn()} title={expanded ? undefined : user ? accountName : "Sign in"}>
          <span className="v9-account-avatar">{user ? initials : "→"}</span><span className="v9-rail-label">{user ? accountName : loading ? "Checking access" : "Sign in"}</span>
        </button>
      </div>
    </aside>

    <div className="v9-app" style={{ "--rail-width": `${railWidth}px` } as CSSProperties}>
      <header className="v9-topbar">
        <BrandCluster variant="light" className="v9-brand-cluster" qapitaClassName="v9-qapita" nasppClassName="v9-naspp" separatorClassName="v9-brand-divider" />
        <button type="button" className="v9-search-trigger" onClick={() => setSearchOpen(true)} aria-label={searchLabel}><Icon name="search" /><span>{searchLabel}</span><kbd>Ctrl K</kbd></button>
      </header>
      <main className="v9-main">{children}</main>
      <footer className="v9-footer"><span>Endorsed by NASPP</span><BrandCluster variant="light" className="v9-footer-brand" qapitaClassName="v9-footer-qapita" nasppClassName="v9-footer-naspp" separatorClassName="v9-footer-divider" /></footer>
    </div>

    <nav className="v9-bottom-nav" aria-label="Mobile navigation">
      {links.filter((item) => ["Home", "Ask a question", "Knowledge Tree", "Brain"].includes(item.label)).map((link) => <Link key={link.href} href={link.href} className={active(pathname, link.href) ? "is-active" : ""}><Icon name={link.icon} /><span>{link.label === "Ask a question" ? "Ask" : link.label === "Knowledge Tree" ? "Tree" : link.label}</span></Link>)}
      <button type="button" onClick={() => setMoreOpen(true)} className={moreOpen ? "is-active" : ""}><Icon name="more" /><span>More</span></button>
    </nav>

    {moreOpen && <div className="v9-more-layer"><button type="button" className="v9-more-backdrop" aria-label="Close menu" onClick={() => setMoreOpen(false)} /><div className="v9-more-sheet"><div className="v9-sheet-handle" />{links.filter((link) => ["Wiki", "Archive", "Learn"].includes(link.label)).map((link) => link.disabled ? <button key={link.label} disabled className="v9-more-item is-disabled"><Icon name={link.icon} />{link.label}<span>Coming soon</span></button> : <Link key={link.href} href={link.href} className="v9-more-item"><Icon name={link.icon} />{link.label}</Link>)}<button type="button" onClick={() => user ? window.location.assign("/auth/logout") : openSignIn()} className="v9-more-item"><span className="v9-account-avatar">{user ? initials : "→"}</span>{user ? "Sign out" : "Sign in"}</button></div></div>}
    <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    <SignInModal open={signInOpen} onClose={closeSignIn} configured={configured} returnTo={returnTo} restoreFocusRef={signInRef} />
  </>;
}

function GoogleIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.27c0-.71-.06-1.39-.18-2.04H12v3.86h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.21Z"/><path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.5Z"/><path fill="#FBBC05" d="M6.54 13.58a5.86 5.86 0 0 1 0-3.16V7.89H3.3a9.76 9.76 0 0 0 0 8.22l3.24-2.53Z"/><path fill="#EA4335" d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.46 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 8.11 9.46 6.39 12 6.39Z"/></svg>; }
function LinkedInIcon() { return <span className="v9-linkedin-icon">in</span>; }

function SignInModal({ open, onClose, configured, returnTo, restoreFocusRef }: { open: boolean; onClose: () => void; configured: boolean; returnTo: string; restoreFocusRef: RefObject<HTMLButtonElement | null> }) {
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const restore = restoreFocusRef.current;
    const focusable = () => Array.from(modalRef.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])") ?? []);
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1]?.focus(); }
      if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0]?.focus(); }
    };
    window.addEventListener("keydown", keydown);
    return () => { window.removeEventListener("keydown", keydown); restore?.focus(); };
  }, [open, onClose, restoreFocusRef]);
  if (!open) return null;
  const options = [
    { label: "Continue with LinkedIn", connection: "linkedin", icon: <LinkedInIcon /> },
    { label: "Continue with Google", connection: "google-oauth2", icon: <GoogleIcon /> },
    { label: "Continue with company SSO", connection: process.env.NEXT_PUBLIC_AUTH0_SSO_CONNECTION || "equityiq-demo-okta", icon: <Icon name="sso" size={20} /> },
  ];
  return <div className="v9-auth-layer" role="dialog" aria-modal="true" aria-labelledby="v9-sign-in-title"><button type="button" className="v9-auth-backdrop" onClick={onClose} aria-label="Close sign in" /><div className="v9-auth-modal" ref={modalRef}><button type="button" className="v9-auth-close" onClick={onClose} aria-label="Close sign in"><Icon name="close" /></button><BrandCluster variant="light" className="v9-auth-brand" qapitaClassName="v9-auth-qapita" nasppClassName="v9-auth-naspp" separatorClassName="v9-auth-divider" /><h2 id="v9-sign-in-title">Sign in to save and export</h2><p>Your current page will open after authentication.</p><div className="v9-auth-options">{options.map((option) => <a key={option.label} href={configured ? `/auth/login?connection=${encodeURIComponent(option.connection)}&prompt=login&returnTo=${encodeURIComponent(returnTo)}` : undefined} aria-disabled={!configured} className={!configured ? "is-disabled" : undefined}><span>{option.icon}</span>{option.label}</a>)}</div>{!configured && <small>Authentication is not configured in this environment.</small>}</div></div>;
}
