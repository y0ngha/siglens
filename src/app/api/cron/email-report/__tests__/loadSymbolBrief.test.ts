import {
    calculateIndicators,
    classifyTrend,
    CONFLUENCE_MIN_BARS,
    type Bar,
    type BarsData,
} from '@y0ngha/siglens-core';
import {
    loadSymbolBrief,
    type SymbolBriefSources,
} from '@/app/api/cron/email-report/loadSymbolBrief';

const DAY = 86_400;

/** 완만히 오르는 합성 일봉. 마지막 두 종가는 100 → 102로 고정해 등락률 단언을 정확히 한다. */
function dailyBars(count: number): Bar[] {
    const bars = Array.from({ length: count }, (_, i) => {
        const close = 100 + Math.sin(i / 7) * 5 + i * 0.05;
        return {
            time: 1_700_000_000 + i * DAY,
            open: close - 0.5,
            high: close + 1,
            low: close - 1,
            close,
            volume: 1_000 + i,
        };
    });
    if (count >= 2) {
        bars[count - 2]!.close = 100;
        bars[count - 1]!.close = 102;
    }
    return bars;
}

function barsData(count: number): BarsData {
    const bars = dailyBars(count);
    return { bars, indicators: calculateIndicators(bars) };
}

function sources(data: Promise<BarsData>): SymbolBriefSources {
    return { getDailyBars: vi.fn().mockReturnValue(data) };
}

describe('loadSymbolBrief', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('일봉을 한 번 받아 종가·등락률·추세·신호 요약을 채운다', async () => {
        const data = barsData(CONFLUENCE_MIN_BARS + 140);
        const src = sources(Promise.resolve(data));

        const brief = await loadSymbolBrief('AAPL', src);

        expect(src.getDailyBars).toHaveBeenCalledTimes(1);
        expect(src.getDailyBars).toHaveBeenCalledWith('AAPL');
        expect(brief.symbol).toBe('AAPL');
        expect(brief.close).toBe(102);
        expect(brief.changePercent).toBe(2);
        expect(brief.trend).toBe(classifyTrend(data.bars, data.indicators));
        expect(typeof brief.signals?.score).toBe('number');
    });

    it(`${CONFLUENCE_MIN_BARS}봉 미만이면 core가 보류해 점수는 null이다(데이터 없음이 아니다)`, async () => {
        const brief = await loadSymbolBrief(
            'NEW',
            sources(Promise.resolve(barsData(CONFLUENCE_MIN_BARS - 1)))
        );

        expect(brief.close).toBe(102);
        expect(brief.signals).not.toBeNull();
        expect(brief.signals?.score).toBeNull();
    });

    it('봉 조회가 실패하면 그 종목만 "데이터 없음"으로 두고 던지지 않는다', async () => {
        const brief = await loadSymbolBrief(
            'BROKEN',
            sources(Promise.reject(new Error('fmp down')))
        );

        expect(brief).toEqual({
            symbol: 'BROKEN',
            close: null,
            changePercent: null,
            trend: null,
            signals: null,
        });
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('BROKEN'),
            expect.any(Error)
        );
    });

    it('봉이 비어 있으면 "데이터 없음"이다', async () => {
        const brief = await loadSymbolBrief(
            'EMPTY',
            sources(
                Promise.resolve({
                    bars: [],
                    indicators: calculateIndicators([]),
                })
            )
        );

        expect(brief.signals).toBeNull();
        expect(brief.close).toBeNull();
    });

    it('봉이 하나면 등락률은 null이다', async () => {
        const brief = await loadSymbolBrief(
            'ONE',
            sources(Promise.resolve(barsData(1)))
        );

        expect(brief.changePercent).toBeNull();
        expect(brief.close).not.toBeNull();
    });

    it('core 계산이 던지면 그 종목만 "데이터 없음"으로 두고 던지지 않는다', async () => {
        const data = barsData(CONFLUENCE_MIN_BARS + 10);
        // indicators가 비정상이면 classifyTrend가 던지는지 확인한 뒤 주입한다.
        const broken = {
            bars: data.bars,
            indicators: null,
        } as unknown as BarsData;
        expect(() => classifyTrend(broken.bars, broken.indicators)).toThrow();

        const brief = await loadSymbolBrief(
            'ODD',
            sources(Promise.resolve(broken))
        );

        expect(brief).toEqual({
            symbol: 'ODD',
            close: null,
            changePercent: null,
            trend: null,
            signals: null,
        });
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('ODD'),
            expect.any(Error)
        );
    });
});
