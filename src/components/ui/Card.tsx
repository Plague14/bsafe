import type { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  noPadding?: boolean;
}

export function Card({ children, className, elevated, header, footer, noPadding }: CardProps) {
  return (
    <div className={clsx('card', elevated && 'card-elevated', noPadding && 'p-0', className)}>
      {header && (
        <div className={clsx('border-b border-gray-100 pb-4 mb-4', noPadding && 'px-6 pt-6')}>{header}</div>
      )}
      <div className={noPadding ? 'px-6' : ''}>{children}</div>
      {footer && (
        <div className={clsx('border-t border-gray-100 pt-4 mt-4', noPadding && 'px-6 pb-6')}>{footer}</div>
      )}
    </div>
  );
}
