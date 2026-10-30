import type { CallAiProviderOptions } from '@y0ngha/siglens-core';
import { MODEL_SPECS, getProviderForModel } from '@y0ngha/siglens-core';
import { isActiveModelId } from '@/shared/lib/isActiveModelId';
import type { ProviderCallOptions } from '../model';
import { callAnthropicChat } from './anthropic';
import { callDeepseekChat } from './deepseek';
import { callGeminiChat } from './gemini';
import { callOpenaiChat } from './openai';

/**
 * provider-중립 AI 호출을 알맞은 SDK 어댑터로 보낸다.
 *
 * **키 라우팅.** siglens-core는 호출마다 `userApiKey`(BYOK, 사용자 과금) /
 * `serverApiKey`(우리 과금) 중 정확히 하나만 넘기고 나머지는 `undefined`로 둔다 — core
 * `requestChatCompletion`의 `resolveApiKeys` 참고. 이 라우터가 쌍을 단일 `apiKey`로
 * 접어 보내므로 어댑터는 틀린 키를 고를 수 없다. 둘 다 없으면 호출을 진행하지 않고 던진다:
 * Anthropic·OpenAI SDK는 `undefined`를 받으면 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` env로
 * 조용히 폴백하는데, 그러면 BYOK 사용자의 요청이 서버의 분석용 키로 과금된다.
 *
 * **`jobId` 통과.** core의 `CallAiProviderOptions`에는 `jobId`가 없지만 어댑터가 받는
 * `ProviderCallOptions`에는 있고 아래 spread가 그대로 넘긴다. 파라미터를 넓혀 두면
 * 라우터 호출자가 어댑터를 직접 부르지 않고도 자기 `[Usage]` 텔레메트리를 라벨링할 수 있다 —
 * Gemini 설정이 `callDeepseekChat`에 닿아 매 요청 던지던 일이 있었던 경로다. `limits`
 * (출력/타임아웃/재시도 상한, `ProviderCallLimits`)도 같은 이유로 같은 spread를 탄다.
 */
export async function callAiProviderRouter(
    options: CallAiProviderOptions &
        Pick<ProviderCallOptions, 'jobId' | 'limits'>
): Promise<string> {
    // 모델을 먼저 검증해, `getProviderForModel` 안쪽의 일반 throw에 가려지지 않고 우리의
    // `[router] Unknown model` 오류가 나가게 한다. 이후 `MODEL_SPECS[...]`와
    // `getProviderForModel` 호출이 `as` 캐스트 없이 타입 안전해지기도 한다.
    // `Object.hasOwn`(`in` 아님)이 필요한 이유는 `isActiveModelId`
    // (`shared/lib/isActiveModelId.ts`) 참고.
    if (!isActiveModelId(options.model)) {
        throw new Error(`[router] Unknown model: ${options.model}`);
    }

    const { userApiKey, serverApiKey, ...rest } = options;
    const apiKey = userApiKey ?? serverApiKey;
    if (apiKey === undefined) {
        throw new Error(
            `[router] No API key supplied for model: ${options.model}`
        );
    }

    const provider = getProviderForModel(options.model);

    // 내부 모델 키(예: 'claude-haiku-5-5') → provider API 모델 ID(구모델은 날짜 스냅샷 ID).
    // 둘이 다를 수 있으므로 실제 SDK 호출에는 항상 apiModelId를 써야 provider가 모델을 알아본다.
    const apiOptions: ProviderCallOptions = {
        ...rest,
        apiKey,
        model: MODEL_SPECS[options.model].apiModelId,
    };

    switch (provider) {
        case 'anthropic':
            return callAnthropicChat(apiOptions);
        case 'openai':
            return callOpenaiChat(apiOptions);
        case 'google':
            return callGeminiChat(apiOptions);
        case 'deepseek':
            return callDeepseekChat(apiOptions);
        default: {
            const exhausted: never = provider;
            throw new Error(`Unhandled AI provider: ${String(exhausted)}`);
        }
    }
}
