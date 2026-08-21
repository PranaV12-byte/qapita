/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export function NasppLogo({ className }: { className?: string }) {
  return <img src="/brand/naspp-transparent.png" alt="NASPP" className={className} draggable={false} />;
}

export function QapitaLogo({ className, variant = "dark" }: { className?: string; variant?: "dark" | "light" }) {
  return (
    <img
      src={variant === "light" ? "/brand/qapita.png" : "/brand/qapita-white-full.png"}
      alt="Qapita"
      className={className}
      draggable={false}
    />
  );
}

export function QapitaMark({ className }: { className?: string }) {
  return <img src="/brand/qapita-mark-white.png" alt="Qapita" className={className} draggable={false} />;
}

export function BrandCluster({
  className,
  qapitaClassName,
  nasppClassName,
  separatorClassName,
  variant = "dark",
}: {
  className?: string;
  qapitaClassName?: string;
  nasppClassName?: string;
  separatorClassName?: string;
  variant?: "dark" | "light";
}) {
  return (
    <span
      className={className ?? "inline-flex items-center"}
      aria-label="Qapita and NASPP"
      role="img"
    >
      <QapitaLogo variant={variant} className={qapitaClassName ?? "h-8 w-auto"} />
      <span
        className={separatorClassName ?? "mx-4 h-7 w-px bg-white/40"}
        aria-hidden="true"
      />
      <NasppLogo className={nasppClassName ?? "h-5 w-auto object-contain"} />
    </span>
  );
}

export function BrandLockup({ compact = false, variant = "dark" }: { compact?: boolean; variant?: "dark" | "light" }) {
  const qapita = compact ? "h-7 w-auto" : "h-8 w-auto";
  const naspp = compact ? "h-4 w-auto object-contain" : "h-5 w-auto object-contain";
  const separator = compact ? "mx-3 h-6 w-px bg-white/40" : "mx-4 h-7 w-px bg-white/40";

  return (
    <Link
      href="/"
      aria-label="Qapita and NASPP home"
      className="inline-flex items-center"
      style={{ textDecoration: "none" }}
    >
      <BrandCluster
        qapitaClassName={qapita}
        nasppClassName={naspp}
        separatorClassName={separator}
        variant={variant}
      />
    </Link>
  );
}
