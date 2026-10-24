import 'server-only';
import { DrizzleSecFilingsRepository } from '@/entities/investor-flows/api/investorFlowsFilingsRepository';
import { fetchCompanyConceptJson } from '@/shared/api/sec/secClient';
import { createRedisFlag } from '@/shared/cache/createRedisFlag';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { FMP_FUNDAMENTAL_CACHE_TTL_SECONDS } from '@/shared/config/time';
import type { SiglensDatabase } from '@/shared/db/types';
import {
    buildSecQuarters,
    parseConceptFacts,
    pickCurrentConcept,
    SEC_EPS_CONCEPT,
    SEC_EPS_UNIT,
    SEC_REVENUE_CONCEPTS,
    SEC_REVENUE_UNIT,
    type SecQuarter,
} from './secQuarters';

/**
 * Bump when the cached {@link SecQuarter} shape or the extraction rules
 * change — old entries are read as the new shape otherwise.
 */
const SEC_QUARTERS_CACHE_KEY_PREFIX = 'sec:xbrl-quarters:v1';

/**
 * Failure marker TTL per CIK. A failed fetch is not cached as data, but an SEC
 * outage or throttle would otherwise re-issue five requests on every cold
 * call; the marker makes the next calls fail fast (no SEC request) for this
 * long. Short, so recovery is quick.
 */
export const SEC_QUARTERS_FAILURE_TTL_SECONDS = 180;

/**
 * Ceiling on how long `get_fundamentals` waits for this optional enrichment.
 * The SEC requests themselves may take up to 8s each (shared budget); a
 * degraded SEC must not add that to the tool. On timeout the caller degrades
 * to the FMP rows while the fetch keeps going in the background, so a slow
 * success still fills the cache for the next call.
 */
export const SEC_QUARTERS_BUDGET_MS = 4_000;

const secQuartersFailure = createRedisFlag<number>(
    cik => `${SEC_QUARTERS_CACHE_KEY_PREFIX}:failed:${cik}`,
    SEC_QUARTERS_FAILURE_TTL_SECONDS,
    '[secQuartersFailure]'
);

/**
 * One CIK's quarters: five `companyconcept` requests (diluted EPS and the
 * four revenue tag candidates, a 404 meaning "never used"), reduced to
 * {@link SecQuarter} rows. They share the process-wide SEC request gate
 * (220 ms apart), so a cold fetch takes about a second. Any non-404 failure
 * rejects — the cache layer then stores nothing and the caller degrades.
 */
async function fetchSecQuarters(cik: number): Promise<SecQuarter[]> {
    if (await secQuartersFailure.isSet(cik)) {
        throw new Error('SEC quarters fetch recently failed');
    }
    try {
        return await fetchAndBuild(cik);
    } catch (error) {
        await secQuartersFailure.mark(cik);
        throw error;
    }
}

async function fetchAndBuild(cik: number): Promise<SecQuarter[]> {
    const [eps, ...revenues] = await Promise.all([
        fetchCompanyConceptJson(cik, SEC_EPS_CONCEPT),
        ...SEC_REVENUE_CONCEPTS.map(concept =>
            fetchCompanyConceptJson(cik, concept)
        ),
    ]);
    return buildSecQuarters(
        parseConceptFacts(eps, SEC_EPS_UNIT),
        pickCurrentConcept(
            revenues.map(json => parseConceptFacts(json, SEC_REVENUE_UNIT))
        )
    );
}

/**
 * As-filed quarterly EPS and revenue for a US domestic SEC filer, from the
 * official XBRL API. `null` when the symbol has no CIK in `sec_cik_symbol_map`
 * (outside the investor-flows universe, Korean, crypto…). An empty array means
 * the filer has no 10-Q/10-K quarter facts (a foreign issuer).
 *
 * Cached per CIK for a day — the extracted rows, not the raw JSON. A rejected
 * fetch is not cached as data; it leaves a short failure marker instead, and
 * the wait is capped at {@link SEC_QUARTERS_BUDGET_MS}. Throws on SEC/DB
 * failure or timeout; the caller degrades to the FMP rows.
 */
export async function loadSecQuarters(
    symbol: string,
    db: SiglensDatabase
): Promise<SecQuarter[] | null> {
    const cik = await new DrizzleSecFilingsRepository(db).findCikBySymbol(
        symbol
    );
    if (cik === null) return null;
    const load = getOrSetCache(
        `${SEC_QUARTERS_CACHE_KEY_PREFIX}:${cik}`,
        FMP_FUNDAMENTAL_CACHE_TTL_SECONDS,
        () => fetchSecQuarters(cik)
    );
    // The losing promise is left running (it may still fill the cache); its
    // late rejection must not surface as unhandled.
    void load.catch(() => undefined);
    return withBudget(load, SEC_QUARTERS_BUDGET_MS);
}

async function withBudget<T>(work: Promise<T>, ms: number): Promise<T> {
    const deadline = Promise.withResolvers<never>();
    const timer = setTimeout(
        () => deadline.reject(new Error('SEC quarters budget exceeded')),
        ms
    );
    try {
        return await Promise.race([work, deadline.promise]);
    } finally {
        clearTimeout(timer);
    }
}
