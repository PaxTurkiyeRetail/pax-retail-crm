import { useEffect, type ReactNode } from 'react';
import { cn } from './cn';

type DrawerProps = { open: boolean; onClose: () => void; side?: 'left' | 'right' | 'center'; title?: string; children: ReactNode };

/** side='left'|'right' drawer, 'center' modal. Esc ve arka plan tıklaması kapatır. */
export function Drawer({ open, onClose, side = 'left', title, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute flex flex-col border-solid border-border bg-surface text-text',
          side === 'left' && 'inset-y-0 left-0 w-[min(300px,85vw)] border-0 border-r',
          side === 'right' && 'inset-y-0 right-0 w-[min(420px,100vw)] border-0 border-l',
          side === 'center' && 'top-1/2 left-1/2 max-h-[85vh] w-[min(560px,calc(100vw-32px))] -translate-1/2 rounded-[4px] border',
        )}
      >
        {title && <div className="border-0 border-b border-solid border-border px-4 py-2.5 text-[13px] font-semibold">{title}</div>}
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export function Modal(p: Omit<DrawerProps, 'side'>) {
  return <Drawer {...p} side="center" />;
}
