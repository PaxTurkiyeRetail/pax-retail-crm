import { NextResponse } from "next/server";
import { requireSystemParametersAccessOrThrow, userHasPermission, type AllowedUser } from "@/lib/authz";
import {
  ALL_PARAMETER_GROUPS,
  createPhaseParameter,
  createSystemParameter,
  deletePhaseParameter,
  deleteSystemParameter,
  getSystemParameterGroupKey,
  listPhaseParameters,
  listSystemParameters,
  maskParameterValue,
  SENSITIVE_PARAMETER_GROUPS,
  updatePhaseParameter,
  updateSystemParameter,
  type SystemParameter,
} from "@/lib/system-parameters";
import { tryRecordAuditEvent } from '@/lib/audit';

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PHASE_GROUPS = new Set<string>(["faz_tanimlari", "is_ortagi_faz_tanimlari"]);
const IDENTITY_GROUPS = new Set<string>([
  "system_oidc_enabled",
  "system_oidc_group_role_sync_enabled",
  "system_oidc_app_role_sync_enabled",
  "system_oidc_app_role_mapping",
]);

// Hassas parametre değerini (Jira API token vb) client'a düz metin dönmez.
function maskSensitiveRow(row: SystemParameter): SystemParameter {
  if (!SENSITIVE_PARAMETER_GROUPS.has(row.group_key)) return row;
  return { ...row, value: maskParameterValue(row.value) };
}

function assertGroupManagementAccess(actor: AllowedUser, groupKey: string) {
  if (IDENTITY_GROUPS.has(groupKey) && !userHasPermission(actor, 'admin.identity.manage')) {
    throw Object.assign(new Error('Kurumsal kimlik parametreleri yalnız Super Admin tarafından yönetilebilir.'), { status: 403 });
  }
}

export async function GET() {
  try {
    const actor = await requireSystemParametersAccessOrThrow();
    const [rows, phaseRows] = await Promise.all([
      listSystemParameters(),
      listPhaseParameters(),
    ]);
    const canManageIdentity = userHasPermission(actor, 'admin.identity.manage');
    return NextResponse.json({
      groups: ALL_PARAMETER_GROUPS.filter((group) => canManageIdentity || !IDENTITY_GROUPS.has(group.key)),
      rows: rows
        .filter((row) => canManageIdentity || !IDENTITY_GROUPS.has(row.group_key))
        .map(maskSensitiveRow),
      phaseRows,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Parametreler okunamadı." },
      { status: error?.status || 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireSystemParametersAccessOrThrow();
    const body = await req.json();
    const groupKey = String(body.groupKey ?? "").trim();
    const allowedGroups = new Set<string>(
      ALL_PARAMETER_GROUPS.map((group) => group.key),
    );
    if (!allowedGroups.has(groupKey))
      return NextResponse.json(
        { message: "Geçersiz parametre grubu." },
        { status: 400 },
      );
    assertGroupManagementAccess(actor, groupKey);

    if (PHASE_GROUPS.has(groupKey)) {
      const row = await createPhaseParameter({
        groupKey,
        fazNo: Number(body.fazNo ?? body.faz_no),
        asamaAdi: String(
          body.asamaAdi ?? body.asama_adi ?? body.label ?? "",
        ).trim(),
        owner: typeof body.owner === "string" ? body.owner : null,
        sortOrder:
          body.sortOrder === undefined ? undefined : Number(body.sortOrder),
      });
      await tryRecordAuditEvent({ actorId: actor.id, actorEmail: actor.email, action: 'parameter.created', resourceType: groupKey, resourceId: String(row?.id ?? body.fazNo), after: row });
      return NextResponse.json({ row });
    }

    const label = String(body.label ?? "").trim();
    const value = String(body.value ?? label).trim();
    const sortOrder = Number(body.sortOrder ?? 999);
    if (!label || !value)
      return NextResponse.json(
        { message: "Ad ve değer zorunlu." },
        { status: 400 },
      );
    const row = await createSystemParameter({
      groupKey,
      label,
      value,
      sortOrder,
    });
    await tryRecordAuditEvent({ actorId: actor.id, actorEmail: actor.email, action: 'parameter.created', resourceType: groupKey, resourceId: String(row.id), after: row });
    return NextResponse.json({ row: maskSensitiveRow(row) });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Parametre kaydedilemedi." },
      { status: error?.status || 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await requireSystemParametersAccessOrThrow();
    const body = await req.json();
    let groupKey = String(body.groupKey ?? "").trim();

    if (PHASE_GROUPS.has(groupKey)) {
      const row = await updatePhaseParameter({
        groupKey,
        id: typeof body.id === "string" ? body.id : undefined,
        fazNo: Number(body.fazNo ?? body.faz_no),
        asamaAdi:
          typeof body.asamaAdi === "string"
            ? body.asamaAdi
            : typeof body.asama_adi === "string"
              ? body.asama_adi
              : undefined,
        owner: typeof body.owner === "string" ? body.owner : undefined,
        sortOrder:
          body.sortOrder === undefined ? undefined : Number(body.sortOrder),
        isActive:
          typeof body.isActive === "boolean" ? body.isActive : undefined,
      });
      if (!row)
        return NextResponse.json(
          { message: "Faz tanımı bulunamadı." },
          { status: 404 },
        );
      await tryRecordAuditEvent({ actorId: actor.id, actorEmail: actor.email, action: 'parameter.updated', resourceType: groupKey, resourceId: String(row.id), after: row });
      return NextResponse.json({ row });
    }

    const id = String(body.id ?? "").trim();
    if (!id)
      return NextResponse.json(
        { message: "Parametre id zorunlu." },
        { status: 400 },
      );
    if (!groupKey) groupKey = await getSystemParameterGroupKey(id) ?? "";
    assertGroupManagementAccess(actor, groupKey);
    const row = await updateSystemParameter({
      id,
      label: typeof body.label === "string" ? body.label : undefined,
      value: typeof body.value === "string" ? body.value : undefined,
      sortOrder:
        body.sortOrder === undefined ? undefined : Number(body.sortOrder),
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      updatedByUserId: actor.id,
      expectedVersion: body.expectedVersion === undefined ? undefined : Number(body.expectedVersion),
    });
    if (!row)
      return NextResponse.json(
        { message: "Parametre bulunamadı." },
        { status: 404 },
      );
    await tryRecordAuditEvent({ actorId: actor.id, actorEmail: actor.email, action: 'parameter.updated', resourceType: String(row.group_key), resourceId: String(row.id), after: row });
    return NextResponse.json({ row: maskSensitiveRow(row) });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Parametre güncellenemedi." },
      { status: error?.status || 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requireSystemParametersAccessOrThrow();
    const url = new URL(req.url);
    let groupKey = String(url.searchParams.get("groupKey") ?? "").trim();
    if (PHASE_GROUPS.has(groupKey)) {
      const fazNo = Number(
        url.searchParams.get("fazNo") ?? url.searchParams.get("faz_no"),
      );
      const ok = await deletePhaseParameter({ groupKey, fazNo });
      if (!ok)
        return NextResponse.json(
          { message: "Faz tanımı bulunamadı." },
          { status: 404 },
        );
      await tryRecordAuditEvent({ actorId: actor.id, actorEmail: actor.email, action: 'parameter.archived', resourceType: groupKey, resourceId: String(fazNo) });
      return NextResponse.json({ ok: true });
    }
    const id = String(url.searchParams.get("id") ?? "").trim();
    if (!id)
      return NextResponse.json(
        { message: "Parametre id zorunlu." },
        { status: 400 },
      );
    if (!groupKey) groupKey = await getSystemParameterGroupKey(id) ?? "";
    assertGroupManagementAccess(actor, groupKey);
    const ok = await deleteSystemParameter(id, actor.id);
    if (!ok)
      return NextResponse.json(
        { message: "Parametre bulunamadı." },
        { status: 404 },
      );
    await tryRecordAuditEvent({ actorId: actor.id, actorEmail: actor.email, action: 'parameter.archived', resourceType: groupKey || 'system_parameter', resourceId: id });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Parametre silinemedi." },
      { status: error?.status || 500 },
    );
  }
}
