import { act, render, screen, waitFor } from '@testing-library/react';
import type { MockInstance } from 'vitest';
import type { BacktestRunData } from '@y0ngha/siglens-core';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';
import backtestData from '@/entities/backtest-case/data/data.json';

import { TradeDetailsHost } from '../../TradeDetailsHost';

const DATA = backtestData as unknown as BacktestRunData;
const FIRST = DATA.trades[0];
const KEY = `${FIRST.ticker}|${FIRST.entryDate}`;

function Rows() {
    return (
        <>
            <details data-testid="row">
                <summary>row</summary>
                <div data-trade-detail={KEY} />
            </details>
            <details data-testid="missing">
                <summary>missing</summary>
                <div data-trade-detail="ZZZ|2000-01-01" />
            </details>
        </>
    );
}

/** `open`을 바꾸면 브라우저(jsdom 포함)가 `toggle`을 비동기로 한 번 낸다. */
async function openRow(testId: string) {
    const details = screen.getByTestId(testId) as HTMLDetailsElement;
    await act(async () => {
        details.open = true;
        await new Promise(resolve => setTimeout(resolve, 0));
    });
}

describe('TradeDetailsHost', () => {
    let fetchSpy: MockInstance<typeof fetch>;

    beforeEach(() => {
        // 기본값은 거부 — 구현 없는 스파이는 실제 fetch를 부른다.
        fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockRejectedValue(new Error('unexpected fetch'));
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    it('does not fetch until a row is opened', () => {
        const { wrapper } = createQueryClientWrapper();
        render(
            <TradeDetailsHost runId={DATA.run.runId}>
                <Rows />
            </TradeDetailsHost>,
            { wrapper }
        );
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('loads the public data once and renders the opened trade into its slot', async () => {
        fetchSpy.mockResolvedValue(
            new Response(JSON.stringify(DATA), { status: 200 })
        );
        const { wrapper } = createQueryClientWrapper();
        render(
            <TradeDetailsHost runId={DATA.run.runId}>
                <Rows />
            </TradeDetailsHost>,
            { wrapper }
        );

        await openRow('row');
        await waitFor(() =>
            expect(screen.getByTestId('row')).toHaveTextContent(FIRST.summary)
        );
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(
            fetchSpy.mock.calls.find(c =>
                String(c[0]).includes('/backtesting/data.json')
            )
        ).toBeDefined();
    });

    it('shows a loading status in the slot while the data is in flight', async () => {
        fetchSpy.mockReturnValue(new Promise<Response>(() => {}));
        const { wrapper } = createQueryClientWrapper();
        render(
            <TradeDetailsHost runId={DATA.run.runId}>
                <Rows />
            </TradeDetailsHost>,
            { wrapper }
        );
        await openRow('row');
        expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
    });

    it('shows an error in the slot when the trade is not in the data', async () => {
        fetchSpy.mockResolvedValue(
            new Response(JSON.stringify(DATA), { status: 200 })
        );
        const { wrapper } = createQueryClientWrapper();
        render(
            <TradeDetailsHost runId={DATA.run.runId}>
                <Rows />
            </TradeDetailsHost>,
            { wrapper }
        );
        await openRow('missing');
        await waitFor(() =>
            expect(screen.getByTestId('missing')).toHaveTextContent(
                '불러오지 못했어요'
            )
        );
    });

    it('shows an error when the request fails', async () => {
        fetchSpy.mockResolvedValue(new Response('nope', { status: 500 }));
        const { wrapper } = createQueryClientWrapper();
        render(
            <TradeDetailsHost runId={DATA.run.runId}>
                <Rows />
            </TradeDetailsHost>,
            { wrapper }
        );
        await openRow('row');
        await waitFor(() =>
            expect(screen.getByTestId('row')).toHaveTextContent(
                '불러오지 못했어요'
            )
        );
    });

    describe('lazy months', () => {
        const MONTH = FIRST.entryDate.slice(0, 7);
        const MONTH_TRADES = DATA.trades.filter(trade =>
            trade.entryDate.startsWith(MONTH)
        );

        function Month() {
            return (
                <details data-testid="month" data-month-section="">
                    <summary>month</summary>
                    <div>
                        <div data-lazy-month={MONTH} />
                    </div>
                </details>
            );
        }

        async function openMonth() {
            const details = screen.getByTestId('month') as HTMLDetailsElement;
            await act(async () => {
                details.open = true;
                await new Promise(resolve => setTimeout(resolve, 0));
            });
        }

        it('does not fetch until a lazy month is opened', () => {
            const { wrapper } = createQueryClientWrapper();
            render(
                <TradeDetailsHost runId={DATA.run.runId}>
                    <Month />
                </TradeDetailsHost>,
                { wrapper }
            );
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('renders the month rows into the slot once the data loads', async () => {
            fetchSpy.mockResolvedValue(
                new Response(JSON.stringify(DATA), { status: 200 })
            );
            const { wrapper } = createQueryClientWrapper();
            render(
                <TradeDetailsHost runId={DATA.run.runId}>
                    <Month />
                </TradeDetailsHost>,
                { wrapper }
            );
            await openMonth();
            const slot = document.querySelector('[data-lazy-month]')!;
            await waitFor(() =>
                expect(slot.querySelectorAll('[data-trade-row]')).toHaveLength(
                    MONTH_TRADES.length
                )
            );
            expect(slot.querySelector('[data-backtest-card]')).toHaveAttribute(
                'data-backtest-show'
            );
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });

        it('renders details for a row drawn into a lazy month', async () => {
            fetchSpy.mockResolvedValue(
                new Response(JSON.stringify(DATA), { status: 200 })
            );
            const { wrapper } = createQueryClientWrapper();
            render(
                <TradeDetailsHost runId={DATA.run.runId}>
                    <Month />
                </TradeDetailsHost>,
                { wrapper }
            );
            await openMonth();
            const slot = document.querySelector('[data-lazy-month]')!;
            await waitFor(() =>
                expect(slot.querySelector('[data-trade-row]')).not.toBeNull()
            );
            const row = slot.querySelector<HTMLDetailsElement>(
                `[data-trade-row]:has([data-trade-detail="${KEY}"])`
            )!;
            await act(async () => {
                row.open = true;
                await new Promise(resolve => setTimeout(resolve, 0));
            });
            await waitFor(() => expect(row).toHaveTextContent(FIRST.summary));
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });

        it('shows a loading status in the month slot while the data is in flight', async () => {
            fetchSpy.mockReturnValue(new Promise<Response>(() => {}));
            const { wrapper } = createQueryClientWrapper();
            render(
                <TradeDetailsHost runId={DATA.run.runId}>
                    <Month />
                </TradeDetailsHost>,
                { wrapper }
            );
            await openMonth();
            expect(screen.getByRole('status')).toHaveTextContent(
                '이 달의 매매를 불러오는 중'
            );
        });

        it('shows a month-level error when the served data is from another run', async () => {
            fetchSpy.mockResolvedValue(
                new Response(
                    JSON.stringify({
                        ...DATA,
                        run: { ...DATA.run, runId: 'stale-run' },
                    }),
                    { status: 200 }
                )
            );
            const { wrapper } = createQueryClientWrapper();
            render(
                <TradeDetailsHost runId={DATA.run.runId}>
                    <Month />
                </TradeDetailsHost>,
                { wrapper }
            );
            await openMonth();
            await waitFor(() =>
                expect(screen.getByRole('status')).toHaveTextContent(
                    '이 달의 매매를 불러오지 못했어요'
                )
            );
            expect(
                fetchSpy.mock.calls.find(c =>
                    String(c[0]).includes('/backtesting/data.json')
                )?.[0]
            ).toContain(`run=${encodeURIComponent(DATA.run.runId)}`);
        });
    });
});
