const Block = ({ className = "" }: { className?: string }) => (
  <span className={`crm-skeleton-block ${className}`} aria-hidden="true" />
);

export function CrmSkeleton() {
  return (
    <div className="crm-skeleton" role="status" aria-live="polite" aria-label="Loading AECS CRM workspace">
      <aside className="crm-skeleton-sidebar" aria-hidden="true">
        <div className="crm-skeleton-brand"><Block className="crm-skeleton-logo" /><div><Block className="w-56" /><Block className="w-40 small" /></div></div>
        <Block className="w-32 tiny crm-skeleton-section" />
        <div className="crm-skeleton-nav">
          {Array.from({ length: 11 }, (_, index) => <div className={index === 0 ? "active" : ""} key={index}><Block className="icon" /><Block className={index % 3 === 0 ? "w-60" : "w-48"} /></div>)}
        </div>
        <div className="crm-skeleton-branch"><Block className="dot" /><div><Block className="w-52" /><Block className="w-40 small" /></div></div>
      </aside>

      <main className="crm-skeleton-main" aria-hidden="true">
        <header className="crm-skeleton-topbar">
          <div className="crm-skeleton-crumb"><Block className="w-32" /><Block className="w-60" /></div>
          <div className="crm-skeleton-actions"><Block className="search" /><Block className="button" /><Block className="circle" /><Block className="profile" /></div>
        </header>
        <section className="crm-skeleton-content">
          <div className="crm-skeleton-heading"><div><Block className="w-36 tiny" /><Block className="title" /><Block className="subtitle" /></div><Block className="button wide" /></div>
          <div className="crm-skeleton-stats">
            {Array.from({ length: 4 }, (_, index) => <article key={index}><div><Block className="w-48 small" /><Block className="metric" /><Block className="w-56 small" /></div><Block className="stat-icon" /></article>)}
          </div>
          <div className="crm-skeleton-panels">
            <article className="crm-skeleton-panel large-panel">
              <div className="crm-skeleton-panel-head"><div><Block className="w-60" /><Block className="w-40 small" /></div><Block className="button" /></div>
              <div className="crm-skeleton-chart"><Block className="chart-fill" /></div>
            </article>
            <article className="crm-skeleton-panel">
              <div className="crm-skeleton-panel-head"><div><Block className="w-60" /><Block className="w-40 small" /></div></div>
              <div className="crm-skeleton-list">{Array.from({ length: 5 }, (_, index) => <div key={index}><Block className="avatar" /><div><Block className="w-56" /><Block className="w-40 small" /></div><Block className="w-32 small" /></div>)}</div>
            </article>
          </div>
        </section>
      </main>
      <span className="crm-skeleton-reader-text">Loading AECS CRM workspace…</span>
    </div>
  );
}

export default CrmSkeleton;
