import type {
    AiContents,
    CallAiProvider,
    CallAiProviderOptions,
    ConversationTurn,
} from '@y0ngha/siglens-core';

/**
 * Extract the last user turn's text from the provider-neutral contents so the
 * fake answer can echo it back — letting an E2E spec assert the assistant
 * rendered a reply that references what the user actually asked.
 *
 * `contents` is either a plain prompt string or a role-tagged turn list
 * (see core's `AiContents`); handle both without throwing on empty input.
 */
function lastUserMessage(contents: AiContents): string {
    if (typeof contents === 'string') return contents;
    const lastUserTurn = [...contents]
        .reverse()
        .find((turn: ConversationTurn) => turn.role === 'user');
    return lastUserTurn?.text ?? '';
}

/**
 * E2E-only `CallAiProvider` returning a deterministic assistant reply instead
 * of calling a real LLM SDK. Reached only when E2E_TEST=1 (see getLlmProvider).
 *
 * Pure and side-effect free: reads no env vars and no API keys. The reply is a
 * plain sentence (what `CallAiProvider` contracts to return — core wraps it as
 * the assistant message) and references the requested model plus the last user
 * turn so a chat spec can assert the answer rendered.
 */
export const fakeCallAiProvider: CallAiProvider = (
    options: CallAiProviderOptions
): Promise<string> => {
    const userText = lastUserMessage(options.contents);
    const quoted = userText.length > 0 ? `"${userText}"` : '방금 질문';
    return Promise.resolve(
        `[E2E ${options.model}] ${quoted}에 대한 테스트 답변입니다. ` +
            '이 응답은 실제 LLM 호출 없이 생성된 결정적 응답입니다.'
    );
};
