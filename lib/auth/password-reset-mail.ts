import 'server-only';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[char] ?? char);
}

export function getApplicationOrigin(requestUrl: string) {
  const configured = String(process.env.APP_BASE_URL ?? '').trim();
  const origin = configured || new URL(requestUrl).origin;
  const parsed = new URL(origin);
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error('APP_BASE_URL production ortamında HTTPS olmalıdır.');
  }
  return parsed.origin;
}

export async function sendPasswordResetEmail(args: { email: string; resetUrl: string; expiresInMinutes: number }) {
  const apiKey = String(process.env.RESEND_API_KEY ?? '').trim();
  const from = String(process.env.AUTH_EMAIL_FROM ?? '').trim();
  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[AUTH] Password reset link for ${args.email}: ${args.resetUrl}`);
      return;
    }
    throw new Error('Şifre sıfırlama e-posta servisi yapılandırılmamış.');
  }

  const safeUrl = escapeHtml(args.resetUrl);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [args.email],
      subject: 'CRM şifre sıfırlama bağlantısı',
      html: `<p>CRM şifrenizi yenilemek için aşağıdaki bağlantıyı kullanın.</p><p><a href="${safeUrl}">Şifremi yenile</a></p><p>Bağlantı ${args.expiresInMinutes} dakika geçerlidir.</p><p>Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>`,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('password reset email delivery failed', response.status, detail.slice(0, 300));
    throw new Error('Şifre sıfırlama e-postası gönderilemedi.');
  }
}
