import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { tryReadPlainModelConfig, _resetPlainModelWarningForTest } =
    await import('../lib/plainModel');

beforeEach(() => {
    vi.unstubAllEnvs();
    _resetPlainModelWarningForTest();
});
afterEach(() => {
    vi.unstubAllEnvs();
});

describe('tryReadPlainModelConfig', () => {
    it('기본 모델은 DeepSeek이고 그 provider의 서버 키를 고른다', () => {
        vi.stubEnv('DEEPSEEK_CHAT_API_KEY', 'ds-key');
        expect(tryReadPlainModelConfig()).toEqual({
            model: 'deepseek-v4-flash',
            serverApiKey: 'ds-key',
        });
    });

    it('키가 없으면 null — 호출자가 원본만 보여준다', () => {
        vi.stubEnv('DEEPSEEK_CHAT_API_KEY', '');
        expect(tryReadPlainModelConfig()).toBeNull();
    });

    /**
     * 회귀: `tryReadTranslatorConfig`(Gemini 전용 키 + Gemini 모델)를 그대로
     * `callDeepseekChat`에 넘기면 매 호출이 `[deepseek] Non-DeepSeek model spec`으로
     * 던진다 — 로컬 실증에서 확인. 모델과 키를 한 자리에서 함께 고르면 어긋날 수 없다.
     */
    it('모델을 바꾸면 그 provider의 키를 따라간다', () => {
        vi.stubEnv('PLAIN_MODEL', 'gemini-2.5-flash-lite');
        vi.stubEnv('GEMINI_CHAT_API_KEY', 'gm-key');
        expect(tryReadPlainModelConfig()).toEqual({
            model: 'gemini-2.5-flash-lite',
            serverApiKey: 'gm-key',
        });
    });

    it('모델을 바꿨는데 그 provider 키가 없으면 null', () => {
        vi.stubEnv('PLAIN_MODEL', 'gemini-2.5-flash-lite');
        vi.stubEnv('GEMINI_CHAT_API_KEY', '');
        vi.stubEnv('DEEPSEEK_CHAT_API_KEY', 'ds-key');
        expect(tryReadPlainModelConfig()).toBeNull();
    });

    it('알 수 없는 모델은 경고 후 기본값으로 떨어진다', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('PLAIN_MODEL', 'not-a-model');
        vi.stubEnv('DEEPSEEK_CHAT_API_KEY', 'ds-key');

        expect(tryReadPlainModelConfig()?.model).toBe('deepseek-v4-flash');
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });

    it('빈 PLAIN_MODEL은 경고 없이 기본값', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('PLAIN_MODEL', '   ');
        vi.stubEnv('DEEPSEEK_CHAT_API_KEY', 'ds-key');

        expect(tryReadPlainModelConfig()?.model).toBe('deepseek-v4-flash');
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});
