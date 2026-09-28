import 'server-only';
import { cache } from 'react';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { getEconomyProvider } from '@/shared/api/economy/getEconomyProvider';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { ISO_DATE_LENGTH, SECONDS_PER_HOUR } from '@/shared/config/time';

import { addEtDays } from '../lib/calendarWindow';

/** 뉴스 분석 매크로 캘린더 창 — 오늘(UTC) 기준 과거 2일 ~ 미래 14일. */
const NEWS_MACRO_PAST_DAYS = 2;
const NEWS_MACRO_FUTURE_DAYS = 14;

/**
 * 뉴스 분석(`runNewsAnalysis`)과 종합 분석 뉴스 축(`runOverallAnalysis`)에 넘길
 * 매크로 캘린더(US · High impact · 날짜 오름차순).
 *
 * **캐시 키 불변식**: core는 이 배열의 모든 렌더 필드(actual 포함)를 분석 캐시 키에
 * 접는다. `/news` 경로와 overall 뉴스 축이 같은 키를 맞히려면 두 경로가 같은 행을
 * 받아야 하므로, 모든 호출처가 이 헬퍼 하나만 쓰고 결과는 Redis에 창(from/to) 단위로
 * 1시간 묶는다 — 인스턴스마다 FMP를 따로 읽어 `actual`이 엇갈리는 것을 막는다.
 *
 * 실패 의미론: provider 장애 시 `[]`(캐시하지 않음). 빈 배열이면 core 프롬프트·캐시
 * 키가 이 옵션 도입 전과 byte-identical이라 분석 자체는 막지 않는다.
 */
export const loadNewsMacroCalendar = cache(
    async (): Promise<readonly EconomicCalendarEvent[]> => {
        const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
        const from = addEtDays(today, -NEWS_MACRO_PAST_DAYS);
        const to = addEtDays(today, NEWS_MACRO_FUTURE_DAYS);
        try {
            return await getOrSetCache(
                `economy:news-macro-calendar:${from}:${to}`,
                SECONDS_PER_HOUR,
                async () =>
                    (await getEconomyProvider().getCalendar(from, to))
                        .filter(e => e.impact === 'High')
                        .toSorted((a, b) => a.date.localeCompare(b.date))
            );
        } catch (error) {
            console.error(
                '[loadNewsMacroCalendar] calendar fetch failed:',
                error
            );
            return [];
        }
    }
);
