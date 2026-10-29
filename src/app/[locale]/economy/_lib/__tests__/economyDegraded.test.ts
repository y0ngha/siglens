import type { EconomySnapshot } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import {
    hasEconomyData,
    isKrEconomyDegraded,
} from '@/app/[locale]/economy/_lib/economyDegraded';

const EMPTY_SNAPSHOT: EconomySnapshot = {
    indicators: [],
    treasury: null,
    calendar: [],
};

const FULL_SNAPSHOT: EconomySnapshot = {
    indicators: [
        {
            name: 'federalFunds',
            latest: { date: '2026-05-01', value: 5.33 },
            previous: null,
            trend: [],
        },
    ],
    treasury: { date: '2026-06-15', year2: 4.07, year10: 4.47 },
    calendar: [],
};

describe('hasEconomyData', () => {
    it('로더 실패(null)는 데이터 없음이다', () => {
        expect(hasEconomyData(null)).toBe(false);
    });

    it('전 축이 빈 스냅샷은 데이터 없음이다', () => {
        expect(hasEconomyData(EMPTY_SNAPSHOT)).toBe(false);
    });

    it('지표가 있는 스냅샷은 데이터가 있다', () => {
        expect(hasEconomyData(FULL_SNAPSHOT)).toBe(true);
    });
});

describe('isKrEconomyDegraded', () => {
    it('지표도 캘린더도 없으면 degraded다', () => {
        expect(isKrEconomyDegraded({ cards: [], calendarEvents: [] })).toBe(
            true
        );
    });

    it('지표만 비고 캘린더가 있으면 degraded가 아니다', () => {
        expect(
            isKrEconomyDegraded({ cards: [], calendarEvents: ['event'] })
        ).toBe(false);
    });

    it('지표가 있으면 캘린더가 비어도 degraded가 아니다', () => {
        expect(
            isKrEconomyDegraded({ cards: ['card'], calendarEvents: [] })
        ).toBe(false);
    });
});
