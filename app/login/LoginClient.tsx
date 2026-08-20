'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/crm';
  const allowedPrefixes = ['/crm', '/requests', '/activities', '/admin'];
  if (!allowedPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) return '/crm';
  return value;
}

const OIDC_ERROR_MESSAGES: Record<string, string> = {
  OIDC_PROVIDER_ERROR: 'Kurumsal hesabınızla giriş yapılamadı.',
  OIDC_CALLBACK_INVALID: 'Kurumsal hesabınızla giriş yapılamadı.',
  OIDC_STATE_INVALID: 'Kurumsal hesabınızla giriş yapılamadı. Tekrar deneyin.',
  OIDC_STATE_MISMATCH: 'Kurumsal hesabınızla giriş yapılamadı. Tekrar deneyin.',
  OIDC_STATE_EXPIRED: 'Giriş oturumunun süresi doldu. Tekrar deneyin.',
  OIDC_NONCE_MISMATCH: 'Kurumsal hesabınızla giriş yapılamadı. Tekrar deneyin.',
  OIDC_TOKEN_EXCHANGE_FAILED: 'Kurumsal hesabınızla giriş yapılamadı.',
  OIDC_CLAIMS_INVALID: 'Kurumsal hesabınızla giriş yapılamadı.',
  OIDC_USER_DISABLED: 'Hesabınız CRM erişimi için engellenmiş durumda.',
  OIDC_NO_APP_ROLE: 'Hesabınıza CRM erişimi için gerekli Entra App Role atanmamış.',
  OIDC_APP_ROLE_SYNC_DISABLED: 'Kurumsal kimlik servisine şu anda erişilemiyor.',
  OIDC_DISABLED: 'Kurumsal kimlik servisine şu anda erişilemiyor.',
  OIDC_NOT_CONFIGURED: 'Kurumsal kimlik servisine şu anda erişilemiyor.',
  OIDC_INVALID_CONFIG: 'Kurumsal kimlik servisine şu anda erişilemiyor.',
  OIDC_DISCOVERY_FAILED: 'Kurumsal kimlik servisine şu anda erişilemiyor.',
  OIDC_DISCOVERY_INVALID: 'Kurumsal kimlik servisine şu anda erişilemiyor.',
};

const DEFAULT_ERROR_MESSAGE = 'Kurumsal hesabınızla giriş yapılamadı.';

export default function LoginClient({ oidcEnabled }: { oidcEnabled: boolean }) {
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get('next')), [searchParams]);
  const errorCode = searchParams.get('error');
  const errorMessage = errorCode ? (OIDC_ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR_MESSAGE) : null;

  return (
    <main className="crm-auth-page">
      <div className="crm-auth-card">
        <div className="crm-auth-brand">
          <Image src="/pax-logo.svg" alt="PAX Türkiye" width={150} height={58} priority />
          <span>Kurumsal CRM</span>
        </div>
        <div>
          <h1>Tekrar hoş geldiniz</h1>
          <p className="crm-auth-subtitle">Müşteri, teklif ve taleplerinizi güvenli çalışma alanından yönetin.</p>
        </div>
        {errorMessage ? <p role="alert" aria-live="polite" style={{ color: '#c00' }}>{errorMessage}</p> : null}
        {oidcEnabled ? (
          <a href={`/api/auth/oidc/start?next=${encodeURIComponent(nextPath)}`} className="crm-auth-secondary">
            Kurumsal Hesapla Giriş
          </a>
        ) : (
          <p role="alert" aria-live="polite" style={{ color: '#c00' }}>
            Kurumsal kimlik servisine şu anda erişilemiyor.
          </p>
        )}
        <p className="crm-auth-security">Yetkisiz erişimler kayıt altına alınır. Oturum bilgilerinizi paylaşmayın.</p>
      </div>
    </main>
  );
}
