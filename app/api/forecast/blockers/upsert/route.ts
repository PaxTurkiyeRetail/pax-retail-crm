import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';
import { getForecastForBlockerOrThrow } from '@/lib/forecast-blocker-access';
import { BLOCKER_CATEGORIES, RESOLUTION_OWNER_TYPES, isLaterPeriod, isMissingForecastBlockerRelation, isoDateOnly } from '@/lib/forecast-blockers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const body = await request.json().catch(() => ({}));
    const forecastId = String(body.forecast_id ?? '').trim();
    if (!forecastId) return NextResponse.json({ message: 'Forecast kaydı zorunlu.' }, { status: 400 });

    const forecast = await getForecastForBlockerOrThrow(me, forecastId);
    const hasBlocker = body.has_blocker === true;
    const actorName = String(me.full_name ?? me.email ?? '').trim();

    let blockerCategory: string | null = null;
    let blockerDescription: string | null = null;
    let ownerType: string | null = null;
    let ownerName: string | null = null;
    let dueDate: string | null = null;
    let impactType = 'none';
    let shiftYear: number | null = null;
    let shiftMonth: number | null = null;
    let shiftedQuantity: number | null = null;
    let workflowStatus = 'no_blocker';

    if (hasBlocker) {
      blockerCategory = String(body.blocker_category ?? '').trim();
      blockerDescription = String(body.blocker_description ?? '').trim();
      ownerType = String(body.resolution_owner_type ?? '').trim();
      ownerName = String(body.resolution_owner_name ?? '').trim();
      dueDate = isoDateOnly(body.resolution_due_date) || null;
      impactType = body.impact_type === 'month_shift' ? 'month_shift' : 'none';
      workflowStatus = body.workflow_status === 'in_progress' ? 'in_progress' : 'open';

      if (!BLOCKER_CATEGORIES.some((item) => item.value === blockerCategory)) return NextResponse.json({ message: 'Engel kategorisi seçilmelidir.' }, { status: 400 });
      if (blockerDescription.length < 5) return NextResponse.json({ message: 'Engel açıklamasını daha net yazın.' }, { status: 400 });
      if (!RESOLUTION_OWNER_TYPES.some((item) => item.value === ownerType)) return NextResponse.json({ message: 'Çözüm sorumlusu tipi seçilmelidir.' }, { status: 400 });
      if (ownerName.length < 2) return NextResponse.json({ message: 'Çözüm sorumlusu yazılmalıdır.' }, { status: 400 });
      if (!dueDate) return NextResponse.json({ message: 'Planlanan çözüm tarihi seçilmelidir.' }, { status: 400 });

      if (impactType === 'month_shift') {
        shiftYear = Number(body.shift_year ?? 0);
        shiftMonth = Number(body.shift_month ?? 0);
        shiftedQuantity = Number(body.shifted_quantity ?? 0);
        if (!Number.isInteger(shiftYear) || shiftYear < 2024 || shiftYear > 2100 || !Number.isInteger(shiftMonth) || shiftMonth < 1 || shiftMonth > 12) {
          return NextResponse.json({ message: 'Kayacağı dönem geçersiz.' }, { status: 400 });
        }
        if (!isLaterPeriod(forecast.forecast_year, forecast.forecast_month, shiftYear, shiftMonth)) {
          return NextResponse.json({ message: 'Kayacağı dönem mevcut Forecast döneminden ileri olmalıdır.' }, { status: 400 });
        }
        if (!Number.isInteger(shiftedQuantity) || shiftedQuantity <= 0) return NextResponse.json({ message: 'Kayacak adet sıfırdan büyük olmalıdır.' }, { status: 400 });
        if (shiftedQuantity > Number(forecast.quantity)) return NextResponse.json({ message: `Kayacak adet mevcut ${forecast.quantity} adedi aşamaz.` }, { status: 400 });
      }
    }

    try {
      const result = await db.query(
        `
          insert into public.crm_forecast_blockers (
            forecast_id, has_blocker, blocker_category, blocker_description,
            resolution_owner_type, resolution_owner_name, resolution_due_date,
            impact_type, shift_year, shift_month, shifted_quantity, workflow_status,
            submitted_at, submitted_by_email, submitted_by_name,
            created_by_email, created_by_name, updated_by_email, updated_by_name
          )
          values (
            $1::uuid, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, $12,
            now(), $13, $14, $13, $14, $13, $14
          )
          on conflict (forecast_id) do update set
            has_blocker = excluded.has_blocker,
            blocker_category = excluded.blocker_category,
            blocker_description = excluded.blocker_description,
            resolution_owner_type = excluded.resolution_owner_type,
            resolution_owner_name = excluded.resolution_owner_name,
            resolution_due_date = excluded.resolution_due_date,
            impact_type = excluded.impact_type,
            shift_year = excluded.shift_year,
            shift_month = excluded.shift_month,
            shifted_quantity = excluded.shifted_quantity,
            workflow_status = excluded.workflow_status,
            submitted_at = coalesce(public.crm_forecast_blockers.submitted_at, now()),
            submitted_by_email = coalesce(public.crm_forecast_blockers.submitted_by_email, excluded.submitted_by_email),
            submitted_by_name = coalesce(public.crm_forecast_blockers.submitted_by_name, excluded.submitted_by_name),
            updated_by_email = excluded.updated_by_email,
            updated_by_name = excluded.updated_by_name,
            resolved_at = null,
            resolved_by_email = null,
            resolved_by_name = null
          returning id::text, forecast_id::text, workflow_status, updated_at::text
        `,
        [forecastId, hasBlocker, blockerCategory, blockerDescription, ownerType, ownerName, dueDate, impactType, shiftYear, shiftMonth, shiftedQuantity, workflowStatus, me.email, actorName],
      );
      return NextResponse.json({ ok: true, row: result.rows[0] });
    } catch (error) {
      if (isMissingForecastBlockerRelation(error)) return NextResponse.json({ message: 'forecast_blocker_impact_not_setup' }, { status: 400 });
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Engel ve Etki kaydedilemedi.' }, { status: error?.status || 500 });
  }
}
