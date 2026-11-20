import { ThinkingLevel } from '@google/genai';

/**
 * DB 콘텐츠 번역 요청 본문. `translateContentLocale.ts`는 import만 해도 `main()`이
 * 돌아 DB에 붙으므로, 요청 모양을 키·DB 없이 단위 테스트하려고 분리했다.
 *
 * 모델: 2026-11-21에 읽은 Google 문서 기준으로 `gemini-2.5-flash`는 2026-12-01에
 * `gemini-3.5-flash-lite`로 자동 라우팅되며 "`thinking_level`이 `thinking_budget`을
 * 대체하고 샘플링 파라미터가 제거된다"고 적혀 있다(실측 아님). 라우팅에 맡기지 않고
 * 도착지 id를 직접 쓴다.
 *
 * 추론: 이 모델의 기본 사고 수준은 MINIMAL이다(같은 문서). 번역은 결정적 변환이라
 * 추론 이득이 없으므로 명시해서 고정한다. 3세대 이후는 `thinkingBudget`이 아니라
 * `thinkingLevel`을 쓴다.
 *
 * `temperature`는 보내지 않는다. 같은 변경 로그가 자동 라우팅 대상에서 샘플링
 * 파라미터가 제거된다고 적고 있어서다. 이 id가 `temperature: 0`을 받았을 때 어떻게
 * 동작하는지는 문서로도 실측으로도 확인하지 않았으므로, 이전처럼 결정적 출력이
 * 유지되는지는 알 수 없다. 응답 형식(`responseMimeType`)은 그대로다.
 */
export function buildTranslateRequest(prompt: string) {
    return {
        model: 'gemini-3.5-flash-lite',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
    };
}
