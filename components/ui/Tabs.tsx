import { cn } from './cn';

/** Segment sekmeler: aktif = marka gradyanı; mobilde yatay kayar. */
export function Tabs<K extends string | number>({
  items,
  value,
  onChange,
}: {
  items: Array<{ key: K; label: string }>;
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="tablist" className="inline-flex min-w-max gap-1 rounded-xl border border-solid border-border bg-surface p-1 shadow-ds">
        {items.map((it) => {
          const on = it.key === value;
          return (
            <button
              key={String(it.key)}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => onChange(it.key)}
              className={cn(
                'min-h-9 cursor-pointer rounded-lg! border-0 px-3.5 py-1.5 text-[13px]! font-medium whitespace-nowrap transition-all duration-150 sm:min-h-8',
                on
                  ? 'bg-gradient-to-b from-brand-2 to-brand font-semibold text-white! shadow-[0_4px_12px_-4px_rgba(14,111,199,.7)]'
                  : 'bg-transparent text-text-3 hover:bg-accent-soft hover:text-accent',
              )}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
