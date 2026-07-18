/**
 * DollarMind modal primitive with glowing edges.
 */
import type { ReactNode } from 'react';

interface Props {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: Props) {
  return (
    <div className="dm-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="dm-modal" onClick={(e) => e.stopPropagation()}>
        {title && <h3 style={{ marginTop: 0 }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}
