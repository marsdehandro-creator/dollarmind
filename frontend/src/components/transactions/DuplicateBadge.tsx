/**
 * Shows a "possible duplicate" badge for transactions in a dedup cluster.
 */
interface Props {
  dedupGroupId: string | null;
}

export function DuplicateBadge({ dedupGroupId }: Props) {
  if (!dedupGroupId) return null;
  return (
    <span
      title="Part of a possible-duplicate cluster — review recommended"
      style={{
        display: 'inline-block',
        fontSize: '0.7rem',
        padding: '0.05rem 0.4rem',
        borderRadius: 999,
        background: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fde68a',
      }}
    >
      possible dup
    </span>
  );
}
