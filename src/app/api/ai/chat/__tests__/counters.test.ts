import { describe, expect, it, vi } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({
    mockCreate: vi.fn((o: unknown) => ({ o })),
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<object>()),
    createCounterStore: mockCreate,
}));

import { agentLimit } from '@y0ngha/siglens-core';
import {
    createAgentCounters,
    createGuestIpBackstopCounter,
    GUEST_IP_TURNS_PER_DAY,
} from '@/app/api/ai/chat/counters';

describe('createAgentCounters', () => {
    it('6개 스토어 전부 closed, 월 카운터만 month', () => {
        const counters = createAgentCounters();

        expect(Object.keys(counters)).toEqual([
            'turns',
            'premiumTurns',
            'freshAnalysis',
            'webSearchUser',
            'webSearchGlobalDay',
            'webSearchGlobalMonth',
        ]);

        const opts = mockCreate.mock.calls.map(
            ([o]) =>
                o as { prefix: string; period: string; failurePolicy: string }
        );
        expect(opts.every(o => o.failurePolicy === 'closed')).toBe(true);
        expect(
            opts.find(o => o.prefix === 'agent:q:search-month')?.period
        ).toBe('month');
        expect(opts.filter(o => o.period === 'day')).toHaveLength(5);
    });
});

describe('createGuestIpBackstopCounter', () => {
    it('agent:q:guest-ip prefix로 day/closed 스토어를 만든다', () => {
        createGuestIpBackstopCounter();

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                prefix: 'agent:q:guest-ip',
                period: 'day',
                failurePolicy: 'closed',
            })
        );
    });
});

describe('GUEST_IP_TURNS_PER_DAY', () => {
    it('free 티어 turnsPerDay의 10배(리터럴이 core 값과 드리프트하지 않는지 확인)', () => {
        expect(GUEST_IP_TURNS_PER_DAY).toBe(
            10 * agentLimit('free', 'turnsPerDay')
        );
    });
});
