import type { Tier } from '@y0ngha/siglens-core';
import { getCurrentUser } from './getCurrentUser';
import { resolveTierOnly } from '@/shared/lib/byokGate';
import { isCacheScopeDynamicUsage } from '@/shared/lib/isCacheScopeDynamicUsage';

/**
 * 호출자의 tier를 해석한다. 해석에 실패하면 **'free'로 fail-closed** 한다 —
 * 상위 tier로 오인해 잠긴 상세를 노출하는 것보다, 실제로는 회원인 호출자가
 * 일시적으로 free 취급되는 편이 안전하다.
 *
 * prerender/캐시 스코프에서 발생하는 제어 흐름 에러는 로그를 남기지 않는다
 * (위 `isCacheScopeDynamicUsage` 주석 참조). 그 외 진짜 실패만 `scope` 접두와
 * 함께 남겨 조치 가능한 신호로 유지한다.
 */
export async function resolveCallerTier(scope: string): Promise<Tier> {
    try {
        const user = await getCurrentUser();
        return await resolveTierOnly(user?.id ?? null);
    } catch (error) {
        if (!isCacheScopeDynamicUsage(error)) {
            console.error(`[${scope}] Failed to resolve caller tier:`, error);
        }
        return 'free';
    }
}
