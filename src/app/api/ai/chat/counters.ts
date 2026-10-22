import 'server-only';
import {
    AGENT_GLOBAL_LIMITS,
    createCounterStore,
    type AgentCounters,
    type AgentGlobalLimits,
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

/**
 * Optional override of core's shared web-search budget (`AGENT_GLOBAL_LIMITS`, Brave free
 * credits). Set `AGENT_WEB_SEARCH_PER_DAY` / `AGENT_WEB_SEARCH_PER_MONTH` only while extra Brave
 * capacity has been bought (e.g. a benchmark measurement window); unset means core's default.
 * A malformed value is ignored with a warning rather than silently uncapping or blocking search.
 * Read per call (not at module load) so tests and core partial mocks are unaffected.
 */
export function agentGlobalLimitsFromEnv(
    env: Record<string, string | undefined> = process.env
): AgentGlobalLimits | undefined {
    const day = parseLimit(
        env.AGENT_WEB_SEARCH_PER_DAY,
        'AGENT_WEB_SEARCH_PER_DAY'
    );
    const month = parseLimit(
        env.AGENT_WEB_SEARCH_PER_MONTH,
        'AGENT_WEB_SEARCH_PER_MONTH'
    );
    if (day === undefined && month === undefined) return undefined;
    return {
        webSearchPerDay: day ?? AGENT_GLOBAL_LIMITS.webSearchPerDay,
        webSearchPerMonth: month ?? AGENT_GLOBAL_LIMITS.webSearchPerMonth,
    };
}

/** `name=value` pairs already warned about — the env is read every turn, the warning is not. */
const warnedMalformedLimits = new Set<string>();

/** Test-only: forget which malformed values were already warned about. */
export function __resetWarnedMalformedLimitsForTests(): void {
    warnedMalformedLimits.clear();
}

function parseLimit(raw: string | undefined, name: string): number | undefined {
    if (raw === undefined || raw.trim() === '') return undefined;
    if (!/^\d+$/.test(raw.trim())) {
        const key = `${name}=${raw}`;
        if (!warnedMalformedLimits.has(key)) {
            warnedMalformedLimits.add(key);
            console.warn(
                '[agent] ignoring malformed web search limit (non-negative integer only)',
                { name }
            );
        }
        return undefined;
    }
    return Number(raw.trim());
}
