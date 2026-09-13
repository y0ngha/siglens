import 'server-only';
import { createCounterStore, type AgentCounters } from '@y0ngha/siglens-core';

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
