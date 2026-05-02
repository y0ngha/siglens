'use server';

import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleUserApiKeyRepository } from '@/infrastructure/db/userApiKeyRepository';
import { isLlmProvider } from '@/domain/llm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ApiKeyActionState } from '@/domain/llm';

export async function deleteApiKeyAction(
    _prevState: ApiKeyActionState,
    formData: FormData
): Promise<ApiKeyActionState> {
    const user = await getCurrentUser();
    if (user === null) {
        redirect('/login?next=/account');
    }

    const rawProvider = formData.get('provider') as string;
    if (!isLlmProvider(rawProvider)) {
        return { status: 'error', message: '유효하지 않은 프로바이더입니다.' };
    }

    try {
        const { db } = getDatabaseClient();
        await new DrizzleUserApiKeyRepository(db).deleteByUserAndProvider(
            user.id,
            rawProvider
        );
        revalidatePath('/account');
        return { status: 'success', message: '삭제되었습니다.' };
    } catch {
        return { status: 'error', message: '삭제 중 오류가 발생했습니다.' };
    }
}
