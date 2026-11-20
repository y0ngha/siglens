import { ThinkingLevel } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { buildTranslateRequest as buildCatalogRequest } from '../lib/translateRequest.mjs';
import { buildTranslateRequest as buildDbRequest } from '../../../db/scripts/lib/translateRequest';

/**
 * 두 번역 스크립트의 Gemini 요청 모양을 고정한다. `gemini-2.5-flash`는
 * 2026-12-01에 자동 라우팅되며 `thinkingBudget`과 샘플링 파라미터가 사라진다.
 * 요청 객체를 통째로 단언하므로 샘플링 파라미터가 하나라도 되살아나면 실패한다.
 */
describe.each([
    ['카탈로그 번역(translate.mjs)', buildCatalogRequest],
    ['DB 콘텐츠 번역(translateContentLocale.ts)', buildDbRequest],
])('%s 요청', (_label, build) => {
    it('모델·응답 형식·사고 수준만 보낸다', () => {
        expect(build('PROMPT')).toStrictEqual({
            model: 'gemini-3.5-flash-lite',
            contents: 'PROMPT',
            config: {
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            },
        });
    });
});

it('두 빌더는 같은 프롬프트에 같은 요청을 돌려준다', () => {
    expect(buildDbRequest('P')).toStrictEqual(buildCatalogRequest('P'));
});
