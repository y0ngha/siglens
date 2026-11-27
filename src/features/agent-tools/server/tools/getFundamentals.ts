import 'server-only';
import {
    FUNDAMENTALS_RESULT_NOTES,
    tallyEarningsReactions,
    type Bar,
    type EarningsReactionTally,
    type MarketSessionSpec,
} from '@y0ngha/siglens-core';
import {
    resolveNextEarnings,
    type ResolvedNextEarnings,
} from '@/entities/analyst-views/lib/resolveNextEarnings';
import type { EarningsSession } from '@/entities/analyst-views/model';
import { getAnalystViews } from '@/entities/analyst-views/server/getAnalystViews';
import { pctVs, ratioPct } from '@/entities/bars/lib/percent';
import {
    lastBarIsForming,
    lastCompletedDailyClose,
    type CompletedDailyClose,
} from '@/entities/bars/lib/quantizeBars';
import {
    roundNumber,
    roundNumbersDeep,
} from '@/entities/bars/lib/roundIndicators';
import { getCachedBarsWithIndicators } from '@/entities/bars/server/barsDataCache';
import {
    getNextEarningsSchedule,
    listReportedEarningsDates,
} from '@/entities/earnings-report/api';
import { loadSecQuarters } from '@/entities/earnings-report/server/loadSecQuarters';
import {
    loadIndexMemberships,
    type IndexMemberships,
} from '@/entities/index-history/server/indexMembership';
import { krListedBasis } from '@/entities/kr-valuation/lib/krListedBasis';
import { getKrValuation } from '@/entities/kr-valuation/server/getKrValuation';
import {
    findKrListedShares,
    isTabAllowedForSymbol,
} from '@/entities/ticker/api';
import { staleKrListingDate } from '@/entities/ticker/lib/freshness';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { resolveAssetInfoOrNull } from '@/entities/ticker/server/resolveAssetInfo';
import {
    earningsReactions,
    QUARTERS_FETCH_COUNT,
    recentQuarterRows,
    type EarningsReactionView,
    type SecQuarterView,
} from '@/features/agent-tools/lib/earningsHistory';
import type { ToolExecutor } from '@/features/agent-tools/model';
import {
    buildDividends,
    fetchDividendSource,
    withAnnualReported,
    type DividendsView,
} from '@/features/agent-tools/server/data/dividends';
import { fetchKrAnnualDividend } from '@/features/agent-tools/server/data/krAnnualDividend';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import { getFmpGradesConsensus } from '@/shared/api/fmp/getFmpGradesConsensus';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import {
    gradeCountsOnly,
    readGradesSource,
} from '@/shared/api/fmp/gradesConsensusSource';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { quoteWithTimeout } from '@/shared/api/market/quoteTimeout';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import {
    getDescriptor,
    isKrEquitySymbol,
} from '@/shared/config/marketProfile/registry';
import {
    FMP_FUNDAMENTAL_CACHE_TTL_SECONDS,
    SECONDS_PER_HOUR,
    MS_PER_DAY,
    MS_PER_SECOND,
} from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import type { SiglensDatabase } from '@/shared/db/types';
import { logToolDegrade } from '@/shared/lib/logToolDegrade';
import { zonedDate } from '@/shared/lib/marketSessionDate';

function settledOrNull<T>(r: PromiseSettledResult<T>): T | null {
    return r.status === 'fulfilled' ? r.value : null;
}

/**
 * Whole calendar days from `now` to `dateStr` (`YYYY-MM-DD`), in the
 * market's OWN timezone — can be negative (a past date). Both dates are
 * reduced to their LOCAL calendar date first (`zonedDate`) and diffed as
 * UTC-midnight instants of those dates, which is always an exact integer —
 * unlike rounding a raw `(target - now) / MS_PER_DAY` ms difference, which
 * is thrown off by `now`'s time-of-day: e.g. earnings tomorrow but `now` is
 * still mid-afternoon ET would leave under 24h of raw ms until a UTC-
 * midnight-parsed `target`, rounding down to "0 days" (today) instead of the
 * correct "1 day" (tomorrow). `now`/`timeZone` are parameters (defaults
 * `new Date()`/ET) so the day count is testable without mocking the system
 * clock. `null` on an unparseable date, per the null rule (spec §0).
 */
export function daysUntil(
    dateStr: string | null,
    now: Date = new Date(),
    timeZone: string = 'America/New_York'
): number | null {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (!Number.isFinite(target.getTime())) return null;
    const targetDate = target.toISOString().slice(0, 10);
    const nowDate = zonedDate(now, timeZone);
    const diffMs =
        Date.parse(`${targetDate}T00:00:00Z`) -
        Date.parse(`${nowDate}T00:00:00Z`);
    return Math.round(diffMs / MS_PER_DAY);
}

/**
 * Price reaction to the last reported earnings (`earningsReactions`). Waits for
 * the `getNextEarningsSchedule` refresh already in flight (it upserts the FMP/yahoo
 * rows) so a stale DB is read after the refresh, never racing it; a failed
 * refresh still reads what the DB has. Daily bars come from the same in-memory
 * cache `get_bars_indicators` fills, so a turn that calls both loads them once.
 * Never throws: `null` (logged) when either input fails or no reaction can be
 * measured.
 */
async function loadEarningsReactions(
    symbol: string,
    db: SiglensDatabase,
    session: MarketSessionSpec,
    refresh: Promise<unknown>,
    loadDailyBars: () => Promise<readonly Bar[]>
): Promise<EarningsReactionView[] | null> {
    try {
        const readDates = () => listReportedEarningsDates(symbol, db);
        const [dates, bars] = await Promise.all([
            refresh.then(readDates, readDates),
            loadDailyBars(),
        ]);
        const reactions = earningsReactions(
            bars,
            dates,
            lastBarIsForming(bars, session, new Date())
        );
        return reactions.length > 0 ? reactions : null;
    } catch (error) {
        logToolDegrade('get_fundamentals', 'earnings reactions', error);
        return null;
    }
}

/**
 * Last completed regular-session daily close (see `lastCompletedDailyClose`) — the price a
 * KRX-listed-share market cap is multiplied by. Reads the same cached daily bars
 * `loadEarningsReactions` and `get_bars_indicators` use (one load per turn).
 * Never throws: `null` (logged) on failure.
 */
async function loadLastCompletedClose(
    loadDailyBars: () => Promise<readonly Bar[]>,
    session: MarketSessionSpec
): Promise<CompletedDailyClose | null> {
    try {
        return lastCompletedDailyClose(
            await loadDailyBars(),
            session,
            new Date()
        );
    } catch (error) {
        logToolDegrade('get_fundamentals', 'last completed close', error);
        return null;
    }
}

/**
 * How certain `nextEarningsDate` is, stated in the tool output rather than
 * implied. FMP `/stable/earnings` has no `time` field and no confirmation
 * flag, and the Yahoo path (KR) only says whether the date is Yahoo's own
 * estimate (`isEarningsDateEstimate`). So `earningsDateConfirmed` is a boolean
 * only for Yahoo rows and `null` (unknown) otherwise — a real turn answered a
 * moved COP date with no hedge because nothing in the output said it could be a
 * schedule estimate.
 *
 * US stocks add a second opinion: Yahoo's `calendarEvents` (via
 * `entities/analyst-views`). When Yahoo names the SAME report date as the DB/FMP
 * row, its tri-state `isEstimate` settles `earningsDateConfirmed`
 * (`false`→`true`, `true`→`false`, `null`→keep the existing value) and a
 * confirmed date also carries `earningsSession` (+ `earningsCallAt` when the call
 * is on the report date). Yahoo's confirmed time is a session marker, not a real
 * clock time, so only the session is exposed. No date → no certainty fields.
 */
interface EarningsDateCertainty {
    earningsDateConfirmed: boolean | null;
    earningsDateNote: string;
    earningsSession?: EarningsSession;
    earningsCallAt?: string;
}

/**
 * 실측(2026-10-24): FMP `earnings-calendar` 행은 `symbol,date,epsActual,epsEstimated,revenueActual,
 * revenueEstimated,lastUpdated`뿐이라 bmo/amc 같은 시간대 필드가 없다. 그래서 세션을 모르는 경우 도구는
 * 시간대를 내지 않고, 모델이 `web_search`로 회사가 공지한 시간대를 찾아 출처와 함께 말하도록 안내한다.
 */
const SESSION_TIMING_NOT_PROVIDED =
    'Session timing (before/after market) is not provided by the data source; use web_search to find the timing the company announced and cite the source, never guess.';

/** `earningsSession`이 함께 나갈 때의 안내: 위 문장 대신 쓴다(모델이 불필요하게 검색하지 않게). */
const SESSION_TIMING_GIVEN =
    'Session timing relative to the US regular session is given in earningsSession; quote it as given.';

/**
 * 날짜 자체가 정해지지 않았을 때의 안내(추정일이거나 두 출처의 날짜가 다를 때). 회사가 날짜를 확정하지
 * 않았으면 발표 시간대도 공지되지 않은 것이라, 검색을 시키면 쿼터만 쓰고 답은 못 얻는다(core 프롬프트의
 * web_search 예외 행이 같은 조건으로 검색을 막는다 — 두 문장이 어긋나면 모델이 다시 검색한다).
 */
const SESSION_TIMING_UNSETTLED =
    'Session timing has not been announced while the date itself is unsettled; say so and do not search for it.';

/** 발표 시간대를 안내 문장이 어떻게 말할지: 제공 안 됨(검색 안내) · `earningsSession`으로 제공 · 날짜 미정이라 미공지. */
export type EarningsTimingNote = 'not_provided' | 'given' | 'unsettled';

const TIMING_NOTE: Record<EarningsTimingNote, string> = {
    not_provided: SESSION_TIMING_NOT_PROVIDED,
    given: SESSION_TIMING_GIVEN,
    unsettled: SESSION_TIMING_UNSETTLED,
};

/** 확정 여부 3상태(`true`·`false`·모름) → 모델에게 보여 줄 안내 문장. */
export function earningsDateNoteFor(
    confirmed: boolean | null,
    timingNote: EarningsTimingNote = 'not_provided'
): string {
    const timing = TIMING_NOTE[timingNote];
    switch (confirmed) {
        case true:
            return `Date confirmed by the provider. ${timing}`;
        case false:
            return `Provider marks this date as an estimate; it may move. ${timing}`;
        case null:
            return `Provider gives no confirmation flag, so treat this as a scheduled date that may move. ${timing}`;
    }
}

/**
 * 이미 대조가 끝난 `resolveNextEarnings` 결과를 도구 출력 필드로 옮긴다. `earnings`가 `null`(일정 행 없음)이면
 * 확정도 세션도 말할 것이 없어 빈 객체다. 날짜가 서로 다른 채 남았으면(`alt`) 검색을 시키지 않는다.
 */
export function earningsDateCertainty(
    resolved: ResolvedNextEarnings | null
): Partial<EarningsDateCertainty> {
    if (resolved === null) return {};
    const { confirmed, session, callAt, alt } = resolved;
    const timingNoteOf = (): EarningsTimingNote => {
        if (session !== null) return 'given';
        return alt !== null || confirmed === false
            ? 'unsettled'
            : 'not_provided';
    };
    const timingNote = timingNoteOf();
    return {
        earningsDateConfirmed: confirmed,
        earningsDateNote: earningsDateNoteFor(confirmed, timingNote),
        ...(session !== null && { earningsSession: session }),
        ...(session !== null && callAt !== null && { earningsCallAt: callAt }),
    };
}

/**
 * Attaches `earningsReactionTally` right after `earningsReactions` so the model quotes
 * the up/down counts and extremes instead of counting the list (the miscount
 * the tally exists to remove). `null` exactly when `earningsReactions` is `null`.
 *
 * Pure function of the result shape: the tally reads the reactions as printed
 * (already rounded), and the evaluation replay calls this same function on a
 * recorded result, so it never runs a copy of production logic.
 */
export function withEarningsReactionTally<T extends object>(
    result: T
): T & { earningsReactionTally: EarningsReactionTally | null } {
    const reactions =
        (
            result as {
                earningsReactions?: readonly EarningsReactionView[] | null;
            }
        ).earningsReactions ?? null;
    const tally = reactions === null ? null : tallyEarningsReactions(reactions);
    const entries = Object.entries(result).flatMap(
        ([key, value]): [string, unknown][] =>
            key === 'earningsReactions'
                ? [
                      [key, value],
                      ['earningsReactionTally', tally],
                  ]
                : [[key, value]]
    );
    // A result without the `earningsReactions` key still carries the tally (null), at the end.
    const withTally = entries.some(([key]) => key === 'earningsReactionTally')
        ? entries
        : [...entries, ['earningsReactionTally', tally]];
    return Object.fromEntries(withTally) as T & {
        earningsReactionTally: EarningsReactionTally | null;
    };
}

/** The slice of a finished `get_fundamentals` result that decides which `notes` apply. */
interface FundamentalsNotesInput {
    valuation: { pe: number | null } | null;
    dividends: DividendsView | null;
    recentQuarters: readonly { sec: SecQuarterView | null }[] | null;
    indexMemberships: IndexMemberships | null;
    analyst: {
        nextEarningsDate: string | null;
        earningsSession?: EarningsSession | null;
        earningsDateAlt?: unknown;
        earningsDateConfirmed?: boolean | null;
    };
}

/** A confirmed non-payer, exactly as `dividends.ts` prints it. */
function isConfirmedNonPayer(dividends: DividendsView): boolean {
    return (
        dividends.latestExDate === null &&
        dividends.latestAmount === null &&
        dividends.trailing12mAmount === 0 &&
        dividends.trailingYieldPct === 0
    );
}

/**
 * Texts for the result's top-level `notes` (`PUBLIC_API.md`, `runAgentTurn` action ⑩; the
 * wording is core's `FUNDAMENTALS_RESULT_NOTES`, attached verbatim). The tool description
 * no longer carries these null rules, so a note that is missing here is a rule the model
 * never sees. Each condition is the field's own printed state, read from the finished
 * result (after rounding), and the order is the order of the list in core's contract:
 *
 * - `earningsSessionUnknown`: a next date, no session, no second-source date
 *   (`earningsDateAlt` brings its own "sources disagree" rule) and a date not marked as an
 *   estimate (an estimate already says the timing is unannounced, `earningsDateNote`).
 * - `secFieldMissing`: a row's `sec` block exists and one of its three figures is null
 *   (`form`, `filed` and `accn` are never null); a row with no `sec` is not a finding.
 * - dividends: exactly one of non-payer / unknown (`null`, ETFs included) / latest payment
 *   without any trailing figure. A null yield beside a trailing AMOUNT (no price) gets no
 *   note: the amount is real and the model must not be told to hide it.
 * - Korean annual dividend: `dpsCommon` null → `krDpsUnknown` only; a non-null DPS with a
 *   null yield → `krYieldOnLastCloseNull`, so the two pieces of advice never disagree.
 * - `indexMembershipUnknown`: US results only (the field is always null for Korean stocks).
 * - `peUntrusted`: no `valuation` block or a null `pe`.
 *
 * Returns `[]` when nothing applies; the caller omits the key then (no empty array).
 */
function fundamentalsResultNotes(
    result: FundamentalsNotesInput,
    isKr: boolean
): string[] {
    const { analyst, dividends, valuation } = result;
    const annual = dividends?.annualReported;
    return [
        ...(analyst.nextEarningsDate !== null &&
        (analyst.earningsSession ?? null) === null &&
        (analyst.earningsDateAlt ?? null) === null &&
        analyst.earningsDateConfirmed !== false
            ? [FUNDAMENTALS_RESULT_NOTES.earningsSessionUnknown]
            : []),
        ...(result.recentQuarters?.some(
            row =>
                row.sec !== null &&
                (row.sec.epsDiluted === null ||
                    row.sec.revenue === null ||
                    row.sec.revenueYoYPct === null)
        )
            ? [FUNDAMENTALS_RESULT_NOTES.secFieldMissing]
            : []),
        ...(dividends !== null && isConfirmedNonPayer(dividends)
            ? [FUNDAMENTALS_RESULT_NOTES.dividendsNonPayer]
            : []),
        ...(dividends === null
            ? [FUNDAMENTALS_RESULT_NOTES.dividendsUnknown]
            : []),
        ...(dividends !== null &&
        dividends.latestExDate !== null &&
        dividends.trailing12mAmount === null &&
        dividends.trailingYieldPct === null
            ? [FUNDAMENTALS_RESULT_NOTES.dividendsTrailingUnknown]
            : []),
        ...(annual !== undefined &&
        annual.yieldOnLastClosePct === null &&
        annual.dpsCommon !== null
            ? [FUNDAMENTALS_RESULT_NOTES.krYieldOnLastCloseNull]
            : []),
        ...(annual !== undefined && annual.dpsCommon === null
            ? [FUNDAMENTALS_RESULT_NOTES.krDpsUnknown]
            : []),
        ...(!isKr && result.indexMemberships === null
            ? [FUNDAMENTALS_RESULT_NOTES.indexMembershipUnknown]
            : []),
        ...(valuation === null || valuation.pe === null
            ? [FUNDAMENTALS_RESULT_NOTES.peUntrusted]
            : []),
    ];
}

/**
 * Compact valuation/profitability/growth/health/analyst snapshot for stocks
 * (US and Korean — crypto has no fundamental tab, gated the same way
 * `getOptionsSummaryTool` gates options). One `Promise.allSettled` fan-out so
 * a single failing FMP/yahoo endpoint only drops its own section instead of
 * the whole tool result.
 *
 * `dividends` comes from its own adapters (FMP `/stable/dividends` for US/ETF,
 * yahoo dividend history for KR with `summaryDetail` as the fallback —
 * `FundamentalValuationMetrics` carries no such field) and is `null` when the
 * provider fails, never a guessed zero. For KR, `dividends.annualReported`
 * comes from DART `alotMatter` (사업보고서), cached per corp+FY; it is absent
 * for preferred shares or when no report exists. Index membership (S&P 500 /
 * Nasdaq-100 / Dow) comes from the Wikipedia constituent tables
 * (`indexMembership.ts`) because the FMP plan returns 402 for the constituent
 * endpoints (checked 2026-10-24). Peers and the long-form profile description are omitted
 * too: the model-facing shape is numbers for valuation/health questions,
 * not the page's full content.
 *
 * `nextEarningsDate` goes through `getNextEarningsSchedule` (the same
 * refresh as `getNextEarningsReport`, plus the provider's confirmation flag) — the same
 * DB-backed, 24h-staleness-gated loader the news/analysis paths already use
 * (`entities/earnings-report`) — rather than the provider's own
 * `getEarningsReport` (a separate Redis key, `fundamental:earnings-next:<SYM>`,
 * used by core's fundamental analysis; its date-dependent TTLs live in
 * `nextEarningsCachePolicy.ts`). Routing through it here means this tool shares the DB rows the
 * news tab shows instead of adding another FMP/yahoo call per turn.
 *
 * `profitability`/`growth` fields are RENAMED with an explicit `...Pct`
 * suffix (spec §3.4, audit B6): FMP returns these as decimals (`0.25` =
 * 25%), verified against the fundamental tab's own display code
 * (`ProfitabilityCard.tsx`/`GrowthChart.tsx`, both `value * 100`) before
 * converting. `debtRatioTTM`/`currentRatioTTM`/`pe`/`pb`/`ps`/`evToEbitda`
 * are plain multiples in that same display code (`toFixed(2)`, no `* 100`)
 * and are left unconverted/unrenamed.
 *
 * No `epsEstimateVsTtmPct`: the analyst estimate's period IS well-defined now
 * (FMP's row is `currentFiscalYearRow` — the fiscal year in progress; Yahoo's
 * is the CURRENT quarter, `'0q'`), but neither is the SAME period as
 * `keyMetrics.epsTTM` (trailing twelve months): the FMP row is an annual
 * consensus for a fiscal year that mostly falls outside the trailing twelve
 * months, and the Yahoo row is a single upcoming quarter. Diffing either
 * against a TTM figure would still produce a number for two different
 * windows, not a real "estimate vs TTM" delta. `analystEstimate` (the raw
 * estimate) is still surfaced for the model to read, labelled with the
 * period it actually covers — the name used to be `nextQuarterEstimate`,
 * which a real turn read back as "next quarter EPS 20.00" for NVDA's annual
 * consensus. US rows come from FMP's annual consensus for the fiscal year in
 * progress (`currentFiscalYearRow`); Korean rows from Yahoo's current
 * quarter (`'0q'`) — `period` is derived with the SAME predicate
 * (`isKrEquitySymbol`) `getFundamentalDataProvider` itself uses to route to
 * the Yahoo vs FMP provider, not a separate `currency === 'KRW'` check that
 * could in principle disagree with it.
 */
export const getFundamentalsTool: ToolExecutor = async (args, _ctx, rt) => {
    const symbol = String(args.symbol).toUpperCase();
    if (!(await isTabAllowedForSymbol(symbol, 'fundamental')))
        return { symbol, available: false, reason: 'tab_not_available' };

    const provider = getFundamentalDataProvider(symbol);
    const [marketProfile, asset] = await Promise.all([
        resolveMarketProfile(symbol),
        resolveAssetInfoOrNull(symbol, 'get_fundamentals'),
    ]);
    const session = sessionSpecFor(marketProfile);
    const marketData = getCachedMarketDataProvider(session);
    const { db } = getDatabaseClient();
    const earningsRefresh = getNextEarningsSchedule(symbol, db);
    const loadDailyBars = async () => {
        const { bars } = await getCachedBarsWithIndicators(
            marketData,
            symbol,
            '1Day',
            asset?.fmpSymbol,
            session
        );
        return bars;
    };
    // KRX 상장주식수 기준 시총(`krListedBasis`)과 DART 기준 PER·PBR(`getKrValuation`)은 한국 종목에만 필요하다.
    const isKr = isKrEquitySymbol(symbol);
    // Yahoo (analyst views) is an unofficial source with no redistribution terms: the public API
    // (`allowUnofficialSources: false`) neither calls Yahoo from this tool nor emits the NEW Yahoo-derived
    // analyst keys below, and for US symbols it reads FMP's own rating counts (`getFmpGradesConsensus`), not
    // the Yahoo-first provider method — its output for US symbols is what it was before the Yahoo sources
    // were added. Korean symbols keep the provider (already Yahoo). Only the five counts are emitted, never
    // the source marker.
    const useYahooExtras = rt.allowUnofficialSources !== false;
    const [
        profileR,
        keyMetricsR,
        ratiosR,
        growthR,
        scoresR,
        cashFlowR,
        gradesR,
        priceTargetR,
        estimatesR,
        earningsR,
        quoteR,
        quartersR,
        reactionsR,
        listedSharesR,
        lastCloseR,
        dividendSourceR,
        membershipsR,
        krAnnualDividendR,
        secQuartersR,
        analystViewsR,
    ] = await Promise.allSettled([
        provider.getProfile(symbol),
        provider.getKeyMetricsTtm(symbol),
        provider.getRatiosTtm(symbol),
        provider.getIncomeStatementGrowth(symbol),
        provider.getFinancialScores(symbol),
        provider.getCashFlowStatement(symbol),
        // Public API (`allowUnofficialSources: false`) keeps FMP's own counts for US symbols: the provider's
        // method is Yahoo-first, and Yahoo values must not leave through the public API. Korean symbols'
        // provider is already Yahoo and unchanged. The agent runtime uses the corrected provider.
        useYahooExtras || isKr
            ? provider.getGradesConsensus(symbol)
            : getFmpGradesConsensus(symbol),
        provider.getPriceTargetConsensus(symbol),
        provider.getAnalystEstimates(symbol),
        earningsRefresh,
        // Same symbol→fmpSymbol mapping `get_quote`/`get_bars_indicators`
        // use. Bounded by `quoteWithTimeout` like the other quotes that are
        // only enrichment (`get_my_portfolio`, `get_cached_analysis`);
        // `get_quote` calls getQuote directly because the quote IS its output.
        // Here the price is an extra (`price`, `targetUpsidePct`), so a slow
        // quote must not stall the whole tool.
        quoteWithTimeout(marketData, asset?.fmpSymbol ?? symbol),
        // The financials tab's own cached quarterly income rows (Redis
        // `financials:income:<SYM>:quarter`, one FMP call per symbol per day
        // shared with that tab) — no extra endpoint.
        // Wrapped so a synchronous throw (provider construction) is isolated by allSettled
        // like a rejection — these rows are enrichment, never a reason to fail the tool.
        Promise.resolve().then(() =>
            getFinancialStatementsProvider(symbol).getIncomeStatements(
                symbol,
                'quarter',
                QUARTERS_FETCH_COUNT
            )
        ),
        loadEarningsReactions(
            symbol,
            db,
            session,
            earningsRefresh,
            loadDailyBars
        ),
        // Enrichment only: a failed lookup falls back to the provider's market cap.
        isKr
            ? Promise.resolve().then(() => findKrListedShares(symbol, db))
            : Promise.resolve(null),
        isKr
            ? loadLastCompletedClose(loadDailyBars, session)
            : Promise.resolve(null),
        // Price-independent raw history, so it rides this fan-out (no serial
        // round trip on a cold cache); the yield is computed once `price` is known.
        fetchDividendSource(symbol, isKr),
        loadIndexMemberships(symbol).catch((error: unknown) => {
            logToolDegrade('get_fundamentals', 'index memberships', error);
            return null;
        }),
        // KR only: the official DART annual-report DPS (never throws; cached per corp+FY).
        isKr ? fetchKrAnnualDividend(symbol) : Promise.resolve(null),
        // As-filed quarterly EPS/revenue from the SEC XBRL API, US filers only
        // (a Korean stock has no CIK). Enrichment: a failure is logged below and
        // `recentQuarters` keeps the FMP figures.
        isKr
            ? Promise.resolve(null)
            : Promise.resolve().then(() => loadSecQuarters(symbol, db)),
        // US only: the Korean provider is already Yahoo, so its own grades are the Yahoo figures
        // and a second Yahoo call would repeat them. `lite`: no firm-level history (this tool never
        // shows it) and no FMP period averages. Never throws; a failure just drops the extras.
        isKr || !useYahooExtras
            ? Promise.resolve(null)
            : getAnalystViews(symbol, { detail: 'lite' }),
    ]);

    const profile = settledOrNull(profileR);
    if (!profile) return { symbol, available: false, reason: 'no_profile' };

    const currency = getDescriptor(marketProfile).priceFormat.currency;
    const earningsTimeZone =
        session.kind === 'scheduled' ? session.timeZone : 'UTC';
    const keyMetrics = settledOrNull(keyMetricsR);
    const ratios = settledOrNull(ratiosR);
    const growth = settledOrNull(growthR);
    const scores = settledOrNull(scoresR);
    const cashFlow = settledOrNull(cashFlowR);
    const grades = settledOrNull(gradesR);
    const priceTarget = settledOrNull(priceTargetR);
    const estimates = settledOrNull(estimatesR);
    const earnings = settledOrNull(earningsR);
    const quote = settledOrNull(quoteR);
    // 한국의 죽은 리스팅(잘못된 접미사 등): yahoo가 2년 묵은 가격과 빈 펀더멘털을 그대로 준다.
    // `asOf`가 조회 시각이라 그 가격이 "오늘"로 읽히므로, 섹션을 내지 않고 데이터 오류로 돌린다.
    const lastTradeDate = staleKrListingDate(
        marketProfile,
        quote?.timestamp === undefined
            ? undefined
            : quote.timestamp * MS_PER_SECOND,
        Date.now()
    );
    // `error` 코드로 낸다(형제 도구 `get_bars_indicators`·`get_quote`와 같은 형태) — 공개 API가 이 코드를
    // 404로 매핑한다(`executePublicTool` `TOOL_ERROR_MAPPING`). `reason`으로 내면 200으로 나간다.
    if (lastTradeDate !== null)
        return {
            symbol,
            available: false,
            error: 'stale_listing',
            lastTradeDate,
        };
    if (secQuartersR.status === 'rejected')
        logToolDegrade(
            'get_fundamentals',
            'sec xbrl quarters',
            secQuartersR.reason
        );
    const quarters = recentQuarterRows(
        settledOrNull(quartersR) ?? [],
        isKrEquitySymbol(symbol),
        settledOrNull(secQuartersR)
    );
    // A failed lookup is `null` (rejections are settled to `null` above);
    // `price > 0` also rejects bad upstream data (a zero or negative price),
    // so either reads as "unknown", never as a real price.
    const price =
        quote && Number.isFinite(quote.price) && quote.price > 0
            ? quote.price
            : null;

    // KR: yahoo's own share count skews market cap — recompute on KRX listed shares × last
    // completed close. See `krListedBasis`. (PER/PBR are not rescaled by it: they come from DART below.)
    if (listedSharesR.status === 'rejected')
        logToolDegrade(
            'get_fundamentals',
            'krx listed shares',
            listedSharesR.reason
        );
    const lastClose = settledOrNull(lastCloseR);
    const krBasis = isKr
        ? krListedBasis({
              providerMarketCap: profile.marketCap,
              providerEvToEbitda:
                  keyMetrics?.enterpriseValueOverEBITDATTM ?? null,
              listedShares: settledOrNull(listedSharesR),
              lastClose,
          })
        : null;
    // KR P/E and P/B: DART consolidated controlling-interest figures on the same basis the fundamental tab
    // and the analysis inputs use (`getKrValuation`); the provider's own values only when DART cannot be
    // used, and `basis` says which. Never throws.
    const krValuation =
        isKr && keyMetrics
            ? await getKrValuation(symbol, lastClose, {
                  pe: keyMetrics.peRatioTTM,
                  pb: keyMetrics.pbRatioTTM,
                  epsTtm: keyMetrics.epsTTM,
              })
            : null;
    const dividends = withAnnualReported(
        buildDividends(settledOrNull(dividendSourceR), {
            price,
            currency,
            timeZone: earningsTimeZone,
        }),
        settledOrNull(krAnnualDividendR),
        price
    );

    const views = settledOrNull(analystViewsR);
    // The provider already returns the CURRENT distribution (Yahoo for KR and, for US stocks, Yahoo with
    // an FMP fallback), tagged with `source`. FMP's own count is cumulative (AAPL 112 vs 45 analysts
    // actually covering it, 2026-11-15), so its sum is not an analyst count: only a Yahoo-sourced
    // distribution reports `consensusAnalysts`. The emitted `consensus` is the five counts only.
    const consensus = grades === null ? null : gradeCountsOnly(grades);
    const consensusSource = readGradesSource(grades);
    const gradeTotal = consensus
        ? consensus.strongBuy +
          consensus.buy +
          consensus.hold +
          consensus.sell +
          consensus.strongSell
        : null;
    const consensusAnalysts = consensusSource === 'yahoo' ? gradeTotal : null;
    // Yahoo's earnings hint (US only) reconciled with the DB/FMP row (`resolveNextEarnings`): a confirmed
    // Yahoo date beats FMP's projection, two unconfirmed dates that differ surface as `earningsDateAlt`.
    const resolvedEarnings = resolveNextEarnings({
        scheduledDate: earnings?.earningsDate ?? null,
        scheduledConfirmed: earnings?.dateConfirmed ?? null,
        hint: views?.earnings ?? null,
        today: zonedDate(new Date(), earningsTimeZone),
    });
    const nextEarningsDate = resolvedEarnings.date;

    // Provider ratios arrive as raw floats (P/E 27.622012578616346); trim them
    // to significant digits like every other number the agent quotes.
    const result = roundNumbersDeep({
        /*
         * `asOf`는 **조회 시각**이다 — 데이터가 그 시점 값이라는 뜻이 아니다.
         *
         * 이 경로는 전부 `getOrSetCache(key, FMP_FUNDAMENTAL_CACHE_TTL_SECONDS, …)`
         * 로 읽으므로 프로필·밸류에이션·성장·재무건전성·애널리스트 값이 최대
         * 24시간 묵었을 수 있는데, 예전에는 그걸 `asOf: now`로만 내보내 모델이
         * "지금 P/E"라고 단정할 근거를 줬다. 펀더멘털은 분기 단위로 바뀌므로
         * 24시간 지연 자체는 문제가 아니지만, **지연을 숨기는 것**은 문제다.
         *
         * 실제 생성 시각은 캐시 계층이 돌려주지 않으므로 지어내지 않는다. 대신
         * 나이의 **상한**을 명시해 모델이 "최대 하루 전 기준"으로 말할 수 있게 한다.
         * (`get_quote`처럼 프로바이더가 타임스탬프를 주는 경로는 실제 시각을
         * 싣는다 — 여기서 같은 걸 흉내 내면 그게 거짓이 된다.)
         *
         * 상한이 무엇을 덮고 무엇을 안 덮는지는 `cachedSectionsMaxAgeHours`의
         * 이름과 그 옆 주석이 말한다.
         */
        asOf: new Date().toISOString(),
        asOfIsFetchTime: true as const,
        // 이 상한이 덮는 것은 **캐시된 펀더멘털 섹션**뿐이다(profile·valuation·
        // growth·health·analyst). 같은 봉투의 `price`는 별개의 창을 쓴다 —
        // `computeBarsEffectiveTtl`이 장중에만 60초이고 장외에는
        // `min(BARS_OFFHOURS_TTL_CEILING_SECONDS=86_400, 다음 정규장까지)`라
        // 하루와 같은 자릿수가 된다(값 자체는 정확한 마지막 종가이므로 그게
        // 문제는 아니다). `nextEarningsDate`/`daysToEarnings`는 DB 행이라 갱신이
        // 실패하면 몇 주 묵을 수 있다 — 하나의 숫자로 전부를 덮는다고 말하면
        // 그게 이 PR이 고치는 `asOf: now`와 같은 과장이 된다.
        // 이 도구는 프로바이더를 직접 부르므로 거치는 캐시는 Redis(`getOrSetCache`)
        // 한 계층뿐이다 — miss면 안쪽 `fmpGet`이 FMP를 새로 읽는다(no-store). 예전엔
        // 그 아래 Next 데이터 캐시가 같은 24h로 겹쳐 상한이 두 창의 합이었다.
        cachedSectionsMaxAgeHours:
            FMP_FUNDAMENTAL_CACHE_TTL_SECONDS / SECONDS_PER_HOUR,
        source: 'fundamental data provider (cached)',
        symbol,
        available: true,
        price,
        profile: {
            name: profile.companyName,
            sector: profile.sector,
            industry: profile.industry,
            marketCap: krBasis?.marketCap ?? profile.marketCap,
            currency,
            // KR only. `krx_listed`: marketCap = KRX listed shares ×
            // `marketCapCloseDate`'s close (valuation.pe/pb do NOT use it: see `valuation.basis`).
            // `provider`: yahoo's own market cap (listed shares or close missing).
            ...(krBasis && {
                sharesBasis: krBasis.sharesBasis,
                sharesOutstanding: krBasis.sharesOutstanding,
                marketCapCloseDate: krBasis.marketCapCloseDate,
            }),
        },
        valuation: keyMetrics && {
            pe: krValuation ? krValuation.pe : keyMetrics.peRatioTTM,
            pb: krValuation ? krValuation.pb : keyMetrics.pbRatioTTM,
            // KR: the provider's own P/S (its market cap is not the KRX one, but P/S is not rescaled any more).
            ps: keyMetrics.priceToSalesRatioTTM,
            // KR on the `krx_listed` basis evToEbitda is null (EV includes net debt we cannot
            // recompute) — see `krListedBasis`.
            evToEbitda: krBasis
                ? krBasis.evToEbitda
                : keyMetrics.enterpriseValueOverEBITDATTM,
            // KR only. `basis` says what `pe`/`pb` are computed on (`source` dart or provider, `ttmEnd`,
            // `equityAsOf`, `priceDate`); `epsTtm` and `bps` are the per-share figures behind them and
            // `nullReason` says why a null ratio is null. `profile.sharesBasis` is the share count behind
            // market cap only.
            ...(krValuation && {
                epsTtm: krValuation.epsTtm,
                bps: krValuation.bps,
                basis: krValuation.basis,
                ...(Object.keys(krValuation.nullReason).length > 0 && {
                    nullReason: krValuation.nullReason,
                }),
            }),
        },
        profitability: ratios && {
            roePct:
                ratios.returnOnEquityTTM === null
                    ? null
                    : roundNumber(ratios.returnOnEquityTTM * 100),
            roaPct:
                ratios.returnOnAssetsTTM === null
                    ? null
                    : roundNumber(ratios.returnOnAssetsTTM * 100),
            operatingMarginPct:
                ratios.operatingProfitMarginTTM === null
                    ? null
                    : roundNumber(ratios.operatingProfitMarginTTM * 100),
            netMarginPct:
                ratios.netProfitMarginTTM === null
                    ? null
                    : roundNumber(ratios.netProfitMarginTTM * 100),
        },
        growth: growth && {
            revenueGrowthPct:
                growth.growthRevenue === null
                    ? null
                    : roundNumber(growth.growthRevenue * 100),
            epsGrowthPct:
                growth.growthEPS === null
                    ? null
                    : roundNumber(growth.growthEPS * 100),
        },
        // `null` = unknown (provider failure / no data); a confirmed non-payer is an
        // object with `trailing12mAmount: 0`.
        dividends,
        // Newest first; `null` when the quarterly rows are unavailable.
        recentQuarters: quarters.length > 0 ? quarters : null,
        // Newest first; `null` when no reaction could be measured.
        earningsReactions: settledOrNull(reactionsR),
        // S&P 500 / Nasdaq-100 / Dow membership; `null` for KR or when the lists are unavailable.
        indexMemberships: settledOrNull(membershipsR),
        health: {
            altmanZScore: scores?.altmanZScore ?? null,
            piotroskiScore: scores?.piotroskiScore ?? null,
            debtRatio: ratios?.debtRatioTTM ?? null,
            currentRatio: ratios?.currentRatioTTM ?? null,
            operatingCashFlow: cashFlow?.operatingCashFlow ?? null,
        },
        analyst: {
            consensus,
            ...(useYahooExtras && {
                consensusAnalysts,
                consensusSource,
            }),
            analystBuySharePct: consensus
                ? ratioPct(consensus.strongBuy + consensus.buy, gradeTotal)
                : null,
            priceTarget,
            // Which aggregator `priceTarget` is: the Korean provider is Yahoo, everything else FMP.
            ...(useYahooExtras && {
                priceTargetSource: priceTargetSourceOf(priceTarget, isKr),
                // Yahoo's mean target and how many analysts stand behind it, beside FMP's `priceTarget`.
                // `targetUpsidePct` stays FMP-based.
                priceTargetYahoo:
                    !isKr && views?.targets.yahoo
                        ? {
                              mean: views.targets.yahoo.mean,
                              analysts: views.targets.yahoo.analysts,
                          }
                        : null,
                targetSourcesDisagree:
                    !isKr && (views?.targets.sourcesDisagree ?? false),
            }),
            targetUpsidePct: pctVs(priceTarget?.targetConsensus ?? null, price),
            analystEstimate: estimates && {
                ...estimates,
                // Same predicate `getFundamentalDataProvider` itself routes
                // on — Korean-listed symbols use the Yahoo provider (current
                // quarter, '0q'); everything else FMP's annual consensus for
                // the fiscal year in progress.
                period: isKrEquitySymbol(symbol)
                    ? ('current_quarter' as const)
                    : ('current_fiscal_year' as const),
            },
            nextEarningsDate,
            ...earningsDateCertainty(
                earnings === null ? null : resolvedEarnings
            ),
            ...(resolvedEarnings.alt !== null && {
                earningsDateAlt: resolvedEarnings.alt,
            }),
            daysToEarnings: daysUntil(
                nextEarningsDate,
                new Date(),
                earningsTimeZone
            ),
        },
    });
    const notes = fundamentalsResultNotes(result, isKr);
    return {
        ...withEarningsReactionTally(result),
        ...(notes.length > 0 && { notes }),
    };
};

function priceTargetSourceOf(
    priceTarget: unknown,
    isKr: boolean
): 'yahoo' | 'fmp' | null {
    if (priceTarget === null) return null;
    return isKr ? 'yahoo' : 'fmp';
}
