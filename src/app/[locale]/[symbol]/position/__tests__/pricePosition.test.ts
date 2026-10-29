vi.mock('@/entities/bars/lib/sessionBarsStaticCache', () => ({
    getSessionBarsStatic: vi.fn(),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    rangeTone,
    resolveCurrentPricePosition,
    resolvePriceRange,
} from '@/app/[locale]/[symbol]/position/_lib/pricePosition';
import { getSessionBarsStatic } from '@/entities/bars/lib/sessionBarsStaticCache';
import type { PositionTranslator } from '@/widgets/portfolio-position/lib/positionBuildingNotes';

/** 키와 인자를 그대로 드러내는 번역자 — 어떤 키를 골랐는지 단언한다. */
const echo: PositionTranslator = (key, values) =>
    values === undefined ? key : `${key}(${JSON.stringify(values)})`;

describe('rangeTone', () => {
    it.each([
        [0, 'nearLow'],
        [0.19, 'nearLow'],
        [0.2, 'middle'],
        [0.59, 'middle'],
        [0.6, 'nearHigh'],
        [1, 'nearHigh'],
    ] as const)('위치 %s → %s (층 라벨과 같은 20%% 밴드 경계)', (pos, tone) => {
        expect(rangeTone(pos)).toBe(tone);
    });
});

describe('resolveCurrentPricePosition', () => {
    it('퍼센타일·층 라벨·톤 문장을 같은 위치에서 만든다', () => {
        expect(
            resolveCurrentPricePosition(
                { low52w: 0, high52w: 100, lastClose: 62, volumeByBand: null },
                echo,
                echo
            )
        ).toEqual({
            percentile: 62,
            floorLabel: expect.stringContaining('floorNote'),
            tone: 'nearHigh',
        });
    });

    it('고점이 저점 이하인 퇴화 범위는 null이다', () => {
        expect(
            resolveCurrentPricePosition(
                { low52w: 50, high52w: 50, lastClose: 50, volumeByBand: null },
                echo,
                echo
            )
        ).toBeNull();
    });
});

describe('resolvePriceRange', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('세션 키 봉으로 52주 범위·종가·밴드별 거래량을 계산한다', async () => {
        vi.mocked(getSessionBarsStatic).mockResolvedValue({
            bars: [
                { time: 1, open: 90, high: 95, low: 85, close: 90, volume: 1 },
                {
                    time: 2,
                    open: 100,
                    high: 110,
                    low: 95,
                    close: 100,
                    volume: 1,
                },
            ],
            indicators: { rsi: [null, null], macd: [{ histogram: null }] },
        } as never);

        await expect(
            resolvePriceRange('AAPL', 'AAPL', 'us-equity')
        ).resolves.toEqual({
            low52w: 85,
            high52w: 110,
            lastClose: 100,
            volumeByBand: [0, 50, 0, 50, 0],
        });
        expect(getSessionBarsStatic).toHaveBeenCalledWith(
            'AAPL',
            'us-equity',
            'AAPL'
        );
    });

    it('봉 조회가 실패하면 로그를 남기고 null이다', async () => {
        const error = new Error('FMP down');
        vi.mocked(getSessionBarsStatic).mockRejectedValue(error);
        const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(
            resolvePriceRange('AAPL', 'AAPL', 'us-equity')
        ).resolves.toBeNull();
        expect(logSpy).toHaveBeenCalledWith(
            '[PositionPage] resolvePriceRange failed:',
            error
        );
        logSpy.mockRestore();
    });
});
