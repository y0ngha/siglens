import { HOLDER_LOOKUP_NOTE } from '@/entities/investor-flows/model';
import { addUtcIsoDays } from '@/shared/lib/isoDate';
import {
    evaluate,
    makeExpandedSnapshot,
    makeKrSnapshot,
    makeSnapshot,
    makeSqueezeContext,
} from '@/widgets/investor-flows/__tests__/fixtures/flowsFixtures';
import { fakes } from '../boundary';
import {
    CLOCKS,
    listCrypto,
    listKrStock,
    listUsStock,
    SYMBOLS,
    type GoldenCase,
} from '../goldenCase';
import { noise } from '../syntheticMarket';

/**
 * `get_investor_flows` — 수급 점수표는 `widgets/investor-flows` 픽스처(실측 모양의 13F·FINRA·Form 4·DART 스냅샷)를
 * core `evaluateInvestorFlows`에 돌린 결과다. 공개 API 설정은 비공식 소스(네이버 투자자별 매매, Yahoo 보유 비율)를 뺀다.
 */

const READY = {
    institutional: 'ready',
    short: 'ready',
    failsToDeliver: 'ready',
    filings: 'ready',
    thresholdList: 'ready',
    dart: 'ready',
} as const;

function naverRows(count: number) {
    return Array.from({ length: count }, (_, i) => ({
        date: addUtcIsoDays('2026-11-18', -i - Math.floor(i / 5) * 2),
        foreignNet: Math.round(184_000 * noise(31, i, 0)),
        institutionNet: Math.round(97_000 * noise(31, i, 1)),
        individualNet: i === 7 ? null : Math.round(-150_000 * noise(31, i, 2)),
        close: 120_000 + Math.round(2_400 * noise(31, i, 3)),
    }));
}

export const investorFlowsCases: GoldenCase[] = [
    {
        tool: 'get_investor_flows',
        name: 'us-expanded-snapshot-holder-lookup-truncation',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us, holder: '  Vanguard Group  ' },
        arrange: () => {
            listUsStock();
            const snapshot = makeExpandedSnapshot();
            fakes.getInvestorFlowsScorecard.mockResolvedValue({
                market: 'us',
                snapshot,
                scorecard: evaluate(snapshot, true, {
                    includeExchangeLists: true,
                    squeezeContext: makeSqueezeContext(),
                }),
                degraded: false,
                finraEnabled: true,
                regShoEnabled: true,
                readiness: READY,
            });
            fakes.getYahooOwnershipShares.mockResolvedValue({
                institutionsPct: 71.17,
                institutionsFloatPct: 74.25,
                insidersPct: 4.16,
                institutionCount: 7773,
            });
            fakes.getHolderLookup.mockResolvedValue({
                query: 'Vanguard Group',
                period: '2026-06-30',
                status: 'found',
                matches: [
                    {
                        filerName: 'VANGUARD GROUP INC',
                        shares: 1_284_311_204,
                        valueUsd: 301_412_883_000,
                        prevShares: 1_270_118_442,
                        rankByShares: 1,
                    },
                ],
                matchedFilers: ['VANGUARD GROUP INC'],
                note: HOLDER_LOOKUP_NOTE,
            });
        },
    },
    {
        tool: 'get_investor_flows',
        name: 'us-finra-off-partial-degraded',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us },
        arrange: () => {
            listUsStock();
            const snapshot = {
                ...makeSnapshot(),
                degraded: ['largeHolders', 'float'] as const,
            };
            fakes.getInvestorFlowsScorecard.mockResolvedValue({
                market: 'us',
                snapshot,
                scorecard: evaluate(snapshot, false),
                degraded: false,
                finraEnabled: false,
                regShoEnabled: false,
                readiness: { ...READY, institutional: 'collecting' },
            });
        },
    },
    {
        tool: 'get_investor_flows',
        name: 'kr-dart-with-naver-trend',
        now: CLOCKS.krSession,
        args: { symbol: SYMBOLS.kr },
        arrange: () => {
            listKrStock();
            const snapshot = makeKrSnapshot();
            fakes.getInvestorFlowsScorecard.mockResolvedValue({
                market: 'kr',
                krCompany: { corpName: '한빛정밀', viaCommonShare: false },
                snapshot,
                scorecard: evaluate(snapshot),
                degraded: false,
                finraEnabled: false,
                regShoEnabled: false,
                readiness: READY,
            });
            fakes.fetchNaverInvestorTrend.mockResolvedValue(naverRows(24));
        },
    },
    {
        tool: 'get_investor_flows',
        name: 'kr-preferred-collecting-no-data',
        now: CLOCKS.weekend,
        args: { symbol: '900115.KS' },
        arrange: () => {
            fakes.getInvestorFlowsScorecard.mockResolvedValue({
                market: 'kr',
                krCompany: { corpName: '한빛정밀', viaCommonShare: true },
                snapshot: null,
                scorecard: null,
                degraded: false,
                finraEnabled: false,
                regShoEnabled: false,
                readiness: { ...READY, dart: 'collecting' },
            });
            fakes.fetchNaverInvestorTrend.mockRejectedValue(
                new Error('naver 403')
            );
        },
    },
    {
        tool: 'get_investor_flows',
        name: 'crypto-tab-not-available',
        now: CLOCKS.crypto,
        args: { symbol: SYMBOLS.crypto },
        arrange: listCrypto,
    },
    {
        tool: 'get_investor_flows',
        name: 'provider-degraded',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us2 },
    },
];
