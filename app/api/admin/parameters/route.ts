import { NextResponse } from "next/server";
import { requireSystemParametersAccessOrThrow } from "@/lib/authz";
import {
  ALL_PARAMETER_GROUPS,
  createPhaseParameter,
  createSystemParameter,
  deletePhaseParameter,
  deleteSystemParameter,
  listCrmResponsibleOptions,
  listPhaseParameters,
  listSystemParameters,
  updatePhaseParameter,
  updateSystemParameter,
} from "@/lib/system-parameters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PHASE_GROUPS = new Set<string>(["faz_tanimlari", "is_ortagi_faz_tanimlari"]);

export async function GET() {
  try {
    await requireSystemParametersAccessOrThrow();
    const [rows, phaseRows, crmResponsibleOptions] = await Promise.all([
      listSystemParameters(),
      listPhaseParameters(),
      listCrmResponsibleOptions(),
    ]);
    return NextResponse.json({
      groups: ALL_PARAMETER_GROUPS,
      rows,
      phaseRows,
      crmResponsibleOptions,
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
    await requireSystemParametersAccessOrThrow();
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
    return NextResponse.json({ row });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Parametre kaydedilemedi." },
      { status: error?.status || 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await requireSystemParametersAccessOrThrow();
    const body = await req.json();
    const groupKey = String(body.groupKey ?? "").trim();

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
      return NextResponse.json({ row });
    }

    const id = String(body.id ?? "").trim();
    if (!id)
      return NextResponse.json(
        { message: "Parametre id zorunlu." },
        { status: 400 },
      );
    const row = await updateSystemParameter({
      id,
      label: typeof body.label === "string" ? body.label : undefined,
      value: typeof body.value === "string" ? body.value : undefined,
      sortOrder:
        body.sortOrder === undefined ? undefined : Number(body.sortOrder),
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    });
    if (!row)
      return NextResponse.json(
        { message: "Parametre bulunamadı." },
        { status: 404 },
      );
    return NextResponse.json({ row });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Parametre güncellenemedi." },
      { status: error?.status || 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await requireSystemParametersAccessOrThrow();
    const url = new URL(req.url);
    const groupKey = String(url.searchParams.get("groupKey") ?? "").trim();
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
      return NextResponse.json({ ok: true });
    }
    const id = String(url.searchParams.get("id") ?? "").trim();
    if (!id)
      return NextResponse.json(
        { message: "Parametre id zorunlu." },
        { status: 400 },
      );
    const ok = await deleteSystemParameter(id);
    if (!ok)
      return NextResponse.json(
        { message: "Parametre bulunamadı." },
        { status: 404 },
      );
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Parametre silinemedi." },
      { status: error?.status || 500 },
    );
  }
}
