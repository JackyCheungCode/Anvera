import React, { useCallback, useEffect, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

type MaterialProfile = {
  id: string; code: string; name: string; family: string; grade: string;
  standard: string | null; supplier: string | null; certificate_ref: string | null;
  evidence_note: string | null; status: string; revision: number;
};
type ForgingProcess = {
  id: string; code: string; name: string; process_type: string;
  equipment: string | null; capacity_notes: string | null; heat_treatment: string | null;
  cnc_capability: string | null; evidence_ref: string | null; status: string; revision: number;
};
type LibraryResponse = { available: boolean; reason?: string; materials?: MaterialProfile[]; forgingProcesses?: ForgingProcess[] };
type SaveResponse = { saved: boolean; id?: string; revision?: number; reason?: string };
type MaterialForm = {
  id?: string; revision?: number; code: string; name: string; family: string; grade: string;
  standard: string; supplier: string; certificateRef: string; evidenceNote: string; status: string;
};
type ForgingForm = {
  id?: string; revision?: number; code: string; name: string; processType: string;
  equipment: string; capacityNotes: string; heatTreatment: string; cncCapability: string;
  evidenceRef: string; status: string;
};

const blankMaterial = (): MaterialForm => ({
  code: "", name: "", family: "Aluminium alloy", grade: "", standard: "",
  supplier: "", certificateRef: "", evidenceNote: "", status: "draft"
});
const blankForging = (): ForgingForm => ({
  code: "", name: "", processType: "Closed-die forging", equipment: "",
  capacityNotes: "", heatTreatment: "", cncCapability: "", evidenceRef: "", status: "draft"
});

function LibraryField({ label, value, onChange, placeholder, multiline = false }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return <label className={`api-library-field ${multiline ? "api-library-field--wide" : ""}`}>
    <span>{label}</span>
    {multiline
      ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} />
      : <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}
  </label>;
}

function StatusControl({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="api-library-status-control" role="group" aria-label="Record status">
    <button type="button" className={value === "draft" ? "is-active" : ""} onClick={() => onChange("draft")}>Draft</button>
    <button type="button" className={value === "pending_review" ? "is-active" : ""} onClick={() => onChange("pending_review")}>Submit for review</button>
  </div>;
}

export function MaterialProcessLibrary({ onCatalogChange }: {
  onCatalogChange?: (materials: Array<{ id: string; code: string; name: string; grade: string; family: string }> | null, processes: Array<{ id: string; code: string; name: string; process_type: string }> | null) => void;
}) {
  const [materials, setMaterials] = useState<MaterialProfile[]>([]);
  const [processes, setProcesses] = useState<ForgingProcess[]>([]);
  const [materialForm, setMaterialForm] = useState<MaterialForm>(blankMaterial);
  const [forgingForm, setForgingForm] = useState<ForgingForm>(blankForging);
  const [materialEditorOpen, setMaterialEditorOpen] = useState(false);
  const [forgingEditorOpen, setForgingEditorOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/product-library/list");
      const result = await parseApiResponse<LibraryResponse>(response, "Unable to load material and forging libraries.");
      setAvailable(result.available);
      if (!result.available) {
        onCatalogChange?.(null, null);
        setMaterials([]);
        setProcesses([]);
        setError(result.reason === "migration_pending"
          ? "The normalized library tables are not installed in this environment yet. Existing global setup fields remain available."
          : "The material and forging libraries are unavailable.");
        return;
      }
      const nextMaterials = result.materials ?? [];
      const nextProcesses = result.forgingProcesses ?? [];
      setMaterials(nextMaterials);
      setProcesses(nextProcesses);
      onCatalogChange?.(nextMaterials.filter((item) => item.status === "approved").map(({ id, code, name, grade, family }) => ({ id, code, name, grade, family })), nextProcesses.filter((item) => item.status === "approved").map(({ id, code, name, process_type }) => ({ id, code, name, process_type })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load material and forging libraries.");
    } finally {
      setLoading(false);
    }
  }, [onCatalogChange]);

  useEffect(() => { void load(); }, [load]);

  const saveMaterial = async (status: "draft" | "pending_review") => {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/product-library/material/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...materialForm, status })
      });
      const result = await parseApiResponse<SaveResponse>(response, "Unable to save material profile.");
      if (!result.saved) throw new Error(result.reason === "duplicate_code" ? "This material code already exists." : result.reason ?? "Material profile was not saved.");
      setMaterialForm(blankMaterial()); setMaterialEditorOpen(false);
      setNotice(status === "pending_review" ? "Material profile submitted for engineering review." : "Material profile saved as draft.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save material profile.");
    } finally { setSaving(false); }
  };

  const saveForging = async (status: "draft" | "pending_review") => {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/product-library/forging/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...forgingForm, status })
      });
      const result = await parseApiResponse<SaveResponse>(response, "Unable to save forging process.");
      if (!result.saved) throw new Error(result.reason === "duplicate_code" ? "This process code already exists." : result.reason ?? "Forging process was not saved.");
      setForgingForm(blankForging()); setForgingEditorOpen(false);
      setNotice(status === "pending_review" ? "Forging process submitted for engineering review." : "Forging process saved as draft.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save forging process.");
    } finally { setSaving(false); }
  };

  const editMaterial = (item: MaterialProfile) => {
    if (!["draft", "pending_review"].includes(item.status)) return;
    setMaterialForm({
      id: item.id, revision: item.revision, code: item.code, name: item.name, family: item.family,
      grade: item.grade, standard: item.standard ?? "", supplier: item.supplier ?? "",
      certificateRef: item.certificate_ref ?? "", evidenceNote: item.evidence_note ?? "", status: item.status
    });
    setMaterialEditorOpen(true);
  };

  const editForging = (item: ForgingProcess) => {
    if (!["draft", "pending_review"].includes(item.status)) return;
    setForgingForm({
      id: item.id, revision: item.revision, code: item.code, name: item.name,
      processType: item.process_type, equipment: item.equipment ?? "",
      capacityNotes: item.capacity_notes ?? "", heatTreatment: item.heat_treatment ?? "",
      cncCapability: item.cnc_capability ?? "", evidenceRef: item.evidence_ref ?? "", status: item.status
    });
    setForgingEditorOpen(true);
  };

  return <section className="api-library">
    <div className="api-library-heading">
      <div><p className="anvera-eyebrow">CONTROLLED REFERENCE DATA</p><h3>Material & Forging Libraries</h3><p>Maintain reusable factory records here. Product selections are populated from these controlled lists; approval remains an engineering responsibility.</p></div>
      <button type="button" className="anvera-refresh anvera-refresh--light" onClick={() => void load()} disabled={loading}>Refresh libraries</button>
    </div>
    {error ? <p className="anvera-inline-message" role="alert">{error}</p> : null}
    {notice ? <p className="api-success-message" role="status">{notice}</p> : null}
    <div className="api-library-grid">
      <section className="api-library-card">
        <header><div><span className="anvera-eyebrow">01 / MATERIAL MASTER</span><h4>Material Profiles</h4><p>{materials.length} records</p></div><button type="button" className="api-add-product" onClick={() => { setMaterialForm(blankMaterial()); setMaterialEditorOpen(!materialEditorOpen); }}>＋ Add material</button></header>
        {materialEditorOpen ? <div className="api-library-editor">
          <div className="api-library-form-grid">
            <LibraryField label="Material code" value={materialForm.code} onChange={(value) => setMaterialForm((current) => ({ ...current, code: value }))} placeholder="MAT-6061-T6" />
            <LibraryField label="Display name" value={materialForm.name} onChange={(value) => setMaterialForm((current) => ({ ...current, name: value }))} placeholder="6061-T6 forged aluminium" />
            <LibraryField label="Material family" value={materialForm.family} onChange={(value) => setMaterialForm((current) => ({ ...current, family: value }))} placeholder="Aluminium alloy" />
            <LibraryField label="Exact grade" value={materialForm.grade} onChange={(value) => setMaterialForm((current) => ({ ...current, grade: value }))} placeholder="6061-T6" />
            <LibraryField label="Standard / revision" value={materialForm.standard} onChange={(value) => setMaterialForm((current) => ({ ...current, standard: value }))} placeholder="ASTM / EN / JIS and revision" />
            <LibraryField label="Supplier / source" value={materialForm.supplier} onChange={(value) => setMaterialForm((current) => ({ ...current, supplier: value }))} placeholder="Verified supplier or source" />
            <LibraryField label="Certificate reference" value={materialForm.certificateRef} onChange={(value) => setMaterialForm((current) => ({ ...current, certificateRef: value }))} placeholder="Certificate or document ID" />
            <LibraryField label="Evidence notes" value={materialForm.evidenceNote} onChange={(value) => setMaterialForm((current) => ({ ...current, evidenceNote: value }))} placeholder="Evidence scope, test basis and limitations" multiline />
          </div>
          <StatusControl value={materialForm.status} onChange={(status) => setMaterialForm((current) => ({ ...current, status }))} />
          <div className="api-library-actions"><button type="button" className="anvera-action-button anvera-action-button--quiet" onClick={() => setMaterialEditorOpen(false)}>Cancel</button><button type="button" className="anvera-action-button anvera-action-button--quiet" disabled={saving} onClick={() => void saveMaterial("draft")}>Save draft</button><button type="button" className="anvera-action-button" disabled={saving} onClick={() => void saveMaterial("pending_review")}>Submit for review</button></div>
        </div> : null}
        <div className="api-library-list">
          {loading ? <p className="anvera-muted">Loading material records…</p> : materials.length ? materials.map((item) => <article key={item.id}>
            <div><strong>{item.code} · {item.name}</strong><span>{item.grade}{item.standard ? ` · ${item.standard}` : ""}</span><small>{item.family}{item.supplier ? ` · ${item.supplier}` : ""}</small></div>
            <div className="api-library-row-actions"><em className={`api-library-status api-library-status--${item.status}`}>{item.status.replaceAll("_", " ")}</em><button type="button" onClick={() => editMaterial(item)} disabled={!["draft", "pending_review"].includes(item.status)}>Edit</button></div>
          </article>) : <p className="anvera-muted">No material profiles recorded yet.</p>}
        </div>
      </section>
      <section className="api-library-card">
        <header><div><span className="anvera-eyebrow">02 / PROCESS MASTER</span><h4>Forging Processes</h4><p>{processes.length} records</p></div><button type="button" className="api-add-product" onClick={() => { setForgingForm(blankForging()); setForgingEditorOpen(!forgingEditorOpen); }}>＋ Add process</button></header>
        {forgingEditorOpen ? <div className="api-library-editor">
          <div className="api-library-form-grid">
            <LibraryField label="Process code" value={forgingForm.code} onChange={(value) => setForgingForm((current) => ({ ...current, code: value }))} placeholder="FRG-CLOSED-DIE" />
            <LibraryField label="Process name" value={forgingForm.name} onChange={(value) => setForgingForm((current) => ({ ...current, name: value }))} placeholder="Closed-die forging" />
            <LibraryField label="Process type" value={forgingForm.processType} onChange={(value) => setForgingForm((current) => ({ ...current, processType: value }))} placeholder="Closed-die forging" />
            <LibraryField label="Equipment / model" value={forgingForm.equipment} onChange={(value) => setForgingForm((current) => ({ ...current, equipment: value }))} placeholder="Press / equipment model" />
            <LibraryField label="Capacity / working range" value={forgingForm.capacityNotes} onChange={(value) => setForgingForm((current) => ({ ...current, capacityNotes: value }))} placeholder="Documented capacity and limits" multiline />
            <LibraryField label="Heat treatment" value={forgingForm.heatTreatment} onChange={(value) => setForgingForm((current) => ({ ...current, heatTreatment: value }))} placeholder="Process and condition" />
            <LibraryField label="CNC capability" value={forgingForm.cncCapability} onChange={(value) => setForgingForm((current) => ({ ...current, cncCapability: value }))} placeholder="Machine envelope, precision and constraints" multiline />
            <LibraryField label="Evidence reference" value={forgingForm.evidenceRef} onChange={(value) => setForgingForm((current) => ({ ...current, evidenceRef: value }))} placeholder="Equipment record / process document ID" />
          </div>
          <StatusControl value={forgingForm.status} onChange={(status) => setForgingForm((current) => ({ ...current, status }))} />
          <div className="api-library-actions"><button type="button" className="anvera-action-button anvera-action-button--quiet" onClick={() => setForgingEditorOpen(false)}>Cancel</button><button type="button" className="anvera-action-button anvera-action-button--quiet" disabled={saving} onClick={() => void saveForging("draft")}>Save draft</button><button type="button" className="anvera-action-button" disabled={saving} onClick={() => void saveForging("pending_review")}>Submit for review</button></div>
        </div> : null}
        <div className="api-library-list">
          {loading ? <p className="anvera-muted">Loading process records…</p> : processes.length ? processes.map((item) => <article key={item.id}>
            <div><strong>{item.code} · {item.name}</strong><span>{item.process_type}{item.equipment ? ` · ${item.equipment}` : ""}</span><small>{item.capacity_notes || item.heat_treatment || "Process scope not yet documented"}</small></div>
            <div className="api-library-row-actions"><em className={`api-library-status api-library-status--${item.status}`}>{item.status.replaceAll("_", " ")}</em><button type="button" onClick={() => editForging(item)} disabled={!["draft", "pending_review"].includes(item.status)}>Edit</button></div>
          </article>) : <p className="anvera-muted">No forging processes recorded yet.</p>}
        </div>
      </section>
    </div>
    {!available && !loading ? <p className="anvera-muted">The legacy text fields above remain usable until this library migration is applied to the environment.</p> : null}
  </section>;
}
