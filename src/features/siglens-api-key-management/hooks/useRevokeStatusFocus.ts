'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { RevokeSiglensApiKeyState } from '@/entities/siglens-api-key/model';

/**
 * 폐기가 성공하면 섹션의 폐기 상태 영역으로 포커스를 옮긴다. 돌려준 ref를 그 영역
 * (`tabIndex={-1}`)에 단다.
 *
 * 성공하면 누른 행이 목록 갱신으로 사라져, 그대로 두면 포커스가 `<body>`로 떨어진다. 새 결과
 * 객체가 왔을 때만 옮긴다 — 마운트 시점의 상태로는 포커스를 빼앗지 않는다.
 */
export function useRevokeStatusFocus(
    revokeState: RevokeSiglensApiKeyState
): RefObject<HTMLDivElement | null> {
    const regionRef = useRef<HTMLDivElement>(null);
    const handledStateRef = useRef(revokeState);

    useEffect(() => {
        if (handledStateRef.current === revokeState) return;
        handledStateRef.current = revokeState;
        if (revokeState.status === 'revoked') regionRef.current?.focus();
    }, [revokeState]);

    return regionRef;
}
