import {
    getModelAccess,
    getProviderForModel,
    TIER_CONFIG,
} from '@y0ngha/siglens-core';
import {
    API_KNOWN_MODELS,
    API_MODEL_PROVIDERS,
    checkApiModel,
    isKnownApiModel,
    listApiSelectableModels,
} from '@/entities/siglens-api-key/lib/apiModels';

const ROSTER = [...new Set(Object.values(TIER_CONFIG.models).flat())];

describe('API_MODEL_PROVIDERS', () => {
    it('로스터에 모델이 있는 provider 전부(등급과 무관)', () => {
        const expected = [
            ...new Set(API_KNOWN_MODELS.map(id => getProviderForModel(id))),
        ];
        expect([...API_MODEL_PROVIDERS].toSorted()).toEqual(
            expected.toSorted()
        );
        expect(API_MODEL_PROVIDERS).toEqual(
            expect.arrayContaining(['anthropic', 'google', 'openai'])
        );
    });
});

describe('API_KNOWN_MODELS / isKnownApiModel', () => {
    it('로스터 전체이고 중복이 없다', () => {
        expect([...API_KNOWN_MODELS].toSorted()).toEqual(ROSTER.toSorted());
        expect(new Set(API_KNOWN_MODELS).size).toBe(API_KNOWN_MODELS.length);
    });

    it.each(['claude-haiku-5-5', 'claude-opus-5'])('%s는 알려진 모델', id => {
        expect(isKnownApiModel(id)).toBe(true);
    });

    it.each(['', 'constructor', '__proto__', 'gpt-99', 'claude-opus-5 '])(
        '%j는 알려진 모델이 아니다',
        id => {
            expect(isKnownApiModel(id)).toBe(false);
        }
    );
});

describe('listApiSelectableModels', () => {
    it('등록한 provider의 모델 전부를 등급과 무관하게, 로스터 순서대로 낸다', () => {
        const anthropic = listApiSelectableModels(['anthropic']);
        expect(anthropic.every(id => id.startsWith('claude-'))).toBe(true);
        expect(anthropic).toEqual(
            API_KNOWN_MODELS.filter(id => id.startsWith('claude-'))
        );
    });

    it('free·member 등급 모델도 등록한 provider의 선택지에 들어간다', () => {
        const anthropic = listApiSelectableModels(['anthropic']);
        expect(getModelAccess('claude-haiku-5-5')).not.toBe('byok');
        expect(getModelAccess('claude-sonnet-5-5')).not.toBe('byok');
        expect(anthropic).toContain('claude-haiku-5-5');
        expect(anthropic).toContain('claude-sonnet-5-5');
        expect(anthropic).toContain('claude-opus-5');
    });

    it('키가 없으면 빈 목록', () => {
        expect(listApiSelectableModels([])).toEqual([]);
    });

    it('여러 provider를 등록하면 합쳐진다', () => {
        const both = listApiSelectableModels(['anthropic', 'openai']);
        expect(both.some(id => id.startsWith('claude-'))).toBe(true);
        expect(both.some(id => id.startsWith('gpt-'))).toBe(true);
        expect(both.some(id => id.startsWith('gemini-'))).toBe(false);
    });
});

describe('checkApiModel', () => {
    it.each(['claude-opus-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'])(
        '등록된 provider의 %s는 등급과 무관하게 통과',
        id => {
            expect(checkApiModel(id, ['anthropic'])).toEqual({
                ok: true,
                model: id,
            });
        }
    );

    it.each(['claude-opus-5', 'claude-haiku-5-5'])(
        '%s: provider 키가 없으면 provider_key_missing',
        id => {
            expect(checkApiModel(id, ['openai'])).toEqual({
                ok: false,
                reason: 'provider_key_missing',
            });
        }
    );

    it.each(['nope', '', 'claude-opus-5 '])(
        '%j는 로스터에 없어 invalid_model',
        id => {
            expect(
                checkApiModel(id, ['anthropic', 'openai', 'google', 'deepseek'])
            ).toEqual({ ok: false, reason: 'invalid_model' });
        }
    );
});
