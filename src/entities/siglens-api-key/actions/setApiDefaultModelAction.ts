'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { DrizzleUserApiKeyRepository } from '@/entities/api-key/api';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { DrizzleSiglensApiKeyRepository } from '@/entities/siglens-api-key/api';
import { checkApiModel } from '@/entities/siglens-api-key/lib/apiModels';
import type {
    ReachableApiDefaultModelErrorCode,
    SetApiDefaultModelState,
} from '@/entities/siglens-api-key/model';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import { getDatabaseClient } from '@/shared/db/client';

const ERROR_MESSAGE_KEY: Record<ReachableApiDefaultModelErrorCode, string> = {
    unauthenticated: 'unauthenticated',
    invalid_model: 'invalidModel',
    provider_key_missing: 'modelProviderKeyMissing',
    server_error: 'serverError',
};

async function errorState(
    code: ReachableApiDefaultModelErrorCode
): Promise<SetApiDefaultModelState> {
    const t = await getTranslations('entities.siglens-api-key.action');
    return { status: 'error', code, message: t(ERROR_MESSAGE_KEY[code]) };
}

/**
 * 공개 API의 기본 모델(`users.api_default_model`)을 저장한다. 빈 값이면 해제한다(`null`).
 *
 * 서버가 다시 검증한다 — 화면 선택지는 신뢰하지 않는다:
 *  - 로스터(`TIER_CONFIG`)에 있고 사용자 키로 생성할 수 있는 등급(`byok`)이어야 한다.
 *  - 그 모델 provider의 BYOK 키가 **이 회원에게** 등록돼 있어야 한다. 키가 없는 모델을 기본값으로
 *    두면 모든 `run_fresh_analysis`가 `byok_key_required`로 끝난다.
 *
 * 키를 지운 뒤에도 저장된 기본 모델은 남는다(요청 시점에 다시 키를 확인한다).
 */
export async function setApiDefaultModelAction(
    _prevState: SetApiDefaultModelState,
    formData: FormData
): Promise<SetApiDefaultModelState> {
    // 서버 액션은 화면 밖에서도 직접 호출할 수 있다 — 출시 전에는 화면을 가리는 것만으로 부족하다.
    if (!isPublicApiEnabled())
        return {
            status: 'error',
            code: 'not_available',
            // UI에서 도달하지 않는 직접 호출 전용 거절이라 번역 키를 두지 않는다.
            message: 'The API default model is not available.',
        };
    try {
        const user = await getCurrentUser();
        if (user === null) return await errorState('unauthenticated');

        const raw = formData.get('model');
        if (typeof raw !== 'string') return await errorState('invalid_model');
        const requested = raw.trim();

        const { db } = getDatabaseClient();
        const repo = new DrizzleSiglensApiKeyRepository(db);

        if (requested === '') {
            await repo.setApiDefaultModel(user.id, null);
            revalidatePath('/[locale]/account', 'page');
            return { status: 'saved', model: null };
        }

        const registered = await new DrizzleUserApiKeyRepository(db).findByUser(
            user.id
        );
        const check = checkApiModel(
            requested,
            registered.map(row => row.provider)
        );
        if (!check.ok) return await errorState(check.reason);

        const saved = await repo.setApiDefaultModel(user.id, check.model);
        if (!saved) return await errorState('unauthenticated');
        revalidatePath('/[locale]/account', 'page');
        return { status: 'saved', model: check.model };
    } catch (error) {
        console.error('[setApiDefaultModelAction] failed:', error);
        return await errorState('server_error');
    }
}
