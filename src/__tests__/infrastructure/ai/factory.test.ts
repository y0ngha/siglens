import { createAIProvider } from '@/infrastructure/ai/factory';
import { ClaudeProvider } from '@/infrastructure/ai/claude';
import { GeminiProvider } from '@/infrastructure/ai/gemini';

jest.mock('@/infrastructure/ai/claude');
jest.mock('@/infrastructure/ai/gemini');

describe('createAIProvider', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('AI_PROVIDER 환경 변수가 설정되지 않은 경우', () => {
        it('기본값으로 ClaudeProvider를 반환한다', () => {
            delete process.env.AI_PROVIDER;

            const provider = createAIProvider();

            expect(provider).toBeInstanceOf(ClaudeProvider);
        });
    });

    describe('AI_PROVIDER=claude로 설정된 경우', () => {
        it('ClaudeProvider를 반환한다', () => {
            process.env.AI_PROVIDER = 'claude';

            const provider = createAIProvider();

            expect(provider).toBeInstanceOf(ClaudeProvider);
        });
    });

    describe('AI_PROVIDER=gemini로 설정된 경우', () => {
        it('GeminiProvider를 반환한다', () => {
            process.env.AI_PROVIDER = 'gemini';

            const provider = createAIProvider();

            expect(provider).toBeInstanceOf(GeminiProvider);
        });
    });

    describe('AI_PROVIDER가 알 수 없는 값으로 설정된 경우', () => {
        it('기본값인 ClaudeProvider를 반환한다', () => {
            process.env.AI_PROVIDER = 'unknown-provider';

            const provider = createAIProvider();

            expect(provider).toBeInstanceOf(ClaudeProvider);
        });
    });
});
