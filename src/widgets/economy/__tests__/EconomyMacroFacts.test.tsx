import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EconomySnapshot } from '@y0ngha/siglens-core';

import { EconomyMacroFacts } from '@/widgets/economy/sections/EconomyMacroFacts';

function snap(overrides: Partial<EconomySnapshot> = {}): EconomySnapshot {
    return {
        indicators: [
            {
                name: 'federalFunds',
                latest: { date: '2026-05-01', value: 5.33 },
                previous: null,
                trend: [],
            },
            {
                name: 'CPI',
                latest: { date: '2026-05-01', value: 312.4 },
                previous: null,
                trend: [],
            },
            {
                name: 'unemploymentRate',
                latest: { date: '2026-05-01', value: 3.9 },
                previous: null,
                trend: [],
            },
        ],
        treasury: { date: '2026-06-15', year2: 4.5, year10: 4.7 },
        calendar: [],
        ...overrides,
    };
}

describe('EconomyMacroFacts', () => {
    it('섹션 heading "거시 경제 한눈에"가 렌더된다', () => {
        render(<EconomyMacroFacts snapshot={snap()} />);
        expect(
            screen.getByRole('heading', { name: /거시 경제 한눈에/ })
        ).toBeInTheDocument();
    });

    it('기준금리·국채금리·스프레드를 SSR 텍스트로 렌더한다', () => {
        render(<EconomyMacroFacts snapshot={snap()} />);
        const region = screen.getByRole('region', { name: /거시 경제 한눈에/ });
        expect(region.textContent).toContain('5.33%');
        expect(region.textContent).toContain('4.50%');
        expect(region.textContent).toContain('4.70%');
        // spread = 4.70 - 4.50 = +0.20
        expect(region.textContent).toContain('+0.20%p');
    });

    it('CPI·실업률 문장을 렌더한다', () => {
        render(<EconomyMacroFacts snapshot={snap()} />);
        const region = screen.getByRole('region', { name: /거시 경제 한눈에/ });
        expect(region.textContent).toContain('소비자물가지수');
        expect(region.textContent).toContain('312.4pt');
        expect(region.textContent).toContain('3.9%');
    });

    it('treasury가 null이어도 기준금리만 있으면 렌더 (부분 데이터)', () => {
        render(<EconomyMacroFacts snapshot={snap({ treasury: null })} />);
        expect(
            screen.getByText(/현재 미국 기준금리는 5\.33%입니다/)
        ).toBeInTheDocument();
    });

    it('모든 핵심 지표가 없으면 null 렌더 (섹션 없음)', () => {
        const { container } = render(
            <EconomyMacroFacts
                snapshot={snap({
                    indicators: [],
                    treasury: null,
                })}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('음수 스프레드 (역전 수익률 곡선)를 정확히 렌더한다', () => {
        render(
            <EconomyMacroFacts
                snapshot={snap({
                    treasury: { date: '2026-06-15', year2: 4.8, year10: 4.5 },
                })}
            />
        );
        const region = screen.getByRole('region', { name: /거시 경제 한눈에/ });
        // spread = 4.50 - 4.80 = -0.30
        expect(region.textContent).toContain('-0.30%p');
    });
});
