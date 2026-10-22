import { describe, expect, it, vi } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({
    mockCreate: vi.fn((o: unknown) => ({ o })),
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<object>()),
    createCounterStore: mockCreate,
}));

import { AGENT_GLOBAL_LIMITS, agentLimit } from '@y0ngha/siglens-core';
import {
    __resetWarnedMalformedLimitsForTests,
    agentGlobalLimitsFromEnv,
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

describe('agentGlobalLimitsFromEnv', () => {
    it('둘 다 없으면 undefined(core 기본 예산 사용)', () => {
        expect(agentGlobalLimitsFromEnv({})).toBeUndefined();
        expect(
            agentGlobalLimitsFromEnv({ AGENT_WEB_SEARCH_PER_DAY: ' ' })
        ).toBeUndefined();
    });

    it('설정한 값만 바꾸고 나머지는 core 기본값을 쓴다', () => {
        expect(
            agentGlobalLimitsFromEnv({ AGENT_WEB_SEARCH_PER_DAY: '500' })
        ).toEqual({
            webSearchPerDay: 500,
            webSearchPerMonth: AGENT_GLOBAL_LIMITS.webSearchPerMonth,
        });
        expect(
            agentGlobalLimitsFromEnv({
                AGENT_WEB_SEARCH_PER_DAY: '500',
                AGENT_WEB_SEARCH_PER_MONTH: '6000',
            })
        ).toEqual({ webSearchPerDay: 500, webSearchPerMonth: 6000 });
    });

    it.each(['-1', '1.5', 'abc', 'Infinity'])(
        '잘못된 값(%s)은 경고 후 무시하고, 같은 값은 다시 경고하지 않는다',
        bad => {
            __resetWarnedMalformedLimitsForTests();
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            expect(
                agentGlobalLimitsFromEnv({ AGENT_WEB_SEARCH_PER_DAY: bad })
            ).toBeUndefined();
            // the env is read every turn; the same bad value warns only once
            agentGlobalLimitsFromEnv({ AGENT_WEB_SEARCH_PER_DAY: bad });
            expect(warn).toHaveBeenCalledTimes(1);
            warn.mockRestore();
        }
    );
});
