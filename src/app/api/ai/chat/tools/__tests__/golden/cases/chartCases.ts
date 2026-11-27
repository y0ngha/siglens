import {
    evaluate,
    makeSnapshot,
} from '@/widgets/investor-flows/__tests__/fixtures/flowsFixtures';
import { fakes, repos } from '../boundary';
import { optionsSnapshot, PORTFOLIO_ROWS } from '../fixtures';
import {
    CLOCKS,
    listKrStock,
    listSecondKrStock,
    listSecondUsStock,
    listThirdUsStock,
    listUsStock,
    SYMBOLS,
    type GoldenCase,
} from '../goldenCase';
import { arrangeUsFundamentals } from './fundamentalsCases';
import { listThemeMembers } from './historyCases';
import { usOverview } from './marketCases';
import { OPTION_EXPIRIES } from './sourceCases';

/**
 * `show_chart` — 시각 블록은 `onChart`로만 나가므로 에이전트 설정에서 블록을 고정하고, 공개 API 설정(차트 없음)은
 * `chart_not_supported`를 고정한다.
 */
export const showChartCases: GoldenCase[] = [
    {
        tool: 'show_chart',
        name: 'compare-three-symbols-six-months',
        now: CLOCKS.usOpen,
        args: {
            kind: 'compare',
            symbols: [SYMBOLS.us, SYMBOLS.us2, 'vlmr'],
            period: '6M',
        },
        arrange: () => {
            listUsStock();
            listSecondUsStock();
            listThirdUsStock();
        },
    },
    {
        tool: 'show_chart',
        name: 'financials-us-eight-quarters',
        now: CLOCKS.usClosed,
        args: { kind: 'financials', symbol: SYMBOLS.us },
        arrange: () => {
            arrangeUsFundamentals();
            repos.earningsReports.methods.listReportedEps.mockResolvedValue([
                {
                    earningsDate: '2026-10-29',
                    epsActual: 2.74,
                    epsEstimated: 2.61,
                },
                {
                    earningsDate: '2026-07-30',
                    epsActual: 2.67,
                    epsEstimated: 2.7,
                },
                {
                    earningsDate: '2026-04-30',
                    epsActual: 2.6,
                    epsEstimated: 2.52,
                },
            ]);
        },
    },
    {
        tool: 'show_chart',
        name: 'options-requested-expiry',
        now: CLOCKS.usOpen,
        args: { kind: 'options', symbol: SYMBOLS.us, expiry: '2026-11-27' },
        arrange: () => {
            listUsStock();
            fakes.hasOptionsMarket.mockResolvedValue(true);
            fakes.fetchOptionsSnapshot.mockResolvedValue(
                optionsSnapshot(
                    SYMBOLS.us,
                    244.85,
                    '2026-11-18T15:25:00.000Z',
                    OPTION_EXPIRIES
                )
            );
        },
    },
    {
        tool: 'show_chart',
        name: 'flows-us-scorecard',
        now: CLOCKS.usClosed,
        args: { kind: 'flows', symbol: SYMBOLS.us },
        arrange: () => {
            listUsStock();
            const snapshot = makeSnapshot();
            fakes.getInvestorFlowsScorecard.mockResolvedValue({
                market: 'us',
                snapshot,
                scorecard: evaluate(snapshot),
                degraded: false,
                finraEnabled: true,
                regShoEnabled: false,
                readiness: {
                    institutional: 'ready',
                    short: 'ready',
                    failsToDeliver: 'ready',
                    filings: 'ready',
                    thresholdList: 'ready',
                    dart: 'ready',
                },
            });
        },
    },
    {
        tool: 'show_chart',
        name: 'portfolio-member',
        now: CLOCKS.krSession,
        args: { kind: 'portfolio' },
        arrange: () => {
            listUsStock();
            listSecondUsStock();
            listThirdUsStock();
            listKrStock();
            listSecondKrStock();
            repos.portfolio.methods.findByUser.mockResolvedValue(
                PORTFOLIO_ROWS
            );
        },
    },
    {
        tool: 'show_chart',
        name: 'heatmap-us-sectors',
        now: CLOCKS.usOpen,
        locale: 'en',
        args: { kind: 'heatmap', market: 'us' },
        arrange: usOverview,
    },
    {
        tool: 'show_chart',
        name: 'heatmap-kr-theme',
        now: CLOCKS.krSession,
        args: { kind: 'heatmap', market: 'kr', theme: 'kr_battery' },
        arrange: () => listThemeMembers('kr_battery', 'kr'),
    },
    {
        tool: 'show_chart',
        name: 'dividends-us-history',
        now: CLOCKS.weekend,
        args: { kind: 'dividends', symbol: SYMBOLS.us },
        arrange: arrangeUsFundamentals,
    },
    {
        tool: 'show_chart',
        name: 'guest-portfolio-login-required',
        now: CLOCKS.weekend,
        caller: 'guest',
        args: { kind: 'portfolio' },
    },
    {
        tool: 'show_chart',
        name: 'compare-one-symbol-invalid',
        now: CLOCKS.weekend,
        args: { kind: 'compare', symbols: [SYMBOLS.us, 'gldnx'] },
    },
];
