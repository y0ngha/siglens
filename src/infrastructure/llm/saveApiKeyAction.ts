'use server';

import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleUserApiKeyRepository } from '@/entities/api-key';
import {
    isLlmProvider,
    normalizeLlmApiKey,
    type ApiKeyActionErrorCode,
    type ApiKeyActionState,
} from '@/domain/llm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

interface ErrorMessageEntry {
    readonly message: string;
}

const ERROR_MESSAGES: Record<ApiKeyActionErrorCode, ErrorMessageEntry> = {
    invalid_key_format: { message: '유효하지 않은 API 키입니다.' },
    server_misconfigured: {
        message:
            '서버 설정 오류로 API 키를 저장할 수 없습니다. 관리자에게 문의해 주세요.',
    },
    storage_unavailable: {
        message:
            'API 키 저장소에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    },
    unknown: { message: '저장 중 알 수 없는 오류가 발생했습니다.' },
};

function buildErrorState(code: ApiKeyActionErrorCode): ApiKeyActionState {
    return {
        status: 'error',
        message: ERROR_MESSAGES[code].message,
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
        redirect('/login?next=/account');
    }

    const rawProvider = formData.get('provider');
    if (typeof rawProvider !== 'string' || !isLlmProvider(rawProvider)) {
        return {
            ...buildErrorState('invalid_key_format'),
            message: '유효하지 않은 프로바이더입니다.',
        };
    }

    const rawApiKey = formData.get('apiKey');
    const apiKey = normalizeLlmApiKey(
        typeof rawApiKey === 'string' ? rawApiKey : ''
    );
    if (apiKey === null) {
        return buildErrorState('invalid_key_format');
    }

    try {
        const { db } = getDatabaseClient();
        await new DrizzleUserApiKeyRepository(db).upsert({
            userId: user.id,
            provider: rawProvider,
            apiKey,
        });
        revalidatePath('/account');
        return {
            status: 'success',
            message: 'API 키가 저장되었습니다.',
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
