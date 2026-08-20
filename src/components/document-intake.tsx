"use client";

import { CheckCircle2, FileUp, LoaderCircle, ShieldAlert } from "lucide-react";
import { useState } from "react";

type IntakeResult = { title: string; status: string; sha256: string };

export function DocumentIntake() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeResult | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    setResult(null);
    formData.set("matterId", "matter-golden-001");
    formData.set("classification", "medical_qme");
    try {
      const response = await fetch("/api/documents/intake", { method: "POST", body: formData });
      const payload = await response.json() as { document?: IntakeResult; error?: string };
      if (!response.ok || !payload.document) throw new Error(payload.error ?? "Document intake failed");
      setResult(payload.document);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Document intake failed");
    } finally {
      setPending(false);
    }
  }

  return <section className="upload-panel" aria-labelledby="upload-title">
    <div className="upload-copy"><span className="upload-icon"><FileUp size={21} /></span><div><h2 id="upload-title">Secure document intake</h2><p>Upload a synthetic PDF to the Rivera matter. Originals are checksummed, isolated, and held from use until scanning completes.</p></div></div>
    <div className="intake-warning"><ShieldAlert size={16} /><span><strong>Synthetic data only.</strong> Malware scanning is not connected, so every upload remains quarantined.</span></div>
    <form action={submit} className="upload-form">
      <label><span>QME or medical PDF</span><input type="file" name="file" accept="application/pdf,.pdf" required /></label>
      <button className="primary-action" type="submit" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={15} />Securing original…</> : <><FileUp size={15} />Upload to quarantine</>}</button>
    </form>
    {error && <p className="upload-message error" role="alert">{error}</p>}
    {result && <div className="upload-message success" role="status"><CheckCircle2 size={16} /><span><strong>{result.title}</strong> is quarantined pending malware scan.<small>SHA-256 · {result.sha256.slice(0, 20)}…</small></span></div>}
  </section>;
}
