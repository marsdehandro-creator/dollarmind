/**
 * Month-over-month expense/income trend chart (inline SVG — no chart library).
 */
import { formatZar } from '../../utils/money.js';
import type { SpendingTrends } from '../../services/spendingService.js';

interface Props {
  trends: SpendingTrends;
  chartType?: 'bar' | 'line';
}

export function TrendChart({ trends, chartType = 'bar' }: Props) {
  const { months, expenseByMonth, incomeByMonth } = trends;
  if (months.length === 0) return <p><small>Not enough data for trends.</small></p>;

  const width = Math.max(320, months.length * 90);
  const height = 200;
  const pad = 30;
  const max = Math.max(1, ...expenseByMonth, ...incomeByMonth);
  const barW = (width - pad * 2) / months.length / 3;
  const step = (width - pad * 2) / Math.max(months.length, 1);
  const yFor = (v: number) => height - pad - (v / max) * (height - pad * 2);
  const xFor = (i: number) => pad + i * step + step / 2;
  const line = (vals: number[]) => vals.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} role="img" aria-label="Spending trend chart">
        {chartType === 'line' ? (
          <>
            <polyline points={line(incomeByMonth)} fill="none" stroke="#15803d" strokeWidth={2} />
            <polyline points={line(expenseByMonth)} fill="none" stroke="#b91c1c" strokeWidth={2} />
            {months.map((m, i) => (
              <text key={m} x={xFor(i)} y={height - pad + 14} fontSize="10" textAnchor="middle">{m.slice(2)}</text>
            ))}
          </>
        ) : (
          months.map((m, i) => {
            const x = pad + i * step;
            const expH = (expenseByMonth[i] / max) * (height - pad * 2);
            const incH = (incomeByMonth[i] / max) * (height - pad * 2);
            return (
              <g key={m}>
                <rect x={x} y={height - pad - incH} width={barW} height={incH} fill="#15803d" />
                <rect x={x + barW + 2} y={height - pad - expH} width={barW} height={expH} fill="#b91c1c" />
                <text x={x + barW} y={height - pad + 14} fontSize="10" textAnchor="middle">{m.slice(2)}</text>
              </g>
            );
          })
        )}
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#ccc" />
      </svg>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
        <span><span style={{ color: '#15803d' }}>■</span> Income</span>
        <span><span style={{ color: '#b91c1c' }}>■</span> Expense</span>
        <span style={{ color: '#888' }}>Max {formatZar(max)}</span>
      </div>
    </div>
  );
}
