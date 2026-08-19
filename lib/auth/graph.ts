import 'server-only';
import { oidcConfig } from '@/lib/auth/oidc';
import { ApiError } from '@/lib/http/api-error';

type CachedToken = { token: string; expiresAt: number };
const appOnlyTokenCache = new Map<string, CachedToken>();

/** Object ID'yi loglarda tam göstermeden korelasyon için kısalt (ör. "a1b2c3ef...**89"). */
function maskId(value: string): string {
  if (value.length <= 8) return '***';
  return `${value.slice(0, 8)}...${value.slice(-2)}`;
}

/** Graph/AAD hata gövdesinden secret/token içermeyen alanları çıkar. */
async function extractGraphErrorDiagnostics(response: Response) {
  const requestId = response.headers.get('request-id') ?? response.headers.get('x-ms-ags-diagnostic') ?? null;
  const clientRequestId = response.headers.get('client-request-id') ?? null;
  let code: string | null = null;
  let message: string | null = null;
  try {
    const body = await response.json() as { error?: { code?: string; message?: string } | string; error_description?: string };
    if (typeof body.error === 'object' && body.error) {
      code = body.error.code ?? null;
      message = body.error.message ?? null;
    } else if (typeof body.error === 'string') {
      code = body.error;
      message = body.error_description ?? null;
    }
  } catch {
    // gövde JSON değil / okunamadı — status/header teşhisi yine de loglanır
  }
  return { status: response.status, code, message, requestId, clientRequestId };
}

async function getAppOnlyAccessToken(tenantId: string): Promise<string> {
  const cached = appOnlyTokenCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const config = oidcConfig();
  if (!config.clientSecret) {
    throw new ApiError('OIDC_NOT_CONFIGURED', 'Kurumsal giriş için Graph erişimi yapılandırılmamış.', 503);
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!response.ok) {
    const diag = await extractGraphErrorDiagnostics(response);
    console.error(
      `[graph.getAppOnlyAccessToken] token request failed tenant=${maskId(tenantId)} status=${diag.status} code=${diag.code ?? 'n/a'} message=${diag.message ?? 'n/a'} request-id=${diag.requestId ?? 'n/a'}`,
    );
    throw new ApiError('OIDC_GRAPH_TOKEN_FAILED', 'Kurumsal grup bilgisi alınamadı.', 503);
  }
  const json = await response.json() as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new ApiError('OIDC_GRAPH_TOKEN_FAILED', 'Kurumsal grup bilgisi alınamadı.', 503);
  const expiresAt = Date.now() + (Number(json.expires_in) || 3600) * 1000;
  appOnlyTokenCache.set(tenantId, { token: json.access_token, expiresAt });
  return json.access_token;
}

/** Kullanıcının doğrudan üye olduğu AD grup Object ID'lerini döner (uygulama izniyle, delegated overage'a bağımlı değil). */
export async function getUserGroupIds(tenantId: string, userObjectId: string): Promise<string[]> {
  const token = await getAppOnlyAccessToken(tenantId);
  const groupIds: string[] = [];
  let url: string | null =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userObjectId)}/memberOf?$select=id&$top=999`;
  let iterations = 0;
  while (url && iterations < 10) {
    iterations += 1;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      const diag = await extractGraphErrorDiagnostics(response);
      console.error(
        `[graph.getUserGroupIds] memberOf failed tenant=${maskId(tenantId)} oid=${maskId(userObjectId)} status=${diag.status} code=${diag.code ?? 'n/a'} message=${diag.message ?? 'n/a'} request-id=${diag.requestId ?? 'n/a'} client-request-id=${diag.clientRequestId ?? 'n/a'}`,
      );
      throw new ApiError('OIDC_GRAPH_MEMBEROF_FAILED', 'Kurumsal grup bilgisi alınamadı.', 503);
    }
    const json = await response.json() as { value?: Array<{ id?: string }>; '@odata.nextLink'?: string };
    for (const item of json.value ?? []) {
      if (typeof item.id === 'string' && item.id) groupIds.push(item.id);
    }
    url = json['@odata.nextLink'] ?? null;
  }
  return groupIds;
}
