import React, { useCallback, useEffect, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

type ReviewItem = {
  id: string; entity_type: "material" | "forging_process" | "finish_profile"; code: string; name: string;
  detail: string; status: string; revision: number; updated_at: string;
};
type QueueResponse = { available: boolean; reason?: string; items?: ReviewItem[] };
type ReviewResponse = { reviewed: boolean; status?: string; revision?: number; reason?: string };

export function LibraryReviewQueue() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/product-library/review-queue");
      const result = await parseApiResponse<QueueResponse>(response, "Unable to load the engineering review queue.");
      setAvailable(result.available);
      setItems(result.items ?? []);
      if (!result.available && result.reason === "migration_pending") {
        setError("The engineering review queue is available in Preview after its schema migration.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the engineering review queue.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (item: ReviewItem, decision: "approved" | "needs_revision" | "restricted") => {
    setSavingId(item.id); setError(""); setNotice("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/product-library/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: item.entity_type, id: item.id, revision: item.revision,
          decision, note: notes[item.id] ?? ""
        })
      });
      const result = await parseApiResponse<ReviewResponse>(response, "Unable to record the engineering decision.");
      if (!result.reviewed) throw new Error(result.reason === "revision_conflict" ? "This record changed. Refresh the queue before reviewing it." : result.reason ?? "The review decision was not saved.");
      setNotice(`${item.code}: ${decision.replaceAll("_", " ")} recorded.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record the engineering decision.");
    } finally { setSavingId(""); }
  };

  return <section className="api-review-queue">
    <div className="api-review-queue-heading">
      <div><p className="anvera-eyebrow">ENGINEERING GOVERNANCE</p><h3>Material & Forging Review Queue</h3><p>Review submitted capability records and record an explicit engineering decision. Approval is never inferred from submission.</p></div>
      <button type="button" className="anvera-refresh anvera-refresh--light" onClick={() => void load()} disabled={loading}>Refresh queue</button>
    </div>
    {error ? <p className="anvera-inline-message" role="alert">{error}</p> : null}
    {notice ? <p className="api-success-message" role="status">{notice}</p> : null}
    {!available && !loading ? <div className="api-review-queue-empty"><strong>Review storage not available</strong><span>The normalized review schema is installed in Preview only in this development phase.</span></div> :
      loading ? <div className="api-review-queue-empty"><strong>Loading review queue…</strong></div> :
      items.length ? <div className="api-review-queue-list">{items.map((item) => <article key={item.id}>
        <div className="api-review-queue-record">
          <span>{item.entity_type === "material" ? "MATERIAL PROFILE" : item.entity_type === "forging_process" ? "FORGING PROCESS" : "FINISH PROFILE"} · REVISION {item.revision}</span>
          <strong>{item.code} · {item.name}</strong>
          <small>{item.detail}</small>
        </div>
        <label className="api-review-note"><span>Engineering review note</span><textarea value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Record evidence checked, limitations or required changes." rows={2} /></label>
        <div className="api-review-decision-actions">
          <button type="button" className="api-review-decision--approve" disabled={savingId === item.id} onClick={() => void decide(item, "approved")}>Approve</button>
          <button type="button" disabled={savingId === item.id} onClick={() => void decide(item, "needs_revision")}>Return for revision</button>
          <button type="button" className="api-review-decision--restrict" disabled={savingId === item.id} onClick={() => void decide(item, "restricted")}>Restrict</button>
        </div>
      </article>)}</div> : <div className="api-review-queue-empty"><strong>Queue is clear</strong><span>No material or forging records are waiting for engineering review.</span></div>}
  </section>;
}
