import Link from 'next/link';
import { requireReportsAccessOrThrow } from '@/lib/authz';

const reportCards = [
  {
    href: '/crm/reports/management',
    title: 'Yönetim Dashboard',
    text: 'Toplam müşteri, künye durumu, sorumlu dağılımı ve operasyon sağlığını tek ekranda izleyin.',
    badge: '1 · Yönetim özeti',
    points: ['KPI kartları', 'Sorumlu dağılımı', 'Künye ve SLA görünümü'],
    tone: 'blue',
  },
  {
    href: '/crm/reports/weekly-activities',
    title: 'Haftalık Aktivite Raporu',
    text: 'Kişi, ekip ve firma bazlı haftalık aktivite yoğunluğunu teknik kırılım ile birlikte analiz edin.',
    badge: '2 · Aktivite analizi',
    points: ['Haftalık kırılım', 'Kişi ve ekip bazlı görünüm', 'Firma yoğunluğu'],
    tone: 'slate',
  },
];

function toneClasses(tone: 'blue' | 'slate') {
  if (tone === 'blue') {
    return {
      badge: 'border-blue-200 bg-blue-50 text-blue-700',
      strip: 'bg-blue-600',
      button: 'bg-blue-600 text-white',
    };
  }

  return {
    badge: 'border-slate-200 bg-slate-100 text-slate-700',
    strip: 'bg-slate-800',
    button: 'bg-slate-900 text-white',
  };
}

export default async function ReportsPage() {
  await requireReportsAccessOrThrow();

  return (
    <main className="min-h-full grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">
              Kurumsal CRM · Rapor Merkezi
            </span>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Raporlar</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Burada iki ayrı rapor bulunuyor. Yönetim ekranı genel resmi gösterir, haftalık aktivite ekranı ise saha ve ekip yoğunluğunu analiz eder.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Rapor sayısı</div>
              <div className="mt-1 text-2xl font-black text-slate-900">2</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Kullanım amacı</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">Yönetim + Haftalık operasyon</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {reportCards.map((item) => {
          const tone = toneClasses(item.tone as 'blue' | 'slate');
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group block overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`h-1.5 w-full ${tone.strip}`} />

              <div className="p-6">
                <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold ${tone.badge}`}>
                  {item.badge}
                </div>

                <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">{item.text}</p>

                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {item.points.map((point) => (
                    <div
                      key={point}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700"
                    >
                      {point}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Raporu aç</div>
                    <div className="text-sm font-semibold text-slate-800">Detay ekranına git</div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-bold ${tone.button}`}>
                    Aç
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
