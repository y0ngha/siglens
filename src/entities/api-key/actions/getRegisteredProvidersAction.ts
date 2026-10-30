'use server';

import { DrizzleUserApiKeyRepository } from '@/entities/api-key/api';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import type { RegisteredProvider } from '@/shared/lib/types';

/**
 * 로그인 사용자가 키를 등록한 provider 목록(provider 오름차순). 키 값은 싣지 않고
 * provider와 갱신 시각만 돌려준다. 비로그인·조회 실패는 빈 배열이다.
 */
export async function getRegisteredProvidersAction(): Promise<
    RegisteredProvider[]
> {
    const user = await getCurrentUser();
    if (user === null) {
        return [];
    }

    try {
        const { db } = getDatabaseClient();
        const rows = await new DrizzleUserApiKeyRepository(db).findByUser(
            user.id
        );

        return rows
            .map((row): RegisteredProvider => ({
                provider: row.provider,
                updatedAt: row.updatedAt,
            }))
            .toSorted((a, b) => a.provider.localeCompare(b.provider));
    } catch (error) {
        // 기존 소비자를 위해 반환 형태는 []로 유지하되, 실패를 삼키지 않고
        // 로그로 남겨 DB 장애를 추적할 수 있게 한다.
        logActionError(
            '[getRegisteredProvidersAction] Failed to load registered providers',
            error
        );
        return [];
    }
}
