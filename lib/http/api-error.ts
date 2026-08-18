import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const body = await request.json().catch(() => {
    throw new ApiError('INVALID_JSON', 'İstek gövdesi geçerli JSON olmalıdır.', 400);
  });

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Gönderilen alanları kontrol edin.',
      400,
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}

function publicError(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) {
    return new ApiError('VALIDATION_ERROR', 'Gönderilen alanları kontrol edin.', 400);
  }

  const candidate = error as { status?: number; code?: string; message?: string } | null;
  if (candidate?.status === 401 || candidate?.message === 'UNAUTHORIZED') {
    return new ApiError('UNAUTHORIZED', 'Oturum açmanız gerekiyor.', 401);
  }
  if (candidate?.status === 403 || candidate?.message === 'FORBIDDEN') {
    return new ApiError('FORBIDDEN', 'Bu işlem için yetkiniz yok.', 403);
  }
  if (candidate?.status === 404) {
    return new ApiError(candidate.code ?? 'NOT_FOUND', candidate.message ?? 'Kayıt bulunamadı.', 404);
  }

  return new ApiError('INTERNAL_ERROR', fallbackMessage, 500);
}

export function apiErrorResponse(error: unknown, fallbackMessage = 'İşlem tamamlanamadı.') {
  const normalized = publicError(error, fallbackMessage);
  const correlationId = crypto.randomUUID();

  if (normalized.status >= 500) {
    console.error('api_error', {
      correlationId,
      code: normalized.code,
      error,
    });
  }

  return NextResponse.json(
    {
      message: normalized.message,
      error: {
        code: normalized.code,
        message: normalized.message,
        correlationId,
        ...(normalized.details ? { details: normalized.details } : {}),
      },
    },
    { status: normalized.status },
  );
}
