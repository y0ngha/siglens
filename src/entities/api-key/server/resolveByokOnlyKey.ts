import 'server-only';
import { getProviderForModel, type ModelId } from '@y0ngha/siglens-core';
import {
    DrizzleUserApiKeyRepository,
    LlmApiKeyDecryptionFailedError,
} from '@/entities/api-key/api';
import type { LlmProvider } from '@/shared/config/llmProviders';
import { getDatabaseClient } from '@/shared/db/client';

/**
 * - `ok`: 그 모델 provider의 사용자 키(복호화됨).
 * - `byok_key_required`: 쓸 수 있는 키가 없다. `reason`이 `not_registered`면 등록된 적이 없고,
 *   `unreadable`이면 저장된 암호문을 복호화하지 못해 다시 등록해야 한다.
 */
export type ByokOnlyKeyResult =
    | { status: 'ok'; provider: LlmProvider; apiKey: string }
    | {
          status: 'byok_key_required';
          provider: LlmProvider;
          reason: 'not_registered' | 'unreadable';
      };

/**
 * 공개 API 전용 키 해석: **사용자 자신의 BYOK 키만** 돌려준다. `resolveTierAndByok`와 달리 모델 등급·tier에
 * 따라 서버 키로 넘어가는 분기가 없고, 서버 키 env(`getServerPrimaryKey`)는 읽지도 않는다 — 키가 없으면
 * fallback 없이 `byok_key_required { provider }`를 돌려준다.
 *
 * `userId`는 호출부가 **인증된 키의 소유 회원**에서 가져온다. 저장소 조회가 `user_id`로 걸리므로
 * 다른 회원의 키는 이 경로로 닿지 않는다.
 *
 * DB·복호화 설정 오류는 던진다(키가 없는 것과 구분해야 호출부가 503/500으로 다룰 수 있다).
 */
export async function resolveByokOnlyKey(
    userId: string,
    modelId: ModelId
): Promise<ByokOnlyKeyResult> {
    const provider = getProviderForModel(modelId);
    try {
        const record = await new DrizzleUserApiKeyRepository(
            getDatabaseClient().db
        ).findByUserAndProvider(userId, provider);
        return record === null
            ? {
                  status: 'byok_key_required',
                  provider,
                  reason: 'not_registered',
              }
            : { status: 'ok', provider, apiKey: record.apiKey };
    } catch (error) {
        if (error instanceof LlmApiKeyDecryptionFailedError) {
            return {
                status: 'byok_key_required',
                provider,
                reason: 'unreadable',
            };
        }
        throw error;
    }
}
