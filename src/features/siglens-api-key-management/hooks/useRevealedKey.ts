'use client';

import { useCallback, useState } from 'react';
import type { CreateSiglensApiKeyState } from '@/entities/siglens-api-key/model';

/** 지금 보여 줄 새 키 원문과, 사용자가 "보관했어요"로 그것을 치우는 함수. */
export interface RevealedKeyControl {
    /** 아직 치우지 않은 마지막 발급 키의 원문. 없으면 `null`. */
    revealedKey: string | null;
    /**
     * 새 키가 발급될 때마다 1씩 오르는 번호. 키 패널을 다시 마운트할 React `key`로 쓴다 —
     * 원문을 `key`에 넣으면 DevTools·개발 경고로 비밀값이 한 번 더 드러난다.
     */
    revealId: number;
    /** 원문을 화면에서 치운다. 참조가 안정적이다. */
    dismiss: () => void;
}

/**
 * 발급 응답의 원문을 사용자가 치울 때까지 붙잡아 둔다.
 *
 * 원문은 발급 응답에만 있고 서버에는 해시만 남는다. 발급 상태를 그대로 보면, 원문을 보관하기
 * 전에 다시 낸 발급이 실패하는 순간(비운 이름으로 한 번 더 누름 등) 상태가 오류로 바뀌어 원문이
 * 사라지고 되찾을 길이 없다. 그래서 새 `created` 상태가 올 때만 원문을 바꾸고, 오류 상태는
 * 원문을 건드리지 않는다. 새 키를 또 만들면 그 키가 앞 키를 대신한다.
 */
export function useRevealedKey(
    createState: CreateSiglensApiKeyState
): RevealedKeyControl {
    const [seenState, setSeenState] = useState(createState);
    const [revealedKey, setRevealedKey] = useState<string | null>(
        createState.status === 'created' ? createState.rawKey : null
    );

    const [revealId, setRevealId] = useState(0);

    const dismiss = useCallback(() => setRevealedKey(null), []);

    // 새 액션 결과가 온 렌더에서 바로 맞춘다 — effect로 미루면 새 원문이 한 커밋 늦게 뜬다(REACT.md#EF-1).
    if (createState !== seenState) {
        setSeenState(createState);
        if (createState.status === 'created') {
            setRevealedKey(createState.rawKey);
            setRevealId(id => id + 1);
        }
    }

    return { revealedKey, revealId, dismiss };
}
