import 'server-only';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { ApiError, apiErrorResponse } from '@/lib/http/api-error';
import { canUseReportBuilder, type ReportUser } from '@/lib/report-builder/access';
import { ReportDefinitionError } from '@/lib/report-builder/types';

export type BuilderUser = ReportUser & { roles: string[] };

/** Builder uçlarının ortak girişi: oturum + en az bir report.read.* yetkisi. */
export async function requireReportBuilderUser(): Promise<BuilderUser> {
  const user = await requireAllowedUserOrThrow();
  const permissions = user.permissions ?? [];
  if (!canUseReportBuilder({ permissions })) throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
  return { id: user.id, email: user.email, full_name: user.full_name, permissions, roles: [user.role] };
}

export function builderErrorResponse(error: unknown) {
  if (error instanceof ReportDefinitionError) {
    return apiErrorResponse(new ApiError(error.code, error.message, 400, error.issues));
  }
  const candidate = error as { status?: number; message?: string } | null;
  if (candidate?.status === 408) return apiErrorResponse(new ApiError('QUERY_TIMEOUT', candidate.message ?? 'Zaman aşımı', 408));
  return apiErrorResponse(error, 'Rapor çalıştırılamadı.');
}
