/**
 * Donut chart for category breakdown — DollarMind blue→gold segment palette.
 */
interface Slice {
  label: string;
  value: number;
}

interface Props {
  data: Slice[];
  size?: number;
}

const COLORS = ['#00C6FF', '#FFD700', '#007BFF', '#FFB300', '#7CC7FF', '#C0C0C0', '#5A6488'];

export function DonutChart({ data, size = 180 }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2;
  const stroke = size * 0.16;
  const radius = r - stroke / 2;
  const circ = 2 * Math.PI * radius;

  if (total <= 0) {
    return <p><small>No spending to chart.</small></p>;
  }

  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Category breakdown">
      <circle cx={r} cy={r} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      {data.map((d, i) => {
        const frac = d.value / total;
        const len = frac * circ;
        const seg = (
          <circle
            key={d.label}
            cx={r}
            cy={r}
            r={radius}
            fill="none"
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={stroke}
            strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${r} ${r})`}
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        );
        offset += len;
        return seg;
      })}
      <text x={r} y={r - 4} textAnchor="middle" fontSize={size * 0.1} fontWeight="700" fill="var(--fg)">
        {data.length}
      </text>
      <text x={r} y={r + size * 0.09} textAnchor="middle" fontSize={size * 0.06} fill="var(--fg-muted)">
        categories
      </text>
    </svg>
  );
}

export const donutColor = (i: number): string => COLORS[i % COLORS.length];
