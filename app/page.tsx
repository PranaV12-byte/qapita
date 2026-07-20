import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-16 text-center">
      <h1 className="font-serif text-heading text-4xl md:text-5xl leading-tight mb-4">
        Equity compensation, explained.
      </h1>
      <p className="text-body text-lg mb-8 max-w-md">
        AI-powered reference for stock plan professionals.
      </p>
      <Link
        href="/generate"
        className="inline-flex items-center px-6 py-3 rounded-lg font-medium text-accent-on transition-opacity hover:opacity-90"
        style={{
          backgroundColor: "var(--accent-solid)",
          textDecoration: "none",
          minHeight: "44px",
        }}
      >
        Ask a question →
      </Link>
    </div>
  );
}
