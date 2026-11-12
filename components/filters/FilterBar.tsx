'use client';
// Merkezi filtre çubuğu: config'e göre etiketli kontroller, otomatik uygulama,
// aktif filtre çipleri, tek "Sıfırla" ve kapsam satırı (Dönem · Departman · Satıcı).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FilterGrid, StackField } from '@/components/ui/Toolbar';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { DEPARTMENTS, DEPARTMENT_LABELS, type Department } from '@/lib/departments';
import { PERIOD_LABELS, resolvePeriod, type PeriodPreset } from '@/lib/filters/period';
import {
  DEFAULT_FILTER_LABELS, countActiveFilters,
  type FilterKey, type FilterOption, type FilterValues, type PageFilterConfig,
} from '@/lib/filters/schema';
import { useUrlFilters } from '@/lib/filters/use-url-filters';

/** Çip olarak gösterilen dönem presetleri (sıra önemli). */
const PERIOD_CHIPS: PeriodPreset[] = ['this_week', 'last_week', 'this_month', 'this_quarter', 'this_year', 'custom'];
const PERIOD_CHIP_LABELS: Partial<Record<PeriodPreset, string>> = { custom: 'Özel' };

const ctl = 'h-9! w-full text-sm! sm:h-9!';

type CommonProps = {
  config: PageFilterConfig;
  allowedDepartments?: Department[] | null;
  /** Kapsam satırının sağına ek içerik (ör. dışa aktar). */
  actions?: ReactNode;
  /** Sayfaya özel ek alanlar (FilterField ile) — standart alanlarla aynı gridde gösterilir. */
  extraFields?: ReactNode;
  /** false → kapsam satırı gizli. */
  showScope?: boolean;
  /** Place search on its own first row for search-led lists. */
  prominentSearch?: boolean;
};

type Api = {
  values: FilterValues;
  set: (patch: Partial<Record<FilterKey, string | undefined | null>>) => void;
  remove: (key: FilterKey) => void;
  reset: () => void;
  activeCount: number;
};

/**
 * mode='auto' (varsayılan): değişiklik anında URL'ye yazılır.
 * mode='form': sunucu-only sayfalar için GET form + "Uygula" (values sunucudan parseFilters ile gelir).
 */
export function FilterBar(props: CommonProps & ({ mode?: 'auto' } | { mode: 'form'; values: FilterValues; action?: string })) {
  if (props.mode === 'form') return <FormFilterBar {...props} />;
  return <AutoFilterBar {...props} />;
}

function AutoFilterBar({ config, allowedDepartments, actions, extraFields, showScope = true, prominentSearch = false }: CommonProps) {
  const api = useUrlFilters(config, { allowedDepartments });
  return <FilterBody api={api} config={config} allowedDepartments={allowedDepartments} actions={actions} extraFields={extraFields} showScope={showScope} prominentSearch={prominentSearch} auto />;
}

/** Sayfaya özel select için standart görünümlü alan. */
export function FilterSelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <StackField label={label}>
      <Select className={cn(ctl, 'min-w-36')} value={value} onChange={(e) => onChange(e.target.value)}>{children}</Select>
    </StackField>
  );
}

function FormFilterBar({ config, allowedDepartments, actions, extraFields, showScope = true, prominentSearch = false, values, action }: CommonProps & { values: FilterValues; action?: string }) {
  const [draft, setDraft] = useState<FilterValues>(values);
  useEffect(() => setDraft(values), [values]);
  const api: Api = {
    values: draft,
    set: (patch) => setDraft((d) => {
      const next: Record<string, string | undefined> = { ...d };
      for (const [k, v] of Object.entries(patch)) next[k] = v ?? undefined;
      if ('period' in patch && patch.period !== 'custom') { next.from = undefined; next.to = undefined; }
      return next as FilterValues;
    }),
    remove: (key) => setDraft((d) => ({ ...d, [key]: config.defaults?.[key] })),
    reset: () => setDraft({ ...(config.defaults ?? {}) }),
    activeCount: countActiveFilters(draft, config),
  };
  return (
    <form method="get" action={action}>
      {config.keys.map((k) => {
        const v = draft[k];
        return v && config.defaults?.[k] !== v ? <input key={k} type="hidden" name={k} value={v} /> : null;
      })}
      <FilterBody api={api} config={config} allowedDepartments={allowedDepartments} actions={actions} extraFields={extraFields} showScope={showScope} prominentSearch={prominentSearch} auto={false} />
    </form>
  );
}

function optionLabel(key: FilterKey, value: string, config: PageFilterConfig): string {
  if (key === 'period') return PERIOD_LABELS[value as PeriodPreset] ?? value;
  if (key === 'department') return DEPARTMENT_LABELS[value as Department] ?? value;
  if (key === 'phase') return config.options?.phase?.find((o) => o.value === value)?.label ?? `Faz ${value}`;
  return config.options?.[key]?.find((o) => o.value === value)?.label ?? value;
}

function OptionList({ options }: { options: FilterOption[] }) {
  const plain = options.filter((o) => !o.group);
  const groups = [...new Set(options.filter((o) => o.group).map((o) => o.group!))];
  return (
    <>
      {plain.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {options.filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </optgroup>
      ))}
    </>
  );
}

function SearchInput({ value, onChange, auto, label }: { value: string; onChange: (v: string) => void; auto: boolean; label: string }) {
  const [text, setText] = useState(value);
  const first = useRef(true);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!auto || text === value) return;
    const t = setTimeout(() => onChange(text.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <Input
      type="search"
      className={ctl}
      value={text}
      placeholder={`${label}…`}
      onChange={(e) => { setText(e.target.value); if (!auto) onChange(e.target.value); }}
    />
  );
}

function FilterBody({ api, config, allowedDepartments, actions, extraFields, showScope, prominentSearch, auto }: {
  api: Api; config: PageFilterConfig; allowedDepartments?: Department[] | null; actions?: ReactNode; extraFields?: ReactNode; showScope: boolean; prominentSearch: boolean; auto: boolean;
}) {
  const { values, set, remove, reset, activeCount } = api;
  const has = (k: FilterKey) => config.keys.includes(k);
  const label = (k: FilterKey) => config.labels?.[k] ?? DEFAULT_FILTER_LABELS[k];
  const depts = DEPARTMENTS.filter((d) => !allowedDepartments?.length || allowedDepartments.includes(d));
  const deptLocked = has('department') && depts.length === 1;
  const isCustom = values.period === 'custom' || (!has('period') && (has('from') || has('to')));

  const selectFor = (k: FilterKey, opts: FilterOption[], allLabel = 'Tümü') => {
    const v = values[k] ?? '';
    const current = opts.find((o) => o.value === v)?.label ?? allLabel;
    return (
      <StackField key={k} label={label(k)}>
        <Select className={cn(ctl, 'min-w-36')} value={v} title={current} onChange={(e) => set({ [k]: e.target.value || undefined })}>
          <option value="">{allLabel}</option>
          <OptionList options={opts} />
        </Select>
      </StackField>
    );
  };

  // Aktif çipler (default'tan farklı olanlar)
  const chips: { key: FilterKey; text: string }[] = [];
  for (const k of config.keys) {
    if (k === 'to' || (k === 'from' && has('period'))) continue;
    const v = values[k];
    if (!v || config.defaults?.[k] === v) continue;
    if (k === 'department' && deptLocked) continue;
    if (k === 'period' && v === 'custom') {
      if (values.from && values.to) chips.push({ key: 'period', text: `${label('period')}: ${resolvePeriod({ from: values.from, to: values.to }).label}` });
      continue;
    }
    chips.push({ key: k, text: `${label(k)}: ${k === 'from' ? `${values.from ?? '…'} – ${values.to ?? '…'}` : optionLabel(k, v, config)}` });
  }

  const fields: ReactNode[] = [];
  if (has('department') && !deptLocked) {
    fields.push(selectFor('department', depts.map((d) => ({ value: d, label: DEPARTMENT_LABELS[d] }))));
  }
  if (has('owner')) fields.push(selectFor('owner', config.options?.owner ?? []));
  if (has('customer')) fields.push(selectFor('customer', config.options?.customer ?? []));
  if (has('phase')) fields.push(selectFor('phase', config.options?.phase ?? [
    { value: '1-4', label: 'Faz 1–4' }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `Faz ${n}` })),
  ]));
  if (has('role')) fields.push(selectFor('role', config.options?.role ?? []));
  if (has('status')) fields.push(selectFor('status', config.options?.status ?? []));
  if (has('q')) {
    const searchField = <div key="q" className={prominentSearch ? 'col-span-full rounded-xl border border-accent/25 bg-accent-soft/30 p-2' : ''}>
      <StackField label={label('q')}>
        <SearchInput value={values.q ?? ''} label={label('q')} auto={auto} onChange={(v) => set({ q: v || undefined })} />
      </StackField>
    </div>;
    if (prominentSearch) fields.unshift(searchField); else fields.push(searchField);
  }
  if (isCustom && (has('from') || has('to'))) {
    if (has('from')) fields.push(
      <StackField key="from" label={label('from')}>
        <Input type="date" className={ctl} value={values.from ?? ''} max={values.to} onChange={(e) => set({ from: e.target.value || undefined })} />
      </StackField>,
    );
    if (has('to')) fields.push(
      <StackField key="to" label={label('to')}>
        <Input type="date" className={ctl} value={values.to ?? ''} min={values.from} onChange={(e) => set({ to: e.target.value || undefined })} />
      </StackField>,
    );
  }

  const footer = (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {activeCount > 0 && <span className="text-sm font-medium text-text-2">{activeCount} filtre aktif</span>}
        {chips.map((c) => (
          <span key={c.key} className="inline-flex h-8 max-w-full items-center gap-1 rounded-full border border-solid border-accent/30 bg-accent-soft pr-1 pl-3 text-sm text-accent">
            <span className="truncate" title={c.text}>{c.text}</span>
            <button
              type="button"
              aria-label={`${c.text} filtresini kaldır`}
              className="inline-flex size-6! min-h-6! cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-accent hover:bg-accent/15"
              onClick={() => remove(c.key)}
            >×</button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {!auto && <Button type="submit" variant="primary" className="h-9! min-h-9! text-sm! font-semibold! sm:h-9!">Uygula</Button>}
        {activeCount > 0 && <Button type="button" className="h-9! min-h-9! text-sm! font-medium! sm:h-9!" onClick={reset}>Sıfırla</Button>}
      </div>
    </>
  );

  const period = has('period') ? resolvePeriod({ period: values.period, from: values.from, to: values.to }) : null;
  const ownerLabel = values.owner ? optionLabel('owner', values.owner, config) : null;

  return (
    <div className="flex flex-col gap-2">
      <FilterGrid footer={footer}>
        {has('period') && (
          <div className="col-span-full flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-medium tracking-wide text-text-3 uppercase">{label('period')}</span>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {/* Segmented control: tek kapsül, seçili dilim yükseltilmiş kart. */}
              <div
                role="radiogroup"
                aria-label={label('period')}
                className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl border border-solid border-border bg-surface-2 p-1 [scrollbar-width:none]"
              >
                {PERIOD_CHIPS.map((p) => {
                  const active = (values.period ?? config.defaults?.period ?? 'this_week') === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => set({ period: p })}
                      className={cn(
                        // Global `.pax-main-inner button` kuralları (850 kalınlık, 42px min-height) ezmesin diye !important.
                        'h-8! min-h-8! shrink-0 cursor-pointer rounded-lg! border-0! px-3.5! text-[13px]! leading-none! whitespace-nowrap transition-all duration-150',
                        active
                          ? 'bg-surface! font-semibold! text-accent! shadow-[0_1px_2px_rgba(15,23,42,.08),0_2px_8px_rgba(15,23,42,.06)]!'
                          : 'bg-transparent! font-medium! text-text-3! hover:bg-surface/60! hover:text-text!',
                      )}
                    >
                      {PERIOD_CHIP_LABELS[p] ?? PERIOD_LABELS[p]}
                    </button>
                  );
                })}
              </div>
              {period && (
                <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-soft px-3 text-[13px] font-semibold text-accent">
                  <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  {period.label}
                </span>
              )}
            </div>
          </div>
        )}
        {fields}
        {extraFields}
      </FilterGrid>
      {showScope && (
        <ScopeLabel
          period={period?.label}
          department={values.department ? DEPARTMENT_LABELS[values.department] : deptLocked ? DEPARTMENT_LABELS[depts[0]] : has('department') ? 'Tüm departmanlar' : undefined}
          owner={has('owner') ? ownerLabel ?? 'Tüm satıcılar' : undefined}
        />
      )}
    </div>
  );
}

/**
 * Kapsam satırı / KPI rozeti. mode='period' → "Seçili dönem", mode='snapshot' → "Anlık" (dönemden bağımsız).
 */
export function ScopeLabel({ period, department, owner, mode = 'period', className }: {
  period?: string; department?: string; owner?: string; mode?: 'period' | 'snapshot'; className?: string;
}) {
  const parts = [mode === 'period' ? period : undefined, department, owner].filter(Boolean) as string[];
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-2 text-sm text-text-2', className)}>
      <span
        className={cn(
          'inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold',
          mode === 'period' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-text-2',
        )}
      >
        {mode === 'period' ? 'Seçili dönem' : 'Anlık'}
      </span>
      {parts.length > 0 && <span className="min-w-0 truncate" title={parts.join(' · ')}>{parts.join(' · ')}</span>}
    </div>
  );
}
