import React, { useCallback, useEffect, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

type Inquiry = {
  id: string;
  reference_code: string;
  status: string;
  customer_name: string;
  email: string;
  country: string | null;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  created_at: string;
};

type InquiryResponse = {
  available: boolean;
  reason?: string;
  items?: Inquiry[];
  total?: number;
};

const statusLabels: Record<string, string> = {
  new: "New",
  in_review: "In review",
  quoted: "Quoted",
  won: "Won",
  closed: "Closed",
  spam: "Spam"
};

export function InquiryInbox() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/inquiries/list?limit=50");
      const result = await parseApiResponse<InquiryResponse>(response, "Unable to load inquiries.");
      setAvailable(result.available);
      setItems(result.items ?? []);
      setTotal(result.total ?? 0);
      if (!result.available) {
        setError(result.reason === "migration_pending"
          ? "The business database is not enabled yet. The reviewed D1 migration must be approved and applied before records can load."
          : "The inquiry service is currently unavailable.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load inquiries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="anvera-workspace">
      <header className="anvera-page-header">
        <div>
          <p className="anvera-eyebrow">ANVERA BUSINESS / SALES</p>
          <h1>Inquiry Inbox</h1>
          <p className="anvera-description">Review incoming wheel projects and manage the quotation workflow.</p>
        </div>
        <span className={available ? "anvera-status anvera-status--ready" : "anvera-status"}>
          {available ? "LIVE DATA" : "DATABASE NOT ENABLED"}
        </span>
      </header>
      <section className="anvera-metrics" aria-label="Inquiry overview">
        <article><span>TOTAL INQUIRIES</span><strong>{available ? total : "—"}</strong></article>
        <article><span>LOADED RECORDS</span><strong>{available ? items.length : "—"}</strong></article>
        <article><span>DATA SOURCE</span><strong>{available ? "D1" : "—"}</strong></article>
      </section>
      <section className="anvera-panel">
        <div className="anvera-panel-heading">
          <h2>All inquiries</h2>
          <button className="anvera-refresh" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {error ? <p className="anvera-inline-message" role="status">{error}</p> : null}
        {loading ? (
          <div className="anvera-empty"><h3>Loading inquiry records</h3><p>Connecting to the secured business workspace.</p></div>
        ) : items.length ? (
          <div className="anvera-table-wrap">
            <table className="anvera-data-table">
              <thead><tr><th>REFERENCE</th><th>CUSTOMER</th><th>VEHICLE</th><th>MARKET</th><th>STATUS</th><th>RECEIVED</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.reference_code}</td>
                    <td><strong>{item.customer_name}</strong><small>{item.email}</small></td>
                    <td>{[item.vehicle_make, item.vehicle_model, item.vehicle_year].filter(Boolean).join(" ")}</td>
                    <td>{item.country || "—"}</td>
                    <td><span className="anvera-record-status">{statusLabels[item.status] ?? item.status}</span></td>
                    <td>{new Date(item.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="anvera-empty">
            <div className="anvera-empty-mark">A</div>
            <h3>{available ? "No inquiries yet" : "Inquiry data is not connected"}</h3>
            <p>{available ? "New customer projects will appear here when submitted." : "No customer records are fabricated or shown as examples. The live list will appear after the approved database migration is applied and the API is enabled."}</p>
          </div>
        )}
      </section>
    </main>
  );
}
