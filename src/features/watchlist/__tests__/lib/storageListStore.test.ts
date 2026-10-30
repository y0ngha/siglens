// @vitest-environment jsdom
import { createStorageListStore } from '@/features/watchlist/lib/storageListStore';

const KEY = 'test-list-key';
const EVENT = 'test:list-change';

function makeStore(read: () => string[]) {
    return createStorageListStore<string>({
        storageKey: KEY,
        eventName: EVENT,
        read,
        fingerprint: entry => entry,
    });
}

describe('createStorageListStore', () => {
    describe('getSnapshot', () => {
        it('내용이 같으면 새로 읽어도 같은 배열을 돌려준다', () => {
            const store = makeStore(() => ['AAPL', 'MSFT']);
            const first = store.getSnapshot();
            expect(store.getSnapshot()).toBe(first);
            expect(first).toEqual(['AAPL', 'MSFT']);
        });

        it('내용이 바뀌면 새 배열을 돌려준다', () => {
            let value = ['AAPL'];
            const store = makeStore(() => value);
            const first = store.getSnapshot();
            value = ['AAPL', 'TSLA'];
            const second = store.getSnapshot();
            expect(second).not.toBe(first);
            expect(second).toEqual(['AAPL', 'TSLA']);
        });

        it('빈 목록은 서버 스냅샷과 같은 배열이다', () => {
            const store = makeStore(() => []);
            expect(store.getSnapshot()).toBe(store.getServerSnapshot());
        });
    });

    describe('subscribe', () => {
        it('notify가 같은 탭의 구독자를 부른다', () => {
            const store = makeStore(() => []);
            const callback = vi.fn();
            const unsubscribe = store.subscribe(callback);
            store.notify();
            unsubscribe();
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('다른 탭의 같은 키 storage 이벤트에 반응한다', () => {
            const store = makeStore(() => []);
            const callback = vi.fn();
            const unsubscribe = store.subscribe(callback);
            window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
            unsubscribe();
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('다른 탭의 clear()(key=null)에 반응한다', () => {
            const store = makeStore(() => []);
            const callback = vi.fn();
            const unsubscribe = store.subscribe(callback);
            window.dispatchEvent(new StorageEvent('storage', { key: null }));
            unsubscribe();
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('다른 키의 storage 이벤트는 무시한다', () => {
            const store = makeStore(() => []);
            const callback = vi.fn();
            const unsubscribe = store.subscribe(callback);
            window.dispatchEvent(
                new StorageEvent('storage', { key: 'other-key' })
            );
            unsubscribe();
            expect(callback).not.toHaveBeenCalled();
        });

        it('구독을 풀면 더는 부르지 않는다', () => {
            const store = makeStore(() => []);
            const callback = vi.fn();
            store.subscribe(callback)();
            store.notify();
            window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
            expect(callback).not.toHaveBeenCalled();
        });
    });
});
