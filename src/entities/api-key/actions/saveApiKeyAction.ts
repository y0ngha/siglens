'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { DrizzleUserApiKeyRepository } from '@/entities/api-key/api';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { localeRedirect } from '@/shared/i18n/localeRedirect';
import { logActionError } from '@/shared/lib/logActionError';
import type {
    ApiKeyActionErrorCode,
    ApiKeyActionState,
} from '@/shared/lib/types';
import { isLlmProvider, normalizeLlmApiKey } from '../lib/apiKey';
import { classifySaveApiKeyError } from '../lib/saveApiKeyError';

/** 에러 코드 → `entities.api-key.action` 메시지 키. */
const ERROR_MESSAGE_KEY: Record<ApiKeyActionErrorCode, string> = {
    invalid_key_format: 'invalidKeyFormat',
    server_misconfigured: 'serverMisconfigured',
    storage_unavailable: 'storageUnavailable',
    unknown: 'unknown',
};

/** 분류된 저장 실패 코드별 서버 로그 문구. */
const LOG_MESSAGE = {
    server_misconfigured: 'Server encryption key misconfigured',
    storage_unavailable: 'Database error during user API key upsert',
    unknown: 'Unexpected error during user API key upsert',
} as const satisfies Partial<Record<ApiKeyActionErrorCode, string>>;

/**
 * 액션이 문구를 직접 만든다 — 상태의 `message`가 그대로 화면에 뿌려지므로
 * 요청 로케일로 번역해야 한다. `getTranslations`는 서버 액션에서도 요청
 * 로케일을 잡는다(`getBarsAction`·`optionsActions`가 같은 패턴).
 */
async function buildErrorState(
    code: ApiKeyActionErrorCode
): Promise<ApiKeyActionState> {
    const t = await getTranslations('entities.api-key.action');
    return {
        status: 'error',
        message: t(ERROR_MESSAGE_KEY[code]),
        code,
    };
}

/**
 * `/account`의 키 등록 폼 액션. 로그인한 본인 계정(`user.id`)에만 저장하며,
 * 평문 키는 로그·반환 상태에 싣지 않는다. 실패는 코드별 번역 문구로 돌려준다.
 */
export async function saveApiKeyAction(
    _prevState: ApiKeyActionState,
    formData: FormData
): Promise<ApiKeyActionState> {
    const user = await getCurrentUser();
    if (user === null) {
        return localeRedirect('/login?next=/account');
    }

    const rawProvider = formData.get('provider');
    if (typeof rawProvider !== 'string' || !isLlmProvider(rawProvider)) {
        const t = await getTranslations('entities.api-key.action');
        return {
            status: 'error',
            message: t('invalidProvider'),
            code: 'invalid_key_format',
        };
    }

    const rawApiKey = formData.get('apiKey');
    const apiKey = normalizeLlmApiKey(
        typeof rawApiKey === 'string' ? rawApiKey : ''
    );
    if (apiKey === null) {
        return buildErrorState('invalid_key_format');
    }
    const t = await getTranslations('entities.api-key.action');

    try {
        const { db } = getDatabaseClient();
        await new DrizzleUserApiKeyRepository(db).upsert({
            userId: user.id,
            provider: rawProvider,
            apiKey,
        });
        // 실제 렌더 경로는 `/[locale]/account`다. `'/account'`로는 어떤 경로도
        // 매칭되지 않아 조용한 no-op이 된다.
        revalidatePath('/[locale]/account', 'page');
        return {
            status: 'success',
            message: t('saved'),
        };
    } catch (error) {
        const code = classifySaveApiKeyError(error);
        logActionError(`[saveApiKeyAction] ${LOG_MESSAGE[code]}`, error);
        return buildErrorState(code);
    }
}
