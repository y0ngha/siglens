// @vitest-environment jsdom

/**
 * 실제 훅·섹션을 렌더해 분기 토글의 중복 요청 방지와 실패 안내를 사용자 흐름으로 확인한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { FinancialsSnapshot } from '@y0ngha/siglens-core';
import { FinancialsStatements } from '../FinancialsStatements';

const { mockGetFinancialsQuarterAction } = vi.hoisted(() => ({
    mockGetFinancialsQuarterAction: vi.fn(),
}));
vi.mock(
    '@/entities/financials-statements/actions/getFinancialsQuarterAction',
    () => ({
        getFinancialsQuarterAction: mockGetFinancialsQuarterAction,
    })
);

const ANNUAL: FinancialsSnapshot = {
    income: [
        {
            fiscalYear: '2024',
            period: 'FY',
            date: '2024-12-31',
            revenue: 1_000_000,
            grossProfit: 600_000,
            operatingIncome: 300_000,
            netIncome: 200_000,
            ebitda: 350_000,
            eps: 1.0,
            epsDiluted: 0.98,
            grossMargin: 60,
            operatingMargin: 30,
            netMargin: 20,
        },
    ],
    balance: [],
    cashFlow: [],
    incomeGrowth: [],
    financialGrowth: [],
    cashFlowGrowth: [],
};

const NOTICE = '분기 재무제표를 불러오지 못해 연간 기준으로 보여 드려요.';

describe('FinancialsStatements — 분기 토글', () => {
    beforeEach(() => {
        mockGetFinancialsQuarterAction.mockReset();
    });

    it('조회 중에 분기를 다시 눌러도 서버 액션은 한 번만 호출된다', async () => {
        mockGetFinancialsQuarterAction.mockReturnValue(
            new Promise<FinancialsSnapshot>(() => undefined)
        );
        render(<FinancialsStatements symbol="AAPL" annualSnapshot={ANNUAL} />);

        const quarter = screen.getByRole('button', { name: '분기' });
        fireEvent.click(quarter);
        fireEvent.click(quarter);
        fireEvent.click(quarter);

        expect(mockGetFinancialsQuarterAction).toHaveBeenCalledTimes(1);
    });

    it('분기 조회가 실패하면 연간으로 되돌리고 안내 문장을 보여 준다', async () => {
        mockGetFinancialsQuarterAction.mockRejectedValue(new Error('network'));
        render(<FinancialsStatements symbol="AAPL" annualSnapshot={ANNUAL} />);
        expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: '분기' }));
        });

        expect(screen.getByText(NOTICE)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '연간' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
    });

    it('연간으로 직접 전환하면 안내가 사라진다', async () => {
        mockGetFinancialsQuarterAction.mockRejectedValue(new Error('network'));
        render(<FinancialsStatements symbol="AAPL" annualSnapshot={ANNUAL} />);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: '분기' }));
        });
        expect(screen.getByText(NOTICE)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '연간' }));

        expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    });
});
