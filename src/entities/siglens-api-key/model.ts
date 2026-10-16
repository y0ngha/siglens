import type { Tier } from '@y0ngha/siglens-core';

/** 목록·계정 화면에 보이는 키 한 줄. 원문과 해시는 담지 않는다. */
export interface SiglensApiKeySummary {
    id: string;
    name: string;
    /** 표시용 접두(`slk_ab12cd`). 원문의 앞부분일 뿐 인증에는 쓸 수 없다. */
    keyPrefix: string;
    createdAt: Date;
    lastUsedAt: Date | null;
}

export interface CreateSiglensApiKeyInput {
    userId: string;
    name: string;
    keyPrefix: string;
    keyHash: string;
}

export type CreateSiglensApiKeyResult =
    | { status: 'created'; key: SiglensApiKeySummary }
    | { status: 'limit_reached' };

/**
 * 인증된 요청 주체. `tier`는 인증 캐시(60초)에서 오므로 그만큼 늦을 수 있다.
 * 모든 도구 호출의 `userId`는 반드시 이 값에서 온다 — 요청 인자에서 받지 않는다.
 */
export interface ApiKeyPrincipal {
    keyId: string;
    keyName: string;
    keyPrefix: string;
    userId: string;
    tier: Tier;
}

export type ApiKeyAuthResult =
    | { status: 'ok'; principal: ApiKeyPrincipal }
    | { status: 'invalid' }
    | { status: 'unavailable' };

export type RevokeSiglensApiKeyResult =
    | { status: 'revoked'; keyHash: string }
    | { status: 'not_found' };

export type SiglensApiKeyActionErrorCode =
    | 'unauthenticated'
    | 'email_not_verified'
    | 'invalid_name'
    | 'limit_reached'
    | 'not_found'
    | 'server_error'
    /** 공개 API 출시 플래그가 꺼져 있다(`isPublicApiEnabled`). 직접 호출된 액션만 받는다. */
    | 'not_available';

/**
 * 키 발급 액션 상태. `created`의 `rawKey`는 이 응답에서만 존재한다 — 서버에는 해시만 남고
 * 다시 읽을 방법이 없다. 화면은 이 값을 상태에서 꺼내 한 번 보여 주고 버린다.
 */
export type CreateSiglensApiKeyState =
    | { status: 'idle' }
    | {
          status: 'created';
          rawKey: string;
          keyName: string;
          keyPrefix: string;
      }
    | {
          status: 'error';
          code: SiglensApiKeyActionErrorCode;
          message: string;
      };

export type RevokeSiglensApiKeyState =
    | { status: 'idle' }
    | { status: 'revoked' }
    | {
          status: 'error';
          code: SiglensApiKeyActionErrorCode;
          message: string;
      };

export type ApiDefaultModelErrorCode =
    | 'unauthenticated'
    | 'invalid_model'
    | 'provider_key_missing'
    | 'server_error'
    /** 공개 API 출시 플래그가 꺼져 있다(`isPublicApiEnabled`). 직접 호출된 액션만 받는다. */
    | 'not_available';

/**
 * API 기본 모델 저장 액션 상태. `saved.model`이 `null`이면 설정을 해제했다는 뜻이다.
 */
export type SetApiDefaultModelState =
    | { status: 'idle' }
    | { status: 'saved'; model: string | null }
    | {
          status: 'error';
          code: ApiDefaultModelErrorCode;
          message: string;
      };
