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
        // FIX 6's factor-ranking narrative sentence also mentions "최근
        // 252봉 위치" (it's this fixture's most extreme factor) — anchor on
        // the per-factor line's "라벨: 값" shape so this assertion targets
        // only that line, not both.
        expect(getByText(/최근 252봉 위치: /)).toBeInTheDocument();
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
        expect(
            getByText(/최근 252봉 위치로, 95번째 퍼센타일/)
        ).toBeInTheDocument();
    });

    /**
     * `bars`가 비어 있으면(하지만 computeFearGreedIndex는 mock이라 snapshot이
     * 나온다는 가정 하에) `bars.at(-1)?.time`이 undefined가 되어 asOfLabel이
     * `null`로 떨어진다 — "종가 기준" 안내 span 자체가 생략되는 경로.
     */
    it('bars가 비어 있으면 기준 시점(asOf) 안내를 렌더하지 않는다', () => {
        (computeFearGreedIndex as Mock).mockReturnValue(FIXTURE_SNAPSHOT);

        const { queryByText } = render(
            <FearGreedFactsSummary symbol="AAPL" bars={[]} buySellVolume={[]} />
        );

        expect(queryByText(/종가 기준/)).not.toBeInTheDocument();
    });

    /**
     * snapshot.warning이 설정되면(chronic weakness/strength) self-norm 경고
     * 문장이 렌더된다 — 클라이언트 배지(`SelfNormWarningBadge`)와 크롤 텍스트가
     * 같은 문구를 공유하는 경로.
     */
    it('snapshot.warning이 있으면 self-norm 경고 문장을 렌더한다', () => {
        (computeFearGreedIndex as Mock).mockReturnValue({
            ...FIXTURE_SNAPSHOT,
            warning: 'CHRONIC_STRENGTH',
        });

        const { getByText } = render(
            <FearGreedFactsSummary
                symbol="AAPL"
                bars={fakeBars}
                buySellVolume={fakeBsv}
            />
        );

        expect(getByText(/장기 강세 흐름/)).toBeInTheDocument();
    });

    it('computeFearGreedIndex가 null이면(데이터 부족) 아무것도 렌더하지 않는다', () => {
        (computeFearGreedIndex as Mock).mockReturnValue(null);

        const { container } = render(
            <FearGreedFactsSummary symbol="AAPL" bars={[]} buySellVolume={[]} />
        );

        expect(container).toBeEmptyDOMElement();
    });

    /**
     * 위 테스트들은 `bars`가 1개뿐이라 `computeFearGreedHistory`(실제 구현,
     * mock 안 됨)가 워밍업 구간을 하나도 못 벗어나 `timeSeriesLines`가 항상
     * 빈 배열이었다 — 시계열 문장 3종(P1/P2/P5) 렌더링 자체가 이 스위트에서
     * 한 번도 실행되지 않았다. 결정적 trend+oscillation 120봉 픽스처로 실제
     * walk-forward 계산이 60개 이상의 유효 포인트를 만들게 해, 실사용자가
     * 보는 시계열 문장이 실제로 렌더되는지 검증한다.
     */
    describe('시계열 문장(P1/P2/P5) 렌더링', () => {
        function buildRealisticBars(n: number): Bar[] {
            return Array.from({ length: n }, (_, i) => {
                const price = 100 + i * 0.15 + Math.sin(i / 5) * 3;
                const open = price - 0.5;
                const close = price + (i % 2 === 0 ? 0.3 : -0.2);
                const high = Math.max(open, close) + 0.5 + (i % 3);
                const low = Math.min(open, close) - 0.5 - (i % 2);
                const volume =
                    1000 + (i % 7) * 50 + Math.round(Math.sin(i / 3) * 100);
                const time =
                    Math.floor(Date.UTC(2026, 0, 1) / 1000) + i * 86400;
                return { time, open, high, low, close, volume };
            });
        }

        function buildRealisticBuySellVolume(
            bars: Bar[]
        ): BuySellVolumeResult[] {
            return bars.map((bar, i) => {
                const buyRatio = 0.5 + Math.sin(i / 4) * 0.2;
                return {
                    buyVolume: Math.round(bar.volume * buyRatio),
                    sellVolume: Math.round(bar.volume * (1 - buyRatio)),
                };
            });
        }

        const realisticBars = buildRealisticBars(120);
        const realisticBsv = buildRealisticBuySellVolume(realisticBars);

        it('충분한 시계열이 주어지면 기간 비교·연간 범위·레짐 분포 문장을 렌더한다', () => {
            (computeFearGreedIndex as Mock).mockReturnValue(FIXTURE_SNAPSHOT);

            const { getByText } = render(
                <FearGreedFactsSummary
                    symbol="AAPL"
                    bars={realisticBars}
                    buySellVolume={realisticBsv}
                />
            );

            // P1: 1주/1개월 전 대비(1년 전은 아직 표본이 짧아 언급되지 않는다).
            expect(getByText(/1주 전 45점/)).toBeInTheDocument();
            expect(getByText(/1개월 전 70점/)).toBeInTheDocument();
            // P2: 최근 구간의 최저·최고·중앙값·현재 백분위.
            expect(
                getByText(/최저 17점\(2026년 2월 17일\)/)
            ).toBeInTheDocument();
            expect(
                getByText(/최고 91점\(2026년 4월 15일\)/)
            ).toBeInTheDocument();
            expect(getByText(/중앙값은 55점/)).toBeInTheDocument();
            expect(
                getByText(/현재 37점은 이 분포에서 24% 지점에 해당합니다/)
            ).toBeInTheDocument();
            // P5: 5단계 라벨 전부가 표본에 등장해 전부 언급된다(0일 구간 없음).
            expect(getByText(/최근 80거래일 중/)).toBeInTheDocument();
            expect(getByText(/극심한 공포 6일/)).toBeInTheDocument();
            expect(getByText(/공포 22일/)).toBeInTheDocument();
            expect(getByText(/중립 12일/)).toBeInTheDocument();
            expect(getByText(/탐욕 23일/)).toBeInTheDocument();
            expect(getByText(/극심한 탐욕 17일/)).toBeInTheDocument();
        });
    });
});
