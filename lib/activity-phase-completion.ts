import { createPgAdminClient } from '@/lib/pg/admin';

type Params = {
  musteri_id: string;
  faz_no: number;
  actor: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  owner?: string | null;
  partner_owner?: string | null;
  notlar?: string | null;
  exclude_id?: string | null;
};

export async function completeActivitiesForSamePhase(params: Params) {
  const admin = createPgAdminClient();

  let query = admin
    .from('pipeline_eventleri')
    .update({
      durum: 'Tamamlandı',
      updated_by_user_id: params.actor_user_id ?? null,
      updated_by_email: params.actor_email ?? null,
      updated_at: new Date().toISOString(),
      ...(params.owner !== undefined ? { owner: params.owner ?? null } : {}),
      ...(params.partner_owner !== undefined ? { partner_owner: params.partner_owner ?? null } : {}),
      ...(params.notlar !== undefined ? { notlar: params.notlar ?? null } : {}),
    })
    .eq('musteri_id', params.musteri_id)
    .eq('faz_no', params.faz_no)
    .ilike('aksiyon', 'AKTIVITE:%')
    .neq('durum', 'Tamamlandı');

  if (params.exclude_id) query = query.neq('id', params.exclude_id);

  const { error } = await query;
  if (error) throw error;

  const { error: pipelineErr } = await admin.from('musteri_pipeline').upsert(
    {
      musteri_id: params.musteri_id,
      aktif_faz_no: params.faz_no,
      durum: 'Tamamlandı',
      owner: params.owner ?? null,
      partner_owner: params.partner_owner ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'musteri_id' }
  );

  if (pipelineErr) throw pipelineErr;
}


export async function completePreviousOpenActivities(params: Params) {
  const admin = createPgAdminClient();

  const { error } = await admin
    .from('pipeline_eventleri')
    .update({
      durum: 'Tamamlandı',
      updated_by_user_id: params.actor_user_id ?? null,
      updated_by_email: params.actor_email ?? null,
      updated_at: new Date().toISOString(),
      ...(params.partner_owner !== undefined ? { partner_owner: params.partner_owner ?? null } : {}),
    })
    .eq('musteri_id', params.musteri_id)
    .lt('faz_no', params.faz_no)
    .ilike('aksiyon', 'AKTIVITE:%')
    .in('durum', ['Devam Ediyor', 'Başlamadı']);

  if (error) throw error;
}
