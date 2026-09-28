'use client';

import { useEffect, useRef, useState } from 'react';

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

export const DEFAULT_RESET_MS = 2000;

type CopyStatus = 'idle' | 'copied' | 'failed';

export function useCopyToClipboard(
    resetMs = DEFAULT_RESET_MS
): UseCopyToClipboardReturn {
    const [status, setStatus] = useState<CopyStatus>('idle');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const copy = async (text: string | (() => string)): Promise<boolean> => {
        if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
        // `navigator.clipboard`는 비보안 컨텍스트(http)에서 아예 없다. try/throw 대신
        // 프로미스 두 갈래로 받는다 — React Compiler는 try/catch 안의 throw를 컴파일하지 못한다.
        // 텍스트 생성도 같은 체인 안에서 해야 생성 중 예외가 실패 상태로 떨어진다.
        const ok = await Promise.resolve()
            .then(() => (typeof text === 'function' ? text() : text))
            .then(
                resolved =>
                    navigator.clipboard?.writeText(resolved) ?? Promise.reject()
            )
            .then(
                () => true,
                () => false
            );
        setStatus(ok ? 'copied' : 'failed');
        timeoutRef.current = setTimeout(() => setStatus('idle'), resetMs);
        return ok;
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
        };
    }, []);

    return {
        copied: status === 'copied',
        failed: status === 'failed',
        copy,
    };
}
