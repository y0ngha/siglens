vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
    headers: vi.fn(async () => new Headers()),
}));
vi.mock('@/entities/economy/api/economySnapshotCache');
vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return { ...actual, runMacroBriefing: vi.fn() };
});

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { submitMacroBriefingAction } from '@/entities/economy/actions/submitMacroBriefingAction';
import { headers } from 'next/headers';
import { getEconomySnapshot } from '@/entities/economy/api/economySnapshotCache';
import { runMacroBriefing, type EconomySnapshot } from '@y0ngha/siglens-core';

const mockHeaders = vi.mocked(headers);
const mockGetSnapshot = vi.mocked(getEconomySnapshot);
const mockSubmit = vi.mocked(runMacroBriefing);

const SNAPSHOT: EconomySnapshot = {
    indicators: [],
    treasury: null,
    calendar: [],
};

describe('submitMacroBriefingAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSnapshot.mockResolvedValue(SNAPSHOT);
    });

    // UA로 가르지 않는다 — 봇 판정이 참이어도 사람과 같은 브리핑을 받는다
    // (Googlebot 렌더가 차단 안내문을 색인하던 회귀 방지, 2026-09-17).
    it('봇 UA여도 snapshot을 입력으로 runMacroBriefing을 호출한다', async () => {
        // `isBot`은 목하지 않는다 — 진짜 판정기에 Googlebot UA를 넘겨, 누가 UA
        // 분기를 되살리면 이 테스트가 실패하게 한다.
        mockHeaders.mockResolvedValueOnce(
            new Headers({
                'user-agent':
                    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            }) as never
        );
        mockSubmit.mockResolvedValue({
            status: 'cached',
            briefing: { summary: 'ok' } as never,
            generatedAt: '2025-01-01',
        });
        const result = await submitMacroBriefingAction();
        expect(mockSubmit).toHaveBeenCalledWith(SNAPSHOT, {
            signal: undefined,
        });
        expect(result).toEqual({
            briefing: {
                status: 'cached',
                briefing: { summary: 'ok' },
                generatedAt: '2025-01-01',
            },
        });
    });

    it('snapshot을 입력으로 runMacroBriefing 호출', async () => {
        mockSubmit.mockResolvedValue({
            status: 'done',
            briefing: { summary: 'ok' } as never,
            generatedAt: '2025-01-01',
        });
        const result = await submitMacroBriefingAction();
        expect(mockSubmit).toHaveBeenCalledWith(SNAPSHOT, {
            signal: undefined,
        });
        expect(result).toEqual({
            briefing: {
                status: 'done',
                briefing: { summary: 'ok' },
                generatedAt: '2025-01-01',
            },
        });
    });

    it('내부 throw는 server_error + 에러 로깅', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockGetSnapshot.mockRejectedValue(new Error('redis down'));
        const result = await submitMacroBriefingAction();
        expect(result).toEqual({ ok: false, error: 'server_error' });
        expect(spy).toHaveBeenCalledWith(
            '[submitMacroBriefingAction] failed:',
            expect.any(Error)
        );
        spy.mockRestore();
    });
});
