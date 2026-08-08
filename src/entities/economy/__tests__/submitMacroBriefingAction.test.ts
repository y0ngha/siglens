vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
    headers: vi.fn(async () => new Headers()),
}));
vi.mock('@/shared/api/isBot');
vi.mock('@/entities/economy/api/economySnapshotCache');
vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return { ...actual, runMacroBriefing: vi.fn() };
});

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { submitMacroBriefingAction } from '@/entities/economy/actions/submitMacroBriefingAction';
import { isBot } from '@/shared/api/isBot';
import { getEconomySnapshot } from '@/entities/economy/api/economySnapshotCache';
import { runMacroBriefing, type EconomySnapshot } from '@y0ngha/siglens-core';

const mockIsBot = vi.mocked(isBot);
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

    it('봇이면 즉시 차단 (snapshot/submit 미호출)', async () => {
        mockIsBot.mockReturnValue(true);
        const result = await submitMacroBriefingAction();
        expect(result).toEqual({ briefing: null, botBlocked: true });
        expect(mockGetSnapshot).not.toHaveBeenCalled();
        expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('비봇이면 snapshot을 입력으로 runMacroBriefing 호출', async () => {
        mockIsBot.mockReturnValue(false);
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
            botBlocked: false,
        });
    });

    it('내부 throw는 server_error + 에러 로깅', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockIsBot.mockReturnValue(false);
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
