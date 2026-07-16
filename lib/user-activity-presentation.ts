import 'server-only';
import { Buffer } from 'node:buffer';
import { activityLabelFromRow, normalizeDurum } from '@/app/api/activities/_helpers';
import { normalizeChannel } from '@/lib/activity-channels';
import { db } from '@/lib/db';

export type ActivityReportUser = {
  id: string;
  directory_user_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string;
  label: string;
  source: 'directory' | 'legacy';
  is_active: boolean;
  historical_activity_count: number;
};

export type ActivityReportMeta = {
  min_date: string | null;
  max_date: string | null;
  historical_activity_count: number;
};

export type UserActivityPresentationRow = {
  no: number;
  musteri_id: string;
  firma_adi: string;
  sektor: string;
  kasa_firmasi: string;
  fiziki_ziyaret_adedi: number;
  online_gorusme_adedi: number;
  poc_durumu: 'Evet' | 'Hayır';
  entegrasyon_durumu: 'Başlamadı' | 'Devam Ediyor' | 'Tamamlandı' | 'İhtiyaç Duyulmadı';
  toplam_aktivite: number;
  son_aktivite_tarihi: string | null;
};

export type UserActivityPresentationPayload = {
  filters: {
    from: string;
    to: string;
    user_id: string;
    user_name: string;
    user_email: string;
    date_range_label: string;
    selection_source: 'directory' | 'legacy';
  };
  summary: {
    totalActivities: number;
    distinctCustomers: number;
    physicalVisits: number;
    onlineMeetings: number;
    pocCustomers: number;
    completedIntegrations: number;
  };
  rows: UserActivityPresentationRow[];
  generated_at: string;
  legacy_name_fallback_used: boolean;
  data_quality: {
    stable_id_count: number;
    email_count: number;
    legacy_name_count: number;
    owner_fallback_count: number;
    historical_records_included: boolean;
    warning: string | null;
  };
};

type RawActivity = {
  id: string;
  musteri_id: string;
  aksiyon: string | null;
  durum: string | null;
  created_at: string;
  created_by: string | null;
  owner: string | null;
  created_by_user_id: string | null;
  created_by_email: string | null;
};

type PhaseEvent = {
  musteri_id: string;
  faz_no: number | null;
  durum: string | null;
  created_at: string;
  asama_adi: string | null;
};

type DirectoryUserRow = {
  id: string;
  full_name: string | null;
  email: string;
  role: string | null;
  is_active: boolean;
};

type LegacyCreatorRow = {
  creator_name: string;
  activity_count: number;
  first_activity_at: string | null;
  last_activity_at: string | null;
};

type ResolvedSelection = {
  selectionKey: string;
  source: 'directory' | 'legacy';
  directoryUserId: string | null;
  name: string;
  email: string;
  role: string;
  nameFallbackAllowed: boolean;
  legacyName: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_PREFIX = 'user:';
const LEGACY_PREFIX = 'legacy:';

function validateDate(value: string, label: string) {
  if (!DATE_RE.test(value)) throw Object.assign(new Error(`${label} geçersiz.`), { status: 400 });
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isExact = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isExact) throw Object.assign(new Error(`${label} geçersiz.`), { status: 400 });
  return date;
}

function clean(value: unknown, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeSearch(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ');
}

function sqlNormalized(expression: string) {
  return `regexp_replace(translate(lower(trim(coalesce(${expression}, ''))), 'çğıöşüİÇĞIÖŞÜ', 'cgiosuiCGIOSU'), '\\s+', ' ', 'g')`;
}

function formatDateRange(from: string, to: string) {
  const formatter = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return `${formatter.format(new Date(`${from}T12:00:00Z`))} - ${formatter.format(new Date(`${to}T12:00:00Z`))}`;
}

function legacySelectionKey(name: string) {
  return `${LEGACY_PREFIX}${Buffer.from(name, 'utf8').toString('base64url')}`;
}

function decodeLegacySelectionKey(value: string) {
  try {
    return Buffer.from(value.slice(LEGACY_PREFIX.length), 'base64url').toString('utf8').trim();
  } catch {
    return '';
  }
}

function isPocPhase(event: PhaseEvent) {
  const status = normalizeDurum(event.durum);
  if (!status || status === 'Başlamadı') return false;
  const phaseNo = event.faz_no == null ? null : Number(event.faz_no);
  const phaseName = normalizeSearch(event.asama_adi);
  return (phaseNo != null && phaseNo >= 15 && phaseNo <= 23) || phaseName.includes('pilot') || phaseName.includes('poc');
}

function integrationStatusFromHistory(events: PhaseEvent[]): UserActivityPresentationRow['entegrasyon_durumu'] {
  const meaningful = events.filter((event) => {
    const status = normalizeDurum(event.durum);
    return status && status !== 'Başlamadı';
  });
  const latest = meaningful[meaningful.length - 1] ?? events[events.length - 1];
  if (!latest) return 'Başlamadı';

  const status = normalizeDurum(latest.durum);
  if (status === 'İhtiyaç Duyulmadı') return 'İhtiyaç Duyulmadı';

  const phaseNo = latest.faz_no == null ? null : Number(latest.faz_no);
  const phaseName = normalizeSearch(latest.asama_adi);
  const explicitlyCompleted = status === 'Tamamlandı';
  const rolloutOrLive =
    (phaseNo != null && phaseNo >= 24) ||
    phaseName.includes('rollout') ||
    phaseName.includes('yayilim') ||
    phaseName.includes('canli') ||
    phaseName.includes('tamamlan');
  const integrationOrPilot =
    (phaseNo != null && phaseNo >= 15) ||
    phaseName.includes('entegrasyon') ||
    phaseName.includes('pilot') ||
    phaseName.includes('poc');

  if (rolloutOrLive && explicitlyCompleted) return 'Tamamlandı';
  if (phaseNo != null && phaseNo >= 24) return 'Tamamlandı';
  if (integrationOrPilot) return 'Devam Ediyor';
  return 'Başlamadı';
}

async function pipelineIdentityColumns() {
  const result = await db.query<{ column_name: string }>(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'pipeline_eventleri'
        and column_name = any($1::text[])
    `,
    [['created_by_user_id', 'created_by_email', 'updated_by_user_id', 'updated_by_email', 'updated_at']]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function fetchDirectoryUsers(): Promise<DirectoryUserRow[]> {
  const result = await db.query<DirectoryUserRow>(
    `
      select id::text as id, full_name, email, role, is_active
      from public.allowed_users
      order by coalesce(nullif(trim(full_name), ''), email) asc, email asc
    `
  );
  return result.rows;
}

async function fetchLegacyCreators(): Promise<LegacyCreatorRow[]> {
  const result = await db.query<LegacyCreatorRow>(
    `
      select
        coalesce(nullif(trim(created_by), ''), nullif(trim(owner), '')) as creator_name,
        count(*)::int as activity_count,
        min(created_at) as first_activity_at,
        max(created_at) as last_activity_at
      from public.pipeline_eventleri
      where coalesce(aksiyon, '') like 'AKTIVITE:%'
        and coalesce(nullif(trim(created_by), ''), nullif(trim(owner), '')) is not null
      group by coalesce(nullif(trim(created_by), ''), nullif(trim(owner), ''))
      order by max(created_at) desc
    `
  );
  return result.rows;
}

export async function getActivityReportMeta(): Promise<ActivityReportMeta> {
  const result = await db.query<{
    min_date: string | null;
    max_date: string | null;
    historical_activity_count: number;
  }>(
    `
      select
        to_char(min(created_at at time zone 'Europe/Istanbul'), 'YYYY-MM-DD') as min_date,
        to_char(max(created_at at time zone 'Europe/Istanbul'), 'YYYY-MM-DD') as max_date,
        count(*)::int as historical_activity_count
      from public.pipeline_eventleri
      where coalesce(aksiyon, '') like 'AKTIVITE:%'
    `
  );
  const row = result.rows[0];
  return {
    min_date: row?.min_date ?? null,
    max_date: row?.max_date ?? null,
    historical_activity_count: Number(row?.historical_activity_count ?? 0),
  };
}

export async function listActivityReportUsers(): Promise<ActivityReportUser[]> {
  const [directoryUsers, rawLegacyCreators] = await Promise.all([
    fetchDirectoryUsers(),
    fetchLegacyCreators(),
  ]);

  const legacyByNormalizedName = new Map<string, LegacyCreatorRow>();
  for (const row of rawLegacyCreators) {
    const creatorName = clean(row.creator_name, '');
    const normalized = normalizeSearch(creatorName);
    if (!normalized) continue;
    const current = legacyByNormalizedName.get(normalized);
    if (!current) {
      legacyByNormalizedName.set(normalized, { ...row, creator_name: creatorName, activity_count: Number(row.activity_count ?? 0) });
      continue;
    }
    current.activity_count += Number(row.activity_count ?? 0);
    if (row.first_activity_at && (!current.first_activity_at || row.first_activity_at < current.first_activity_at)) current.first_activity_at = row.first_activity_at;
    if (row.last_activity_at && (!current.last_activity_at || row.last_activity_at > current.last_activity_at)) {
      current.last_activity_at = row.last_activity_at;
      current.creator_name = creatorName;
    }
  }

  const directoryLookup = new Map<string, DirectoryUserRow[]>();
  const addDirectoryLookup = (key: string, user: DirectoryUserRow) => {
    if (!key) return;
    const list = directoryLookup.get(key) ?? [];
    list.push(user);
    directoryLookup.set(key, list);
  };
  for (const user of directoryUsers) {
    addDirectoryLookup(normalizeSearch(user.full_name), user);
    addDirectoryLookup(normalizeSearch(user.email), user);
  }

  const historicalCountByUserId = new Map<string, number>();
  const matchedLegacyNames = new Set<string>();
  for (const [normalized, legacy] of legacyByNormalizedName) {
    const matches = directoryLookup.get(normalized) ?? [];
    const uniqueIds = Array.from(new Set(matches.map((user) => user.id)));
    if (uniqueIds.length !== 1) continue;
    const userId = uniqueIds[0];
    historicalCountByUserId.set(userId, (historicalCountByUserId.get(userId) ?? 0) + Number(legacy.activity_count ?? 0));
    matchedLegacyNames.add(normalized);
  }

  const directoryOptions: ActivityReportUser[] = directoryUsers
    .map((user) => {
      const historicalCount = historicalCountByUserId.get(user.id) ?? 0;
      const displayName = clean(user.full_name, user.email);
      const stateLabel = user.is_active ? '' : ' · Pasif kullanıcı';
      const countLabel = historicalCount > 0 ? ` · ${historicalCount.toLocaleString('tr-TR')} geçmiş aktivite` : '';
      return {
        id: `${USER_PREFIX}${user.id}`,
        directory_user_id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: String(user.role ?? 'user'),
        label: `${displayName} — ${user.email}${stateLabel}${countLabel}`,
        source: 'directory' as const,
        is_active: Boolean(user.is_active),
        historical_activity_count: historicalCount,
      };
    })
    .filter((user) => user.is_active || user.historical_activity_count > 0);

  const legacyOptions: ActivityReportUser[] = Array.from(legacyByNormalizedName.entries())
    .filter(([normalized]) => !matchedLegacyNames.has(normalized))
    .map(([, legacy]) => {
      const name = clean(legacy.creator_name, 'Bilinmeyen kullanıcı');
      const count = Number(legacy.activity_count ?? 0);
      return {
        id: legacySelectionKey(name),
        directory_user_id: null,
        full_name: name,
        email: null,
        role: 'legacy',
        label: `${name} — Geçmiş kayıt (${count.toLocaleString('tr-TR')} aktivite)`,
        source: 'legacy' as const,
        is_active: false,
        historical_activity_count: count,
      };
    });

  return [...directoryOptions, ...legacyOptions].sort((a, b) => {
    if (a.source !== b.source) return a.source === 'directory' ? -1 : 1;
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return a.label.localeCompare(b.label, 'tr');
  });
}

async function resolveSelection(selectionKey: string): Promise<ResolvedSelection> {
  if (selectionKey.startsWith(LEGACY_PREFIX)) {
    const legacyName = decodeLegacySelectionKey(selectionKey);
    if (!legacyName) throw Object.assign(new Error('Geçmiş kullanıcı seçimi geçersiz.'), { status: 400 });
    return {
      selectionKey,
      source: 'legacy',
      directoryUserId: null,
      name: legacyName,
      email: '',
      role: 'legacy',
      nameFallbackAllowed: true,
      legacyName,
    };
  }

  const rawUserId = selectionKey.startsWith(USER_PREFIX) ? selectionKey.slice(USER_PREFIX.length) : selectionKey;
  if (!UUID_RE.test(rawUserId)) throw Object.assign(new Error('Seçilen kullanıcı geçersiz.'), { status: 400 });

  const userResult = await db.query<DirectoryUserRow>(
    `
      select id::text as id, full_name, email, role, is_active
      from public.allowed_users
      where id::text = $1
      limit 1
    `,
    [rawUserId]
  );
  const user = userResult.rows[0];
  if (!user) throw Object.assign(new Error('Seçilen kullanıcı bulunamadı.'), { status: 404 });

  const fullName = clean(user.full_name, user.email);
  const duplicateNameResult = await db.query<{ count: number }>(
    `select count(*)::int as count from public.allowed_users where ${sqlNormalized('full_name')} = $1`,
    [normalizeSearch(fullName)]
  );

  return {
    selectionKey,
    source: 'directory',
    directoryUserId: user.id,
    name: fullName,
    email: String(user.email ?? '').trim(),
    role: String(user.role ?? 'user'),
    nameFallbackAllowed: Number(duplicateNameResult.rows[0]?.count ?? 0) === 1,
    legacyName: null,
  };
}

function emptyPayload(params: {
  from: string;
  to: string;
  selection: ResolvedSelection;
}): UserActivityPresentationPayload {
  return {
    filters: {
      from: params.from,
      to: params.to,
      user_id: params.selection.selectionKey,
      user_name: params.selection.name,
      user_email: params.selection.email,
      date_range_label: formatDateRange(params.from, params.to),
      selection_source: params.selection.source,
    },
    summary: {
      totalActivities: 0,
      distinctCustomers: 0,
      physicalVisits: 0,
      onlineMeetings: 0,
      pocCustomers: 0,
      completedIntegrations: 0,
    },
    rows: [],
    generated_at: new Date().toISOString(),
    legacy_name_fallback_used: params.selection.source === 'legacy',
    data_quality: {
      stable_id_count: 0,
      email_count: 0,
      legacy_name_count: 0,
      owner_fallback_count: 0,
      historical_records_included: params.selection.source === 'legacy',
      warning: params.selection.source === 'legacy'
        ? 'Bu seçim, kullanıcı diziniyle eşleşmeyen eski created_by kaydından oluşturulmuştur.'
        : null,
    },
  };
}

export async function buildUserActivityPresentation(input: {
  from: string;
  to: string;
  userId: string;
}): Promise<UserActivityPresentationPayload> {
  const from = String(input.from ?? '').trim();
  const to = String(input.to ?? '').trim();
  const selectionKey = String(input.userId ?? '').trim();

  if (!selectionKey) throw Object.assign(new Error('Rapor oluşturmak için kullanıcı seçiniz.'), { status: 400 });
  const fromDate = validateDate(from, 'Başlangıç tarihi');
  const toDate = validateDate(to, 'Bitiş tarihi');
  if (toDate.getTime() < fromDate.getTime()) {
    throw Object.assign(new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.'), { status: 400 });
  }

  const selection = await resolveSelection(selectionKey);
  const columns = await pipelineIdentityColumns();
  const queryParams: unknown[] = [];
  const addParam = (value: unknown) => {
    queryParams.push(value);
    return `$${queryParams.length}`;
  };

  const identityConditions: string[] = [];
  const normalizedName = normalizeSearch(selection.legacyName ?? selection.name);
  const normalizedEmail = normalizeSearch(selection.email);

  if (selection.directoryUserId && columns.has('created_by_user_id')) {
    identityConditions.push(`pe.created_by_user_id::text = ${addParam(selection.directoryUserId)}`);
  }
  if (selection.directoryUserId && selection.email && columns.has('created_by_email')) {
    identityConditions.push(`${sqlNormalized('pe.created_by_email')} = ${addParam(normalizedEmail)}`);
  }

  const legacyTextConditions: string[] = [];
  if (normalizedEmail) legacyTextConditions.push(`${sqlNormalized('pe.created_by')} = ${addParam(normalizedEmail)}`);
  if (normalizedName && (selection.source === 'legacy' || selection.nameFallbackAllowed)) {
    legacyTextConditions.push(`${sqlNormalized('pe.created_by')} = ${addParam(normalizedName)}`);
  }
  identityConditions.push(...legacyTextConditions);

  const ownerFallbackValues = Array.from(new Set([
    normalizedEmail,
    selection.source === 'legacy' || selection.nameFallbackAllowed ? normalizedName : '',
  ].filter(Boolean)));
  if (ownerFallbackValues.length) {
    const ownerChecks = ownerFallbackValues.map((value) => `${sqlNormalized('pe.owner')} = ${addParam(value)}`);
    identityConditions.push(`(nullif(trim(coalesce(pe.created_by, '')), '') is null and (${ownerChecks.join(' or ')}))`);
  }

  if (!identityConditions.length) {
    throw Object.assign(new Error('Seçilen kullanıcı için geçmiş aktivite eşleştirmesi oluşturulamadı.'), { status: 400 });
  }

  const fromParam = addParam(from);
  const toParam = addParam(to);
  const createdByUserIdSelect = columns.has('created_by_user_id') ? 'pe.created_by_user_id::text' : 'null::text';
  const createdByEmailSelect = columns.has('created_by_email') ? 'pe.created_by_email' : 'null::text';

  const activitiesResult = await db.query<RawActivity>(
    `
      select
        pe.id::text,
        pe.musteri_id::text,
        pe.aksiyon,
        pe.durum,
        pe.created_at,
        pe.created_by,
        pe.owner,
        ${createdByUserIdSelect} as created_by_user_id,
        ${createdByEmailSelect} as created_by_email
      from public.pipeline_eventleri pe
      where (${identityConditions.join(' or ')})
        and pe.created_at >= (${fromParam}::date::timestamp at time zone 'Europe/Istanbul')
        and pe.created_at < ((${toParam}::date + 1)::timestamp at time zone 'Europe/Istanbul')
        and coalesce(pe.aksiyon, '') like 'AKTIVITE:%'
      order by pe.created_at asc
    `,
    queryParams
  );

  const activities = activitiesResult.rows;
  if (!activities.length) return emptyPayload({ from, to, selection });

  const quality = {
    stable_id_count: 0,
    email_count: 0,
    legacy_name_count: 0,
    owner_fallback_count: 0,
  };
  for (const activity of activities) {
    if (selection.directoryUserId && activity.created_by_user_id === selection.directoryUserId) {
      quality.stable_id_count += 1;
    } else if (normalizedEmail && normalizeSearch(activity.created_by_email) === normalizedEmail) {
      quality.email_count += 1;
    } else if (clean(activity.created_by, '')) {
      quality.legacy_name_count += 1;
    } else {
      quality.owner_fallback_count += 1;
    }
  }

  const customerIds = Array.from(new Set(activities.map((row) => String(row.musteri_id ?? '').trim()).filter(Boolean)));
  if (!customerIds.length) return emptyPayload({ from, to, selection });

  const [customersResult, phaseResult] = await Promise.all([
    db.query(
      `
        select
          m.id::text as musteri_id,
          m.musteri,
          m.sektor,
          k.kasapos_firmasi
        from public.musteriler m
        left join public.musteri_kunye_v2 k on k.musteri_id = m.id
        where m.id::text = any($1::text[])
      `,
      [customerIds]
    ),
    db.query<PhaseEvent>(
      `
        select
          pe.musteri_id::text,
          pe.faz_no,
          pe.durum,
          pe.created_at,
          ft.asama_adi
        from public.pipeline_eventleri pe
        left join public.faz_tanimlari ft on ft.faz_no = pe.faz_no
        where pe.musteri_id::text = any($1::text[])
          and pe.created_at < (($2::date + 1)::timestamp at time zone 'Europe/Istanbul')
          and pe.faz_no is not null
        order by pe.musteri_id asc, pe.created_at asc
      `,
      [customerIds, to]
    ),
  ]);

  const customerMap = new Map(customersResult.rows.map((row) => [String(row.musteri_id), row]));
  const phaseMap = new Map<string, PhaseEvent[]>();
  for (const event of phaseResult.rows) {
    const id = String(event.musteri_id);
    const list = phaseMap.get(id) ?? [];
    list.push(event);
    phaseMap.set(id, list);
  }

  const aggregate = new Map<string, {
    total: number;
    physical: number;
    online: number;
    lastActivity: string | null;
  }>();

  for (const activity of activities) {
    const customerId = String(activity.musteri_id);
    const current = aggregate.get(customerId) ?? { total: 0, physical: 0, online: 0, lastActivity: null };
    const channel = normalizeChannel(activityLabelFromRow(activity));
    current.total += 1;
    if (channel === 'Yerinde Ziyaret' || channel === 'Teknik Ziyaret') current.physical += 1;
    if (channel === 'Online Toplantı' || channel === 'Teknik Online') current.online += 1;
    current.lastActivity = activity.created_at;
    aggregate.set(customerId, current);
  }

  const rows = customerIds.map((customerId) => {
    const customer = customerMap.get(customerId) ?? {};
    const counts = aggregate.get(customerId) ?? { total: 0, physical: 0, online: 0, lastActivity: null };
    const phaseEvents = phaseMap.get(customerId) ?? [];
    const poc = phaseEvents.some(isPocPhase);
    return {
      no: 0,
      musteri_id: customerId,
      firma_adi: clean(customer.musteri),
      sektor: clean(customer.sektor),
      kasa_firmasi: clean(customer.kasapos_firmasi),
      fiziki_ziyaret_adedi: counts.physical,
      online_gorusme_adedi: counts.online,
      poc_durumu: poc ? 'Evet' as const : 'Hayır' as const,
      entegrasyon_durumu: integrationStatusFromHistory(phaseEvents),
      toplam_aktivite: counts.total,
      son_aktivite_tarihi: counts.lastActivity,
    };
  })
    .sort((a, b) => b.toplam_aktivite - a.toplam_aktivite || a.firma_adi.localeCompare(b.firma_adi, 'tr'))
    .map((row, index) => ({ ...row, no: index + 1 }));

  const summary = {
    totalActivities: activities.length,
    distinctCustomers: rows.length,
    physicalVisits: rows.reduce((sum, row) => sum + row.fiziki_ziyaret_adedi, 0),
    onlineMeetings: rows.reduce((sum, row) => sum + row.online_gorusme_adedi, 0),
    pocCustomers: rows.filter((row) => row.poc_durumu === 'Evet').length,
    completedIntegrations: rows.filter((row) => row.entegrasyon_durumu === 'Tamamlandı').length,
  };

  const historicalRecordsIncluded = quality.legacy_name_count > 0 || quality.owner_fallback_count > 0 || selection.source === 'legacy';
  const warningParts: string[] = [];
  if (selection.source === 'legacy') warningParts.push('Seçim, kullanıcı diziniyle eşleşmeyen geçmiş created_by değerinden oluşturuldu.');
  if (quality.legacy_name_count > 0) warningParts.push(`${quality.legacy_name_count} eski aktivite mevcut created_by metniyle eşleştirildi.`);
  if (quality.owner_fallback_count > 0) warningParts.push(`${quality.owner_fallback_count} kayıtta created_by boş olduğu için owner alanı kullanıldı.`);

  return {
    filters: {
      from,
      to,
      user_id: selection.selectionKey,
      user_name: selection.name,
      user_email: selection.email,
      date_range_label: formatDateRange(from, to),
      selection_source: selection.source,
    },
    summary,
    rows,
    generated_at: new Date().toISOString(),
    legacy_name_fallback_used: historicalRecordsIncluded,
    data_quality: {
      ...quality,
      historical_records_included: historicalRecordsIncluded,
      warning: warningParts.length ? warningParts.join(' ') : null,
    },
  };
}
