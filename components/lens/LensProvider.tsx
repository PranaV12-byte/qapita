"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export type Lens = "pro" | "plain";

const STORAGE_KEY = "q4np-lens";

type LensContextValue = {
  lens: Lens;
  setLens: (lens: Lens) => void;
  toggle: () => void;
  /** When true the lens is locked (e.g. Start Here forces Plain) and cannot be changed. */
  locked: boolean;
};

const LensContext = createContext<LensContextValue | null>(null);

/**
 * Provides the Pro/Plain reading lens across the app.
 * - Persists the user's choice in localStorage (default: Pro).
 * - Mirrors the active lens onto `<body data-lens>` for CSS hooks.
 * - `force` locks the lens for a subtree (used by Start Here → Plain).
 */
export function LensProvider({
  children,
  force,
}: {
  children: React.ReactNode;
  force?: Lens;
}) {
  const [stored, setStored] = useState<Lens>("pro");

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    if (force) return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "pro" || saved === "plain") setStored(saved);
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, [force]);

  const lens: Lens = force ?? stored;

  // Reflect onto <body> so global CSS can react if needed.
  useEffect(() => {
    document.body.dataset.lens = lens;
    return () => {
      delete document.body.dataset.lens;
    };
  }, [lens]);

  const setLens = useCallback(
    (next: Lens) => {
      if (force) return;
      setStored(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
    },
    [force]
  );

  const toggle = useCallback(() => {
    setLens(lens === "pro" ? "plain" : "pro");
  }, [lens, setLens]);

  return (
    <LensContext.Provider
      value={{ lens, setLens, toggle, locked: Boolean(force) }}
    >
      {children}
    </LensContext.Provider>
  );
}

export function useLens(): LensContextValue {
  const ctx = useContext(LensContext);
  if (!ctx) {
    // Safe fallback so components used outside a provider still render (Pro).
    return { lens: "pro", setLens: () => {}, toggle: () => {}, locked: false };
  }
  return ctx;
}
