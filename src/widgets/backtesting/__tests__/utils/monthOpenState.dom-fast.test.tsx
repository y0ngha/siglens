import { openAllMonths, restoreMonths } from '../../utils/monthOpenState';

function makeMonth(open: boolean): HTMLDetailsElement {
    const el = document.createElement('details');
    el.open = open;
    return el;
}

describe('monthOpenState', () => {
    it('openAllMonths는 펼치기 전 상태를 기억하고 모두 펼친다', () => {
        const closed = makeMonth(false);
        const opened = makeMonth(true);
        const snapshot = new Map<HTMLDetailsElement, boolean>();

        openAllMonths([closed, opened], snapshot);

        expect(closed.open).toBe(true);
        expect(Array.from(snapshot.values())).toEqual([false, true]);
    });

    it('이미 기억한 월의 상태는 덮어쓰지 않는다', () => {
        const month = makeMonth(false);
        const snapshot = new Map<HTMLDetailsElement, boolean>();

        openAllMonths([month], snapshot);
        openAllMonths([month], snapshot);

        expect(snapshot.get(month)).toBe(false);
    });

    it('지금 목록에 없는 월은 기억에서 지운다', () => {
        const detached = makeMonth(true);
        const kept = makeMonth(false);
        const snapshot = new Map([
            [detached, true],
            [kept, false],
        ]);

        openAllMonths([kept], snapshot);

        expect(snapshot.has(detached)).toBe(false);
        expect(snapshot.get(kept)).toBe(false);
    });

    it('restoreMonths는 기억된 상태로 되돌리고 모르는 월은 그대로 둔다', () => {
        const remembered = makeMonth(true);
        const unknown = makeMonth(true);
        const snapshot = new Map([[remembered, false]]);

        restoreMonths([remembered, unknown], snapshot);

        expect(remembered.open).toBe(false);
        expect(unknown.open).toBe(true);
    });
});
