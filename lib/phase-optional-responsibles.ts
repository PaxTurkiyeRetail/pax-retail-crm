import { PHASE_OPTIONAL_RESPONSIBLE_GROUP } from '@/lib/report-only-customers';
import { ensureSystemParametersTable, getActiveParametersByGroups } from '@/lib/system-parameters';

export async function getPhaseOptionalResponsibles() {
  try {
    await ensureSystemParametersTable();
    const rows = await getActiveParametersByGroups([PHASE_OPTIONAL_RESPONSIBLE_GROUP]);
    const values = rows.map((row) => String(row.value || row.label || '').trim()).filter(Boolean);
    return values;
  } catch {
    return [];
  }
}
