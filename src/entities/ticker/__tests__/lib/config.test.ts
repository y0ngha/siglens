import { MODEL_SPECS } from '@y0ngha/siglens-core';
import {
    _getDefaultTranslateModelForTest,
    _isValidTranslateModelForTest,
    _resetTranslateModelWarningForTest,
    _toApiModelIdForTest,
    tryReadTranslatorConfig,
} from '../../lib/config';

describe('tryReadTranslatorConfig', () => {
    // `vi.stubEnv`를 쓰는 이유: GEMINI_API_KEY는 번역 전용이 아니라 분석·챗
    // 경로가 공유하는 서버 키다. `delete process.env`로 지우면 vitest worker
    // process를 공유하는 sibling suite에 "키 없음" 상태가 leak된다
    // (config의 `unstubEnvs: true`가 stub은 케이스마다 자동 복원).
    beforeEach(() => {
        vi.stubEnv('GEMINI_API_KEY', undefined);
        vi.stubEnv('TRANSLATE_MODEL', undefined);
        // "경고는 최초 1회만" once-flag가 케이스 간 leak되지 않도록 매 케이스
        // 시작 시 리셋한다 — 그렇지 않으면 이전 케이스가 이미 경고를 소비해
        // 이번 케이스의 warnSpy 단언이 거짓으로 실패한다.
        _resetTranslateModelWarningForTest();
    });

    it('GEMINI_API_KEY 미설정 시 null 반환', () => {
        expect(tryReadTranslatorConfig()).toBeNull();
    });

    it('필수 키만 있을 때 model은 default(gemini-2.5-flash-lite)', () => {
        vi.stubEnv('GEMINI_API_KEY', 'paid');
        expect(tryReadTranslatorConfig()).toEqual({
            apiKey: 'paid',
            // 리터럴이 아니라 MODEL_SPECS에서 파생한 값과 비교한다 — toApiModelId를
            // 지우고 raw key를 그대로 반환해도 리터럴 비교는 우연히 통과해버린다
            // (오늘은 apiModelId === key라서).
            model: MODEL_SPECS['gemini-2.5-flash-lite'].apiModelId,
        });
    });

    it('MODEL 환경변수가 사고 비활성화를 지원하는 유효한 Gemini 모델이면 그 값을 우선 사용한다', () => {
        vi.stubEnv('GEMINI_API_KEY', 'paid');
        // 기본값(gemini-2.5-flash-lite)과 다른 값을 사용해 실제로 pass-through가
        // 일어나는지(기본값으로 우연히 일치하는 게 아닌지) 검증한다.
        vi.stubEnv('TRANSLATE_MODEL', 'gemini-2.5-flash');
        expect(tryReadTranslatorConfig()).toEqual({
            apiKey: 'paid',
            model: MODEL_SPECS['gemini-2.5-flash'].apiModelId,
        });
    });

    it('MODEL 환경변수가 알 수 없는 값이면 기본값으로 폴백하고 경고를 로깅한다', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('GEMINI_API_KEY', 'paid');
        vi.stubEnv('TRANSLATE_MODEL', 'gemini-custom');

        expect(tryReadTranslatorConfig()).toEqual({
            apiKey: 'paid',
            model: MODEL_SPECS['gemini-2.5-flash-lite'].apiModelId,
        });
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('TRANSLATE_MODEL="gemini-custom"')
        );

        warnSpy.mockRestore();
    });

    it('MODEL 환경변수가 Gemini 아닌 provider 모델이면 기본값으로 폴백한다', () => {
        // 번역은 GEMINI_API_KEY 하나로만 호출된다 — DeepSeek 모델 ID가 통과하면
        // Gemini 엔드포인트에 그 ID가 그대로 나가 401/400이 나고,
        // koreanTranslator가 에러를 삼켜 한국어 이름이 소리 없이 사라진다.
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('GEMINI_API_KEY', 'paid');
        vi.stubEnv('TRANSLATE_MODEL', 'deepseek-v4-flash');

        expect(tryReadTranslatorConfig()).toEqual({
            apiKey: 'paid',
            model: MODEL_SPECS['gemini-2.5-flash-lite'].apiModelId,
        });
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('TRANSLATE_MODEL="deepseek-v4-flash"')
        );

        warnSpy.mockRestore();
    });

    it('MODEL 환경변수가 Gemini 모델이지만 사고 비활성화(thinkingBudget: 0)를 지원하지 않으면 기본값으로 폴백한다', () => {
        // gemini-2.5-pro는 MODEL_SPECS의 실존 Gemini 모델이지만 core의
        // GEMINI_MODELS_SUPPORTING_DISABLED_THINKING 라이브 실측 대상이 아니어서
        // 미지원 취급된다. koreanTranslator는 항상 thinkingBudget 0을 보내므로
        // 이 검사가 없으면 매 호출 400이 난다.
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('GEMINI_API_KEY', 'paid');
        vi.stubEnv('TRANSLATE_MODEL', 'gemini-2.5-pro');

        expect(tryReadTranslatorConfig()).toEqual({
            apiKey: 'paid',
            model: MODEL_SPECS['gemini-2.5-flash-lite'].apiModelId,
        });
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('TRANSLATE_MODEL="gemini-2.5-pro"')
        );

        warnSpy.mockRestore();
    });

    it('MODEL 환경변수가 빈 문자열이면(??가 못 거르는 값) 기본값을 조용히 사용한다', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('GEMINI_API_KEY', 'paid');
        vi.stubEnv('TRANSLATE_MODEL', '');

        expect(tryReadTranslatorConfig()).toEqual({
            apiKey: 'paid',
            model: MODEL_SPECS['gemini-2.5-flash-lite'].apiModelId,
        });
        // 빈 문자열은 "미설정"과 동일하게 취급 — 사용자가 값을 준 게 아니라
        // env가 그냥 비어 있는 흔한 케이스이므로 경고로 시끄럽게 하지 않는다.
        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    it('MODEL 환경변수가 프로토타입 체인 키(toString 등)여도 통과하지 못하고 기본값으로 폴백한다', () => {
        // `value in MODEL_SPECS`는 Object.prototype의 own이 아닌 키(toString,
        // constructor, valueOf, __proto__ 등)도 true로 판정한다 — Object.hasOwn
        // 회귀를 잡는 테스트.
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('GEMINI_API_KEY', 'paid');
        vi.stubEnv('TRANSLATE_MODEL', 'toString');

        expect(tryReadTranslatorConfig()).toEqual({
            apiKey: 'paid',
            model: MODEL_SPECS['gemini-2.5-flash-lite'].apiModelId,
        });
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('TRANSLATE_MODEL="toString"')
        );

        warnSpy.mockRestore();
    });

    it('DEFAULT_TRANSLATE_MODEL 자신도 자기 검증(isValidTranslateModel)을 통과한다 — self-consistency', () => {
        // resolveTranslateModel()의 모든 "unset/invalid" 분기는 isValidTranslateModel을
        // 거치지 않고 DEFAULT_TRANSLATE_MODEL을 곧장 반환한다. 위 테스트들은
        // MODEL_SPECS 인덱싱으로 apiModelId만 비교하므로, 그 기본값이 실제로
        // Gemini provider이면서 사고 비활성화를 지원하는지는 검증하지 못한다.
        // siglens-core가 이 모델을 rename/제거하거나 허용목록에서 빼면 가장 흔하게
        // 타는 폴백 경로가 곧바로 미검증 값이 되어 Gemini에 400을 던진다 — 이
        // 테스트가 그 회귀를 잡는다.
        const defaultModel = _getDefaultTranslateModelForTest();
        expect(_isValidTranslateModelForTest(defaultModel)).toBe(true);
    });

    it('toApiModelId는 MODEL_SPECS에 없는 값을 받아도 던지지 않고 그 값을 그대로 반환한다', () => {
        // resolveTranslateModel()의 unset/invalid 두 분기는 isValidTranslateModel을
        // 거치지 않고 DEFAULT_TRANSLATE_MODEL을 곧장 toApiModelId에 넘긴다.
        // MODEL_SPECS[value as ActiveModelId] 인덱싱을 그대로 뒀다면 이 케이스에서
        // TypeError가 던져지고, tryReadTranslatorConfig()가
        // translateCompanyNames/translateCompanyDescription의 try/catch **밖**에서
        // 호출되므로 그 throw는 문서화된 우아한 디그레이드를 우회한다.
        // toApiModelId는 miss일 때 값을 그대로 반환해 이 throw를 구조적으로
        // 막는다 — self-consistency 테스트(위)가 "그런 miss가 실제로 일어나지
        // 않게" 막는 것과는 다른, 방어적 안전망이다.
        expect(_toApiModelIdForTest('this-model-does-not-exist')).toBe(
            'this-model-does-not-exist'
        );
    });

    it('경고는 잘못된 값이 반복돼도 최초 1회만 로깅한다', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('GEMINI_API_KEY', 'paid');
        vi.stubEnv('TRANSLATE_MODEL', 'gemini-custom');

        tryReadTranslatorConfig();
        tryReadTranslatorConfig();
        tryReadTranslatorConfig();

        expect(warnSpy).toHaveBeenCalledTimes(1);

        warnSpy.mockRestore();
    });
});
