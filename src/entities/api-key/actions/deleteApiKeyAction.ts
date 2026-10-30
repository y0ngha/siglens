'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { DrizzleUserApiKeyRepository } from '@/entities/api-key/api';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { localeRedirect } from '@/shared/i18n/localeRedirect';
import { logActionError } from '@/shared/lib/logActionError';
import type { ApiKeyActionState } from '@/shared/lib/types';
import { isLlmProvider } from '../lib/apiKey';

/**
 * `/account`의 키 삭제 폼 액션. 삭제 조건에 `user.id`가 들어가 본인 키만 지워진다.
 */
export async function deleteApiKeyAction(
    _prevState: ApiKeyActionState,
    formData: FormData
): Promise<ApiKeyActionState> {
    const user = await getCurrentUser();
    if (user === null) {
        return localeRedirect('/login?next=/account');
    }

    const t = await getTranslations('entities.api-key.action');
    const rawProvider = formData.get('provider');
    if (typeof rawProvider !== 'string' || !isLlmProvider(rawProvider)) {
        return { status: 'error', message: t('invalidProvider') };
    }

    try {
        const { db } = getDatabaseClient();
        await new DrizzleUserApiKeyRepository(db).deleteByUserAndProvider(
            user.id,
            rawProvider
        );
        // 실제 렌더 경로는 `/[locale]/account`다. `'/account'`로는 어떤 경로도
        // 매칭되지 않아 조용한 no-op이 된다.
        revalidatePath('/[locale]/account', 'page');
        return { status: 'success', message: t('deleted') };
    } catch (error) {
        logActionError(
            '[deleteApiKeyAction] Failed to delete user API key',
            error
        );
        return { status: 'error', message: t('deleteFailed') };
    }
}
