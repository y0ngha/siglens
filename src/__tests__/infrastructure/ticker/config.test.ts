import { tryReadTranslatorConfig } from '@/infrastructure/ticker/config';

describe('tryReadTranslatorConfig', () => {
    afterEach(() => {
        delete process.env.TRANSLATE_API_KEY;
        delete process.env.TRANSLATE_FREE_API_KEY;
        delete process.env.TRANSLATE_MODEL;
    });

    it('TRANSLATE_API_KEY 미설정 시 null 반환', () => {
        expect(tryReadTranslatorConfig()).toBeNull();
    });

    it('필수 키만 있을 때 user api key는 undefined, model은 default', () => {
        process.env.TRANSLATE_API_KEY = 'paid';
        expect(tryReadTranslatorConfig()).toEqual({
            apiKey: 'paid',
            freeApiKey: undefined,
            model: 'gemini-2.5-flash',
        });
    });

    it('FREE_API_KEY와 MODEL 환경변수를 우선 사용한다', () => {
        process.env.TRANSLATE_API_KEY = 'paid';
        process.env.TRANSLATE_FREE_API_KEY = 'free';
        process.env.TRANSLATE_MODEL = 'gemini-custom';
        expect(tryReadTranslatorConfig()).toEqual({
            apiKey: 'paid',
            freeApiKey: 'free',
            model: 'gemini-custom',
        });
    });
});
