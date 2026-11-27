import { ThinkingLevel, type GenerateContentParameters } from '@google/genai';

/**
 * DB 콘텐츠 번역 요청 본문. `translateContentLocale.ts`는 import만 해도 `main()`이
 * 돌아 DB에 붙으므로, 요청 모양을 키·DB 없이 단위 테스트하려고 분리했다.
 *
 * 모델, 사고 수준, `temperature`를 보내지 않는 이유는 카탈로그 번역 쪽
 * `scripts/i18n/lib/translateRequest.mjs`의 주석에 적혀 있다. 두 빌더는 실행 환경이
 * 달라(.mjs는 node 직접 실행, 이 파일은 tsx) 따로 두고,
 * `scripts/i18n/__tests__/translateRequest.test.ts`가 두 요청이 같다는 것을 고정한다.
 */
export function buildTranslateRequest(
    prompt: string
): GenerateContentParameters {
    return {
        model: 'gemini-3.5-flash-lite',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
    };
}
