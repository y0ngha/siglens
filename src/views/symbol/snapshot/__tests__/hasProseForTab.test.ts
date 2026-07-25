import { describe, it, expect } from 'vitest';
import type {
    FilteredAnalysisResponse,
    OverallAnalysisResponse,
    CongressTrendResponse,
    FundamentalAnalysisResponse,
    FinancialsAnalysisResponse,
    NewsAnalysisResponse,
    OptionsAnalysisResponse,
} from '@y0ngha/siglens-core';
import {
    SEO_SNAPSHOT_TABS,
    type SeoSnapshotTab,
} from '@/entities/seo-snapshot';
import { hasProseForTab } from '../hasProseForTab';

// PROSE_PREDICATE_BY_TAB is a 7-tab dispatch map with no dedicated tests
// before this file (MISTAKES.md §Tests 22) — the renderer suites only
// exercise `technical`/`congress` indirectly. A copy-paste mapping error
// (e.g. `options: hasFinancialsProse`) would ship undetected because the
// wrong predicate often still returns a plausible boolean for unrelated
// content. Every fixture below is typed against the SAME core response type
// the corresponding renderer test uses, so a core field rename breaks this
// file at compile time too (mirrors the pattern already established in
// TechnicalSnapshotProse.test.tsx et al.).

const TECHNICAL_FIXTURE: FilteredAnalysisResponse = {
    summary: 'AAPL은 단기 이동평균선이 장기 이동평균선을 상향 돌파했습니다.',
    trend: 'bullish',
    indicatorResults: null,
    riskLevel: null,
    keyLevels: null,
    priceTargets: null,
    patternSummaries: null,
    strategyResults: null,
    candlePatterns: null,
    trendlines: null,
    actionRecommendation: null,
};

const OVERALL_FIXTURE: OverallAnalysisResponse = {
    headlineKo: 'AAPL은 견조한 실적과 함께 단기 상승 추세를 이어가고 있습니다.',
    technicalBulletsKo: [],
    fundamentalBulletsKo: [],
    newsBulletsKo: [],
    optionsBulletsKo: [],
    financialsBulletsKo: [],
    integratedConclusionKo: '기술적 분석과 뉴스 분석이 엇갈리는 구간입니다.',
    scenarios: [
        {
            name: 'bullish',
            triggerConditionKo: '200일선을 상향 돌파하는 경우',
            priceRangeKo: '210 ~ 230 달러',
        },
    ],
    // Kept empty — `riskFactorsKo` is also a top-level array field on
    // FundamentalAnalysisResponse/FinancialsAnalysisResponse (see the
    // collision note below `FUNDAMENTAL_DISCRIMINATING_FIXTURE`). A
    // non-empty value here would make this fixture ambiguous as a foil.
    riskFactorsKo: [],
};

const CONGRESS_FIXTURE: CongressTrendResponse = {
    summaryKo:
        '최근 3개월간 AAPL에 대한 의회 거래는 순매수 우위 흐름을 보이고 있습니다.',
    notableMembersKo: ['낸시 펠로시 의원이 최근 대규모 매수를 신고했습니다.'],
    riskNoteKo: '공시 지연으로 최신 거래는 반영되지 않았을 수 있습니다.',
    overallSentiment: 'bullish',
};

const FUNDAMENTAL_FIXTURE: FundamentalAnalysisResponse = {
    overallConclusionKo:
        'AAPL은 높은 밸류에이션에도 불구하고 견조한 수익성을 바탕으로 프리미엄이 정당화됩니다.',
    categoryAssessments: [
        {
            category: 'valuation',
            sentiment: 'neutral',
            rationaleKo: 'PER이 업종 평균 대비 높은 수준입니다.',
        },
    ],
    riskFactorsKo: ['규제 리스크가 부각되고 있습니다.'],
    overallSentiment: 'bullish',
};

const FINANCIALS_FIXTURE: FinancialsAnalysisResponse = {
    overallConclusionKo:
        'AAPL은 견조한 매출 성장과 안정적인 현금창출력을 바탕으로 재무 건전성이 우수합니다.',
    axisAssessments: [
        {
            axis: 'growth',
            sentiment: 'bullish',
            rationaleKo: '최근 4개 분기 매출 성장률이 업종 평균을 상회합니다.',
        },
    ],
    riskFactorsKo: ['부채비율이 다소 상승했습니다.'],
    overallSentiment: 'bullish',
};

// fundamental/financials share field names (`overallConclusionKo`,
// `riskFactorsKo` are declared with identical names+shapes on both
// FundamentalAnalysisResponse and FinancialsAnalysisResponse — see
// domain/types.d.ts). A full fixture from one tab fed to the other's
// predicate would still narrow to non-null via those shared fields even
// under a swapped mapping, which defeats the cross-tab check. These two
// "discriminating" fixtures null out the shared fields so only the
// tab-unique array (`categoryAssessments` keyed by `category` vs
// `axisAssessments` keyed by `axis`) can make the predicate true — a
// genuinely tab-specific signal.
const FUNDAMENTAL_DISCRIMINATING_FIXTURE: FundamentalAnalysisResponse = {
    overallConclusionKo: '',
    categoryAssessments: [
        {
            category: 'growth',
            sentiment: 'bullish',
            rationaleKo: '매출 성장률이 시장 기대치를 상회합니다.',
        },
    ],
    riskFactorsKo: [],
    overallSentiment: 'neutral',
};

const FINANCIALS_DISCRIMINATING_FIXTURE: FinancialsAnalysisResponse = {
    overallConclusionKo: '',
    axisAssessments: [
        {
            axis: 'solvency',
            sentiment: 'neutral',
            rationaleKo: '유동비율이 안정적인 수준을 유지하고 있습니다.',
        },
    ],
    riskFactorsKo: [],
    overallSentiment: 'neutral',
};

const NEWS_FIXTURE: NewsAnalysisResponse = {
    currentDriverKo:
        'AAPL 주가는 최근 발표된 신제품 판매 호조 소식에 힘입어 상승세를 이어가고 있습니다.',
    keyEventsKo: ['신제품 출시 발표로 투자 심리가 개선되었습니다.'],
    upcomingEventsKo: ['다음 분기 실적 발표가 2주 후 예정되어 있습니다.'],
    overallSentiment: 'bullish',
};

const OPTIONS_FIXTURE: OptionsAnalysisResponse = {
    summary:
        'AAPL 옵션 시장은 콜 매수세가 우세하며 강세 포지셔닝이 뚜렷합니다.',
    perExpiration: [
        {
            expirationDate: '2026-08-15',
            commentary:
                '해당 만기의 콜 옵션 미결제약정이 풋 대비 두 배 높습니다.',
            tone: 'bullish',
        },
    ],
    signals: [{ kind: 'bullish', message: '콜 옵션 거래량이 급증했습니다.' }],
    analyzedAt: '2026-07-24T00:00:00.000Z',
};

describe('hasProseForTab', () => {
    describe('own-tab fixture renders true', () => {
        it.each([
            ['technical', TECHNICAL_FIXTURE],
            ['overall', OVERALL_FIXTURE],
            ['congress', CONGRESS_FIXTURE],
            ['fundamental', FUNDAMENTAL_FIXTURE],
            ['financials', FINANCIALS_FIXTURE],
            ['news', NEWS_FIXTURE],
            ['options', OPTIONS_FIXTURE],
        ] as const)(
            '%s: a well-formed same-tab fixture is true',
            (tab, fixture) => {
                expect(hasProseForTab(tab, fixture)).toBe(true);
            }
        );
    });

    // The assertion that actually catches a swapped `PROSE_PREDICATE_BY_TAB`
    // entry: feeding a DIFFERENT tab's well-formed content through
    // `hasProseForTab(tab, ...)` must be false. If e.g. `options` were
    // mis-mapped to `hasFinancialsProse`, the FINANCIALS-shaped foil below
    // would flip this to `true` and fail the test. Every pair here was
    // checked to have zero overlapping top-level field names with the tab
    // under test (the one real overlap — fundamental/financials — is
    // isolated via the DISCRIMINATING fixtures above and asserted
    // separately).
    describe('different-tab fixture renders false (catches a swapped mapping)', () => {
        it('technical: a congress-shaped fixture does not render (no shared field names)', () => {
            expect(hasProseForTab('technical', CONGRESS_FIXTURE)).toBe(false);
        });

        it('overall: a technical-shaped fixture does not render (no shared field names)', () => {
            expect(hasProseForTab('overall', TECHNICAL_FIXTURE)).toBe(false);
        });

        it('congress: a fundamental-shaped fixture does not render (no shared field names)', () => {
            expect(hasProseForTab('congress', FUNDAMENTAL_FIXTURE)).toBe(false);
        });

        it('news: an options-shaped fixture does not render (no shared field names)', () => {
            expect(hasProseForTab('news', OPTIONS_FIXTURE)).toBe(false);
        });

        it('options: a congress-shaped fixture does not render (no shared field names — deliberately NOT the technical fixture, which also uses a top-level `summary` field and would collide)', () => {
            expect(hasProseForTab('options', CONGRESS_FIXTURE)).toBe(false);
        });

        // fundamental/financials discriminating pair (see comment above the
        // fixtures): a financials-shaped fixture with its shared fields
        // nulled out must still be false under `fundamental`, and vice
        // versa — proving the dispatch actually invokes the tab-specific
        // predicate rather than a swapped one that also happens to accept
        // `overallConclusionKo`/`riskFactorsKo`.
        it('fundamental: a financials-discriminating fixture (axisAssessments only) does not render', () => {
            expect(
                hasProseForTab('fundamental', FINANCIALS_DISCRIMINATING_FIXTURE)
            ).toBe(false);
        });

        it('financials: a fundamental-discriminating fixture (categoryAssessments only) does not render', () => {
            expect(
                hasProseForTab('financials', FUNDAMENTAL_DISCRIMINATING_FIXTURE)
            ).toBe(false);
        });

        // Sanity check that the discriminating fixtures are themselves still
        // valid (true) for their OWN tab — otherwise the false-assertions
        // above would be vacuous.
        it('the discriminating fixtures are still true for their own tab', () => {
            expect(
                hasProseForTab(
                    'fundamental',
                    FUNDAMENTAL_DISCRIMINATING_FIXTURE
                )
            ).toBe(true);
            expect(
                hasProseForTab('financials', FINANCIALS_DISCRIMINATING_FIXTURE)
            ).toBe(true);
        });
    });

    describe('malformed / non-object content renders false for every tab', () => {
        const malformedValues: [string, unknown][] = [
            ['null', null],
            ['undefined', undefined],
            ['a string', 'not an object'],
            ['a number', 42],
            ['a boolean', true],
            ['an empty object', {}],
            ['an array', ['unexpected']],
        ];

        for (const tab of SEO_SNAPSHOT_TABS) {
            for (const [label, value] of malformedValues) {
                it(`${tab}: ${label} does not render`, () => {
                    expect(hasProseForTab(tab, value)).toBe(false);
                });
            }
        }
    });

    describe('unknown tab string', () => {
        it('returns false without throwing', () => {
            const unknownTab = 'not-a-real-tab' as SeoSnapshotTab;

            expect(() =>
                hasProseForTab(unknownTab, TECHNICAL_FIXTURE)
            ).not.toThrow();
            expect(hasProseForTab(unknownTab, TECHNICAL_FIXTURE)).toBe(false);
        });
    });
});
