'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DrizzleSiglensApiKeyRepository } from '@/entities/siglens-api-key/api';
import type {
    RevokeSiglensApiKeyState,
    ReachableSiglensApiKeyErrorCode,
    SiglensApiKeyActionErrorCode,
} from '@/entities/siglens-api-key/model';
import { revokeApiKeyAuth } from '@/entities/siglens-api-key/server/apiKeyAuth';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import { getDatabaseClient } from '@/shared/db/client';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ERROR_MESSAGE_KEY: Partial<Record<SiglensApiKeyActionErrorCode, string>> =
    {
        unauthenticated: 'unauthenticated',
        not_found: 'notFound',
    };
const FALLBACK_MESSAGE_KEY = 'serverError';

async function errorState(
    code: ReachableSiglensApiKeyErrorCode
): Promise<RevokeSiglensApiKeyState> {
    const t = await getTranslations('entities.siglens-api-key.action');
    return {
        status: 'error',
        code,
        message: t(ERROR_MESSAGE_KEY[code] ?? FALLBACK_MESSAGE_KEY),
    };
}

/**
 * 본인의 API 키를 폐기한다. 폐기는 소프트 삭제(`revoked_at`)이며, 인증 캐시 항목을 바로
 * 지워 다음 요청부터 401이 되게 한다(캐시 삭제가 실패해도 TTL 안에 만료된다).
 */
export async function revokeSiglensApiKeyAction(
    _prevState: RevokeSiglensApiKeyState,
    formData: FormData
): Promise<RevokeSiglensApiKeyState> {
    // 서버 액션은 화면 밖에서도 직접 호출할 수 있다 — 출시 전에는 화면을 가리는 것만으로 부족하다.
    if (!isPublicApiEnabled())
        return {
            status: 'error',
            code: 'not_available',
            // UI에서 도달하지 않는 직접 호출 전용 거절이라 번역 키를 두지 않는다.
            message: 'API keys are not available.',
        };
    try {
        const user = await getCurrentUser();
        if (user === null) return await errorState('unauthenticated');

        const keyId = formData.get('keyId');
        if (typeof keyId !== 'string' || !UUID_PATTERN.test(keyId))
            return await errorState('not_found');

        const result = await new DrizzleSiglensApiKeyRepository(
            getDatabaseClient().db
        ).revokeOwned(user.id, keyId);
        if (result.status === 'not_found') return await errorState('not_found');

        await revokeApiKeyAuth([result.keyHash]);
        revalidatePath('/[locale]/account', 'page');
        return { status: 'revoked' };
    } catch (error) {
        console.error('[revokeSiglensApiKeyAction] failed:', error);
        return await errorState('server_error');
    }
}
