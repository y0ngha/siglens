import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EconomySnapshot } from '@y0ngha/siglens-core';

import { EconomicIndicatorGrid } from '@/widgets/economy/sections/EconomicIndicatorGrid';

const POINT = (date: string, value: number) => ({ date, value });

function snap(overrides: Partial<EconomySnapshot> = {}): EconomySnapshot {
    return {
        indicators: [
            {
                name: 'federalFunds',
                latest: POINT('2026-05-01', 3.63),
                previous: POINT('2026-04-01', 3.58),
                trend: [],
            },
            {
                name: 'CPI',
                latest: POINT('2026-05-01', 333.9),
                previous: null,
                trend: [],
            },
            // latest=null인 지표는 omit돼야 함
            { name: 'GDP', latest: null, previous: null, trend: [] },
        ],
        treasury: { date: '2026-06-15', year2: 4.07, year10: 4.47 },
        calendar: [],
        ...overrides,
    };
}

describe('EconomicIndicatorGrid', () => {
    it('카테고리 섹션 헤더 4종 렌더', () => {
        render(<EconomicIndicatorGrid snapshot={snap()} />);
        expect(screen.getByText('금리')).toBeInTheDocument();
        expect(screen.getByText('물가')).toBeInTheDocument();
        // 성장 섹션은 GDP만 등록돼있는데 latest=null이라 omit → 헤더도 안 렌더(빈 섹션 0 카드)
        expect(screen.queryByText('성장·경기')).not.toBeInTheDocument();
    });

    it('값 있는 지표는 카드로 렌더 (라벨 + 값 + 단위)', () => {
        render(<EconomicIndicatorGrid snapshot={snap()} />);
        expect(screen.getByText('연방기금금리')).toBeInTheDocument();
        expect(screen.getByText('3.63')).toBeInTheDocument();
        expect(screen.getByText('소비자물가지수')).toBeInTheDocument();
    });

    it('latest=null인 지표는 omit (카드 미렌더)', () => {
        render(<EconomicIndicatorGrid snapshot={snap()} />);
        expect(screen.queryByText('GDP')).not.toBeInTheDocument();
    });

    it('전기 대비 변화 — 양수는 + 부호', () => {
        render(<EconomicIndicatorGrid snapshot={snap()} />);
        // 3.63 - 3.58 = 0.05
        expect(screen.getByText(/\+0\.05/)).toBeInTheDocument();
    });

    it('금리 섹션은 treasury 카드 3종(2Y·10Y·2s10s) 렌더', () => {
        render(<EconomicIndicatorGrid snapshot={snap()} />);
        expect(screen.getByText('2년물 국채')).toBeInTheDocument();
        expect(screen.getByText('10년물 국채')).toBeInTheDocument();
        expect(screen.getByText('2s10s 스프레드')).toBeInTheDocument();
    });

    it('2s10s 스프레드 값 표시 (10Y - 2Y)', () => {
        render(<EconomicIndicatorGrid snapshot={snap()} />);
        // 4.47 - 4.07 = 0.40
        expect(screen.getByText(/\+0\.40/)).toBeInTheDocument();
    });

    it('treasury가 null이면 금리 섹션의 treasury 카드들 미렌더', () => {
        render(<EconomicIndicatorGrid snapshot={snap({ treasury: null })} />);
        expect(screen.queryByText('2년물 국채')).not.toBeInTheDocument();
        expect(screen.queryByText('2s10s 스프레드')).not.toBeInTheDocument();
    });

    it('2s10s 스프레드가 음수일 때 - 부호 + ui-danger 색상', () => {
        render(
            <EconomicIndicatorGrid
                snapshot={snap({
                    treasury: { date: '2026-06-15', year2: 4.5, year10: 4.3 },
                })}
            />
        );
        // spread = 4.30 - 4.50 = -0.20
        const spreadValue = screen.getByText(/-0\.20/);
        expect(spreadValue).toBeInTheDocument();
        // The value element carries text-ui-danger class (negative spread)
        expect(spreadValue).toHaveClass('text-ui-danger');
    });

    it('전기 대비 변화가 precision 미만일 때 "전기 대비 변화 없음" 표시', () => {
        // delta = 3.633 - 3.631 = 0.002; toFixed(2) = "0.00" → parsed as 0 → "변화 없음"
        render(
            <EconomicIndicatorGrid
                snapshot={snap({
                    indicators: [
                        {
                            name: 'federalFunds',
                            latest: { date: '2026-05-01', value: 3.633 },
                            previous: { date: '2026-04-01', value: 3.631 },
                            trend: [],
                        },
                    ],
                })}
            />
        );
        expect(screen.getByText(/전기 대비 변화 없음/)).toBeInTheDocument();
    });
});
