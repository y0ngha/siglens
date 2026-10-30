'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { DrizzleSiglensApiKeyRepository } from '@/entities/siglens-api-key/api';
import { validateKeyName } from '@/entities/siglens-api-key/lib/validateKeyName';
import type {
    CreateSiglensApiKeyState,
    ReachableSiglensApiKeyErrorCode,
} from '@/entities/siglens-api-key/model';
import { generateApiKey } from '@/entities/siglens-api-key/server/apiKeyToken';
import {
    API_KEY_MAX_ACTIVE_PER_USER,
    API_KEY_NAME_MAX_LENGTH,
} from '@/shared/config/publicApi';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import { getDatabaseClient } from '@/shared/db/client';

/** 에러 코드 → `entities.siglens-api-key.action` 메시지 키. */
const ERROR_MESSAGE_KEY: Record<ReachableSiglensApiKeyErrorCode, string> = {
    unauthenticated: 'unauthenticated',
    email_not_verified: 'emailNotVerified',
    invalid_name: 'invalidName',
    limit_reached: 'limitReached',
    not_found: 'notFound',
    server_error: 'serverError',
};

/** ICU 인자(`{v0}`)로 넘기는 상한 — 카탈로그 문구에 숫자를 적지 않는다(I18N.md#I18-6). */
const ERROR_MESSAGE_VALUES: Partial<
    Record<ReachableSiglensApiKeyErrorCode, { v0: number }>
> = {
    invalid_name: { v0: API_KEY_NAME_MAX_LENGTH },
    limit_reached: { v0: API_KEY_MAX_ACTIVE_PER_USER },
};

async function errorState(
    code: ReachableSiglensApiKeyErrorCode
): Promise<CreateSiglensApiKeyState> {
    const t = await getTranslations('entities.siglens-api-key.action');
    return {
        status: 'error',
        code,
        message: t(ERROR_MESSAGE_KEY[code], ERROR_MESSAGE_VALUES[code]),
    };
}

/**
 * 새 SigLens API 키를 발급한다. 이메일 인증을 마친 회원만 받을 수 있다.
 *
 * 원문은 응답 상태에 한 번만 실린다. DB에는 sha256 해시와 표시용 접두만 저장하므로 이
 * 응답을 놓치면 다시 볼 수 없다(폐기 후 재발급).
 */
export async function createSiglensApiKeyAction(
    _prevState: CreateSiglensApiKeyState,
    formData: FormData
): Promise<CreateSiglensApiKeyState> {
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
        if (!user.emailVerified) return await errorState('email_not_verified');

        const name = validateKeyName(formData.get('name'));
        if (name === null) return await errorState('invalid_name');

        const { rawKey, keyPrefix, keyHash } = generateApiKey();
        const result = await new DrizzleSiglensApiKeyRepository(
            getDatabaseClient().db
        ).createWithinLimit(
            { userId: user.id, name, keyPrefix, keyHash },
            API_KEY_MAX_ACTIVE_PER_USER
        );
        if (result.status === 'limit_reached')
            return await errorState('limit_reached');

        // 실제 렌더 경로는 `/[locale]/account`다. `'/account'`는 조용한 no-op이 된다.
        revalidatePath('/[locale]/account', 'page');
        return {
            status: 'created',
            rawKey,
            keyName: result.key.name,
            keyPrefix: result.key.keyPrefix,
        };
    } catch (error) {
        console.error('[createSiglensApiKeyAction] failed:', error);
        return await errorState('server_error');
    }
}
