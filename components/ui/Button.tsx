import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost';
const V: Record<Variant, string> = {
  primary:
    'border-brand bg-gradient-to-b from-brand-2 to-brand text-white! shadow-[0_1px_2px_rgba(7,5,91,.2),0_4px_12px_-4px_rgba(14,111,199,.6)] hover:brightness-110 active:brightness-95',
  secondary: 'border-border bg-surface text-text-2 shadow-xs hover:border-accent/40 hover:bg-accent-soft hover:text-accent',
  ghost: 'border-transparent bg-transparent text-accent hover:bg-accent-soft',
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
        'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px]! border border-solid font-semibold whitespace-nowrap transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-10 px-3 text-xs! sm:h-7 sm:rounded-lg! sm:px-2.5' : 'h-10 px-4 text-[13px]! sm:h-9',
        V[variant],
        className,
      )}
      {...p}
    />
  );
}
