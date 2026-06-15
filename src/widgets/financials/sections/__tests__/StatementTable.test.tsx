import { render, screen } from '@testing-library/react';
import { StatementTable } from '../StatementTable';

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
        // $1B, $2B, $3B compact format
        const cells = screen.getAllByText(/\$\d/);
        expect(cells.length).toBeGreaterThan(0);
    });

    it('formats pct values with percent sign', () => {
        render(<StatementTable {...BASE_PROPS} />);
        // 10% and 20%
        const pctCells = screen.getAllByText(/%/);
        expect(pctCells.length).toBeGreaterThan(0);
    });

    it('formats num values as numbers', () => {
        render(<StatementTable {...BASE_PROPS} />);
        expect(screen.getByText('1.50')).toBeInTheDocument();
        expect(screen.getByText('2.30')).toBeInTheDocument();
        expect(screen.getByText('3.10')).toBeInTheDocument();
    });

    it('renders em-dash for null values', () => {
        render(<StatementTable {...BASE_PROPS} />);
        const dashes = screen.getAllByText('—');
        expect(dashes.length).toBeGreaterThan(0);
    });

    it('applies font-mono tabular-nums to value cells', () => {
        const { container } = render(<StatementTable {...BASE_PROPS} />);
        const tds = container.querySelectorAll('td.font-mono');
        expect(tds.length).toBeGreaterThan(0);
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
            // label + 3 value columns
            expect(row.querySelectorAll('td').length).toBe(4);
        });
    });

    it('applies text-chart-bullish class to positive values', () => {
        const { container } = render(
            <StatementTable
                columns={['2024']}
                rows={[{ labelKo: '매출', values: [500], format: 'num' }]}
            />
        );
        const td = container.querySelector('td.text-chart-bullish');
        expect(td).not.toBeNull();
    });

    it('applies text-chart-bearish class to negative values', () => {
        const { container } = render(
            <StatementTable
                columns={['2024']}
                rows={[{ labelKo: '손실', values: [-200], format: 'num' }]}
            />
        );
        const td = container.querySelector('td.text-chart-bearish');
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
        expect(td?.className).not.toContain('text-chart-bullish');
        expect(td?.className).not.toContain('text-chart-bearish');
    });
});
