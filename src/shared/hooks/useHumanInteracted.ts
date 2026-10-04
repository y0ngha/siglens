'use client';

import { useSyncExternalStore } from 'react';
import {
    hasHumanInteracted,
    subscribeHumanInteraction,
} from '@/shared/lib/humanInteractionStore';

/** 서버 렌더와 하이드레이션 첫 렌더는 항상 `false` — 마운트 뒤 실제 값으로 바뀐다. */
const getServerSnapshot = (): boolean => false;

/** 이 탭에서 신뢰 입력이 있었는지 구독한다(`humanInteractionStore` 참고). */
export function useHumanInteracted(): boolean {
    return useSyncExternalStore(
        subscribeHumanInteraction,
        hasHumanInteracted,
        getServerSnapshot
    );
}
