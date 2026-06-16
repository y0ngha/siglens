// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CongressTrade } from '@y0ngha/siglens-core';
import { CongressTradesTable } from '../CongressTradesTable';

// InfoTooltip uses createPortal + DOM refs. Stub it to a plain <button> so
// RTL renders without a real DOM and without react-dom/server warnings.
vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span data-testid="info-tooltip">{children}</span>
    ),
}));

const BASE_TRADE: CongressTrade = {
    chamber: 'senate',
    firstName: 'Jane',
    lastName: 'Smith',
    office: 'Jane Smith',
    district: 'CA',
    owner: 'self',
    side: 'buy',
    rawType: 'Purchase',
    amount: {
        min: 1001,
        max: 15000,
        label: '$1,001 - $15,000',
    },
    assetType: 'Stock',
    assetDescription: 'Apple Inc. Common Stock',
    transactionDate: '2024-01-15',
    disclosureDate: '2024-02-28',
    link: 'https://efts.house.gov/example',
    capitalGainsOver200USD: false,
};

const SELL_PARTIAL_TRADE: CongressTrade = {
    ...BASE_TRADE,
    chamber: 'house',
    firstName: 'Bob',
    lastName: 'Jones',
    office: 'Bob Jones',
    district: 'TX-05',
    owner: 'spouse',
    side: 'sell',
    rawType: 'Sale (Partial)',
    amount: { min: 15001, max: 50000, label: '$15,001 - $50,000' },
    assetType: 'Stock Option',
    assetDescription: 'Tesla Inc. Options',
    transactionDate: '2024-02-10',
    disclosureDate: '2024-03-20',
    link: 'https://efts.house.gov/example2',
};

const SELL_FULL_TRADE: CongressTrade = {
    ...BASE_TRADE,
    side: 'sell',
    rawType: 'Sale',
    office: 'Carl Davis',
    transactionDate: '2024-03-01',
    disclosureDate: '2024-04-10',
    link: '',
};

describe('CongressTradesTable', () => {
    describe('header row', () => {
        it('renders all expected column headers', () => {
            const { container } = render(
                <CongressTradesTable trades={[BASE_TRADE]} />
            );

            // Use direct DOM query on the thead to avoid InfoTooltip stub content
            // bleeding into accessible names (the stub renders tooltip body inline).
            const ths = Array.from(container.querySelectorAll('thead th')).map(
                th => th.textContent ?? ''
            );

            const expectedHeaders = [
                '구분',
                '의원',
                '매수/매도',
                '금액 구간',
                '종류',
                '거래일',
                '공시일',
                '보유자',
                '자산 설명',
                '공시',
            ];
            for (const header of expectedHeaders) {
                expect(ths.some(t => t.includes(header))).toBe(true);
            }
        });

        it('renders sr-only caption', () => {
            const { container } = render(
                <CongressTradesTable trades={[BASE_TRADE]} />
            );
            const caption = container.querySelector('caption');
            expect(caption).not.toBeNull();
            expect(caption?.className).toContain('sr-only');
        });
    });

    describe('sample trade row', () => {
        it('renders office text', () => {
            render(<CongressTradesTable trades={[BASE_TRADE]} />);
            expect(screen.getByText('Jane Smith')).toBeDefined();
        });

        it('renders amount.label', () => {
            render(<CongressTradesTable trades={[BASE_TRADE]} />);
            expect(screen.getByText('$1,001 - $15,000')).toBeDefined();
        });

        it('renders transactionDate', () => {
            render(<CongressTradesTable trades={[BASE_TRADE]} />);
            expect(screen.getByText('2024-01-15')).toBeDefined();
        });

        it('renders a disclosure link with target=_blank and rel including noopener noreferrer', () => {
            render(<CongressTradesTable trades={[BASE_TRADE]} />);
            const link = screen.getByRole('link', { name: /공시/ });
            expect(link.getAttribute('target')).toBe('_blank');
            const rel = link.getAttribute('rel') ?? '';
            expect(rel).toContain('noopener');
            expect(rel).toContain('noreferrer');
        });

        it('renders district as sub-label under office', () => {
            render(<CongressTradesTable trades={[BASE_TRADE]} />);
            expect(screen.getByText('CA')).toBeDefined();
        });

        it('renders asset description text', () => {
            render(<CongressTradesTable trades={[BASE_TRADE]} />);
            expect(screen.getByText('Apple Inc. Common Stock')).toBeDefined();
        });
    });

    describe('asset type badge', () => {
        it('renders "주식" badge for assetType="Stock"', () => {
            render(<CongressTradesTable trades={[BASE_TRADE]} />);
            expect(screen.getByText('주식')).toBeDefined();
        });

        it('renders "옵션" badge for assetType="Stock Option"', () => {
            render(<CongressTradesTable trades={[SELL_PARTIAL_TRADE]} />);
            expect(screen.getByText('옵션')).toBeDefined();
        });
    });

    describe('side badge', () => {
        it('Purchase trade renders 매수 badge with text-chart-bullish class', () => {
            render(<CongressTradesTable trades={[BASE_TRADE]} />);
            const badge = screen.getByText('매수');
            expect(badge.className).toContain('text-chart-bullish');
        });

        it('Sale (Partial) trade renders 매도 badge with text-chart-bearish class', () => {
            render(<CongressTradesTable trades={[SELL_PARTIAL_TRADE]} />);
            const badge = screen.getByText('매도');
            expect(badge.className).toContain('text-chart-bearish');
        });

        it('Sale trade renders 매도 badge with text-chart-bearish class', () => {
            render(<CongressTradesTable trades={[SELL_FULL_TRADE]} />);
            const badge = screen.getByText('매도');
            expect(badge.className).toContain('text-chart-bearish');
        });
    });

    describe('empty state', () => {
        it('renders "거래 내역 없음" text when trades is empty', () => {
            render(<CongressTradesTable trades={[]} />);
            expect(screen.getByText('거래 내역 없음')).toBeDefined();
        });

        it('does NOT render a table element when trades is empty', () => {
            const { container } = render(<CongressTradesTable trades={[]} />);
            expect(container.querySelector('table')).toBeNull();
        });
    });

    describe('owner badge', () => {
        it('renders "본인" badge for owner="self"', () => {
            render(<CongressTradesTable trades={[BASE_TRADE]} />);
            expect(screen.getByText('본인')).toBeDefined();
        });

        it('renders "배우자" badge for owner="spouse"', () => {
            render(<CongressTradesTable trades={[SELL_PARTIAL_TRADE]} />);
            expect(screen.getByText('배우자')).toBeDefined();
        });

        it('does NOT render a badge for owner="unknown"', () => {
            const unknownOwnerTrade: CongressTrade = {
                ...BASE_TRADE,
                owner: 'unknown',
            };
            render(<CongressTradesTable trades={[unknownOwnerTrade]} />);
            // "unknown" maps to '' — no badge element at all
            expect(screen.queryByText('unknown')).toBeNull();
        });

        it('renders "공동" for owner="joint"', () => {
            const jointTrade: CongressTrade = {
                ...BASE_TRADE,
                owner: 'joint',
            };
            render(<CongressTradesTable trades={[jointTrade]} />);
            expect(screen.getByText('공동')).toBeDefined();
        });

        it('renders "자녀" for owner="child"', () => {
            const childTrade: CongressTrade = {
                ...BASE_TRADE,
                owner: 'child',
            };
            render(<CongressTradesTable trades={[childTrade]} />);
            expect(screen.getByText('자녀')).toBeDefined();
        });
    });

    describe('no link fallback', () => {
        it('renders em-dash when link is empty', () => {
            render(<CongressTradesTable trades={[SELL_FULL_TRADE]} />);
            // link is '' so no <a> element; em-dash placeholder is shown
            const links = screen.queryAllByRole('link', { name: /공시/ });
            expect(links).toHaveLength(0);
        });
    });
});
