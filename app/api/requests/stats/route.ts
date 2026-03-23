import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  try {
    const user = await requireAllowedUserOrThrow();
    const sb   = createSupabaseAdminClient();
    const { searchParams } = new URL(req.url);
    // ?userId=xxx → kişi detay stats. Boşsa → genel dashboard stats.
    const targetUserId = searchParams.get('userId') || null;

    // Fetch ALL requests (herkes herkesi görür)
    const { data: rows, error } = await sb.from('requests').select(
      'id, status, priority, sla_status, assignee_id, assignee_name, requester_id, requester_name, created_at, first_response_at, resolved_at, sla_hours'
    );
    if (error) throw error;
    const all = rows ?? [];

    // ── GENEL DASHBOARD ───────────────────────────────────
    if (!targetUserId) {
      const open      = all.filter(r => r.status === 'open').length;
      const inProg    = all.filter(r => ['in_progress','assigned'].includes(r.status)).length;
      const resolved  = all.filter(r => ['resolved','closed'].includes(r.status)).length;
      const breached  = all.filter(r => r.sla_status === 'breached').length;
      const atRisk    = all.filter(r => r.sla_status === 'at_risk').length;

      const responded = all.filter(r => r.first_response_at);
      const avgResponseMin = responded.length
        ? Math.round(responded.reduce((acc,r) =>
            acc + (new Date(r.first_response_at!).getTime() - new Date(r.created_at).getTime()) / 60000, 0
          ) / responded.length)
        : null;

      const resolvedRows = all.filter(r => r.resolved_at);
      const avgResolutionHr = resolvedRows.length
        ? Math.round(resolvedRows.reduce((acc,r) =>
            acc + (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 3600000, 0
          ) / resolvedRows.length * 10) / 10
        : null;

      // Per-person workload
      const assigneeMap: Record<string, { name:string; open:number; total:number; breached:number; resolved:number }> = {};
      all.forEach(r => {
        if (!r.assignee_id) return;
        if (!assigneeMap[r.assignee_id]) {
          assigneeMap[r.assignee_id] = { name: r.assignee_name ?? r.assignee_id, open:0, total:0, breached:0, resolved:0 };
        }
        assigneeMap[r.assignee_id].total++;
        if (!['resolved','closed'].includes(r.status)) assigneeMap[r.assignee_id].open++;
        if (r.sla_status === 'breached') assigneeMap[r.assignee_id].breached++;
        if (['resolved','closed'].includes(r.status)) assigneeMap[r.assignee_id].resolved++;
      });

      const byAssignee = Object.entries(assigneeMap)
        .map(([id, v]) => ({ id, ...v, slaScore: v.total ? Math.round(((v.total - v.breached) / v.total) * 100) : 100 }))
        .sort((a,b) => b.open - a.open);

      const byPriority = ['critical','high','medium','low'].map(p => ({
        priority: p,
        count: all.filter(r => r.priority === p && !['resolved','closed'].includes(r.status)).length,
      }));

      const now = new Date();
      const trend = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(now); d.setDate(d.getDate() - (13 - i));
        const key = d.toISOString().slice(0,10);
        return { date:key, label:`${d.getDate()}/${d.getMonth()+1}`, count: all.filter(r => r.created_at.slice(0,10) === key).length };
      });

      return NextResponse.json({
        kpis: { total: all.length, open, inProg, resolved, breached, atRisk, avgResponseMin, avgResolutionHr },
        byAssignee, byPriority, trend,
      });
    }

    // ── KİŞİ DETAY STATS ──────────────────────────────────
    const opened   = all.filter(r => r.requester_id === targetUserId);
    const assigned = all.filter(r => r.assignee_id  === targetUserId);

    // Açılan talepler - durum dağılımı
    const openedByStatus: Record<string,number> = {};
    opened.forEach(r => { openedByStatus[r.status] = (openedByStatus[r.status]||0) + 1; });

    // Atanan talepler - özet
    const assignedOpen     = assigned.filter(r => !['resolved','closed'].includes(r.status)).length;
    const assignedResolved = assigned.filter(r => ['resolved','closed'].includes(r.status)).length;
    const assignedBreached = assigned.filter(r => r.sla_status === 'breached').length;
    const assignedOnTime   = assigned.filter(r => r.sla_status === 'on_time' && ['resolved','closed'].includes(r.status)).length;

    // Ortalama yanıt süresi (bana atanan talepler için)
    const myResponded = assigned.filter(r => r.first_response_at);
    const avgResponseMin = myResponded.length
      ? Math.round(myResponded.reduce((acc,r) =>
          acc + (new Date(r.first_response_at!).getTime() - new Date(r.created_at).getTime()) / 60000, 0
        ) / myResponded.length)
      : null;

    // SLA performansı: kapatılanlardan kaçı zamanında
    const closedAssigned = assigned.filter(r => ['resolved','closed'].includes(r.status));
    const slaScore = closedAssigned.length
      ? Math.round((assignedOnTime / closedAssigned.length) * 100)
      : null;

    // Haftalık trend - 14 gün, hem açtıklarım hem kapadıklarım
    const now = new Date();
    const weeklyTrend = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().slice(0,10);
      return {
        date: key,
        label: `${d.getDate()}/${d.getMonth()+1}`,
        opened:   opened.filter(r => r.created_at.slice(0,10) === key).length,
        resolved: assigned.filter(r => r.resolved_at?.slice(0,10) === key).length,
      };
    });

    // Avg resolution time for this person
    const myResolved = assigned.filter(r => r.resolved_at);
    const avgResolutionHr = myResolved.length
      ? Math.round(myResolved.reduce((acc,r) =>
          acc + (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 3600000, 0
        ) / myResolved.length * 10) / 10
      : null;

    return NextResponse.json({
      opened: { total: opened.length, byStatus: openedByStatus },
      assigned: { total: assigned.length, open: assignedOpen, resolved: assignedResolved, breached: assignedBreached },
      avgResponseMin,
      avgResolutionHr,
      slaScore,
      weeklyTrend,
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: err.status ?? 500 });
  }
}
