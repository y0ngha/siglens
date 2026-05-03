import { MS_PER_DAY } from '@/domain/constants/time';

/** Lookback window for news collected before analysis; matches the `NewsTimeRange` `'7d'` window. */
export const NEWS_LOOKBACK_MS = 7 * MS_PER_DAY;
