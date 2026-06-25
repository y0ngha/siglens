// @vitest-environment jsdom
/**
 * Unit tests for `StrikeBarSrTable` — 공용 sr-only 접근성 테이블.
 *
 * caption / headers / rows props가 올바른 시맨틱 구조로 렌더되는지 검증한다.
 */
import { render, screen } from '@testing-library/react';
import { StrikeBarSrTable } from '@/widgets/options/ui/StrikeBarSrTable';

const CAPTION = 'Strike별 미결제약정';
const HEADERS = ['Strike', 'Call OI', 'Put OI'];
const ROWS = [
    { key: 140, cells: ['$140', '500', '300'] },
    { key: 150, cells: ['$150', '1000', '800'] },
];

describe('StrikeBarSrTable', () => {
    it('caption이 렌더된다', () => {
        render(
            <StrikeBarSrTable caption={CAPTION} headers={HEADERS} rows={ROWS} />
        );
        expect(
            screen.getByText(CAPTION, { selector: 'caption' })
        ).toBeInTheDocument();
    });

    it('헤더가 scope="col" th 요소로 렌더된다', () => {
        render(
            <StrikeBarSrTable caption={CAPTION} headers={HEADERS} rows={ROWS} />
        );
        const thElements = screen.getAllByRole('columnheader', {
            hidden: true,
        });
        expect(thElements).toHaveLength(HEADERS.length);
        HEADERS.forEach((header, i) => {
            expect(thElements[i]).toHaveTextContent(header);
            expect(thElements[i]).toHaveAttribute('scope', 'col');
        });
    });

    it('rows 수만큼 tbody 행이 렌더된다', () => {
        render(
            <StrikeBarSrTable caption={CAPTION} headers={HEADERS} rows={ROWS} />
        );
        const table = screen.getByRole('table', { hidden: true });
        const tbody = table.querySelector('tbody');
        const trElements = tbody?.querySelectorAll('tr');
        expect(trElements).toHaveLength(ROWS.length);
    });

    it('각 행의 셀 수가 cells 배열 길이와 일치한다', () => {
        render(
            <StrikeBarSrTable caption={CAPTION} headers={HEADERS} rows={ROWS} />
        );
        const table = screen.getByRole('table', { hidden: true });
        const allRows = table.querySelectorAll('tbody tr');
        allRows.forEach((tr, i) => {
            const cells = tr.querySelectorAll('td');
            expect(cells).toHaveLength(ROWS[i]!.cells.length);
        });
    });

    it('rows가 빈 배열이면 tbody에 행이 없다', () => {
        render(
            <StrikeBarSrTable caption={CAPTION} headers={HEADERS} rows={[]} />
        );
        const table = screen.getByRole('table', { hidden: true });
        const tbody = table.querySelector('tbody');
        expect(tbody?.querySelectorAll('tr')).toHaveLength(0);
    });

    it('전체 컨테이너가 sr-only 클래스를 가진다', () => {
        const { container } = render(
            <StrikeBarSrTable caption={CAPTION} headers={HEADERS} rows={ROWS} />
        );
        const wrapper = container.firstElementChild;
        expect(wrapper).toHaveClass('sr-only');
    });
});
