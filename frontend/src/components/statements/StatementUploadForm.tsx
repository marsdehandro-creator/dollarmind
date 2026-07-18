/**
 * Bank statement upload form. Displays business errors (code + suggestion) and
 * a loading state; the page shows the import summary.
 */
import { useState, type FormEvent } from 'react';
import { uploadStatement, type StatementUploadResult } from '../../services/statementService.js';
import { ErrorNotice } from '../ui/ErrorNotice.js';

interface Props {
  onUploaded: (result: StatementUploadResult) => void;
}

export function StatementUploadForm({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await uploadStatement(file));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="file" accept=".csv,.txt,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button type="submit" className="btn-primary" disabled={!file || busy}>{busy ? 'Uploading…' : 'Upload statement'}</button>
      <p style={{ width: '100%', margin: '0.25rem 0 0' }}>
        <small>CSV, TXT, and text-based PDF statements are parsed (bank auto-detected). Re-uploading the same file is a no-op.</small>
      </p>
      {error != null && <div style={{ width: '100%' }}><ErrorNotice error={error} /></div>}
    </form>
  );
}
