import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from './cn';

// Legacy premium-ui.css input/select kuralları katmansız + !important olduğu için
// çakışan özellikler önemli (!) işaretli: katmanlı !important, katmansız !important'ı yener.
const field =
  'box-border h-10 min-w-0 rounded-lg! border border-solid border-border! bg-surface! px-3 text-base text-text shadow-none! sm:text-[13px] placeholder:text-text-4 focus:border-accent! focus:shadow-[0_0_0_3px_var(--accent-soft)]! focus:outline-none sm:h-8';

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, className)} {...p} />;
}

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(field, 'pr-7', className)} {...p}>
      {children}
    </select>
  );
}

const bare = 'rounded-none! border-0! bg-transparent! shadow-none! accent-accent';

export function Checkbox({ label, className, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode }) {
  return (
    <label className={cn('flex min-h-10 cursor-pointer items-center gap-2 text-[13px] text-text-2 sm:min-h-8', className)}>
      <input type="checkbox" className={cn(bare, 'size-4')} {...p} />
      {label}
    </label>
  );
}

export function Range({ className, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input type="range" className={cn(bare, 'h-10 w-40 sm:h-8', className)} {...p} />;
}
