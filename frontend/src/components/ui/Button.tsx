/**
 * DollarMind button primitive.
 */
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'gold' | 'ghost' | 'default';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  gold: 'btn-gold',
  ghost: 'btn-ghost',
  default: '',
};

export function Button({ variant = 'default', className = '', ...rest }: Props) {
  return <button className={`${CLASS[variant]} ${className}`.trim()} {...rest} />;
}
