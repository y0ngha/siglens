import 'server-only';
import { createRedisFlag } from '@/shared/cache/createRedisFlag';
import {
    CALENDAR_ANALYSIS_REFRESH_FLAG_KEY,
    CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS,
} from '../lib/economyCalendarConstants';

const _flag = createRedisFlag(
    CALENDAR_ANALYSIS_REFRESH_FLAG_KEY,
    CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS,
    '[calendarAnalysisRefreshFlag]'
);

/** 최근 TTL 내 분석 pass 수행 여부 — Redis 실패 시 false(항상 스캔). SP-A 플래그 미러. */
export const isAnalysisRecentlyRun = _flag.isSet;

/** "최근 분석함" 마킹 — Redis 실패 시 noop. */
export const markAnalysisRun = _flag.mark;
