import 'server-only';
import { db } from '@/lib/db';
import { sendMail } from '@/lib/mail';
import { getParameterOptionsByGroups } from '@/lib/system-parameters';

// Talep (ticket) e-posta bildirimleri.
//
// Kurallar parametreden yönetilir (Admin → Parametreler / Bildirim Merkezi):
//   notify_request_assignee_enabled → yeni talep / atama: atanan kişiye mail
//   notify_request_resolved_enabled → talep çözülünce: talebi açana mail
//   notify_request_cc               → her talep bildiriminde bilgilendirilecek sabit alıcılar
//
// Tüm fonksiyonlar fire-and-forget kullanım için tasarlandı: hata fırlatmaz,
// sonuç notification_log'a düşer. Talep akışını asla bloklamaz.

type RequestRow = {
  id: string;
  title: string;
  priority?: string | null;
  status?: string | null;
  requester_id?: string | null;
  requester_name?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  resolution_note?: string | null;
};

function appUrl(path: string) {
  const base = String(process.env.APP_BASE_URL ?? '').trim().replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char] ?? char);
}

async function isRuleEnabled(groupKey: string) {
  try {
    const groups = await getParameterOptionsByGroups([groupKey]);
    const value = groups[groupKey]?.[0]?.value;
    return String(value ?? 'true').trim().toLowerCase() !== 'false';
  } catch {
    return true;
  }
}

async function ccRecipients(): Promise<string[]> {
  try {
    const groups = await getParameterOptionsByGroups(['notify_request_cc']);
    return (groups.notify_request_cc ?? []).map((item) => String(item.value ?? '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function emailOfUser(userId: string | null | undefined): Promise<string | null> {
  const id = String(userId ?? '').trim();
  if (!id) return null;
  try {
    const result = await db.query('select email from public.allowed_users where id = $1 limit 1', [id]);
    const email = String(result.rows?.[0]?.email ?? '').trim();
    return email || null;
  } catch {
    return null;
  }
}

function requestMailHtml(args: { heading: string; request: RequestRow; lines: string[] }) {
  const rows = args.lines.map((line) => `<p style="margin:4px 0;color:#334155;">${line}</p>`).join('');
  const link = appUrl(`/requests/${args.request.id}`);
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;">
      <h2 style="color:#0f172a;margin:0 0 12px;">${escapeHtml(args.heading)}</h2>
      <p style="margin:4px 0;color:#0f172a;font-weight:bold;">${escapeHtml(args.request.title)}</p>
      ${rows}
      <p style="margin:16px 0 0;">
        <a href="${link}" style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;">Talebi Aç</a>
      </p>
      <p style="margin:14px 0 0;color:#94a3b8;font-size:12px;">Bu e-posta PAX Retail CRM Bildirim Merkezi tarafından gönderildi.</p>
    </div>`;
}

/** Yeni talep açıldığında: atanan kişi (varsa) + sabit bilgilendirme listesi. */
export async function notifyRequestCreated(request: RequestRow) {
  try {
    if (!(await isRuleEnabled('notify_request_assignee_enabled'))) return;
    const assigneeEmail = await emailOfUser(request.assignee_id);
    const cc = await ccRecipients();
    const recipients = [...(assigneeEmail ? [assigneeEmail] : []), ...cc];
    if (!recipients.length) return;

    await sendMail({
      kind: 'request',
      refId: request.id,
      to: recipients,
      subject: `[CRM Talep] Yeni talep: ${request.title}`,
      html: requestMailHtml({
        heading: 'Yeni talep oluşturuldu',
        request,
        lines: [
          `Açan: <strong>${escapeHtml(request.requester_name ?? '-')}</strong>`,
          `Atanan: <strong>${escapeHtml(request.assignee_name ?? 'Henüz atanmadı')}</strong>`,
          `Öncelik: <strong>${escapeHtml(request.priority ?? 'medium')}</strong>`,
        ],
      }),
    });
  } catch {
    // Bildirim, talep akışını asla bozamaz.
  }
}

/** Talep birine atandığında/yeniden atandığında: yeni atanan kişi. */
export async function notifyRequestAssigned(request: RequestRow, assigneeId: string | null) {
  try {
    if (!(await isRuleEnabled('notify_request_assignee_enabled'))) return;
    const assigneeEmail = await emailOfUser(assigneeId);
    if (!assigneeEmail) return;

    await sendMail({
      kind: 'request',
      refId: request.id,
      to: [assigneeEmail],
      subject: `[CRM Talep] Size atandı: ${request.title}`,
      html: requestMailHtml({
        heading: 'Bir talep size atandı',
        request,
        lines: [
          `Açan: <strong>${escapeHtml(request.requester_name ?? '-')}</strong>`,
          `Öncelik: <strong>${escapeHtml(request.priority ?? 'medium')}</strong>`,
        ],
      }),
    });
  } catch {
    // sessiz
  }
}

/** Talep çözüldüğünde: talebi açan kişi. */
export async function notifyRequestResolved(request: RequestRow) {
  try {
    if (!(await isRuleEnabled('notify_request_resolved_enabled'))) return;
    const requesterEmail = await emailOfUser(request.requester_id);
    if (!requesterEmail) return;

    const note = String(request.resolution_note ?? '').trim();
    await sendMail({
      kind: 'request',
      refId: request.id,
      to: [requesterEmail],
      subject: `[CRM Talep] Çözümlendi: ${request.title}`,
      html: requestMailHtml({
        heading: 'Talebiniz çözümlendi',
        request,
        lines: [
          `Çözen: <strong>${escapeHtml(request.assignee_name ?? '-')}</strong>`,
          ...(note ? [`Çözüm notu: ${escapeHtml(note)}`] : []),
        ],
      }),
    });
  } catch {
    // sessiz
  }
}
