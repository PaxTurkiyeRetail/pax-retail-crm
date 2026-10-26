'use client';

import { Children, isValidElement, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  value: string | number;
  onValueChange: (value: string) => void;
  children: ReactNode;
  label: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  style?: CSSProperties;
};

function optionText(value: ReactNode): string {
  return Children.toArray(value).map((part) => isValidElement<{ children?: ReactNode }>(part) ? optionText(part.props.children) : String(part)).join('');
}

// Browser/Windows native popup coordinates can drift at fractional display scaling.
// Render this form's menus in the document, with viewport bounds and keyboard access.
export default function ActivitySelect({ value, onValueChange, children, label, id, disabled, required, className, style }: Props) {
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', at: 0 });
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const [active, setActive] = useState(0);
  const options = Children.toArray(children).filter(isValidElement).map((child) => {
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    return { value: String(props.value ?? ''), text: optionText(props.children), disabled: props.disabled };
  });
  const selected = options.find((option) => option.value === String(value));

  const open = () => {
    if (disabled || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const upwards = below < 200 && above > below;
    const maxHeight = Math.min(280, Math.max(60, upwards ? above : below));
    setPosition({ position: 'fixed', left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: Math.min(rect.width, window.innerWidth - 16), maxHeight, ...(upwards ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }) });
    setActive(Math.max(0, options.findIndex((option) => option.value === String(value))));
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onValueChange(option.value);
    setPosition(null);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!position) return;
    const close = (event: Event) => {
      if (event.target instanceof Node && (menu.current?.contains(event.target) || trigger.current?.contains(event.target))) return;
      setPosition(null);
    };
    const resize = () => setPosition(null);
    document.addEventListener('pointerdown', close);
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', resize);
    };
  }, [position]);

  useEffect(() => {
    if (!position || !menu.current) return;
    const container = menu.current;
    const option = container.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!option) return;
    if (option.offsetTop < container.scrollTop) container.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > container.scrollTop + container.clientHeight) {
      container.scrollTop = option.offsetTop + option.offsetHeight - container.clientHeight;
    }
  }, [active, position]);

  return <>
    <button
      ref={trigger} id={id} type="button" role="combobox" aria-label={label}
      aria-expanded={Boolean(position)} aria-controls={position ? listId : undefined}
      aria-activedescendant={position ? `${listId}-${active}` : undefined}
      aria-haspopup="listbox" aria-required={required} disabled={disabled}
      className={className}
      style={{ fontWeight: 400, ...style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left', whiteSpace: 'normal', cursor: disabled ? 'default' : 'pointer' }}
      onClick={() => position ? setPosition(null) : open()}
      onBlur={(event) => { if (!menu.current?.contains(event.relatedTarget as Node)) setPosition(null); }}
      onKeyDown={(event) => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'].includes(event.key)) {
          event.preventDefault();
          if (event.key === 'Escape') { setPosition(null); return; }
          if (!position) { open(); return; }
          if (event.key === 'Enter' || event.key === ' ') { choose(active); return; }
          const direction = event.key === 'ArrowUp' ? -1 : 1;
          let next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : active + direction;
          while (next >= 0 && next < options.length && options[next].disabled) next += direction;
          if (next >= 0 && next < options.length) setActive(next);
        } else if (event.key === 'Tab') {
          setPosition(null);
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          search.current.text = Date.now() - search.current.at < 700 ? search.current.text + event.key : event.key;
          search.current.at = Date.now();
          const index = options.findIndex((option) => !option.disabled && option.text.toLocaleLowerCase('tr').startsWith(search.current.text.toLocaleLowerCase('tr')));
          if (index >= 0) { if (!position) open(); setActive(index); }
        }
      }}
    >
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{selected?.text ?? label}</span>
      <span aria-hidden="true" style={{ flexShrink: 0 }}>▾</span>
    </button>
    {position && !disabled && createPortal(
      <div ref={menu} id={listId} role="listbox" aria-label={label} style={{ ...position, zIndex: 10000, overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box', padding: 4, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.18)' }}>
        {options.map((option, index) => <div
          key={option.value} id={`${listId}-${index}`} data-index={index} role="option"
          aria-selected={option.value === String(value)} aria-disabled={option.disabled || undefined}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => choose(index)}
          onPointerMove={() => { if (!option.disabled) setActive(index); }}
          style={{ padding: '10px 12px', minHeight: 40, boxSizing: 'border-box', borderRadius: 6, overflowWrap: 'anywhere', cursor: option.disabled ? 'default' : 'pointer', background: index === active ? 'var(--accent)' : 'transparent', color: index === active ? '#fff' : 'var(--text)', opacity: option.disabled ? .5 : 1 }}
        >{option.text}</div>)}
      </div>, document.body,
    )}
  </>;
}
