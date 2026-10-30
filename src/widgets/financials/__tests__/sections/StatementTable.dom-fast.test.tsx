import { render, screen } from '@testing-library/react';
import { StatementTable } from '@/widgets/financials/sections/StatementTable';
import { withLocale } from '@/shared/test-utils/intlRenderWrapper';

const BASE_PROPS = {
    columns: ['2022', '2023', '2024'],
    rows: [
        {
            labelKo: '매출',
            values: [1_000_000_000, 2_000_000_000, 3_000_000_000],
            format: 'usd' as const,
        },
        {
            labelKo: '순이익률',
            values: [0.1, 0.2, null],
            format: 'pct' as const,
        },
        {
            labelKo: '주당순이익',
            values: [1.5, 2.3, 3.1],
            format: 'num' as const,
        },
    ],
};

describe('StatementTable', () => {
    it('renders a table element', () => {
        render(<StatementTable {...BASE_PROPS} />);
        expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('renders caption when provided', () => {
        render(<StatementTable {...BASE_PROPS} caption="손익계산서" />);
        expect(screen.getByText('손익계산서')).toBeInTheDocument();
    });

    it('does not render caption element when omitted', () => {
        const { container } = render(<StatementTable {...BASE_PROPS} />);
        expect(container.querySelector('caption')).toBeNull();
    });

    it('renders year column headers', () => {
        render(<StatementTable {...BASE_PROPS} />);
        expect(screen.getByText('2022')).toBeInTheDocument();
        expect(screen.getByText('2023')).toBeInTheDocument();
        expect(screen.getByText('2024')).toBeInTheDocument();
    });

    it('renders row labels', () => {
        render(<StatementTable {...BASE_PROPS} />);
        expect(screen.getByText('매출')).toBeInTheDocument();
        expect(screen.getByText('순이익률')).toBeInTheDocument();
        expect(screen.getByText('주당순이익')).toBeInTheDocument();
    });

    it('formats usd values as compact currency', () => {
        render(<StatementTable {...BASE_PROPS} />);
        // $1B, $2B, $3B compact format — usd row has exactly 3 values
        expect(screen.getAllByText(/\$\d/)).toHaveLength(3);
    });

    it('formats pct values with percent sign', () => {
        render(<StatementTable {...BASE_PROPS} />);
        // 10% and 20% (third value is null → "-", not %)
        expect(screen.getAllByText(/%/)).toHaveLength(2);
    });

    it('formats num values as numbers', () => {
        render(<StatementTable {...BASE_PROPS} />);
        expect(screen.getByText('1.50')).toBeInTheDocument();
        expect(screen.getByText('2.30')).toBeInTheDocument();
        expect(screen.getByText('3.10')).toBeInTheDocument();
    });

    it('renders the "-" placeholder for null values', () => {
        render(<StatementTable {...BASE_PROPS} />);
        // only 순이익률 row has a single null value
        expect(screen.getAllByText('-')).toHaveLength(1);
    });

    it('applies font-mono tabular-nums to value cells', () => {
        const { container } = render(<StatementTable {...BASE_PROPS} />);
        // 3 rows × 3 value columns = 9 mono value cells
        expect(container.querySelectorAll('td.font-mono')).toHaveLength(9);
    });

    it('renders tooltip content when provided', () => {
        const rowsWithTooltip = [
            {
                labelKo: '매출',
                tooltip: <span>총 매출액</span>,
                values: [100],
                format: 'usd' as const,
            },
        ];
        render(<StatementTable columns={['2024']} rows={rowsWithTooltip} />);
        expect(screen.getByText('총 매출액')).toBeInTheDocument();
    });

    it('renders correct number of data columns per row', () => {
        const { container } = render(<StatementTable {...BASE_PROPS} />);
        const rows = container.querySelectorAll('tbody tr');
        rows.forEach(row => {
            // 1 th[scope=row] label + 3 value td cells
            expect(row.querySelectorAll('th[scope="row"]').length).toBe(1);
            expect(row.querySelectorAll('td').length).toBe(3);
        });
    });

    it('applies text-ui-success-text class to positive values (colorize default)', () => {
        const { container } = render(
            <StatementTable
                columns={['2024']}
                rows={[{ labelKo: '매출', values: [500], format: 'num' }]}
            />
        );
        const td = container.querySelector('td.text-ui-success-text');
        expect(td).not.toBeNull();
    });

    it('applies text-ui-danger-text class to negative values (colorize default)', () => {
        const { container } = render(
            <StatementTable
                columns={['2024']}
                rows={[{ labelKo: '손실', values: [-200], format: 'num' }]}
            />
        );
        const td = container.querySelector('td.text-ui-danger-text');
        expect(td).not.toBeNull();
    });

    it('applies no color class (default) to zero values', () => {
        const { container } = render(
            <StatementTable
                columns={['2024']}
                rows={[{ labelKo: '손익분기', values: [0], format: 'num' }]}
            />
        );
        const td = container.querySelector('td.font-mono');
        expect(td).not.toBeNull();
        expect(td?.className).not.toContain('text-ui-success-text');
        expect(td?.className).not.toContain('text-ui-danger-text');
    });

    it('applies text-secondary-300 to non-null values when colorize=false', () => {
        const { container } = render(
            <StatementTable
                columns={['2024']}
                rows={[
                    {
                        labelKo: '총자산',
                        values: [1_000_000],
                        format: 'usd',
                        colorize: false,
                    },
                ]}
            />
        );
        const td = container.querySelector('td.text-secondary-300');
        expect(td).not.toBeNull();
        expect(td?.className).not.toContain('text-ui-success-text');
        expect(td?.className).not.toContain('text-ui-danger-text');
    });

    // 금액 단위는 로케일을 따른다 — ko 외 로케일에 `억`·`조`가 나오면 로케일 배선이 끊긴 것이다.
    it.each(['en', 'ja', 'zh'] as const)(
        '%s: 금액 셀에 한국어 단위(억/조)가 나오지 않는다',
        locale => {
            const { container } = render(
                withLocale(
                    <StatementTable
                        columns={['2024']}
                        rows={[
                            {
                                labelKo: '매출',
                                values: [111_180_000_000],
                                format: 'usd',
                            },
                        ]}
                    />,
                    locale
                )
            );
            const td = container.querySelector('td.font-mono');
            expect(td?.textContent).toBeTruthy();
            expect(td?.textContent).not.toMatch(/[억조]/);
        }
    );

    it('ko: 금액 셀은 한국어 단위를 유지한다', () => {
        const { container } = render(
            <StatementTable
                columns={['2024']}
                rows={[
                    {
                        labelKo: '매출',
                        values: [111_180_000_000],
                        format: 'usd',
                    },
                ]}
            />
        );
        expect(container.querySelector('td.font-mono')?.textContent).toMatch(
            /억/
        );
    });
});

describe('StatementTable — 주당 금액(EPS) 표기', () => {
    const EPS_ROW = (values: (number | null)[]) => [
        { labelKo: 'EPS', values, format: 'perShare' as const },
    ];

    it('원화 EPS는 통화 기호와 천 단위 구분자를 붙이고 소수를 쓰지 않는다', () => {
        render(
            <StatementTable
                columns={['2024']}
                rows={EPS_ROW([4950])}
                currency="KRW"
            />
        );
        expect(screen.getByText('₩4,950')).toBeInTheDocument();
        expect(screen.queryByText('4950.00')).not.toBeInTheDocument();
    });

    it('달러 EPS는 소수 둘째 자리까지 표기한다', () => {
        render(<StatementTable columns={['2024']} rows={EPS_ROW([6.1])} />);
        expect(screen.getByText('US$6.10')).toBeInTheDocument();
    });

    it('보고 통화가 달러가 아니면 EPS에도 그 통화 코드를 붙인다', () => {
        render(
            <StatementTable
                columns={['2024']}
                rows={EPS_ROW([66.1])}
                currency="TWD"
            />
        );
        expect(screen.getByText(/TWD.*66\.10/)).toBeInTheDocument();
    });

    it('단위 없는 num 행은 기존대로 소수 둘째 자리 숫자다', () => {
        render(
            <StatementTable
                columns={['2024']}
                rows={[{ labelKo: '유동비율', values: [1.5], format: 'num' }]}
                currency="KRW"
            />
        );
        expect(screen.getByText('1.50')).toBeInTheDocument();
    });
});

describe('StatementTable — 보고 통화 금액 표기', () => {
    it('USD·KRW 밖의 통화는 금액에 통화 코드를 붙인다', () => {
        render(
            <StatementTable
                columns={['2024']}
                rows={[
                    {
                        labelKo: '매출',
                        values: [2_000_000_000],
                        format: 'usd' as const,
                    },
                ]}
                currency="TWD"
            />
        );
        expect(screen.getByText(/TWD/)).toBeInTheDocument();
        expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });
});
