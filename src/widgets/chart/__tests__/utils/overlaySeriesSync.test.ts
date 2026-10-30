import { LineStyle } from 'lightweight-charts';
import {
    isSameOverlayStyle,
    overlayGeometryKeys,
    overlaySeriesStyle,
    withOpacity,
} from '../../utils/overlaySeriesSync';
import type { OverlayLineSpec } from '../../utils/chartOverlayUtils';

const SPEC: OverlayLineSpec = {
    paneIndex: 0,
    points: [
        { time: 1, value: 10 },
        { time: 3, value: 12 },
    ],
    color: '#42a5f5',
    dashed: false,
    opacity: 1,
    lineWidthMult: 1,
    title: '',
    labelPriority: 0,
    markers: [],
    extendRight: false,
};

describe('withOpacity', () => {
    it('불투명이거나 #rrggbb가 아니면 그대로 둔다', () => {
        expect(withOpacity('#42a5f5', 1)).toBe('#42a5f5');
        expect(withOpacity('rgb(0,0,0)', 0.5)).toBe('rgb(0,0,0)');
    });

    it('불투명도를 알파 채널로 붙인다', () => {
        expect(withOpacity('#42a5f5', 0.5)).toBe('#42a5f580');
    });
});

describe('overlaySeriesStyle', () => {
    it('두께를 1~4로 자르고 점선 여부를 lineStyle로 옮긴다', () => {
        expect(
            overlaySeriesStyle({ ...SPEC, lineWidthMult: 10 }, 2).lineWidth
        ).toBe(4);
        expect(
            overlaySeriesStyle({ ...SPEC, lineWidthMult: 0 }, 2).lineWidth
        ).toBe(1);
        expect(overlaySeriesStyle({ ...SPEC, dashed: true }, 2)).toMatchObject({
            dashed: true,
            lineStyle: LineStyle.Dashed,
        });
    });
});

describe('isSameOverlayStyle', () => {
    it('색·두께·점선·제목이 모두 같을 때만 같다', () => {
        const base = overlaySeriesStyle(SPEC, 2);
        expect(isSameOverlayStyle(base, overlaySeriesStyle(SPEC, 2))).toBe(
            true
        );
        expect(
            isSameOverlayStyle(
                base,
                overlaySeriesStyle({ ...SPEC, opacity: 0.3 }, 2)
            )
        ).toBe(false);
        expect(
            isSameOverlayStyle(
                base,
                overlaySeriesStyle({ ...SPEC, title: 'T' }, 2)
            )
        ).toBe(false);
    });
});

describe('overlayGeometryKeys', () => {
    it('스타일만 다른 스펙은 같은 key를 받는다', () => {
        const [a] = overlayGeometryKeys([SPEC]);
        const [b] = overlayGeometryKeys([
            {
                ...SPEC,
                color: '#000000',
                opacity: 0.2,
                lineWidthMult: 2,
                title: 'x',
            },
        ]);
        expect(a).toBe(b);
    });

    it('기하가 다르면 key가 다르다', () => {
        const [a, b] = overlayGeometryKeys([
            SPEC,
            { ...SPEC, points: [SPEC.points[0], { time: 4, value: 12 }] },
        ]);
        expect(a).not.toBe(b);
    });

    it('기하가 같은 스펙이 여럿이면 등장 순서로 구분한다', () => {
        const keys = overlayGeometryKeys([SPEC, { ...SPEC }, { ...SPEC }]);
        expect(new Set(keys).size).toBe(3);
    });
});
