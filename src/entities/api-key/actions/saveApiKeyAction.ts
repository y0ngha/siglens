'use server';

import { localeRedirect } from '@/shared/i18n/localeRedirect';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleUserApiKeyRepository } from '@/entities/api-key/api';
import { isLlmProvider, normalizeLlmApiKey } from '../lib/apiKey';
import type { ApiKeyActionErrorCode, ApiKeyActionState } from '../lib/types';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';

/** 에러 코드 → `entities.api-key.action` 메시지 키. */
const ERROR_MESSAGE_KEY: Record<ApiKeyActionErrorCode, string> = {
    invalid_key_format: 'invalidKeyFormat',
    server_misconfigured: 'serverMisconfigured',
    storage_unavailable: 'storageUnavailable',
    unknown: 'unknown',
};

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

/** Identifies the misconfigured-encryption-key error thrown by the repository. */
function isEncryptionKeyMisconfigured(error: unknown): boolean {
    return (
        error instanceof Error &&
        error.message.includes('LLM_API_KEY_ENCRYPTION_KEY')
    );
}

/**
 * Best-effort detection of a Postgres-driver error.
 *
 * `postgres-js` and `pg` both attach a 5-character SQLSTATE on `error.code`
 * (e.g. `'23505'` for unique violation, `'08006'` for connection failure).
 * Detecting this shape lets us distinguish "DB layer failure" (recoverable
 * by retry / surfaced as `storage_unavailable`) from genuinely unexpected
 * exceptions which should fall through to `unknown` so we don't mislead the
 * user about the failure mode.
 */
function isLikelyDatabaseError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code);
}

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
            ...(await buildErrorState('invalid_key_format')),
            message: t('invalidProvider'),
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
        if (isEncryptionKeyMisconfigured(error)) {
            console.error(
                '[saveApiKeyAction] Server encryption key misconfigured',
                error
            );
            return buildErrorState('server_misconfigured');
        }
        if (isLikelyDatabaseError(error)) {
            console.error(
                '[saveApiKeyAction] Database error during user API key upsert',
                error
            );
            return buildErrorState('storage_unavailable');
        }
        console.error(
            '[saveApiKeyAction] Unexpected error during user API key upsert',
            error
        );
        return buildErrorState('unknown');
    }
}
