// jobId별로 resolve 가능한 Suspense promise를 보관한다.
// throw된 promise가 resolve될 때 React가 suspended 컴포넌트를 재렌더링한다.
const pending = new Map<
    string,
    { promise: Promise<void>; resolve: () => void }
>();

export function getSuspensePromise(key: string): Promise<void> {
    if (!pending.has(key)) {
        let resolve!: () => void;
        const promise = new Promise<void>(res => {
            resolve = res;
        });
        pending.set(key, { promise, resolve });
    }
    return pending.get(key)!.promise;
}

export function resolveSuspensePromise(key: string): void {
    pending.get(key)?.resolve();
    pending.delete(key);
}
