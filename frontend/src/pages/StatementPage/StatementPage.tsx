/**
 * Statements page: upload a bank statement and view upload history + the import
 * summary (imported / duplicates skipped / possible duplicates).
 * See docs/requirements.md §5.2.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatementUploadForm } from '../../components/statements/StatementUploadForm.js';
import { StatementHistoryTable } from '../../components/statements/StatementHistoryTable.js';
import { BankStatementView } from '../../components/statements/BankStatementView.js';
import {
  getStatementDetail,
  getStatementHistory,
  type StatementDetail,
  type StatementSummary,
  type StatementUploadResult,
} from '../../services/statementService.js';

export function StatementPage() {
  const [statements, setStatements] = useState<StatementSummary[]>([]);
  const [summary, setSummary] = useState<StatementUploadResult | null>(null);
  const [detail, setDetail] = useState<StatementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openDetail(id: string) {
    try {
      setDetail(await getStatementDetail(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statement');
    }
  }

  async function refresh() {
    try {
      const { statements } = await getStatementHistory();
      setStatements(statements);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function onUploaded(result: StatementUploadResult) {
    setSummary(result);
    void refresh();
  }

  return (
    <section>
      <h1>Bank Statements</h1>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2>Upload</h2>
        <StatementUploadForm onUploaded={onUploaded} />
      </div>

      {summary && (
        <div className="dm-card" style={{ marginBottom: '1.5rem', maxWidth: 560 }}>
          <h3 style={{ marginTop: 0 }}>Import summary</h3>
          {summary.fileAlreadyImported ? (
            <p>This exact file was already imported — nothing to do.</p>
          ) : (
            <ul style={{ margin: 0 }}>
              <li>Parse status: <strong>{summary.parseStatus}</strong>{summary.source ? ` (${summary.source})` : ''}</li>
              {summary.bank && <li>Bank detected: <strong>{summary.bank}</strong></li>}
              <li>Imported: <strong>{summary.imported}</strong></li>
              <li>Exact duplicates skipped: <strong>{summary.duplicatesSkipped}</strong></li>
              <li>Possible duplicates (flagged): <strong>{summary.possibleDuplicates}</strong></li>
              {summary.issues.length > 0 && <li>Issues logged: {summary.issues.length}</li>}
              {summary.warnings && summary.warnings.length > 0 && (
                <li>Warnings: {summary.warnings.join('; ')}</li>
              )}
            </ul>
          )}
          <p style={{ marginBottom: 0 }}><Link to="/transactions">View transactions →</Link></p>
        </div>
      )}

      {detail && <BankStatementView detail={detail} onClose={() => setDetail(null)} />}

      <div>
        <h2>History</h2>
        {error && <p className="error-text">{error}</p>}
        <StatementHistoryTable statements={statements} onSelect={openDetail} />
      </div>
    </section>
  );
}
