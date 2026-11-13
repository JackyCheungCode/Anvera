import React, { useCallback, useEffect, useState } from "react";
import { Button as CarbonButton } from "@carbon/react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

type Dealer = {
  id: string;
  emdash_user_id: string;
  application_id: string;
  legal_company_name: string;
  country: string;
  status: string;
  activated_at: string;
  updated_at: string;
};

type DealerResponse = {
  available: boolean;
  reason?: string;
  items?: Dealer[];
  total?: number;
};

export function DealerAccounts() {
  const [items, setItems] = useState<Dealer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(false);
  const [confirmId, setConfirmId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/dealers/list?limit=50");
      const result = await parseApiResponse<DealerResponse>(response, "Unable to load dealer accounts.");
      setAvailable(result.available);
      setItems(result.items ?? []);
      setTotal(result.total ?? 0);
      if (!result.available) {
        setError(result.reason === "migration_pending"
          ? "The business database is not enabled yet. The reviewed D1 migration must be approved and applied before dealer accounts can load."
          : "The dealer account service is currently unavailable.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load dealer accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  const suspend = async (id: string) => {
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/dealers/suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, note: "Suspended from ANVERA Business admin." })
      });
      const result = await parseApiResponse<{ suspended: boolean }>(response, "Unable to suspend dealer.");
      if (!result.suspended) throw new Error("This dealer account is not active or could not be found.");
      setConfirmId("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to suspend dealer.");
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
          <h1>Dealer Accounts</h1>
          <p className="anvera-description">Manage approved dealer organizations and their access status.</p>
        </div>
        <span className={available ? "anvera-status anvera-status--ready" : "anvera-status"}>
          {available ? "LIVE DATA" : "DATABASE NOT ENABLED"}
        </span>
      </header>
      <section className="anvera-metrics" aria-label="Dealer account overview">
        <article><span>TOTAL DEALER ACCOUNTS</span><strong>{available ? total : "—"}</strong></article>
        <article><span>LOADED RECORDS</span><strong>{available ? items.length : "—"}</strong></article>
        <article><span>ACCESS CONTROL</span><strong>SERVER-SIDE</strong></article>
      </section>
      {error ? <p className="anvera-inline-message" role="alert">{error}</p> : null}
      <section className="anvera-panel">
        <div className="anvera-panel-heading">
          <h2>Dealer network</h2>
          <CarbonButton kind="ghost" className="anvera-refresh" type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</CarbonButton>
        </div>
        {loading ? (
          <div className="anvera-empty"><h3>Loading dealer accounts</h3><p>Connecting to the secured business workspace.</p></div>
        ) : items.length ? (
          <div className="anvera-table-wrap">
            <table className="anvera-data-table">
              <thead><tr><th>COMPANY</th><th>COUNTRY</th><th>EMDASH USER</th><th>APPLICATION</th><th>STATUS</th><th>ACTIVATED</th><th>ACTION</th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.legal_company_name}</strong></td>
                  <td>{item.country}</td>
                  <td>{item.emdash_user_id}</td>
                  <td>{item.application_id}</td>
                  <td><span className="anvera-record-status">{item.status}</span></td>
                  <td>{new Date(item.activated_at).toLocaleDateString()}</td>
                  <td>{item.status === "active" ? (
                    confirmId === item.id ? (
                      <span className="anvera-confirm-actions"><CarbonButton kind="ghost" className="anvera-action-button anvera-action-button--danger" type="button" disabled={saving} onClick={() => void suspend(item.id)}>{saving ? "Saving…" : "Confirm"}</CarbonButton><CarbonButton kind="ghost" className="anvera-link-button" type="button" onClick={() => setConfirmId("")}>Cancel</CarbonButton></span>
                    ) : <CarbonButton kind="ghost" className="anvera-link-button anvera-link-button--danger" type="button" onClick={() => setConfirmId(item.id)}>Suspend</CarbonButton>
                  ) : <span className="anvera-muted">—</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className="anvera-empty">
            <div className="anvera-empty-mark">A</div>
            <h3>{available ? "No dealer accounts yet" : "Dealer data is not connected"}</h3>
            <p>{available ? "Approved and activated dealer organizations will appear here." : "Dealer identities will only be linked after manual approval and an explicit administrator activation."}</p>
          </div>
        )}
      </section>
    </main>
  );
}
