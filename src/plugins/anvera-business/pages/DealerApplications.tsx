import React from "react";

export function DealerApplications() {
  return (
    <main className="anvera-workspace">
      <header className="anvera-page-header">
        <div>
          <p className="anvera-eyebrow">ANVERA BUSINESS / NETWORK</p>
          <h1>Dealer Applications</h1>
          <p className="anvera-description">Review distributor applications before granting account access.</p>
        </div>
        <span className="anvera-status">DATA CONNECTION PENDING</span>
      </header>
      <section className="anvera-panel">
        <div className="anvera-panel-heading"><h2>Application queue</h2><span>Manual approval is required before activation.</span></div>
        <div className="anvera-empty">
          <div className="anvera-empty-mark">A</div>
          <h3>No applications loaded</h3>
          <p>Applications will appear here after the authenticated application API is connected.</p>
        </div>
      </section>
    </main>
  );
}
