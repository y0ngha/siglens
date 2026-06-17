import { vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return { ...actual, pollMacroBriefing: vi.fn() };
});

import { describe, it, expect, beforeEach } from 'vitest';
import { pollMacroBriefingAction } from '@/entities/economy/actions/pollMacroBriefingAction';
import { pollMacroBriefing } from '@y0ngha/siglens-core';

const mockPoll = vi.mocked(pollMacroBriefing);

describe('pollMacroBriefingAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('core 결과를 그대로 위임 반환', async () => {
        mockPoll.mockResolvedValue({ status: 'processing' });
        expect(await pollMacroBriefingAction('j')).toEqual({
            status: 'processing',
        });
    });

    it('done variant 통과', async () => {
        mockPoll.mockResolvedValue({
            status: 'done',
            briefing: { summary: 's', highlights: [], regime: 'neutral' },
            generatedAt: '2026-06-16T12:00:00.000Z',
        });
        const result = await pollMacroBriefingAction('j');
        expect(result.status).toBe('done');
    });

    it('throw → server_error + 에러 로깅', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockPoll.mockRejectedValue(new Error('worker down'));
        const result = await pollMacroBriefingAction('j');
        expect(result).toEqual({ status: 'error', error: 'server_error' });
        expect(spy).toHaveBeenCalledWith(
            '[pollMacroBriefingAction] failed:',
            expect.any(Error)
        );
        spy.mockRestore();
    });
});
