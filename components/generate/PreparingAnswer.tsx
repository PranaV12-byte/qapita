export default function PreparingAnswer() {
  return (
    <section className="v9-loading-card" role="status" aria-live="polite" aria-busy="true">
      <div className="v9-loading-heading">
        <span aria-hidden="true"><i /><i /><i /></span>
        <div>
          <p>Preparing your answer</p>
          <small>Reviewing the details and drafting a clear response.</small>
        </div>
      </div>
      <div className="v9-loading-preview" aria-hidden="true">
        <div className="v9-loading-document">
          <i className="is-label" />
          <i className="is-title" />
          <i className="is-title is-short" />
          <div className="v9-loading-lines">
            {[92, 78, 88, 64].map((width) => <i key={width} style={{ width: `${width}%` }} />)}
          </div>
        </div>
        <div className="v9-loading-aside"><i /><i /><i /></div>
      </div>
    </section>
  );
}
