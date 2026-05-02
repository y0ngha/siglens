import {
    isFreeChatModel,
    getRequiredProviderForModel,
} from '@/domain/llm/modelTier';

describe('isFreeChatModel', () => {
    it('gemini-2.5-flash는 Free 모델이다', () => {
        expect(isFreeChatModel('gemini-2.5-flash')).toBe(true);
    });

    it('gemini-2.5-flash-lite는 Free 모델이다', () => {
        expect(isFreeChatModel('gemini-2.5-flash-lite')).toBe(true);
    });

    it('claude-haiku-3-5는 Free 모델이다', () => {
        expect(isFreeChatModel('claude-haiku-3-5')).toBe(true);
    });

    it('gpt-5-mini는 Free 모델이다', () => {
        expect(isFreeChatModel('gpt-5-mini')).toBe(true);
    });

    it('gemini-2.5-pro는 Premium 모델이다', () => {
        expect(isFreeChatModel('gemini-2.5-pro')).toBe(false);
    });

    it('claude-opus-4-7는 Premium 모델이다', () => {
        expect(isFreeChatModel('claude-opus-4-7')).toBe(false);
    });
});

describe('getRequiredProviderForModel', () => {
    it('Gemini 모델은 google provider가 필요하다', () => {
        expect(getRequiredProviderForModel('gemini-2.5-flash')).toBe('google');
    });

    it('Claude 모델은 anthropic provider가 필요하다', () => {
        expect(getRequiredProviderForModel('claude-haiku-3-5')).toBe(
            'anthropic'
        );
    });
});
