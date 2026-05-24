import { tryReadTranslatorConfig } from '../../lib/config';

describe('tryReadTranslatorConfig', () => {
    // release-it 경유 실행 시 `.env.local`의 TRANSLATE_* 변수가 부모 프로세스에 주입되므로,
    // afterEach만으로는 첫 케이스의 "미설정" 전제가 깨진다. 케이스 시작 시점에도 unset 보장.
    beforeEach(() => {
        delete process.env.TRANSLATE_API_KEY;
        delete process.env.TRANSLATE_FREE_API_KEY;
        delete process.env.TRANSLATE_MODEL;
    });

    // 마지막 케이스가 세팅한 값이 같은 worker process에 남아 sibling suite로 leak되는
    // 것을 방지(jest worker pool은 file별 새 process지만 같은 file 내 다른 describe로의
    // leak은 가능). beforeEach만 두면 마지막 케이스 cleanup이 빠진다.
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
