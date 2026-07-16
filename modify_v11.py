from pathlib import Path
p=Path('/mnt/data/work_v11/lib/system-parameters.ts')
s=p.read_text()
# add phase groups after SYSTEM_BEHAVIOR_PARAMETER_GROUPS
s=s.replace("export const SYSTEM_BEHAVIOR_PARAMETER_GROUPS = [", "export const PHASE_PARAMETER_GROUPS = [\n  { key: 'faz_tanimlari', module: 'Liste Yönetimleri', category: 'Faz Yönetimi · Müşteri Pipeline', title: 'Müşteri Faz Tanımları', description: 'Normal müşteri pipeline fazları. Faz no, ad ve owner burada yönetilir.', type: 'phase' },\n  { key: 'is_ortagi_faz_tanimlari', module: 'Liste Yönetimleri', category: 'Faz Yönetimi · İş Ortakları', title: 'İş Ortağı Faz Tanımları', description: 'İş ortakları aktivitelerinde Account ekibinin kullanacağı ayrı faz listesi.', type: 'phase' },\n] as const;\n\nexport const SYSTEM_BEHAVIOR_PARAMETER_GROUPS = [")
s=s.replace("export const ALL_PARAMETER_GROUPS = [...KUNYE_PARAMETER_GROUPS, ...SYSTEM_BEHAVIOR_PARAMETER_GROUPS] as const;", "export const ALL_PARAMETER_GROUPS = [...KUNYE_PARAMETER_GROUPS, ...PHASE_PARAMETER_GROUPS, ...SYSTEM_BEHAVIOR_PARAMETER_GROUPS] as const;")
# Insert helper functions before listSystemParameters
insert = r'''
export type PhaseParameterRow = {
  id: string;
  source: 'customer' | 'business_partner';
  group_key: 'faz_tanimlari' | 'is_ortagi_faz_tanimlari';
  faz_no: number;
  asama_adi: string;
  owner: string | null;
  is_active: boolean;
  sort_order: number;
};

export async function ensureBusinessPartnerPhaseTable() {
  await db.query(`
    create table if not exists public.is_ortagi_faz_tanimlari (
      id uuid primary key default gen_random_uuid(),
      faz_no integer not null unique,
      asama_adi text not null,
      owner text null,
      is_active boolean not null default true,
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await db.query(`create index if not exists idx_is_ortagi_faz_tanimlari_active_sort on public.is_ortagi_faz_tanimlari (is_active, sort_order, faz_no)`);
}

function mapPhaseRow(row: any, source: 'customer' | 'business_partner'): PhaseParameterRow {
  const group_key = source === 'business_partner' ? 'is_ortagi_faz_tanimlari' : 'faz_tanimlari';
  return {
    id: String(row.id ?? `${group_key}:${row.faz_no}`),
    source,
    group_key,
    faz_no: Number(row.faz_no),
    asama_adi: String(row.asama_adi ?? '').trim(),
    owner: row.owner == null ? null : String(row.owner).trim(),
    is_active: typeof row.is_active === 'boolean' ? row.is_active : true,
    sort_order: Number(row.sort_order ?? row.faz_no ?? 0) || 0,
  };
}

export async function listPhaseParameters() {
  await ensureBusinessPartnerPhaseTable();
  const [customerPhases, partnerPhases] = await Promise.all([
    db.query(`
      select coalesce(id::text, faz_no::text) as id, faz_no, asama_adi, owner, true as is_active, faz_no as sort_order
      from public.faz_tanimlari
      order by faz_no asc
    `).catch(() => ({ rows: [] })),
    db.query(`
      select id::text, faz_no, asama_adi, owner, is_active, sort_order
      from public.is_ortagi_faz_tanimlari
      order by sort_order asc, faz_no asc
    `),
  ]);
  return [
    ...((customerPhases as any).rows ?? []).map((row: any) => mapPhaseRow(row, 'customer')),
    ...((partnerPhases as any).rows ?? []).map((row: any) => mapPhaseRow(row, 'business_partner')),
  ];
}

export async function createPhaseParameter(input: { groupKey: string; fazNo: number; asamaAdi: string; owner?: string | null; sortOrder?: number }) {
  const fazNo = Number(input.fazNo);
  if (!Number.isFinite(fazNo) || fazNo <= 0) throw Object.assign(new Error('Faz no pozitif sayı olmalı.'), { status: 400 });
  const asamaAdi = String(input.asamaAdi ?? '').trim();
  if (!asamaAdi) throw Object.assign(new Error('Faz adı zorunlu.'), { status: 400 });
  const owner = String(input.owner ?? '').trim() || null;
  if (input.groupKey === 'is_ortagi_faz_tanimlari') {
    await ensureBusinessPartnerPhaseTable();
    const result = await db.query(`
      insert into public.is_ortagi_faz_tanimlari (faz_no, asama_adi, owner, is_active, sort_order)
      values ($1, $2, $3, true, $4)
      on conflict (faz_no) do nothing
      returning id::text, faz_no, asama_adi, owner, is_active, sort_order
    `, [fazNo, asamaAdi, owner, Number(input.sortOrder ?? fazNo)]);
    if (!result.rows[0]) throw Object.assign(new Error('Bu iş ortağı faz no zaten var. Düzenle butonuyla güncelle.'), { status: 409 });
    return mapPhaseRow(result.rows[0], 'business_partner');
  }
  const result = await db.query(`
    insert into public.faz_tanimlari (faz_no, asama_adi, owner)
    values ($1, $2, $3)
    on conflict (faz_no) do nothing
    returning coalesce(id::text, faz_no::text) as id, faz_no, asama_adi, owner, true as is_active, faz_no as sort_order
  `, [fazNo, asamaAdi, owner]);
  if (!result.rows[0]) throw Object.assign(new Error('Bu müşteri faz no zaten var. Düzenle butonuyla güncelle.'), { status: 409 });
  return mapPhaseRow(result.rows[0], 'customer');
}

export async function updatePhaseParameter(input: { groupKey: string; id?: string; fazNo?: number; asamaAdi?: string; owner?: string | null; sortOrder?: number; isActive?: boolean }) {
  const fazNo = Number(input.fazNo);
  if (!Number.isFinite(fazNo) || fazNo <= 0) throw Object.assign(new Error('Faz no zorunlu.'), { status: 400 });
  const asamaAdi = typeof input.asamaAdi === 'string' ? input.asamaAdi.trim() : null;
  const owner = typeof input.owner === 'string' ? input.owner.trim() || null : undefined;
  if (input.groupKey === 'is_ortagi_faz_tanimlari') {
    await ensureBusinessPartnerPhaseTable();
    const result = await db.query(`
      update public.is_ortagi_faz_tanimlari
      set asama_adi = coalesce($2, asama_adi),
          owner = coalesce($3, owner),
          sort_order = coalesce($4, sort_order),
          is_active = coalesce($5, is_active),
          updated_at = now()
      where faz_no = $1
      returning id::text, faz_no, asama_adi, owner, is_active, sort_order
    `, [fazNo, asamaAdi, owner, input.sortOrder ?? null, typeof input.isActive === 'boolean' ? input.isActive : null]);
    return result.rows[0] ? mapPhaseRow(result.rows[0], 'business_partner') : null;
  }
  const result = await db.query(`
    update public.faz_tanimlari
    set asama_adi = coalesce($2, asama_adi),
        owner = coalesce($3, owner)
    where faz_no = $1
    returning coalesce(id::text, faz_no::text) as id, faz_no, asama_adi, owner, true as is_active, faz_no as sort_order
  `, [fazNo, asamaAdi, owner]);
  return result.rows[0] ? mapPhaseRow(result.rows[0], 'customer') : null;
}

export async function deletePhaseParameter(input: { groupKey: string; fazNo: number }) {
  const fazNo = Number(input.fazNo);
  if (input.groupKey === 'is_ortagi_faz_tanimlari') {
    await ensureBusinessPartnerPhaseTable();
    const result = await db.query('delete from public.is_ortagi_faz_tanimlari where faz_no = $1 returning faz_no', [fazNo]);
    return result.rowCount > 0;
  }
  const result = await db.query('delete from public.faz_tanimlari where faz_no = $1 returning faz_no', [fazNo]);
  return result.rowCount > 0;
}

export async function listPartnerPhaseOptions() {
  await ensureBusinessPartnerPhaseTable();
  const result = await db.query(`
    select faz_no, asama_adi, owner
    from public.is_ortagi_faz_tanimlari
    where is_active = true
    order by sort_order asc, faz_no asc
  `);
  return result.rows;
}
'''
s=s.replace("export async function listSystemParameters() {", insert+"\nexport async function listSystemParameters() {")
p.write_text(s)
