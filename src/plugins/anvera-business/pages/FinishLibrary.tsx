import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

type FinishProfile = {
  id: string; code: string; name: string; finish_type: string;
  process_description: string | null; appearance_reference: string | null;
  supported_constructions_json: string; restrictions: string | null;
  evidence_ref: string | null; status: string; revision: number;
};
type FinishCatalog = { available: boolean; reason?: string; finishes?: FinishProfile[] };
type FinishOption = { id: string; code: string; name: string; finish_type: string; supported_constructions: string[] };
type FinishForm = {
  id?: string; revision?: number; code: string; name: string; finishType: string;
  processDescription: string; appearanceReference: string; supportedConstructions: string[];
  restrictions: string; evidenceRef: string;
};
type SaveResponse = { saved: boolean; id?: string; revision?: number; reason?: string };
const blankForm = (): FinishForm => ({
  code: "", name: "", finishType: "Paint / coating", processDescription: "",
  appearanceReference: "", supportedConstructions: [], restrictions: "", evidenceRef: ""
});

function Field({ label, value, onChange, placeholder, multiline = false }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return <label className={`api-library-field ${multiline ? "api-library-field--wide" : ""}`}>
    <span>{label}</span>
    {multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} /> :
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}
  </label>;
}

export function FinishLibrary({ onCatalogChange }: {
  onCatalogChange?: (finishes: FinishOption[] | null) => void;
}) {
  const [items, setItems] = useState<FinishProfile[]>([]);
  const [form, setForm] = useState<FinishForm>(blankForm);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/product-library/list");
      const result = await parseApiResponse<FinishCatalog>(response, "Unable to load finish profiles.");
      if (!result.available) {
        setItems([]);
        onCatalogChange?.(null);
        setError(result.reason === "migration_pending" ? "The Finish Library schema is installed in Preview only in this phase." : "The Finish Library is unavailable.");
        return;
      }
      const finishes = result.finishes ?? [];
      setItems(finishes);
      onCatalogChange?.(finishes.filter((item) => item.status === "approved").flatMap((item) => {
        let supported: string[] = [];
        try { supported = JSON.parse(item.supported_constructions_json) as string[]; } catch { supported = []; }
        return [{ id: item.id, code: item.code, name: item.name, finish_type: item.finish_type, supported_constructions: supported }];
      }));
    } catch (cause) {
      onCatalogChange?.(null);
      setError(cause instanceof Error ? cause.message : "Unable to load finish profiles.");
    } finally { setLoading(false); }
  }, [onCatalogChange]);

  useEffect(() => { void load(); }, [load]);

  const save = async (status: "draft" | "pending_review") => {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/product-library/finish/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status })
      });
      const result = await parseApiResponse<SaveResponse>(response, "Unable to save finish profile.");
      if (!result.saved) throw new Error(result.reason === "duplicate_code" ? "This finish code already exists." : result.reason ?? "Finish profile was not saved.");
      setForm(blankForm()); setEditing(false);
      setNotice(status === "pending_review" ? "Finish profile submitted for engineering review." : "Finish profile saved as draft.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save finish profile.");
    } finally { setSaving(false); }
  };

  const edit = (item: FinishProfile) => {
    if (!["draft", "pending_review"].includes(item.status)) return;
    let supported: string[] = [];
    try { supported = JSON.parse(item.supported_constructions_json) as string[]; } catch { supported = []; }
    setForm({
      id: item.id, revision: item.revision, code: item.code, name: item.name, finishType: item.finish_type,
      processDescription: item.process_description ?? "", appearanceReference: item.appearance_reference ?? "",
      supportedConstructions: supported, restrictions: item.restrictions ?? "", evidenceRef: item.evidence_ref ?? ""
    });
    setEditing(true);
  };

  const toggleConstruction = (construction: string) => setForm((current) => ({
    ...current,
    supportedConstructions: current.supportedConstructions.includes(construction)
      ? current.supportedConstructions.filter((value) => value !== construction)
      : [...current.supportedConstructions, construction]
  }));

  return <section className="api-library">
    <div className="api-library-heading">
      <div><p className="anvera-eyebrow">CONTROLLED SURFACE DATA</p><h3>Finish Library</h3><p>Define finishes by process, appearance reference, supported wheel construction and documented restrictions. Only approved finishes can be mapped to products.</p></div>
      <button className="anvera-refresh anvera-refresh--light" type="button" onClick={() => void load()} disabled={loading}>Refresh finishes</button>
    </div>
    {error ? <p className="anvera-inline-message" role="alert">{error}</p> : null}
    {notice ? <p className="api-success-message" role="status">{notice}</p> : null}
    {editing ? <div className="api-library-editor">
      <div className="api-library-form-grid">
        <Field label="Finish code" value={form.code} onChange={(value) => setForm((current) => ({ ...current, code: value }))} placeholder="e.g. FIN-BLK-SAT" />
        <Field label="Display name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Satin black" />
        <Field label="Finish type" value={form.finishType} onChange={(value) => setForm((current) => ({ ...current, finishType: value }))} placeholder="Paint / coating / polish / PVD" />
        <Field label="Appearance reference" value={form.appearanceReference} onChange={(value) => setForm((current) => ({ ...current, appearanceReference: value }))} placeholder="Internal sample ID or approved image reference" />
        <Field label="Process description" value={form.processDescription} onChange={(value) => setForm((current) => ({ ...current, processDescription: value }))} placeholder="Preparation, coating, curing and inspection process" multiline />
        <Field label="Restrictions" value={form.restrictions} onChange={(value) => setForm((current) => ({ ...current, restrictions: value }))} placeholder="Construction, substrate, size or usage limitations" multiline />
        <Field label="Evidence reference" value={form.evidenceRef} onChange={(value) => setForm((current) => ({ ...current, evidenceRef: value }))} placeholder="Process spec, sample approval or inspection record" />
      </div>
      <div className="api-library-construction-picker"><span>SUPPORTED CONSTRUCTIONS</span><div>{["Monoblock", "Two-piece", "Three-piece"].map((value) => <button type="button" key={value} className={form.supportedConstructions.includes(value) ? "is-active" : ""} onClick={() => toggleConstruction(value)}>{value}</button>)}</div></div>
      <div className="api-library-actions">
        <button type="button" className="anvera-action-button anvera-action-button--quiet" onClick={() => { setEditing(false); setForm(blankForm()); }}>Cancel</button>
        <button type="button" className="anvera-action-button anvera-action-button--quiet" disabled={saving || !form.code.trim() || !form.name.trim() || !form.finishType.trim() || !form.supportedConstructions.length} onClick={() => void save("draft")}>Save draft</button>
        <button type="button" className="anvera-action-button" disabled={saving || !form.code.trim() || !form.name.trim() || !form.finishType.trim() || !form.supportedConstructions.length} onClick={() => void save("pending_review")}>{saving ? "Saving…" : "Submit for review"}</button>
      </div>
    </div> : <div className="api-library-actions"><button type="button" className="anvera-action-button" onClick={() => { setForm(blankForm()); setEditing(true); }}>＋ Add finish profile</button></div>}
    <div className="api-library-list">
      {loading ? <p className="anvera-muted">Loading finish profiles…</p> : items.length ? items.map((item) => {
        let supported: string[] = [];
        try { supported = JSON.parse(item.supported_constructions_json) as string[]; } catch { supported = []; }
        return <article key={item.id}>
          <div><strong>{item.code} · {item.name}</strong><span>{item.finish_type} · {supported.join(" / ")}</span><small>{item.restrictions || item.process_description || "No additional restrictions recorded."}</small></div>
          <div className="api-library-row-actions"><em className={`api-library-status api-library-status--${item.status}`}>{item.status.replaceAll("_", " ")}</em><button type="button" disabled={!["draft", "pending_review"].includes(item.status)} onClick={() => edit(item)}>Edit</button></div>
        </article>;
      }) : <p className="anvera-muted">No finish profiles have been created.</p>}
    </div>
  </section>;
}

export function ProductFinishMapping({ finishes, construction, selected, onChange }: {
  finishes: FinishOption[] | null; construction: string; selected: string[]; onChange: (next: string[]) => void;
}) {
  const compatible = useMemo(() => (finishes ?? []).filter((item) => item.supported_constructions.includes(construction)), [finishes, construction]);
  const selectedLabels = new Map((finishes ?? []).map((item) => [item.id, item.code + " · " + item.name]));
  const incompatible = selected.filter((id) => !compatible.some((item) => item.id === id));
  return <section className="api-product-finish-mapping">
    <div><p className="anvera-eyebrow">PRODUCT FINISH MAPPING</p><h3>Approved finish options</h3><p>Choose only approved finish profiles compatible with this product's construction. Product mappings remain pending engineering review.</p></div>
    {finishes === null ? <p className="anvera-muted">Finish library is not installed in this environment. Finish mapping will be available after the Preview schema is applied.</p> :
      compatible.length ? <div className="api-product-finish-options">{compatible.map((item) => <button key={item.id} type="button" className={selected.includes(item.id) ? "is-active" : ""} aria-pressed={selected.includes(item.id)} onClick={() => onChange(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])}><span>{selected.includes(item.id) ? "✓" : "+"}</span><strong>{item.code}</strong><small>{item.name} · {item.finish_type}</small></button>)}</div> :
      <p className="anvera-muted">No approved finish profiles support the selected construction yet.</p>}
    {incompatible.length ? <p className="anvera-inline-message" role="alert">Some selected finishes do not support {construction}: {incompatible.map((id) => selectedLabels.get(id) ?? id).join(", ")}. Remove them before continuing.</p> : null}
    <p className="anvera-muted">{selected.length} finish profile(s) selected. Each new product mapping requires engineering review.</p>
  </section>;
}
