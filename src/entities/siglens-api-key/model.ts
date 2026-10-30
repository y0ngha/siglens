import type { Tier } from '@y0ngha/siglens-core';
import type { YamlValue } from '@/shared/lib/toYaml';

/** 목록·계정 화면에 보이는 키 한 줄. 원문과 해시는 담지 않는다. */
export interface SiglensApiKeySummary {
    id: string;
    name: string;
    /** 표시용 접두(`slk_ab12cd`). 원문의 앞부분일 뿐 인증에는 쓸 수 없다. */
    keyPrefix: string;
    createdAt: Date;
    lastUsedAt: Date | null;
}

/** 발급 저장 입력. 원문은 없고 접두·해시만 DB에 간다. */
export interface CreateSiglensApiKeyInput {
    userId: string;
    name: string;
    keyPrefix: string;
    keyHash: string;
}

/** `limit_reached`면 활성 키 수 상한에 걸려 아무것도 저장하지 않았다. */
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

/**
 * Bearer 인증 결과. `invalid`는 사유를 구분하지 않고 같은 401을 내는 신호이고,
 * `unavailable`은 키 저장소 장애라 503으로 낮춘다.
 */
export type ApiKeyAuthResult =
    | { status: 'ok'; principal: ApiKeyPrincipal }
    | { status: 'invalid' }
    | { status: 'unavailable' };

/** `keyHash`는 폐기 직후 인증 캐시를 끊는 데 쓴다. 남의 키이거나 이미 폐기됐으면 `not_found`. */
export type RevokeSiglensApiKeyResult =
    | { status: 'revoked'; keyHash: string }
    | { status: 'not_found' };

/** 키 발급·폐기 액션의 오류 코드. */
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

/** 키 폐기 액션 상태. */
export type RevokeSiglensApiKeyState =
    | { status: 'idle' }
    | { status: 'revoked' }
    | {
          status: 'error';
          code: SiglensApiKeyActionErrorCode;
          message: string;
      };

/** API 기본 모델 저장 액션의 오류 코드. */
export type ApiDefaultModelErrorCode =
    | 'unauthenticated'
    | 'invalid_model'
    | 'provider_key_missing'
    | 'server_error'
    /** 공개 API 출시 플래그가 꺼져 있다(`isPublicApiEnabled`). 직접 호출된 액션만 받는다. */
    | 'not_available';

/** 화면에서 도달할 수 있는 키 액션 오류 코드 — 번역 키가 있는 코드만(`not_available`은 직접 호출 전용). */
export type ReachableSiglensApiKeyErrorCode = Exclude<
    SiglensApiKeyActionErrorCode,
    'not_available'
>;

/** 화면에서 도달할 수 있는 API 기본 모델 오류 코드 — 번역 키가 있는 코드만. */
export type ReachableApiDefaultModelErrorCode = Exclude<
    ApiDefaultModelErrorCode,
    'not_available'
>;

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

/** 도구 인자 하나의 문서용 표현. OpenAPI 스키마 표와 `/developers`의 인자 표가 같이 쓴다. */
export interface ApiToolArgument {
    readonly name: string;
    /** `"1Day" | "1Hour"`, `integer (10..60)` 같은 사람용 표기. */
    readonly type: string;
    readonly required: boolean;
    readonly description: string;
    /** 열거형 인자의 허용값 전체. 화면이 긴 목록을 접을 때 쓴다. */
    readonly enumValues?: readonly string[];
    /** 배열 인자인가. 열거값이 원소의 허용값(`array of "a" | "b"`)임을 화면이 밝힐 때 쓴다. */
    readonly array?: true;
}

/** 도구 하나의 문서용 표현. OpenAPI 문서의 경로와 `/developers`의 도구 레퍼런스가 같이 쓴다. */
export interface ApiToolReference {
    readonly name: string;
    readonly description: string;
    /** 기본 경로(`/api/v1`) 아래의 경로: `/tools/get_quote`. */
    readonly path: string;
    /** 호출 URL 전체: `https://siglens.io/api/v1/tools/get_quote`. */
    readonly url: string;
    readonly arguments: readonly ApiToolArgument[];
    /** 필수 인자만으로 만든 예시 본문. */
    readonly exampleArgs: Readonly<Record<string, YamlValue>>;
    readonly curl: string;
    /** 새 분석 생성이 사용자 BYOK 키를 쓰는 도구인가. */
    readonly byok: boolean;
}
