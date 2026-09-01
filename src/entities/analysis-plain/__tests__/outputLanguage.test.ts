import { describe, it, expect } from 'vitest';
import {
    plainOutputLanguageHeader,
    plainOutputLanguageDirective,
    plainSystemInstruction,
    plainLanguageRetryHint,
} from '../lib/outputLanguage';

/**
 * 이 모듈의 존재 이유는 하나다 — 재작성 규칙 본문이 한국어라, 출력 언어 지시를
 * 대상 언어로 써야 모델이 따른다. 실측 근거는 모듈 JSDoc에 있다.
 */
describe('평이화 출력 언어 지시', () => {
    it('ko에서는 아무것도 붙이지 않는다 — 기존 프롬프트 바이트를 유지한다', () => {
        expect(plainOutputLanguageHeader('ko')).toBe('');
        expect(plainOutputLanguageDirective('ko')).toBe('');
        expect(plainSystemInstruction('ko')).toBeUndefined();
        expect(plainLanguageRetryHint('ko')).toBeNull();
    });

    it('알 수 없는 로케일도 ko와 같이 다룬다 — 프롬프트 본문이 한국어로 떨어지는 것과 맞춘다', () => {
        expect(plainOutputLanguageHeader('kr')).toBe('');
        expect(plainOutputLanguageDirective('pt-BR')).toBe('');
        expect(plainSystemInstruction('')).toBeUndefined();
    });

    /**
     * **지시문이 대상 언어로 쓰여 있어야 한다.** 영어로 쓰면 한국어 규칙 본문에
     * 밀린다(대조군 B·C: 영어 말미 오버라이드·영어 시스템 프롬프트 둘 다 한국어
     * 출력을 못 막았다). 이 단언이 그 성질을 고정한다.
     */
    it.each([
        ['ja', /[ぁ-ゟ゠-ヿ]/],
        ['zh', /[一-鿿]/],
    ])('%s 지시문은 그 언어의 문자로 쓰여 있다', (locale, script) => {
        expect(plainOutputLanguageHeader(locale)).toMatch(script);
        expect(plainOutputLanguageDirective(locale)).toMatch(script);
        expect(plainSystemInstruction(locale)).toMatch(script);
        expect(plainLanguageRetryHint(locale)).toMatch(script);
    });

    it('en 지시문은 영어다', () => {
        expect(plainOutputLanguageDirective('en')).toContain('English');
        expect(plainSystemInstruction('en')).toContain('English');
    });

    /**
     * 입력 산문은 core가 이미 요청 로케일로 써준다. 지시문이 "원문은 한국어다"라고
     * 말하면 모델에게 거짓을 알려주는 것이라, 없는 번역을 하게 만든다.
     */
    it.each(['en', 'ja', 'zh'])(
        '%s 지시문이 원문을 한국어라고 주장하지 않는다',
        locale => {
            const all = [
                plainOutputLanguageDirective(locale),
                plainSystemInstruction(locale) ?? '',
            ].join('\n');
            expect(all).not.toMatch(/source text above are Korean/);
            expect(all).not.toMatch(/原文は韓国語/);
            expect(all).not.toMatch(/原文都是韩语/);
        }
    );

    it('말미 지시는 프롬프트 끝에 붙도록 줄바꿈으로 시작한다', () => {
        expect(plainOutputLanguageDirective('zh').startsWith('\n')).toBe(true);
    });
});
