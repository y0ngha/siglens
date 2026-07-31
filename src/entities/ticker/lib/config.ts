import type { ActiveModelId } from '@y0ngha/siglens-core';
import { MODEL_SPECS, isGeminiModel } from '@y0ngha/siglens-core';
import type { TranslatorConfig } from '../model';

// 프로덕션에 실제로 설정된 값(gemini-2.5-flash-lite)과 일치시킨다.
// koreanTranslator.ts는 항상 명시적 `thinkingBudget: 0`(DISABLED_THINKING_BUDGET)을
// 보내므로 "thinkingConfig 생략" 경로는 존재하지 않는다 — 두 모델 다
// GEMINI_MODELS_SUPPORTING_DISABLED_THINKING 허용목록에 있어 0을 안전하게
// 받아들인다(아래 실측 표 참고, flash-lite total=54가 flash total=51보다
// 오히려 근소하게 더 비싸다). 기본값을 flash-lite로 고정하는 이유는 비용이
// 아니라 "이 파일의 폴백이 실제 운영 설정과 일치해야 한다"는 것뿐이다.
const DEFAULT_TRANSLATE_MODEL = 'gemini-2.5-flash-lite';

/**
 * `thinkingBudget: 0`(사고 비활성화)을 그대로 받아들이는 Gemini 모델 집합.
 * 2026-07-31 Gemini API 라이브 호출로 실측:
 *
 * | model                 | thinkingBudget: 0     | thinkingConfig 생략     |
 * |------------------------|-------------------------|----------------------------|
 * | gemini-2.5-flash       | thoughts=0, total=51    | thoughts=245, total=300    |
 * | gemini-2.5-flash-lite  | thoughts=0, total=54    | thoughts=0, total=48       |
 *
 * 같은 날짜의 별도 라이브 호출로 `thinkingBudget: 0`을 400("This model only
 * works in thinking mode")으로 거부하는 모델도 확인됨: `gemini-3.1-pro-preview`,
 * `gemini-3.5-flash-lite`, `gemini-3.6-flash`. `gemini-3-flash-preview`는
 * 3세대인데도 0을 허용한다 — 세대(2.5 vs 3.x)로 깔끔하게 갈리지 않으므로
 * 모델명/버전만으로 지원 여부를 추론하지 말 것.
 *
 * `gemini-2.5-pro`는 `MODEL_SPECS`에 존재하지만 위 라이브 실측 대상이 아니었다
 * — 실측 전까지는 의도적으로 이 집합에서 제외한다(미검증 모델은 미지원으로
 * 취급하는 것이 안전한 기본값). `TRANSLATE_MODEL=gemini-2.5-pro`는 그래서
 * 지금은 기본값으로 폴백하며 경고를 남긴다.
 *
 * ⚠️ siglens-core의 `MODEL_SPECS`에 Gemini 모델이 추가/제거될 때마다 이
 * 목록을 재검토해야 한다 — 신규 모델은 라이브로 실측하기 전까지 이 집합에
 * 넣지 않는다.
 */
const GEMINI_MODELS_SUPPORTING_DISABLED_THINKING: ReadonlySet<string> = new Set(
    ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview']
);

/**
 * `TRANSLATE_MODEL`이 siglens-core의 Gemini 모델 집합에 속하고,
 * `thinkingBudget: 0`(koreanTranslator.ts가 하드코딩하는 값)을 지원하는지
 * 검증한다. `Object.hasOwn`으로 먼저 own-property 존재를 좁힌 뒤(`in`
 * 연산자와 달리 프로토타입 체인의 `toString`/`constructor` 같은 값이 통과하지
 * 못한다 — router.ts의 `isActiveModelId`와 동일 패턴), `isGeminiModel`로
 * provider를, `GEMINI_MODELS_SUPPORTING_DISABLED_THINKING`으로 사고
 * 비활성화 지원 여부를 확인한다. 세 조건 중 하나라도 실패하면 이 모델로
 * 번역을 호출할 때마다 Gemini가 400을 던진다.
 */
function isValidGeminiModel(value: string): boolean {
    return (
        Object.hasOwn(MODEL_SPECS, value) &&
        isGeminiModel(value as ActiveModelId) &&
        GEMINI_MODELS_SUPPORTING_DISABLED_THINKING.has(value)
    );
}

// resolveTranslateModel()은 요청마다(티커 검색·자산정보 페이지마다) 호출되므로,
// 경고 자체를 매번 로깅하면 잘못 설정된 env 하나가 지속적인 로그 노이즈가
// 된다. 모듈 레벨 once-flag로 첫 경고 이후는 조용히 넘어간다 — 검증 로직
// 자체는 매 호출 그대로 수행한다(모듈 로드 시점 평가는 빌드 타임에 env를
// 고정시켜 버려서 안 됨).
let hasWarnedAboutInvalidTranslateModel = false;

/**
 * `MODEL_SPECS`의 내부 키(예: 'gemini-2.5-flash-lite')를 실제 Gemini SDK
 * 호출에 써야 하는 `apiModelId`로 변환한다. router.ts의 `callAiProviderRouter`가
 * `MODEL_SPECS[options.model].apiModelId`로 동일하게 변환하는 것과 같은 이유다
 * — "내부 키 → 공급자 API 모델 ID"는 다를 수 있고(router.ts 주석 참고),
 * 항상 apiModelId를 SDK에 전달해야 한다. 오늘은 모든 Gemini 행이
 * `apiModelId === key`라 이 변환이 no-op이지만, siglens-core가 dated preview
 * id를 가진 Gemini 모델을 추가하는 순간 이 변환이 없으면 번역만 404가 난다
 * (분석 경로는 router.ts를 거쳐 이미 안전).
 *
 * `resolveTranslateModel()`의 세 호출부 중 `isValidGeminiModel(raw)`를 거친
 * 것은 하나뿐이다 — 나머지 둘(unset/빈 문자열, invalid raw)은 검증 없이
 * `DEFAULT_TRANSLATE_MODEL`을 그대로 넘긴다(`_getDefaultTranslateModelForTest`의
 * 문서·config.test.ts의 self-consistency 테스트 참고). 그래서 이 함수는
 * `Object.hasOwn(MODEL_SPECS, value)`가 거짓인 입력(예: siglens-core가
 * `DEFAULT_TRANSLATE_MODEL`을 rename/제거)에도 `MODEL_SPECS[...]` 인덱싱으로
 * TypeError를 던지지 않는다 — 대신 `value`를 그대로 apiModelId로 반환한다
 * (오늘의 "모든 Gemini 행이 apiModelId === key"인 상태와 동일한 값이라 안전한
 * 폴백이다). 이렇게 해야 하는 이유: `tryReadTranslatorConfig()`는
 * `translateCompanyNames`/`translateCompanyDescription`의 try/catch **밖**에서
 * 호출되므로, 여기서 던지면 문서화된 우아한 디그레이드(빈 객체/`null`)가
 * 아니라 미처리 예외가 된다. miss일 때 반환한 값이 실제 Gemini API에서
 * 거부되더라도, 그 실패는 `callTranslateGemini` 호출부의 try/catch 안에서
 * 일어나므로 여전히 로깅 후 디그레이드된다.
 */
function toApiModelId(value: string): string {
    if (!Object.hasOwn(MODEL_SPECS, value)) return value;
    return MODEL_SPECS[value as ActiveModelId].apiModelId;
}

/**
 * `TRANSLATE_MODEL` env 값을 검증한다. 유효한 Gemini 모델 ID(사고 비활성화
 * 지원 포함)면 그 `apiModelId`를, 아니면(미설정·빈 문자열·알 수 없는 값·사고
 * 비활성화 미지원 모델) 기본 모델의 `apiModelId`로 폴백하면서 경고를
 * 로깅한다(최초 1회만).
 *
 * `??`만으로는 빈 문자열(`TRANSLATE_MODEL=""`)을 걸러내지 못한다 — nullish
 * coalescing은 `''`을 값으로 취급해 그대로 통과시키고, 검증 없는 이전
 * 구현에서는 이 빈 문자열이 그대로 Gemini SDK에 전달되어 조용히 실패했다
 * (koreanTranslator.ts가 모든 에러를 `{}`/`null`로 삼키므로 한국어 이름이
 * 소리 없이 사라진다). 여기서 빈 문자열도 "알 수 없는 값"과 동일하게
 * 취급해 경고 후 기본값으로 폴백한다.
 */
function resolveTranslateModel(): string {
    const raw = process.env.TRANSLATE_MODEL;
    if (raw === undefined || raw === '')
        return toApiModelId(DEFAULT_TRANSLATE_MODEL);
    if (isValidGeminiModel(raw)) return toApiModelId(raw);

    if (!hasWarnedAboutInvalidTranslateModel) {
        hasWarnedAboutInvalidTranslateModel = true;
        console.warn(
            `[tryReadTranslatorConfig] TRANSLATE_MODEL="${raw}" is not a known Gemini model in siglens-core's MODEL_SPECS that supports a disabled thinking budget. ` +
                `Falling back to default "${DEFAULT_TRANSLATE_MODEL}" — Korean translations would otherwise silently fail or 400.`
        );
    }
    return toApiModelId(DEFAULT_TRANSLATE_MODEL);
}

export function tryReadTranslatorConfig(): TranslatorConfig | null {
    const apiKey = process.env.TRANSLATE_API_KEY;
    if (!apiKey) return null;
    return {
        apiKey,
        model: resolveTranslateModel(),
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
 * running it through `isValidGeminiModel` — so nothing but this test pins
 * that the default itself stays a member of `MODEL_SPECS` and
 * `GEMINI_MODELS_SUPPORTING_DISABLED_THINKING`. `toApiModelId` is miss-safe
 * (see its JSDoc) so a stale default can no longer *throw* out of
 * `tryReadTranslatorConfig()` — but it would still silently become the one
 * value that reaches Gemini unvalidated and 400s on every fallback if
 * siglens-core renames or removes `gemini-2.5-flash-lite` (the ⚠️ scenario
 * called out above the allow-list). This self-consistency test is what
 * catches that regression; `toApiModelId`'s safety net only downgrades the
 * failure mode from "uncaught throw" to "caught 400", it does not prevent it.
 */
export function _getDefaultTranslateModelForTest(): string {
    return DEFAULT_TRANSLATE_MODEL;
}

/** Test helper — exposes `isValidGeminiModel` for the self-consistency assertion above. */
export function _isValidGeminiModelForTest(value: string): boolean {
    return isValidGeminiModel(value);
}

/**
 * Test helper — exposes `toApiModelId` to pin its miss-safety directly
 * (a value absent from `MODEL_SPECS` must return as-is, never throw).
 */
export function _toApiModelIdForTest(value: string): string {
    return toApiModelId(value);
}
