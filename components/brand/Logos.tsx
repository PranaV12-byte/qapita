/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

/**
 * Official NASPP + Qapita marks (public/brand/*.png), both transparent so they
 * sit directly on the dark header — no chip. naspp.png had its white background
 * knocked out to transparency; qapita.png ships transparent.
 */

export function NasppLogo({ className }: { className?: string }) {
  return (
    <img
      src="/brand/naspp.png"
      alt="NASPP"
      className={className}
      draggable={false}
    />
  );
}

export function QapitaLogo({ className }: { className?: string }) {
  return (
    <img
      src="/brand/qapita.png"
      alt="Qapita"
      className={className}
      draggable={false}
    />
  );
}

/**
 * The co-brand lockup used in the header: NASPP | Qapita, linking home.
 * `compact` shrinks it for the mobile bar / drawer.
 */
export function BrandLockup({ compact = false }: { compact?: boolean }) {
  const naspp = compact ? "h-4" : "h-5";
  const qapita = compact ? "h-7" : "h-8";
  return (
    <Link
      href="/"
      aria-label="NASPP and Qapita — home"
      className="inline-flex items-center hover:opacity-80 transition-opacity"
      style={{ textDecoration: "none" }}
    >
      <NasppLogo className={`${naspp} w-auto`} />
      <span
        aria-hidden="true"
        className={`mx-3 ${compact ? "h-4" : "h-5"} w-px`}
        style={{ backgroundColor: "var(--border-strong)" }}
      />
      <QapitaLogo className={`${qapita} w-auto`} />
    </Link>
  );
}
