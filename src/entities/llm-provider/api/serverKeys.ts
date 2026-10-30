import 'server-only';
import type { LlmProvider } from '@y0ngha/siglens-core';

/**
 * provider별 서버 소유 키를 env에서 읽는다. 매 요청 core에 `serverApiKey`로 넘겨진다.
 * core는 이 키를 무료 모델(전 티어)과 pro 티어의 프리미엄 모델에 쓰고, pro가 아닌
 * 프리미엄 요청은 사용자 BYOK 키(`userApiKey`)로 과금한다. 키 값은 로그·응답에 싣지 않는다.
 */
export function getServerPrimaryKey(provider: LlmProvider): string | undefined {
    switch (provider) {
        case 'google':
            return process.env.GEMINI_CHAT_API_KEY;
        case 'anthropic':
            return process.env.ANTHROPIC_CHAT_API_KEY;
        case 'openai':
            return process.env.OPENAI_CHAT_API_KEY;
        case 'deepseek':
            return process.env.DEEPSEEK_CHAT_API_KEY;
        default: {
            const exhausted: never = provider;
            throw new Error(`Unhandled LLM provider: ${String(exhausted)}`);
        }
    }
}
