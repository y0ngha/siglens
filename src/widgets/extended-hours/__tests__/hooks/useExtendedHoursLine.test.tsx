vi.mock('@/entities/extended-hours/hooks/useExtendedHoursQuote', () => ({
    useExtendedHoursQuote: vi.fn(),
}));

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExtendedHoursQuote } from '@/entities/extended-hours/hooks/useExtendedHoursQuote';
import { koMessage } from '@/shared/test-utils/koMessage';
import {
    AFTER_DOWN,
    PRE_FLAT,
    PRE_UP,
} from '@/widgets/extended-hours/__tests__/fixtures/extendedHoursQuotes';
import { useExtendedHoursLine } from '@/widgets/extended-hours/hooks/useExtendedHoursLine';
import { describeExtendedMove } from '@/widgets/extended-hours/utils/extendedMove';
import { formatTradeTime } from '@/widgets/extended-hours/utils/formatTradeTime';

const mockedQuote = vi.mocked(useExtendedHoursQuote);

/** 훅이 그릴 줄을 돌려줄 때의 모양. */
type ExtendedHoursLineView = NonNullable<
    ReturnType<typeof useExtendedHoursLine>
>;

/** 카탈로그 문구에 ko 체결 시각을 끼운 기대값. */
const expectedTradedAt = (ms: number): string =>
    koMessage('widgets.extended-hours.tradedAt').replace(
        '{time}',
        formatTradeTime(ms, 'ko')
    );

describe('useExtendedHoursLine', () => {
    beforeEach(() => {
        mockedQuote.mockReset();
    });

    it('시세가 없으면 null이고, 받은 심볼로 조회한다', () => {
        mockedQuote.mockReturnValue(null);

        const { result } = renderHook(() => useExtendedHoursLine('MSFT'));

        expect(result.current).toBeNull();
        expect(mockedQuote).toHaveBeenCalledWith('MSFT');
    });

    it('프리마켓: 전일 종가 기준 문구·상승 단어·ET 체결 시각', () => {
        mockedQuote.mockReturnValue(PRE_UP);

        const { result } = renderHook(() => useExtendedHoursLine('AAPL'));

        expect(result.current).toEqual<ExtendedHoursLineView>({
            sessionLabel: koMessage('widgets.extended-hours.sessionPre'),
            basisLabel: koMessage('widgets.extended-hours.basisPre'),
            priceText: '$346.38',
            move: describeExtendedMove(PRE_UP.change, PRE_UP.changePercent),
            moveLabel: koMessage('shared.lib.priceMove.up'),
            tradedAtText: expectedTradedAt(PRE_UP.tradedAtMs),
        });
    });

    it('애프터마켓: 오늘 종가 기준 문구·하락 단어', () => {
        mockedQuote.mockReturnValue(AFTER_DOWN);

        const { result } = renderHook(() => useExtendedHoursLine('AAPL'));

        expect(result.current?.sessionLabel).toBe(
            koMessage('widgets.extended-hours.sessionAfter')
        );
        expect(result.current?.basisLabel).toBe(
            koMessage('widgets.extended-hours.basisAfter')
        );
        expect(result.current?.moveLabel).toBe(
            koMessage('shared.lib.priceMove.down')
        );
        expect(result.current?.tradedAtText).toBe(
            expectedTradedAt(AFTER_DOWN.tradedAtMs)
        );
    });

    it('등락 0이면 상승이 아니라 보합 단어를 준다', () => {
        mockedQuote.mockReturnValue(PRE_FLAT);

        const { result } = renderHook(() => useExtendedHoursLine('AAPL'));

        expect(result.current?.moveLabel).toBe(
            koMessage('widgets.extended-hours.flat')
        );
    });

    it('$0.00·0.00%로 보이는 미세 하락(-0.004)도 보합 단어를 준다', () => {
        mockedQuote.mockReturnValue({
            ...PRE_UP,
            change: -0.004,
            changePercent: -0.0012,
        });

        const { result } = renderHook(() => useExtendedHoursLine('AAPL'));

        expect(result.current?.moveLabel).toBe(
            koMessage('widgets.extended-hours.flat')
        );
    });
});
