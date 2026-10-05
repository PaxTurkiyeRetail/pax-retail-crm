import { redirect } from 'next/navigation';

// Dashboard /canli-ekran adresine taşındı (05.10.2026); eski yer imleri (?tab=...) korunur.
export default async function SellerFollowupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else if (value != null) qs.set(key, value);
  }
  redirect(qs.size ? `/canli-ekran?${qs}` : '/canli-ekran');
}
