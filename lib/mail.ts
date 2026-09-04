import 'server-only';
import { db } from '@/lib/db';
import { getParameterOptionsByGroups } from '@/lib/system-parameters';

// Merkezi e-posta gönderimi (Bildirim Merkezi motoru).
//
// Sağlayıcı: Resend (RESEND_API_KEY + AUTH_EMAIL_FROM env değişkenleri).
// Anahtar yapılandırılmamışsa gönderim YAPILMAZ ama akış kırılmaz:
// notification_log'a "skipped" kaydı düşer — kurallar ve panel, IT anahtarı
// vermeden önce kurulup test edilebilir.
//
// Güvenlik: alıcılar notify_allowed_domains parametresindeki domain'lerle
// sınırlanır (sistemde kayıtlı olmayan adresler de olabilir, ama yalnızca
// izinli şirket domain'lerinde). Liste dışındaki adresler gönderilmez ve
// log'a "rejected" olarak yazılır.

export type MailAttachment = {
  filename: string;
  /** base64 içerik */
  content: string;
};

export type SendMailInput = {
  to: string[];
  subject: string;
  html: string;
  attachments?: MailAttachment[];
  /** notification_log.kind */
  kind: 'report' | 'request' | 'system';
  /** notification_log.ref_id — talep/rapor kimliği */
  refId?: string | null;
};

export type SendMailResult = {
  status: 'sent' | 'skipped' | 'failed' | 'rejected';
  detail: string;
  sentTo: string[];
  rejected: string[];
};

export function isMailConfigured() {
  return Boolean(String(process.env.RESEND_API_KEY ?? '').trim())
    && Boolean(String(process.env.AUTH_EMAIL_FROM ?? '').trim());
}

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function getAllowedDomains(): Promise<string[]> {
  const groups = await getParameterOptionsByGroups(['notify_allowed_domains']);
  return (groups.notify_allowed_domains ?? [])
    .map((item) => normalizeEmail(item.value).replace(/^@/, ''))
    .filter(Boolean);
}

/** Alıcıları izinli domain listesine göre ayırır. */
export function splitRecipientsByDomain(recipients: string[], allowedDomains: string[]) {
  const allowed: string[] = [];
  const rejected: string[] = [];
  for (const raw of recipients) {
    const email = normalizeEmail(raw);
    if (!email || !isValidEmail(email)) {
      if (email) rejected.push(email);
      continue;
    }
    const domain = email.split('@')[1] ?? '';
    if (allowedDomains.some((allowedDomain) => domain === allowedDomain)) {
      if (!allowed.includes(email)) allowed.push(email);
    } else {
      rejected.push(email);
    }
  }
  return { allowed, rejected };
}

export async function recordNotification(entry: {
  kind: 'report' | 'request' | 'system';
  subject: string;
  recipients: string[];
  status: 'sent' | 'skipped' | 'failed' | 'rejected';
  detail?: string | null;
  refId?: string | null;
}) {
  try {
    await db.query(
      `insert into public.notification_log (kind, subject, recipients, status, detail, ref_id)
       values ($1, $2, $3, $4, $5, $6)`,
      [entry.kind, entry.subject, entry.recipients, entry.status, entry.detail ?? null, entry.refId ?? null],
    );
  } catch {
    // Log yazılamazsa bildirim akışını düşürme; sessiz geç.
  }
}

/**
 * E-posta gönderir; her durumda notification_log'a iz bırakır.
 * Asla throw etmez — bildirim, çağıran iş akışını (talep kaydı vb.) bozamaz.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const subject = input.subject.trim();
  let allowed: string[] = [];
  let rejected: string[] = [];

  try {
    const domains = await getAllowedDomains();
    ({ allowed, rejected } = splitRecipientsByDomain(input.to, domains));

    if (rejected.length) {
      await recordNotification({
        kind: input.kind,
        subject,
        recipients: rejected,
        status: 'rejected',
        detail: 'Alıcı domaini izinli listede değil (notify_allowed_domains).',
        refId: input.refId,
      });
    }

    if (!allowed.length) {
      return { status: 'rejected', detail: 'Gönderilecek izinli alıcı yok.', sentTo: [], rejected };
    }

    if (!isMailConfigured()) {
      await recordNotification({
        kind: input.kind,
        subject,
        recipients: allowed,
        status: 'skipped',
        detail: 'Mail servisi yapılandırılmadı (RESEND_API_KEY / AUTH_EMAIL_FROM eksik).',
        refId: input.refId,
      });
      return { status: 'skipped', detail: 'Mail servisi yapılandırılmadı.', sentTo: [], rejected };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${String(process.env.RESEND_API_KEY).trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: String(process.env.AUTH_EMAIL_FROM).trim(),
        to: allowed,
        subject,
        html: input.html,
        attachments: input.attachments?.map((file) => ({
          filename: file.filename,
          content: file.content,
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      await recordNotification({
        kind: input.kind,
        subject,
        recipients: allowed,
        status: 'failed',
        detail: `Resend ${response.status}: ${body.slice(0, 300)}`,
        refId: input.refId,
      });
      return { status: 'failed', detail: `Resend ${response.status}`, sentTo: [], rejected };
    }

    await recordNotification({
      kind: input.kind,
      subject,
      recipients: allowed,
      status: 'sent',
      refId: input.refId,
    });
    return { status: 'sent', detail: 'Gönderildi.', sentTo: allowed, rejected };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Bilinmeyen hata';
    await recordNotification({
      kind: input.kind,
      subject,
      recipients: allowed.length ? allowed : input.to.map(normalizeEmail).filter(Boolean),
      status: 'failed',
      detail: detail.slice(0, 300),
      refId: input.refId,
    });
    return { status: 'failed', detail, sentTo: [], rejected };
  }
}
