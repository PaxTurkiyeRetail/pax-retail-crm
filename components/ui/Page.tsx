import type { ReactNode } from 'react';

/** Sayfa gövdesi: tam genişlik, 16px mobil kenar, yatay taşma yok, marka ışıklı zemin. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="ds-page-bg box-border flex min-h-full w-full min-w-0 flex-col gap-5 px-4 py-5 text-[13px] text-text sm:px-6 sm:py-6">{children}</div>
  );
}
