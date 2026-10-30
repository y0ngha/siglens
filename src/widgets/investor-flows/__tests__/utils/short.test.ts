import { describe, expect, it } from 'vitest';
import {
    buildShortInterestRows,
    buildShortInterestView,
    buildShortVolumeSeries,
    changeDirection,
    hasShortData,
    shortVolumeMarker,
    SHORT_VOLUME_CHART_DAYS,
} from '../../utils/short';
import {
    evaluate,
    makeShortInterest,
    makeShortVolume,
    makeSnapshot,
} from '../fixtures/flowsFixtures';

describe('buildShortInterestRows', () => {
    it('결제일 오름차순에 점마다 유통주식 대비 %를 붙인다', () => {
        const rows = buildShortInterestRows(
            [...makeShortInterest(3)].reverse(),
            1_000_000_000
        );
        expect(rows.map(r => r.settlementDate)).toEqual([
            '2026-06-15',
            '2026-07-15',
            '2026-08-15',
        ]);
        expect(rows[0].pctOfFloat).toBeCloseTo(11);
    });

    it('유통주식 수를 모르면 pctOfFloat은 null이다', () => {
        expect(
            buildShortInterestRows(makeShortInterest(1), null)[0].pctOfFloat
        ).toBeNull();
    });

    it('빈 입력은 빈 배열이다', () => {
        expect(buildShortInterestRows([], 10)).toEqual([]);
    });
});

describe('changeDirection', () => {
    it('소수 첫째 자리에서 0이면 flat이다', () => {
        expect([
            changeDirection(3),
            changeDirection(-3),
            changeDirection(0.04),
        ]).toEqual(['up', 'down', 'flat']);
    });
});

describe('buildShortVolumeSeries', () => {
    it('최근 60거래일만 남기고 평균·최신 행을 계산한다', () => {
        const series = buildShortVolumeSeries(makeShortVolume(70));
        expect(series.rows).toHaveLength(SHORT_VOLUME_CHART_DAYS);
        expect(series.latest?.ratio).toBeCloseTo(0.62);
        expect(series.average).toBeGreaterThan(0.4);
    });

    it('총거래량 0인 날은 ratio null이고 평균에서 빠진다', () => {
        const series = buildShortVolumeSeries([
            { date: '2026-10-14', shortVolume: 0, totalVolume: 0 },
            { date: '2026-10-15', shortVolume: 5, totalVolume: 10 },
        ]);
        expect(series.rows[0].ratio).toBeNull();
        expect(series.average).toBeCloseTo(0.5);
        // 평균에 들어간 날은 비중을 계산할 수 있던 하루뿐이다(행은 둘).
        expect(series.rows).toHaveLength(2);
        expect(series.averagedDays).toBe(1);
    });

    it('averagedDays는 구간 안에서 비중을 계산할 수 있던 거래일 수다', () => {
        expect(buildShortVolumeSeries(makeShortVolume(70)).averagedDays).toBe(
            SHORT_VOLUME_CHART_DAYS
        );
    });

    it('빈 입력은 평균·최신이 null이다', () => {
        expect(buildShortVolumeSeries([])).toEqual({
            rows: [],
            average: null,
            averagedDays: 0,
            latest: null,
        });
    });
});

describe('shortVolumeMarker', () => {
    it('core z 신호가 bearish면 surge다(최근 비중 급등 픽스처)', () => {
        expect(shortVolumeMarker(evaluate(makeSnapshot()))).toBe('surge');
    });

    it('신호가 없으면 null이다(FINRA 데이터 없음)', () => {
        expect(
            shortVolumeMarker(
                evaluate(
                    makeSnapshot({ shortInterest: null, shortVolume: null })
                )
            )
        ).toBeNull();
    });
});

describe('hasShortData', () => {
    it('플래그가 꺼지면 데이터가 있어도 false다', () => {
        expect(
            hasShortData(false, makeShortInterest(), makeShortVolume())
        ).toBe(false);
    });

    it('켜져 있고 둘 중 하나라도 있으면 true다', () => {
        expect(hasShortData(true, makeShortInterest(1), [])).toBe(true);
        expect(hasShortData(true, [], makeShortVolume(1))).toBe(true);
    });

    it('켜져 있어도 null/빈 배열뿐이면 false다', () => {
        expect(hasShortData(true, null, null)).toBe(false);
        expect(hasShortData(true, [], [])).toBe(false);
    });
});

describe('buildShortInterestView', () => {
    it('행과 직전 결제일 대비 변화를 한 번에 만든다(에이전트 요약과 같은 함수)', () => {
        const view = buildShortInterestView(
            makeShortInterest(3),
            1_000_000_000
        );
        expect(view.rows).toHaveLength(3);
        expect(view.previousChange).toEqual({
            previousDate: '2026-07-15',
            sharesChange: 6_000_000,
            pct: (6_000_000 / 116_000_000) * 100,
        });
    });

    it('결제일이 하나면 변화는 null이다', () => {
        expect(
            buildShortInterestView(makeShortInterest(1), null).previousChange
        ).toBeNull();
    });
});
