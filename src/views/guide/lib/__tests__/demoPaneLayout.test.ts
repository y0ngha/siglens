import { describe, expect, it } from 'vitest';
import { estimateLabelWidth, linearScale } from '@/views/guide/lib/chartLayout';
import { PANE_HEIGHT } from '@/views/guide/lib/demoChartLayout';
import {
    LEGEND_GAP,
    legendPositions,
    PANE_LABEL_INSET,
    PANE_PAD_RATIO,
    paneDomain,
    paneLevelText,
    paneTicks,
    paneTickText,
} from '@/views/guide/lib/demoPaneLayout';

describe('paneDomain', () => {
    it('range가 있으면 그대로 쓴다', () => {
        expect(paneDomain({ label: 'RSI', range: [0, 100] })).toEqual([0, 100]);
    });

    it('값이 하나도 없으면 [0, 1]로 돌아간다', () => {
        expect(paneDomain({ label: 'X' })).toEqual([0, 1]);
    });

    it('선·레벨 값에 PANE_PAD_RATIO만큼 띄우고 빈 칸은 건너뛴다', () => {
        const [min, max] = paneDomain({
            label: 'X',
            lines: [{ values: [10, null, Number.NaN, 20], label: 'a' }],
            levels: [{ value: 30 }],
        });
        expect(min).toBeCloseTo(10 - 20 * PANE_PAD_RATIO);
        expect(max).toBeCloseTo(30 + 20 * PANE_PAD_RATIO);
    });

    it('막대가 있으면 0 기준선을 범위에 넣는다', () => {
        const [min] = paneDomain({ label: 'V', histogram: [5, 8] });
        expect(min).toBeCloseTo(0 - 8 * PANE_PAD_RATIO);
    });
});

describe('paneTickText', () => {
    it('큰 값은 축약형으로 줄인다', () => {
        expect(paneTickText(25_000, 10)).toBe('25K');
    });

    it('작은 값은 눈금 간격의 소수 자릿수를 따른다', () => {
        expect(paneTickText(0.25, 0.05)).toBe('0.25');
    });
});

describe('paneLevelText', () => {
    it('눈금 간격과 무관하게 값을 소수 넷째 자리까지 적는다', () => {
        expect(paneLevelText(12.5)).toBe('12.5');
        expect(paneLevelText(0.123456)).toBe('0.1235');
    });

    it('큰 값은 축약형으로 줄인다', () => {
        expect(paneLevelText(12_345)).toBe('12K');
    });
});

describe('paneTicks', () => {
    const yOf = linearScale(0, 100, PANE_HEIGHT, 0);

    it('레벨 선과 겹칠 눈금은 빼고, 간격은 빼기 전 기준을 지킨다', () => {
        expect(paneTicks(0, 100, [], yOf)).toEqual({
            ticks: [0, 50, 100],
            step: 50,
        });
        expect(paneTicks(0, 100, [52], yOf)).toEqual({
            ticks: [0, 100],
            step: 50,
        });
    });

    it('눈금이 하나뿐이면 간격을 범위에서 구한다', () => {
        expect(
            paneTicks(1.1, 1.9, [], linearScale(1.1, 1.9, PANE_HEIGHT, 0))
        ).toEqual({
            ticks: [1.5],
            step: 0.5,
        });
    });
});

describe('legendPositions', () => {
    it('패널 이름 뒤에서 시작해 앞 범례 폭만큼씩 나아간다', () => {
        const name = estimateLabelWidth('MACD', 12);
        const first = 6 + PANE_LABEL_INSET + name + LEGEND_GAP;
        expect(legendPositions('MACD', ['MACD', 'Signal'], 6, 12)).toEqual([
            first,
            first + estimateLabelWidth('MACD', 12) + LEGEND_GAP,
        ]);
    });

    it('범례 글자가 없으면 빈 배열이다', () => {
        expect(legendPositions('X', [], 6, 12)).toEqual([]);
    });
});
