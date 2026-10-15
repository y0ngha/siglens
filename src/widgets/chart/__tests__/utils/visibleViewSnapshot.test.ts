import { describe, expect, it, vi } from 'vitest';
import type { ITimeScaleApi, Time } from 'lightweight-charts';
import {
    restoreVisibleView,
    snapshotVisibleView,
} from '../../utils/visibleViewSnapshot';

function fakeScale(opts: {
    range: { from: number; to: number } | null;
    logical: { from: number; to: number } | null;
    index: Record<number, number>;
}) {
    const setVisibleLogicalRange = vi.fn();
    const scale = {
        getVisibleRange: () => opts.range,
        getVisibleLogicalRange: () => opts.logical,
        timeToIndex: (t: number) => opts.index[t] ?? null,
        setVisibleLogicalRange,
    } as unknown as ITimeScaleApi<Time>;
    return { scale, setVisibleLogicalRange };
}

describe('snapshotVisibleView', () => {
    it('보이는 첫·마지막 봉의 시각과 양끝 여백(봉 수)을 찍는다', () => {
        const { scale } = fakeScale({
            range: { from: 100, to: 200 },
            logical: { from: -3, to: 55 },
            index: { 100: 0, 200: 50 },
        });
        expect(snapshotVisibleView(scale)).toEqual({
            fromTime: 100,
            toTime: 200,
            leftPad: 3,
            rightPad: 5,
        });
    });

    it('여백이 음수가 되면(범위가 봉 안쪽) 0으로 둔다', () => {
        const { scale } = fakeScale({
            range: { from: 100, to: 200 },
            logical: { from: 4, to: 40 },
            index: { 100: 0, 200: 50 },
        });
        expect(snapshotVisibleView(scale)).toMatchObject({
            leftPad: 0,
            rightPad: 0,
        });
    });

    it.each([
        ['시간 범위 없음', null, { from: 0, to: 1 }, { 100: 0 }],
        ['논리 범위 없음', { from: 100, to: 200 }, null, { 100: 0, 200: 1 }],
        [
            '시작 시각 인덱스 없음',
            { from: 100, to: 200 },
            { from: 0, to: 1 },
            { 200: 1 },
        ],
        [
            '끝 시각 인덱스 없음',
            { from: 100, to: 200 },
            { from: 0, to: 1 },
            { 100: 0 },
        ],
    ])('%s이면 null', (_label, range, logical, index) => {
        const { scale } = fakeScale({ range, logical, index });
        expect(snapshotVisibleView(scale)).toBeNull();
    });
});

describe('restoreVisibleView', () => {
    const snapshot = {
        fromTime: 100,
        toTime: 200,
        leftPad: 3,
        rightPad: 5,
    } as never;

    it('같은 봉을 **지금의** 인덱스로 옮겨 여백과 함께 복원한다', () => {
        const { scale, setVisibleLogicalRange } = fakeScale({
            range: null,
            logical: null,
            index: { 100: 66, 200: 144 },
        });
        expect(restoreVisibleView(scale, snapshot)).toBe(true);
        expect(setVisibleLogicalRange).toHaveBeenCalledWith({
            from: 63,
            to: 149,
        });
    });

    it.each([
        ['시작 봉', { 200: 144 }],
        ['끝 봉', { 100: 66 }],
    ])(
        '%s의 인덱스를 못 찾으면 false이고 범위를 건드리지 않는다',
        (_label, index) => {
            const { scale, setVisibleLogicalRange } = fakeScale({
                range: null,
                logical: null,
                index,
            });
            expect(restoreVisibleView(scale, snapshot)).toBe(false);
            expect(setVisibleLogicalRange).not.toHaveBeenCalled();
        }
    );
});
