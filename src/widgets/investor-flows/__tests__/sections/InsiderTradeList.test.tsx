// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { InsiderTradeList } from '../../sections/InsiderTradeList';
import { buildInsiderTable, MAX_INSIDER_ROWS } from '../../utils/insider';
import { makeTransaction } from '../fixtures/flowsFixtures';

const WINDOW = { days: 90, from: '2026-07-18', to: '2026-10-16' };

function renderList(transactions: ReturnType<typeof makeTransaction>[]) {
    render(
        <InsiderTradeList
            table={buildInsiderTable(transactions, WINDOW)}
            scoringWindow={WINDOW}
        />
    );
}

describe('InsiderTradeList', () => {
    it('창이 끝난 뒤의 거래는 "이전" 묶음이 아니라 "이후" 묶음에 제 제목으로 들어간다', () => {
        renderList([
            makeTransaction({ date: '2026-10-10', name: 'Inside Buyer' }),
            makeTransaction({ date: '2026-10-20', name: 'Late Buyer' }),
            makeTransaction({ date: '2026-05-02', name: 'Early Buyer' }),
        ]);
        const before = screen.getByRole('heading', {
            level: 4,
            name: '집계 기간 밖 (2026-07-18 이전)',
        }).parentElement as HTMLElement;
        const after = screen.getByRole('heading', {
            level: 4,
            name: '집계 기간 밖 (2026-10-16 이후)',
        }).parentElement as HTMLElement;
        expect(
            within(before).getAllByText('Early Buyer').length
        ).toBeGreaterThan(0);
        expect(within(before).queryByText('Late Buyer')).toBeNull();
        expect(within(after).getAllByText('Late Buyer').length).toBeGreaterThan(
            0
        );
        expect(within(after).queryByText('Early Buyer')).toBeNull();
    });

    it('한쪽 묶음만 있으면 그 묶음의 제목만 낸다', () => {
        renderList([
            makeTransaction({ date: '2026-10-10', name: 'Inside Buyer' }),
            makeTransaction({ date: '2026-10-20', name: 'Late Buyer' }),
        ]);
        expect(
            screen.getByRole('heading', { level: 4, name: /이후\)/ })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { level: 4, name: /이전\)/ })
        ).toBeNull();
    });

    it('상한 밖으로 빠진 거래가 있으면 건수를 안내한다', () => {
        const trades = Array.from(
            { length: MAX_INSIDER_ROWS + 4 },
            (_, index) =>
                makeTransaction({
                    date: `2026-09-${String(index + 1).padStart(2, '0')}`,
                    name: `Buyer ${index}`,
                })
        );
        renderList(trades);
        expect(
            screen.getByText('오래된 거래 4건은 표에서 뺐어요.')
        ).toBeInTheDocument();
    });

    it('상한 이내이면 생략 안내가 없다', () => {
        renderList([makeTransaction({ date: '2026-10-10' })]);
        expect(screen.queryByText(/오래된 거래/)).toBeNull();
    });

    it('링크 이름에 거래자 이름이 들어가 표의 링크가 서로 구분된다', () => {
        renderList([
            makeTransaction({ date: '2026-10-10', name: 'Buyer One' }),
            makeTransaction({
                date: '2026-10-09',
                name: 'Buyer Two',
                url: 'https://www.sec.gov/Archives/two.htm',
            }),
        ]);
        expect(
            screen.getAllByRole('link', { name: 'Buyer One 공시 보기' }).length
        ).toBeGreaterThan(0);
        expect(
            screen.getAllByRole('link', { name: 'Buyer Two 공시 보기' }).length
        ).toBeGreaterThan(0);
    });
});
