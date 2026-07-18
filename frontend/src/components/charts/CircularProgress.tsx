/**
 * Circular progress ring with the DollarMind gradient — used on goal cards.
 */
interface Props {
  percent: number; // 0..100
  size?: number;
  label?: string;
}

export function CircularProgress({ percent, size = 96, label }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const stroke = size * 0.1;
  const r = size / 2 - stroke / 2;
  const circ = 2 * Math.PI * r;
  const dash = (clamped / 100) * circ;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${clamped}% complete`}>
      <defs>
        <linearGradient id="dm-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#007BFF" />
          <stop offset="60%" stopColor="#00C6FF" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#dm-ring)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.22} fontWeight="700" fill="var(--fg)">
        {clamped}%
      </text>
      {label && (
        <text x="50%" y={size * 0.72} textAnchor="middle" fontSize={size * 0.1} fill="var(--fg-muted)">
          {label}
        </text>
      )}
    </svg>
  );
}
