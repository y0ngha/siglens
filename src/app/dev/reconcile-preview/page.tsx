/**
 * Dev-only preview route for visually verifying reconciledLevels UI.
 *
 * This route is a throwaway test harness. It hardcodes `AnalysisResponse` data
 * for several reconcile scenarios so developers can visually verify info-panel
 * rendering ("내부 보정값" block, tooltip, exit/riskReward text) without needing
 * to trigger real AI analysis.
 *
 * Chart rendering is intentionally skipped — this preview focuses on the
 * AnalysisPanel info section. Chart verification would require `bars` +
 * `indicators` mocks which are out of scope.
 *
 * Safe to remove at any time. Not linked from production navigation.
 */

'use client';

import { useState } from 'react';
import type {
    ActionRecommendation,
    AnalysisResponse,
    ClusteredKeyLevels,
    ReconciledActionLevels,
} from '@/domain/types';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { SymbolPageProvider } from '@/components/symbol-page/SymbolPageContext';

interface Scenario {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly analysis: AnalysisResponse;
}

// ---------------------------------------------------------------------------
// Base data shared by all scenarios
// ---------------------------------------------------------------------------

const ENTRY_PRICE = 160;

const baseAnalysis: AnalysisResponse = {
    summary:
        '[테스트 시나리오] 실제 AI 응답이 아닙니다. reconciledLevels 렌더 검증을 위한 mock 데이터입니다.',
    trend: 'bullish',
    indicatorResults: [],
    riskLevel: 'medium',
    keyLevels: {
        support: [{ price: 155, reason: '이전 저점' }],
        resistance: [{ price: 175, reason: '이전 고점' }],
    },
    priceTargets: {
        bullish: {
            targets: [{ price: 170, basis: '이전 고점 돌파 시' }],
            condition: '$162 돌파 시',
        },
        bearish: {
            targets: [{ price: 145, basis: '지지선 이탈 시' }],
            condition: '$155 이탈 시',
        },
    },
    patternSummaries: [],
    strategyResults: [],
    candlePatterns: [],
    trendlines: [],
};

const mockKeyLevels: ClusteredKeyLevels = {
    support: [
        {
            price: 155,
            reason: '이전 저점',
            count: 1,
            sources: [{ price: 155, reason: '이전 저점' }],
        },
    ],
    resistance: [
        {
            price: 175,
            reason: '이전 고점',
            count: 1,
            sources: [{ price: 175, reason: '이전 고점' }],
        },
    ],
};

// ---------------------------------------------------------------------------
// Helpers to build ActionRecommendation + ReconciledActionLevels
// ---------------------------------------------------------------------------

function formatExit(
    entry: number,
    sl: number | undefined,
    tps: readonly number[] | undefined
): string {
    const parts: string[] = [];
    const validTps = (tps ?? []).filter(Number.isFinite);
    if (validTps.length === 1) {
        const tp = validTps[0];
        const pct = (((tp - entry) / entry) * 100).toFixed(1);
        parts.push(`목표가 $${tp.toFixed(2)} (+${pct}%)에서 익절`);
    } else if (validTps.length > 1) {
        const ordinals = ['1차', '2차', '3차', '4차', '5차'];
        const tpParts = validTps.map((tp, idx) => {
            const pct = (((tp - entry) / entry) * 100).toFixed(1);
            return `${ordinals[idx] ?? `${idx + 1}차`} 목표 $${tp.toFixed(2)} (+${pct}%)`;
        });
        parts.push(`${tpParts.join(', ')}에서 익절`);
    }
    if (sl !== undefined && Number.isFinite(sl)) {
        const pct = (((sl - entry) / entry) * 100).toFixed(1);
        parts.push(`손절 $${sl.toFixed(2)} (${pct}%)`);
    }
    return parts.length > 0 ? parts.join(', ') + '.' : '';
}

function formatRiskReward(
    entry: number,
    sl: number | undefined,
    tps: readonly number[] | undefined
): string {
    if (sl === undefined || !Number.isFinite(sl)) return '';
    const tp = tps?.[0];
    if (tp === undefined || !Number.isFinite(tp)) return '';
    const slPct = ((sl - entry) / entry) * 100;
    const tpPct = ((tp - entry) / entry) * 100;
    const riskAbs = Math.abs(slPct);
    if (riskAbs === 0) return '';
    const slLabel = `${slPct.toFixed(1)}%`;
    const tpLabel =
        tpPct >= 0 ? `+${tpPct.toFixed(1)}%` : `${tpPct.toFixed(1)}%`;
    const ratio = (tpPct / riskAbs).toFixed(1);
    return `손절 ${slLabel} vs 목표 ${tpLabel} → 위험:보상 = 1:${ratio}`;
}

function buildReconciled(
    sl: number | undefined,
    tps: readonly number[] | undefined,
    reason: string
): ReconciledActionLevels {
    return {
        stopLoss: sl,
        takeProfitPrices: tps,
        exit: formatExit(ENTRY_PRICE, sl, tps),
        riskReward: formatRiskReward(ENTRY_PRICE, sl, tps),
        reason,
    };
}

const baseRec: Omit<
    ActionRecommendation,
    'stopLoss' | 'takeProfitPrices' | 'reconciledLevels' | 'entryRecommendation'
> = {
    positionAnalysis:
        '현재가 $160은 $155 지지선과 $175 저항선 사이 중간 구간에 위치.',
    entry: '$158~162 구간에서 분할 매수 권장.',
    exit: '목표가 $170.00 (+6.3%)에서 익절, 손절 $150.00 (-6.3%).',
    riskReward: '손절 -6.3% vs 목표 +6.3% → 위험:보상 = 1:1.0',
    entryPrices: [158, 162],
};

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

const SCENARIOS: readonly Scenario[] = [
    {
        id: 'baseline',
        label: '1. Baseline (no reconcile)',
        description:
            'AI가 유효한 SL $150, TP $170, 진입가 $160을 제시. reconciledLevels 없음 → "내부 보정값" 블록 미노출.',
        analysis: {
            ...baseAnalysis,
            actionRecommendation: {
                ...baseRec,
                entryRecommendation: 'enter',
                stopLoss: 150,
                takeProfitPrices: [170],
            },
        },
    },
    {
        id: 'sl-missing',
        label: '2. SL 누락 보정',
        description:
            'AI stopLoss=undefined, takeProfitPrices=[170] 유효. reconciledLevels에 SL fallback만 포함.',
        analysis: {
            ...baseAnalysis,
            actionRecommendation: {
                ...baseRec,
                entryRecommendation: 'enter',
                exit: '목표가 $170.00 (+6.3%)에서 익절.',
                riskReward: '',
                stopLoss: undefined,
                takeProfitPrices: [170],
                reconciledLevels: buildReconciled(
                    153.2,
                    [170],
                    'AI가 손절가를 제시하지 않아 ATR 기반 기본값을 계산했습니다.'
                ),
            },
        },
    },
    {
        id: 'tp-missing',
        label: '3. TP 누락 보정',
        description:
            'AI stopLoss=$150 유효, takeProfitPrices=undefined. reconciledLevels에 TP fallback만 포함.',
        analysis: {
            ...baseAnalysis,
            actionRecommendation: {
                ...baseRec,
                entryRecommendation: 'enter',
                exit: '손절 $150.00 (-6.3%).',
                riskReward: '',
                stopLoss: 150,
                takeProfitPrices: undefined,
                reconciledLevels: buildReconciled(
                    150,
                    [166.8],
                    'AI가 목표가를 제시하지 않아 ATR 기반 기본값을 계산했습니다.'
                ),
            },
        },
    },
    {
        id: 'both-missing',
        label: '4. SL + TP 둘 다 누락',
        description:
            'AI stopLoss=undefined, takeProfitPrices=undefined. 둘 다 ATR 기반 fallback 적용.',
        analysis: {
            ...baseAnalysis,
            actionRecommendation: {
                ...baseRec,
                entryRecommendation: 'enter',
                exit: '',
                riskReward: '',
                stopLoss: undefined,
                takeProfitPrices: undefined,
                reconciledLevels: buildReconciled(
                    153.2,
                    [166.8],
                    'AI가 손절·목표가를 제시하지 않아 ATR 기반 기본값을 계산했습니다.'
                ),
            },
        },
    },
    {
        id: 'sl-out-of-range',
        label: '5. AI 제시 SL 범위 초과',
        description:
            'AI stopLoss=$50 (진입가 $160 대비 ATR×5 범위 초과). 내부 기준으로 보정된 SL ~$153.',
        analysis: {
            ...baseAnalysis,
            actionRecommendation: {
                ...baseRec,
                entryRecommendation: 'enter',
                exit: '목표가 $170.00 (+6.3%)에서 익절, 손절 $50.00 (-68.8%).',
                riskReward: '손절 -68.8% vs 목표 +6.3% → 위험:보상 = 1:0.1',
                stopLoss: 50,
                takeProfitPrices: [170],
                reconciledLevels: buildReconciled(
                    153.2,
                    [170],
                    'AI가 제시한 손절가가 내부 기준을 벗어나 보정했습니다.'
                ),
            },
        },
    },
    {
        id: 'multi-tp-first-invalid',
        label: '6. Multi-TP: [0] 무효',
        description:
            'AI takeProfitPrices=[155, 180, 200], entry=$160. TP[0]은 진입가 미만(무효) → fallback 치환, [1,2]는 AI 값 보존.',
        analysis: {
            ...baseAnalysis,
            actionRecommendation: {
                ...baseRec,
                entryRecommendation: 'enter',
                exit: '1차 목표 $155.00 (-3.1%), 2차 목표 $180.00 (+12.5%), 3차 목표 $200.00 (+25.0%)에서 익절, 손절 $150.00 (-6.3%).',
                riskReward: '손절 -6.3% vs 목표 -3.1% → 위험:보상 = 1:-0.5',
                stopLoss: 150,
                takeProfitPrices: [155, 180, 200],
                reconciledLevels: buildReconciled(
                    150,
                    [166.8, 180, 200],
                    'AI가 제시한 목표가가 내부 기준을 벗어나 보정했습니다.'
                ),
            },
        },
    },
    {
        id: 'avoid',
        label: '7. avoid (reconcile skip)',
        description:
            'entryRecommendation=avoid, SL/TP undefined. reconcile 건너뜀 → "내부 보정값" 블록 미노출.',
        analysis: {
            ...baseAnalysis,
            trend: 'bearish',
            riskLevel: 'high',
            actionRecommendation: {
                positionAnalysis:
                    '현재 시장 상황에서 진입을 권장하지 않습니다.',
                entry: '대기 권장. 추세가 확실해질 때까지 관망.',
                exit: '',
                riskReward: '',
                entryRecommendation: 'avoid',
                entryPrices: undefined,
                stopLoss: undefined,
                takeProfitPrices: undefined,
                // reconciledLevels 없음
            },
        },
    },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReconcilePreviewPage() {
    const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0].id);
    const active = SCENARIOS.find(s => s.id === scenarioId) ?? SCENARIOS[0];

    return (
        <SymbolPageProvider indicatorCount={13}>
            <div className="bg-secondary-900 min-h-screen p-6">
                <header className="mb-6">
                    <h1 className="text-secondary-100 text-2xl font-bold">
                        Reconcile UI Preview (Dev Only)
                    </h1>
                    <p className="text-secondary-500 mt-1 text-sm">
                        보정값 UI 시각 검증용 임시 라우트. 각 시나리오를 클릭해
                        reconciledLevels 렌더 확인. Mock 데이터 — 실제 AI·FMP
                        호출 없음.
                    </p>
                </header>

                <nav className="mb-6 flex flex-wrap gap-2">
                    {SCENARIOS.map(s => {
                        const isActive = s.id === scenarioId;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setScenarioId(s.id)}
                                className={
                                    isActive
                                        ? 'border-primary-400 bg-primary-900/40 text-primary-300 rounded border px-3 py-1.5 text-sm'
                                        : 'border-secondary-700 bg-secondary-800 text-secondary-300 hover:bg-secondary-700 rounded border px-3 py-1.5 text-sm'
                                }
                            >
                                {s.label}
                            </button>
                        );
                    })}
                </nav>

                <section className="border-secondary-800 bg-secondary-800/40 mb-4 rounded border px-4 py-3">
                    <p className="text-secondary-400 text-sm">
                        <span className="text-secondary-300 font-semibold">
                            시나리오:
                        </span>{' '}
                        {active.description}
                    </p>
                </section>

                <AnalysisPanel
                    symbol="MOCK"
                    analysis={active.analysis}
                    keyLevels={mockKeyLevels}
                />
            </div>
        </SymbolPageProvider>
    );
}
