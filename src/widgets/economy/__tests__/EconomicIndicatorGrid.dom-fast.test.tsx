import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EconomySnapshot } from '@y0ngha/siglens-core';

import { EconomicIndicatorGrid } from '@/widgets/economy/sections/EconomicIndicatorGrid';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

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

    it('전기 대비 변화 — 양수는 + 부호 + 중립 색상(ui-success/danger 없음)', () => {
        render(<EconomicIndicatorGrid snapshot={snap()} />);
        // 3.63 - 3.58 = 0.05
        const badge = screen.getByText(/\+0\.05/);
        expect(badge).toBeInTheDocument();
        // DeltaBadge는 지표 유형과 무관하게 중립 색상을 사용한다
        // (상승이 CPI·실업률 등에서는 부정적 의미여서 green/red 표시가 오해를 유발).
        // 토큰명이 `-text` 짝으로 바뀌었다: 의미 색의 표면 토큰을 텍스트에 쓰면
        // 라이트에서만 4.25~4.43:1로 기준을 밑돈다(다크는 통과해 오래 안 보였다).
        expect(badge).not.toHaveClass('text-ui-success-text');
        expect(badge).not.toHaveClass('text-ui-danger-text');
        expect(badge).toHaveClass('text-secondary-300');
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
        // 음수 스프레드는 위험 색으로 표시한다. 텍스트에는 표면 토큰이 아니라
        // `-text` 짝을 쓴다 — 표면 토큰은 라이트에서 본문 대비 기준을 밑돈다.
        expect(spreadValue).toHaveClass('text-ui-danger-text');
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

    // audit fix item 4: meta.unit이 '천명'/'건' 리터럴이라 /en/economy가
    // `vs. Previous Period +41천명`·`-6000건`을 그대로 찍던 결함. unit이
    // shared.enumLabel.economyUnit 카탈로그 키로 바뀌었으므로 ko 표시 문자열은
    // 그대로 유지되는지(회귀 가드) 여기서 확인한다.
    it('천명/건 단위 지표는 ko에서 기존과 동일한 단위 문자열을 렌더한다', () => {
        render(
            <EconomicIndicatorGrid
                snapshot={snap({
                    indicators: [
                        {
                            name: 'totalNonfarmPayroll',
                            latest: POINT('2026-05-01', 158449),
                            previous: POINT('2026-04-01', 158408),
                            trend: [],
                        },
                        {
                            name: 'initialClaims',
                            latest: POINT('2026-05-01', 220000),
                            previous: POINT('2026-04-01', 226000),
                            trend: [],
                        },
                    ],
                })}
            />
        );
        const payrollValue =
            screen.getByText('158449').closest('div')?.textContent ?? '';
        expect(payrollValue).toContain('천명');
        expect(screen.getByText(/\+41천명/)).toBeInTheDocument();

        const claimsValue =
            screen.getByText('220000').closest('div')?.textContent ?? '';
        expect(claimsValue).toContain('건');
        expect(screen.getByText(/-6000건/)).toBeInTheDocument();
    });

    it('en 로케일에서는 단위가 K/claims로 번역되고 한글이 남지 않는다', () => {
        renderWithIntl(
            <EconomicIndicatorGrid
                snapshot={snap({
                    indicators: [
                        {
                            name: 'totalNonfarmPayroll',
                            latest: POINT('2026-05-01', 158449),
                            previous: POINT('2026-04-01', 158408),
                            trend: [],
                        },
                        {
                            name: 'initialClaims',
                            latest: POINT('2026-05-01', 220000),
                            previous: POINT('2026-04-01', 226000),
                            trend: [],
                        },
                    ],
                })}
            />,
            { locale: 'en' }
        );

        // meta.label/tooltip(경제지표 이름·설명)은 이번 마이그레이션 범위 밖이라
        // 여전히 ko 고정이다 — 그래서 컨테이너 전체가 아니라 단위가 실제로 찍히는
        // 값 줄(값+단위 span)과 DeltaBadge 문장만 좁혀서 한글 없음을 확인한다.
        const payrollValue =
            screen.getByText('158449').closest('div')?.textContent ?? '';
        expect(payrollValue).toBe('158449K');
        expect(payrollValue).not.toMatch(/[가-힣]/);
        expect(
            screen.getByText(/vs\. Previous Period \+41K/)
        ).toBeInTheDocument();

        const claimsValue =
            screen.getByText('220000').closest('div')?.textContent ?? '';
        expect(claimsValue).toBe('220000 claims');
        expect(claimsValue).not.toMatch(/[가-힣]/);
        expect(
            screen.getByText(/vs\. Previous Period -6000 claims/)
        ).toBeInTheDocument();
    });
});
