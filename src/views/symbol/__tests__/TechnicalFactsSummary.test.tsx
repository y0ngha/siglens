import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    RSI_OVERBOUGHT_LEVEL,
    RSI_OVERSOLD_LEVEL,
    type Bar,
    type IndicatorResult,
} from '@y0ngha/siglens-core';
import { TechnicalFactsSummary } from '../TechnicalFactsSummary';

function bar(close: number, high = close, low = close): Bar {
    return { time: 0, open: close, high, low, close, volume: 100 };
}
const emptyIndicators = {
    macd: [],
    bollinger: [],
    dmi: [],
    stochastic: [],
    stochRsi: [],
    rsi: [],
    cci: [],
    vwap: [],
    ma: {},
    ema: {},
    volumeProfile: null,
    ichimoku: [],
    atr: [],
    obv: [],
    parabolicSar: [],
    williamsR: [],
    supertrend: [],
    mfi: [],
    keltnerChannel: [],
    cmf: [],
    donchianChannel: [],
    buySellVolume: [],
    smc: {},
    squeezeMomentum: [],
} as unknown as IndicatorResult;

describe('TechnicalFactsSummary', () => {
    it('현재가와 RSI를 텍스트로 렌더한다', () => {
        render(
            <TechnicalFactsSummary
                symbol="AAPL"
                bars={[bar(100), bar(110)]}
                indicators={{ ...emptyIndicators, rsi: [null, 72] }}
            />
        );
        expect(screen.getByText(/현재가/)).toBeInTheDocument();
        expect(screen.getByText(/\$110/)).toBeInTheDocument();
        expect(screen.getByText(/72/)).toBeInTheDocument();
        expect(screen.getByText(/과매수/)).toBeInTheDocument();
    });

    it('RSI가 30 이하이면 과매도로 렌더한다', () => {
        render(
            <TechnicalFactsSummary
                symbol="AAPL"
                bars={[bar(100), bar(110)]}
                indicators={{ ...emptyIndicators, rsi: [null, 25] }}
            />
        );
        expect(screen.getByText(/과매도/)).toBeInTheDocument();
    });

    it('RSI가 정확히 과매수 임계값이면 과매수로 렌더한다 (경계값)', () => {
        render(
            <TechnicalFactsSummary
                symbol="AAPL"
                bars={[bar(100), bar(110)]}
                indicators={{
                    ...emptyIndicators,
                    rsi: [null, RSI_OVERBOUGHT_LEVEL],
                }}
            />
        );
        expect(screen.getByText(/과매수/)).toBeInTheDocument();
    });

    it('RSI가 정확히 과매도 임계값이면 과매도로 렌더한다 (경계값)', () => {
        render(
            <TechnicalFactsSummary
                symbol="AAPL"
                bars={[bar(100), bar(110)]}
                indicators={{
                    ...emptyIndicators,
                    rsi: [null, RSI_OVERSOLD_LEVEL],
                }}
            />
        );
        expect(screen.getByText(/과매도/)).toBeInTheDocument();
    });

    it('RSI가 중간 구간이면 중립으로 렌더한다', () => {
        render(
            <TechnicalFactsSummary
                symbol="AAPL"
                bars={[bar(100), bar(110)]}
                indicators={{ ...emptyIndicators, rsi: [null, 50] }}
            />
        );
        expect(screen.getByText(/중립/)).toBeInTheDocument();
    });

    it('MACD histogram이 양수이면 MACD 모멘텀을 상승으로 렌더한다', () => {
        render(
            <TechnicalFactsSummary
                symbol="AAPL"
                bars={[bar(100), bar(110)]}
                indicators={{
                    ...emptyIndicators,
                    macd: [{ macd: 1, signal: 0.5, histogram: 0.3 }],
                }}
            />
        );
        expect(screen.getByText(/MACD 모멘텀/)).toBeInTheDocument();
        expect(screen.getByText(/상승/)).toBeInTheDocument();
    });

    it('MACD histogram이 음수이면 하락을 렌더한다', () => {
        render(
            <TechnicalFactsSummary
                symbol="AAPL"
                bars={[bar(100), bar(110)]}
                indicators={{
                    ...emptyIndicators,
                    macd: [{ macd: -1, signal: -0.5, histogram: -0.3 }],
                }}
            />
        );
        expect(screen.getByText(/MACD 모멘텀/)).toBeInTheDocument();
        expect(screen.getByText(/하락/)).toBeInTheDocument();
    });

    it('MACD histogram이 0이면 상승으로 렌더한다 (경계값)', () => {
        render(
            <TechnicalFactsSummary
                symbol="AAPL"
                bars={[bar(100), bar(110)]}
                indicators={{
                    ...emptyIndicators,
                    macd: [{ macd: 0, signal: 0, histogram: 0 }],
                }}
            />
        );
        expect(screen.getByText(/MACD 모멘텀/)).toBeInTheDocument();
        expect(screen.getByText(/상승/)).toBeInTheDocument();
    });

    it('데이터 부족 시 아무것도 렌더하지 않는다', () => {
        const { container } = render(
            <TechnicalFactsSummary
                symbol="AAPL"
                bars={[bar(100)]}
                indicators={emptyIndicators}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('marketProfile=crypto + sub-cent 가격은 동적 자릿수로 렌더된다(2dp로 납작해지지 않는다)', () => {
        // 0.058158 → dynamicDecimals: leadingZeros=1, digits=1+4=5 → "$0.05816" (5dp)
        render(
            <TechnicalFactsSummary
                symbol="BTCUSD"
                bars={[bar(0.05), bar(0.058158)]}
                indicators={emptyIndicators}
                marketProfile="crypto"
            />
        );
        const priceText =
            screen.getByText(/현재가/).closest('div')?.textContent ?? '';
        // 2dp로 반올림하면 "$0.06" — 이보다 소수점이 많아야 한다.
        expect(priceText).not.toMatch(/\$0\.06\b/);
        // 실제 정밀도(5자리 이상) 확인 — 최소 3자리 이상 표시.
        expect(priceText).toMatch(/\$0\.0\d{2,}/);
    });
});
