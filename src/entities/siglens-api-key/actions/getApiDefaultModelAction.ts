'use server';

import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { DrizzleSiglensApiKeyRepository } from '@/entities/siglens-api-key/api';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';

/**
 * 본인의 API 기본 모델. 비로그인·미설정·조회 실패는 모두 `null`(조회 실패는 로그를 남긴다 —
 * 화면은 "미설정"으로 보여 줄 뿐 요청 경로는 이 액션을 쓰지 않는다).
 */
export async function getApiDefaultModelAction(): Promise<string | null> {
    // 출시 전에는 기본 모델을 읽지 않는다(세션·DB 조회 없음).
    if (!isPublicApiEnabled()) return null;
    // 세션 조회(cookies)는 try 밖에 둔다 — `listSiglensApiKeysAction`과 같은 이유.
    const user = await getCurrentUser();
    if (user === null) return null;
    try {
        return await new DrizzleSiglensApiKeyRepository(
            getDatabaseClient().db
        ).findApiDefaultModel(user.id);
    } catch (error) {
        logActionError('[getApiDefaultModelAction] failed:', error);
        return null;
    }
}
