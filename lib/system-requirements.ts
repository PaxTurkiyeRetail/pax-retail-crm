export type RequirementStatus = "mock" | "db" | "automation" | "ready" | "schema";

export type RequirementItem = {
  title: string;
  summary: string;
  status: RequirementStatus;
  module: string;
  db?: string[];
  backend?: string[];
  ui?: string[];
  notes?: string[];
};

export const SYSTEM_REQUIREMENTS: Record<string, RequirementItem> = {
  dashboard: {
    title: 'Dashboard · Yapılması Gerekenler',
    summary: 'Faz sağlık metrikleri ve teklif/follow-up otomasyon özeti için ek veri katmanı gerekiyor.',
    status: 'automation',
    module: 'Dashboard',
    db: ['Faz log tablosu aktive edilince tekrar sayısı ve tıkanan müşteri analitiği gerçek veriden beslenecek.'],
    backend: ['Teklif → aktivite → SLA zinciri için otomatik iş akışı bağlanacak.', 'Dashboard kartları için faz health aggregator eklenecek.'],
    ui: ['Üst yönetim kartlarında faz tekrar / stuck müşteri göstergeleri açılacak.'],
    notes: ['Şu an mevcut CRM istatistikleri ile çalışır.', 'Derin faz raporu için future-ready durumda.'],
  },
  customerList: {
    title: 'Müşteri Listesi · Yapılması Gerekenler',
    summary: 'Firma Durumu ve Yönetim Tipi listede görünüyor. Gelişen/Riskli/Pasif kuralları backend sinyalleri bağlanınca otomatik derinleşecek.',
    status: 'db',
    module: 'Müşteri Listesi',
    db: ['Son aktivite tarihi, açık fırsat sayısı, aktif cihaz adedi ve büyüme sinyali alanları sonra bağlanacak.'],
    backend: ['Liste API çıktısına segmentation signals eklenecek.', 'Rule engine müşteri listesinde gerçek veri ile çalışacak.'],
    ui: ['Firma Durumu ve Yönetim Tipi badge alanı aktif.', 'Filtre katmanında Firma Durumu ve Yönetim Tipi seçimleri aktif.'],
    notes: ['Şu an faz fallback ile çalışır.', 'Liste filtresi ilk aşamada UI seviyesinde çalışır; backend bağlanınca gerçek veri ve sunucu tarafı filtre ile derinleşecek.', 'Backend bağlanana kadar gelişen/riskli/pasif ayrımı gösterim rehberinde anlatılan kurallar ile not seviyesinde tutulur.'],
  },
  customerDetail: {
    title: 'Müşteri Detayı · Yapılması Gerekenler',
    summary: 'Fazlar sekmesi hazır. Firma Durumu ve Yönetim Tipi ilk aşamada faz bazlı otomatik türetiliyor; kalıcı alanlar ve ileri sinyaller sonra bağlanacak.',
    status: 'db',
    module: 'Müşteri Detayı',
    db: ['customer_phase_logs tablosu eklenecek.', 'Firma durumu ve yönetim tipi için kalıcı alanlar sonra eklenecek.', 'Son aktivite, aktif cihaz, açık fırsat ve growth/risk signal alanları sonra bağlanacak.'],
    backend: ['Aynı faz yeniden açıldığında reopened kaydı oluşturulacak.', 'Tamamlanan faz sayısı ve tekrar badge gerçek logdan beslenecek.', 'Kural motoru için segmentation signals servis katmanına eklenecek.'],
    ui: ['5 ana faz + 1-25 alt faz görünümü aktif.', 'Geçmiş log boş durum kartı ile gösteriliyor.', 'Firma durumu ve yönetim tipi otomatik gösteriliyor.', 'Firma detayında manuel override UI aktif; backend gelene kadar local demo hafızası ile çalışıyor.'],
    notes: ['Mevcut aktif faz numarası ekrandan okunuyor.', 'History ve tekrar sayıları şu an hazırlık modunda.', 'Backend bağlanınca guide sayfasındaki kurallar gerçek veriye taşınacak.', 'Kalıcı override alanları (status, management type, override flag, updated by/at) sonra eklenecek.'],
  },
  customerGuide: {
    title: 'Müşteri Durumu Rehberi · Yapılması Gerekenler',
    summary: 'Bu sayfa kural setini görünür kılar. Şu an rehber ve tasarım aktif; backend sinyalleri bağlanınca kurallar canlı veri ile çalışacak.',
    status: 'schema',
    module: 'Müşteri Durumu Rehberi',
    db: ['Ayrı tablo şart değil; önce mevcut müşteri/opportunity/activity verileri kullanılabilir.', 'İstenirse ileride customer_status_snapshot veya signal cache katmanı eklenebilir.'],
    backend: ['Segmentation rule engine servis katmanı ile beslenecek.', 'Guide sayfasındaki eşikler merkezi config olarak tutulabilir.'],
    ui: ['Kural kartları, öncelik sırası ve yönetim tipi matrisi aktif.', 'Sayfa ekip içi referans / eğitim ekranı olarak kullanılabilir.'],
    notes: ['Şu an rehber sayfası tasarım ve kural hafızası amaçlıdır.', 'Firma detayındaki manuel override akışı rehbere işlendi.', 'Canlı hesaplama bağlanana kadar rehber üzerinden ortak dil korunur.'],
  },
  quotes: {
    title: 'Teklif Portföyü · Yapılması Gerekenler',
    summary: 'Teklif akışının aktivite ve SLA tarafı için otomasyon katmanı planlandı.',
    status: 'automation',
    module: 'Teklifler',
    db: ['quotes, quote_items, quote_products, quote_pricing_rules tabloları kontrol edilecek.'],
    backend: ['Teklif oluşturulunca aktivite kaydı açılacak.', 'SLA +30 gün ve geçerlilik +15 gün otomatik akacak.', 'Follow-up görevi otomatik üretilecek.'],
    ui: ['Portföy ekranına süreç sağlık göstergesi eklenecek.'],
    notes: ['Liste ve detay ekranı çalışır durumda.', 'Otomasyon bağlanana kadar manuel takip gerekir.'],
  },
  quoteBuilder: {
    title: 'Teklif Oluştur · Yapılması Gerekenler',
    summary: 'Teklif verildiği anda aktivite ve fırsat ilerleme bağı kurulacak.',
    status: 'automation',
    module: 'Teklif Oluştur',
    db: ['İleride teklif versiyonlama gerekirse quote_versions tablosu düşünülebilir.'],
    backend: ['Teklif kaydı sonrası aktivite oluştur.', 'İstenirse ilgili fırsatı otomatik bir üst faza taşı.', 'Yüzde olasılık alanını pipeline tarafı ile senkronize et.'],
    ui: ['Kaydet sonrası otomasyon özeti toast / info card ile gösterilecek.'],
    notes: ['Şu an teklif üretimi manuel kontrol mantığında.'],
  },
  quoteCatalog: {
    title: 'Ürün & Fiyat Yönetimi · Yapılması Gerekenler',
    summary: 'Ürün katalog ekranı hazır. Şema büyütme ve toplu yükleme opsiyonları işaretlendi.',
    status: 'schema',
    module: 'Ürün & Fiyat',
    db: ['Para birimi alanı opsiyonel olarak eklenecek.', 'KDV / vergi alanı istenirse katalog seviyesinde saklanacak.', 'CSV import için staging alanı gerekebilir.'],
    backend: ['Toplu fiyat güncelleme import servisi eklenebilir.', 'Geçmiş fiyat versiyonlama gerekiyorsa rule history tablosu açılacak.'],
    ui: ['Şu an manuel yeni ürün + barem yönetimi aktif.', 'CSV yükleme butonu sonraki fazda açılacak.'],
    notes: ['Katalog ekranı canlı kullanım için hazır; ileri ihtiyaçlar notlandı.'],
  },

me: {
  title: 'Benim Ekranım · Yapılması Gerekenler',
  summary: 'Kullanıcının kişisel ana ekranı hazır. Gerçek hedef, mail ve owner bazlı veriler backend bağlanınca aktif olacak.',
  status: 'db',
  module: 'Benim Ekranım',
  db: ['Kullanıcı hedef tabloları sonra bağlanacak.', 'Owner bazlı müşteri, fırsat, teklif ve aktivite ilişkileri gerçek veri ile beslenecek.', 'Mail analitiği için Gmail / Outlook entegrasyonu sonra eklenecek.'],
  backend: ['Auth user ile kişisel görünüm bağlanacak.', 'AI öneri ve risk motoru kullanıcı bazlı çalışacak.'],
  ui: ['Kişisel KPI, risk ve AI destek alanı aktif.'],
  notes: ['Şu an UI-first demo modunda çalışır.'],
},
novaCore: {
  title: 'Nova Core · Yapılması Gerekenler',
  summary: 'Organizasyonel yapı, AI programlar, AI agentlar ve hibrit model CRM içine alındı. İleride rol bazlı kişiselleştirme derinleştirilecek.',
  status: 'ready',
  module: 'Nova Core',
  ui: ['Nova Core sayfası CRM içinde açılır.', 'Onboarding ve organizasyonel hafıza katmanı olarak kullanılabilir.'],
  notes: ['İçerik şu an HTML tabanlı embed ile çalışır.', 'İstenirse ileride React component yapısına dönüştürülebilir.'],
},
  systemTracker: {
    title: 'Sistem Gereksinimleri · Yapılması Gerekenler',
    summary: 'Bu ekran proje hafızasıdır. Her sayfadaki eksikleri tek yerde toplar.',
    status: 'ready',
    module: 'Sistem Gereksinimleri',
    ui: ['Sayfa bazlı DB / backend / UI ihtiyaçları listelenir.'],
    notes: ['Yeni modül eklenirse buraya bir kayıt daha açılmalı.'],
  },
};

export const SYSTEM_REQUIREMENT_LIST = Object.entries(SYSTEM_REQUIREMENTS).map(([key, value]) => ({ key, ...value }));
