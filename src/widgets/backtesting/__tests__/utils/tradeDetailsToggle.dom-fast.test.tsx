import {
    subscribeLazyMonthOpen,
    subscribeTradeDetailsOpen,
} from '../../utils/tradeDetailsToggle';

/** `open`을 바꾸면 브라우저(jsdom 포함)가 `toggle`을 비동기로 한 번 낸다. 그 태스크를 기다린다. */
const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

function setup() {
    document.body.innerHTML = `
        <div id="root">
            <details id="month"><summary>m</summary>
                <details id="row"><summary>r</summary><div data-trade-detail="AAA|2025-01-02"></div></details>
            </details>
        </div>`;
    const root = document.getElementById('root')!;
    const onOpen = vi.fn();
    const unsubscribe = subscribeTradeDetailsOpen(root, onOpen);
    const toggle = async (id: string, open: boolean) => {
        (document.getElementById(id) as HTMLDetailsElement).open = open;
        await nextTask();
    };
    return { onOpen, unsubscribe, toggle };
}

describe('subscribeTradeDetailsOpen', () => {
    it('reports the key and slot when a trade row opens', async () => {
        const { onOpen, toggle } = setup();
        await toggle('row', true);
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onOpen).toHaveBeenCalledWith(
            'AAA|2025-01-02',
            document.querySelector('[data-trade-detail]')
        );
    });

    it('ignores month sections and closing rows', async () => {
        const { onOpen, toggle } = setup();
        await toggle('month', true);
        await toggle('row', true);
        onOpen.mockClear();
        await toggle('row', false);
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('ignores a month section that opens on its own', async () => {
        const { onOpen, toggle } = setup();
        await toggle('month', true);
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('reports rows that were already open when it subscribed', () => {
        // 하이드레이션 전에 연 행·뒤로 가기로 복원된 행 — `toggle`은 이미 지나갔다.
        document.body.innerHTML = `
            <div id="root">
                <details id="month" open><summary>m</summary>
                    <details open><summary>r</summary><div data-trade-detail="BBB|2025-02-03"></div></details>
                    <details><summary>r</summary><div data-trade-detail="CCC|2025-02-04"></div></details>
                </details>
            </div>`;
        const onOpen = vi.fn();
        subscribeTradeDetailsOpen(document.getElementById('root')!, onOpen);
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onOpen).toHaveBeenCalledWith(
            'BBB|2025-02-03',
            document.querySelector('[data-trade-detail="BBB|2025-02-03"]')
        );
    });

    it('stops listening after unsubscribe', async () => {
        const { onOpen, unsubscribe, toggle } = setup();
        unsubscribe();
        await toggle('row', true);
        expect(onOpen).not.toHaveBeenCalled();
    });
});

describe('subscribeLazyMonthOpen', () => {
    function setupMonth(monthOpen = false) {
        document.body.innerHTML = `
            <div id="root">
                <details id="month" data-month-section ${monthOpen ? 'open' : ''}><summary>m</summary>
                    <section><div><div data-lazy-month="2025-03"></div></div></section>
                </details>
                <details id="plain"><summary>p</summary><div data-lazy-month="2025-04"></div></details>
                <details id="row"><summary>r</summary><div data-trade-detail="AAA|2025-01-02"></div></details>
            </div>`;
        const onOpen = vi.fn();
        const unsubscribe = subscribeLazyMonthOpen(
            document.getElementById('root')!,
            onOpen
        );
        return { onOpen, unsubscribe };
    }

    it('reports the month key and slot when a lazy month opens', async () => {
        const { onOpen } = setupMonth();
        (document.getElementById('month') as HTMLDetailsElement).open = true;
        await nextTask();
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onOpen).toHaveBeenCalledWith(
            '2025-03',
            document.querySelector('[data-lazy-month]')
        );
    });

    it('ignores details that are not month sections', async () => {
        const { onOpen } = setupMonth();
        (document.getElementById('plain') as HTMLDetailsElement).open = true;
        await nextTask();
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('ignores trade rows', async () => {
        const { onOpen } = setupMonth();
        (document.getElementById('row') as HTMLDetailsElement).open = true;
        await nextTask();
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('reports a lazy month that was already open when it subscribed', () => {
        const { onOpen } = setupMonth(true);
        expect(onOpen).toHaveBeenCalledWith(
            '2025-03',
            document.querySelector('[data-lazy-month]')
        );
    });

    it('stops listening after unsubscribe', async () => {
        const { onOpen, unsubscribe } = setupMonth();
        unsubscribe();
        (document.getElementById('month') as HTMLDetailsElement).open = true;
        await nextTask();
        expect(onOpen).not.toHaveBeenCalled();
    });
});
