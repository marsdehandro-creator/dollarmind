/**
 * Renders a business error (ApiError) with its message + actionable suggestion,
 * coloured by severity. Falls back to a plain message for generic errors.
 */
import { ApiError } from '../../services/apiClient.js';

const SEVERITY_COLOR: Record<string, string> = {
  info: 'var(--blue)',
  warning: 'var(--gold)',
  critical: 'var(--danger)',
};

export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  const api = error instanceof ApiError ? error : null;
  const message = api?.message ?? (error instanceof Error ? error.message : 'Something went wrong');
  const color = api?.severity ? SEVERITY_COLOR[api.severity] ?? 'var(--danger)' : 'var(--danger)';

  return (
    <div
      role="alert"
      style={{
        border: `1px solid ${color}`,
        borderRadius: 'var(--radius-md)',
        padding: '0.6rem 0.8rem',
        background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
        margin: '0.5rem 0',
      }}
    >
      <div style={{ color, fontWeight: 600 }}>
        {api?.code ? `${api.code.replace(/_/g, ' ')}` : 'Error'}
      </div>
      <div>{message}</div>
      {api?.suggestion && <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginTop: 2 }}>💡 {api.suggestion}</div>}
    </div>
  );
}
