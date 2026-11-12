import React, { useCallback, useEffect, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

type Application = {
  id: string;
  reference_code: string;
  status: string;
  legal_company_name: string;
  trading_name: string | null;
  business_type: string;
  country: string;
  city: string | null;
  contact_name: string;
  email: string;
  created_at: string;
};

type ApplicationResponse = {
  available: boolean;
  reason?: string;
  items?: Application[];
  total?: number;
};

export function DealerApplications() {
  const [items, setItems] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/dealer-applications/list?limit=50");
      const result = await parseApiResponse<ApplicationResponse>(response, "Unable to load dealer applications.");
      setAvailable(result.available);
      setItems(result.items ?? []);
      setTotal(result.total ?? 0);
      if (!result.available) {
        setError(result.reason === "migration_pending"
          ? "The business database is not enabled yet. The reviewed D1 migration must be approved and applied before applications can load."
          : "The dealer application service is currently unavailable.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load dealer applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="anvera-workspace">
      <header className="anvera-page-header">
        <div>
          <p className="anvera-eyebrow">ANVERA BUSINESS / NETWORK</p>
          <h1>Dealer Applications</h1>
          <p className="anvera-description">Review distributor applications before granting account access.</p>
        </div>
        <span className={available ? "anvera-status anvera-status--ready" : "anvera-status"}>
          {available ? "LIVE DATA" : "DATABASE NOT ENABLED"}
        </span>
      </header>
      <section className="anvera-metrics" aria-label="Application overview">
        <article><span>TOTAL APPLICATIONS</span><strong>{available ? total : "—"}</strong></article>
        <article><span>LOADED RECORDS</span><strong>{available ? items.length : "—"}</strong></article>
        <article><span>REVIEW MODE</span><strong>MANUAL</strong></article>
      </section>
      <section className="anvera-panel">
        <div className="anvera-panel-heading">
          <h2>Application queue</h2>
          <button className="anvera-refresh" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {error ? <p className="anvera-inline-message" role="status">{error}</p> : null}
        {loading ? (
          <div className="anvera-empty"><h3>Loading applications</h3><p>Connecting to the secured business workspace.</p></div>
        ) : items.length ? (
          <div className="anvera-table-wrap">
            <table className="anvera-data-table">
              <thead><tr><th>REFERENCE</th><th>COMPANY</th><th>CONTACT</th><th>MARKET</th><th>BUSINESS TYPE</th><th>STATUS</th><th>SUBMITTED</th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id}>
                  <td>{item.reference_code}</td>
                  <td><strong>{item.trading_name || item.legal_company_name}</strong><small>{item.legal_company_name}</small></td>
                  <td><strong>{item.contact_name}</strong><small>{item.email}</small></td>
                  <td>{[item.city, item.country].filter(Boolean).join(", ") || "—"}</td>
                  <td>{item.business_type}</td>
                  <td><span className="anvera-record-status">{item.status}</span></td>
                  <td>{new Date(item.created_at).toLocaleDateString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className="anvera-empty">
            <div className="anvera-empty-mark">A</div>
            <h3>{available ? "No applications yet" : "Application data is not connected"}</h3>
            <p>{available ? "New dealer applications will appear here for manual review." : "The live queue will appear after the approved database migration is applied. Approval and activation remain separate actions."}</p>
          </div>
        )}
      </section>
    </main>
  );
}
