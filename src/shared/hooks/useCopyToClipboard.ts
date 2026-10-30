'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCopyToClipboardReturn {
    /** 마지막 복사가 성공했고 아직 `resetMs`가 지나지 않았다. */
    copied: boolean;
    /** 마지막 복사가 실패했고(권한 거부·비보안 컨텍스트) 아직 `resetMs`가 지나지 않았다. */
    failed: boolean;
    /**
     * 성공 여부를 돌려준다 — 실패를 던지지 않으므로 호출부가 `void`로 버려도 안전하다.
     * 텍스트를 만드는 함수를 넘기면 그 함수가 던진 예외도 복사 실패로 처리한다.
     */
    copy: (text: string | (() => string)) => Promise<boolean>;
}

/** `copied`/`failed` 표시를 거두는 기본 지연. */
export const DEFAULT_RESET_MS = 2000;

type CopyStatus = 'idle' | 'copied' | 'failed';

/**
 * 클립보드 복사와 그 결과(`copied`/`failed`) 표시를 `resetMs` 동안 들고 있는다.
 * `copy`는 실패해도 던지지 않고 성공 여부를 돌려준다.
 */
export function useCopyToClipboard(
    resetMs = DEFAULT_RESET_MS
): UseCopyToClipboardReturn {
    const [status, setStatus] = useState<CopyStatus>('idle');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearResetTimer = useCallback((): void => {
        if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    }, []);

    const copy = useCallback(
        async (text: string | (() => string)): Promise<boolean> => {
            clearResetTimer();
            // `navigator.clipboard`는 비보안 컨텍스트(http)에서 아예 없다. try/throw 대신
            // 프로미스 두 갈래로 받는다 — React Compiler는 try/catch 안의 throw를 컴파일하지 못한다.
            // 텍스트 생성도 같은 체인 안에서 해야 생성 중 예외가 실패 상태로 떨어진다.
            const ok = await Promise.resolve()
                .then(() => (typeof text === 'function' ? text() : text))
                .then(
                    resolved =>
                        navigator.clipboard?.writeText(resolved) ??
                        Promise.reject()
                )
                .then(
                    () => true,
                    () => false
                );
            // 복사가 겹쳐 둘 다 대기 중이었다면 먼저 끝난 쪽이 건 타이머가 남아 있다 —
            // 지우지 않으면 마지막 복사의 표시 시간이 먼저 끝난 타이머에 잘린다.
            clearResetTimer();
            setStatus(ok ? 'copied' : 'failed');
            timeoutRef.current = setTimeout(() => setStatus('idle'), resetMs);
            return ok;
        },
        [clearResetTimer, resetMs]
    );

    useEffect(() => clearResetTimer, [clearResetTimer]);

    return {
        copied: status === 'copied',
        failed: status === 'failed',
        copy,
    };
}
