import { subscribeTradeDetailsOpen } from '../../utils/tradeDetailsToggle';

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
