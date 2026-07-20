import { getActiveParametersByGroups, seedDefaultKunyeParameters } from '@/lib/system-parameters';
import {
  DEFAULT_FORECAST_CHANNELS,
  DEFAULT_FORECAST_PROBABILITIES,
  FORECAST_PROBABILITY_GROUP,
  FORECAST_SALES_CHANNEL_GROUP,
} from '@/lib/forecast-shared';

export * from '@/lib/forecast-shared';

export async function getForecastParameterOptions() {
  try {
    await seedDefaultKunyeParameters();
    const rows = await getActiveParametersByGroups([FORECAST_SALES_CHANNEL_GROUP, FORECAST_PROBABILITY_GROUP]);
    const channels = rows
      .filter((row) => row.group_key === FORECAST_SALES_CHANNEL_GROUP)
      .map((row) => ({ label: row.label, value: row.value }));
    const probabilities = rows
      .filter((row) => row.group_key === FORECAST_PROBABILITY_GROUP)
      .map((row) => ({ label: row.label, value: row.value }));

    return {
      channels: channels.length ? channels : DEFAULT_FORECAST_CHANNELS,
      probabilities: probabilities.length ? probabilities : DEFAULT_FORECAST_PROBABILITIES,
    };
  } catch {
    return {
      channels: DEFAULT_FORECAST_CHANNELS,
      probabilities: DEFAULT_FORECAST_PROBABILITIES,
    };
  }
}


export function isMissingForecastRelation(error: unknown) {
  const message = String((error as any)?.message ?? error ?? '');
  return /relation .*crm_forecasts.* does not exist/i.test(message) || /Could not find the table/i.test(message);
}
