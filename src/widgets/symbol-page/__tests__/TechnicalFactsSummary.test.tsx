import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
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

    it('RSI가 정확히 70이면 과매수로 렌더한다 (경계값)', () => {
        render(
            <TechnicalFactsSummary
                symbol="AAPL"
                bars={[bar(100), bar(110)]}
                indicators={{ ...emptyIndicators, rsi: [null, 70] }}
            />
        );
        expect(screen.getByText(/과매수/)).toBeInTheDocument();
    });

    it('RSI가 정확히 30이면 과매도로 렌더한다 (경계값)', () => {
        render(
            <TechnicalFactsSummary
                symbol="AAPL"
                bars={[bar(100), bar(110)]}
                indicators={{ ...emptyIndicators, rsi: [null, 30] }}
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
});
