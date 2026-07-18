/**
 * Cash-flow line chart with a smooth DollarMind blue→gold gradient line and
 * luminous data points. Plots income and expense across the timeline.
 */
import { formatZar } from '../../utils/money.js';

export interface FlowPoint {
  label: string;
  income: number;
  expense: number;
  net: number;
}

interface Props {
  points: FlowPoint[];
  height?: number;
}

export function CashFlowChart({ points, height = 220 }: Props) {
  if (points.length === 0) return <p><small>Not enough data for a cash-flow chart.</small></p>;

  const width = Math.max(360, points.length * 70);
  const pad = 34;
  const max = Math.max(1, ...points.map((p) => Math.max(p.income, p.expense)));
  const x = (i: number) => pad + (i * (width - pad * 2)) / Math.max(points.length - 1, 1);
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);
  const line = (key: 'income' | 'expense') => points.map((p, i) => `${x(i)},${y(p[key])}`).join(' ');

  const shortLabel = (l: string) => (l.length > 7 ? l.slice(5) : l.slice(2));

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} role="img" aria-label="Cash flow timeline">
        <defs>
          <linearGradient id="dm-flow-income" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#007BFF" />
            <stop offset="100%" stopColor="#00C6FF" />
          </linearGradient>
          <linearGradient id="dm-flow-expense" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#FFB300" />
          </linearGradient>
        </defs>

        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--border)" />

        <polyline points={line('income')} fill="none" stroke="url(#dm-flow-income)" strokeWidth={2.5} strokeLinejoin="round" />
        <polyline points={line('expense')} fill="none" stroke="url(#dm-flow-expense)" strokeWidth={2.5} strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.income)} r={3} fill="#FFFFFF" stroke="#00C6FF" strokeWidth={1.5} />
            <circle cx={x(i)} cy={y(p.expense)} r={3} fill="#FFFFFF" stroke="#FFB300" strokeWidth={1.5} />
            <text x={x(i)} y={height - pad + 14} fontSize="9" textAnchor="middle" fill="var(--fg-muted)">
              {shortLabel(p.label)}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
        <span><span style={{ color: '#00C6FF' }}>■</span> Income</span>
        <span><span style={{ color: '#FFB300' }}>■</span> Expense</span>
        <span>Peak {formatZar(max)}</span>
      </div>
    </div>
  );
}
