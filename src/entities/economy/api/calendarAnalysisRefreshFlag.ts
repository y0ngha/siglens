import 'server-only';
import { createRedisFlag } from '@/shared/cache/createRedisFlag';
import {
    CALENDAR_ANALYSIS_REFRESH_FLAG_KEY,
    CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS,
    type CalendarCountry,
} from '../lib/economyCalendarConstants';

/**
 * 국가별 키. 전역 키 하나면 먼저 방문한 쪽이 30분 창을 태워, 다른 국가의 발표는
 * 그 시간 동안 통째로 분석되지 않는다 — 인제스션 플래그를 국가별로 가른 것과 같은 이유.
 */
const analysisFlag = createRedisFlag<CalendarCountry>(
    country => `${CALENDAR_ANALYSIS_REFRESH_FLAG_KEY}:${country.toLowerCase()}`,
    CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS,
    '[calendarAnalysisRefreshFlag]'
);

/** 최근 TTL 내 분석 pass 수행 여부 — Redis 실패 시 false(항상 스캔). SP-A 플래그 미러. */
export const isAnalysisRecentlyRun = analysisFlag.isSet;

/** "최근 분석함" 마킹 — Redis 실패 시 noop. */
export const markAnalysisRun = analysisFlag.mark;
