/**
 * DollarMind design tokens (derived from the brand logo).
 *
 * These are the canonical values; index.css mirrors them as CSS custom
 * properties for both dark and light themes. Import these when you need a token
 * in TS (e.g. chart colors) rather than hardcoding hex.
 */
export const palette = {
  primary: { from: '#007BFF', to: '#00C6FF' },
  secondary: { from: '#FFD700', to: '#FFB300' },
  background: { deep: '#0A0F2C', raised: '#121A3A' },
  surface: { base: '#1A234A', raised: '#1F2A55' },
  neutral: { silver: '#C0C0C0', light: '#E0E0E0', white: '#FFFFFF' },
  danger: '#FF5470',
  success: '#22C55E',
} as const;

export const gradients = {
  primary: 'linear-gradient(90deg, #007BFF 0%, #00C6FF 100%)',
  gold: 'linear-gradient(90deg, #FFD700 0%, #FFB300 100%)',
  brand: 'linear-gradient(90deg, #007BFF 0%, #00C6FF 45%, #FFD700 100%)',
  metal: 'linear-gradient(180deg, #E0E0E0 0%, #C0C0C0 100%)',
} as const;

export const typography = {
  fontFamily: "'Inter','Poppins',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
  weights: { regular: 400, semibold: 600, bold: 700 },
} as const;

export const radii = { sm: '6px', md: '8px', lg: '14px', pill: '999px' } as const;

export const shadows = {
  soft: '0 4px 18px rgba(0,0,0,0.28)',
  glowBlue: '0 0 0 3px rgba(0,198,255,0.25)',
  glowModal: '0 0 40px rgba(0,123,255,0.35)',
} as const;

/** Chart palette — blue→gold gradient lines + luminous points. */
export const chart = {
  income: '#00C6FF',
  incomeFrom: '#007BFF',
  expense: '#FFB300',
  expenseFrom: '#FFD700',
  grid: 'rgba(192,192,192,0.18)',
  point: '#FFFFFF',
} as const;

export type ThemeMode = 'light' | 'dark' | 'system';
export type LayoutMode = 'auto' | 'sidebar' | 'bottomnav';
