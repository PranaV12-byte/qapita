import type { ComparisonData } from "@/lib/llm/types";

type Props = { comparison: ComparisonData };

function renderCellText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

export default function ComparisonResult({ comparison }: Props) {
  // The surrounding page never scrolls sideways. Only this table wrapper may
  // scroll on narrow screens, preserving readable topic columns and the feature column.
  return (
    <section className="v9-comparison-card" aria-label="Comparison answer">
      <header className="v9-comparison-card-header">
        <p>Your Answer Is Ready</p>
        <h2>{comparison.title}</h2>
        <div className="v9-comparison-subtitle">{comparison.subtitle}</div>
      </header>

      <div className="v9-comparison-wrapper">
        <div className="v9-comparison-table-scroll" tabIndex={0} aria-label="Scrollable comparison table">
          <table className="v9-comparison-table">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                {comparison.columns.map((column, index) => (
                  <th key={column} scope="col" className={index % 2 === 0 ? "is-purple" : "is-amber"}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.feature}>
                  <th scope="row">{row.feature}</th>
                  {row.values.map((value, index) => (
                    <td key={`${row.feature}-${index}`} className={index % 2 === 0 ? "is-purple-text" : "is-amber-text"}>
                      {renderCellText(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="v9-comparison-takeaway">
        <h3>Bottom Line</h3>
        <p>{renderCellText(comparison.takeaway)}</p>
      </aside>
    </section>
  );
}
