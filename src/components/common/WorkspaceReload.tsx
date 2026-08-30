import { useEffect, useState } from "react";

export function WorkspaceReload({ duration = 3900 }: { duration?: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const linear = Math.min(elapsed / duration, 1);
      const eased = linear * linear * (3 - 2 * linear);
      setProgress(Math.min(100, Math.round(eased * 100)));
    }, 90);
    return () => window.clearInterval(timer);
  }, [duration]);

  return (
    <div className="workspace-reload" role="status" aria-live="polite" aria-label={`Loading AECS CRM, ${progress}%`}>
      <div className="workspace-reload-stage" aria-hidden="true">
        <div className="workspace-reload-wordmark" data-text="AECS CRM">AECS CRM</div>
        <div className="workspace-reload-counter">
          <div className="workspace-reload-counter-copy">
            <span>Loading workspace</span>
            <span className="workspace-reload-percentage"><strong>{progress}</strong>%</span>
          </div>
          <div className="workspace-reload-track">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkspaceReload;
