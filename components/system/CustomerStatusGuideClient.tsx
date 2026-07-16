"use client";
import '@/styles/customer-status-guide.css';

const RULES = [
  {
    title: 'Aday',
    tone: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    logic: ['Aktif faz yok veya anlamlı fırsat sinyali henüz oluşmadı.', 'Yeni kayıt veya erken keşif seviyesi.'],
    management: 'Yeni Kazanım',
  },
  {
    title: 'Fırsat',
    tone: { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' },
    logic: ['Faz 1–23 arasında ve canlı müşteri sinyali yok.', 'Satış süreci devam ediyor.'],
    management: 'Yeni Kazanım',
  },
  {
    title: 'Kazanılmış Müşteri',
    tone: { bg: '#ecfdf3', border: '#bbf7d0', text: '#166534' },
    logic: ['Faz 24–25, aktif cihaz > 0 veya go-live sinyali var.', 'Müşteri artık portföyde canlı durumda.'],
    management: 'Elde Tutma',
  },
  {
    title: 'Gelişen Müşteri',
    tone: { bg: '#ecfeff', border: '#a5f3fc', text: '#155e75' },
    logic: ['Kazanılmış müşteri + son 90 günde 2 veya daha fazla büyüme sinyali.', 'Örnek sinyaller: yeni opportunity, yeni teklif, cihaz artışı, rollout genişlemesi.'],
    management: 'Büyütme',
  },
  {
    title: 'Riskli Müşteri',
    tone: { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
    logic: ['Kazanılmış müşteri + 60+ gün hareketsizlik veya 2+ risk sinyali.', 'Örnek sinyaller: temas yok, açık problem, uzun süredir ilerlemeyen konu.'],
    management: 'Elde Tutma',
  },
  {
    title: 'Pasif',
    tone: { bg: '#f8fafc', border: '#cbd5e1', text: '#475569' },
    logic: ['180+ gün aktivite yok + açık fırsat yok + büyüme sinyali yok.', 'Portföyde kalır ama yeniden aktivasyon yaklaşımı gerekir.'],
    management: 'Elde Tutma',
  },
] as const;

const PRIORITY = ['Pasif', 'Riskli Müşteri', 'Gelişen Müşteri', 'Kazanılmış Müşteri', 'Fırsat', 'Aday'] as const;

const FUTURE_SIGNALS = [
  'last_activity_days',
  'open_opportunity_count',
  'active_device_count',
  'growth_signal_count',
  'risk_signal_count',
  'go_live_date / has_go_live',
];

export default function CustomerStatusGuideClient() {
  return (
    <main className="guide-page">
      <section className="pax-hero">
        <div>
          <p className="eyebrow">Kural Rehberi</p>
          <h1>Müşteri Durumu & Yönetim Tipi Rehberi</h1>
          <p className="sub">
            Bu sayfa ekip için ortak karar sözlüğüdür. Şu an UI ve kural hafızası aktif; backend bağlandığında aynı kurallar gerçek veriden otomatik çalışacak.
          </p>
        </div>
        <div className="hero-note">
          <div className="hero-note-title">Şu anki mod</div>
          <p>Phase fallback açık. Derin sinyaller bağlandığında rule engine canlıya geçecek.</p>
        </div>
      </section>

      <section className="grid">
        {RULES.map((rule) => (
          <article className="card" key={rule.title} style={{ background: rule.tone.bg, borderColor: rule.tone.border }}>
            <div className="card-top">
              <h3 style={{ color: rule.tone.text }}>{rule.title}</h3>
              <span className="pill">{rule.management}</span>
            </div>
            <ul>
              {rule.logic.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="layout-2">
        <article className="panel">
          <div className="panel-kicker">Öncelik Sırası</div>
          <h2>Çakışma olduğunda hangisi kazanır?</h2>
          <ol>
            {PRIORITY.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <p className="foot">Örnek: Bir müşteri hem büyüyor hem de çok uzun süredir temas almıyorsa önce risk değerlendirilir.</p>
        </article>

        <article className="panel">
          <div className="panel-kicker">Backend Sonra Bağlanacak</div>
          <h2>Gerçek rule engine için ihtiyaç duyulan sinyaller</h2>
          <ul>
            {FUTURE_SIGNALS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="foot">Bu alanlar müşteri, activity, opportunity ve rollout verilerinden üretilebilir. Ayrı tablo zorunlu değildir.</p>
        </article>
      </section>

      <section className="layout-2">
        <article className="panel">
          <div className="panel-kicker">Override Mantığı</div>
          <h2>Firma detay sayfasında manuel güncelleme nasıl çalışır?</h2>
          <ul>
            <li>Sistem önce kendi önerisini üretir.</li>
            <li>Kullanıcı isterse Firma Durumu ve Yönetim Tipi alanlarını manuel değiştirir.</li>
            <li>“Sistem önerisine dön” ile override temizlenir ve otomatik kurgu yeniden aktif olur.</li>
          </ul>
          <p className="foot">Demo aşamasında bu seçim local storage üzerinde tutulur. Backend bağlandığında kalıcı alanlara yazılacaktır.</p>
        </article>

        <article className="panel">
          <div className="panel-kicker">Backend Sonra Bağlanacak</div>
          <h2>Kalıcı kayıt için eklenecek alanlar</h2>
          <ul>
            <li>customer relationship status</li>
            <li>management type</li>
            <li>manual override flag</li>
            <li>manual override updated at</li>
            <li>manual override updated by</li>
          </ul>
          <p className="foot">İlk aşamada UI ve karar mantığı hazır. Veri tabanı katmanı sonra bağlanacak.</p>
        </article>
      </section>

      <section className="matrix panel">
        <div className="panel-kicker">Yönetim Tipi Matrisi</div>
        <h2>Firma Durumu → Yönetim Tipi eşlemesi</h2>
        <div className="matrix-grid">
          <div><strong>Aday</strong><span>Yeni Kazanım</span></div>
          <div><strong>Fırsat</strong><span>Yeni Kazanım</span></div>
          <div><strong>Kazanılmış Müşteri</strong><span>Elde Tutma</span></div>
          <div><strong>Gelişen Müşteri</strong><span>Büyütme</span></div>
          <div><strong>Riskli Müşteri</strong><span>Elde Tutma</span></div>
          <div><strong>Pasif</strong><span>Elde Tutma</span></div>
        </div>
      </section>

    </main>
  );
}
