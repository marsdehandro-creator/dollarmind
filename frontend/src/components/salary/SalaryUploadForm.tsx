/**
 * Salary slip upload form. Displays business errors (code + suggestion) and a
 * loading state; the page shows the parsed breakdown + parsing issues.
 */
import { useState, type FormEvent } from 'react';
import { uploadSlip, type UploadResult } from '../../services/salaryService.js';
import { ErrorNotice } from '../ui/ErrorNotice.js';

interface Props {
  onUploaded: (result: UploadResult) => void;
}

export function SalaryUploadForm({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await uploadSlip(file));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="file" accept=".txt,.csv,.pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button type="submit" className="btn-primary" disabled={!file || busy}>{busy ? 'Uploading…' : 'Upload slip'}</button>
      <p style={{ width: '100%', margin: '0.25rem 0 0' }}>
        <small>TXT and text-based PDF slips are parsed. Scanned PDFs/images need OCR enabled.</small>
      </p>
      {error != null && <div style={{ width: '100%' }}><ErrorNotice error={error} /></div>}
    </form>
  );
}
