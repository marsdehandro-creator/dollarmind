/**
 * DollarMind card primitive (metallic gradient border, soft shadow).
 */
import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className = '', ...rest }: Props) {
  return (
    <div className={`dm-card ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
