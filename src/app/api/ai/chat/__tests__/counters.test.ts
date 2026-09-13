import { describe, expect, it, vi } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({
    mockCreate: vi.fn((o: unknown) => ({ o })),
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<object>()),
    createCounterStore: mockCreate,
}));

import { createAgentCounters } from '@/app/api/ai/chat/counters';

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
