import {
    EMAIL_REPORT_MAX_BRIEF_SYMBOLS,
    EMAIL_REPORT_MAX_SYMBOLS,
} from '@/entities/email-report/lib/emailReportConstants';
import {
    selectReportSymbols,
    type ReportHolding,
    type ReportWatchlistItem,
} from '@/entities/email-report/lib/selectReportSymbols';

function holding(
    symbol: string,
    quantity: string,
    averagePrice: string
): ReportHolding {
    return { symbol, quantity, averagePrice };
}

function watched(symbol: string, createdAt: string): ReportWatchlistItem {
    return { symbol, createdAt: new Date(createdAt) };
}

describe('selectReportSymbols', () => {
    describe('보유 종목 순서', () => {
        it('해외 종목을 먼저, 그룹 안에서는 매입 원가가 큰 순으로 고른다', () => {
            const { full } = selectReportSymbols({
                holdings: [
                    holding('005930.KS', '100', '70000'),
                    holding('AAPL', '10', '150'),
                    holding('NVDA', '20', '100'),
                    holding('MSFT', '1', '400'),
                ],
                watchlist: [],
            });

            expect(full).toEqual(['NVDA', 'AAPL', 'MSFT', '005930.KS']);
        });

        it('원가가 같으면 심볼 순이다', () => {
            expect(
                selectReportSymbols({
                    holdings: [
                        holding('TSLA', '1', '10'),
                        holding('AMD', '1', '10'),
                    ],
                    watchlist: [],
                }).full
            ).toEqual(['AMD', 'TSLA']);
        });

        it('숫자로 읽을 수 없는 원가는 0으로 친다', () => {
            expect(
                selectReportSymbols({
                    holdings: [
                        holding('BAD', 'x', '10'),
                        holding('OK', '1', '1'),
                    ],
                    watchlist: [],
                }).full
            ).toEqual(['OK', 'BAD']);
        });
    });

    describe('관심종목 결합', () => {
        it('보유 종목 뒤에 관심종목을 최근 담은 순으로 잇는다', () => {
            const { full, brief } = selectReportSymbols({
                holdings: [holding('AAPL', '1', '100')],
                watchlist: [
                    watched('OLD', '2026-10-01T00:00:00Z'),
                    watched('NEW', '2026-10-08T00:00:00Z'),
                    watched('MID', '2026-10-05T00:00:00Z'),
                ],
            });

            expect(full).toEqual(['AAPL', 'NEW', 'MID', 'OLD']);
            expect(brief).toEqual([]);
        });

        it('보유와 관심에 모두 있는 심볼은 보유 자리에서 한 번만 나온다', () => {
            const { full } = selectReportSymbols({
                holdings: [
                    holding('MSFT', '1', '300'),
                    holding('AAPL', '1', '100'),
                ],
                watchlist: [
                    watched('AAPL', '2026-10-08T00:00:00Z'),
                    watched('TSLA', '2026-10-07T00:00:00Z'),
                ],
            });

            expect(full).toEqual(['MSFT', 'AAPL', 'TSLA']);
        });

        it('같은 시각에 담은 관심종목은 심볼 순이다', () => {
            expect(
                selectReportSymbols({
                    holdings: [],
                    watchlist: [
                        watched('ZM', '2026-10-08T00:00:00Z'),
                        watched('ABNB', '2026-10-08T00:00:00Z'),
                    ],
                }).full
            ).toEqual(['ABNB', 'ZM']);
        });
    });

    describe('상한', () => {
        const many = Array.from({ length: 25 }, (_, i) =>
            watched(
                `S${String(i).padStart(2, '0')}`,
                `2026-09-${String(30 - i).padStart(2, '0')}T00:00:00Z`
            )
        );

        it(`앞의 ${EMAIL_REPORT_MAX_SYMBOLS}개는 full, 그다음 ${EMAIL_REPORT_MAX_BRIEF_SYMBOLS}개는 brief, 나머지는 버린다`, () => {
            const { full, brief } = selectReportSymbols({
                holdings: [],
                watchlist: many,
            });

            expect(full).toHaveLength(EMAIL_REPORT_MAX_SYMBOLS);
            expect(brief).toHaveLength(EMAIL_REPORT_MAX_BRIEF_SYMBOLS);
            expect(full[0]).toBe('S00');
            expect(brief[0]).toBe(
                `S${String(EMAIL_REPORT_MAX_SYMBOLS).padStart(2, '0')}`
            );
            expect([...full, ...brief]).not.toContain('S20');
        });

        it('보유가 상한을 넘으면 넘친 보유 종목이 brief로 간다', () => {
            const holdings = Array.from({ length: 7 }, (_, i) =>
                holding(`H${i}`, '1', String(1000 - i))
            );
            const { full, brief } = selectReportSymbols({
                holdings,
                watchlist: [watched('WATCH', '2026-10-08T00:00:00Z')],
            });

            expect(full).toEqual(['H0', 'H1', 'H2', 'H3', 'H4']);
            expect(brief).toEqual(['H5', 'H6', 'WATCH']);
        });
    });

    it('둘 다 비면 빈 선택이다', () => {
        expect(selectReportSymbols({ holdings: [], watchlist: [] })).toEqual({
            full: [],
            brief: [],
        });
    });
});
