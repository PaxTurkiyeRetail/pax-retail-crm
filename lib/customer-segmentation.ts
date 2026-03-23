export const FIRMA_DURUMU_OPTIONS = [
  'Aday',
  'Fırsat',
  'Kazanılmış Müşteri',
  'Gelişen Müşteri',
  'Riskli Müşteri',
  'Pasif',
] as const;

export const YONETIM_TIPI_OPTIONS = ['Yeni Kazanım', 'Elde Tutma', 'Büyütme'] as const;

export type FirmaDurumu = (typeof FIRMA_DURUMU_OPTIONS)[number];
export type YonetimTipi = (typeof YONETIM_TIPI_OPTIONS)[number];

export type CustomerStatusSignals = {
  activePhaseNo?: number | null;
  activeDeviceCount?: number | null;
  lastActivityDays?: number | null;
  openOpportunityCount?: number | null;
  growthSignalCount?: number | null;
  riskSignalCount?: number | null;
  hasGoLive?: boolean | null;
};

export type CustomerSegmentation = {
  firmaDurumu: FirmaDurumu;
  yonetimTipi: YonetimTipi;
  isAutoDerived: boolean;
  reason: string;
  mode: 'phase-fallback' | 'rule-engine';
  appliedRules: string[];
};

function hasValue(value: number | null | undefined) {
  return value != null && Number.isFinite(value);
}

function inferManagementType(firmaDurumu: FirmaDurumu): YonetimTipi {
  if (firmaDurumu === 'Aday' || firmaDurumu === 'Fırsat') return 'Yeni Kazanım';
  if (firmaDurumu === 'Gelişen Müşteri') return 'Büyütme';
  return 'Elde Tutma';
}

export function deriveCustomerSegmentation(signalsOrPhase?: CustomerStatusSignals | number | null): CustomerSegmentation {
  const signals: CustomerStatusSignals =
    typeof signalsOrPhase === 'number' || signalsOrPhase == null
      ? { activePhaseNo: signalsOrPhase ?? null }
      : signalsOrPhase;

  const activePhaseNo = signals.activePhaseNo ?? null;
  const activeDeviceCount = signals.activeDeviceCount ?? null;
  const lastActivityDays = signals.lastActivityDays ?? null;
  const openOpportunityCount = signals.openOpportunityCount ?? null;
  const growthSignalCount = signals.growthSignalCount ?? null;
  const riskSignalCount = signals.riskSignalCount ?? null;
  const hasGoLive = Boolean(signals.hasGoLive);

  const backendSignalsReady =
    hasValue(lastActivityDays) || hasValue(openOpportunityCount) || hasValue(growthSignalCount) || hasValue(riskSignalCount) || hasValue(activeDeviceCount) || hasGoLive;

  if (!backendSignalsReady) {
    if (activePhaseNo == null || activePhaseNo <= 0) {
      return {
        firmaDurumu: 'Aday',
        yonetimTipi: 'Yeni Kazanım',
        isAutoDerived: true,
        mode: 'phase-fallback',
        appliedRules: ['Aktif faz bulunamadı → Aday', 'Yeni kazanım portföyünde tutulur'],
        reason: 'Backend sinyalleri henüz bağlı değil. Sistem sadece mevcut aktif fazı okuyabildiği için kayıt aday olarak gösteriliyor.',
      };
    }

    if (activePhaseNo >= 1 && activePhaseNo <= 23) {
      return {
        firmaDurumu: 'Fırsat',
        yonetimTipi: 'Yeni Kazanım',
        isAutoDerived: true,
        mode: 'phase-fallback',
        appliedRules: [`Faz ${activePhaseNo} → Fırsat`, 'Canlı müşteri öncesi portföy → Yeni Kazanım'],
        reason: `Backend sinyalleri henüz bağlı değil. Müşteri şu an Faz ${activePhaseNo} seviyesinde olduğu için fırsat havuzunda tutuluyor.`,
      };
    }

    return {
      firmaDurumu: 'Kazanılmış Müşteri',
      yonetimTipi: 'Elde Tutma',
      isAutoDerived: true,
      mode: 'phase-fallback',
      appliedRules: [`Faz ${activePhaseNo} → Kazanılmış Müşteri`, 'Varsayılan yönetim tipi → Elde Tutma'],
      reason: `Backend sinyalleri henüz bağlı değil. Müşteri Faz ${activePhaseNo} ile canlı / yayılım tarafına geçmiş göründüğü için kazanılmış müşteri olarak etiketleniyor.`,
    };
  }

  const isWon = (activePhaseNo != null && activePhaseNo >= 24) || (activeDeviceCount ?? 0) > 0 || hasGoLive;
  const growthScore = (growthSignalCount ?? 0);
  const riskScore = (riskSignalCount ?? 0) + ((lastActivityDays ?? 0) >= 60 ? 1 : 0);
  const noOpenOpportunity = (openOpportunityCount ?? 0) <= 0;
  const inactive180 = (lastActivityDays ?? 0) >= 180;

  let firmaDurumu: FirmaDurumu;
  const appliedRules: string[] = [];

  if (!isWon) {
    if (activePhaseNo == null || activePhaseNo <= 0) {
      firmaDurumu = 'Aday';
      appliedRules.push('Aktif faz yok → Aday');
    } else {
      firmaDurumu = 'Fırsat';
      appliedRules.push(`Faz ${activePhaseNo} ve canlı müşteri sinyali yok → Fırsat`);
    }
  } else if (inactive180 && noOpenOpportunity && growthScore <= 0) {
    firmaDurumu = 'Pasif';
    appliedRules.push('180+ gün aktivite yok + açık fırsat yok + büyüme sinyali yok → Pasif');
  } else if ((lastActivityDays ?? 0) >= 60 || riskScore >= 2) {
    firmaDurumu = 'Riskli Müşteri';
    appliedRules.push('60+ gün hareketsizlik veya 2+ risk sinyali → Riskli');
  } else if (growthScore >= 2) {
    firmaDurumu = 'Gelişen Müşteri';
    appliedRules.push('2+ büyüme sinyali → Gelişen');
  } else {
    firmaDurumu = 'Kazanılmış Müşteri';
    appliedRules.push('Canlı müşteri sinyali var → Kazanılmış Müşteri');
  }

  const yonetimTipi = inferManagementType(firmaDurumu);
  appliedRules.push(`Yönetim tipi otomatik: ${yonetimTipi}`);

  return {
    firmaDurumu,
    yonetimTipi,
    isAutoDerived: true,
    mode: 'rule-engine',
    appliedRules,
    reason:
      firmaDurumu === 'Pasif'
        ? 'Müşteri portföyde kalıyor ancak uzun süredir hareket görünmüyor. Elde tutma tarafında yeniden aktivasyon akışı önerilir.'
        : firmaDurumu === 'Riskli Müşteri'
          ? 'Müşteri kazanılmış olsa da temas zayıf veya risk sinyali yüksek. Yakın takip önerilir.'
          : firmaDurumu === 'Gelişen Müşteri'
            ? 'Müşteri canlı durumda ve son dönemde büyüme sinyalleri üretmiş görünüyor. Büyütme akışında yönetilmelidir.'
            : firmaDurumu === 'Kazanılmış Müşteri'
              ? 'Müşteri canlı portföyde ve elde tutma akışında izleniyor.'
              : 'Müşteri yeni kazanım portföyünde izleniyor.',
  };
}

export function customerStatusTone(firmaDurumu: FirmaDurumu) {
  switch (firmaDurumu) {
    case 'Aday':
      return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
    case 'Fırsat':
      return { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
    case 'Kazanılmış Müşteri':
      return { bg: '#ecfdf3', color: '#166534', border: '#bbf7d0' };
    case 'Gelişen Müşteri':
      return { bg: '#ecfeff', color: '#155e75', border: '#a5f3fc' };
    case 'Riskli Müşteri':
      return { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
    case 'Pasif':
      return { bg: '#f8fafc', color: '#475569', border: '#cbd5e1' };
    default:
      return { bg: '#f8fafc', color: '#334155', border: '#e2e8f0' };
  }
}

export function managementTypeTone(yonetimTipi: YonetimTipi) {
  switch (yonetimTipi) {
    case 'Yeni Kazanım':
      return { bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' };
    case 'Elde Tutma':
      return { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' };
    case 'Büyütme':
      return { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
    default:
      return { bg: '#f8fafc', color: '#334155', border: '#e2e8f0' };
  }
}
