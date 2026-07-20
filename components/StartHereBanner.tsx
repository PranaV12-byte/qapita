"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY = "q4np-start-here-dismissed";

/**
 * Dismissible home banner pointing newcomers to Start Here.
 * Dismissal persists in localStorage. Renders nothing until hydrated so the
 * server/client markup matches.
 */
export default function StartHereBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISS_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div className="w-full mb-6 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3 text-sm">
      <span className="text-[var(--text-body)]">
        New to equity compensation?{" "}
        <Link
          href="/start-here"
          className="text-[var(--accent)] hover:underline"
        >
          Start with the basics.
        </Link>
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="ml-auto inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-body)]"
        style={{ minWidth: "32px", minHeight: "32px" }}
      >
        ✕
      </button>
    </div>
  );
}
