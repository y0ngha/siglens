'use server';

import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleUserApiKeyRepository } from '@/infrastructure/db/userApiKeyRepository';
import { isLlmProvider, normalizeLlmApiKey } from '@/domain/llm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { SaveApiKeyState } from '@/infrastructure/llm/types';

export async function saveApiKeyAction(
    _prevState: SaveApiKeyState,
    formData: FormData
): Promise<SaveApiKeyState> {
    const user = await getCurrentUser();
    if (user === null) {
        redirect('/login?next=/account');
    }

    const rawProvider = formData.get('provider') as string;
    if (!isLlmProvider(rawProvider)) {
        return { status: 'error', message: '유효하지 않은 프로바이더입니다.' };
    }

    const rawApiKey = formData.get('apiKey') as string;
    const apiKey = normalizeLlmApiKey(rawApiKey ?? '');
    if (apiKey === null) {
        return { status: 'error', message: '유효하지 않은 API 키입니다.' };
    }

    try {
        const { db } = getDatabaseClient();
        await new DrizzleUserApiKeyRepository(db).upsert({
            userId: user.id,
            provider: rawProvider,
            apiKey,
        });
        revalidatePath('/account');
        return { status: 'success', message: 'API 키가 저장되었습니다.' };
    } catch {
        return { status: 'error', message: '저장 중 오류가 발생했습니다.' };
    }
}
