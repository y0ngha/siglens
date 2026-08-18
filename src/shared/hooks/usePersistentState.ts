'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * useState와 동일 시그니처의 localStorage 영속 상태. SSR-safe.
 *
 * localStorage를 **외부 스토어로 구독**한다(`useSyncExternalStore`):
 *  - 서버 렌더와 하이드레이션 렌더는 `getServerSnapshot`(= initial)을 쓰므로 마크업이 일치한다.
 *  - 하이드레이션이 끝나면 React가 클라이언트 스냅샷(저장값)으로 전환한다.
 *
 * 예전 구현은 마운트 effect에서 `setValue(저장값)`으로 복원해 렌더가 한 번 더 돌았다.
 * 외부 스토어 구독으로 바꾸면 복원 렌더가 사라지고, 같은 key를 쓰는 인스턴스끼리 자동으로
 * 동기화되며(중복 상태 제거), 다른 탭의 변경(`storage` 이벤트)도 반영된다.
 *
 * 저장은 **사용자 변경분만** 한다 — `initial`은 절대 기록하지 않는다(setValue 호출 시에만 write).
 *
 * `key`는 렌더 간 안정적인 상수여야 한다. `initial`은 첫 호출 값으로 고정된다(useState와 동일).
 */

/** key별 구독자. 같은 key를 쓰는 훅 인스턴스가 함께 갱신된다. */
const listenersByKey = new Map<string, Set<() => void>>();

/**
 * key별 캐시: `raw`는 이 값이 대응하는 localStorage 원문(마지막으로 읽었거나 쓴 값),
 * `value`는 그 파싱 결과다. `getSnapshot`이 호출마다 새 객체를 만들면 React가 스냅샷이
 * 계속 바뀐다고 보고 무한 렌더에 빠지므로 같은 원문에는 같은 참조를 돌려준다.
 *
 * 원문을 함께 들고 있는 이유: 외부(다른 코드/테스트)가 같은 key를 지우거나 바꾸면
 * 원문이 달라지므로 캐시가 자동으로 무효화된다 — 값만 캐시하면 낡은 값이 남는다.
 */
const cacheByKey = new Map<string, { raw: string | null; value: unknown }>();

function emitChange(key: string): void {
    const listeners = listenersByKey.get(key);
    if (!listeners) return;
    for (const listener of listeners) listener();
}

function readStored<T>(key: string, initial: T): T {
    let raw: string | null = null;
    try {
        raw = window.localStorage.getItem(key);
    } catch {
        // 접근 불가(사파리 프라이빗 모드 등) — initial 유지
        return initial;
    }

    // 원문이 그대로면 같은 참조를 돌려준다(스냅샷 안정성). 쓰기가 실패했던 경우에도
    // 그때 기록해 둔 원문과 일치하므로 메모리 값이 유지된다.
    const cached = cacheByKey.get(key);
    if (cached !== undefined && cached.raw === raw) return cached.value as T;

    // 저장값이 없으면 캐시하지 않는다: 같은 key를 다른 initial로 쓰는 호출자가 있어도
    // 서로의 initial을 돌려받지 않는다.
    if (raw === null) return initial;

    let value: T;
    try {
        // 이 훅이 같은 key의 쓰기(JSON.stringify(value: T))를 단독 소유하므로
        // 역직렬화 결과는 항상 T와 일치한다 — 런타임 보장이 있는 안전한 캐스트.
        value = JSON.parse(raw) as T;
    } catch {
        // 파싱 실패는 graceful fallback (빈 catch 아님)
        return initial;
    }
    cacheByKey.set(key, { raw, value });
    return value;
}

export function usePersistentState<T>(
    key: string,
    initial: T
): [T, Dispatch<SetStateAction<T>>] {
    // useState(initial)과 같은 의미: 첫 렌더의 initial로 고정한다.
    const initialRef = useRef(initial);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            const listeners = listenersByKey.get(key) ?? new Set<() => void>();
            listeners.add(onStoreChange);
            listenersByKey.set(key, listeners);

            const onStorage = (event: StorageEvent): void => {
                if (event.key !== key) return;
                // 다른 탭이 바꾼 값을 다음 스냅샷에서 다시 읽도록 캐시를 비운다.
                cacheByKey.delete(key);
                onStoreChange();
            };
            window.addEventListener('storage', onStorage);

            return () => {
                listeners.delete(onStoreChange);
                window.removeEventListener('storage', onStorage);
            };
        },
        [key]
    );

    const value = useSyncExternalStore(
        subscribe,
        () => readStored(key, initialRef.current),
        () => initialRef.current
    );

    const setValue = useCallback<Dispatch<SetStateAction<T>>>(
        next => {
            const resolved =
                typeof next === 'function'
                    ? (next as (prev: T) => T)(
                          readStored(key, initialRef.current)
                      )
                    : next;
            const serialized = JSON.stringify(resolved);
            try {
                window.localStorage.setItem(key, serialized);
                cacheByKey.set(key, { raw: serialized, value: resolved });
            } catch {
                // quota 초과/직렬화 실패는 영속만 실패시킨다 — 화면 상태는 유지한다.
                // 실제로 저장된 원문을 캐시 키로 기록해 두면(대개 이전 값 또는 null)
                // 다음 읽기에서 원문이 일치해 메모리 값이 그대로 살아남는다.
                let storedRaw: string | null = null;
                try {
                    storedRaw = window.localStorage.getItem(key);
                } catch {
                    // 읽기도 불가하면 null 기준으로 캐시한다.
                }
                cacheByKey.set(key, { raw: storedRaw, value: resolved });
            }
            emitChange(key);
        },
        [key]
    );

    return [value, setValue];
}
