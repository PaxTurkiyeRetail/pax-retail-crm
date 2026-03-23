export type CustomerPhaseMeta = {
  groupLabel: string;
  badgeStyle: { background: string; color: string; border: string };
};

export function getCustomerPhaseMeta(phaseNo?: number | null): CustomerPhaseMeta {
  if (phaseNo != null && phaseNo >= 1 && phaseNo <= 4) {
    return {
      groupLabel: 'Fırsat',
      badgeStyle: { background: '#f3e8ff', color: '#7c3aed', border: '1px solid #ddd6fe' },
    };
  }
  if (phaseNo != null && phaseNo >= 5 && phaseNo <= 9) {
    return {
      groupLabel: 'İlk Temas',
      badgeStyle: { background: '#e0f2fe', color: '#2563eb', border: '1px solid #bfdbfe' },
    };
  }
  if (phaseNo != null && phaseNo >= 10 && phaseNo <= 14) {
    return {
      groupLabel: 'Business',
      badgeStyle: { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' },
    };
  }
  if (phaseNo != null && phaseNo >= 15 && phaseNo <= 23) {
    return {
      groupLabel: 'Operasyon',
      badgeStyle: { background: '#ffe4e6', color: '#be185d', border: '1px solid #fecdd3' },
    };
  }
  if (phaseNo != null && phaseNo >= 24 && phaseNo <= 25) {
    return {
      groupLabel: 'Yayılım',
      badgeStyle: { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
    };
  }

  return {
    groupLabel: 'Faz Yok',
    badgeStyle: { background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' },
  };
}

export function buildCustomerPhaseDisplay(phaseNo?: number | null, phaseName?: string | null) {
  if (phaseNo == null) {
    return {
      title: 'Faz bilgisi yok',
      subtitle: 'Aktivitelerde tamamlanan faz bulunamadı',
      ...getCustomerPhaseMeta(null),
    };
  }

  const meta = getCustomerPhaseMeta(phaseNo);
  const cleanName = String(phaseName ?? '').trim();

  return {
    title: `${meta.groupLabel} · Faz ${phaseNo}`,
    subtitle: cleanName || 'Tamamlanan son faz',
    ...meta,
  };
}
