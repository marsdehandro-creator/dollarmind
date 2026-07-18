/**
 * Shows parsing issues raised during the most recent upload (docs/requirements.md F7).
 */
import type { IssueLog } from '../../services/salaryService.js';

interface Props {
  issues: IssueLog[];
  parseStatus?: 'ok' | 'partial' | 'failed';
  confidence?: number;
}

const COLORS: Record<string, string> = {
  info: '#2563eb',
  warning: '#b45309',
  error: '#b91c1c',
};

export function ParsingIssuesPanel({ issues, parseStatus, confidence }: Props) {
  return (
    <div className="dm-card" style={{ maxWidth: 480 }}>
      <h3 style={{ marginTop: 0 }}>Parsing</h3>
      {parseStatus && (
        <p style={{ margin: '0 0 0.5rem' }}>
          Status: <strong>{parseStatus}</strong>
          {typeof confidence === 'number' && <> · confidence {(confidence * 100).toFixed(0)}%</>}
        </p>
      )}
      {issues.length === 0 ? (
        <p><small>No issues — the slip parsed cleanly.</small></p>
      ) : (
        <ul style={{ paddingLeft: '1.2rem' }}>
          {issues.map((issue) => (
            <li key={issue.id} style={{ color: COLORS[issue.severity] ?? '#333' }}>
              <strong>{issue.kind}</strong>
              {typeof issue.detail === 'object' && issue.detail !== null && (
                <span> — {JSON.stringify(issue.detail)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
