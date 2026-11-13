import React, { useCallback, useEffect, useState } from "react";
import { Button as CarbonButton, TextArea as CarbonTextArea } from "../../../components/bmw-m/Controls";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

type Inquiry = {
  id: string;
  reference_code: string;
  status: string;
  customer_name: string;
  email: string;
  phone?: string | null;
  country: string | null;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  vehicle_trim?: string | null;
  selected_model?: string | null;
  construction_type?: string | null;
  wheel_diameter?: string | null;
  wheel_width?: string | null;
  pcd?: string | null;
  offset?: string | null;
  centre_bore?: string | null;
  finish_code?: string | null;
  quantity?: string | null;
  project_notes?: string | null;
  created_at: string;
};

type InquiryResponse = {
  available: boolean;
  reason?: string;
  items?: Inquiry[];
  total?: number;
};

type InquiryDetailResponse = {
  available: boolean;
  found: boolean;
  inquiry?: Inquiry;
  events?: Array<{ id: string; event_type: string; actor_user_id: string | null; previous_value: string | null; new_value: string | null; note: string | null; created_at: string }>;
  attachments?: Array<{ id: string; original_filename: string; content_type: string; byte_size: number; uploaded_at: string }>;
};

const statusLabels: Record<string, string> = {
  new: "New",
  in_review: "In review",
  quoted: "Quoted",
  won: "Won",
  closed: "Closed",
  spam: "Spam"
};

const nextStatuses: Record<string, string[]> = {
  new: ["in_review", "spam", "closed"],
  in_review: ["quoted", "spam", "closed"],
  quoted: ["won", "closed"],
  won: ["closed"],
  closed: [],
  spam: []
};

export function InquiryInbox() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [events, setEvents] = useState<InquiryDetailResponse["events"]>([]);
  const [attachments, setAttachments] = useState<NonNullable<InquiryDetailResponse["attachments"]>>([]);
  const [downloadingId, setDownloadingId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

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

  const openInquiry = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const response = await apiFetch(`/_emdash/api/plugins/anvera-business/inquiries/detail?id=${encodeURIComponent(id)}`);
      const result = await parseApiResponse<InquiryDetailResponse>(response, "Unable to load inquiry details.");
      setSelected(result.inquiry ?? null);
      setEvents(result.events ?? []);
      setAttachments(result.attachments ?? []);
      if (!result.found) setError("This inquiry could not be found.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load inquiry details.");
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const downloadAttachment = async (attachment: NonNullable<InquiryDetailResponse["attachments"]>[number]) => {
    setDownloadingId(attachment.id);
    setError("");
    try {
      const response = await apiFetch(`/_emdash/api/plugins/anvera-business/inquiries/attachment?id=${encodeURIComponent(attachment.id)}`);
      const result = await parseApiResponse<{ available: boolean; found: boolean; filename: string; contentType: string; base64: string }>(response, "Unable to download attachment.");
      if (!result.available || !result.found || !result.base64) throw new Error("The private attachment is unavailable.");
      const binary = atob(result.base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: result.contentType || attachment.content_type });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = result.filename || attachment.original_filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to download attachment.");
    } finally {
      setDownloadingId("");
    }
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/inquiries/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, status })
      });
      const result = await parseApiResponse<{ updated: boolean; reason?: string }>(response, "Unable to update inquiry status.");
      if (!result.updated) throw new Error(result.reason === "invalid_transition" ? "This status transition is not allowed." : "The inquiry was not updated.");
      await load();
      await openInquiry(selected.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update inquiry status.");
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!selected || !note.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/inquiries/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, note })
      });
      const result = await parseApiResponse<{ added: boolean }>(response, "Unable to save note.");
      if (!result.added) throw new Error("The note could not be saved.");
      setNote("");
      await openInquiry(selected.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save note.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { void load(); }, [load]);

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
      {error ? <p className="anvera-inline-message" role="alert">{error}</p> : null}
      <section className="anvera-panel">
        <div className="anvera-panel-heading">
          <h2>All inquiries</h2>
          <CarbonButton kind="ghost" className="anvera-refresh" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </CarbonButton>
        </div>
        {loading ? (
          <div className="anvera-empty"><h3>Loading inquiry records</h3><p>Connecting to the secured business workspace.</p></div>
        ) : items.length ? (
          <div className="anvera-table-wrap">
            <table className="anvera-data-table">
              <thead><tr><th>REFERENCE</th><th>CUSTOMER</th><th>VEHICLE</th><th>MARKET</th><th>STATUS</th><th>RECEIVED</th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id} className={selectedId === item.id ? "anvera-row-selected" : ""}>
                  <td><CarbonButton kind="ghost" className="anvera-link-button" type="button" onClick={() => void openInquiry(item.id)}>{item.reference_code}</CarbonButton></td>
                  <td><strong>{item.customer_name}</strong><small>{item.email}</small></td>
                  <td>{[item.vehicle_make, item.vehicle_model, item.vehicle_year].filter(Boolean).join(" ")}</td>
                  <td>{item.country || "—"}</td>
                  <td><span className="anvera-record-status">{statusLabels[item.status] ?? item.status}</span></td>
                  <td>{new Date(item.created_at).toLocaleDateString()}</td>
                </tr>
              ))}</tbody>
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
      {selectedId ? (
        <section className="anvera-detail-panel">
          <div className="anvera-panel-heading">
            <h2>Inquiry details</h2>
            <CarbonButton kind="ghost" className="anvera-refresh anvera-refresh--light" type="button" onClick={() => { setSelectedId(""); setSelected(null); setEvents([]); setAttachments([]); }}>Close</CarbonButton>
          </div>
          {detailLoading ? <div className="anvera-empty"><p>Loading project details…</p></div> : selected ? (
            <div className="anvera-detail-content">
              <div className="anvera-detail-heading">
                <div><p className="anvera-eyebrow">{selected.reference_code}</p><h3>{selected.customer_name}</h3><p>{selected.email}{selected.phone ? ` · ${selected.phone}` : ""}</p></div>
                <span className="anvera-record-status">{statusLabels[selected.status] ?? selected.status}</span>
              </div>
              <div className="anvera-detail-grid">
                <div><span>VEHICLE</span><strong>{[selected.vehicle_make, selected.vehicle_model, selected.vehicle_year, selected.vehicle_trim].filter(Boolean).join(" ") || "—"}</strong></div>
                <div><span>MARKET</span><strong>{selected.country || "—"}</strong></div>
                <div><span>ANVERA MODEL</span><strong>{selected.selected_model || "—"}</strong></div>
                <div><span>CONSTRUCTION</span><strong>{selected.construction_type || "—"}</strong></div>
                <div><span>WHEEL SIZE</span><strong>{[selected.wheel_diameter, selected.wheel_width].filter(Boolean).join(" × ") || "—"}</strong></div>
                <div><span>PCD / OFFSET</span><strong>{[selected.pcd, selected.offset].filter(Boolean).join(" / ") || "—"}</strong></div>
                <div><span>CENTRE BORE</span><strong>{selected.centre_bore || "—"}</strong></div>
                <div><span>FINISH / QUANTITY</span><strong>{[selected.finish_code, selected.quantity].filter(Boolean).join(" / ") || "—"}</strong></div>
              </div>
              {selected.project_notes ? <div className="anvera-detail-notes"><span>PROJECT NOTES</span><p>{selected.project_notes}</p></div> : null}
              <div className="anvera-action-section">
                <h3>Customer attachments</h3>
                {attachments.length ? (
                  <ul className="anvera-attachment-list">
                    {attachments.map((attachment) => (
                      <li key={attachment.id}>
                        <div><strong>{attachment.original_filename}</strong><small>{attachment.content_type} · {(attachment.byte_size / 1024 / 1024).toFixed(2)} MB</small></div>
                        <CarbonButton kind="ghost" className="anvera-action-button" type="button" disabled={downloadingId === attachment.id} onClick={() => void downloadAttachment(attachment)}>
                          {downloadingId === attachment.id ? "Preparing…" : "Download"}
                        </CarbonButton>
                      </li>
                    ))}
                  </ul>
                ) : <p className="anvera-muted">No files were attached to this inquiry.</p>}
              </div>
              <div className="anvera-action-section">
                <h3>Update status</h3>
                <div className="anvera-action-row">
                  {(nextStatuses[selected.status] ?? []).map((status) => (
                    <CarbonButton kind="ghost" key={status} className="anvera-action-button" type="button" disabled={saving} onClick={() => void updateStatus(status)}>
                      {statusLabels[status]}
                    </CarbonButton>
                  ))}
                  {!(nextStatuses[selected.status] ?? []).length ? <span className="anvera-muted">No further status transitions are available.</span> : null}
                </div>
              </div>
              <div className="anvera-action-section">
                <h3>Internal notes</h3>
                <CarbonTextArea id="inquiry-internal-note" className="anvera-note-input" labelText="Internal note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} placeholder="Add an internal note for the team…" rows={4} />
                <CarbonButton kind="ghost" className="anvera-refresh" type="button" disabled={saving || !note.trim()} onClick={() => void addNote()}>{saving ? "Saving…" : "Add note"}</CarbonButton>
              </div>
              <div className="anvera-action-section">
                <h3>Activity timeline</h3>
                {events?.length ? <ol className="anvera-timeline">{events.map((event) => (
                  <li key={event.id}><div><strong>{event.event_type.replaceAll("_", " ")}</strong><time>{new Date(event.created_at).toLocaleString()}</time></div>{event.previous_value || event.new_value ? <p>{event.previous_value || "—"} → {event.new_value || "—"}</p> : null}{event.note ? <p>{event.note}</p> : null}</li>
                ))}</ol> : <p className="anvera-muted">No activity has been recorded.</p>}
              </div>
            </div>
          ) : <div className="anvera-empty"><p>Inquiry details are unavailable.</p></div>}
        </section>
      ) : null}
    </main>
  );
}
