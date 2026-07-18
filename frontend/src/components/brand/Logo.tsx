/**
 * DollarMind brand mark — the metallic crown (blue → gold → silver) with an
 * optional wordmark. Rendered inline so gradients stay crisp at any size and in
 * both themes. This is the single source for the logo across splash, login, and
 * the nav header.
 */
interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  /** stack the wordmark under the crown (splash) vs. inline (nav) */
  vertical?: boolean;
}

let idSeq = 0;

export function Logo({ size = 40, withWordmark = false, vertical = false }: LogoProps) {
  const uid = `dm-${idSeq++}`;
  const crown = (
    <svg width={size} height={size} viewBox="0 0 342 220" role="img" aria-label="DollarMind logo" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`${uid}-crown`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#007BFF" />
          <stop offset="28%" stopColor="#00C6FF" />
          <stop offset="50%" stopColor="#FFD700" />
          <stop offset="72%" stopColor="#FFB300" />
          <stop offset="100%" stopColor="#C0C0C0" />
        </linearGradient>
        <linearGradient id={`${uid}-base`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C0C0C0" />
          <stop offset="50%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#C0C0C0" />
        </linearGradient>
        <linearGradient id={`${uid}-glow`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#007BFF" stopOpacity="0" />
          <stop offset="50%" stopColor="#00C6FF" />
          <stop offset="100%" stopColor="#007BFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="translate(6,6)">
        <path
          d="M0,180 L26,66 L60,138 L104,44 L128,120 L155,28 L182,120 L226,44 L270,138 L304,66 L330,180 Z"
          fill={`url(#${uid}-crown)`}
          stroke="#C0C0C0"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect x="6" y="184" width="318" height="24" rx="6" fill={`url(#${uid}-base)`} />
        <rect x="70" y="192" width="190" height="6" rx="3" fill={`url(#${uid}-glow)`} />
        <circle cx="155" cy="24" r="5" fill="#FFF3B0" />
        <circle cx="104" cy="40" r="3" fill="#EAF6FF" />
        <circle cx="226" cy="40" r="3" fill="#EAF6FF" />
      </g>
    </svg>
  );

  if (!withWordmark) return crown;

  return (
    <span
      className="dm-logo"
      style={{
        display: 'inline-flex',
        flexDirection: vertical ? 'column' : 'row',
        alignItems: 'center',
        gap: vertical ? '0.75rem' : '0.6rem',
      }}
    >
      {crown}
      <span className="dm-wordmark" style={{ fontSize: vertical ? size * 0.5 : size * 0.42 }}>
        <span className="dm-word-dollar">DOLLAR</span>
        <span className="dm-word-mind">MIND</span>
      </span>
    </span>
  );
}
