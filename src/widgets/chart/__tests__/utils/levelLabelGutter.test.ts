// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
    createCanvasTextMeasurer,
    estimateTextWidth,
    LEVEL_LABEL_GUTTER_MARGIN_PX,
    LEVEL_TITLE_FONT,
    levelLabelGutterPx,
} from '../../utils/levelLabelGutter';

const TEN_PX_PER_CHAR = (text: string): number => text.length * 10;

describe('levelLabelGutterPx', () => {
    it('제목이 없으면 0이다', () => {
        expect(levelLabelGutterPx([], TEN_PX_PER_CHAR, 1000)).toBe(0);
    });

    it("빈 문자열('숨김' 제목)만 있으면 0이고 측정기를 부르지 않는다", () => {
        const measure = vi.fn(TEN_PX_PER_CHAR);

        expect(levelLabelGutterPx(['', ''], measure, 1000)).toBe(0);
        expect(measure).not.toHaveBeenCalled();
    });

    it('가장 넓은 제목 폭에 숨통(12px)을 더한다', () => {
        expect(
            levelLabelGutterPx(['abc', 'abcdefg', 'ab'], TEN_PX_PER_CHAR, 1000)
        ).toBe(70 + LEVEL_LABEL_GUTTER_MARGIN_PX);
    });

    it('빈 제목이 섞여도 나머지로 계산한다', () => {
        expect(levelLabelGutterPx(['', 'abc'], TEN_PX_PER_CHAR, 1000)).toBe(
            30 + LEVEL_LABEL_GUTTER_MARGIN_PX
        );
    });

    it('소수 폭은 올림해 정수 px로 낸다', () => {
        expect(levelLabelGutterPx(['abc'], () => 20.2, 1000)).toBe(33);
    });

    it('pane 폭의 30%를 넘지 않는다', () => {
        expect(
            levelLabelGutterPx(['x'.repeat(100)], TEN_PX_PER_CHAR, 400)
        ).toBe(120);
    });

    it('상한 바로 아래는 그대로 둔다', () => {
        // 폭 100 → 상한 30. 필요 폭 28(= 16 + 12)은 상한 안이다.
        expect(levelLabelGutterPx(['abcd'], () => 16, 100)).toBe(28);
    });

    it('pane 폭을 아직 못 쟀으면(0) 0이다', () => {
        expect(levelLabelGutterPx(['abc'], TEN_PX_PER_CHAR, 0)).toBe(0);
    });
});

describe('estimateTextWidth', () => {
    it('CJK 글자는 글꼴 크기만큼, 라틴은 그보다 좁게 잰다', () => {
        expect(estimateTextWidth('돌')).toBe(12);
        expect(estimateTextWidth('a')).toBeLessThan(12);
        expect(estimateTextWidth('')).toBe(0);
    });
});

describe('createCanvasTextMeasurer', () => {
    it('차트 글꼴을 세팅한 2D 컨텍스트의 measureText 폭을 쓴다', () => {
        const context = {
            font: '',
            measureText: vi.fn(() => ({ width: 42 })),
        };
        const getContext = vi
            .spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValue(context as unknown as CanvasRenderingContext2D);

        try {
            const measure = createCanvasTextMeasurer(LEVEL_TITLE_FONT);

            expect(measure('돌파 기준')).toBe(42);
            expect(measure('다른 제목')).toBe(42);
            expect(context.font).toBe(LEVEL_TITLE_FONT);
            expect(context.measureText).toHaveBeenCalledWith('돌파 기준');
            // 캔버스·컨텍스트는 처음 한 번만 만든다.
            expect(getContext).toHaveBeenCalledTimes(1);
        } finally {
            getContext.mockRestore();
        }
    });

    it('컨텍스트를 못 얻으면 어림값으로 떨어진다', () => {
        const getContext = vi
            .spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValue(null);

        try {
            const measure = createCanvasTextMeasurer(LEVEL_TITLE_FONT);

            expect(measure('돌파')).toBe(estimateTextWidth('돌파'));
        } finally {
            getContext.mockRestore();
        }
    });

    it('getContext가 던져도 어림값으로 떨어진다', () => {
        const getContext = vi
            .spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockImplementation(() => {
                throw new Error('blocked');
            });

        try {
            const measure = createCanvasTextMeasurer(LEVEL_TITLE_FONT);

            expect(measure('abc')).toBe(estimateTextWidth('abc'));
        } finally {
            getContext.mockRestore();
        }
    });
});
