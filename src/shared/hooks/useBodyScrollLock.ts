'use client';

import { useEffect } from 'react';

/**
 * 잠금을 건 소유자 수와, 첫 잠금 직전의 `body` overflow 값.
 *
 * 모듈 수준에서 센다. 소유자(검색 오버레이·모바일 메뉴 드로어)가 각자
 * `prev = body.style.overflow`를 저장/복원하면, 둘이 겹쳐 열릴 때 두 번째가 저장한
 * `prev`가 이미 `'hidden'`이라 닫는 순서에 따라 스크롤이 잠긴 채로 남는다. 카운트로 세면
 * 마지막 소유자가 풀 때만, 첫 잠금 전 값으로 복원한다.
 */
let lockCount = 0;
let overflowBeforeLock = '';

function lock(): void {
    if (lockCount === 0) {
        overflowBeforeLock = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }
    lockCount += 1;
}

function unlock(): void {
    lockCount -= 1;
    if (lockCount === 0) {
        document.body.style.overflow = overflowBeforeLock;
    }
}

/** `active`인 동안 배경(`body`) 스크롤을 막는다. 모달·드로어·오버레이용. */
export function useBodyScrollLock(active: boolean = true): void {
    useEffect(() => {
        if (!active) return;
        lock();
        return unlock;
    }, [active]);
}
