export default function PlainLanguageCallout({ text }: { text: string }) {
  return (
    <aside
      className="rounded-lg border-l-2 pl-4 py-3 pr-4 mb-6"
      style={{
        borderColor: "var(--accent-line)",
        backgroundColor: "var(--surface-1)",
      }}
    >
      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
        In plain language
      </p>
      <p className="text-[var(--text-primary)] leading-relaxed">{text}</p>
    </aside>
  );
}
