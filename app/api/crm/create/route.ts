import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermissionOrThrow, userHasPermission } from "@/lib/authz";
import { tryRecordAuditEvent } from "@/lib/audit";
import { createPgAdminClient } from "@/lib/pg/admin";
import { HAVUZ_ACCOUNT_NAME, LEGACY_INTEGRATION_ENUM_VALUES } from "@/lib/crm";
import { assertActiveParameterValue } from "@/lib/system-parameters";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = {
    musteri?: string;
    sektor?: string | null;
    entegrasyon_tipi?: string | null;
    satis_olasiligi?: string | null;
    sorumlu?: string | null;
    owner_user_id?: string | null;
    customer_type?: string | null;
    pipeline_policy?: string | null;
};

const legacyIntegrationValues = new Set<string>(LEGACY_INTEGRATION_ENUM_VALUES);

export async function POST(req: Request) {
    let me: Awaited<ReturnType<typeof requirePermissionOrThrow>>;

    try {
        me = await requirePermissionOrThrow('customer.create');
    } catch (e: any) {
        return NextResponse.json(
            { message: "Yetkisiz" },
            { status: e?.status || 401 }
        );
    }

    const body = (await req.json().catch(() => ({}))) as Body;

    const musteri = (body.musteri ?? "").trim();
    if (!musteri) {
        return NextResponse.json(
            { message: "musteri gerekli" },
            { status: 400 }
        );
    }

    const sektor =
        body.sektor != null && String(body.sektor).trim()
            ? String(body.sektor).trim()
            : null;

    const entegrasyon_tipi =
        body.entegrasyon_tipi != null && String(body.entegrasyon_tipi).trim()
            ? String(body.entegrasyon_tipi).trim()
            : null;

    const satis_olasiligi =
        body.satis_olasiligi != null && String(body.satis_olasiligi).trim()
            ? String(body.satis_olasiligi).trim()
            : null;

    try {
        await Promise.all([
            assertActiveParameterValue('crm_sector', sektor, { optional: true }),
            assertActiveParameterValue('crm_integration_type', entegrasyon_tipi, { optional: true }),
            assertActiveParameterValue('crm_sales_probability', satis_olasiligi, { optional: true }),
        ]);
    } catch (error: any) {
        return NextResponse.json({ message: error?.message || 'Geçersiz ana veri değeri.' }, { status: error?.status || 400 });
    }

    const myName = (me.full_name ?? "").trim();
    if (!myName) {
        return NextResponse.json(
            { message: "Kullanıcı adı/soyadı boş. allowed_users.full_name doldurulmalı." },
            { status: 400 }
        );
    }

    const admin = createPgAdminClient();
    const canAssign = userHasPermission(me, 'customer.assign');
    const canManageClassification = userHasPermission(me, 'customer.classification.manage');
    let customerType = 'standard';
    let pipelinePolicy = 'phase_required';
    if (canManageClassification) {
        try {
            customerType = await assertActiveParameterValue('crm_customer_type', body.customer_type || 'standard');
            pipelinePolicy = await assertActiveParameterValue('crm_pipeline_policy', body.pipeline_policy || 'phase_required');
        } catch (error: any) {
            return NextResponse.json({ message: error?.message || 'Geçersiz müşteri politikası.' }, { status: error?.status || 400 });
        }
    }
    const requestedOwner = (body.sorumlu ?? "").trim() || myName;
    const requestedOwnerUserId = String(body.owner_user_id ?? '').trim() || null;
    let sorumlu = myName;
    let ownerUserId: string | null = me.id;

    if (canAssign && !requestedOwnerUserId && requestedOwner === HAVUZ_ACCOUNT_NAME) {
        sorumlu = HAVUZ_ACCOUNT_NAME;
        ownerUserId = null;
    } else if (canAssign && requestedOwnerUserId && requestedOwnerUserId !== me.id) {
        const { data: ownerUser, error: ownerError } = await admin
            .from('allowed_users')
            .select('id,full_name,email')
            .eq('is_active', true)
            .eq('id', requestedOwnerUserId)
            .maybeSingle();
        if (ownerError) return NextResponse.json({ message: ownerError.message }, { status: 500 });
        if (!ownerUser) return NextResponse.json({ message: 'Sorumlu aktif bir kullanıcı olmalıdır.' }, { status: 400 });
        ownerUserId = String(ownerUser.id);
        sorumlu = String(ownerUser.full_name ?? ownerUser.email ?? '').trim();
    } else if (canAssign && !requestedOwnerUserId && requestedOwner !== myName) {
        // Eski istemciler için geçici uyumluluk. Yeni UI her zaman UUID yollar.
        const { data: ownerUser, error: ownerError } = await admin
            .from('allowed_users')
            .select('id,full_name,email')
            .eq('is_active', true)
            .or(`full_name.eq.${requestedOwner},email.eq.${requestedOwner}`)
            .limit(1)
            .maybeSingle();
        if (ownerError) return NextResponse.json({ message: ownerError.message }, { status: 500 });
        if (!ownerUser) return NextResponse.json({ message: 'Sorumlu aktif bir kullanıcı olmalıdır.' }, { status: 400 });
        ownerUserId = String(ownerUser.id);
        sorumlu = String(ownerUser.full_name ?? ownerUser.email ?? '').trim();
    }

    const { data, error } = await admin
        .from("musteriler")
        .insert({
            musteri,
            sektor,
            entegrasyon_tipi: entegrasyon_tipi && legacyIntegrationValues.has(entegrasyon_tipi) ? entegrasyon_tipi : null,
            integration_type_key: entegrasyon_tipi,
            satis_olasiligi,
            sorumlu,
            owner_user_id: ownerUserId,
            customer_type: customerType,
            pipeline_policy: pipelinePolicy,
        })
        .select("id")
        .single();

    if (error) {
        return NextResponse.json(
            { message: error.message },
            { status: 400 }
        );
    }

    await tryRecordAuditEvent({ actorId: me.id, actorEmail: me.email, action: 'customer.created', resourceType: 'customer', resourceId: String(data?.id), after: { musteri, sektor, entegrasyon_tipi, satis_olasiligi, sorumlu, owner_user_id: ownerUserId, customer_type: customerType, pipeline_policy: pipelinePolicy } });
    revalidatePath('/crm/customers');
    return NextResponse.json({ ok: true, id: data?.id });
}
