import React, { useCallback, useEffect, useState } from "react";
import { Button as CarbonButton, TextArea as CarbonTextArea } from "@carbon/react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

type ConstructionType = "Monoblock" | "Two-piece" | "Three-piece";
type Capability = {
  id: string; construction_type: ConstructionType; capability_scope: string | null;
  assembly_method: string | null; fastener_requirements: string | null;
  quality_processes: string | null; structural_limitations: string | null;
  evidence_ref: string | null; status: string; revision: number;
};
type LibraryResponse = { available: boolean; reason?: string; constructions?: Capability[] };
type SaveResponse = { saved: boolean; id?: string; revision?: number; reason?: string };
type FormState = {
  id?: string; revision?: number; constructionType: ConstructionType; capabilityScope: string;
  assemblyMethod: string; fastenerRequirements: string; qualityProcesses: string;
  structuralLimitations: string; evidenceRef: string;
};
const TYPES: ConstructionType[] = ["Monoblock", "Two-piece", "Three-piece"];
const blankForm = (constructionType: ConstructionType = "Monoblock"): FormState => ({
  constructionType, capabilityScope: "", assemblyMethod: "", fastenerRequirements: "",
  qualityProcesses: "", structuralLimitations: "", evidenceRef: ""
});

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string;
}) {
  return <div className="api-library-field api-library-field--wide">
    <CarbonTextArea id={`construction-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} labelText={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} />
  </div>;
}

export function ConstructionCapabilityMatrix({ onCatalogChange }: {
  onCatalogChange?: (constructions: ConstructionType[] | null) => void;
}) {
  const [items, setItems] = useState<Capability[]>([]);
  const [form, setForm] = useState<FormState>(blankForm());
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/product-library/list");
      const result = await parseApiResponse<LibraryResponse>(response, "Unable to load construction capabilities.");
      if (!result.available) {
        setItems([]); onCatalogChange?.(null);
        setError(result.reason === "migration_pending" ? "The structured construction matrix is installed in Preview only in this phase." : "Construction capabilities are unavailable.");
        return;
      }
      const rows = result.constructions ?? [];
      setItems(rows);
      onCatalogChange?.(rows.filter((item) => item.status === "approved").map((item) => item.construction_type));
    } catch (cause) {
      onCatalogChange?.(null);
      setError(cause instanceof Error ? cause.message : "Unable to load construction capabilities.");
    } finally { setLoading(false); }
  }, [onCatalogChange]);

  useEffect(() => { void load(); }, [load]);

  const save = async (status: "draft" | "pending_review") => {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/product-library/construction/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status })
      });
      const result = await parseApiResponse<SaveResponse>(response, "Unable to save construction capability.");
      if (!result.saved) throw new Error(result.reason === "construction_already_exists" ? "A capability record for this construction already exists." : result.reason === "engineering_evidence_required" ? "Add capability scope, quality processes and evidence. Two-piece and Three-piece also require assembly and fastener requirements." : result.reason ?? "Capability record was not saved.");
      setEditing(false);
      setNotice(status === "pending_review" ? "Construction capability submitted for engineering review." : "Construction capability saved as draft.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save construction capability.");
    } finally { setSaving(false); }
  };

  const edit = (item: Capability) => {
    if (!["draft", "pending_review"].includes(item.status)) return;
    setForm({
      id: item.id, revision: item.revision, constructionType: item.construction_type,
      capabilityScope: item.capability_scope ?? "", assemblyMethod: item.assembly_method ?? "",
      fastenerRequirements: item.fastener_requirements ?? "", qualityProcesses: item.quality_processes ?? "",
      structuralLimitations: item.structural_limitations ?? "", evidenceRef: item.evidence_ref ?? ""
    });
    setEditing(true);
  };

  const existingTypes = new Set(items.map((item) => item.construction_type));
  const newTypes = TYPES.filter((type) => !existingTypes.has(type));
  const reviewReady = Boolean(form.capabilityScope.trim() && form.qualityProcesses.trim() && form.evidenceRef.trim() && (!["Two-piece", "Three-piece"].includes(form.constructionType) || (form.assemblyMethod.trim() && form.fastenerRequirements.trim())));

  return <section className="api-library">
    <div className="api-library-heading">
      <div><p className="anvera-eyebrow">FACTORY ARCHITECTURE CONTROL</p><h3>Construction Capability Matrix</h3><p>Record Monoblock, Two-piece and Three-piece as separate factory capabilities. Product construction options are restricted to approved capability records.</p></div>
      <CarbonButton kind="ghost" type="button" className="anvera-refresh anvera-refresh--light" onClick={() => void load()} disabled={loading}>Refresh matrix</CarbonButton>
    </div>
    {error ? <p className="anvera-inline-message" role="alert">{error}</p> : null}
    {notice ? <p className="api-success-message" role="status">{notice}</p> : null}
    {editing ? <div className="api-library-editor">
      <div className="api-library-form-grid">
        <div className="api-library-construction-picker"><span>CONSTRUCTION TYPE</span><div>{TYPES.map((type) => <CarbonButton kind="ghost" type="button" key={type} disabled={Boolean(form.id) || (existingTypes.has(type) && form.constructionType !== type)} className={form.constructionType === type ? "is-active" : ""} onClick={() => setForm((current) => ({ ...current, constructionType: type }))}>{type}</CarbonButton>)}</div></div>
        <Field label="Capability scope" value={form.capabilityScope} onChange={(value) => setForm((current) => ({ ...current, capabilityScope: value }))} placeholder="Supported product scope, size limits and ownership" />
        <Field label="Assembly method" value={form.assemblyMethod} onChange={(value) => setForm((current) => ({ ...current, assemblyMethod: value }))} placeholder="Required assembly steps, joining and inspection" />
        <Field label="Fastener requirements" value={form.fastenerRequirements} onChange={(value) => setForm((current) => ({ ...current, fastenerRequirements: value }))} placeholder="Fastener grade, size, torque source and traceability" />
        <Field label="Quality processes" value={form.qualityProcesses} onChange={(value) => setForm((current) => ({ ...current, qualityProcesses: value }))} placeholder="Inspection gates, dimensional checks and testing" />
        <Field label="Structural limitations" value={form.structuralLimitations} onChange={(value) => setForm((current) => ({ ...current, structuralLimitations: value }))} placeholder="Load, diameter, width, geometry or design constraints" />
        <Field label="Evidence reference" value={form.evidenceRef} onChange={(value) => setForm((current) => ({ ...current, evidenceRef: value }))} placeholder="Work instruction, equipment list, test report or drawing reference" />
      </div>
      <div className="api-library-actions">
        <CarbonButton kind="ghost" type="button" className="anvera-action-button anvera-action-button--quiet" onClick={() => setEditing(false)}>Cancel</CarbonButton>
        <CarbonButton kind="ghost" type="button" className="anvera-action-button anvera-action-button--quiet" disabled={saving} onClick={() => void save("draft")}>Save draft</CarbonButton>
        <CarbonButton kind="ghost" type="button" className="anvera-action-button" disabled={saving || !reviewReady} onClick={() => void save("pending_review")}>{saving ? "Saving…" : "Submit for review"}</CarbonButton>
      </div>
    </div> : <div className="api-library-actions"><CarbonButton kind="ghost" type="button" className="anvera-action-button" disabled={!newTypes.length} onClick={() => { setForm(blankForm(newTypes[0])); setEditing(true); }}>＋ Add construction capability</CarbonButton></div>}
    <div className="api-library-list">
      {loading ? <p className="anvera-muted">Loading construction matrix…</p> : items.length ? items.map((item) => <article key={item.id}>
        <div><strong>{item.construction_type}</strong><span>{item.capability_scope || "Capability scope not documented"}</span><small>{item.structural_limitations || item.assembly_method || "No limitations recorded."}</small></div>
        <div className="api-library-row-actions"><em className={`api-library-status api-library-status--${item.status}`}>{item.status.replaceAll("_", " ")}</em><CarbonButton kind="ghost" type="button" disabled={!["draft", "pending_review"].includes(item.status)} onClick={() => edit(item)}>Edit</CarbonButton></div>
      </article>) : <p className="anvera-muted">No construction capability records have been created.</p>}
    </div>
  </section>;
}
