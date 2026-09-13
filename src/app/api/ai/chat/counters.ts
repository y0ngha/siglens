import 'server-only';
import {
    createCounterStore,
    type AgentCounters,
    type CounterStore,
} from '@y0ngha/siglens-core';

/**
 * Many guests can share one NAT/CGNAT address, so this cannot be as tight as
 * a per-guest limit — it exists only to stop clearing `siglens_guest`
 * (`guestSubject.ts`) from buying unlimited free turns from the same
 * network. ~10 guests' worth of the free tier's daily turn allowance
 * (`10 * agentLimit('free', 'turnsPerDay')` — kept a literal rather than
 * computed from core so importing this module can't run core at load time
 * and break partial core mocks in tests; `counters.test.ts` has a drift
 * test against the core value).
 */
export const GUEST_IP_TURNS_PER_DAY = 100;

/** Per-IP backstop consumed once per guest turn, before the per-guest quota. Fails closed. */
export function createGuestIpBackstopCounter(): CounterStore {
    return createCounterStore({
        prefix: 'agent:q:guest-ip',
        period: 'day',
        failurePolicy: 'closed',
    });
}

/** All agent quotas fail-closed (spec §2-10). Keys: agent:q:<feature>:<subject>:<bucket>. */
export function createAgentCounters(): AgentCounters {
    const day = (prefix: string) =>
        createCounterStore({ prefix, period: 'day', failurePolicy: 'closed' });
    return {
        turns: day('agent:q:turns'),
        premiumTurns: day('agent:q:premium'),
        freshAnalysis: day('agent:q:fresh'),
        webSearchUser: day('agent:q:search'),
        webSearchGlobalDay: day('agent:q:search-day'),
        webSearchGlobalMonth: createCounterStore({
            prefix: 'agent:q:search-month',
            period: 'month',
            failurePolicy: 'closed',
        }),
    };
}
