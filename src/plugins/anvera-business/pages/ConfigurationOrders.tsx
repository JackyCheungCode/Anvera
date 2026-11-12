import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

type Order = {
  id: string; reference_code: string; status: string; customer_name: string | null; email: string | null;
  phone: string | null; country: string | null; vehicle_make: string | null; vehicle_model: string | null;
  vehicle_year: number | null; selected_model: string | null; specification_path: string | null;
  delivery_term: string | null; shipping_method: string | null; created_at: string; submitted_at: string | null;
  configuration?: Record<string, any>;
};
type Event = { id: string; event_type: string; actor: string; event_json: string; created_at: string };
type ListResponse = { available: boolean; reason?: string; items?: Order[]; total?: number };
type DetailResponse = { available: boolean; found: boolean; order?: Order; events?: Event[] };

const labels: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", custom_review: "Engineering review", needs_information: "Needs information",
  quoted: "Quoted", confirmed: "Confirmed", in_production: "In production", quality_inspection: "Quality inspection",
  dispatched: "Dispatched", in_transit: "In transit", customs_clearance: "Customs clearance",
  out_for_delivery: "Out for delivery", completed: "Completed", cancelled: "Cancelled"
};
const transitions: Record<string, string[]> = {
  draft: [], submitted: ["needs_information", "quoted", "confirmed", "cancelled"],
  custom_review: ["needs_information", "submitted", "quoted", "confirmed", "cancelled"],
  needs_information: ["submitted", "custom_review", "cancelled"], quoted: ["needs_information", "confirmed", "cancelled"],
  confirmed: ["in_production", "cancelled"], in_production: ["quality_inspection", "cancelled"],
  quality_inspection: ["in_production", "dispatched"], dispatched: ["in_transit"],
  in_transit: ["customs_clearance", "out_for_delivery"], customs_clearance: ["out_for_delivery", "in_transit"],
  out_for_delivery: ["completed"], completed: [], cancelled: []
};

export function ConfigurationOrders() {
  const [items, setItems] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Order | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (query.trim()) params.set("q", query.trim());
      if (filter) params.set("status", filter);
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/configuration-orders/list?" + params);
      const result = await parseApiResponse<ListResponse>(response, "Unable to load configuration orders.");
      setItems(result.items ?? []); setTotal(result.total ?? 0);
      if (!result.available) setError(result.reason === "migration_pending"
        ? "Configuration order storage is not enabled. Apply the reviewed database migration before using this workspace."
        : "Configuration order service is unavailable.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load configuration orders."); }
    finally { setLoading(false); }
  }, [query, filter]);

  const open = useCallback(async (id: string) => {
    setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/configuration-orders/detail?id=" + encodeURIComponent(id));
      const result = await parseApiResponse<DetailResponse>(response, "Unable to load configuration details.");
      setSelected(result.order ?? null); setEvents(result.events ?? []);
      if (!result.found) setError("This configuration order could not be found.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load configuration details."); }
  }, []);

  const changeStatus = async (status: string) => {
    if (!selected) return;
    setSaving(true); setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/configuration-orders/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, status, note })
      });
      const result = await parseApiResponse<{ updated: boolean; reason?: string }>(response, "Unable to update order status.");
      if (!result.updated) throw new Error(result.reason === "invalid_transition" ? "That status transition is not permitted." : "The status was not updated.");
      setNote(""); await load(); await open(selected.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update order."); }
    finally { setSaving(false); }
  };

  useEffect(() => { void load(); }, [load]);
  const next = useMemo(() => selected ? transitions[selected.status] ?? [] : [], [selected]);

  return <main className="anvera-workspace">
    <header className="anvera-page-header">
      <div><p className="anvera-eyebrow">ANVERA BUSINESS / CUSTOMER PROJECTS</p><h1>Configuration Orders</h1>
        <p className="anvera-description">Review customer wheel configurations and update engineering, manufacturing and delivery milestones.</p></div>
      <span className="anvera-status anvera-status--ready">ORDER WORKFLOW</span>
    </header>
    <section className="anvera-metrics">
      <article><span>TOTAL ORDERS</span><strong>{total}</strong></article>
      <article><span>LOADED RECORDS</span><strong>{items.length}</strong></article>
      <article><span>ACTIVE IN PROGRESS</span><strong>{items.filter(item => !["completed", "cancelled", "draft"].includes(item.status)).length}</strong></article>
    </section>
    {error ? <p className="anvera-inline-message" role="alert">{error}</p> : null}
    <section className="anvera-panel">
      <div className="anvera-panel-heading"><h2>Customer configurations</h2><button className="anvera-refresh" type="button" onClick={() => void load()} disabled={loading}>Refresh</button></div>
      <div className="anvera-toolbar">
        <input aria-label="Search orders" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search reference, customer, vehicle…" />
        <div className="anvera-filter-list">{["", "submitted", "custom_review", "quoted", "confirmed", "in_production", "in_transit", "completed"].map(value =>
          <button key={value || "all"} type="button" className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{value ? labels[value] : "All"}</button>)}</div>
      </div>
      {loading ? <div className="anvera-empty"><h3>Loading configuration orders</h3><p>Connecting to the secure order database.</p></div> : items.length ? <div className="anvera-table-wrap">
        <table className="anvera-data-table"><thead><tr><th>REFERENCE</th><th>CUSTOMER</th><th>VEHICLE</th><th>SPEC PATH</th><th>STATUS</th><th>SUBMITTED</th></tr></thead>
          <tbody>{items.map(item => <tr key={item.id} className={selected?.id === item.id ? "anvera-row-selected" : ""}>
            <td><button className="anvera-link-button" type="button" onClick={() => void open(item.id)}>{item.reference_code}</button></td>
            <td><strong>{item.customer_name || "Draft"}</strong><small>{item.email || "—"}</small></td>
            <td>{[item.vehicle_make, item.vehicle_model, item.vehicle_year].filter(Boolean).join(" ") || "—"}</td>
            <td>{item.specification_path || "—"}</td><td><span className="anvera-record-status">{labels[item.status] ?? item.status}</span></td>
            <td>{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : "Draft"}</td>
          </tr>)}</tbody></table></div> : <div className="anvera-empty"><h3>No configuration orders yet</h3><p>Customer submissions will appear here.</p></div>}
    </section>
    {selected ? <section className="anvera-panel anvera-order-detail">
      <div className="anvera-panel-heading"><div><p className="anvera-eyebrow">{selected.reference_code}</p><h2>{labels[selected.status] ?? selected.status}</h2></div><span className="anvera-record-status">{selected.status}</span></div>
      <div className="anvera-order-grid">
        <div><span>CUSTOMER</span><strong>{selected.customer_name || "—"}</strong><small>{selected.email || "—"}</small><small>{selected.phone || "—"}</small></div>
        <div><span>VEHICLE</span><strong>{[selected.vehicle_make, selected.vehicle_model, selected.vehicle_year].filter(Boolean).join(" ") || "—"}</strong><small>{selected.country || "—"}</small></div>
        <div><span>WHEEL DESIGN</span><strong>{selected.selected_model || "—"}</strong><small>{selected.specification_path || "—"}</small></div>
        <div><span>DELIVERY</span><strong>{selected.delivery_term || "—"}</strong><small>{selected.shipping_method || "—"}</small></div>
      </div>
      <details className="anvera-order-config"><summary>Full configuration record</summary><pre>{JSON.stringify(selected.configuration ?? {}, null, 2)}</pre></details>
      <div className="anvera-status-update"><h3>Update customer-visible progress</h3>
        <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Optional update note for the order timeline…" rows={3} />
        <div className="anvera-action-row">{next.map(status => <button key={status} className="anvera-action-button" type="button" disabled={saving} onClick={() => void changeStatus(status)}>{labels[status]}</button>)}</div>
      </div>
      <div className="anvera-order-timeline"><h3>Order history</h3>{events.length ? events.map(event => {
        let detail: any = {}; try { detail = JSON.parse(event.event_json || "{}"); } catch {}
        return <article key={event.id}><b>{event.event_type === "status_changed" ? (labels[detail.to] ?? detail.to) : event.event_type.replaceAll("_", " ")}</b>
          <small>{new Date(event.created_at).toLocaleString()} · {event.actor}</small>{detail.note ? <p>{detail.note}</p> : null}</article>;
      }) : <p>No order events yet.</p>}</div>
    </section> : null}
  </main>;
}
