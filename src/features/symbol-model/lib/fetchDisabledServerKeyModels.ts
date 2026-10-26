import type { ModelId } from '@y0ngha/siglens-core';
import {
    isRosterModelId,
    MODEL_AVAILABILITY_PATH,
} from '@/shared/lib/modelAvailability';

const NONE: readonly ModelId[] = [];

/**
 * 운영자가 꺼 둔 서버 키 모델을 받아 온다. Server Action이 아니라 Route Handler인 이유는
 * `app/api/analysis/model-availability/route.ts` 참고(CDN 캐시, 다른 액션과의 직렬 처리 회피).
 */
export async function fetchDisabledServerKeyModels(): Promise<
    readonly ModelId[]
> {
    const response = await fetch(MODEL_AVAILABILITY_PATH);
    if (!response.ok) throw new Error(`model availability ${response.status}`);
    // 응답 모양을 믿지 않고 좁힌다 — 모르는 값은 버린다(배포 중 로스터가 엇갈린 경우).
    const body: unknown = await response.json();
    if (
        typeof body !== 'object' ||
        body === null ||
        !('disabledModels' in body) ||
        !Array.isArray(body.disabledModels)
    ) {
        return NONE;
    }
    return body.disabledModels.filter(isRosterModelId);
}
