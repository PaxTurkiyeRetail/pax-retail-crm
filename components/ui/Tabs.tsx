import { cn } from './cn';

/** Alt çizgili sekmeler; mobilde yatay kayar. */
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
    <div role="tablist" className="-mx-4 flex overflow-x-auto border-0 border-b border-solid border-border px-4 sm:mx-0 sm:px-0">
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
              '-mb-px min-h-10 cursor-pointer rounded-none! border-0 border-b-2 border-solid bg-transparent px-3 py-2 text-[13px]! whitespace-nowrap transition-colors',
              on ? 'border-accent font-semibold text-text' : 'border-transparent text-text-3 hover:text-text',
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
