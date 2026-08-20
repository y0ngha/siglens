import {
    MODEL_SPECS,
    isGeminiModel,
    supportsDisabledThinking,
} from '@y0ngha/siglens-core';
import { isActiveModelId } from '@/shared/lib/isActiveModelId';
import type { TranslatorConfig } from '../model';

/**
 * 번역 기본 모델. 프로덕션에 실제로 설정된 값과 일치시킨다.
 *
 * 회사명/설명 번역은 결정적 변환이라 추론에서 얻을 품질 이득이 없다 —
 * `koreanTranslator.ts`가 항상 `thinkingBudget: 0`(`DISABLED_THINKING_BUDGET`)을
 * 명시한다. 2026-08-18에 DeepSeek로 옮겼다가 지출이 급증해 되돌린 자리다
 * (뉴스카드·경제이벤트·지표번역도 같은 커밋에서 함께 되돌렸다 — 그쪽 모델
 * 상수는 core에 있다).
 */
const DEFAULT_TRANSLATE_MODEL = 'gemini-2.5-flash-lite';

/**
 * `TRANSLATE_MODEL`이 `MODEL_SPECS`에 존재하는 Gemini 모델이면서
 * `thinkingBudget: 0`(`koreanTranslator.ts`가 하드코딩하는 값)을 받아들이는지
 * 검증한다.
 *
 * provider까지 확인해야 하는 이유: 번역은 `GEMINI_API_KEY` 하나로 호출된다
 * (`tryReadTranslatorConfig` 참고). 여기에 DeepSeek/Claude 모델 ID가 들어오면
 * `callGeminiChat`이 Gemini 엔드포인트에 그 ID를 그대로 보내 401/400이 나고,
 * `koreanTranslator.ts`가 모든 에러를 `{}`/`null`로 삼키므로 한국어 이름이
 * 소리 없이 전부 사라진다.
 *
 * 사고 비활성화 지원까지 확인해야 하는 이유: 리터럴 0을 400("This model only
 * works in thinking mode")으로 거부하는 Gemini 모델이 있다. 허용목록은
 * siglens-core의 `supportsDisabledThinking`에 있다 — 같은 제약을 core의 고정
 * 모델 경로(뉴스카드·경제이벤트·지표번역)도 공유하므로 목록을 여기서 복제하지
 * 않는다.
 *
 * 먼저 `isActiveModelId`(`shared/lib/isActiveModelId.ts` — 프로토타입 체인
 * 키를 own-property 체크로 걸러내는 이유는 그 파일 JSDoc 참고)로
 * `ActiveModelId`로 좁힌 뒤 provider와 사고-비활성화 지원을 확인한다.
 */
function isValidTranslateModel(value: string): boolean {
    return (
        isActiveModelId(value) &&
        isGeminiModel(value) &&
        supportsDisabledThinking(value)
    );
}

/**
 * `MODEL_SPECS`의 내부 키(예: 'gemini-2.5-flash-lite')를 실제 Gemini SDK 호출에
 * 써야 하는
 * `apiModelId`로 변환한다. router.ts의 `callAiProviderRouter`가
 * `MODEL_SPECS[options.model].apiModelId`로 동일하게 변환하는 것과 같은 이유다
 * — "내부 키 → 공급자 API 모델 ID"는 다를 수 있고(router.ts 주석 참고),
 * 항상 apiModelId를 SDK에 전달해야 한다. 오늘은 모든 Gemini 행이
 * `apiModelId === key`라 이 변환이 no-op이지만, siglens-core가 dated preview
 * id를 가진 모델을 추가하는 순간 이 변환이 없으면 번역만 404가 난다(분석
 * 경로는 router.ts를 거쳐 이미 안전).
 *
 * `resolveTranslateModel()`의 세 호출부 중 `isValidTranslateModel(raw)`를 거친
 * 것은 하나뿐이다 — 나머지 둘(unset/빈 문자열, invalid raw)은 검증 없이
 * `DEFAULT_TRANSLATE_MODEL`을 그대로 넘긴다(`_getDefaultTranslateModelForTest`의
 * 문서·config.test.ts의 self-consistency 테스트 참고). 그래서 이 함수는
 * `isActiveModelId(value)`(`shared/lib/isActiveModelId.ts`)가 거짓인 입력
 * (예: siglens-core가 `DEFAULT_TRANSLATE_MODEL`을 rename/제거)에도
 * `MODEL_SPECS[...]` 인덱싱으로 TypeError를 던지지 않는다 — 대신 `value`를
 * 그대로 apiModelId로 반환한다(오늘의 "모든 Gemini 행이 apiModelId === key"인
 * 상태와 동일한 값이라 안전한 폴백이다). 이렇게 해야 하는 이유:
 * `tryReadTranslatorConfig()`는 `translateCompanyNames`/
 * `translateCompanyDescription`의 try/catch **밖**에서 호출되므로, 여기서
 * 던지면 문서화된 우아한 디그레이드(빈 객체/`null`)가 아니라 미처리 예외가
 * 된다. miss일 때 반환한 값이 실제 Gemini API에서 거부되더라도, 그 실패는
 * `callTranslateGemini` 호출부의 try/catch 안에서 일어나므로 여전히 로깅 후
 * 디그레이드된다.
 */
function toApiModelId(value: string): string {
    if (!isActiveModelId(value)) return value;
    return MODEL_SPECS[value].apiModelId;
}

/**
 * `resolveTranslateModel()`의 반환값. 경고 로깅은 이 함수의 책임이 아니라
 * (entities/lib은 순수 검증만 — 로깅/once-flag 같은 side effect는
 * `tryReadTranslatorConfig()` 경계로 옮겨졌다), 폴백이 "알 수 없는 값 때문에
 * 일어났다"는 사실과 그 원본 값을 `invalidRawValue`로 caller에 전달해
 * caller가 경고 여부·문구를 결정하게 한다. 미설정/빈 문자열 폴백은
 * `invalidRawValue: null`로 — 이 두 경우는 경고 대상이 아니다(아래 JSDoc 참고).
 */
interface ResolveTranslateModelResult {
    apiModelId: string;
    /**
     * 폴백을 유발한 "알 수 없는" 원본 env 값. 미설정/빈 문자열처럼 조용히
     * 폴백해야 하는 경우, 또는 애초에 폴백이 없었던 경우(유효한 값)는 `null`.
     */
    invalidRawValue: string | null;
}

/**
 * `TRANSLATE_MODEL` env 값을 검증한다. 유효한 Gemini 모델 ID(사고 비활성화
 * 지원 포함)면 그 `apiModelId`를, 아니면(미설정·빈 문자열·알 수 없는 값·타
 * provider 모델·사고 비활성화 미지원 모델) 기본 모델의 `apiModelId`로
 * 폴백한다.
 *
 * entities/lib의 순수 함수 규칙(`docs/conventions/CONVENTIONS.md` §"Pure
 * Function Rules")에 따라 이 함수는 `console.warn`을 직접 호출하지 않는다 —
 * 대신 "알 수 없는 값 때문에 폴백했다"는 신호를 `invalidRawValue`로 반환하고,
 * 실제 로깅(및 최초 1회만 로깅하는 once-flag)은 `tryReadTranslatorConfig()`가
 * 경계에서 수행한다.
 *
 * `??`만으로는 빈 문자열(`TRANSLATE_MODEL=""`)을 걸러내지 못한다 — nullish
 * coalescing은 `''`을 값으로 취급해 그대로 통과시키고, 검증 없는 이전
 * 구현에서는 이 빈 문자열이 그대로 SDK에 전달되어 조용히 실패했다
 * (koreanTranslator.ts가 모든 에러를 `{}`/`null`로 삼키므로 한국어 이름이
 * 소리 없이 사라진다). 여기서 빈 문자열도 "미설정"과 동일하게 조용히
 * 취급해(`invalidRawValue: null`) 경고 없이 기본값으로 폴백한다.
 */
function resolveTranslateModel(): ResolveTranslateModelResult {
    const raw = process.env.TRANSLATE_MODEL;
    if (raw === undefined || raw === '')
        return {
            apiModelId: toApiModelId(DEFAULT_TRANSLATE_MODEL),
            invalidRawValue: null,
        };
    if (isValidTranslateModel(raw))
        return { apiModelId: toApiModelId(raw), invalidRawValue: null };

    return {
        apiModelId: toApiModelId(DEFAULT_TRANSLATE_MODEL),
        invalidRawValue: raw,
    };
}

// tryReadTranslatorConfig()은 요청마다(티커 검색·자산정보 페이지마다) 호출되므로,
// 경고 자체를 매번 로깅하면 잘못 설정된 env 하나가 지속적인 로그 노이즈가
// 된다. 모듈 레벨 once-flag로 첫 경고 이후는 조용히 넘어간다 — 검증 로직
// 자체(resolveTranslateModel)는 매 호출 그대로 수행한다(모듈 로드 시점 평가는
// 빌드 타임에 env를 고정시켜 버려서 안 됨).
let hasWarnedAboutInvalidTranslateModel = false;

/**
 * 번역은 Gemini 서버 키(`GEMINI_API_KEY`)로 호출된다. 전용
 * `TRANSLATE_API_KEY`가 따로 없는 이유: 지출 구분은 키가 아니라
 * `[Usage]` 텔레메트리의 `jobId: 'translate'`로 이미 되고 있고
 * (`koreanTranslator.ts` 참고), 키를 하나 더 두면 provider를 바꿀 때마다
 * 두 곳을 동시에 갈아끼워야 한다.
 */
export function tryReadTranslatorConfig(): TranslatorConfig | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const { apiModelId, invalidRawValue } = resolveTranslateModel();
    if (invalidRawValue !== null && !hasWarnedAboutInvalidTranslateModel) {
        hasWarnedAboutInvalidTranslateModel = true;
        console.warn(
            `[tryReadTranslatorConfig] TRANSLATE_MODEL="${invalidRawValue}" is not a known Gemini model in siglens-core's MODEL_SPECS that supports a disabled thinking budget. ` +
                `Falling back to default "${DEFAULT_TRANSLATE_MODEL}" — Korean translations would otherwise silently fail or 400.`
        );
    }

    return {
        apiKey,
        model: apiModelId,
    };
}

/** Test helper — resets the "already warned" once-flag between cases. */
export function _resetTranslateModelWarningForTest(): void {
    hasWarnedAboutInvalidTranslateModel = false;
}

/**
 * Test helper — exposes `DEFAULT_TRANSLATE_MODEL` for a self-consistency
 * assertion (see config.test.ts). `resolveTranslateModel()` returns
 * `DEFAULT_TRANSLATE_MODEL` directly on every "unset/invalid" branch without
 * running it through `isValidTranslateModel` — so nothing but this test pins
 * that the default itself stays a Gemini member of `MODEL_SPECS` that
 * `supportsDisabledThinking` accepts.
 * `toApiModelId` is miss-safe (see its JSDoc) so a stale default can no longer
 * *throw* out of `tryReadTranslatorConfig()` — but it would still silently
 * become the one value that reaches Gemini unvalidated and 400s on every
 * fallback if siglens-core renames or removes `gemini-2.5-flash-lite`, or
 * drops it from the disabled-thinking allow-list. This
 * self-consistency test is what catches that regression; `toApiModelId`'s
 * safety net only downgrades the failure mode from "uncaught throw" to
 * "caught 400", it does not prevent it.
 */
export function _getDefaultTranslateModelForTest(): string {
    return DEFAULT_TRANSLATE_MODEL;
}

/** Test helper — exposes `isValidTranslateModel` for the self-consistency assertion above. */
export function _isValidTranslateModelForTest(value: string): boolean {
    return isValidTranslateModel(value);
}

/**
 * Test helper — exposes `toApiModelId` to pin its miss-safety directly
 * (a value absent from `MODEL_SPECS` must return as-is, never throw).
 */
export function _toApiModelIdForTest(value: string): string {
    return toApiModelId(value);
}
