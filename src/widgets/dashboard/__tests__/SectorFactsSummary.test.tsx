import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectorFactsSummary } from '@/widgets/dashboard/SectorFactsSummary';
import type {
    SectorSignalsResult,
    StockSignalResult,
} from '@y0ngha/siglens-core';

function makeStock(
    symbol: string,
    sectorSymbol: string,
    direction: 'bullish' | 'bearish' = 'bullish'
): StockSignalResult {
    return {
        symbol,
        koreanName: `${symbol}-KR`,
        sectorSymbol,
        price: 100,
        changePercent: 1.5,
        trend: 'uptrend',
        signals: [
            {
                type: 'golden_cross',
                direction,
                phase: 'confirmed',
                detectedAt: 0,
            },
        ],
    };
}

function makeResult(stocks: StockSignalResult[]): SectorSignalsResult {
    return { computedAt: '2026-06-04T00:00:00Z', stocks };
}

describe('SectorFactsSummary', () => {
    it('(Happy) 빈 stocks → 섹션 + 빈-신호 안내 텍스트를 렌더한다 (크롤 텍스트 보장)', () => {
        render(<SectorFactsSummary data={makeResult([])} />);
        expect(
            screen.getByRole('region', { name: '섹터별 신호 요약' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/현재 기술적 신호가 잡힌 종목이 없습니다/)
        ).toBeInTheDocument();
    });

    it('(Happy) 섹터별 신호 요약 섹션을 렌더한다', () => {
        render(
            <SectorFactsSummary
                data={makeResult([makeStock('AAPL', 'XLK', 'bullish')])}
            />
        );
        expect(
            screen.getByRole('region', { name: '섹터별 신호 요약' })
        ).toBeInTheDocument();
    });

    it('(Happy) h2 heading이 있다', () => {
        render(
            <SectorFactsSummary
                data={makeResult([makeStock('AAPL', 'XLK', 'bullish')])}
            />
        );
        expect(
            screen.getByRole('heading', { name: /섹터별 신호 모아보기/ })
        ).toBeInTheDocument();
    });

    it('(Happy) 섹터 심볼이 렌더된다', () => {
        render(
            <SectorFactsSummary
                data={makeResult([makeStock('AAPL', 'XLK', 'bullish')])}
            />
        );
        expect(screen.getByText('XLK')).toBeInTheDocument();
    });

    it('(Happy) 상승 신호 카운트 텍스트가 렌더된다', () => {
        const stocks = [
            makeStock('AAPL', 'XLK', 'bullish'),
            makeStock('MSFT', 'XLK', 'bullish'),
        ];
        render(<SectorFactsSummary data={makeResult(stocks)} />);
        expect(screen.getByText(/상승 신호 2종목/)).toBeInTheDocument();
    });

    it('(Happy) 하락 신호 카운트 텍스트가 렌더된다', () => {
        render(
            <SectorFactsSummary
                data={makeResult([makeStock('NVDA', 'XLK', 'bearish')])}
            />
        );
        expect(screen.getByText(/하락 신호 1종목/)).toBeInTheDocument();
    });

    it('(Happy) 대표 심볼이 렌더된다', () => {
        render(
            <SectorFactsSummary
                data={makeResult([makeStock('AAPL', 'XLK', 'bullish')])}
            />
        );
        expect(screen.getByText(/AAPL/)).toBeInTheDocument();
    });

    it('(Happy) 여러 섹터가 모두 렌더된다', () => {
        const stocks = [
            makeStock('AAPL', 'XLK', 'bullish'),
            makeStock('JPM', 'XLF', 'bullish'),
        ];
        render(<SectorFactsSummary data={makeResult(stocks)} />);
        expect(screen.getByText('XLK')).toBeInTheDocument();
        expect(screen.getByText('XLF')).toBeInTheDocument();
    });

    it('(Worst) signals가 빈 배열인 종목만 있으면 → 섹션 렌더되나 카운트 0', () => {
        const stock: StockSignalResult = {
            symbol: 'AAPL',
            koreanName: '애플',
            sectorSymbol: 'XLK',
            price: 100,
            changePercent: 0,
            trend: 'sideways',
            signals: [],
        };
        render(<SectorFactsSummary data={makeResult([stock])} />);
        // The section is still rendered (stocks.length > 0), but counts are 0
        expect(screen.getByText('XLK')).toBeInTheDocument();
        expect(screen.getByText(/상승 신호 0종목/)).toBeInTheDocument();
    });

    it('(Worst) 완전 빈 SectorSignalsResult → 빈-신호 안내 텍스트를 렌더한다', () => {
        render(<SectorFactsSummary data={{ computedAt: '', stocks: [] }} />);
        expect(
            screen.getByText(/현재 기술적 신호가 잡힌 종목이 없습니다/)
        ).toBeInTheDocument();
    });

    it('(Worst) 심볼이 없는 경우(topSymbols=[]) → 괄호 텍스트 없음', () => {
        const stock: StockSignalResult = {
            symbol: 'AAPL',
            koreanName: '애플',
            sectorSymbol: 'XLK',
            price: 100,
            changePercent: 0,
            trend: 'sideways',
            signals: [], // no signals → no direction → not in topSymbols
        };
        render(<SectorFactsSummary data={makeResult([stock])} />);
        // No parenthesized symbol list
        expect(screen.queryByText(/\(AAPL\)/)).not.toBeInTheDocument();
    });
});
