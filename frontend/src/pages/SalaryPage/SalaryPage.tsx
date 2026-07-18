/**
 * Salary page: upload a slip, view its parsed breakdown + parsing issues, and
 * browse the history of previously uploaded slips (docs/requirements.md §5.1).
 */
import { useEffect, useState } from 'react';
import { SalaryUploadForm } from '../../components/salary/SalaryUploadForm.js';
import { SalarySlipView } from '../../components/salary/SalarySlipView.js';
import { SalaryHistoryTable } from '../../components/salary/SalaryHistoryTable.js';
import { ParsingIssuesPanel } from '../../components/salary/ParsingIssuesPanel.js';
import {
  getHistory,
  type IssueLog,
  type SlipWithComponents,
  type UploadResult,
} from '../../services/salaryService.js';

export function SalaryPage() {
  const [history, setHistory] = useState<SlipWithComponents[]>([]);
  const [selected, setSelected] = useState<SlipWithComponents | null>(null);
  const [issues, setIssues] = useState<IssueLog[]>([]);
  const [parseStatus, setParseStatus] = useState<UploadResult['parseStatus']>();
  const [confidence, setConfidence] = useState<number>();
  const [loadError, setLoadError] = useState<string | null>(null);

  async function refresh() {
    try {
      const { slips } = await getHistory();
      setHistory(slips);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load history');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function onUploaded(result: UploadResult) {
    setSelected({ slip: result.slip, components: result.components });
    setIssues(result.issues);
    setParseStatus(result.parseStatus);
    setConfidence(result.confidence);
    void refresh();
  }

  return (
    <section>
      <h1>Salary Slips</h1>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2>Upload</h2>
        <SalaryUploadForm onUploaded={onUploaded} />
      </div>

      {selected && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <SalarySlipView slip={selected.slip} components={selected.components} parseStatus={parseStatus} />
          <ParsingIssuesPanel issues={issues} parseStatus={parseStatus} confidence={confidence} />
        </div>
      )}

      <div>
        <h2>History</h2>
        {loadError && <p style={{ color: 'crimson' }}>{loadError}</p>}
        <SalaryHistoryTable
          slips={history}
          onSelect={(s) => {
            setSelected(s);
            setIssues([]);
            setParseStatus(undefined);
            setConfidence(undefined);
          }}
        />
      </div>
    </section>
  );
}
