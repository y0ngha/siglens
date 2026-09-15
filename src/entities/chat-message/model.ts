import type { ChatActionResult, ChatErrorCode } from '@y0ngha/siglens-core';

/**
 * siglens가 core 챗 코드 위에 더하는 에러 코드.
 *
 * core의 `classifyProviderError`는 429/503만 구분하고 나머지(400·401 포함)를 전부
 * `server_error`로 뭉친다. "AI 서버가 불안정하니 모델을 바꾸라"는 안내는 그중
 * provider 장애에만 맞으므로, 원시 에러를 볼 수 있는 `chatAction`이 따로 판정해
 * 이 코드로 돌려준다.
 */
export type SymbolChatErrorCode = ChatErrorCode | 'ai_server_unstable';

export type SymbolChatActionResult =
    | ChatActionResult
    | { ok: false; error: 'ai_server_unstable' };
