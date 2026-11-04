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
            <TradeDetailsHost runId="test">
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
            <TradeDetailsHost runId="test">
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
            <TradeDetailsHost runId="test">
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
            <TradeDetailsHost runId="test">
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
            <TradeDetailsHost runId="test">
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
});
