export type SlaState = 'completed' | 'overdue' | 'today' | 'upcoming' | 'waiting' | 'unscheduled';

export type SlaPresentation = {
  state: SlaState;
  label: string;
  dayText: string;
  dotColor: string;
  dotText: string;
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

export function getSlaState(dueDate: string | null | undefined, status?: string | null): SlaState {
  const normalized = normalizeActivityStatus(status);
  if (normalized === 'tamamlandı') return 'completed';
  if (isWaitingStatus(status)) return 'waiting';
  if (!dueDate) return 'unscheduled';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'upcoming';
}

export function getSlaDayDiff(dueDate: string | null | undefined) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export function getSlaPresentation(dueDate: string | null | undefined, status?: string | null): SlaPresentation {
  const state = getSlaState(dueDate, status);
  const diff = getSlaDayDiff(dueDate);

  if (state === 'completed') {
    return {
      state,
      label: 'Tamamlandı',
      dayText: '',
      dotColor: '#16a34a',
      dotText: '✓',
      tone: { background: 'transparent', color: '#166534', border: '1px solid transparent' },
    };
  }

  if (state === 'unscheduled') {
    return {
      state,
      label: 'Tarihsiz',
      dayText: '',
      dotColor: '#94a3b8',
      dotText: '•',
      tone: { background: 'transparent', color: '#64748b', border: '1px solid transparent' },
    };
  }

  if (state === 'waiting') {
    return {
      state,
      label: 'Bekleniyor',
      dayText: '',
      dotColor: '#f59e0b',
      dotText: '!',
      tone: { background: 'transparent', color: '#b45309', border: '1px solid transparent' },
    };
  }

  if (state === 'overdue') {
    const days = Math.abs(diff ?? 0);
    return {
      state,
      label: 'Gecikti',
      dayText: '',
      dotColor: '#ef4444',
      dotText: `-${days}`,
      tone: { background: 'transparent', color: '#b91c1c', border: '1px solid transparent' },
    };
  }

  if (state === 'today') {
    return {
      state,
      label: 'Bugün',
      dayText: '',
      dotColor: '#16a34a',
      dotText: '0',
      tone: { background: 'transparent', color: '#166534', border: '1px solid transparent' },
    };
  }

  return {
    state,
    label: 'Planlı',
    dayText: '',
    dotColor: '#16a34a',
    dotText: `${diff ?? 0}`,
    tone: { background: 'transparent', color: '#166534', border: '1px solid transparent' },
  };
}

export function matchesSlaFilter(filter: string | null | undefined, dueDate: string | null | undefined, status?: string | null) {
  const normalizedFilter = String(filter ?? '').trim();
  if (!normalizedFilter) return true;
  return getSlaState(dueDate, status) === normalizedFilter;
}
