export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 font-head text-3xl text-heading">Disclaimer</h1>
      <div className="space-y-4 text-body">
        <p>
          Draft content on this site may not have been reviewed by a qualified
          professional. It is educational only and is not tax, legal, or
          investment advice. US only.
        </p>
        <p>
          The content on this site is provided for informational and educational
          purposes only. It does not constitute tax advice, legal advice,
          investment advice, or any other form of professional advice.
        </p>
        <p>
          Equity compensation is a complex area of law and finance that varies
          significantly based on individual circumstances. Consult qualified tax
          professionals, attorneys, and financial advisors before making
          decisions about equity compensation.
        </p>
        <p>
          This site covers US equity compensation rules only. Rules differ
          significantly in other jurisdictions.
        </p>
        <p className="mt-8 text-sm text-muted">
          This is a preview build. Content has not been formally reviewed for
          production use.
        </p>
      </div>
    </div>
  );
}
