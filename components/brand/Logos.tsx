/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

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

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  const qapita = compact ? "h-7" : "h-8";

  return (
    <Link
      href="/"
      aria-label="Qapita EquityIQ home"
      className="inline-flex items-center gap-3"
      style={{ textDecoration: "none" }}
    >
      <span className="inline-flex items-center rounded-xl bg-white/96 px-3 py-2 shadow-sm">
        <QapitaLogo className={`${qapita} w-auto`} />
      </span>
      <span className="h-7 w-px bg-white/25" aria-hidden="true" />
      <span className="font-head text-xl text-white">EquityIQ</span>
    </Link>
  );
}
