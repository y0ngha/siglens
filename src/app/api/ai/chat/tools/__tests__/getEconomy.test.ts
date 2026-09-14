import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { snapshot, briefing } = vi.hoisted(() => ({
    snapshot: vi.fn(),
    briefing: vi.fn(),
}));
vi.mock('@/entities/economy/api/economySnapshotStaticCache', () => ({
    getEconomySnapshotStatic: snapshot,
}));
vi.mock('@/entities/economy/api/macroBriefingStaticCache', () => ({
    peekMacroBriefingStatic: briefing,
}));

import { getEconomyTool } from '@/app/api/ai/chat/tools/getEconomy';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };
const DAY_MS = 24 * 60 * 60 * 1000;

describe('getEconomyTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-14T00:00:00.000Z'));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('스냅샷이 없으면 available:false', async () => {
        snapshot.mockRejectedValue(new Error('redis down'));
        const r = await getEconomyTool({}, ctx, rt);
        expect(r).toEqual({
            available: false,
            reason: 'snapshot_unavailable',
        });
        expect(briefing).not.toHaveBeenCalled();
    });

    it('캘린더는 향후 7일 창으로만 필터링되고 브리핑을 함께 반환한다', async () => {
        const inWindow = new Date(Date.now() + 3 * DAY_MS).toISOString();
        const tooFar = new Date(Date.now() + 10 * DAY_MS).toISOString();
        const past = new Date(Date.now() - DAY_MS).toISOString();
        snapshot.mockResolvedValue({
            indicators: [
                {
                    name: 'federalFunds',
                    latest: { date: '2026-09-01', value: 4.5 },
                    previous: { date: '2026-08-01', value: 4.5 },
                    trend: [],
                },
            ],
            treasury: { date: '2026-09-12', year2: 3.9, year10: 4.1 },
            calendar: [
                {
                    date: inWindow,
                    event: 'CPI YoY',
                    impact: 'High',
                    actual: null,
                    estimate: 3.1,
                    previous: 3.0,
                    unit: '%',
                },
                {
                    date: tooFar,
                    event: 'FOMC',
                    impact: 'High',
                    actual: null,
                    estimate: null,
                    previous: null,
                    unit: '%',
                },
                {
                    date: past,
                    event: 'Past release',
                    impact: 'Low',
                    actual: 1,
                    estimate: 1,
                    previous: 1,
                    unit: '%',
                },
            ],
        });
        briefing.mockResolvedValue({
            summary: '완만한 성장세가 이어지고 있습니다.',
            highlights: [],
            regime: 'expansion',
        });

        const r = (await getEconomyTool({}, ctx, rt)) as {
            available: boolean;
            upcomingCalendar: Array<{ event: string }>;
            briefing: { regime: string };
        };
        expect(r.available).toBe(true);
        expect(r.upcomingCalendar).toHaveLength(1);
        expect(r.upcomingCalendar[0]!.event).toBe('CPI YoY');
        expect(r.briefing.regime).toBe('expansion');
    });

    it('FMP의 존 표시 없는 UTC 일시를 ISO 인스턴트로 바꿔 창 필터와 사용자 시간대 변환이 맞게 된다', async () => {
        // 2026-09-15 12:30 UTC = 21:30 KST. 서버 로컬 시간으로 읽히거나 존 없이
        // 넘어가면 모델이 "12:30"을 한국 시각처럼 옮긴다.
        snapshot.mockResolvedValue({
            indicators: [],
            treasury: null,
            calendar: [
                {
                    date: '2026-09-15 12:30:00',
                    event: 'NY Empire State Manufacturing Index',
                    impact: 'High',
                    actual: null,
                    estimate: 15,
                    previous: 20.6,
                    unit: null,
                },
                {
                    // 창 밖(현재 2026-09-14T00:00Z 이전) — 로컬 파싱이면 경계가 흔들린다.
                    date: '2026-09-13 23:30:00',
                    event: 'Past',
                    impact: 'Low',
                    actual: 1,
                    estimate: 1,
                    previous: 1,
                    unit: null,
                },
            ],
        });
        briefing.mockResolvedValue(null);
        const r = (await getEconomyTool({}, ctx, rt)) as {
            upcomingCalendar: Array<{ date: string; event: string }>;
        };
        expect(r.upcomingCalendar).toEqual([
            expect.objectContaining({
                date: '2026-09-15T12:30:00Z',
                event: 'NY Empire State Manufacturing Index',
            }),
        ]);
    });

    it('브리핑 조회가 실패해도(catch) 스냅샷 나머지 필드는 반환된다', async () => {
        snapshot.mockResolvedValue({
            indicators: [],
            treasury: null,
            calendar: [],
        });
        briefing.mockRejectedValue(new Error('cache miss'));
        const r = (await getEconomyTool({}, ctx, rt)) as {
            available: boolean;
            briefing: unknown;
        };
        expect(r.available).toBe(true);
        expect(r.briefing).toBeNull();
    });
});
