import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildSellerFollowupReport } from '@/lib/reports/seller-followup';
import { buildFollowupSlideSpecs } from '@/lib/reports/seller-followup-pptx-shared';
import { assembleFollowupDeck } from '@/lib/reports/seller-followup-pptx-assemble';

// Takip Listesi sunumu (Sinan, 16.09.2026): "gönderdiğim pptx dosyalarını da çekebiliyor
// olmamız lazım, kişi bazlı filtreli ve hepsi de olacak şekilde".
//
// VERİ TEK KAYNAKTAN: sayılar `buildSellerFollowupReport()`ten gelir — ekrandaki Takip
// Listesi sekmesiyle aynı fonksiyon (altın kural 17). Sunum için ayrı sorgu/özet yazılmadı.
// Çizim `seller-followup-pptx-draw.ts`te, paket kurgusu `-assemble.ts`te durur; bu dosya
// yalnız veriyi toplar.

export async function generateSellerFollowupPptx(options?: { owner?: string; today?: Date }) {
  const owner = String(options?.owner ?? '').trim();
  const today = options?.today ?? new Date();

  // Kimler var? owner verilmezse ekrandaki "Tüm satıcılar" listesinin tamamı.
  const base = await buildSellerFollowupReport({ today });
  const owners = owner ? [owner] : base.ownerOptions;

  const decks = [];
  for (const person of owners) {
    const payload = await buildSellerFollowupReport({ owner: person, today });
    decks.push({
      owner: person,
      summary: payload.summary,
      rows: payload.rows.map((row) => ({
        musteri: row.musteri,
        konuKimde: row.konuKimde,
        modelAdetLabel: row.modelAdetLabel,
        takipKonusu: row.takipKonusu,
        cozumTarihi: row.cozumTarihi,
      })),
    });
  }

  const specs = buildFollowupSlideSpecs(decks);
  // Kendi şablonu: TEK boş slayt, grafik/not/medya yok (28 KB). Yönetim sunumunun 1,9 MB'lık
  // şablonu kullanılmıyordu artık — onun 18 slaydını silmek, silinen slaytlara ait grafik/SVG
  // ve notesMaster teması gibi parçaları pakette öksüz bırakıyor, PowerPoint de paketi
  // reddediyordu (16.09). Silinecek bir şey olmayan şablonla bu hata sınıfı tamamen kalkıyor.
  const templatePath = path.join(process.cwd(), 'templates', 'takip-listesi-template.pptx');
  const templateBuffer = await fs.readFile(templatePath);
  const buffer = await assembleFollowupDeck(templateBuffer, specs, today);
  return { buffer, slideCount: specs.length, owners };
}
