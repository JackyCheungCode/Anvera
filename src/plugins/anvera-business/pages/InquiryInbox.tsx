import React from "react";

export function InquiryInbox() {
  return (
    <main className="anvera-workspace">
      <header className="anvera-page-header">
        <div>
          <p className="anvera-eyebrow">ANVERA BUSINESS / SALES</p>
          <h1>Inquiry Inbox</h1>
          <p className="anvera-description">Review incoming wheel projects and manage the quotation workflow.</p>
        </div>
        <span className="anvera-status">DATA CONNECTION PENDING</span>
      </header>
      <section className="anvera-metrics" aria-label="Inquiry overview">
        <article><span>OPEN INQUIRIES</span><strong>—</strong></article>
        <article><span>AWAITING REVIEW</span><strong>—</strong></article>
        <article><span>QUOTATIONS SENT</span><strong>—</strong></article>
      </section>
      <section className="anvera-panel">
        <div className="anvera-panel-heading"><h2>All inquiries</h2><span>Live records will appear here after the secure API is connected.</span></div>
        <div className="anvera-empty">
          <div className="anvera-empty-mark">A</div>
          <h3>No inquiry records loaded</h3>
          <p>This workspace is connected to the ANVERA plugin shell. It does not display sample customer data.</p>
        </div>
      </section>
    </main>
  );
}
