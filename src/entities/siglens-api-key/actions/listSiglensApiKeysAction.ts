'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DrizzleSiglensApiKeyRepository } from '@/entities/siglens-api-key/api';
import type { SiglensApiKeySummary } from '@/entities/siglens-api-key/model';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import { getDatabaseClient } from '@/shared/db/client';

/**
 * 본인의 활성 API 키 목록(오래된 순). 비로그인은 `[]`, 조회 실패는 `null` — 빈 목록과
 * 구분해야 화면이 "키가 없다"고 거짓으로 말하지 않는다.
 */
export async function listSiglensApiKeysAction(): Promise<
    SiglensApiKeySummary[] | null
> {
    // 출시 전에는 키 데이터를 읽지 않는다(세션·DB 조회 없음).
    if (!isPublicApiEnabled()) return [];
    // 세션 조회(cookies)는 try 밖에 둔다 — 안에 두면 Next의 동적 렌더 신호
    // (DYNAMIC_SERVER_USAGE)를 조회 실패로 삼켜 로그를 오염시키고 렌더 판정을 흐린다.
    // `getRegisteredProvidersAction`과 같은 구조다.
    const user = await getCurrentUser();
    if (user === null) return [];
    try {
        return await new DrizzleSiglensApiKeyRepository(
            getDatabaseClient().db
        ).listActiveByUser(user.id);
    } catch (error) {
        console.error('[listSiglensApiKeysAction] failed:', error);
        return null;
    }
}
