/**
 * Export/import panel — the data-loss safety net for a device with no cloud
 * backup (docs/v1-offline-product-spec.md Decision 7). Export downloads a
 * single JSON file; import restores from one, safely re-runnable since every
 * row is matched by its own id (already-present rows are left untouched).
 */
import { useRef, useState } from 'react';
import { exportToJson, importFromJson, type ImportSummary } from '../../local/exportImport.js';

function downloadFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DataExportImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const json = await exportToJson();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(`dollarmind-backup-${stamp}.json`, json);
      setStatus('Backup downloaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const text = await file.text();
      const summary: ImportSummary = await importFromJson(text);
      setStatus(
        `Import complete — ${summary.inserted} row${summary.inserted === 1 ? '' : 's'} restored` +
          (summary.skippedExisting > 0 ? `, ${summary.skippedExisting} already present and left unchanged.` : '.'),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3>Backup &amp; restore</h3>
      <p style={{ margin: '0 0 0.6rem', color: 'var(--fg-muted)' }}>
        Your data lives only on this device. Download a backup before switching phones, reinstalling, or clearing
        site data — and keep it somewhere safe, since it's an unencrypted copy of your financial data.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void handleExport()} disabled={busy}>
          {busy ? 'Working…' : 'Download backup'}
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          Restore from backup
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={(e) => void handleImportFile(e)} />
      </div>
      {error && <p className="error-text"><small>{error}</small></p>}
      {status && <p><small>{status}</small></p>}
    </div>
  );
}
