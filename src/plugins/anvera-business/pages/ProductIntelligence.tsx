import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

type FieldType = "text" | "number" | "textarea" | "select";
type FieldDefinition = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  help?: string;
};
type StepDefinition = {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  eyebrow: string;
  fields: FieldDefinition[];
  optional?: boolean;
};

type SpecificationRow = { id: string; role: string; diameter: string; width: string; boltCount: string; pcd: string; offset: string; centerBore: string; loadRating: string; status: string };
type ProductProfile = { [key: string]: string | SpecificationRow[] | undefined; specifications?: SpecificationRow[] };

type SetupDocument = {
  factory: Record<string, string>;
  material: Record<string, string>;
  construction: Record<string, string>;
  specification: Record<string, string>;
  finish: Record<string, string>;
  products: ProductProfile[];
  fitment: Record<string, string>;
  media: Record<string, string>;
  review: Record<string, string>;
};

type SetupResponse = {
  available: boolean;
  reason?: string;
  session?: { id: string; status: string; revision: number; updated_at: string } | null;
  document?: SetupDocument;
  stepState?: Record<string, string>;
  events?: Array<{ id: string; event_type: string; revision: number; summary: string | null; created_at: string }>;
  versions?: Array<{ id: string; revision: number; version_type: string; note: string | null; created_at: string }>;
};

type SaveResponse = { saved: boolean; sessionId?: string; revision?: number; status?: string; reason?: string };

const emptyDocument = (): SetupDocument => ({
  factory: {}, material: {}, construction: {}, specification: {}, finish: {},
  products: [{ specifications: [] }], fitment: {}, media: {}, review: {}
});

const steps: StepDefinition[] = [
  {
    id: "factory", number: "01", title: "Factory Foundation", subtitle: "Factory identity and operational scope", eyebrow: "FOUNDATION",
    fields: [
      { key: "factoryName", label: "Factory name", required: true, placeholder: "ANVERA manufacturing facility" },
      { key: "factoryCode", label: "Factory code", required: true, placeholder: "ANV-FAC-001" },
      { key: "legalEntity", label: "Legal entity name", placeholder: "Registered legal entity" },
      { key: "country", label: "Country", required: true, placeholder: "Country / region" },
      { key: "city", label: "City / region", placeholder: "City" },
      { key: "website", label: "Website", placeholder: "https://" },
      { key: "productionType", label: "Production model", type: "select", options: ["In-house manufacturing", "Hybrid manufacturing", "Partner-supported manufacturing"] },
      { key: "productionScope", label: "Factory business scope", type: "textarea", placeholder: "List the manufacturing and service activities currently performed." }
    ]
  },
  {
    id: "material", number: "02", title: "Material & Forging", subtitle: "Approved materials and manufacturing processes", eyebrow: "MANUFACTURING",
    fields: [
      { key: "materialFamily", label: "Material family", type: "select", options: ["Aluminum alloy", "Other approved alloy", "Special material"] },
      { key: "materialGrade", label: "Material grade", required: true, placeholder: "Enter the exact documented grade" },
      { key: "materialStandard", label: "Material standard", placeholder: "Standard and revision" },
      { key: "materialSupplier", label: "Material supplier / source", placeholder: "Supplier or source" },
      { key: "materialCertificate", label: "Certificate reference", placeholder: "Document ID or secure file reference" },
      { key: "forgingMethod", label: "Forging method", required: true, type: "select", options: ["Rotary forging", "Closed-die forging", "Other documented process", "Under assessment"] },
      { key: "forgingEquipment", label: "Forging equipment", placeholder: "Equipment model / capacity" },
      { key: "heatTreatment", label: "Heat treatment", placeholder: "Process and condition" },
      { key: "cncCapability", label: "CNC machining capability", type: "textarea", placeholder: "Machines, working envelope, precision and known limitations." },
      { key: "processEvidence", label: "Process evidence", type: "textarea", placeholder: "Certificate, work instruction, inspection or equipment record references." }
    ]
  },
  {
    id: "construction", number: "03", title: "Construction & Engineering", subtitle: "Wheel architecture and engineering requirements", eyebrow: "ENGINEERING",
    fields: [
      { key: "constructionTypes", label: "Supported constructions", required: true, type: "textarea", placeholder: "One construction per line: Monoblock, Two-piece, Three-piece. Include only approved factory capabilities." },
      { key: "constructionNotes", label: "Construction capability details", type: "textarea", placeholder: "Document supported structures, process ownership and limitations." },
      { key: "assemblyMethod", label: "Assembly method", placeholder: "Required for multi-piece products where applicable" },
      { key: "fastenerRequirements", label: "Fastener requirements", placeholder: "Material, grade, size and torque evidence where applicable" },
      { key: "qualityProcesses", label: "Quality inspection processes", type: "textarea", placeholder: "Inspection stages, equipment and responsible function." },
      { key: "testingStandards", label: "Applicable test standards", type: "textarea", placeholder: "List only standards confirmed by engineering." },
      { key: "structuralLimitations", label: "Structural limitations", type: "textarea", placeholder: "Known design, load, size or manufacturing constraints." }
    ]
  },
  {
    id: "specification", number: "04", title: "Specification System", subtitle: "Parameter dictionary and supported combinations", eyebrow: "TECHNICAL DATA",
    fields: [
      { key: "diameterRange", label: "Supported diameter range", required: true, placeholder: "e.g. 18–24 in (confirm actual range)" },
      { key: "widthRange", label: "Supported width range", required: true, placeholder: "e.g. 8.0–13.0 in (confirm actual range)" },
      { key: "boltPatterns", label: "Supported bolt patterns / PCD", required: true, type: "textarea", placeholder: "One pattern per line. Store bolt count and PCD as separate values in approved records." },
      { key: "offsetRange", label: "Offset / ET range", placeholder: "Document by construction and diameter where required" },
      { key: "centerBoreRange", label: "Center bore range", placeholder: "mm; include machining and tolerance notes" },
      { key: "loadRating", label: "Load rating basis", placeholder: "kg; include source and test basis" },
      { key: "discProfiles", label: "Disc profiles", type: "textarea", placeholder: "List approved profiles and their constraints." },
      { key: "brakeClearance", label: "Brake clearance references", type: "textarea", placeholder: "Drawing, template or test reference; do not infer clearance." },
      { key: "specificationNotes", label: "Specification constraints", type: "textarea", placeholder: "Allowed combinations, prohibited combinations and engineering review rules." }
    ]
  },
  {
    id: "finish", number: "05", title: "Finish & Customization", subtitle: "Surface finishes and controlled custom options", eyebrow: "CONFIGURATION",
    optional: true,
    fields: [
      { key: "finishOptions", label: "Standard finish options", type: "textarea", placeholder: "One finish per line. Add only finishes with confirmed process capability." },
      { key: "surfaceProcesses", label: "Surface processes", type: "textarea", placeholder: "Preparation, coating, polishing, brushing and other documented processes." },
      { key: "customOptions", label: "Customization options", type: "textarea", placeholder: "Custom color, center cap, engraving, hardware, spoke design, bespoke requests." },
      { key: "finishRestrictions", label: "Finish restrictions", type: "textarea", placeholder: "Product, construction, material or process restrictions." },
      { key: "customReviewRules", label: "Approval rules", type: "textarea", placeholder: "Which options are standard, limited or require engineering review?" }
    ]
  },
  {
    id: "products", number: "06", title: "Product Definition", subtitle: "Create product identities using approved capabilities", eyebrow: "PRODUCT MASTER",
    fields: [
      { key: "productCode", label: "Product code", required: true, placeholder: "AV01" },
      { key: "productName", label: "Product name", required: true, placeholder: "VECTOR" },
      { key: "series", label: "Product series", placeholder: "Series name" },
      { key: "construction", label: "Construction", required: true, type: "select", options: ["Monoblock", "Two-piece", "Three-piece"] },
      { key: "designStyle", label: "Design style", placeholder: "e.g. Performance / Luxury / Motorsport" },
      { key: "spokeCount", label: "Spoke count", type: "number", placeholder: "e.g. 10" },
      { key: "faceProfile", label: "Face / concavity profile", placeholder: "Documented design profile" },
      { key: "materialProfile", label: "Material profile reference", required: true, type: "select", options: [] },
      { key: "forgingProfile", label: "Manufacturing profile reference", required: true, type: "select", options: [] },
      { key: "intendedUse", label: "Intended use", type: "select", options: ["Street", "Performance", "Luxury", "Track — evidence required", "Off-road — evidence required", "Show / Custom"] },
      { key: "productDescription", label: "Product description", type: "textarea", placeholder: "Product identity and design language." },
      { key: "designRevision", label: "Design revision", placeholder: "e.g. Rev A" }
    ]
  },
  {
    id: "fitment", number: "07", title: "Vehicle Fitment Validation", subtitle: "Vehicle applications and engineering evidence", eyebrow: "APPLICATION",
    optional: true,
    fields: [
      { key: "vehicleMake", label: "Vehicle make", placeholder: "Manufacturer" },
      { key: "vehicleModel", label: "Vehicle model", placeholder: "Model" },
      { key: "vehicleYear", label: "Model year", type: "number", placeholder: "YYYY" },
      { key: "vehicleVariant", label: "Variant / trim / brake package", placeholder: "Exact configuration" },
      { key: "fitmentStatus", label: "Review status", type: "select", options: ["Unverified", "Engineering Review", "Verified", "Not Compatible"] },
      { key: "fitmentEvidence", label: "Evidence references", type: "textarea", placeholder: "Test report, engineering drawing, measured installation or trusted source." },
      { key: "fitmentNotes", label: "Engineering notes", type: "textarea", placeholder: "Clearance, suspension, tire and installation constraints." }
    ]
  },
  {
    id: "media", number: "08", title: "Media & Content", subtitle: "Product imagery, rights and editorial content", eyebrow: "CONTENT",
    optional: true,
    fields: [
      { key: "heroMediaReference", label: "Hero image reference", placeholder: "R2 object key or approved media record ID" },
      { key: "galleryReferences", label: "Gallery media references", type: "textarea", placeholder: "One approved media record or object reference per line." },
      { key: "mediaRights", label: "Usage rights", type: "select", options: ["Owned by ANVERA", "Licensed for ANVERA use", "Customer permission recorded", "Internal reference only", "Pending confirmation"] },
      { key: "productStory", label: "Product story", type: "textarea", placeholder: "Approved product story for the public website." },
      { key: "technicalContent", label: "Technical content", type: "textarea", placeholder: "Approved public-facing technical notes." },
      { key: "galleryProjectReferences", label: "Verified installation references", type: "textarea", placeholder: "Only link real installations with documented usage permission." }
    ]
  },
  {
    id: "review", number: "09", title: "Final Review & Activation", subtitle: "Validation, evidence and controlled release", eyebrow: "GOVERNANCE",
    fields: [
      { key: "reviewNotes", label: "Review notes", type: "textarea", placeholder: "Summarize open issues, exceptions and approval conditions." },
      { key: "changeSummary", label: "Change summary", type: "textarea", placeholder: "What changed in this global setup revision?" }
    ]
  }
];

function getPath(document: SetupDocument, stepId: string, key: string, productIndex: number) {
  if (stepId === "products") {
    const value = document.products?.[productIndex]?.[key];
    return typeof value === "string" ? value : "";
  }
  return (document[stepId as keyof SetupDocument] as Record<string, string> | undefined)?.[key] ?? "";
}

function setValue(document: SetupDocument, stepId: string, key: string, value: string, productIndex: number): SetupDocument {
  if (stepId === "products") {
    const products = [...(document.products ?? [{ specifications: [] }])];
    products[productIndex] = { ...(products[productIndex] ?? { specifications: [] }), [key]: value };
    return { ...document, products };
  }
  return { ...document, [stepId]: { ...(document[stepId as keyof SetupDocument] as Record<string, string> ?? {}), [key]: value } };
}

function updateSpecification(document: SetupDocument, productIndex: number, rowId: string, key: keyof SpecificationRow, value: string) {
  const products = [...document.products];
  const product = { ...(products[productIndex] ?? { specifications: [] }) };
  const specifications = [...(product.specifications ?? [])];
  const rowIndex = specifications.findIndex((row) => row.id === rowId);
  if (rowIndex < 0) return document;
  specifications[rowIndex] = { ...specifications[rowIndex], [key]: value };
  products[productIndex] = { ...product, specifications };
  return { ...document, products };
}

function addSpecification(document: SetupDocument, productIndex: number) {
  const products = [...document.products];
  const product = { ...(products[productIndex] ?? { specifications: [] }) };
  const specifications = [...(product.specifications ?? []), {
    id: crypto.randomUUID(), role: "Front", diameter: "", width: "", boltCount: "", pcd: "",
    offset: "", centerBore: "", loadRating: "", status: "Draft"
  }];
  products[productIndex] = { ...product, specifications };
  return { ...document, products };
}

function removeSpecification(document: SetupDocument, productIndex: number, rowId: string) {
  const products = [...document.products];
  const product = { ...(products[productIndex] ?? { specifications: [] }) };
  products[productIndex] = { ...product, specifications: (product.specifications ?? []).filter((row) => row.id !== rowId) };
  return { ...document, products };
}

function specificationIsComplete(row: SpecificationRow) {
  return ["role", "diameter", "width", "boltCount", "pcd", "offset", "centerBore", "status"].every((key) =>
    String(row[key as keyof SpecificationRow] ?? "").trim().length > 0
  );
}

function validateStep(step: StepDefinition, document: SetupDocument, productIndex: number) {
  const missing = step.fields.filter((field) => field.required && !getPath(document, step.id, field.key, productIndex).trim());
  if (step.id === "products") {
    const rows = document.products?.[productIndex]?.specifications ?? [];
    if (!rows.length || !rows.every(specificationIsComplete)) missing.push({ key: "specifications", label: "Complete specification matrix rows", required: true });
  }
  return missing;
}

function isStepComplete(step: StepDefinition, document: SetupDocument, productIndex: number) {
  return validateStep(step, document, productIndex).length === 0;
}

function stepHasAnyValue(step: StepDefinition, document: SetupDocument, productIndex: number) {
  const fieldsHaveValues = step.fields.some((field) => getPath(document, step.id, field.key, productIndex).trim().length > 0);
  if (step.id === "products") return fieldsHaveValues || Boolean(document.products?.[productIndex]?.specifications?.length);
  return fieldsHaveValues;
}

function CustomSelect({ value, options, onChange, label }: { value: string; options: string[]; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="api-select">
      <button className="api-select-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{value || `Select ${label.toLowerCase()}`}</span><span className="api-select-chevron">⌄</span>
      </button>
      {open ? <div className="api-select-menu" role="listbox" aria-label={label}>
        {options.map((option) => <button key={option} type="button" role="option" aria-selected={value === option} className={value === option ? "is-selected" : ""} onClick={() => { onChange(option); setOpen(false); }}>{option}</button>)}
      </div> : null}
    </div>
  );
}

function Field({ field, value, onChange, error }: { field: FieldDefinition; value: string; onChange: (value: string) => void; error?: boolean }) {
  return (
    <label className={`api-field ${field.type === "textarea" ? "api-field--wide" : ""}`}>
      <span className="api-field-label">{field.label}{field.required ? <i>Required</i> : null}</span>
      {field.type === "select" ? <CustomSelect label={field.label} value={value} options={field.options ?? []} onChange={onChange} /> :
        field.type === "textarea" ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} rows={4} /> :
        <input type={field.type === "number" ? "number" : "text"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} aria-invalid={error || undefined} />}
      {field.help ? <small>{field.help}</small> : null}
      {error ? <small className="api-field-error">This field is required to complete this step.</small> : null}
    </label>
  );
}

export function ProductIntelligence() {
  const [document, setDocument] = useState<SetupDocument>(emptyDocument);
  const [revision, setRevision] = useState(0);
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState("draft");
  const [stepState, setStepState] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<SetupResponse["events"]>([]);
  const [versions, setVersions] = useState<SetupResponse["versions"]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [productIndex, setProductIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/product-setup/load");
      const result = await parseApiResponse<SetupResponse>(response, "Unable to load Product Intelligence setup.");
      setAvailable(result.available);
      if (!result.available) {
        setError(result.reason === "migration_pending"
          ? "Product Intelligence storage is not enabled in this environment yet. The isolated preview schema must be applied before drafts can be saved."
          : "The Product Intelligence workspace is unavailable.");
        return;
      }
      setDocument({ ...emptyDocument(), ...(result.document ?? {}) });
      setRevision(result.session?.revision ?? 0);
      setSessionId(result.session?.id ?? "");
      setStatus(result.session?.status ?? "draft");
      setStepState(result.stepState ?? {});
      setEvents(result.events ?? []);
      setVersions(result.versions ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load Product Intelligence setup.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const active = steps[activeStep];
  const missing = useMemo(() => validateStep(active, document, productIndex), [active, document, productIndex]);
  const completeCount = steps.filter((step) => step.id !== "review" && (step.optional ? stepHasAnyValue(step, document, productIndex) && isStepComplete(step, document, productIndex) : isStepComplete(step, document, productIndex))).length;

  const updateField = (key: string, value: string) => {
    setDocument((current) => setValue(current, active.id, key, value, productIndex));
    setNotice("");
  };

  const save = async (action: "draft" | "submit" = "draft") => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch("/_emdash/api/plugins/anvera-business/product-setup/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document, revision, sessionId, action, stepState })
      });
      const result = await parseApiResponse<SaveResponse>(response, "Unable to save Product Intelligence setup.");
      if (!result.saved) {
        if (result.reason === "revision_conflict") {
          throw new Error("This draft was updated in another session. Reload the latest revision before saving again.");
        }
        if (result.reason === "validation_failed") {
          throw new Error("The global setup is incomplete. Review the required fields and validation findings.");
        }
        throw new Error(result.reason ?? "The setup was not saved.");
      }
      if (result.sessionId) setSessionId(result.sessionId);
      setRevision(result.revision ?? revision + 1);
      setStatus(result.status ?? (action === "submit" ? "in_review" : "draft"));
      setNotice(action === "submit" ? "Submitted for internal review. A version snapshot has been recorded." : "Draft saved. Your changes are stored.");
      if (action === "submit") await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save Product Intelligence setup.");
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (missing.length && !active.optional) {
      setError(`Complete the required fields: ${missing.map((field) => field.label).join(", ")}.`);
      return;
    }
    setStepState((current) => ({ ...current, [active.id]: missing.length ? "pending" : "complete" }));
    setError("");
    setActiveStep((current) => Math.min(steps.length - 1, current + 1));
  };

  const addProduct = () => {
    setDocument((current) => ({ ...current, products: [...(current.products ?? []), { specifications: [] }] }));
    setProductIndex(document.products?.length ?? 0);
  };

  const finalReady = steps.filter((step) => !step.optional && step.id !== "review" && step.id !== "products").every((step) => isStepComplete(step, document, productIndex)) && (document.products ?? []).length > 0 && (document.products ?? []).every((product) => Boolean(typeof product.productCode === "string" && product.productCode.trim() && typeof product.productName === "string" && product.productName.trim() && typeof product.construction === "string" && product.construction.trim() && product.specifications?.length && product.specifications.every(specificationIsComplete)));

  return (
    <main className="anvera-workspace api-workspace">
      <header className="anvera-page-header api-page-header">
        <div>
          <p className="anvera-eyebrow">ANVERA PRODUCT INTELLIGENCE / GLOBAL SETUP</p>
          <h1>Global Configuration</h1>
          <p className="anvera-description">One governed workflow for factory capability, engineering data and product activation.</p>
        </div>
        <div className="api-header-actions">
          <span className={available ? "anvera-status anvera-status--ready" : "anvera-status"}>{available ? status.replaceAll("_", " ").toUpperCase() : "STORAGE NOT READY"}</span>
          <button className="anvera-refresh anvera-refresh--light" type="button" onClick={() => void load()} disabled={loading}>Refresh</button>
        </div>
      </header>

      <section className="api-overview">
        <article><span>CONFIGURATION STEPS</span><strong>09</strong></article>
        <article><span>COMPLETED STEPS</span><strong>{completeCount.toString().padStart(2, "0")}</strong></article>
        <article><span>PRODUCT PROFILES</span><strong>{document.products?.length ?? 0}</strong></article>
        <article><span>REVISION</span><strong>{revision ? `R${revision}` : "NEW"}</strong></article>
      </section>

      {error ? <p className="anvera-inline-message" role="alert">{error}</p> : null}
      {notice ? <p className="api-success-message" role="status">{notice}</p> : null}

      {loading ? <div className="anvera-panel"><div className="anvera-empty"><h3>Loading configuration</h3><p>Connecting to the secured Product Intelligence workspace.</p></div></div> : (
        <>
          <nav className="api-stepper" aria-label="Global setup steps">
            {steps.map((step, index) => {
              const complete = isStepComplete(step, document, productIndex) && step.id !== "review" && (!step.optional || stepHasAnyValue(step, document, productIndex));
              const current = index === activeStep;
              return <button key={step.id} type="button" className={`api-step ${current ? "is-current" : ""} ${complete ? "is-complete" : ""}`} onClick={() => { if (index <= activeStep || complete) { setActiveStep(index); setError(""); } }} aria-current={current ? "step" : undefined}>
                <span className="api-step-number">{complete ? "✓" : step.number}</span>
                <span className="api-step-copy"><strong>{step.title}</strong><small>{step.subtitle}</small></span>
              </button>;
            })}
          </nav>

          <section className="api-work-area">
            <div className="api-work-main">
              <div className="api-step-heading">
                <div><p className="anvera-eyebrow">STEP {active.number} / 09 · {active.eyebrow}</p><h2>{active.title}</h2><p>{active.subtitle}</p></div>
                <span className="api-step-counter">{String(activeStep + 1).padStart(2, "0")} <i>/ 09</i></span>
              </div>

              {active.id === "products" ? <div className="api-product-switcher">
                <div className="api-product-list">{(document.products ?? []).map((product, index) => <button key={index} type="button" className={productIndex === index ? "is-active" : ""} onClick={() => setProductIndex(index)}><span>{String(index + 1).padStart(2, "0")}</span>{product.productCode || product.productName || "Untitled product"}</button>)}</div>
                <button className="api-add-product" type="button" onClick={addProduct}>＋ Add product profile</button>
              </div> : null}

              <div className="api-field-grid">
                {active.fields.map((field) => {
                  let resolvedField = field;
                  if (active.id === "products" && field.key === "construction") {
                    const supported = (document.construction.constructionTypes ?? "").split(/[\n,;]+/).map((value) => value.trim()).filter((value) => ["Monoblock", "Two-piece", "Three-piece"].includes(value));
                    resolvedField = { ...field, options: supported };
                  }
                  if (active.id === "products" && field.key === "materialProfile") {
                    resolvedField = { ...field, options: (document.material.materialGrade ?? "").split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean) };
                  }
                  if (active.id === "products" && field.key === "forgingProfile") {
                    resolvedField = { ...field, options: (document.material.forgingMethod ?? "").split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean) };
                  }
                  return <Field key={field.key} field={resolvedField} value={getPath(document, active.id, field.key, productIndex)} onChange={(value) => updateField(field.key, value)} error={missing.some((item) => item.key === field.key)} />;
                })}
              </div>

              {active.id === "products" ? <section className="api-spec-editor">
                <div className="api-spec-heading"><div><p className="anvera-eyebrow">PRODUCT SPECIFICATIONS</p><h3>Specification Matrix</h3><p>Each row is a specific, reviewable wheel specification. Do not enter a range in place of a confirmed combination.</p></div><button className="api-add-product" type="button" onClick={() => setDocument((current) => addSpecification(current, productIndex))}>＋ Add specification</button></div>
                <div className="api-spec-table-wrap"><table className="api-spec-table">
                  <thead><tr><th>POSITION</th><th>DIAMETER</th><th>WIDTH</th><th>BOLT COUNT</th><th>PCD (MM)</th><th>OFFSET (MM)</th><th>CENTER BORE (MM)</th><th>LOAD (KG)</th><th>STATUS</th><th></th></tr></thead>
                  <tbody>{(document.products?.[productIndex]?.specifications ?? []).map((row) => <tr key={row.id}>
                    <td><CustomSelect label="Position" value={row.role} options={["Front", "Rear", "Front & Rear"]} onChange={(value) => setDocument((current) => updateSpecification(current, productIndex, row.id, "role", value))} /></td>
                    <td><input aria-label="Diameter in inches" type="number" min="1" step="0.5" value={row.diameter} onChange={(event) => setDocument((current) => updateSpecification(current, productIndex, row.id, "diameter", event.target.value))} /></td>
                    <td><input aria-label="Width in inches" type="number" min="1" step="0.5" value={row.width} onChange={(event) => setDocument((current) => updateSpecification(current, productIndex, row.id, "width", event.target.value))} /></td>
                    <td><input aria-label="Bolt count" type="number" min="1" step="1" value={row.boltCount} onChange={(event) => setDocument((current) => updateSpecification(current, productIndex, row.id, "boltCount", event.target.value))} /></td>
                    <td><input aria-label="PCD in millimeters" type="number" min="1" step="0.1" value={row.pcd} onChange={(event) => setDocument((current) => updateSpecification(current, productIndex, row.id, "pcd", event.target.value))} /></td>
                    <td><input aria-label="Offset in millimeters" type="number" step="0.5" value={row.offset} onChange={(event) => setDocument((current) => updateSpecification(current, productIndex, row.id, "offset", event.target.value))} /></td>
                    <td><input aria-label="Center bore in millimeters" type="number" min="1" step="0.1" value={row.centerBore} onChange={(event) => setDocument((current) => updateSpecification(current, productIndex, row.id, "centerBore", event.target.value))} /></td>
                    <td><input aria-label="Load rating in kilograms" type="number" min="1" step="1" value={row.loadRating} onChange={(event) => setDocument((current) => updateSpecification(current, productIndex, row.id, "loadRating", event.target.value))} /></td>
                    <td><CustomSelect label="Specification status" value={row.status} options={["Draft", "Factory Supported", "Engineering Review", "Engineering Approved", "Restricted"]} onChange={(value) => setDocument((current) => updateSpecification(current, productIndex, row.id, "status", value))} /></td>
                    <td><button className="api-remove-spec" type="button" aria-label="Remove specification row" onClick={() => setDocument((current) => removeSpecification(current, productIndex, row.id))}>×</button></td>
                  </tr>)}</tbody>
                </table></div>
                {missing.some((field) => field.key === "specifications") ? <p className="api-field-error">Add at least one complete specification row before continuing.</p> : null}
                <p className="anvera-muted">A factory-supported specification is not automatically engineering-approved or vehicle-verified. Load rating is optional during drafting but must be supported before a product claim is published.</p>
              </section> : null}

              {active.id === "review" ? <div className="api-review-summary">
                <h3>Global validation summary</h3>
                {steps.filter((step) => step.id !== "review").map((step) => {
                  const missingFields = validateStep(step, document, productIndex);
                  const hasValue = stepHasAnyValue(step, document, productIndex);
                  const state = missingFields.length ? (step.optional && !hasValue ? "pending" : "missing") : (step.optional && !hasValue ? "pending" : "passed");
                  return <div key={step.id} className="api-review-row"><span>{step.number}</span><strong>{step.title}</strong><em className={`api-validation api-validation--${state}`}>{state.toUpperCase()}</em><button type="button" onClick={() => setActiveStep(steps.findIndex((item) => item.id === step.id))}>Review</button></div>;
                })}
                <p className="anvera-muted">Submitting creates an immutable review snapshot. It does not publish products or alter public website data.</p>
                <div className="api-history">
                  <h3>Version history</h3>
                  {versions?.length ? versions.map((version) => <div key={version.id}><strong>Revision {version.revision} · {version.version_type}</strong><time>{new Date(version.created_at).toLocaleString()}</time></div>) : <p className="anvera-muted">No submitted snapshots yet.</p>}
                </div>
              </div> : null}

              <div className="api-step-footer">
                <button className="anvera-action-button anvera-action-button--quiet" type="button" onClick={() => void save("draft")} disabled={saving || !available}>{saving ? "Saving…" : "Save draft"}</button>
                <div className="api-step-footer-right">
                  {activeStep > 0 ? <button className="anvera-action-button anvera-action-button--quiet" type="button" onClick={() => { setActiveStep((current) => current - 1); setError(""); }}>Back</button> : null}
                  {activeStep < steps.length - 1 ? <button className="anvera-action-button" type="button" onClick={goNext}>Save & continue <span>→</span></button> :
                    <button className="anvera-action-button" type="button" onClick={() => void save("submit")} disabled={saving || !available || !finalReady || status === "in_review" || status === "approved" || status === "active"}>{saving ? "Submitting…" : "Submit for review"}</button>}
                </div>
              </div>
            </div>
            <aside className="api-context-panel">
              <p className="anvera-eyebrow">WORKFLOW GUIDANCE</p>
              <h3>{active.id === "review" ? "Release control" : "Why this step matters"}</h3>
              <p>{active.id === "factory" ? "Factory records establish the source of truth for in-house, outsourced and partner-supported capabilities." :
                active.id === "material" ? "Material grade, forging and machining claims must be supported by controlled evidence." :
                active.id === "construction" ? "Construction-specific rules prevent a Monoblock capability from being incorrectly applied to multi-piece products." :
                active.id === "specification" ? "A factory-supported size is not automatically a product-approved specification or a verified vehicle fitment." :
                active.id === "finish" ? "Only mapped, approved finishes and customization options can be offered to customers." :
                active.id === "products" ? "Each product profile explicitly maps to the factory capabilities it actually uses." :
                active.id === "fitment" ? "Verified fitment must be tied to a specific vehicle configuration, product revision and specification set." :
                active.id === "media" ? "Public product imagery and installation cases require recorded usage rights and accurate media classification." :
                "Review the completeness, evidence and outstanding exceptions before requesting approval."}</p>
              <div className="api-rule"><strong>Governance rule</strong><span>{active.optional ? "This step may remain pending for a draft. Missing data must never be presented as verified." : "Required fields must be completed before the workflow can advance or be submitted."}</span></div>
              <div className="api-context-meta"><span>WORKSPACE STATUS</span><strong>{status.replaceAll("_", " ")}</strong><span>LAST SAVED REVISION</span><strong>{revision || "Not saved"}</strong></div>
              <button className="api-text-button" type="button" onClick={() => void save("draft")} disabled={saving || !available}>Save current progress ↗</button>
            </aside>
          </section>
          {events?.length ? <section className="api-event-strip"><span>RECENT ACTIVITY</span>{events.slice(0, 3).map((event) => <p key={event.id}>{event.event_type.replaceAll("_", " ")} · R{event.revision} · {new Date(event.created_at).toLocaleString()}</p>)}</section> : null}
        </>
      )}
    </main>
  );
}
