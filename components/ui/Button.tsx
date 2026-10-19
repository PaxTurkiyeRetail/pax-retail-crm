import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost';
const V: Record<Variant, string> = {
  primary: 'border-accent bg-accent text-white hover:opacity-90',
  secondary: 'border-border bg-surface text-text-2 hover:bg-surface-2 hover:text-text',
  ghost: 'border-transparent bg-transparent text-text-3 hover:bg-surface-2 hover:text-text',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[3px]! border border-solid font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-10 px-3 text-xs! sm:h-7 sm:px-2.5' : 'h-10 px-3.5 text-[13px]! sm:h-8 sm:px-3',
        V[variant],
        className,
      )}
      {...p}
    />
  );
}
