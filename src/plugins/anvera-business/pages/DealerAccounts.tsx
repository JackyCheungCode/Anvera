import React from "react";

export function DealerAccounts() {
  return (
    <main className="anvera-workspace">
      <header className="anvera-page-header">
        <div>
          <p className="anvera-eyebrow">ANVERA BUSINESS / NETWORK</p>
          <h1>Dealer Accounts</h1>
          <p className="anvera-description">Manage approved dealer organizations and their access status.</p>
        </div>
        <span className="anvera-status">DATA CONNECTION PENDING</span>
      </header>
      <section className="anvera-panel">
        <div className="anvera-panel-heading"><h2>Active dealer network</h2><span>Every account must be linked to an approved organization.</span></div>
        <div className="anvera-empty">
          <div className="anvera-empty-mark">A</div>
          <h3>No dealer accounts loaded</h3>
          <p>Dealer records will appear here after server-side identity and organization checks are implemented.</p>
        </div>
      </section>
    </main>
  );
}
