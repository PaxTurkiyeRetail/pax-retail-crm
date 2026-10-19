import type { ReactNode } from 'react';

/** Sayfa gövdesi: 16px mobil kenar, yatay taşma yok, sakin aralıklar. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto box-border flex w-full max-w-[1600px] min-w-0 flex-col gap-5 px-4 py-4 text-[13px] text-text sm:px-6">{children}</div>
  );
}
