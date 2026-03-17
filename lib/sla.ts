export type SlaState = 'completed' | 'overdue' | 'today' | 'upcoming' | 'waiting' | 'unscheduled';

export type SlaPresentation = {
  state: SlaState;
  label: string;
  dayText: string;
  dotColor: string;
  dotText: string;
  dotBorderColor?: string;
  textColor?: string;
  tone: {
    background: string;
    color: string;
    border: string;
  };
};

export function normalizeActivityStatus(value: string | null | undefined) {
  return String(value ?? '').trim().toLocaleLowerCase('tr');
}

function isWaitingStatus(status?: string | null) {
  const normalized = normalizeActivityStatus(status);
  return normalized === 'bekleniyor' || normalized === 'başlamadı';
}

function buildDateAtUtcMidnight(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const trDateMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s|T|$)/);
  if (trDateMatch) {
    const [, d, m, y] = trDateMatch;
    return buildDateAtUtcMidnight(Number(y), Number(m) - 1, Number(d));
  }

  const isoDateTimeMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoDateTimeMatch) {
    const [, y, m, d] = isoDateTimeMatch;
    return buildDateAtUtcMidnight(Number(y), Number(m) - 1, Number(d));
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return buildDateAtUtcMidnight(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  }

  return null;
}

function getNormalizedToday() {
  const today = new Date();
  return buildDateAtUtcMidnight(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
}

export function getSlaState(dueDate: string | null | undefined, status?: string | null, todayValue?: string | Date | null): SlaState {
  const normalized = normalizeActivityStatus(status);
  if (normalized === 'tamamlandı') return 'completed';
  if (isWaitingStatus(status)) return 'waiting';

  const due = parseDateOnly(dueDate);
  if (!due) return 'unscheduled';

  const today = typeof todayValue === 'string' ? (parseDateOnly(todayValue) ?? getNormalizedToday()) : todayValue instanceof Date ? buildDateAtUtcMidnight(todayValue.getUTCFullYear(), todayValue.getUTCMonth(), todayValue.getUTCDate()) : getNormalizedToday();
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'upcoming';
}

export function getSlaDayDiff(dueDate: string | null | undefined, todayValue?: string | Date | null) {
  const due = parseDateOnly(dueDate);
  if (!due) return null;
  const today = typeof todayValue === 'string' ? (parseDateOnly(todayValue) ?? getNormalizedToday()) : todayValue instanceof Date ? buildDateAtUtcMidnight(todayValue.getUTCFullYear(), todayValue.getUTCMonth(), todayValue.getUTCDate()) : getNormalizedToday();
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export function getSlaPresentation(dueDate: string | null | undefined, status?: string | null, todayValue?: string | Date | null): SlaPresentation {
  const normalized = normalizeActivityStatus(status);
  const state = getSlaState(dueDate, status, todayValue);
  const diff = getSlaDayDiff(dueDate, todayValue);

  if (normalized === 'tamamlandı' || state === 'completed') {
    if (diff !== null) {
      return {
        state: 'completed',
        label: 'Tamamlandı',
        dayText: '',
        dotColor: '#16a34a',
        dotText: diff < 0 ? `-${Math.abs(diff)}` : `${diff}`,
        dotBorderColor: '#16a34a',
        textColor: '#ffffff',
        tone: { background: 'transparent', color: '#166534', border: '1px solid transparent' },
      };
    }

    return {
      state: 'completed',
      label: 'Tamamlandı',
      dayText: '',
      dotColor: '#16a34a',
      dotText: '',
      dotBorderColor: '#16a34a',
      textColor: '#ffffff',
      tone: { background: 'transparent', color: '#166534', border: '1px solid transparent' },
    };
  }

  if (diff !== null) {
    if (diff < 0) {
      const days = Math.abs(diff);
      return {
        state: 'overdue',
        label: 'Gecikti',
        dayText: '',
        dotColor: '#ef4444',
        dotText: `-${days}`,
        dotBorderColor: '#ef4444',
        textColor: '#ffffff',
        tone: { background: 'transparent', color: '#b91c1c', border: '1px solid transparent' },
      };
    }

    return {
      state: diff === 0 ? 'today' : 'upcoming',
      label: diff === 0 ? 'Bugün' : 'Planlı',
      dayText: '',
      dotColor: '#16a34a',
      dotText: `${diff}`,
      dotBorderColor: '#16a34a',
      textColor: '#ffffff',
      tone: { background: 'transparent', color: '#166534', border: '1px solid transparent' },
    };
  }

  if (normalized === 'devam ediyor' || normalized === 'devam ediyorlar') {
    return {
      state: 'waiting',
      label: 'Devam Ediyor',
      dayText: '',
      dotColor: '#facc15',
      dotText: '',
      dotBorderColor: '#facc15',
      textColor: '#92400e',
      tone: { background: 'transparent', color: '#92400e', border: '1px solid transparent' },
    };
  }

  return {
    state: state === 'unscheduled' ? 'unscheduled' : 'waiting',
    label: normalized === 'başlamadı' ? 'Başlamadı' : 'Tarihsiz',
    dayText: '',
    dotColor: 'transparent',
    dotText: '',
    dotBorderColor: '#cbd5e1',
    textColor: '#64748b',
    tone: { background: 'transparent', color: '#64748b', border: '1px solid transparent' },
  };
}

export function matchesSlaFilter(filter: string | null | undefined, dueDate: string | null | undefined, status?: string | null) {
  const normalizedFilter = String(filter ?? '').trim();
  if (!normalizedFilter) return true;
  return getSlaState(dueDate, status) === normalizedFilter;
}
