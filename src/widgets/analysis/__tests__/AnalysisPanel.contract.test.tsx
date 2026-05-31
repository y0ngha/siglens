// HIGH-3 — 코어 출력 계약 고정(contract pinning).
//
// 실제 AnalysisPanel을 "완전히 채워진" AnalysisResponse로 렌더하고, 채워진
// 렌더 경로(추세선 라벨·패턴 아코디언·키레벨 가격·가격 목표·보조지표)가 실제로
// 표시되는지 단언한다. fixture는 @y0ngha/siglens-core의 AnalysisResponse 타입에서
// 구성하므로, 코어가 필드 shape을 바꾸면 이 테스트가 컴파일/런타임에서 깨진다.
//
// HIGH-2의 AnalysisPanel.test.tsx와 달리 trendUtils·buildExpertAnalysisReport·
// signalUtils·parseStructuredSummary·MarkdownText·@/shared/lib/trendline을
// mock하지 않는다 — 실제 라벨 맵과 리포트 빌더를 통과시켜 진짜 계약을 검증한다.
// 부수효과가 큰 자식(AdBanner 등)과 컨텍스트·시간·클립보드 헬퍼만 mock한다.

vi.mock('@/widgets/symbol-page', () => ({
    useSymbolPageContext: () => ({ indicatorCount: 25 }),
}));
vi.mock('@/shared/config/time', () => ({
    MS_PER_SECOND: 1000,
    SECONDS_PER_MINUTE: 60,
}));
vi.mock('@/shared/hooks/useCopyToClipboard', () => ({
    DEFAULT_RESET_MS: 2000,
}));
vi.mock('@/shared/lib/formatAnalyzedAt', () => ({
    formatAnalyzedAt: () => '1시간 전',
}));
vi.mock('@/entities/analysis', () => ({
    isAnalysisStale: () => false,
}));
vi.mock('../AnalysisProgress', () => ({
    AnalysisProgress: () => <div data-testid="analysis-progress" />,
}));
vi.mock('../AnalysisToast', () => ({
    AnalysisToast: () => null,
}));
vi.mock('../AdBanner', () => ({
    AdBanner: () => null,
}));
vi.mock('../StaleAnalysisBanner', () => ({
    StaleAnalysisBanner: () => null,
}));

import { render, screen, fireEvent } from '@testing-library/react';
import type {
    AnalysisResponse,
    ClusteredKeyLevels,
} from '@y0ngha/siglens-core';

import { AnalysisPanel } from '../AnalysisPanel';

// 타입에서 직접 구성한 완전한 응답. 모든 배열/객체 필드를 채운다.
function makeFullAnalysis(): AnalysisResponse {
    return {
        summary:
            '중기 상승 추세가 유지되는 가운데 단기 저항 돌파 확인이 필요한 구간입니다.',
        trend: 'bullish',
        riskLevel: 'medium',
        indicatorResults: [
            {
                indicatorName: 'RSI',
                signals: [
                    {
                        type: 'skill',
                        trend: 'neutral',
                        strength: 'moderate',
                        description: 'RSI 58 — 과열 전 중립 영역입니다.',
                    },
                ],
            },
            {
                indicatorName: 'MACD',
                signals: [
                    {
                        type: 'skill',
                        trend: 'bullish',
                        strength: 'strong',
                        description:
                            'MACD 시그널 상향 교차로 상승 모멘텀이 강화됩니다.',
                    },
                ],
            },
        ],
        keyLevels: {
            support: [{ price: 200, reason: '20일 이동평균선' }],
            resistance: [{ price: 220, reason: '직전 고점' }],
            poc: { price: 210, reason: '거래량 중심' },
        },
        priceTargets: {
            bullish: {
                condition: '220 저항 돌파 시',
                targets: [{ price: 235, basis: '측정 이동 목표' }],
            },
            bearish: {
                condition: '200 지지 이탈 시',
                targets: [{ price: 188, basis: '하단 스윙 지지' }],
            },
        },
        patternSummaries: [
            {
                id: 'pattern-1',
                patternName: 'ascending_triangle',
                skillName: '상승 삼각형',
                detected: true,
                trend: 'bullish',
                summary: '상단 저항 반복 테스트로 돌파 가능성이 유지됩니다.',
                confidenceWeight: 0.92,
                keyPrices: [
                    { label: '돌파 기준', price: 220 },
                    { label: '목표가', price: 235 },
                ],
                renderConfig: {
                    show: true,
                    type: 'line',
                    color: '#26a69a',
                    label: '돌파 기준',
                },
            },
            {
                id: 'pattern-2',
                patternName: 'double_bottom',
                skillName: '이중 바닥',
                detected: false,
                trend: 'bullish',
                summary: '감지되지 않음.',
                confidenceWeight: 0.5,
            },
        ],
        strategyResults: [
            {
                id: 'strategy-1',
                strategyName: '브레이크아웃 전략',
                trend: 'bullish',
                summary: '저항 돌파 후 리테스트 진입을 제안합니다.',
                confidenceWeight: 0.8,
            },
        ],
        candlePatterns: [
            {
                id: 'candle-1',
                patternName: 'bullish_engulfing',
                detected: true,
                trend: 'bullish',
                summary: '강세 장악형으로 매수 우위가 확인됩니다.',
            },
        ],
        trendlines: [
            {
                direction: 'ascending',
                start: { time: 1000, price: 180 },
                end: { time: 2000, price: 205 },
            },
            {
                direction: 'descending',
                start: { time: 1000, price: 230 },
                end: { time: 2000, price: 220 },
            },
        ],
        actionRecommendation: {
            positionAnalysis: '현재가는 지지와 저항 사이 중단에 위치합니다.',
            entry: '200 지지 확인 후 분할 매수를 검토합니다.',
            exit: '235 도달 시 분할 청산을 권장합니다.',
            riskReward: '손익비 약 1:2.5 구간입니다.',
            entryRecommendation: 'wait',
            entryPrices: [200, 205],
            stopLoss: 192,
            takeProfitPrices: [225, 235],
        },
        analyzedAt: '2025-01-01T00:00:00Z',
    };
}

// AnalysisPanel은 별도 ClusteredKeyLevels prop을 받는다(analysis.keyLevels와 별개).
function makeFullKeyLevels(): ClusteredKeyLevels {
    return {
        support: [
            {
                price: 200,
                reason: '20일 이동평균선',
                count: 1,
                sources: [{ price: 200, reason: '20일 이동평균선' }],
            },
        ],
        resistance: [
            {
                price: 220,
                reason: '2개 지표 수렴',
                count: 2,
                sources: [
                    { price: 220, reason: '직전 고점' },
                    { price: 220.5, reason: '피보나치 0.618' },
                ],
            },
        ],
        poc: { price: 210, reason: '거래량 중심' },
    };
}

describe('AnalysisPanel — core output contract', () => {
    it('renders all populated paths from a full AnalysisResponse', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeFullAnalysis()}
                keyLevels={makeFullKeyLevels()}
                timeframe="1Day"
            />
        );

        // 요약 + 전체 추세 배지(실제 trendUtils 라벨).
        expect(
            screen.getByText(/중기 상승 추세가 유지되는/)
        ).toBeInTheDocument();

        // 추세선 섹션 + 실제 라벨 맵(@/shared/lib/trendline).
        expect(screen.getByText('추세선')).toBeInTheDocument();
        expect(screen.getByText('상승 추세선')).toBeInTheDocument();
        expect(screen.getByText('하락 추세선')).toBeInTheDocument();

        // 키레벨 — 섹션 헤더 + 가격(toLocaleString 포맷) + 지지/저항 라벨.
        expect(screen.getByText('주요 레벨')).toBeInTheDocument();
        expect(screen.getByText('저항')).toBeInTheDocument();
        expect(screen.getByText('지지')).toBeInTheDocument();
        expect(screen.getByText('220.00')).toBeInTheDocument();
        expect(screen.getByText('200.00')).toBeInTheDocument();
        expect(screen.getByText('PoC')).toBeInTheDocument();

        // 가격 목표 — 상승/하락 시나리오.
        expect(screen.getByText('가격 목표')).toBeInTheDocument();
        expect(screen.getByText('220 저항 돌파 시')).toBeInTheDocument();
        expect(screen.getByText('200 지지 이탈 시')).toBeInTheDocument();

        // 보조지표 — 실제 SignalItem 렌더.
        expect(screen.getByText('보조지표')).toBeInTheDocument();
        expect(screen.getByText('RSI')).toBeInTheDocument();
        expect(screen.getByText('MACD')).toBeInTheDocument();

        // 차트 패턴 — detected만 아코디언으로, 미감지는 숨김.
        expect(screen.getByText('차트 패턴')).toBeInTheDocument();
        expect(screen.getByText('상승 삼각형')).toBeInTheDocument();
        expect(screen.queryByText('이중 바닥')).not.toBeInTheDocument();

        // 전략 섹션 + 실제 StrategyAccordionItem.
        expect(screen.getByText('전략')).toBeInTheDocument();
        expect(screen.getByText('브레이크아웃 전략')).toBeInTheDocument();

        // 매매 전략(ActionRecommendation) + 진입 의견 라벨.
        expect(screen.getByText('매매 전략')).toBeInTheDocument();
        expect(screen.getByText('관망')).toBeInTheDocument();
    });

    it('expands a detected pattern accordion to reveal its key prices', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeFullAnalysis()}
                keyLevels={makeFullKeyLevels()}
                timeframe="1Day"
            />
        );

        // 패턴 아코디언을 펼치면 요약 + 주요 가격대가 드러난다.
        fireEvent.click(screen.getByText('상승 삼각형'));
        expect(
            screen.getByText(
                '상단 저항 반복 테스트로 돌파 가능성이 유지됩니다.'
            )
        ).toBeInTheDocument();
        expect(screen.getByText('주요 가격대')).toBeInTheDocument();
    });
});
