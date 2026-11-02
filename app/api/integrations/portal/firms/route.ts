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
  customer_phase_no: number | null;
  customer_phase_name: string | null;
  roles: string[] | null;
  integration_enabled: boolean;
  account_manager: string | null;
  owner_user_id: string | null;
  domains: string[] | null;
};

// Salt okuma: tüm firmalar (müşteri/iş ortağı); rol ve yetenek portal ekranında rozet olarak gösterilir.
// Kişi adı/tam e-posta dışarı çıkmaz.
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
            cs.active_phase_no as customer_phase_no, cf.asama_adi as customer_phase_name,
            (select array_agg(r.role_key order by r.role_key) from public.organization_roles r
              where r.customer_id = m.id and r.is_active) as roles,
            coalesce(m.integration_enabled, false) as integration_enabled,
            m.sorumlu as account_manager, m.owner_user_id::text as owner_user_id,
            (select array_agg(distinct d.domain order by d.domain)
               from (select lower(split_part(btrim(c.email), '@', 2)) as domain
                       from public.customer_technical_contacts c
                      where c.customer_id = m.id and c.is_active and c.email like '%_@_%') d
              where d.domain <> '' and not (d.domain = any($3::text[]))) as domains
       from public.musteriler m
       left join public.organization_pipeline_states ps on ps.customer_id = m.id and ps.context_key = 'business_partner'
       left join public.is_ortagi_faz_tanimlari f on f.faz_no = ps.active_phase_no
       left join public.organization_pipeline_states cs on cs.customer_id = m.id and cs.context_key = 'customer'
       left join public.faz_tanimlari cf on cf.faz_no = cs.active_phase_no
      where ($1 = '' or m.musteri ilike '%' || replace(replace(replace($1, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%')
      order by m.musteri
      limit $2`,
    [q, limit, PUBLIC_EMAIL_DOMAINS],
  );

  return NextResponse.json({
    firms: rows.map((row) => ({
      id: row.id,
      name: row.name,
      roles: row.roles ?? [],
      integrationEnabled: row.integration_enabled,
      partnerPhase: row.phase_no == null ? null : { no: row.phase_no, name: row.phase_name },
      customerPhase: row.customer_phase_no == null ? null : { no: row.customer_phase_no, name: row.customer_phase_name },
      accountManager: row.account_manager,
      ownerUserId: row.owner_user_id,
      contactEmailDomains: row.domains ?? [],
      city: null,
    })),
  });
}
