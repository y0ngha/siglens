import 'server-only';
import {
    runAnalysis,
    type AnalysisResponse,
    type OptionsAnalysisResponse,
    type OverallAnalysisResponse,
    type SubmitAnalysisOptions,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { runOverallAnalysisAction } from '@/entities/analysis/actions';
import { submitNewsAnalysisAction } from '@/entities/news-article/actions';
import { submitOptionsAnalysisAction } from '@/entities/options-chain/actions';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile';
import { registerActiveStream } from '@/shared/lib/sse/activeStreams';
import { AGENT_BUSY_LOG } from '../busyLog';
import type { ToolExecutor } from './index';
import { CACHED_ANALYSIS_MAX_CHARS, fitToEscapedBudget } from './truncate';

/**
 * Per-instance concurrency cap — distinct from core's per-turn cap. Each run
 * holds an SSE slot for 30–250s; beyond this the call answers `busy` rather
 * than queueing. Raised 2 → 10 (2026-09-13) now that one turn may run up to
 * 3 analyses and several users can do so at once.
 */
const MAX_CONCURRENT_FRESH = 10;
let inFlight = 0;
export function __resetFreshSemaphoreForTests(): void {
    inFlight = 0;
}

const DEFAULT_TIMEFRAME: Timeframe = '1Day';
const KINDS = new Set(['technical', 'overall', 'news', 'options']);

type Outcome = {
    status: string;
    result?: unknown;
    /** Machine-readable code sitting at the top level in several core error
     * variants (e.g. `{status:'no_chains_error', code:'no_options_chains', error: string}`,
     * `{status:'key_error', code:'user_api_key_required', error: string}`) —
     * distinct from `error.code`, which only exists when `error` is itself
     * an object (e.g. `{status:'error', error: AnalysisLimitError}`). */
    code?: string;
    error?: unknown;
};

/** Extracts `error.code` when `error` is a structured object; `undefined` otherwise (e.g. `error` is a plain string). */
function errorObjectCode(outcome: Outcome): string | undefined {
    const err = outcome.error;
    if (typeof err !== 'object' || err === null) return undefined;
    const code = (err as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
}

/**
 * Reserves room for envelope JSON punctuation/escaping when splitting the
 * remaining truncation budget across prose leaves. Mirrors
 * `BODY_BUDGET_SAFETY_MARGIN` in getNews.ts.
 */
const PROSE_BUDGET_SAFETY_MARGIN = 200;

type ProseSpec =
    | { kind: 'text'; value: string | null | undefined }
    // `unknown` (not `string`) — a `list` leaf may be an array of plain
    // strings (overall's bullets) or of objects (options' `perExpiration`
    // commentary entries); either way each item is dropped or kept whole.
    | { kind: 'list'; value: readonly unknown[] | undefined };

/**
 * Fits variable-length prose/bullet leaves of an already-built `envelope`
 * into whatever is left of `CACHED_ANALYSIS_MAX_CHARS` — the same ceiling a
 * stored analysis gets from the executor (`tools/index.ts`). Only invoked when the
 * full envelope (with the untouched leaves) overflows the budget — a
 * realistic technical/overall analysis usually fits as-is once
 * `indicatorResults`/`patternSummaries`/etc. have been dropped by the
 * caller's projection, so this only shaves what's actually over.
 *
 * Splits the overflow evenly across `fields`. `text` fields are cut with
 * `fitToEscapedBudget` (mirrors getNews.ts's body-fitting). `list` fields
 * keep bullets in original order and DROP trailing ones that don't fit
 * whole rather than truncating a bullet mid-sentence — the same "keep the
 * top, drop the tail" rule webSearch uses for its top-N results.
 */
function fitProse(
    envelope: unknown,
    fields: Record<string, ProseSpec>
): Record<string, string | unknown[]> {
    const keys = Object.keys(fields);
    const out: Record<string, string | unknown[]> = {};
    const asIs = (spec: ProseSpec): string | unknown[] =>
        spec.kind === 'text' ? (spec.value ?? '') : [...(spec.value ?? [])];
    const overflow =
        JSON.stringify(envelope).length - CACHED_ANALYSIS_MAX_CHARS;
    if (overflow <= 0 || keys.length === 0) {
        for (const key of keys) out[key] = asIs(fields[key]!);
        return out;
    }
    let currentLeavesSize = 0;
    for (const key of keys)
        currentLeavesSize += JSON.stringify(asIs(fields[key]!)).length;
    const targetLeavesSize = Math.max(
        0,
        currentLeavesSize - overflow - PROSE_BUDGET_SAFETY_MARGIN
    );
    const share = Math.floor(targetLeavesSize / keys.length);
    for (const key of keys) {
        const field = fields[key]!;
        if (field.kind === 'text') {
            out[key] = fitToEscapedBudget(field.value ?? '', share);
            continue;
        }
        const kept: unknown[] = [];
        let used = 2; // '[' + ']'
        for (const item of field.value ?? []) {
            const cost = JSON.stringify(item).length + 1; // + separating comma
            if (used + cost > share) break;
            kept.push(item);
            used += cost;
        }
        out[key] = kept;
    }
    return out;
}

/**
 * Projects a technical `AnalysisResponse` to the same fields
 * `get_cached_analysis` returns, so the model sees one consistent shape
 * regardless of which tool produced it. Drops `indicatorResults`,
 * `patternSummaries`, `strategyResults`, `candlePatterns`, `trendlines` —
 * the bulk of the payload and never needed by the model, which only reads
 * the summarized verdict.
 */
function projectTechnical(a: AnalysisResponse) {
    return {
        summary: a.summary,
        trend: a.trend,
        riskLevel: a.riskLevel,
        keyLevels: a.keyLevels,
        priceTargets: a.priceTargets,
        actionRecommendation: a.actionRecommendation ?? null,
    };
}

/** Projects an `OverallAnalysisResponse` to the same fields `get_cached_analysis` returns. */
function projectOverall(a: OverallAnalysisResponse) {
    return {
        headline: a.headlineKo,
        technical: a.technicalBulletsKo,
        fundamental: a.fundamentalBulletsKo,
        news: a.newsBulletsKo,
        options: a.optionsBulletsKo,
        conclusion: a.integratedConclusionKo,
        scenarios: a.scenarios,
        risks: a.riskFactorsKo,
    };
}

/** The model reads a handful of top signals — no reason to ship dozens of near-duplicate one-liners. */
const MAX_OPTIONS_SIGNALS = 10;

/**
 * Projects an `OptionsAnalysisResponse`. Unlike news, options has no cap on
 * `perExpiration` anywhere in core's normalizer — requesting `'all'`
 * expirations on a weekly-heavy ticker (PLTR, NVDA) can carry 15-20+ entries
 * of Korean commentary, which alone overflows `CACHED_ANALYSIS_MAX_CHARS`
 * before `signals` is even counted. `perExpiration` goes through
 * `fitProse`'s list path (drops trailing expirations whole, earliest
 * survive); `signals` gets a flat cap since it's already short one-liners.
 */
function projectOptions(a: OptionsAnalysisResponse) {
    return {
        summary: a.summary,
        signals: [...a.signals].slice(0, MAX_OPTIONS_SIGNALS),
        perExpiration: [...a.perExpiration],
    };
}

function buildFreshResult(
    kind: string,
    timeframe: Timeframe | undefined,
    analysis: Record<string, unknown>,
    prose: Record<string, ProseSpec>
): unknown {
    const envelope = {
        found: true,
        source: 'fresh',
        tab: kind,
        ...(timeframe ? { timeframe } : {}),
        generatedAt: new Date().toISOString(),
        stale: false,
        analysis,
    };
    if (Object.keys(prose).length === 0) return envelope;
    const fitted = fitProse(envelope, prose);
    return { ...envelope, analysis: { ...analysis, ...fitted } };
}

function unwrap(
    kind: string,
    timeframe: Timeframe | undefined,
    outcome: Outcome
): unknown {
    if (
        (outcome.status === 'done' || outcome.status === 'cached') &&
        outcome.result !== undefined
    ) {
        if (kind === 'technical') {
            const projected = projectTechnical(
                outcome.result as AnalysisResponse
            );
            // Only `summary` is a free-form prose leaf here — `keyLevels`,
            // `priceTargets` and `actionRecommendation` are bounded
            // structured objects (numbers + a handful of short fields), the
            // same shape `get_cached_analysis` returns untouched.
            return buildFreshResult(kind, timeframe, projected, {
                summary: { kind: 'text', value: projected.summary },
            });
        }
        if (kind === 'overall') {
            const projected = projectOverall(
                outcome.result as OverallAnalysisResponse
            );
            return buildFreshResult(kind, timeframe, projected, {
                headline: { kind: 'text', value: projected.headline },
                conclusion: { kind: 'text', value: projected.conclusion },
                technical: { kind: 'list', value: projected.technical },
                fundamental: { kind: 'list', value: projected.fundamental },
                news: { kind: 'list', value: projected.news },
                options: { kind: 'list', value: projected.options },
                risks: { kind: 'list', value: projected.risks },
            });
        }
        if (kind === 'options') {
            const projected = projectOptions(
                outcome.result as OptionsAnalysisResponse
            );
            return buildFreshResult(kind, timeframe, projected, {
                summary: { kind: 'text', value: projected.summary },
                perExpiration: {
                    kind: 'list',
                    value: projected.perExpiration,
                },
            });
        }
        // `news` is already small and bounded (a handful of short bullet
        // arrays) — no projection/budget needed.
        return buildFreshResult(
            kind,
            timeframe,
            outcome.result as Record<string, unknown>,
            {}
        );
    }
    return {
        error: 'analysis_failed',
        code: errorObjectCode(outcome) ?? outcome.code ?? outcome.status,
    };
}

/**
 * Runs a NEW analysis through the same entry points as the analysis stream
 * route. Deliberately does NOT forward `ctx.signal`: core `dedupeInFlight`
 * shares one in-flight analysis promise across every caller keyed on the
 * same cache key (prewarm, symbol-page viewers, other agent turns) — if this
 * tool forwarded the turn's own abort signal, cancelling one agent turn
 * would kill that shared analysis for everyone else awaiting it. A per-
 * instance semaphore bounds concurrency instead, and the slot is registered
 * with `registerActiveStream()` so a deploy drain waits for it like any
 * other in-flight analysis stream.
 */
export const runFreshAnalysisTool: ToolExecutor = async (
    args,
    ctx,
    runtime
) => {
    const symbol =
        typeof args.symbol === 'string' ? args.symbol.toUpperCase() : '';
    const kind = typeof args.kind === 'string' ? args.kind : '';
    // Validated before the slot is acquired: an invalid symbol/kind must
    // never consume a semaphore unit or an activeStreams slot.
    if (!isAdmissibleSymbolShape(symbol))
        return {
            error: 'invalid_args',
            issues: [{ path: 'symbol', message: 'invalid symbol' }],
        };
    if (!KINDS.has(kind))
        return {
            error: 'invalid_args',
            issues: [{ path: 'kind', message: 'unknown kind' }],
        };

    if (inFlight >= MAX_CONCURRENT_FRESH) {
        // Alarm marker (infra/aws/07-alarms.sh `siglens-agent-busy`): a busy
        // refusal means this instance is at capacity — the operator wants to
        // hear about it, not find it in a user's complaint.
        console.warn(AGENT_BUSY_LOG, {
            reason: 'fresh_analysis_slots',
            inFlight,
            cap: MAX_CONCURRENT_FRESH,
        });
        return { error: 'busy', retryAfterSeconds: 60 };
    }
    inFlight += 1;
    const release = registerActiveStream();
    try {
        const timeframe =
            (args.timeframe as Timeframe | undefined) ?? DEFAULT_TIMEFRAME;
        const [profile, asset] = await Promise.all([
            resolveMarketProfile(symbol),
            getAssetInfo(symbol),
        ]);
        const companyName = asset?.name ?? symbol;
        const descriptor = getDescriptor(profile);
        switch (kind) {
            case 'technical': {
                const options: SubmitAnalysisOptions = {
                    modelId: runtime.analysisModel,
                    marketDataProvider: getCachedMarketDataProvider(
                        sessionSpecFor(profile)
                    ),
                    assetClass: descriptor.assetClass,
                    currency: descriptor.priceFormat.currency,
                    tierContext: { userId: ctx.userId, tier: ctx.tier },
                    reasoning: false,
                    locale: ctx.locale,
                    skipEnqueueIfMiss: false,
                };
                return unwrap(
                    kind,
                    timeframe,
                    (await runAnalysis(
                        symbol,
                        companyName,
                        timeframe,
                        false,
                        asset?.fmpSymbol,
                        options
                    )) as Outcome
                );
            }
            case 'overall':
                return unwrap(
                    kind,
                    timeframe,
                    (await runOverallAnalysisAction(
                        symbol,
                        companyName,
                        timeframe,
                        runtime.analysisModel,
                        ctx.locale,
                        { reasoning: false }
                    )) as Outcome
                );
            case 'news':
                return unwrap(
                    kind,
                    undefined,
                    (await submitNewsAnalysisAction(
                        symbol,
                        companyName,
                        runtime.analysisModel,
                        ctx.locale,
                        false
                    )) as Outcome
                );
            case 'options':
                return unwrap(
                    kind,
                    undefined,
                    (await submitOptionsAnalysisAction(
                        symbol,
                        companyName,
                        'all',
                        runtime.analysisModel,
                        ctx.locale,
                        false
                    )) as Outcome
                );
            default:
                // Unreachable — `KINDS.has(kind)` already narrowed above.
                return {
                    error: 'invalid_args',
                    issues: [{ path: 'kind', message: 'unknown kind' }],
                };
        }
    } finally {
        inFlight -= 1;
        release();
    }
};
