import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIGLENS_AGENT_TOOL_SET } from '@/features/agent-tools/spec/agentToolSet';

/**
 * 도구 설명과 실행기 결과가 서로 맞는지 보는 계약 테스트. 설명(모델이 읽는 약속)과 실행기(실제로 돌려주는 키)가
 * 같은 레포에 있게 되면서, 예전에 두 레포 리뷰가 하던 "설명이 실행기와 맞나"를 이 테스트가 대신한다.
 *
 * 결과는 실행기 고정 스냅샷(`server/__tests__/golden/*.json`, 에이전트·공개 API 두 구성)에서 읽는다.
 *
 * 1. 스냅샷 결과의 최상위 키는 모두 그 도구 설명에 키 이름 그대로 나오거나, 아래 두 목록 중 하나에 있다.
 *    목록은 "지금 설명에 키 이름이 없는 것"을 정확히 적은 것이라, 새 키를 설명 없이 내보내도, 설명을 고쳐
 *    목록 항목이 쓸모없어져도 실패한다(그때는 목록에서 지운다).
 * 2. 설명이 "있을 때(when present)" 준다고 약속한 최상위 필드는 그 도구의 스냅샷 중 적어도 하나에 실제로 있다.
 */

const GOLDEN_DIR = resolve(__dirname, '../../server/__tests__/golden');

/**
 * 모든 도구가 같은 모양으로 붙이는 봉투 키. 도구 설명이 아니라 프레임 규칙(출처·시점 인용, 오류 처리)과 오류
 * 목록이 다룬다: 출처·시점, 대상 종목 되풀이와 기호 교정, 거절·오류 본문, 가용 표시, `truncateToolResult`가
 * 붙이는 잘림 표시.
 */
const ENVELOPE_KEYS: ReadonlySet<string> = new Set([
    'asOf',
    'source',
    'symbol',
    'resolvedName',
    'symbolCorrectedFrom',
    'symbolCorrections',
    'error',
    'issues',
    'reason',
    'code',
    'max',
    'scope',
    'lastTradeDate',
    'found',
    'available',
    'hint',
    'status',
    'truncated',
    'preview',
]);

/**
 * 도구별로, 결과에 있지만 설명에 키 이름으로는 나오지 않는 최상위 키(2026-11-28 실측). 대부분 설명이 낱말로
 * 다루거나(예: `squeezeRisk` → "squeeze risk") 모델이 따로 안내받을 필요가 없는 메타 필드다. 새 키는 여기에
 * 올리기 전에 설명에 적을지부터 정한다.
 */
const KNOWN_UNDESCRIBED: Readonly<Record<string, readonly string[]>> = {
    get_bars_indicators: [
        'barsReturned',
        'barsTrimmed',
        'candlePatterns',
        'currency',
    ],
    get_cached_analysis: [
        'contentLanguage',
        'digest',
        'generatedAt',
        'model',
        'overallStatus',
        'personalized',
        'plain',
        'publicAnalysisAt',
        'reasoning',
        'requestedTab',
        'sinceEarlier',
        'timeframe',
    ],
    get_congress_trades: ['stats'],
    get_economy: ['note'],
    get_fundamentals: ['asOfIsFetchTime', 'cachedSectionsMaxAgeHours'],
    get_guide: ['others'],
    get_investor_flows: [
        'dataStatus',
        'failsToDeliver',
        'freshness',
        'largeHolders',
        'majorHolders',
        'noData',
        'notProvided',
        'shareClassNote',
        'squeezeRisk',
        'temporarilyUnavailable',
        'thresholdList',
        'tradingPlans',
        'trendNote',
    ],
    get_market_overview: ['indices'],
    get_my_portfolio: ['count', 'stalePriceCount', 'totals', 'weightScope'],
    get_my_watchlist: ['count', 'items', 'stalePriceCount'],
    get_news: ['count', 'coverageLimited'],
    get_options_summary: ['currency', 'otherExpirations', 'underlyingPrice'],
    get_quote: ['quotes'],
    propose_price_alert: [
        'analysisAt',
        'condition',
        'currentPrice',
        'firesWhen',
        'high',
        'lastCheckedSession',
        'lastClose',
        'low',
        'notes',
        'quoteAt',
        'requiresUserConfirmation',
    ],
    run_fresh_analysis: [
        'contentLanguage',
        'fallback',
        'fallbackReason',
        'generatedAt',
        'model',
        'note',
        'plain',
        'sinceEarlier',
        'tab',
        'timeframe',
    ],
    search_ticker: ['results'],
};

/** 설명이 "있을 때(when present)" 준다고 약속한 최상위 필드. */
const WHEN_PRESENT_PROMISES: Readonly<Record<string, readonly string[]>> = {
    get_bars_indicators: ['notes', 'fearGreed'],
    get_fundamentals: ['notes', 'dividends'],
    get_investor_flows: ['krInvestorTrend', 'holderLookup'],
};

interface GoldenCase {
    tool: string;
    results: readonly unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readGolden(file: string): GoldenCase {
    const parsed: unknown = JSON.parse(
        readFileSync(resolve(GOLDEN_DIR, file), 'utf8')
    );
    if (!isRecord(parsed) || typeof parsed.tool !== 'string')
        throw new Error(`golden ${file}: no tool name`);
    const results = ['agent', 'publicApi'].flatMap(config => {
        const run = parsed[config];
        return isRecord(run) && 'result' in run ? [run.result] : [];
    });
    return { tool: parsed.tool, results };
}

const GOLDENS: readonly GoldenCase[] = readdirSync(GOLDEN_DIR)
    .filter(file => file.endsWith('.json'))
    .map(readGolden);

/** 도구 → 스냅샷 결과들의 최상위 키 합집합. */
const TOP_LEVEL_KEYS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
    [...new Set(GOLDENS.map(golden => golden.tool))].map(tool => [
        tool,
        new Set(
            GOLDENS.filter(golden => golden.tool === tool).flatMap(golden =>
                golden.results.flatMap(result =>
                    isRecord(result) ? Object.keys(result) : []
                )
            )
        ),
    ])
);

function descriptionOf(tool: string): string {
    const definition = SIGLENS_AGENT_TOOL_SET.tools.find(t => t.name === tool);
    if (definition === undefined)
        throw new Error(`golden tool ${tool} is not in SIGLENS_AGENT_TOOL_SET`);
    return definition.description;
}

const mentions = (description: string, key: string) =>
    new RegExp(`\\b${key}\\b`).test(description);

describe('도구 설명 ↔ 실행기 결과 계약', () => {
    it('스냅샷이 있는 도구는 모두 도구 모음에 있고, 키를 읽을 결과가 있다', () => {
        expect(GOLDENS.length).toBeGreaterThan(0);
        for (const [tool, keys] of TOP_LEVEL_KEYS) {
            expect(() => descriptionOf(tool)).not.toThrow();
            expect(keys.size).toBeGreaterThan(0);
        }
    });

    it.each([...TOP_LEVEL_KEYS.keys()].toSorted())(
        '%s: 결과의 최상위 키는 설명에 나오거나 알려진 예외 목록에 있다(목록에 쓸모없는 항목도 없다)',
        tool => {
            const description = descriptionOf(tool);
            const undescribed = [...(TOP_LEVEL_KEYS.get(tool) ?? [])]
                .filter(key => !ENVELOPE_KEYS.has(key))
                .filter(key => !mentions(description, key))
                .toSorted();
            expect(undescribed).toEqual(
                [...(KNOWN_UNDESCRIBED[tool] ?? [])].toSorted()
            );
        }
    );

    it('예외 목록의 도구는 모두 스냅샷이 있는 도구다', () => {
        expect(
            Object.keys(KNOWN_UNDESCRIBED).filter(
                tool => !TOP_LEVEL_KEYS.has(tool)
            )
        ).toEqual([]);
    });

    it.each(Object.entries(WHEN_PRESENT_PROMISES))(
        '%s: 설명이 "when present"로 약속한 필드는 설명에 나오고 스냅샷 결과에도 실제로 있다',
        (tool, fields) => {
            const description = descriptionOf(tool);
            const keys = TOP_LEVEL_KEYS.get(tool) ?? new Set<string>();
            for (const field of fields) {
                expect(mentions(description, field)).toBe(true);
                expect(keys.has(field)).toBe(true);
            }
        }
    );
});
