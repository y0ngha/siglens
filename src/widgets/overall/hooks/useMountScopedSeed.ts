'use client';

import { useState } from 'react';
import { isSameQueryKey } from '../utils/isSameQueryKey';

/**
 * SSR seed를 **마운트 시점의 queryKey에만** 적용한다.
 *
 * React Query는 `initialData`를 "지금 활성화된 key"에 다시 적용하므로, key가 바뀌어도
 * 옛 seed가 새 key를 채우고 `staleTime: Infinity`가 그걸 fresh로 취급해 fetch를
 * 건너뛴다. 그러면 tier 확정으로 modelId가 회원의 저장 모델로 바뀐 직후, 기본 모델로
 * 만든 SSR 서사가 회원 모델의 결과인 척 굳는다. 마운트 key가 아니면 seed를 떼서 새
 * key가 빈 상태로 시작하게 한다.
 *
 * 마운트 key는 렌더 중에 읽어야 하므로 ref가 아니라 state로 잡는다(CR-2).
 */
export function useMountScopedSeed<T>(
    queryKey: readonly unknown[],
    seed: T | undefined
): T | undefined {
    const [mountQueryKey] = useState(queryKey);
    return isSameQueryKey(queryKey, mountQueryKey) ? seed : undefined;
}
