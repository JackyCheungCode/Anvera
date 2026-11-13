import React, { useCallback, useEffect, useState } from "react";
import { Button as CarbonButton, TextInput as CarbonTextInput } from "@carbon/react";
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
  years_in_business?: number | null;
  represented_brands?: string | null;
  contact_name: string;
  contact_role?: string | null;
  email: string;
  phone: string | null;
  notes?: string | null;
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
  const [selected, setSelected] = useState<Application | null>(null);
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);

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

  const review = async (status: "reviewing" | "approved" | "rejected" | "withdrawn") => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/dealer-applications/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, status })
      });
      const result = await parseApiResponse<{ reviewed: boolean; reason?: string }>(response, "Unable to update application.");
      if (!result.reviewed) throw new Error(result.reason === "invalid_transition" ? "This application transition is not allowed." : "The application was not updated.");
      setSelected({ ...selected, status });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update application.");
    } finally {
      setSaving(false);
    }
  };

  const activate = async () => {
    if (!selected || !userId.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/dealers/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: selected.id, userId: userId.trim() })
      });
      const result = await parseApiResponse<{ activated: boolean; reason?: string }>(response, "Unable to activate dealer.");
      if (!result.activated) {
        const messages: Record<string, string> = {
          emdash_user_not_found: "No EmDash user exists with that ID.",
          identity_must_be_subscriber: "The linked EmDash account must have the Subscriber role.",
          application_not_approved_or_identity_already_linked: "The application must be approved, and the identity cannot already belong to another dealer."
        };
        throw new Error(messages[result.reason ?? ""] ?? "The dealer account was not activated.");
      }
      setUserId("");
      setSelected(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to activate dealer.");
    } finally {
      setSaving(false);
    }
  };

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
      {error ? <p className="anvera-inline-message" role="alert">{error}</p> : null}
      <section className="anvera-panel">
        <div className="anvera-panel-heading">
          <h2>Application queue</h2>
          <CarbonButton kind="ghost" className="anvera-refresh" type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</CarbonButton>
        </div>
        {loading ? (
          <div className="anvera-empty"><h3>Loading applications</h3><p>Connecting to the secured business workspace.</p></div>
        ) : items.length ? (
          <div className="anvera-table-wrap">
            <table className="anvera-data-table">
              <thead><tr><th>REFERENCE</th><th>COMPANY</th><th>CONTACT</th><th>MARKET</th><th>BUSINESS TYPE</th><th>STATUS</th><th>SUBMITTED</th><th></th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id} className={selected?.id === item.id ? "anvera-row-selected" : ""}>
                  <td>{item.reference_code}</td>
                  <td><strong>{item.trading_name || item.legal_company_name}</strong><small>{item.legal_company_name}</small></td>
                  <td><strong>{item.contact_name}</strong><small>{item.email}</small></td>
                  <td>{[item.city, item.country].filter(Boolean).join(", ") || "—"}</td>
                  <td>{item.business_type}</td>
                  <td><span className="anvera-record-status">{item.status}</span></td>
                  <td>{new Date(item.created_at).toLocaleDateString()}</td>
                  <td><CarbonButton kind="ghost" className="anvera-link-button" type="button" onClick={() => setSelected(item)}>Review</CarbonButton></td>
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
      {selected ? (
        <section className="anvera-detail-panel">
          <div className="anvera-panel-heading"><h2>Application review · {selected.reference_code}</h2><CarbonButton kind="ghost" className="anvera-refresh anvera-refresh--light" type="button" onClick={() => setSelected(null)}>Close</CarbonButton></div>
          <div className="anvera-detail-content">
            <div className="anvera-detail-heading"><div><p className="anvera-eyebrow">COMPANY</p><h3>{selected.trading_name || selected.legal_company_name}</h3><p>{selected.legal_company_name}</p></div><span className="anvera-record-status">{selected.status}</span></div>
            <div className="anvera-detail-grid">
              <div><span>CONTACT</span><strong>{selected.contact_name}{selected.contact_role ? ` · ${selected.contact_role}` : ""}</strong></div>
              <div><span>EMAIL / PHONE</span><strong>{selected.email}{selected.phone ? ` · ${selected.phone}` : ""}</strong></div>
              <div><span>MARKET</span><strong>{[selected.city, selected.country].filter(Boolean).join(", ")}</strong></div>
              <div><span>BUSINESS TYPE</span><strong>{selected.business_type}</strong></div>
              <div><span>YEARS IN BUSINESS</span><strong>{selected.years_in_business ?? "—"}</strong></div>
              <div><span>REPRESENTED BRANDS</span><strong>{selected.represented_brands || "—"}</strong></div>
            </div>
            {selected.notes ? <div className="anvera-detail-notes"><span>APPLICATION NOTES</span><p>{selected.notes}</p></div> : null}
            {selected.status === "pending" ? <div className="anvera-action-section"><h3>Review decision</h3><div className="anvera-action-row"><CarbonButton kind="ghost" className="anvera-action-button" disabled={saving} onClick={() => void review("reviewing")}>Start review</CarbonButton><CarbonButton kind="ghost" className="anvera-action-button anvera-action-button--quiet" disabled={saving} onClick={() => void review("withdrawn")}>Withdraw</CarbonButton></div></div> : null}
            {selected.status === "reviewing" ? <div className="anvera-action-section"><h3>Review decision</h3><div className="anvera-action-row"><CarbonButton kind="ghost" className="anvera-action-button" disabled={saving} onClick={() => void review("approved")}>Approve application</CarbonButton><CarbonButton kind="ghost" className="anvera-action-button anvera-action-button--danger" disabled={saving} onClick={() => void review("rejected")}>Reject</CarbonButton><CarbonButton kind="ghost" className="anvera-action-button anvera-action-button--quiet" disabled={saving} onClick={() => void review("withdrawn")}>Withdraw</CarbonButton></div></div> : null}
            {selected.status === "approved" ? <div className="anvera-action-section"><h3>Activate dealer access</h3><p className="anvera-muted">Approval does not activate access. Enter the ID of an existing EmDash Subscriber account to link this organization.</p><CarbonTextInput id="anvera-dealer-user-id" labelText="EmDash user ID" className="anvera-note-input" value={userId} onChange={(event) => setUserId(event.target.value)} maxLength={128} placeholder="Existing Subscriber user ID" /><CarbonButton kind="ghost" className="anvera-refresh" type="button" disabled={saving || !userId.trim()} onClick={() => void activate()}>{saving ? "Activating…" : "Activate dealer"}</CarbonButton></div> : null}
            {["rejected", "withdrawn"].includes(selected.status) ? <p className="anvera-muted">This application is closed. No dealer identity has been activated.</p> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
