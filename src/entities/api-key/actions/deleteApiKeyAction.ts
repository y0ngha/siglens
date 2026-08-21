'use server';

import { localeRedirect } from '@/shared/i18n/localeRedirect';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleUserApiKeyRepository } from '@/entities/api-key/api';
import { isLlmProvider } from '../lib/apiKey';
import type { ApiKeyActionState } from '../lib/types';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';

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
    } catch {
        return { status: 'error', message: t('deleteFailed') };
    }
}
