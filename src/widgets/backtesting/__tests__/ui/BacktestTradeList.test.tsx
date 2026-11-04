vi.mock('../../TradeDetailsHost', () => ({
    TradeDetailsHost: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../../BacktestTradeRow', () => ({
    BacktestTradeRow: ({ row }: { row: { ticker: string } }) => (
        <div data-testid={`case-${row.ticker}`}>{row.ticker}</div>
    ),
}));

import { render, screen } from '@testing-library/react';
import type { BacktestTrade } from '@y0ngha/siglens-core';

import { toTradeRows } from '@/entities/backtest-case/lib/tradeRows';

import { BacktestTradeList } from '../../BacktestTradeList';

/** 행 모델은 app 레이어가 만든다 — 테스트는 같은 변환(`toTradeRows`)을 거쳐 넘긴다. */
function TradeList({ trades }: { trades: BacktestTrade[] }) {
    return <BacktestTradeList runId="t" rows={toTradeRows(trades)} />;
}

function makeCase(ticker: string, entryDate: string): BacktestTrade {
    return {
        ticker,
        entryType: 'wait_limit',
        decisionDate: entryDate,
        entryDate,
        entryPrice: 100,
        exitDate: '2024-07-01',
        holdingDays: 5,
        returnPct: 1,
        legs: [
            {
                name: 'A',
                size: 0.5,
                exitDate: '2024-07-01',
                exitPrice: 101,
                reason: 'tp1',
                returnPct: 1,
            },
            {
                name: 'B',
                size: 0.5,
                exitDate: '2024-07-01',
                exitPrice: 101,
                reason: 'tp_final',
                returnPct: 1,
            },
        ],
        initialPlan: { tp1: 101, tpFinal: 102, sl1: 99, sl2: 98, source: 'ai' },
        holdingReviews: 0,
        summary: '',
    };
}

describe('BacktestTradeList', () => {
    it('renders empty message when no cases', () => {
        render(<TradeList trades={[]} />);

        expect(screen.getByText('표시할 매매가 없습니다.')).toBeInTheDocument();
    });

    it('renders case cards for each item', () => {
        const cases = [
            makeCase('AAPL', '2024-06-15'),
            makeCase('NVDA', '2024-06-20'),
        ];
        render(<TradeList trades={cases} />);

        expect(screen.getByTestId('case-AAPL')).toBeInTheDocument();
        expect(screen.getByTestId('case-NVDA')).toBeInTheDocument();
    });

    it('groups cases by month', () => {
        const cases = [
            makeCase('AAPL', '2024-06-15'),
            makeCase('NVDA', '2024-06-20'),
            makeCase('TSLA', '2024-07-01'),
        ];
        render(<TradeList trades={cases} />);

        expect(screen.getByText('2024년 6월')).toBeInTheDocument();
        expect(screen.getByText('2024년 7월')).toBeInTheDocument();
    });

    /**
     * 월 구분은 **헤딩이어야 한다.** `<div>`로 제목처럼만 꾸미면 스크린리더가
     * 헤딩 탐색으로 월을 건너뛸 수 없다(WCAG SC 1.3.1).
     *
     * 태그를 되돌려도 위 "groups cases by month"는 `getByText`라 그대로
     * 통과한다 — 그래서 **역할(role)**로 따로 단언한다.
     */
    it('월 구분을 헤딩으로 노출한다', () => {
        const cases = [
            makeCase('AAPL', '2024-06-15'),
            makeCase('TSLA', '2024-07-01'),
        ];
        render(<TradeList trades={cases} />);

        const headings = screen.getAllByRole('heading', { level: 2 });
        // 최신 월이 위다.
        expect(headings.map(h => h.textContent)).toEqual([
            '2024년 7월',
            '2024년 6월',
        ]);
    });
});

/**
 * 100건·17개월을 오래된 순으로 전부 펼쳐 놓던 것을, 월마다 접는 `<details>`로 바꾸고
 * 최신 순으로 뒤집었다. 접힌 월의 카드도 DOM에는 남아야 크롤러가 읽는다.
 */
describe('BacktestTradeList — 월별 접이식', () => {
    // 2024-01 ~ 2024-05, 월마다 1건. 입력은 오래된 순(데이터 원본과 같다).
    const FIVE_MONTHS = [
        makeCase('JAN', '2024-01-10'),
        makeCase('FEB', '2024-02-10'),
        makeCase('MAR', '2024-03-10'),
        makeCase('APR', '2024-04-10'),
        makeCase('MAY', '2024-05-10'),
    ];

    const months = () =>
        Array.from(document.querySelectorAll('details')).map(d => ({
            label: d.querySelector('h2')?.textContent,
            open: d.open,
        }));

    it('월이 최신순으로 나열된다', () => {
        render(<TradeList trades={FIVE_MONTHS} />);

        expect(months().map(m => m.label)).toEqual([
            '2024년 5월',
            '2024년 4월',
            '2024년 3월',
            '2024년 2월',
            '2024년 1월',
        ]);
    });

    it('월 안의 케이스도 최신순이다', () => {
        render(
            <TradeList
                trades={[
                    makeCase('EARLY', '2024-06-01'),
                    makeCase('MID', '2024-06-15'),
                    makeCase('LATE', '2024-06-28'),
                ]}
            />
        );

        const order = Array.from(
            document.querySelectorAll('[data-testid^="case-"]')
        ).map(el => el.textContent);
        expect(order).toEqual(['LATE', 'MID', 'EARLY']);
    });

    it('최신 3개월만 펼치고 나머지는 접는다', () => {
        render(<TradeList trades={FIVE_MONTHS} />);

        expect(months().map(m => m.open)).toEqual([
            true,
            true,
            true,
            false,
            false,
        ]);
    });

    it('접힌 월의 카드도 DOM에 남아 있다 (크롤러 색인)', () => {
        render(<TradeList trades={FIVE_MONTHS} />);

        for (const ticker of ['JAN', 'FEB', 'MAR', 'APR', 'MAY']) {
            expect(screen.getByTestId(`case-${ticker}`)).toBeInTheDocument();
        }
        // JAN은 접힌 <details> 안에 있다.
        expect(
            screen.getByTestId('case-JAN').closest('details')
        ).not.toHaveAttribute('open');
    });

    it('카드·월·건수에 어느 탭에서 보이는지 표기한다(전체 토큰 + 종목)', () => {
        render(
            <TradeList
                trades={[
                    makeCase('AAPL', '2024-06-15'),
                    makeCase('NVDA', '2024-06-20'),
                    makeCase('AAPL', '2024-06-22'),
                ]}
            />
        );

        const month = document.querySelector('details');
        expect(month?.getAttribute('data-backtest-show')).toBe('* AAPL NVDA');
        expect(
            screen
                .getAllByTestId('case-AAPL')[0]
                ?.parentElement?.getAttribute('data-backtest-show')
        ).toBe('* AAPL');
        const counts = Array.from(
            month?.querySelectorAll('summary span[data-backtest-show]') ?? []
        ).map(el => [
            el.getAttribute('data-backtest-show'),
            el.textContent,
            el.hasAttribute('hidden'),
        ]);
        expect(counts).toEqual([
            ['*', '3건', false],
            ['AAPL', '2건', true],
            ['NVDA', '1건', true],
        ]);
    });

    it('월이 3개 이하면 전부 펼쳐진다', () => {
        render(<TradeList trades={FIVE_MONTHS.slice(0, 2)} />);

        expect(months().every(m => m.open)).toBe(true);
    });

    it('요약 줄에 월 헤딩과 건수가 함께 있다 (헤딩은 summary 안)', () => {
        render(
            <TradeList
                trades={[
                    makeCase('AAPL', '2024-06-15'),
                    makeCase('NVDA', '2024-06-20'),
                    makeCase('TSLA', '2024-07-01'),
                ]}
            />
        );

        const summaries = Array.from(document.querySelectorAll('summary'));
        // 종목별 건수 표시는 서버 HTML에서 숨겨져 있다 — 보이는 텍스트만 본다.
        const visibleText = (summary: Element) =>
            Array.from(summary.querySelectorAll('h2, span:not([hidden])'))
                .map(el => el.textContent)
                .join('');
        expect(summaries.map(visibleText)).toEqual([
            '2024년 7월1건',
            '2024년 6월2건',
        ]);
        for (const summary of summaries) {
            expect(summary.querySelector('h2')).not.toBeNull();
        }
    });

    it('같은 달 안에서 월 경계를 넘어 섞여 들어와도 한 그룹으로 모은다', () => {
        render(
            <TradeList
                trades={[
                    makeCase('A', '2024-06-20'),
                    makeCase('B', '2024-07-01'),
                    makeCase('C', '2024-06-02'),
                ]}
            />
        );

        expect(months().map(m => m.label)).toEqual([
            '2024년 7월',
            '2024년 6월',
        ]);
    });
});

describe('BacktestTradeList — 필터 표기', () => {
    it('카드 래퍼에 카드 표식을 단다', () => {
        render(<TradeList trades={[makeCase('AAPL', '2024-06-15')]} />);

        expect(screen.getByTestId('case-AAPL').parentElement).toHaveAttribute(
            'data-backtest-card'
        );
    });

    it('종목 탭이 비었을 때 드러낼 안내를 숨긴 채 서버에서 그린다', () => {
        render(<TradeList trades={[makeCase('AAPL', '2024-06-15')]} />);

        const empty = screen.getByText('선택한 종목의 매매가 없습니다.');
        expect(empty).toHaveAttribute('data-backtest-empty');
        expect(empty).toHaveAttribute('hidden');
        expect(empty).toHaveAttribute('role', 'status');
    });

    it('데이터셋이 비면 종목 필터 안내 없이 일반 안내만 그린다', () => {
        render(<TradeList trades={[]} />);

        expect(
            screen.queryByText('선택한 종목의 매매가 없습니다.')
        ).not.toBeInTheDocument();
        expect(screen.queryByText(/이 종목|해당 종목/)).not.toBeInTheDocument();
    });
});
