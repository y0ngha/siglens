import type { Mock } from 'vitest';
import { render } from '@testing-library/react';
import {
    computeFearGreedIndex,
    type Bar,
    type BuySellVolumeResult,
    type FearGreedSnapshot,
} from '@y0ngha/siglens-core';
import { FearGreedFactsSummary } from '../FearGreedFactsSummary';

// computeFearGreedIndex의 실제 walk-forward 로직은 90+ bar 픽스처가 필요해
// 컴포넌트 스위트에서 재현하지 않는다 — useFearGreed.test.tsx와 동일하게
// mock으로 snapshot 산출부를 대체하고, 이 스위트는 렌더링/텍스트 배선만 검증한다.
vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual('@y0ngha/siglens-core');
    return {
        ...actual,
        computeFearGreedIndex: vi.fn(),
    };
});

const FIXTURE_SNAPSHOT: FearGreedSnapshot = {
    score: 62.4,
    label: 'GREED',
    groups: [
        {
            name: 'Flow',
            score: 58,
            factors: [
                { key: 'volume_z', rawValue: 1.2345, percentile: 80 },
                { key: 'buysell_imbalance', rawValue: 0.12, percentile: 65 },
                { key: 'poc_distance', rawValue: 0.031, percentile: 55 },
            ],
        },
        {
            name: 'Trend',
            score: 66,
            factors: [
                { key: 'ma200_distance', rawValue: 0.084, percentile: 90 },
                { key: 'range_position', rawValue: 0.91, percentile: 95 },
            ],
        },
    ],
    confidence: 'normal',
    sampleSize: 220,
    warning: null,
};

const fakeBars: Bar[] = [
    { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
];
const fakeBsv: BuySellVolumeResult[] = [{ buyVolume: 60, sellVolume: 40 }];

describe('FearGreedFactsSummary', () => {
    it('정상 snapshot이면 점수·라벨·5개 factor를 크롤 가능한 텍스트로 렌더한다', () => {
        (computeFearGreedIndex as Mock).mockReturnValue(FIXTURE_SNAPSHOT);

        const { container, getByText } = render(
            <FearGreedFactsSummary
                symbol="AAPL"
                bars={fakeBars}
                buySellVolume={fakeBsv}
            />
        );

        expect(container.textContent?.trim().length).toBeGreaterThan(40);
        // 점수 + 5단계 라벨.
        expect(getByText(/62 \/ 100/)).toBeInTheDocument();
        expect(getByText(/\(탐욕\)/)).toBeInTheDocument();
        // 5개 factor 라벨 전부 노출.
        expect(getByText(/거래량 z/)).toBeInTheDocument();
        expect(getByText(/Buy\/Sell 불균형/)).toBeInTheDocument();
        expect(getByText(/POC 거리/)).toBeInTheDocument();
        expect(getByText(/MA200 거리/)).toBeInTheDocument();
        // FIX 6's factor-ranking narrative sentence also mentions "52주
        // 위치" (it's this fixture's most extreme factor) — anchor on the
        // per-factor line's "라벨: 값" shape so this assertion targets only
        // that line, not both.
        expect(getByText(/52주 위치: /)).toBeInTheDocument();
        // confidence footer.
        expect(getByText(/표본 220/)).toBeInTheDocument();
    });

    // FIX 6 (audit, option b): group comparison + factor ranking narrative
    // sentences, built from FIXTURE_SNAPSHOT's group scores (Flow 58, Trend
    // 66) and factor percentiles.
    it('그룹 비교·factor 랭킹 서사 문장을 렌더한다 (FIX 6)', () => {
        (computeFearGreedIndex as Mock).mockReturnValue(FIXTURE_SNAPSHOT);

        const { getByText } = render(
            <FearGreedFactsSummary
                symbol="AAPL"
                bars={fakeBars}
                buySellVolume={fakeBsv}
            />
        );

        expect(
            getByText(
                '추세 그룹 점수(66점)가 수급 그룹(58점)보다 8점 높아 추세 우위 흐름입니다.'
            )
        ).toBeInTheDocument();
        expect(getByText(/가장 두드러진 지표는/)).toBeInTheDocument();
        expect(getByText(/52주 위치로, 95번째 퍼센타일/)).toBeInTheDocument();
    });

    it('computeFearGreedIndex가 null이면(데이터 부족) 아무것도 렌더하지 않는다', () => {
        (computeFearGreedIndex as Mock).mockReturnValue(null);

        const { container } = render(
            <FearGreedFactsSummary symbol="AAPL" bars={[]} buySellVolume={[]} />
        );

        expect(container).toBeEmptyDOMElement();
    });
});
