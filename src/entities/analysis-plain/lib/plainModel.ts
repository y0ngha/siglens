import 'server-only';
import { getProviderForModel, type ModelId } from '@y0ngha/siglens-core';
import { isActiveModelId } from '@/shared/lib/isActiveModelId';

/**
 * 평이화에 쓰는 모델.
 *
 * 분석 자체가 아니라 **다시 쓰기**라 가장 싼 비추론 라인이 맞는 트레이드오프다.
 * 실측(32건 × 7종)에서 이 모델로 카탈로그 용어 유출 0.00, 영문 약어 0.00을 얻었다.
 *
 * `PLAIN_MODEL` 환경변수로 덮어쓸 수 있다. 알 수 없는 모델이면 경고 후 기본값으로
 * 떨어진다 — 오설정이 평이화를 통째로 죽이는 것보다 낫다.
 */
const DEFAULT_PLAIN_MODEL: ModelId = 'deepseek-v4-flash';

let hasWarned = false;

export interface PlainModelConfig {
    /** `callAiProviderRouter`가 provider를 판별하는 내부 모델 키. */
    readonly model: ModelId;
    /** 서버 소유 키. provider에 맞는 것을 골라 넘긴다. */
    readonly serverApiKey: string;
}

/**
 * 모델이 속한 provider의 서버 키. `chatAction`의 `getServerPrimaryKey`와 같은 매핑이다.
 *
 * provider 판별은 core의 `getProviderForModel`에 맡긴다 — 모델 이름 접두사로
 * 직접 맞히면 이 레포에 provider 매핑이 세 벌 생기고, 어느 하나가 새 모델을
 * 놓쳐도 조용히 `undefined`가 되어 평이화가 통째로 꺼진다(에러 없이).
 * `never` 소진 검사가 있으면 새 provider 추가가 컴파일에서 걸린다.
 */
function serverKeyFor(model: ModelId): string | undefined {
    const provider = getProviderForModel(model);
    switch (provider) {
        case 'deepseek':
            return process.env.DEEPSEEK_CHAT_API_KEY;
        case 'google':
            return process.env.GEMINI_CHAT_API_KEY;
        case 'anthropic':
            return process.env.ANTHROPIC_CHAT_API_KEY;
        case 'openai':
            return process.env.OPENAI_CHAT_API_KEY;
        default: {
            const exhausted: never = provider;
            throw new Error(
                `[analysisPlain] Unhandled provider: ${String(exhausted)}`
            );
        }
    }
}

/**
 * 평이화 모델과 그에 맞는 서버 키를 함께 돌려준다.
 *
 * **모델과 키를 한 자리에서 고르는 게 핵심이다.** `tryReadTranslatorConfig`는
 * `GEMINI_API_KEY` + Gemini 전용 `TRANSLATE_MODEL`을 돌려주는데, 그 값을
 * `callDeepseekChat`에 넘기면 `[deepseek] Non-DeepSeek model spec`으로 매 호출이
 * 던진다(로컬 실증에서 확인). provider별 어댑터를 직접 부르는 대신 라우터에
 * 맡기고, 키는 모델에서 유도해 둘이 어긋날 수 없게 한다.
 */
export function tryReadPlainModelConfig(): PlainModelConfig | null {
    const raw = process.env.PLAIN_MODEL?.trim();
    let model: ModelId = DEFAULT_PLAIN_MODEL;

    if (raw !== undefined && raw.length > 0) {
        if (isActiveModelId(raw)) {
            model = raw;
        } else if (!hasWarned) {
            hasWarned = true;
            console.warn(
                `[analysisPlain] PLAIN_MODEL="${raw}" is not a known model — falling back to "${DEFAULT_PLAIN_MODEL}".`
            );
        }
    }

    const serverApiKey = serverKeyFor(model);
    if (serverApiKey === undefined || serverApiKey.length === 0) return null;

    return { model, serverApiKey };
}

/** 테스트 헬퍼 — "이미 경고함" 플래그를 초기화한다. */
export function _resetPlainModelWarningForTest(): void {
    hasWarned = false;
}
