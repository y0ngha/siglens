import { getModelAccess, TIER_CONFIG } from '@y0ngha/siglens-core';
import {
    API_GENERATABLE_MODELS,
    API_GENERATABLE_PROVIDERS,
    API_KNOWN_MODELS,
    checkApiModel,
    isApiGeneratableModel,
    isKnownApiModel,
    listApiSelectableModels,
} from '@/entities/siglens-api-key/lib/apiModels';

const ROSTER = [...new Set(Object.values(TIER_CONFIG.models).flat())];

describe('API_GENERATABLE_MODELS', () => {
    it('로스터의 byok 등급 모델 전부이고 그것뿐이다(core 분류에서 파생)', () => {
        const expected = ROSTER.filter(id => getModelAccess(id) === 'byok');
        expect([...API_GENERATABLE_MODELS].toSorted()).toEqual(
            expected.toSorted()
        );
        expect(API_GENERATABLE_MODELS.length).toBeGreaterThan(0);
    });

    it('free·member 등급 모델은 하나도 없다(core가 서버 키로 호출하는 모델)', () => {
        for (const id of API_GENERATABLE_MODELS)
            expect(getModelAccess(id)).toBe('byok');
        expect(API_GENERATABLE_MODELS).not.toContain('claude-haiku-5-5');
        expect(API_GENERATABLE_MODELS).not.toContain('claude-sonnet-5-5');
    });
});

describe('API_GENERATABLE_PROVIDERS', () => {
    it('생성 가능한 모델이 있는 provider만이다', () => {
        expect([...API_GENERATABLE_PROVIDERS].toSorted()).toEqual([
            'anthropic',
            'google',
            'openai',
        ]);
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

describe('isApiGeneratableModel', () => {
    it('byok 등급만 참', () => {
        expect(isApiGeneratableModel('claude-opus-5')).toBe(true);
        expect(isApiGeneratableModel('claude-haiku-5-5')).toBe(false);
        expect(isApiGeneratableModel('claude-sonnet-5-5')).toBe(false);
    });
});

describe('listApiSelectableModels', () => {
    it('등록한 provider의 byok 모델만, 로스터 순서대로', () => {
        const anthropic = listApiSelectableModels(['anthropic']);
        expect(anthropic.length).toBeGreaterThan(0);
        expect(anthropic.every(id => id.startsWith('claude-'))).toBe(true);
        expect(anthropic).toEqual(
            API_GENERATABLE_MODELS.filter(id => id.startsWith('claude-'))
        );
    });

    it('키가 없으면 빈 목록', () => {
        expect(listApiSelectableModels([])).toEqual([]);
    });

    it('byok 모델이 없는 provider(deepseek)만 등록했으면 빈 목록', () => {
        expect(listApiSelectableModels(['deepseek'])).toEqual([]);
    });

    it('여러 provider를 등록하면 합쳐진다', () => {
        const both = listApiSelectableModels(['anthropic', 'openai']);
        expect(both.some(id => id.startsWith('claude-'))).toBe(true);
        expect(both.some(id => id.startsWith('gpt-'))).toBe(true);
        expect(both.some(id => id.startsWith('gemini-'))).toBe(false);
    });
});

describe('checkApiModel', () => {
    it('등록된 provider의 byok 모델은 통과', () => {
        expect(checkApiModel('claude-opus-5', ['anthropic'])).toEqual({
            ok: true,
            model: 'claude-opus-5',
        });
    });

    it('provider 키가 없으면 provider_key_missing', () => {
        expect(checkApiModel('claude-opus-5', ['openai'])).toEqual({
            ok: false,
            reason: 'provider_key_missing',
        });
    });

    it.each(['claude-haiku-5-5', 'nope', ''])(
        '%j는 invalid_model — 키를 등록했어도 생성할 수 없는 모델이다',
        id => {
            expect(
                checkApiModel(id, ['anthropic', 'openai', 'google', 'deepseek'])
            ).toEqual({ ok: false, reason: 'invalid_model' });
        }
    );
});
