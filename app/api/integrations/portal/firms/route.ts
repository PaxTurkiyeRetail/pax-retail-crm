import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPortalRequest } from '@/lib/integrations/portal-auth';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 50;
// Genel e-posta sağlayıcıları firma eşleştirmesinde ayırt edici değil.
const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.tr', 'outlook.com', 'outlook.com.tr',
  'live.com', 'msn.com', 'yahoo.com', 'yahoo.com.tr', 'yandex.com', 'yandex.com.tr', 'icloud.com', 'me.com', 'mynet.com',
];

type FirmRow = {
  id: string;
  name: string;
  phase_no: number | null;
  phase_name: string | null;
  account_manager: string | null;
  owner_user_id: string | null;
  domains: string[] | null;
};

// Salt okuma: yalnız aktif iş ortağı rolündeki firmalar; kişi adı/tam e-posta dışarı çıkmaz.
export async function GET(request: Request) {
  const auth = verifyPortalRequest(request);
  if (!auth.ok) return NextResponse.json({ message: auth.status === 503 ? 'unavailable' : 'unauthorized' }, { status: auth.status });

  const params = new URL(request.url).searchParams;
  const q = (params.get('q') ?? '').trim().slice(0, 100);
  const requested = Number(params.get('limit') ?? MAX_LIMIT);
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : MAX_LIMIT;

  const { rows } = await db.query<FirmRow>(
    `select m.id, m.musteri as name,
            ps.active_phase_no as phase_no, f.asama_adi as phase_name,
            m.sorumlu as account_manager, m.owner_user_id::text as owner_user_id,
            (select array_agg(distinct d.domain order by d.domain)
               from (select lower(split_part(btrim(c.email), '@', 2)) as domain
                       from public.customer_technical_contacts c
                      where c.customer_id = m.id and c.is_active and c.email like '%_@_%') d
              where d.domain <> '' and not (d.domain = any($3::text[]))) as domains
       from public.musteriler m
       join public.organization_roles r on r.customer_id = m.id and r.role_key = 'business_partner' and r.is_active
       left join public.organization_pipeline_states ps on ps.customer_id = m.id and ps.context_key = 'business_partner'
       left join public.is_ortagi_faz_tanimlari f on f.faz_no = ps.active_phase_no
      where ($1 = '' or m.musteri ilike '%' || replace(replace(replace($1, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%')
      order by m.musteri
      limit $2`,
    [q, limit, PUBLIC_EMAIL_DOMAINS],
  );

  return NextResponse.json({
    firms: rows.map((row) => ({
      id: row.id,
      name: row.name,
      partnerPhase: row.phase_no == null ? null : { no: row.phase_no, name: row.phase_name },
      accountManager: row.account_manager,
      ownerUserId: row.owner_user_id,
      contactEmailDomains: row.domains ?? [],
      city: null,
    })),
  });
}
