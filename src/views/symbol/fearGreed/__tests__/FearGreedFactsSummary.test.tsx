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
        expect(getByText(/52주 위치/)).toBeInTheDocument();
        // confidence footer.
        expect(getByText(/표본 220/)).toBeInTheDocument();
    });

    it('computeFearGreedIndex가 null이면(데이터 부족) 아무것도 렌더하지 않는다', () => {
        (computeFearGreedIndex as Mock).mockReturnValue(null);

        const { container } = render(
            <FearGreedFactsSummary symbol="AAPL" bars={[]} buySellVolume={[]} />
        );

        expect(container).toBeEmptyDOMElement();
    });
});
