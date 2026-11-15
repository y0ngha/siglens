/**
 * `work`가 `ms` 안에 끝나지 않으면 `onTimeout`을 돌려준다. **`work`는 취소되지 않는다**(뒤에서
 * 마저 돈다) — 락을 쥔 크론 단계가 멈춘 Redis·DB 호출에 막혀 뒤 단계(정리·락 해제)를 못 하는 일을
 * 막는 용도다. 어느 쪽이든 끝나면 타이머를 지워, 남은 타이머가 프로세스를 붙잡지 않게 한다.
 *
 * `ms`가 0 이하면 바로 끝나는 타이머로 다룬다. 시작조차 하지 않아야 하는 경우(예산이 이미 바닥)는
 * 호출자가 `work`를 만들기 전에 거른다 — 여기로 넘긴 시점에 `work`는 이미 돌고 있다.
 */
export async function withTimeout<T>(
    work: Promise<T>,
    ms: number,
    onTimeout: T
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>(resolve => {
        timer = setTimeout(() => resolve(onTimeout), Math.max(ms, 0));
    });
    try {
        return await Promise.race([work, timeout]);
    } finally {
        clearTimeout(timer);
    }
}
