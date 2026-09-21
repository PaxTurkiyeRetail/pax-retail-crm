import { buildWorkbookBlob, type Cell, type Sheet } from '@/lib/xlsx/simple-workbook';

// Engel & Etki Excel çıktısı. Üretici 21.09'da `lib/xlsx/simple-workbook.ts`'e taşındı (Satış / Hizmet
// Fatura raporları da aynı paketi kullanır — tek üretici, altın kural 17). Bu dosya eski adı korur.
export type { Cell, Sheet };

export function buildBlockerImpactWorkbook(sheets: Sheet[]) {
  return buildWorkbookBlob(sheets, { title: 'Engel ve Etki Listesi' });
}
